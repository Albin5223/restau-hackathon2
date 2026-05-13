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
 * Ordonnanceur CP-SAT gérant plusieurs commandes simultanément.
 *
 * Stratégie :
 * - Seules les tâches EN COURS (déjà démarrées) sont figées comme intervalles occupés.
 * - Les tâches EN ATTENTE de toutes les commandes actives sont re-planifiées
 *   ensemble avec la nouvelle commande dans un seul modèle CP-SAT.
 * - Cela garantit toujours une solution tant que la capacité physique le permet.
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

    /** Wrapper de commodité pour une seule commande. */
    public OrderSchedule schedule(OrderRequest order, List<OccupiedInterval> runningIntervals) {
        return scheduleAll(List.of(order), runningIntervals, Map.of()).get(0);
    }

    public OrderSchedule schedule(OrderRequest order) {
        return schedule(order, List.of());
    }

    /**
     * Planifie plusieurs commandes simultanément dans un seul modèle CP-SAT.
     *
     * @param orders           Toutes les commandes à planifier. Les résultats correspondent par index.
     * @param runningIntervals Intervalles fixes : tâches actuellement en cours d'exécution.
     * @param taskMinStarts    Démarrage minimum par tâche (depuis les dépendances terminées/en cours).
     *                         Clé = jobId + "#" + taskId (le jobId inclut déjà le préfixe de commande).
     * @return Un OrderSchedule par commande d'entrée, dans le même ordre.
     */
    public List<OrderSchedule> scheduleAll(
            List<OrderRequest> orders,
            List<OccupiedInterval> runningIntervals,
            Map<String, Long> taskMinStarts) {

        if (orders.isEmpty()) return List.of();

        logger.info("[SCHEDULER] scheduleAll: {} commandes, {} intervalles verrouillés",
                orders.size(), runningIntervals.size());
        orders.forEach(this::validate);

        Map<ResourceType, Integer> capacityByType = capacityByType();

        CpModel model = new CpModel();
        int horizon = computeHorizon(orders, runningIntervals);
        logger.debug("[SCHEDULER] Horizon: {}s", horizon);

        // clé = orderId + "§" + jobId + "§" + taskId
        Map<String, TaskVars> taskVars = new LinkedHashMap<>();
        Map<ResourceType, List<IntervalVar>> intervalsByType = new HashMap<>();

        // Par commande : jobId → IntVar start/end du dressage
        Map<String, Map<String, IntVar>> platingStartByOrder = new HashMap<>();
        Map<String, Map<String, IntVar>> platingEndByOrder = new HashMap<>();
        List<IntVar> cookingGapVars = new ArrayList<>();

        // --- Variables de tâches ---
        for (OrderRequest order : orders) {
            Map<String, IntVar> pStarts = new HashMap<>();
            Map<String, IntVar> pEnds = new HashMap<>();
            platingStartByOrder.put(order.orderId(), pStarts);
            platingEndByOrder.put(order.orderId(), pEnds);

            for (DishJob job : order.jobs()) {
                for (Task task : job.dish().tasks()) {
                    String key = key(order.orderId(), job.jobId(), task.id());
                    int lo = (int) Math.min(
                            taskMinStarts.getOrDefault(job.jobId() + "#" + task.id(), 0L),
                            horizon);

                    IntVar start = model.newIntVar(lo, horizon, "s_" + key);
                    IntVar end = model.newIntVar(lo, horizon, "e_" + key);
                    IntervalVar interval = model.newIntervalVar(
                            start, LinearExpr.constant(task.duration()), end, "i_" + key);
                    taskVars.put(key, new TaskVars(start, end, interval));

                    task.resources().forEach(type ->
                            intervalsByType.computeIfAbsent(type, t -> new ArrayList<>()).add(interval));

                    if (task.kind() == TaskKind.PLATING) {
                        pStarts.put(job.jobId(), start);
                        pEnds.put(job.jobId(), end);
                    }
                }
            }
        }

        // --- Intervalles fixes pour les tâches en cours ---
        for (int i = 0; i < runningIntervals.size(); i++) {
            OccupiedInterval occ = runningIntervals.get(i);
            long s = Math.max(0L, occ.startSecond());
            long e = Math.min(horizon, occ.endSecond());
            if (e <= s) continue;
            IntervalVar fixed = model.newIntervalVar(
                    model.newConstant(s), LinearExpr.constant(e - s), model.newConstant(e),
                    "run_" + i);
            intervalsByType.computeIfAbsent(occ.type(), t -> new ArrayList<>()).add(fixed);
        }

        // --- Contraintes cumulatives par ressource ---
        for (Map.Entry<ResourceType, List<IntervalVar>> entry : intervalsByType.entrySet()) {
            int cap = capacityByType.getOrDefault(entry.getKey(), 0);
            if (cap <= 0)
                throw new IllegalStateException("Ressource inconnue ou de capacité nulle : " + entry.getKey().name());
            CumulativeConstraint cum = model.addCumulative(LinearExpr.constant(cap));
            entry.getValue().forEach(iv -> cum.addDemand(iv, 1L));
        }

        // --- Contraintes de précédence, dressage après tout, fenêtre cuisson ---
        for (OrderRequest order : orders) {
            Map<String, IntVar> pStarts = platingStartByOrder.get(order.orderId());

            for (DishJob job : order.jobs()) {
                IntVar platingStart = pStarts.get(job.jobId());

                for (Task task : job.dish().tasks()) {
                    String key = key(order.orderId(), job.jobId(), task.id());
                    TaskVars current = taskVars.get(key);

                    // Précédences (uniquement les dépendances encore en attente dans ce modèle)
                    for (int depId : task.dependencies()) {
                        TaskVars dep = taskVars.get(key(order.orderId(), job.jobId(), depId));
                        if (dep == null)
                            throw new IllegalArgumentException(
                                    "Dépendance manquante : job=" + job.jobId() + " dep=" + depId);
                        model.addGreaterOrEqual(current.start(), dep.end());
                    }

                    // Toutes les tâches non-dressage finissent avant le dressage
                    if (task.kind() != TaskKind.PLATING) {
                        model.addGreaterOrEqual(platingStart, current.end());
                    }

                    if (task.kind() == TaskKind.COOKING) {
                        // Contrainte dure : la cuisson doit finir AVANT le dressage
                        model.addLessOrEqual(current.end(), platingStart);

                        // Contrainte douce : minimiser le délai entre fin de cuisson et début de dressage.
                        // On ne force PAS une borne inférieure stricte : cela rendrait le problème infaisable
                        // quand beaucoup de plats sont commandés et que le temps de cuisson total dépasse
                        // la capacité disponible dans la fenêtre de tolérance.
                        IntVar gap = model.newIntVar(0, horizon, "cg_" + key);
                        model.addEquality(gap, LinearExpr.weightedSum(
                                new LinearArgument[]{platingStart, current.end()}, new long[]{1L, -1L}));
                        cookingGapVars.add(gap);
                    }
                }
            }
        }

        // --- Synchronisation par commande : tous les dressages finissent près d'un même serviceTime ---
        Map<String, IntVar> serviceTimeByOrder = new HashMap<>();
        List<IntVar> serviceGapVars = new ArrayList<>();

        for (OrderRequest order : orders) {
            Map<String, IntVar> pEnds = platingEndByOrder.get(order.orderId());
            int tol = computeEffectivePlatingTolerance(order, capacityByType);

            IntVar svcTime = model.newIntVar(0, horizon, "svc_" + order.orderId());
            model.addMaxEquality(svcTime, new ArrayList<>(pEnds.values()));
            serviceTimeByOrder.put(order.orderId(), svcTime);

            for (Map.Entry<String, IntVar> e : pEnds.entrySet()) {
                IntVar pe = e.getValue();
                model.addLessOrEqual(pe, svcTime);
                model.addGreaterOrEqual(pe, LinearExpr.affine(svcTime, 1, -tol));

                IntVar gap = model.newIntVar(0, tol, "sg_" + order.orderId() + "_" + e.getKey());
                model.addEquality(gap, LinearExpr.weightedSum(
                        new LinearArgument[]{svcTime, pe}, new long[]{1L, -1L}));
                serviceGapVars.add(gap);
            }
        }

        // --- Objectif : minimiser la somme des temps de service + écarts ---
        List<LinearArgument> objVars = new ArrayList<>();
        List<Long> objCoeffs = new ArrayList<>();
        serviceTimeByOrder.values().forEach(v -> { objVars.add(v); objCoeffs.add(config.objectiveWeightServiceTime()); });
        serviceGapVars.forEach(v -> { objVars.add(v); objCoeffs.add(config.objectiveWeightServiceGap()); });
        cookingGapVars.forEach(v -> { objVars.add(v); objCoeffs.add(config.objectiveWeightCookingGap()); });
        model.minimize(LinearExpr.weightedSum(
                objVars.toArray(new LinearArgument[0]),
                objCoeffs.stream().mapToLong(Long::longValue).toArray()));

        // --- Résolution ---
        CpSolver solver = new CpSolver();
        solver.getParameters().setMaxTimeInSeconds(config.maxSolveSeconds());
        CpSolverStatus status = solver.solve(model);
        logger.info("[SCHEDULER] Statut: {}", status);

        if (status != CpSolverStatus.OPTIMAL && status != CpSolverStatus.FEASIBLE) {
            throw new IllegalStateException(
                    "Aucune solution trouvée. Vérifier les capacités des ressources et les contraintes.");
        }

        // --- Attribution gloutonne des instances de ressources ---
        Map<ResourceType, List<String>> instanceNames = buildInstanceNames(capacityByType);
        Map<ResourceType, long[]> freeAt = initFreeAt(instanceNames, runningIntervals);

        Map<String, Task> taskLookup = new HashMap<>();
        for (OrderRequest order : orders)
            for (DishJob job : order.jobs())
                for (Task task : job.dish().tasks())
                    taskLookup.put(key(order.orderId(), job.jobId(), task.id()), task);

        List<Map.Entry<String, TaskVars>> sorted = new ArrayList<>(taskVars.entrySet());
        sorted.sort(Comparator.comparingLong(e -> solver.value(e.getValue().start())));

        Map<String, List<String>> assigned = new HashMap<>();
        for (Map.Entry<String, TaskVars> entry : sorted) {
            String key = entry.getKey();
            Task task = taskLookup.get(key);
            long ts = solver.value(entry.getValue().start());
            long te = solver.value(entry.getValue().end());

            List<String> names = new ArrayList<>();
            for (ResourceType type : task.resources()) {
                List<String> insts = instanceNames.get(type);
                long[] times = freeAt.get(type);
                if (insts == null || times == null) {
                    names.add(capitalize(type.name()));
                    continue;
                }
                int best = 0;
                for (int i = 0; i < times.length; i++) {
                    if (times[i] <= ts) { best = i; break; }
                    if (times[i] < times[best]) best = i;
                }
                names.add(insts.get(best));
                times[best] = te;
            }
            assigned.put(key, names);
        }

        // --- Résultats par commande ---
        List<OrderSchedule> results = new ArrayList<>();
        for (OrderRequest order : orders) {
            List<ScheduledTask> scheduledTasks = new ArrayList<>();
            for (DishJob job : order.jobs()) {
                for (Task task : job.dish().tasks()) {
                    String key = key(order.orderId(), job.jobId(), task.id());
                    TaskVars v = taskVars.get(key);
                    List<String> names = assigned.getOrDefault(key,
                            task.resources().stream().map(rt -> capitalize(rt.name())).toList());
                    scheduledTasks.add(new ScheduledTask(
                            job.jobId(), job.dish().id(), job.dish().name(),
                            task.id(), task.name(), task.kind(),
                            solver.value(v.start()), solver.value(v.end()),
                            task.resources(), names));
                }
            }
            scheduledTasks.sort(Comparator.comparingLong(ScheduledTask::startSecond));
            results.add(new OrderSchedule(order.orderId(),
                    solver.value(serviceTimeByOrder.get(order.orderId())), scheduledTasks));
        }

        logger.info("[SCHEDULER] scheduleAll terminé : {} commandes planifiées, statut={}",
                orders.size(), status);
        return results;
    }

    // ─── Méthodes utilitaires ─────────────────────────────────────────────────

    private static String key(String orderId, String jobId, int taskId) {
        return orderId + "§" + jobId + "§" + taskId;
    }

    private Map<ResourceType, Integer> capacityByType() {
        Map<ResourceType, Integer> caps = new HashMap<>();
        for (ResourcePool pool : resources.getPools())
            caps.merge(pool.type(), pool.capacity(), Integer::sum);
        return caps;
    }

    private int computeHorizon(List<OrderRequest> orders, List<OccupiedInterval> runningIntervals) {
        // Somme des chemins critiques de tous les jobs : borne supérieure si tout s'exécute en série
        int totalCriticalPaths = orders.stream()
                .mapToInt(o -> o.jobs().stream().mapToInt(this::criticalPath).sum())
                .sum();
        long maxRunningEnd = runningIntervals.stream()
                .mapToLong(OccupiedInterval::endSecond).max().orElse(0L);
        return (int) maxRunningEnd + totalCriticalPaths
                + config.toleranceCookingBeforePlatingSeconds()
                + config.tolerancePlatingBeforeServiceSeconds()
                + config.horizonPaddingSeconds();
    }

    private int criticalPath(DishJob job) {
        Map<Integer, Task> byId = new HashMap<>();
        job.dish().tasks().forEach(t -> byId.put(t.id(), t));
        Map<Integer, Integer> memo = new HashMap<>();
        return job.dish().tasks().stream()
                .mapToInt(t -> longestPath(t, byId, memo)).max().orElse(0);
    }

    private int longestPath(Task task, Map<Integer, Task> byId, Map<Integer, Integer> memo) {
        return memo.computeIfAbsent(task.id(), id -> {
            int maxDep = task.dependencies().stream()
                    .mapToInt(depId -> longestPath(byId.get(depId), byId, memo)).max().orElse(0);
            return task.duration() + maxDep;
        });
    }

    private int computeEffectivePlatingTolerance(OrderRequest order, Map<ResourceType, Integer> capacityByType) {
        List<Task> platingTasks = order.jobs().stream()
                .flatMap(job -> job.dish().tasks().stream())
                .filter(t -> t.kind() == TaskKind.PLATING).toList();
        if (platingTasks.isEmpty()) return config.tolerancePlatingBeforeServiceSeconds();

        int platingCapacity = platingTasks.stream()
                .flatMap(t -> t.resources().stream()).distinct()
                .mapToInt(type -> capacityByType.getOrDefault(type, 1)).min().orElse(1);

        int totalPlatingDuration = platingTasks.stream().mapToInt(Task::duration).sum();
        int minWindow = (totalPlatingDuration + platingCapacity - 1) / platingCapacity;
        return Math.max(config.tolerancePlatingBeforeServiceSeconds(), minWindow);
    }

    private void validate(OrderRequest order) {
        if (order.jobs() == null || order.jobs().isEmpty())
            throw new IllegalArgumentException("La commande doit contenir au moins un plat.");

        Set<String> jobIds = new HashSet<>();
        for (DishJob job : order.jobs()) {
            if (job.jobId() == null || job.jobId().isBlank())
                throw new IllegalArgumentException("jobId requis pour chaque DishJob.");
            if (!jobIds.add(job.jobId()))
                throw new IllegalArgumentException("jobId dupliqué : " + job.jobId());
            if (job.dish() == null || job.dish().tasks() == null || job.dish().tasks().isEmpty())
                throw new IllegalArgumentException("Le plat " + job.jobId() + " doit avoir au moins une tâche.");

            int platingCount = 0;
            Set<Integer> taskIds = new HashSet<>();
            for (Task task : job.dish().tasks()) {
                if (!taskIds.add(task.id()))
                    throw new IllegalArgumentException("taskId dupliqué : " + task.id() + " dans " + job.jobId());
                if (task.duration() <= 0)
                    throw new IllegalArgumentException("Durée invalide pour task=" + task.id());
                if (task.resources() == null || task.resources().isEmpty())
                    throw new IllegalArgumentException("Tâche " + task.id() + " sans ressource.");
                if (task.kind() == TaskKind.PLATING) platingCount++;
            }
            if (platingCount != 1)
                throw new IllegalArgumentException("Exactement 1 tâche PLATING requise : " + job.jobId());
            ensureAcyclic(job);
        }
    }

    private void ensureAcyclic(DishJob job) {
        Map<Integer, Task> byId = new HashMap<>();
        job.dish().tasks().forEach(t -> byId.put(t.id(), t));
        Map<Integer, Integer> state = new HashMap<>();
        for (Task task : job.dish().tasks()) {
            if (!state.containsKey(task.id()) && hasCycle(task, byId, state, job.jobId()))
                throw new IllegalArgumentException("Cycle de dépendances dans le job " + job.jobId());
        }
    }

    private boolean hasCycle(Task task, Map<Integer, Task> byId, Map<Integer, Integer> state, String jobId) {
        state.put(task.id(), 1);
        for (int depId : task.dependencies()) {
            Task dep = byId.get(depId);
            if (dep == null)
                throw new IllegalArgumentException("Dépendance inconnue : " + depId + " dans " + jobId);
            Integer s = state.get(depId);
            if (s != null && s == 1) return true;
            if (s == null && hasCycle(dep, byId, state, jobId)) return true;
        }
        state.put(task.id(), 2);
        return false;
    }

    private Map<ResourceType, List<String>> buildInstanceNames(Map<ResourceType, Integer> capacityByType) {
        Map<ResourceType, List<String>> result = new LinkedHashMap<>();
        capacityByType.forEach((type, cap) -> {
            String base = capitalize(type.name());
            List<String> names = new ArrayList<>();
            for (int i = 1; i <= cap; i++) names.add(cap == 1 ? base : base + " " + i);
            result.put(type, names);
        });
        return result;
    }

    private Map<ResourceType, long[]> initFreeAt(Map<ResourceType, List<String>> instanceNames,
                                                   List<OccupiedInterval> runningIntervals) {
        Map<ResourceType, long[]> freeAt = new HashMap<>();
        instanceNames.forEach((type, names) -> freeAt.put(type, new long[names.size()]));

        for (OccupiedInterval occ : runningIntervals) {
            long[] times = freeAt.get(occ.type());
            List<String> names = instanceNames.get(occ.type());
            if (times == null || names == null || occ.instanceName() == null) continue;
            for (int i = 0; i < names.size(); i++) {
                if (names.get(i).equals(occ.instanceName())) {
                    times[i] = Math.max(times[i], occ.endSecond());
                    break;
                }
            }
        }
        return freeAt;
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase(Locale.ROOT);
    }

    private record TaskVars(IntVar start, IntVar end, IntervalVar interval) {}
}
