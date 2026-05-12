package fr.ultime.restoptim.domain.spi;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.order.Order;
import fr.ultime.restoptim.domain.model.order.OrderId;

public interface Orders {

    void save(Order order);

    Optional<Order> getOrderById(OrderId id);

    void updateSchedule(OrderId orderId, String scheduleJson);

    List<Order> getActiveOrders();

    void closeOrder(OrderId orderId);
}
