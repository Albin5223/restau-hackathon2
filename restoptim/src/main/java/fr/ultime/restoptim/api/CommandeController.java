package fr.ultime.restoptim.api;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger logger = LoggerFactory.getLogger(CommandeController.class);
    private final CommandeService commandeService;

    @PostMapping
    public CommandeResult place(@RequestBody PlaceCommandeRequest body) {
        logger.info("[COMMANDE] Reçu request: tableId={}, dishIds={}, speedMultiplier={}", body.tableId(), body.dishIds(), body.speedMultiplier());
        if (body.dishIds() == null || body.dishIds().isEmpty()) {
            logger.warn("[COMMANDE] Validation échouée: dishIds null ou vide");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dishIds est requis et non vide.");
        }
        double multiplier = (body.speedMultiplier() != null && body.speedMultiplier() > 0)
                ? body.speedMultiplier()
                : 1.0;
        try {
            logger.debug("[COMMANDE] Appel CommandeService.placeCommande pour tableId={}", body.tableId());
            CommandeResult result = commandeService.placeCommande(body.tableId(), body.dishIds(), multiplier);
            logger.info("[COMMANDE] Succès: commandeId={}, serviceTime={}", result.commandeId(), result.serviceTimeAt());
            return result;
        } catch (IllegalArgumentException e) {
            logger.error("[COMMANDE] Erreur BAD_REQUEST: tableId={}, message={}", body.tableId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            logger.error("[COMMANDE] Erreur CONFLICT: tableId={}, message={}", body.tableId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    public record PlaceCommandeRequest(int tableId, List<Integer> dishIds, Double speedMultiplier) {
    }
}
