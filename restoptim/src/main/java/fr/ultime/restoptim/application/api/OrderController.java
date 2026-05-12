package fr.ultime.restoptim.application.api;

import java.util.List;

import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.table.TableId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.model.OrderResult;
import fr.ultime.restoptim.domain.service.OrderService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private static final Logger logger = LoggerFactory.getLogger(OrderController.class);
    private final OrderService orderService;

    @PostMapping
    public OrderResult place(@RequestBody PlaceOrderRequest body) {
        logger.info("[ORDER] Reçu request: tableId={}, dishIds={}, speedMultiplier={}", body.tableId(), body.dishIds(), body.speedMultiplier());
        if (body.dishIds() == null || body.dishIds().isEmpty()) {
            logger.warn("[ORDER] Validation échouée: dishIds null ou vide");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dishIds est requis et non vide.");
        }
        double multiplier = (body.speedMultiplier() != null && body.speedMultiplier() > 0)
                ? body.speedMultiplier()
                : 1.0;
        try {
            logger.debug("[ORDER] Appel OrderService.placeOrder pour tableId={}", body.tableId());
            OrderResult result = orderService.placeOrder(TableId.from(body.tableId()), body.dishIds().stream().map(DishId::from).toList(), multiplier);
            logger.info("[ORDER] Succès: orderId={}, serviceTime={}", result.orderId(), result.serviceTimeAt());
            return result;
        } catch (IllegalArgumentException e) {
            logger.error("[ORDER] Erreur BAD_REQUEST: tableId={}, message={}", body.tableId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            logger.error("[ORDER] Erreur CONFLICT: tableId={}, message={}", body.tableId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    public record PlaceOrderRequest(long tableId, List<Long> dishIds, Double speedMultiplier) {
    }
}
