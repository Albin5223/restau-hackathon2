package fr.ultime.restoptim.domain.model;

import fr.ultime.restoptim.domain.model.order.OrderId;
import lombok.Builder;

import java.util.List;

@Builder(setterPrefix = "with")
public record OrderSchedule(
        OrderId orderId,
        long serviceTimeSecond,
        List<ScheduledTask> scheduledTasks) {
}
