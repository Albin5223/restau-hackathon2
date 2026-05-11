package fr.ultime.restoptim.scheduler;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

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

    private final Resources resources;
    private final SchedulerConfig config;

    public KitchenScheduler(Resources resources, SchedulerConfig config) {
        this.resources = resources;
        this.config = config;
        Loader.loadNativeLibraries();
    }

    public OrderSchedule schedule(OrderRequest order) {
        validate(order);

        Map<ResourceType, Integer> capacityByType = capacityByType();

        CpModel model = new CpModel();
        int horizon = computeHorizon(order);

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
                    LinearExpr.affine(serviceTime, 1, -config.tolerancePlatingBeforeServiceMinutes()));

            IntVar gap = model.newIntVar(
                    0,
                    config.tolerancePlatingBeforeServiceMinutes(),
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
        objectiveCoefficients.add(1000L);
        for (IntVar gap : serviceGapVars) {
            objectiveVars.add(gap);
            objectiveCoefficients.add(50L);
        }
        for (IntVar gap : cookingGapVars) {
            objectiveVars.add(gap);
            objectiveCoefficients.add(1L);
        }
        model.minimize(LinearExpr.weightedSum(
                objectiveVars.toArray(new LinearArgument[0]),
                objectiveCoefficients.stream().mapToLong(Long::longValue).toArray()));

        CpSolver solver = new CpSolver();
        solver.getParameters().setMaxTimeInSeconds(config.maxSolveSeconds());

        CpSolverStatus status = solver.solve(model);
        if (status != CpSolverStatus.OPTIMAL && status != CpSolverStatus.FEASIBLE) {
            throw new IllegalStateException(
                    "Aucune solution trouvee. Verifier les tolerances, l'horizon ou la capacite des ressources.");
        }

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
                        task.resources()));
            }
        }
        scheduled.sort(Comparator.comparingLong(ScheduledTask::startMinute));

        return new OrderSchedule(order.orderId(), solver.value(serviceTime), scheduled);
    }

    private Map<ResourceType, Integer> capacityByType() {
        Map<ResourceType, Integer> capacities = new HashMap<>();
        for (ResourcePool pool : resources.getPools()) {
            capacities.merge(pool.type(), pool.capacity(), Integer::sum);
        }
        return capacities;
    }

    private int computeHorizon(OrderRequest order) {
        int totalDurations = order.jobs().stream()
                .flatMap(job -> job.dish().tasks().stream())
                .mapToInt(Task::duration)
                .sum();
        return totalDurations
                + config.toleranceCookingBeforePlatingMinutes()
                + config.tolerancePlatingBeforeServiceMinutes()
                + config.horizonPaddingMinutes();
    }

    private void validate(OrderRequest order) {
        if (order.jobs() == null || order.jobs().isEmpty()) {
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

    private record TaskKey(String jobId, int taskId) {
        @Override
        public String toString() {
            return jobId + "_" + taskId;
        }
    }
}
