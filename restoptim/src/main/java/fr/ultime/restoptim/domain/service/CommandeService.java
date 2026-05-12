package fr.ultime.restoptim.domain.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import fr.ultime.restoptim.domain.model.Commande;
import fr.ultime.restoptim.domain.model.CommandeResult;
import fr.ultime.restoptim.domain.model.Dish;
import fr.ultime.restoptim.domain.model.DishJob;
import fr.ultime.restoptim.domain.model.GanttTask;
import fr.ultime.restoptim.domain.model.OccupiedInterval;
import fr.ultime.restoptim.domain.model.OrderRequest;
import fr.ultime.restoptim.domain.model.OrderSchedule;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.ScheduledTask;
import fr.ultime.restoptim.domain.model.Table;
import fr.ultime.restoptim.domain.model.TableStatus;
import fr.ultime.restoptim.domain.model.TaskKind;
import fr.ultime.restoptim.domain.spi.Commandes;
import fr.ultime.restoptim.domain.spi.Dishes;
import fr.ultime.restoptim.domain.spi.Tables;
import fr.ultime.restoptim.scheduler.KitchenScheduler;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CommandeService {

    private final Tables tables;
    private final Dishes dishes;
    private final Commandes commandes;
    private final KitchenScheduler scheduler;
    private final ObjectMapper objectMapper;

    @Transactional
    public CommandeResult placeCommande(int tableId, List<Integer> dishIds) {
        Table table = tables.getTableById(tableId)
                .orElseThrow(() -> new IllegalArgumentException("Table introuvable : " + tableId));
        if (table.status() != TableStatus.LIBRE && table.status() != TableStatus.COMMANDE_PASSEE) {
            throw new IllegalStateException("La table " + table.number() + " n'est pas disponible.");
        }

        long now = System.currentTimeMillis();
        String commandeId = "cmd_" + now;
        List<DishJob> jobs = buildJobs(dishIds);
        List<OccupiedInterval> occupied = buildOccupied(now);

        OrderSchedule schedule = scheduler.schedule(new OrderRequest(commandeId, jobs), occupied);

        String scheduleJson = serialize(schedule);
        commandes.save(new Commande(commandeId, tableId, now, dishIds, scheduleJson));

        tables.save(new Table(table.id(), table.number(), table.seats(),
                TableStatus.EN_PREPARATION, table.partySize(), commandeId));

        long serviceTimeAt = now + schedule.serviceTimeMinute() * 60_000L;
        List<GanttTask> ganttTasks = toGanttTasks(commandeId, table.number(), schedule, now);
        return new CommandeResult(commandeId, table.number(), serviceTimeAt, ganttTasks);
    }

    public List<GanttTask> getAllActiveGanttTasks() {
        List<GanttTask> result = new ArrayList<>();
        for (Commande commande : commandes.getActiveCommandes()) {
            OrderSchedule schedule = deserialize(commande.scheduleJson());
            Table table = tables.getTableById(commande.tableId()).orElse(null);
            int tableNumber = table != null ? table.number() : 0;
            result.addAll(toGanttTasks(commande.id(), tableNumber, schedule, commande.placedAt()));
        }
        return result;
    }

    /**
     * Construit la liste des intervalles déjà occupés par les commandes actives,
     * exprimés en minutes relatives à nowMs (t=0 = maintenant).
     */
    private List<OccupiedInterval> buildOccupied(long nowMs) {
        List<OccupiedInterval> list = new ArrayList<>();
        for (Commande commande : commandes.getActiveCommandes()) {
            OrderSchedule s = deserialize(commande.scheduleJson());
            long baseMs = commande.placedAt();
            for (ScheduledTask task : s.scheduledTasks()) {
                long absEnd = baseMs + task.endMinute() * 60_000L;
                if (absEnd <= nowMs) continue; // tâche déjà terminée
                long startMin = Math.max(0L, (baseMs + task.startMinute() * 60_000L - nowMs) / 60_000L);
                // plafond : on arrondit à la minute supérieure pour ne pas sous-estimer
                long endMin = (absEnd - nowMs + 59_999L) / 60_000L;
                for (ResourceType type : task.resources()) {
                    list.add(new OccupiedInterval(type, task.assignedResourceName(), startMin, endMin));
                }
            }
        }
        return list;
    }

    private List<DishJob> buildJobs(List<Integer> dishIds) {
        List<DishJob> jobs = new ArrayList<>();
        for (int i = 0; i < dishIds.size(); i++) {
            int dishId = dishIds.get(i);
            Dish dish = dishes.getDishById(dishId)
                    .orElseThrow(() -> new IllegalArgumentException("Plat introuvable : " + dishId));
            jobs.add(new DishJob("job_" + i, dish));
        }
        return jobs;
    }

    private List<GanttTask> toGanttTasks(String commandeId, int tableNumber,
            OrderSchedule schedule, long baseTime) {
        List<GanttTask> result = new ArrayList<>();
        for (ScheduledTask task : schedule.scheduledTasks()) {
            String resourceName = task.assignedResourceName() != null
                    ? task.assignedResourceName()
                    : (task.resources().isEmpty() ? "Inconnu" : task.resources().get(0).name());
            result.add(new GanttTask(
                    commandeId + "_" + task.jobId() + "_" + task.taskId(),
                    commandeId,
                    tableNumber,
                    task.dishName(),
                    task.taskName(),
                    kindLabel(task.kind()),
                    resourceName,
                    baseTime + task.startMinute() * 60_000L,
                    baseTime + task.endMinute() * 60_000L));
        }
        return result;
    }

    private static String kindLabel(TaskKind kind) {
        return switch (kind) {
            case COOKING -> "cuisson";
            case PLATING -> "dressage";
            case PREPARATION -> "preparation";
            case OTHER -> "other";
        };
    }

    private String serialize(OrderSchedule schedule) {
        try {
            return objectMapper.writeValueAsString(schedule);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Impossible de sérialiser le planning", e);
        }
    }

    private OrderSchedule deserialize(String json) {
        try {
            return objectMapper.readValue(json, OrderSchedule.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Planning stocké invalide", e);
        }
    }
}
