package fr.ultime.restoptim.domain.model;

import java.util.List;

public record OrderSchedule(
        String orderId,
        long serviceTimeMinute,
        List<ScheduledTask> scheduledTasks) {
}
