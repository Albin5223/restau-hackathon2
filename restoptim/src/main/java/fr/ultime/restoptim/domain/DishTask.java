package fr.ultime.restoptim.domain;

import java.util.List;

/**
 * Définition immuable d'une tâche dans la recette d'un plat.
 * - name : nom humain lisible
 * - kind : type métier (COOKING, PLATING...)
 * - durationMinutes : durée en minutes
 * - resources : liste de ressources nécessaires simultanément
 * - dependsOn : indices des tâches (dans la même liste) dont cette tâche dépend
 */
public record DishTask(
        String name,
        TaskKind kind,
        int durationMinutes,
        List<Resource> resources,
        List<Integer> dependsOn
) {
    public DishTask {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Le nom de la tâche ne peut pas être vide.");
        }
        if (kind == null) {
            throw new IllegalArgumentException("Le type de tâche (kind) ne peut pas être nul.");
        }
        if (durationMinutes <= 0) {
            throw new IllegalArgumentException("La durée doit être strictement positive.");
        }
        if (resources == null || resources.isEmpty()) {
            throw new IllegalArgumentException("Une tâche doit nécessiter au moins une ressource.");
        }
        if (dependsOn == null) {
            throw new IllegalArgumentException("La liste dependsOn ne peut pas être nulle (peut être vide).");
        }
    }
}
