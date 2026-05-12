package fr.ultime.restoptim.application.api;

import java.util.List;

import fr.ultime.restoptim.domain.model.table.TableId;
import fr.ultime.restoptim.domain.spi.Orders;
import fr.ultime.restoptim.domain.service.AutoSimulationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.model.table.Table;
import fr.ultime.restoptim.domain.model.table.TableStatus;
import fr.ultime.restoptim.domain.spi.Tables;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/tables")
@RequiredArgsConstructor
public class TableController {

    private final Tables tables;
    private final Orders orders;
    private final AutoSimulationService autoSimulationService;

    private void checkNotInAutoSim() {
        if (autoSimulationService.isActive()) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Simulation automatique en cours — opérations manuelles désactivées.");
        }
    }

    @GetMapping
    public List<Table> list() {
        return tables.getTables();
    }

    @GetMapping("/{id}")
    public Table get(@PathVariable long id) {
        return tables.getTableById(TableId.from(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
    }

    @PostMapping("/{id}/install")
    public Table install(@PathVariable long id, @RequestBody InstallRequest body) {
        checkNotInAutoSim();
        Table table = tables.getTableById(TableId.from(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
        if (table.status() != TableStatus.LIBRE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La table n'est pas libre.");
        }
        if (body.partySize() < 1 || body.partySize() > table.seats()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Taille du groupe invalide (max " + table.seats() + ").");
        }
        Table updated = new Table(table.id(), table.number(), table.seats(),
                TableStatus.COMMANDE_PASSEE, body.partySize(), null);
        tables.save(updated);
        return updated;
    }

    @PostMapping("/{id}/release")
    public Table release(@PathVariable long id) {
        checkNotInAutoSim();
        Table table = tables.getTableById(TableId.from(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
        if (table.orderId() != null) {
            orders.closeOrder(table.orderId());
        }
        Table updated = new Table(table.id(), table.number(), table.seats(), TableStatus.LIBRE, null, null);
        tables.save(updated);
        return updated;
    }

    @PostMapping("/{id}/serve")
    public Table serve(@PathVariable long id) {
        checkNotInAutoSim();
        Table table = tables.getTableById(TableId.from(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
        Table updated = new Table(table.id(), table.number(), table.seats(),
                TableStatus.SERVIE, table.partySize(), table.orderId());
        tables.save(updated);
        return updated;
    }

    public record InstallRequest(int partySize) {
    }
}
