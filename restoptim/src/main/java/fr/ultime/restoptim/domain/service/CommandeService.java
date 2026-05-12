package fr.ultime.restoptim.domain.service;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger logger = LoggerFactory.getLogger(CommandeService.class);
    private final Tables tables;
    private final Dishes dishes;
    private final Commandes commandes;
    private final KitchenScheduler scheduler;
    private final ObjectMapper objectMapper;

    @Transactional
    public CommandeResult placeCommande(int tableId, List<Integer> dishIds) {
        logger.info("[COMMANDE-SERVICE] Début placeCommande: tableId={}, dishCount={}", tableId, dishIds.size());
        try {
            Table table = tables.getTableById(tableId)
                    .orElseThrow(() -> new IllegalArgumentException("Table introuvable : " + tableId));
            logger.debug("[COMMANDE-SERVICE] Table trouvée: number={}, status={}", table.number(), table.status());
            
            if (table.status() != TableStatus.LIBRE && table.status() != TableStatus.COMMANDE_PASSEE) {
                logger.warn("[COMMANDE-SERVICE] Table indisponible: tableId={}, status={}", tableId, table.status());
                throw new IllegalStateException("La table " + table.number() + " n'est pas disponible.");
            }

            long now = System.currentTimeMillis();
            String commandeId = "cmd_" + now;
            
            List<DishJob> jobs = buildJobs(dishIds);
            logger.debug("[COMMANDE-SERVICE] Jobs construits: count={}", jobs.size());
            
            List<OccupiedInterval> occupied = buildOccupied(now);
            logger.debug("[COMMANDE-SERVICE] Intervalles occupés trouvés: count={}", occupied.size());

            logger.debug("[COMMANDE-SERVICE] Appel scheduler.schedule avec orderId={}, jobCount={}", commandeId, jobs.size());
            OrderSchedule schedule = scheduler.schedule(new OrderRequest(commandeId, jobs), occupied);
            logger.info("[COMMANDE-SERVICE] Ordonnancement réussi: serviceTime={}min", schedule.serviceTimeMinute());

            String scheduleJson = serialize(schedule);
            commandes.save(new Commande(commandeId, tableId, now, dishIds, scheduleJson));
            logger.debug("[COMMANDE-SERVICE] Commande sauvegardée: commandeId={}", commandeId);

            tables.save(new Table(table.id(), table.number(), table.seats(),
                    TableStatus.EN_PREPARATION, table.partySize(), commandeId));
            logger.debug("[COMMANDE-SERVICE] Table mise à jour: tableId={}, status=EN_PREPARATION", tableId);

            long serviceTimeAt = now + schedule.serviceTimeMinute() * 60_000L;
            List<GanttTask> ganttTasks = toGanttTasks(commandeId, table.number(), schedule, now);
            logger.info("[COMMANDE-SERVICE] Fin placeCommande: commandeId={}, serviceTimeAtMs={}, ganttTaskCount={}", commandeId, serviceTimeAt, ganttTasks.size());
            return new CommandeResult(commandeId, table.number(), serviceTimeAt, ganttTasks);
        } catch (IllegalArgumentException e) {
            logger.error("[COMMANDE-SERVICE] Erreur IllegalArgumentException: tableId={}, message={}", tableId, e.getMessage());
            throw e;
        } catch (IllegalStateException e) {
            logger.error("[COMMANDE-SERVICE] Erreur IllegalStateException: tableId={}, message={}", tableId, e.getMessage());
            throw e;
        } catch (Exception e) {
            logger.error("[COMMANDE-SERVICE] Erreur inattendue: tableId={}, message={}", tableId, e.getMessage(), e);
            throw e;
        }
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
