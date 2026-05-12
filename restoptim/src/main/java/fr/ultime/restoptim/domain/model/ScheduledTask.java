package fr.ultime.restoptim.domain.model;

import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.job.JobId;

import java.util.List;

public record ScheduledTask(
        JobId jobId,
        DishId dishId,
        String dishName,
        int taskId,
        String taskName,
        TaskKind kind,
        long startSecond,
        long endSecond,
        List<ResourceType> resources,
        List<String> assignedResourceNames) {
}
