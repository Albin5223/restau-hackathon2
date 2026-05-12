package fr.ultime.restoptim.application.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.model.Table;
import fr.ultime.restoptim.domain.model.TableStatus;
import fr.ultime.restoptim.domain.spi.Commandes;
import fr.ultime.restoptim.domain.spi.Tables;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/tables")
@RequiredArgsConstructor
public class TableController {

    private final Tables tables;
    private final Commandes commandes;

    @GetMapping
    public List<Table> list() {
        return tables.getTables();
    }

    @GetMapping("/{id}")
    public Table get(@PathVariable int id) {
        return tables.getTableById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
    }

    @PostMapping("/{id}/install")
    public Table install(@PathVariable int id, @RequestBody InstallRequest body) {
        Table table = tables.getTableById(id)
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
    public Table release(@PathVariable int id) {
        Table table = tables.getTableById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
        if (table.commandeId() != null) {
            commandes.closeCommande(table.commandeId());
        }
        Table updated = new Table(table.id(), table.number(), table.seats(), TableStatus.LIBRE, null, null);
        tables.save(updated);
        return updated;
    }

    @PostMapping("/{id}/serve")
    public Table serve(@PathVariable int id) {
        Table table = tables.getTableById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table introuvable : " + id));
        Table updated = new Table(table.id(), table.number(), table.seats(),
                TableStatus.SERVIE, table.partySize(), table.commandeId());
        tables.save(updated);
        return updated;
    }

    public record InstallRequest(int partySize) {
    }
}
