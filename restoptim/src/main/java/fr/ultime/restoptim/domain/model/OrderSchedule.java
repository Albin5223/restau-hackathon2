package fr.ultime.restoptim.domain.model;

import fr.ultime.restoptim.domain.model.order.OrderId;

import java.util.List;

public record OrderSchedule(
        OrderId orderId,
        long serviceTimeSecond,
        List<ScheduledTask> scheduledTasks) {
}
