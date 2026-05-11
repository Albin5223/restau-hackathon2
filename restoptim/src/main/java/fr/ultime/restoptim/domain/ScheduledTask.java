package fr.ultime.restoptim.domain;

import java.util.List;

/** Résultat : une tâche planifiée avec ses ressources et son intervalle. */
public record ScheduledTask(
        String dishId,
        String dishName,
        String taskName,
        TaskKind kind,
        long startMinute,
        long endMinute,
        List<Resource> resources
) {
}
