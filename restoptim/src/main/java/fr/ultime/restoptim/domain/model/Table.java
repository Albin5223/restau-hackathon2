package fr.ultime.restoptim.domain.model;

import fr.ultime.restoptim.domain.model.order.OrderId;

public record Table(
        int id,
        int number,
        int seats,
        TableStatus status,
        Integer partySize,
        OrderId orderId) {
}
