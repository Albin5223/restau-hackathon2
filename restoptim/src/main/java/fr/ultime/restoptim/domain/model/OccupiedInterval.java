package fr.ultime.restoptim.domain.model;

/**
 * Intervalle de temps pendant lequel une instance de ressource est déjà
 * réservée par une commande active. Les secondes sont relatives à l'instant
 * de planification de la nouvelle commande (t=0 = maintenant).
 */
public record OccupiedInterval(
        ResourceType type,
        String instanceName,
        long startSecond,
        long endSecond) {
}
