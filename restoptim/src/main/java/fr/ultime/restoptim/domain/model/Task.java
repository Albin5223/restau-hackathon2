package fr.ultime.restoptim.domain.model;

import java.util.List;

public record Task(
        int id,
        String name,
        TaskKind kind,
        List<ResourceType> resources,
        int duration,
        List<Integer> dependencies) {
}
