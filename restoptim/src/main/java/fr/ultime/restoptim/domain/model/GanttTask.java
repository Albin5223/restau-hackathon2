package fr.ultime.restoptim.domain.model;

public record GanttTask(
        String id,
        String commandeId,
        int tableNumber,
        String dishName,
        String taskName,
        String kind,
        String resourceName,
        long startAt,
        long endAt) {
}
