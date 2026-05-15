package fr.ultime.restoptim.application.api;

import java.util.List;

import fr.ultime.restoptim.application.dto.TableDto;
import fr.ultime.restoptim.application.mapper.TableMapper;
import fr.ultime.restoptim.domain.model.table.TableId;
import fr.ultime.restoptim.domain.spi.Orders;
import fr.ultime.restoptim.domain.service.AutoSimulationService;
import fr.ultime.restoptim.domain.service.OrderService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
    private final OrderService orderService;
    private final TableMapper tableMapper;

    private void checkNotInAutoSim() {
        if (autoSimulationService.isActive()) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Simulation automatique en cours — opérations manuelles désactivées.");
        }
    }

    @GetMapping
    public List<TableDto> list() {
        return tables.getTables().stream().map(tableMapper::toDto).toList();
    }

    @GetMapping("/{id}")
    public TableDto get(@PathVariable long id) {
        return tables.getTableById(TableId.from(id)).map(tableMapper::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
    }

    @PostMapping("/{id}/install")
    public TableDto install(@PathVariable long id, @RequestBody InstallRequest body) {
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
        return tableMapper.toDto(updated);
    }

    @PostMapping("/{id}/release")
    public TableDto release(@PathVariable long id) {
        checkNotInAutoSim();
        Table table = tables.getTableById(TableId.from(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
        if (table.orderId() != null) {
            orders.closeOrder(table.orderId());
        }
        Table updated = new Table(table.id(), table.number(), table.seats(), TableStatus.LIBRE, null, null);
        tables.save(updated);
        orderService.replanActiveOrders();
        return tableMapper.toDto(updated);
    }

    @PostMapping("/{id}/serve")
    public TableDto serve(@PathVariable long id) {
        checkNotInAutoSim();
        Table table = tables.getTableById(TableId.from(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
        Table updated = new Table(table.id(), table.number(), table.seats(),
                TableStatus.SERVIE, table.partySize(), table.orderId());
        tables.save(updated);
        return tableMapper.toDto(updated);
    }

    @PostMapping
    public ResponseEntity<TableDto> createTable(@RequestBody CreateTableRequest body) {
        checkNotInAutoSim();
        if (body.seats() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nombre de places doit être supérieur à 0.");
        }
        Table table = tables.createTable(body.seats());
        return ResponseEntity.status(HttpStatus.CREATED).body(tableMapper.toDto(table));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTable(@PathVariable long id) {
        checkNotInAutoSim();
        Table table = tables.getTableById(TableId.from(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
        if (table.status() != TableStatus.LIBRE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La table doit être libre pour être supprimée.");
        }
        tables.deleteTable(TableId.from(id));
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}")
    public TableDto updateSeats(@PathVariable long id, @RequestBody UpdateSeatsRequest body) {
        checkNotInAutoSim();
        Table table = tables.getTableById(TableId.from(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
        if (table.status() != TableStatus.LIBRE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La table doit être libre pour être modifiée.");
        }
        if (body.seats() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nombre de places doit être supérieur à 0.");
        }
        tables.updateSeats(TableId.from(id), body.seats());
        return tableMapper.toDto(new Table(table.id(), table.number(), body.seats(), table.status(), null, null));
    }

    public record InstallRequest(int partySize) {
    }

    public record CreateTableRequest(int seats) {
    }

    public record UpdateSeatsRequest(int seats) {
    }
}
