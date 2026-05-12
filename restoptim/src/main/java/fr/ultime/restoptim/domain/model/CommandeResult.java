package fr.ultime.restoptim.domain.model;

import java.util.List;

public record CommandeResult(
        String commandeId,
        int tableNumber,
        long serviceTimeAt,
        List<GanttTask> scheduledTasks) {
}
