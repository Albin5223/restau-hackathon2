package fr.ultime.restoptim.domain.model;

import java.util.List;

public record GanttTask(
        String id,
        String commandeId,
        int tableNumber,
        String dishName,
        String taskName,
        String kind,
        List<String> resourceNames,
        long startAt,
        long endAt) {
}
