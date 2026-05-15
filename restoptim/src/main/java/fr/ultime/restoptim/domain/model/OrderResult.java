package fr.ultime.restoptim.domain.model;

import fr.ultime.restoptim.domain.model.order.OrderId;

import java.util.List;

public record OrderResult(
        OrderId orderId,
        int tableNumber,
        long serviceTimeAt,
        List<GanttTask> scheduledTasks) {
}
