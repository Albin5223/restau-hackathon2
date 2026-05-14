package fr.ultime.restoptim.domain.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import fr.ultime.restoptim.domain.model.ResourcePool;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.ScheduledTask;
import fr.ultime.restoptim.domain.model.order.Order;
import fr.ultime.restoptim.domain.spi.Orders;
import fr.ultime.restoptim.domain.spi.Resources;
import lombok.RequiredArgsConstructor;

/**
 * Couche métier autour de {@link Resources} qui empêche les mutations
 * susceptibles de casser un planning en cours :
 * <ul>
 *   <li>refuse de retirer une instance si la demande crête future dépasserait la nouvelle capacité ;</li>
 *   <li>refuse de supprimer un type si une commande active l'utilise encore.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ResourceService {

    private final Resources resources;
    private final Orders orders;

    public List<ResourcePool> getPools() {
        return resources.getPools();
    }

    /** Demande crête par type pour les commandes actives (instant `now` et après). */
    public Map<String, Integer> peakDemandByType() {
        long now = System.currentTimeMillis();
        Map<ResourceType, List<long[]>> events = futureEventsByType(now);
        Map<String, Integer> result = new HashMap<>();
        events.forEach((type, list) -> result.put(type.name(), peakOf(list)));
        return result;
    }

    public void createType(String name) {
        resources.createType(name);
    }

    public void deleteType(String name) {
        int peak = peakDemand(name);
        if (peak > 0) {
            throw new IllegalStateException(
                    "Impossible de supprimer le type \"" + name + "\" : "
                            + peak + " tâche(s) active(s) l'utilisent.");
        }
        resources.deleteType(name);
    }

    public void addInstance(String typeName) {
        resources.addInstance(typeName);
    }

    public void removeInstance(String typeName) {
        int currentCap = currentCapacity(typeName);
        int peak = peakDemand(typeName);
        if (currentCap - 1 < peak) {
            throw new IllegalStateException(
                    "Impossible de retirer une instance de \"" + typeName + "\" : "
                            + peak + " tâche(s) active(s) l'utilisent simultanément. "
                            + "Capacité minimale requise : " + peak + ".");
        }
        resources.removeInstance(typeName);
    }

    public int peakDemand(String typeName) {
        long now = System.currentTimeMillis();
        Map<ResourceType, List<long[]>> events = futureEventsByType(now);
        List<long[]> evts = events.get(new ResourceType(typeName));
        return evts == null ? 0 : peakOf(evts);
    }

    private Map<ResourceType, List<long[]>> futureEventsByType(long nowMs) {
        Map<ResourceType, List<long[]>> events = new HashMap<>();
        for (Order order : orders.getActiveOrders()) {
            long base = order.placedAt();
            for (ScheduledTask st : order.orderSchedule().scheduledTasks()) {
                long endMs = base + st.endSecond() * 1000L;
                if (endMs <= nowMs) continue;
                long startMs = Math.max(nowMs, base + st.startSecond() * 1000L);
                for (ResourceType type : st.resources()) {
                    List<long[]> list = events.computeIfAbsent(type, k -> new ArrayList<>());
                    list.add(new long[]{startMs, +1});
                    list.add(new long[]{endMs, -1});
                }
            }
        }
        return events;
    }

    /** Sweep : à temps égal, -1 (fin) avant +1 (début) pour ne pas compter une succession comme un chevauchement. */
    private static int peakOf(List<long[]> events) {
        events.sort((a, b) -> {
            if (a[0] != b[0]) return Long.compare(a[0], b[0]);
            return Long.compare(a[1], b[1]);
        });
        int peak = 0, current = 0;
        for (long[] e : events) {
            current += (int) e[1];
            if (current > peak) peak = current;
        }
        return peak;
    }

    private int currentCapacity(String typeName) {
        return resources.getPools().stream()
                .filter(p -> p.type().name().equals(typeName))
                .mapToInt(ResourcePool::capacity)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Type de ressource introuvable : " + typeName));
    }
}
