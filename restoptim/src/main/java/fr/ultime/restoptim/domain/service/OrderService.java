package fr.ultime.restoptim.domain.service;

import java.util.*;

import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.job.JobId;
import fr.ultime.restoptim.domain.model.order.OrderId;
import fr.ultime.restoptim.domain.model.table.TableId;
import fr.ultime.restoptim.domain.model.task.Task;
import fr.ultime.restoptim.domain.model.task.TaskId;
import fr.ultime.restoptim.domain.model.task.TaskType;
import fr.ultime.restoptim.domain.spi.Orders;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import fr.ultime.restoptim.domain.model.order.Order;
import fr.ultime.restoptim.domain.model.OrderResult;
import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.job.DishJob;
import fr.ultime.restoptim.domain.model.GanttTask;
import fr.ultime.restoptim.domain.model.OccupiedInterval;
import fr.ultime.restoptim.domain.model.OrderRequest;
import fr.ultime.restoptim.domain.model.OrderSchedule;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.ScheduledTask;
import fr.ultime.restoptim.domain.model.table.Table;
import fr.ultime.restoptim.domain.model.table.TableStatus;
import fr.ultime.restoptim.domain.spi.Dishes;
import fr.ultime.restoptim.domain.spi.Tables;
import fr.ultime.restoptim.scheduler.KitchenScheduler;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);
    private final Tables tables;
    private final Dishes dishes;
    private final Orders orders;
    private final KitchenScheduler scheduler;
    private final TimeShiftService timeShiftService;

    /**
     * Place une commande pour une table.
     *
     * Stratégie de planification :
     * 1. Seules les tâches actuellement EN COURS sont verrouillées (intervalles fixes).
     * 2. Les tâches EN ATTENTE de toutes les commandes actives sont re-planifiées
     *    ensemble avec la nouvelle commande dans un seul modèle CP-SAT.
     * 3. Les plannings des commandes existantes sont mis à jour en base.
     */
    @Transactional
    public OrderResult placeOrder(TableId tableId, List<DishId> dishIds, double speedMultiplier) {
        logger.info("[SERVICE] placeCommande: tableId={}, plats={}, multiplicateur={}", tableId, dishIds, speedMultiplier);

        Table table = tables.getTableById(tableId).orElseThrow(() -> new IllegalArgumentException("Table introuvable : " + tableId));

        if (table.status() != TableStatus.LIBRE && table.status() != TableStatus.COMMANDE_PASSEE) {
            throw new IllegalStateException("La table " + table.number() + " n'est pas disponible.");
        }

        long realNow = System.currentTimeMillis();
        // Les durées de tâches sont entières en secondes : on arrondit now à la seconde
        // pour que tous les temps absolus (placedAt, Gantt) soient des multiples de 1000 ms.
        // Cela garantit que deltaSec = (now - placedAt) / 1000 est exact (pas de troncature)
        // et élimine les faux chevauchements inter-commandes dus aux fractions de milliseconde.
        long offsetMs = timeShiftService.getOffsetMs();
        long now = ((realNow - offsetMs) / 1000) * 1000;
        OrderId orderId = OrderId.from("cmd_" + realNow);

        // Construire les jobs de la nouvelle commande
        List<DishJob> newJobs = buildJobs(dishIds, speedMultiplier);
        OrderRequest newOrder = new OrderRequest(orderId, newJobs);

        // Analyser les commandes actives : séparer tâches en cours (verrouillées) et en attente (re-planifiables)
        List<Order> activeOrders = orders.getActiveOrders();
        List<OrderRequest> pendingOrders = new ArrayList<>();
        Map<String, Long> taskMinStarts = new HashMap<>();
        List<OccupiedInterval> runningIntervals = new ArrayList<>();
        buildPendingOrdersAndIntervals(activeOrders, now, pendingOrders, taskMinStarts, runningIntervals);

        logger.info("[SERVICE] {} commandes actives → {} avec tâches en attente, {} intervalles en cours",
                activeOrders.size(), pendingOrders.size(), runningIntervals.size());

        // Planifier tout ensemble : commandes existantes (en attente) + nouvelle commande
        List<OrderRequest> allOrders = new ArrayList<>(pendingOrders);
        allOrders.add(newOrder);
        List<OrderSchedule> schedules = scheduler.scheduleAll(allOrders, runningIntervals, taskMinStarts);

        // Mettre à jour les plannings des commandes existantes re-planifiées
        for (int i = 0; i < pendingOrders.size(); i++) {
            Order commande = findOrder(activeOrders, pendingOrders.get(i).orderId());
            if (commande != null) {
                mergeAndUpdateSchedule(commande, schedules.get(i), now);
            }
        }

        // Sauvegarder la nouvelle commande
        OrderSchedule newSchedule = schedules.get(schedules.size() - 1);
        orders.save(new Order(orderId, tableId, now, dishIds, newSchedule));
        tables.save(new Table(table.id(), table.number(), table.seats(),
                TableStatus.EN_PREPARATION, table.partySize(), orderId));

        long serviceTimeAt = now + newSchedule.serviceTimeSecond() * 1_000L;
        List<GanttTask> ganttTasks = toGanttTasks(orderId, table.number(), newSchedule, now);
        logger.info("[SERVICE] Commande planifiée : id={}, serviceTimeAt={}ms", orderId, serviceTimeAt);
        return new OrderResult(orderId, table.number(), serviceTimeAt, ganttTasks);
    }

    public List<GanttTask> getAllActiveGanttTasks() {
        List<GanttTask> result = new ArrayList<>();
        for (Order commande : orders.getActiveOrders()) {
            Table table = tables.getTableById(commande.tableId()).orElse(null);
            int tableNumber = table != null ? table.number() : 0;
            result.addAll(toGanttTasks(commande.id(), tableNumber, commande.orderSchedule(), commande.placedAt()));
        }
        return result;
    }

    // ─── Construction des ordres en attente à partir des commandes actives ────

    /**
     * Analyse les commandes actives et remplit :
     * - pendingOrders : OrderRequest par commande active contenant uniquement les tâches encore en attente.
     * - taskMinStarts : démarrage minimum par tâche, dérivé des dépendances terminées ou en cours.
     * - runningIntervals : intervalles de ressources verrouillés pour les tâches actuellement en cours.
     */
    private void buildPendingOrdersAndIntervals(
            List<Order> activeOrders, long nowMs,
            List<OrderRequest> pendingOrders,
            Map<String, Long> taskMinStarts,
            List<OccupiedInterval> runningIntervals) {

        for (Order order : activeOrders) {
            long baseMs = order.placedAt();

            // Charger les définitions de plats pour la structure de dépendances
            Map<DishId, Dish> dishById = loadDishes(order.dishIds());

            // Grouper les tâches planifiées par jobId, dans l'ordre d'apparition
            Map<JobId, List<ScheduledTask>> tasksByJob = new LinkedHashMap<>();
            for (ScheduledTask st : order.orderSchedule().scheduledTasks())
                tasksByJob.computeIfAbsent(st.jobId(), k -> new ArrayList<>()).add(st);

            // Classer chaque tâche : TERMINEE / EN_COURS / EN_ATTENTE
            Map<JobId, Map<TaskId, TaskStatus>> status = new HashMap<>();
            Map<JobId, Map<TaskId, Long>> endSec = new HashMap<>(); // fin relative à now (en secondes)

            for (ScheduledTask st : order.orderSchedule().scheduledTasks()) {
                long absStart = baseMs + st.startSecond() * 1000L;
                long absEnd = baseMs + st.endSecond() * 1000L;

                TaskStatus ts;
                long endRelNow;

                if (absEnd <= nowMs) {
                    ts = TaskStatus.TERMINEE;
                    endRelNow = 0L;
                } else if (absStart <= nowMs) {
                    ts = TaskStatus.EN_COURS;
                    endRelNow = (absEnd - nowMs + 999L) / 1000L;
                    // Verrouiller la ressource pour la durée restante de cette tâche
                    for (int i = 0; i < st.resources().size(); i++) {
                        ResourceType type = st.resources().get(i);
                        String inst = (st.assignedResourceNames() != null && i < st.assignedResourceNames().size())
                                ? st.assignedResourceNames().get(i) : null;
                        runningIntervals.add(new OccupiedInterval(type, inst, 0L, endRelNow));
                    }
                } else {
                    ts = TaskStatus.EN_ATTENTE;
                    endRelNow = -1L;
                }

                status.computeIfAbsent(st.jobId(), k -> new HashMap<>()).put(st.taskId(), ts);
                endSec.computeIfAbsent(st.jobId(), k -> new HashMap<>()).put(st.taskId(), endRelNow);
            }

            // Construire les DishJob contenant uniquement les tâches en attente
            List<DishJob> pendingJobs = new ArrayList<>();
            boolean hasAnyPending = false;

            for (Map.Entry<JobId, List<ScheduledTask>> entry : tasksByJob.entrySet()) {
                JobId origJobId = entry.getKey();
                List<ScheduledTask> jobTasks = entry.getValue();

                DishId dishId = jobTasks.get(0).dishId();
                Dish dish = dishById.get(dishId);
                if (dish == null) continue;

                // Dépendances originales par taskId (depuis la définition de la recette)
                Map<TaskId, List<TaskId>> depsByTaskId = new HashMap<>();
                dish.tasks().forEach(t -> depsByTaskId.put(t.id(), t.dependencies()));

                List<Task> pendingTaskList = new ArrayList<>();

                for (ScheduledTask st : jobTasks) {
                    if (status.get(origJobId).get(st.taskId()) != TaskStatus.EN_ATTENTE) continue;

                    hasAnyPending = true;
                    long minStart = 0L;
                    List<TaskId> pendingDeps = new ArrayList<>();

                    for (TaskId depId : depsByTaskId.getOrDefault(st.taskId(), List.of())) {
                        TaskStatus depStatus = status.get(origJobId).getOrDefault(depId, TaskStatus.TERMINEE);
                        switch (depStatus) {
                            case TERMINEE -> { /* pas de contrainte */ }
                            case EN_COURS -> {
                                long depEnd = endSec.get(origJobId).get(depId);
                                minStart = Math.max(minStart, depEnd);
                            }
                            case EN_ATTENTE -> pendingDeps.add(depId);
                        }
                    }

                    int duration = (int) (st.endSecond() - st.startSecond());
                    pendingTaskList.add(new Task(st.taskId(), st.taskName(), st.kind(),
                            st.resources(), duration, pendingDeps));

                    if (minStart > 0L) {
                        String prefixedJobId = order.id().value() + "_" + origJobId.value();
                        taskMinStarts.put(prefixedJobId + "#" + st.taskId().value(), minStart);
                    }
                }

                if (!pendingTaskList.isEmpty()) {
                    String prefixedJobId = order.id().value() + "_" + origJobId.value();
                    Dish pendingDish = new Dish(dishId, jobTasks.get(0).dishName(), pendingTaskList);
                    pendingJobs.add(new DishJob(JobId.from(prefixedJobId), pendingDish));
                }
            }

            if (hasAnyPending && !pendingJobs.isEmpty()) {
                pendingOrders.add(new OrderRequest(order.id(), pendingJobs));
            }
        }
    }

    /**
     * Fusionne les tâches re-planifiées (en attente) avec les tâches déjà exécutées (terminées/en cours),
     * puis met à jour le planning en base.
     *
     * Les temps du solveur sont relatifs à now (t=0 = maintenant).
     * Les temps stockés en base sont relatifs à commande.placedAt.
     */
    private void mergeAndUpdateSchedule(Order order, OrderSchedule updatedSchedule, long nowMs) {
        long baseMs = order.placedAt();
        long deltaSec = (nowMs - baseMs) / 1000L; // offset à ajouter aux temps du solveur
        String prefix = order.id().value() + "_";

        // Indexer les tâches mises à jour par (jobId_original, taskId)
        Map<String, ScheduledTask> updatedByKey = new HashMap<>();
        for (ScheduledTask st : updatedSchedule.scheduledTasks()) {
            String origJobId = st.jobId().startsWith(prefix)
                    ? st.jobId().substring(prefix.length()) : st.jobId().value();
            updatedByKey.put(origJobId + "#" + st.taskId().value(), st);
        }

        // Fusionner : garder les tâches terminées/en cours, remplacer les tâches en attente
        List<ScheduledTask> merged = new ArrayList<>();
        for (ScheduledTask st : order.orderSchedule().scheduledTasks()) {
            long absStart = baseMs + st.startSecond() * 1000L;
            boolean isPending = absStart > nowMs;

            if (!isPending) {
                merged.add(st); // tâche terminée ou en cours : inchangée
            } else {
                ScheduledTask updated = updatedByKey.get(st.jobId().value() + "#" + st.taskId().value());
                if (updated != null) {
                    // Convertir les temps du solveur (relatifs à now) en relatifs à placedAt
                    merged.add(new ScheduledTask(
                            st.jobId(), st.dishId(), st.dishName(),
                            st.taskId(), st.taskName(), st.kind(),
                            deltaSec + updated.startSecond(),
                            deltaSec + updated.endSecond(),
                            st.resources(), updated.assignedResourceNames()));
                } else {
                    merged.add(st); // fallback : garder tel quel
                }
            }
        }

        long newServiceTimeSec = merged.stream()
                .filter(t -> t.kind() == TaskType.PLATING)
                .mapToLong(ScheduledTask::endSecond)
                .max().orElse(order.orderSchedule().serviceTimeSecond());

        orders.updateSchedule(order.id(),new OrderSchedule(order.id(), newServiceTimeSec, merged));
        logger.debug("[SERVICE] Planning mis à jour pour commande={}, nouveau serviceTime={}s",
                order.id(), newServiceTimeSec);
    }

    // ─── Méthodes utilitaires ─────────────────────────────────────────────────

    private List<DishJob> buildJobs(List<DishId> dishIds, double speedMultiplier) {
        List<DishJob> jobs = new ArrayList<>();
        for (int i = 0; i < dishIds.size(); i++) {
            DishId dishId = dishIds.get(i);
            Dish dish = dishes.getDishById(dishId)
                    .orElseThrow(() -> new IllegalArgumentException("Plat introuvable : " + dishId));
            if (speedMultiplier != 1.0) {
                dish = scaleDish(dish, speedMultiplier);
            }
            jobs.add(new DishJob(JobId.from("job_" + i), dish));
        }
        return jobs;
    }

    private Dish scaleDish(Dish dish, double speedMultiplier) {
        List<Task> scaledTasks = dish.tasks().stream()
                .map(t -> new Task(t.id(), t.name(), t.kind(), t.resources(),
                        Math.max(1, (int) Math.round(t.duration() * speedMultiplier)),
                        t.dependencies()))
                .toList();
        return new Dish(dish.id(), dish.name(), scaledTasks);
    }

    private Map<DishId, Dish> loadDishes(List<DishId> dishIds) {
        Map<DishId, Dish> result = new HashMap<>();
        for (DishId id : dishIds) {
            if (!result.containsKey(id))
                dishes.getDishById(id).ifPresent(d -> result.put(d.id(), d));
        }
        return result;
    }

    private Order findOrder(List<Order> list, OrderId orderId) {
        return list.stream().filter(order -> order.id().equals(orderId)).findFirst().orElse(null);
    }

    private List<GanttTask> toGanttTasks(OrderId orderId, int tableNumber,
                                         OrderSchedule schedule, long baseTime) {
        List<GanttTask> result = new ArrayList<>();
        for (ScheduledTask task : schedule.scheduledTasks()) {
            List<String> resourceNames = (task.assignedResourceNames() != null && !task.assignedResourceNames().isEmpty())
                    ? task.assignedResourceNames()
                    : task.resources().stream().map(ResourceType::name).toList();
            result.add(new GanttTask(
                    orderId.value() + "_" + task.jobId().value() + "_" + task.taskId().value(),
                    orderId,
                    tableNumber,
                    task.dishName(),
                    task.taskName(),
                    kindLabel(task.kind()),
                    resourceNames,
                    baseTime + task.startSecond() * 1_000L,
                    baseTime + task.endSecond() * 1_000L));
        }
        return result;
    }

    private static String kindLabel(TaskType kind) {
        return switch (kind) {
            case COOKING -> "cuisson";
            case PLATING -> "dressage";
            case PREPARATION -> "preparation";
            case OTHER -> "other";
        };
    }

    private enum TaskStatus { TERMINEE, EN_COURS, EN_ATTENTE }
}
