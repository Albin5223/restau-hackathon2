package fr.ultime.restoptim.domain;

import java.util.List;

/** Requête de planification : une commande contient plusieurs plats (jobs). */
public record OrderRequest(
        String orderId,
        List<DishJob> dishes
) {
    public OrderRequest {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("L'id de commande est requis.");
        }
        if (dishes == null || dishes.isEmpty()) {
            throw new IllegalArgumentException("La commande doit contenir au moins un plat.");
        }
    }
}
