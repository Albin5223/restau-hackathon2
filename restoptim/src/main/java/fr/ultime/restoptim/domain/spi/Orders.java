package fr.ultime.restoptim.domain.spi;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.OrderSchedule;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.order.Order;
import fr.ultime.restoptim.domain.model.order.OrderId;

public interface Orders {

    void save(Order order);

    Optional<Order> getOrderById(OrderId id);

    void updateSchedule(OrderId orderId, OrderSchedule scheduleJson);

    List<Order> getActiveOrders();

    void closeOrder(OrderId orderId);

    boolean isDishReferenced(DishId dishId);

    /**
     * Décale le placed_at de toutes les commandes actives.
     *
     * @param deltaMs valeur ajoutée à placed_at. Négatif = la commande paraît
     *                « plus ancienne » (équivalent à avancer le temps présent).
     * @return nombre de commandes mises à jour.
     */
    int shiftActiveOrdersPlacedAt(long deltaMs);
}
