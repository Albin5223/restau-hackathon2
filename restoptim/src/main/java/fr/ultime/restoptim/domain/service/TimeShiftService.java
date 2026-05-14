package fr.ultime.restoptim.domain.service;

import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import fr.ultime.restoptim.domain.spi.Orders;
import lombok.RequiredArgsConstructor;

/**
 * Permet de « voyager dans le temps » en décalant les placed_at de toutes
 * les commandes actives. L'offset cumulé représente la quantité de temps
 * dont l'horloge perçue par l'utilisateur a avancé (positif) ou reculé
 * (négatif) par rapport au temps réel.
 *
 * Le contrôleur est responsable de bloquer les déplacements pendant la
 * simulation automatique (pour éviter une dépendance circulaire ici).
 */
@Service
@RequiredArgsConstructor
public class TimeShiftService {

    private static final Logger logger = LoggerFactory.getLogger(TimeShiftService.class);

    private final Orders orders;

    private final AtomicLong cumulativeOffsetMs = new AtomicLong(0);

    public long getOffsetMs() {
        return cumulativeOffsetMs.get();
    }

    /**
     * Décale le temps perçu de {@code deltaMs}. Positif = avancer (les plats
     * paraissent plus en cours / terminés), négatif = reculer.
     */
    public synchronized long shift(long deltaMs) {
        if (deltaMs == 0L) return cumulativeOffsetMs.get();

        // Avancer le temps perçu = ramener les placed_at vers le passé.
        int updated = orders.shiftActiveOrdersPlacedAt(-deltaMs);
        long newOffset = cumulativeOffsetMs.addAndGet(deltaMs);
        logger.info("[TIME] Décalage de {} ms appliqué à {} commande(s). Offset cumulé : {} ms.",
                deltaMs, updated, newOffset);
        return newOffset;
    }

    /** Annule tous les décalages précédents et revient au temps réel. */
    public synchronized long reset() {
        long current = cumulativeOffsetMs.get();
        if (current == 0L) return 0L;
        return shift(-current);
    }

    /**
     * Oublie l'offset sans rejouer le décalage. Utilisé quand les commandes
     * actives ont été fermées (auto-sim, libération massive) et qu'il n'y a
     * plus rien à recaler.
     */
    public synchronized void clear() {
        long current = cumulativeOffsetMs.getAndSet(0L);
        if (current != 0L) {
            logger.info("[TIME] Offset effacé (sans rejouer le décalage).");
        }
    }
}
