package fr.ultime.restoptim.domain.model;

import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.job.JobId;
import fr.ultime.restoptim.domain.model.task.TaskId;
import fr.ultime.restoptim.domain.model.task.TaskType;

import java.util.List;

public record ScheduledTask(
        JobId jobId,
        DishId dishId,
        String dishName,
        TaskId taskId,
        String taskName,
        TaskType kind,
        long startSecond,
        long endSecond,
        List<ResourceType> resources,
        List<String> assignedResourceNames) {
}
