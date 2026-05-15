package fr.ultime.restoptim.domain.model;

import fr.ultime.restoptim.domain.model.order.OrderId;

import java.util.List;

public record GanttTask(
        String id,
        OrderId orderId,
        int tableNumber,
        String dishName,
        String taskName,
        String kind,
        List<String> resourceNames,
        long startAt,
        long endAt) {
}
