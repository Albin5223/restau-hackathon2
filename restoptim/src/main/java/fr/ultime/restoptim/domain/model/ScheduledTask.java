package fr.ultime.restoptim.domain.model;

import java.util.List;

public record ScheduledTask(
        String jobId,
        int dishId,
        String dishName,
        int taskId,
        String taskName,
        TaskKind kind,
        long startMinute,
        long endMinute,
        List<ResourceType> resources) {
}
