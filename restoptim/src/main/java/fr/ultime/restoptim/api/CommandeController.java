package fr.ultime.restoptim.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.model.CommandeResult;
import fr.ultime.restoptim.domain.service.CommandeService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/commandes")
@RequiredArgsConstructor
public class CommandeController {

    private final CommandeService commandeService;

    @PostMapping
    public CommandeResult place(@RequestBody PlaceCommandeRequest body) {
        if (body.dishIds() == null || body.dishIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dishIds est requis et non vide.");
        }
        try {
            return commandeService.placeCommande(body.tableId(), body.dishIds());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    public record PlaceCommandeRequest(int tableId, List<Integer> dishIds) {
    }
}
