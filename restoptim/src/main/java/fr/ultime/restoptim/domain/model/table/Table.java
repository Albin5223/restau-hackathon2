package fr.ultime.restoptim.domain.model.table;

import fr.ultime.restoptim.domain.model.order.OrderId;

public record Table(
        TableId id,
        int number,
        int seats,
        TableStatus status,
        Integer partySize,
        OrderId orderId) {
}
