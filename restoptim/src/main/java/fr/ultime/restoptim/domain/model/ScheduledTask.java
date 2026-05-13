package fr.ultime.restoptim.domain.model;

import java.util.List;

public record ScheduledTask(
        String jobId,
        int dishId,
        String dishName,
        int taskId,
        String taskName,
        TaskKind kind,
        long startSecond,
        long endSecond,
        List<ResourceType> resources,
        List<String> assignedResourceNames) {
}
