package fr.ultime.restoptim.domain.model;

import java.util.List;

public record OrderResult(
        String orderId,
        int tableNumber,
        long serviceTimeAt,
        List<GanttTask> scheduledTasks) {
}
