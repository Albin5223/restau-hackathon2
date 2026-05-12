package fr.ultime.restoptim.domain.spi;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.Order;

public interface Orders {

    void save(Order order);

    Optional<Order> getOrderById(String id);

    List<Order> getActiveOrders();
}
