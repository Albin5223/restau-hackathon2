package fr.ultime.restoptim.scheduler;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;

import com.google.ortools.Loader;
import com.google.ortools.sat.CpModel;
import com.google.ortools.sat.CpSolver;
import com.google.ortools.sat.CpSolverStatus;
import com.google.ortools.sat.CumulativeConstraint;
import com.google.ortools.sat.IntVar;
import com.google.ortools.sat.IntervalVar;
import com.google.ortools.sat.LinearArgument;
import com.google.ortools.sat.LinearExpr;

import fr.ultime.restoptim.domain.model.DishJob;
import fr.ultime.restoptim.domain.model.OccupiedInterval;
import fr.ultime.restoptim.domain.model.OrderRequest;
import fr.ultime.restoptim.domain.model.OrderSchedule;
import fr.ultime.restoptim.domain.model.ResourcePool;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.ScheduledTask;
import fr.ultime.restoptim.domain.model.SchedulerConfig;
import fr.ultime.restoptim.domain.model.Task;
import fr.ultime.restoptim.domain.model.TaskKind;
import fr.ultime.restoptim.domain.spi.Resources;

/**
 * Ordonnanceur CP-SAT pour une commande (OrderRequest).
 *
 * Garanties :
 * - tachs precedees par leurs dependances (DAG intra-plat),
 * - chaque ResourceType est traite comme une ressource cumulative dont la capacite
 *   correspond au nombre d'instances physiques (table resources),
 * - toutes les taches PLATING d'une commande finissent au plus pres d'un meme
 *   serviceTime global pour servir les plats chauds ensemble,
 * - les taches COOKING finissent dans une fenetre [serviceTime - tolerance ;
 *   plating.start] afin que rien ne refroidisse.
 */
@Service
public class KitchenScheduler {

    private static final Logger logger = LoggerFactory.getLogger(KitchenScheduler.class);
    private final Resources resources;
    private final SchedulerConfig config;

    public KitchenScheduler(Resources resources, SchedulerConfig config) {
        this.resources = resources;
        this.config = config;
        Loader.loadNativeLibraries();
    }

    public OrderSchedule schedule(OrderRequest order) {
        return schedule(order, List.of());
    }

    public OrderSchedule schedule(OrderRequest order, List<OccupiedInterval> activeOccupied) {
        logger.debug("[SCHEDULER] Début schedule: orderId={}, jobCount={}, occupiedCount={}", order.orderId(), order.jobs().size(), activeOccupied.size());
        validate(order);

        Map<ResourceType, Integer> capacityByType = capacityByType();
        logger.debug("[SCHEDULER] Capacités par type: {}", capacityByType);
        int effectivePlatingTolerance = computeEffectivePlatingTolerance(order, capacityByType);
        logger.debug("[SCHEDULER] Tolérance dressage effective: {}min", effectivePlatingTolerance);

        CpModel model = new CpModel();
        int horizon = computeHorizon(order, activeOccupied, effectivePlatingTolerance);
        logger.debug("[SCHEDULER] Horizon calculé: {}min", horizon);

        Map<TaskKey, TaskVars> taskVarsByKey = new LinkedHashMap<>();
        Map<ResourceType, List<IntervalVar>> intervalsByType = new HashMap<>();
        Map<String, IntVar> platingStartByJob = new HashMap<>();
        Map<String, IntVar> platingEndByJob = new HashMap<>();
        List<IntVar> cookingGapVars = new ArrayList<>();

        for (DishJob job : order.jobs()) {
            for (Task task : job.dish().tasks()) {
                TaskKey key = new TaskKey(job.jobId(), task.id());
                IntVar start = model.newIntVar(0, horizon, "start_" + key);
                IntVar end = model.newIntVar(0, horizon, "end_" + key);
                IntervalVar interval = model.newIntervalVar(
                        start,
                        LinearExpr.constant(task.duration()),
                        end,
                        "interval_" + key);
                taskVarsByKey.put(key, new TaskVars(start, end, interval));

                for (ResourceType type : task.resources()) {
                    intervalsByType.computeIfAbsent(type, t -> new ArrayList<>()).add(interval);
                }

                if (task.kind() == TaskKind.PLATING) {
                    platingStartByJob.put(job.jobId(), start);
                    platingEndByJob.put(job.jobId(), end);
                }
            }
        }

        // Ajouter les intervalles déjà occupés par d'autres commandes actives
        for (int i = 0; i < activeOccupied.size(); i++) {
            OccupiedInterval occ = activeOccupied.get(i);
            long s = Math.max(0L, occ.startMinute());
            long e = Math.min(horizon, occ.endMinute());
            if (e <= s) continue;
            IntVar sv = model.newConstant(s);
            IntVar ev = model.newConstant(e);
            IntervalVar fixed = model.newIntervalVar(sv, LinearExpr.constant(e - s), ev, "occ_" + i);
            intervalsByType.computeIfAbsent(occ.type(), t -> new ArrayList<>()).add(fixed);
        }

        for (Map.Entry<ResourceType, List<IntervalVar>> entry : intervalsByType.entrySet()) {
            ResourceType type = entry.getKey();
            Integer capacity = capacityByType.get(type);
            if (capacity == null || capacity <= 0) {
                throw new IllegalStateException(
                        "Aucune ressource disponible pour le type : " + type.name());
            }
            CumulativeConstraint cumulative = model.addCumulative(LinearExpr.constant(capacity));
            for (IntervalVar interval : entry.getValue()) {
                cumulative.addDemand(interval, 1L);
            }
        }

        for (DishJob job : order.jobs()) {
            IntVar platingStart = platingStartByJob.get(job.jobId());

            for (Task task : job.dish().tasks()) {
                TaskVars current = taskVarsByKey.get(new TaskKey(job.jobId(), task.id()));

                for (Integer depId : task.dependencies()) {
                    TaskVars dep = taskVarsByKey.get(new TaskKey(job.jobId(), depId));
                    if (dep == null) {
                        throw new IllegalArgumentException(
                                "Dependance introuvable : job=" + job.jobId()
                                        + " task=" + task.id() + " dep=" + depId);
                    }
                    model.addGreaterOrEqual(current.start(), dep.end());
                }

                if (task.kind() != TaskKind.PLATING) {
                    model.addGreaterOrEqual(platingStart, current.end());
                }

                if (task.kind() == TaskKind.COOKING) {
                    model.addLessOrEqual(current.end(), platingStart);
                    model.addGreaterOrEqual(
                            current.end(),
                            LinearExpr.affine(platingStart, 1, -config.toleranceCookingBeforePlatingMinutes()));

                    IntVar gap = model.newIntVar(
                            0,
                            config.toleranceCookingBeforePlatingMinutes(),
                            "cooking_gap_" + job.jobId() + "_" + task.id());
                    model.addEquality(
                            gap,
                            LinearExpr.weightedSum(
                                    new LinearArgument[] { platingStart, current.end() },
                                    new long[] { 1L, -1L }));
                    cookingGapVars.add(gap);
                }
            }
        }

        IntVar serviceTime = model.newIntVar(0, horizon, "service_time");
        model.addMaxEquality(serviceTime, new ArrayList<>(platingEndByJob.values()));

        List<IntVar> serviceGapVars = new ArrayList<>();
        for (DishJob job : order.jobs()) {
            IntVar platingEnd = platingEndByJob.get(job.jobId());
            model.addLessOrEqual(platingEnd, serviceTime);
            model.addGreaterOrEqual(
                    platingEnd,
                    LinearExpr.affine(serviceTime, 1, -effectivePlatingTolerance));

            IntVar gap = model.newIntVar(
                    0,
                    effectivePlatingTolerance,
                    "service_gap_" + job.jobId());
            model.addEquality(
                    gap,
                    LinearExpr.weightedSum(
                            new LinearArgument[] { serviceTime, platingEnd },
                            new long[] { 1L, -1L }));
            serviceGapVars.add(gap);
        }

        List<LinearArgument> objectiveVars = new ArrayList<>();
        List<Long> objectiveCoefficients = new ArrayList<>();
        objectiveVars.add(serviceTime);
        objectiveCoefficients.add(config.objectiveWeightServiceTime());
        for (IntVar gap : serviceGapVars) {
            objectiveVars.add(gap);
            objectiveCoefficients.add(config.objectiveWeightServiceGap());
        }
        for (IntVar gap : cookingGapVars) {
            objectiveVars.add(gap);
            objectiveCoefficients.add(config.objectiveWeightCookingGap());
        }
        model.minimize(LinearExpr.weightedSum(
                objectiveVars.toArray(new LinearArgument[0]),
                objectiveCoefficients.stream().mapToLong(Long::longValue).toArray()));

        CpSolver solver = new CpSolver();
        solver.getParameters().setMaxTimeInSeconds(config.maxSolveSeconds());
        logger.debug("[SCHEDULER] Lancement solveur CP-SAT avec timeout={}s", config.maxSolveSeconds());

        CpSolverStatus status = solver.solve(model);
        logger.info("[SCHEDULER] Solveur terminé: status={}", status);
        if (status != CpSolverStatus.OPTIMAL && status != CpSolverStatus.FEASIBLE) {
            logger.error("[SCHEDULER] Aucune solution trouvée pour orderId={}", order.orderId());
            throw new IllegalStateException(
                    "Aucune solution trouvee. Verifier les tolerances, l'horizon ou la capacite des ressources.");
        }
        logger.info("[SCHEDULER] Service time: {}min", solver.value(serviceTime));

        // Build preliminary list (without instance assignment yet)
        List<ScheduledTask> scheduled = new ArrayList<>();
        for (DishJob job : order.jobs()) {
            for (Task task : job.dish().tasks()) {
                TaskVars vars = taskVarsByKey.get(new TaskKey(job.jobId(), task.id()));
                scheduled.add(new ScheduledTask(
                        job.jobId(),
                        job.dish().id(),
                        job.dish().name(),
                        task.id(),
                        task.name(),
                        task.kind(),
                        solver.value(vars.start()),
                        solver.value(vars.end()),
                        task.resources(),
                        null));
            }
        }
        scheduled.sort(Comparator.comparingLong(ScheduledTask::startMinute));

        // Greedy post-solve: assign a specific resource instance to each task.
        // The CP-SAT cumulative constraint guarantees that at most N tasks of a
        // given type run simultaneously, so a greedy scan (earliest free slot)
        // always finds a valid assignment.
        logger.debug("[SCHEDULER] Début assignation des instances de ressources");
        Map<ResourceType, List<String>> instanceNames = buildInstanceNames(capacityByType);

        // Initialiser freeAt depuis les occupations actives (commandes en cours)
        Map<ResourceType, long[]> freeAt = new HashMap<>();
        for (Map.Entry<ResourceType, List<String>> e : instanceNames.entrySet()) {
            List<String> names = e.getValue();
            long[] times = new long[names.size()];
            for (OccupiedInterval occ : activeOccupied) {
                if (!occ.type().equals(e.getKey()) || occ.instanceName() == null) continue;
                for (int i = 0; i < names.size(); i++) {
                    if (names.get(i).equals(occ.instanceName())) {
                        times[i] = Math.max(times[i], occ.endMinute());
                        break;
                    }
                }
            }
            freeAt.put(e.getKey(), times);
        }
        Map<TaskKey, String> assignment = new HashMap<>();
        for (ScheduledTask task : scheduled) {
            if (task.resources().isEmpty()) continue;
            ResourceType type = task.resources().get(0);
            List<String> names = instanceNames.get(type);
            long[] times = freeAt.get(type);
            if (names == null || times == null) continue;

            int bestIdx = -1;
            for (int i = 0; i < times.length; i++) {
                if (times[i] <= task.startMinute()) { bestIdx = i; break; }
            }
            if (bestIdx == -1) { // fallback — pick instance finishing soonest
                bestIdx = 0;
                for (int i = 1; i < times.length; i++) {
                    if (times[i] < times[bestIdx]) bestIdx = i;
                }
            }
            assignment.put(new TaskKey(task.jobId(), task.taskId()), names.get(bestIdx));
            times[bestIdx] = task.endMinute();
        }

        // Rebuild list with assigned instance names
        logger.debug("[SCHEDULER] Reconstruction liste avec assignation: taskCount={}", scheduled.size());
        List<ScheduledTask> result = scheduled.stream()
                .map(t -> {
                    String name = assignment.get(new TaskKey(t.jobId(), t.taskId()));
                    if (name == null && !t.resources().isEmpty()) {
                        name = capitalize(t.resources().get(0).name());
                    }
                    return new ScheduledTask(t.jobId(), t.dishId(), t.dishName(),
                            t.taskId(), t.taskName(), t.kind(),
                            t.startMinute(), t.endMinute(), t.resources(),
                            name != null ? name : "Inconnu");
                })
                .toList();

        logger.info("[SCHEDULER] Fin schedule: orderId={}, status={}, serviceTime={}min, scheduledTaskCount={}", 
                order.orderId(), status, solver.value(serviceTime), result.size());
        return new OrderSchedule(order.orderId(), solver.value(serviceTime), result);
    }

    private Map<ResourceType, Integer> capacityByType() {
        Map<ResourceType, Integer> capacities = new HashMap<>();
        for (ResourcePool pool : resources.getPools()) {
            capacities.merge(pool.type(), pool.capacity(), Integer::sum);
        }
        return capacities;
    }

    private int computeHorizon(OrderRequest order, List<OccupiedInterval> activeOccupied, int effectivePlatingTolerance) {
        // Chemin critique par plat (plus serré que la somme plate quand des branches sont parallèles)
        int newTasksDuration = order.jobs().stream()
                .mapToInt(this::criticalPath)
                .sum();
        long maxActiveEnd = activeOccupied.stream()
                .mapToLong(OccupiedInterval::endMinute)
                .max()
                .orElse(0L);
        return (int) maxActiveEnd + newTasksDuration
                + config.toleranceCookingBeforePlatingMinutes()
                + effectivePlatingTolerance
                + config.horizonPaddingMinutes();
    }

    private int criticalPath(DishJob job) {
        Map<Integer, Task> byId = new HashMap<>();
        for (Task t : job.dish().tasks()) byId.put(t.id(), t);
        Map<Integer, Integer> memo = new HashMap<>();
        return job.dish().tasks().stream()
                .mapToInt(t -> longestPath(t, byId, memo))
                .max()
                .orElse(0);
    }

    private int longestPath(Task task, Map<Integer, Task> byId, Map<Integer, Integer> memo) {
        return memo.computeIfAbsent(task.id(), id -> {
            int maxDep = task.dependencies().stream()
                    .mapToInt(depId -> longestPath(byId.get(depId), byId, memo))
                    .max()
                    .orElse(0);
            return task.duration() + maxDep;
        });
    }

    private int computeEffectivePlatingTolerance(OrderRequest order, Map<ResourceType, Integer> capacityByType) {
        List<Task> platingTasks = order.jobs().stream()
                .flatMap(job -> job.dish().tasks().stream())
                .filter(t -> t.kind() == TaskKind.PLATING)
                .toList();
        if (platingTasks.isEmpty()) return config.tolerancePlatingBeforeServiceMinutes();

        // Capacité du goulot : minimum des capacités des types de ressources de dressage
        int platingCapacity = platingTasks.stream()
                .flatMap(t -> t.resources().stream())
                .distinct()
                .mapToInt(type -> capacityByType.getOrDefault(type, 1))
                .min()
                .orElse(1);

        int totalPlatingDuration = platingTasks.stream()
                .mapToInt(Task::duration)
                .sum();

        // Fenêtre minimale = temps pour dresser tous les plats en séquence sur le goulot
        int minWindow = (totalPlatingDuration + platingCapacity - 1) / platingCapacity;
        return Math.max(config.tolerancePlatingBeforeServiceMinutes(), minWindow);
    }

    private void validate(OrderRequest order) {
        logger.debug("[SCHEDULER] Validation OrderRequest: orderId={}", order.orderId());
        if (order.jobs() == null || order.jobs().isEmpty()) {
            logger.error("[SCHEDULER] Validation échouée: pas de jobs");
            throw new IllegalArgumentException("La commande doit contenir au moins un plat.");
        }
        Set<String> jobIds = new HashSet<>();
        for (DishJob job : order.jobs()) {
            if (job.jobId() == null || job.jobId().isBlank()) {
                throw new IllegalArgumentException("jobId requis pour chaque DishJob.");
            }
            if (!jobIds.add(job.jobId())) {
                throw new IllegalArgumentException("jobId duplique : " + job.jobId());
            }
            if (job.dish() == null || job.dish().tasks() == null || job.dish().tasks().isEmpty()) {
                throw new IllegalArgumentException("Le plat " + job.jobId() + " doit contenir au moins une tache.");
            }

            int platingCount = 0;
            Set<Integer> taskIds = new HashSet<>();
            for (Task task : job.dish().tasks()) {
                if (!taskIds.add(task.id())) {
                    throw new IllegalArgumentException(
                            "taskId duplique dans " + job.jobId() + " : " + task.id());
                }
                if (task.duration() <= 0) {
                    throw new IllegalArgumentException(
                            "La duree doit etre strictement positive (job=" + job.jobId()
                                    + ", task=" + task.id() + ").");
                }
                if (task.resources() == null || task.resources().isEmpty()) {
                    throw new IllegalArgumentException(
                            "La tache " + task.id() + " du job " + job.jobId() + " n'a aucune ressource.");
                }
                if (task.kind() == TaskKind.PLATING) {
                    platingCount++;
                }
            }
            if (platingCount != 1) {
                throw new IllegalArgumentException(
                        "Chaque plat doit definir exactement une tache PLATING : " + job.jobId());
            }
            ensureAcyclic(job);
        }
    }

    private void ensureAcyclic(DishJob job) {
        List<Task> tasks = job.dish().tasks();
        Map<Integer, Task> byId = new HashMap<>();
        for (Task task : tasks) {
            byId.put(task.id(), task);
        }
        Map<Integer, Integer> state = new HashMap<>();
        for (Task task : tasks) {
            if (!state.containsKey(task.id()) && hasCycle(task, byId, state, job.jobId())) {
                throw new IllegalArgumentException("Cycle de dependances dans le job " + job.jobId());
            }
        }
    }

    private boolean hasCycle(Task task, Map<Integer, Task> byId, Map<Integer, Integer> state, String jobId) {
        state.put(task.id(), 1);
        for (Integer depId : task.dependencies()) {
            Task dep = byId.get(depId);
            if (dep == null) {
                throw new IllegalArgumentException(
                        "Dependance inconnue " + depId + " dans la tache " + task.id() + " du job " + jobId);
            }
            Integer depState = state.get(depId);
            if (depState != null && depState == 1) {
                return true;
            }
            if (depState == null && hasCycle(dep, byId, state, jobId)) {
                return true;
            }
        }
        state.put(task.id(), 2);
        return false;
    }

    private Map<ResourceType, List<String>> buildInstanceNames(Map<ResourceType, Integer> capacityByType) {
        Map<ResourceType, List<String>> result = new LinkedHashMap<>();
        for (Map.Entry<ResourceType, Integer> entry : capacityByType.entrySet()) {
            ResourceType type = entry.getKey();
            int cap = entry.getValue();
            String base = capitalize(type.name());
            List<String> names = new ArrayList<>();
            for (int i = 1; i <= cap; i++) {
                names.add(cap == 1 ? base : base + " " + i);
            }
            result.put(type, names);
        }
        return result;
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase(Locale.ROOT);
    }

    private record TaskKey(String jobId, int taskId) {
        @Override
        public String toString() {
            return jobId + "_" + taskId;
        }
    }
}
