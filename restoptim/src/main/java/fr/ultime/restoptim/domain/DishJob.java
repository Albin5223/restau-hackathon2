package fr.ultime.restoptim.domain;

import java.util.List;

/**
 * Un plat (job) : identifiant, nom et liste ordonnée de tâches formant un DAG.
 * L'ordre dans la liste permet de référencer les dépendances par index.
 */
public record DishJob(
        String dishId,
        String dishName,
        List<DishTask> tasks
) {
    public DishJob {
        if (dishId == null || dishId.isBlank()) {
            throw new IllegalArgumentException("L'identifiant du plat est requis.");
        }
        if (dishName == null || dishName.isBlank()) {
            throw new IllegalArgumentException("Le nom du plat est requis.");
        }
        if (tasks == null || tasks.isEmpty()) {
            throw new IllegalArgumentException("Un plat doit contenir au moins une tâche.");
        }
    }
}
