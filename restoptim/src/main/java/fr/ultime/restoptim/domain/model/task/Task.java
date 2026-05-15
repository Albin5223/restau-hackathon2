package fr.ultime.restoptim.domain.model.task;

import fr.ultime.restoptim.domain.model.ResourceType;

import java.util.List;

public record Task(
        TaskId id,
        String name,
        TaskType kind,
        List<ResourceType> resources,
        int duration,
        List<TaskId> dependencies) {
}
