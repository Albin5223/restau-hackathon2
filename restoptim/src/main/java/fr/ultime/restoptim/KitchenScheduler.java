package fr.ultime.restoptim;

import com.google.ortools.Loader;
import com.google.ortools.sat.CpModel;
import com.google.ortools.sat.CpSolver;
import com.google.ortools.sat.CpSolverStatus;
import com.google.ortools.sat.IntVar;
import com.google.ortools.sat.IntervalVar;
import com.google.ortools.sat.LinearArgument;
import com.google.ortools.sat.LinearExpr;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

enum Resource {
    COMMIS,
    CHEF,
    PLANCHA,
    FRITEUSE,
    FOUR,
    CASSEROLE,
    POELE,
    POSTE_DRESSAGE
}

enum TaskKind {
    COOKING,
    PLATING,
    OTHER
}

record DishTask(
        String name,
        TaskKind kind,
        int durationMinutes,
        List<Resource> resources,
        List<Integer> dependsOn
) {
    DishTask {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Task name cannot be blank.");
        }
        if (kind == null) {
            throw new IllegalArgumentException("Task kind cannot be null.");
        }
        if (durationMinutes <= 0) {
            throw new IllegalArgumentException("Task duration must be positive.");
        }
        if (resources == null || resources.isEmpty()) {
            throw new IllegalArgumentException("Task must require at least one resource.");
        }
        if (dependsOn == null) {
            throw new IllegalArgumentException("Task dependsOn cannot be null.");
        }
    }
}

record DishJob(
        String dishId,
        String dishName,
        List<DishTask> tasks
) {
    DishJob {
        if (dishId == null || dishId.isBlank()) {
            throw new IllegalArgumentException("Dish id cannot be blank.");
        }
        if (dishName == null || dishName.isBlank()) {
            throw new IllegalArgumentException("Dish name cannot be blank.");
        }
        if (tasks == null || tasks.isEmpty()) {
            throw new IllegalArgumentException("Dish must contain at least one task.");
        }
    }
}

record OrderRequest(
        String orderId,
        List<DishJob> dishes
) {
    OrderRequest {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("Order id cannot be blank.");
        }
        if (dishes == null || dishes.isEmpty()) {
            throw new IllegalArgumentException("Order must contain at least one dish.");
        }
    }
}

record SchedulerConfig(
        double maxSolveSeconds,
        int toleranceCookingBeforePlatingMinutes,
        int tolerancePlatingBeforeServiceMinutes,
        int horizonPaddingMinutes
) {
    SchedulerConfig {
        if (maxSolveSeconds <= 0.0) {
            throw new IllegalArgumentException("maxSolveSeconds must be > 0.");
        }
        if (toleranceCookingBeforePlatingMinutes < 0) {
            throw new IllegalArgumentException("toleranceCookingBeforePlatingMinutes must be >= 0.");
        }
        if (tolerancePlatingBeforeServiceMinutes < 0) {
            throw new IllegalArgumentException("tolerancePlatingBeforeServiceMinutes must be >= 0.");
        }
        if (horizonPaddingMinutes < 0) {
            throw new IllegalArgumentException("horizonPaddingMinutes must be >= 0.");
        }
    }
}

record ScheduledTask(
        String dishId,
        String dishName,
        String taskName,
        TaskKind kind,
        long startMinute,
        long endMinute,
        List<Resource> resources
) {
}

record OrderSchedule(
        String orderId,
        long serviceTimeMinute,
        List<ScheduledTask> scheduledTasks
) {
}

record TaskVars(IntVar start, IntVar end, IntervalVar interval) {
}

public class KitchenScheduler {

    private final SchedulerConfig config;

    public KitchenScheduler(SchedulerConfig config) {
        this.config = config;
        Loader.loadNativeLibraries();
    }

    public OrderSchedule schedule(OrderRequest order) {
        validate(order);

        CpModel model = new CpModel();
        int horizon = computeHorizon(order);

        Map<String, TaskVars> taskVarsByKey = new LinkedHashMap<>();
        Map<Resource, List<IntervalVar>> resourceToIntervals = new EnumMap<>(Resource.class);
        for (Resource resource : Resource.values()) {
            resourceToIntervals.put(resource, new ArrayList<>());
        }

        Map<String, IntVar> platingStartByDishId = new HashMap<>();
        Map<String, IntVar> platingEndByDishId = new HashMap<>();
        List<IntVar> cookingGapVars = new ArrayList<>();

        for (DishJob dish : order.dishes()) {
            int platingIndex = findSinglePlatingIndex(dish);

            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask task = dish.tasks().get(taskIndex);
                String key = taskKey(dish.dishId(), taskIndex, task.name());

                IntVar start = model.newIntVar(0, horizon, "start_" + key);
                IntVar end = model.newIntVar(0, horizon, "end_" + key);
                IntervalVar interval = model.newIntervalVar(
                        start,
                        LinearExpr.constant(task.durationMinutes()),
                        end,
                        "interval_" + key
                );

                taskVarsByKey.put(key, new TaskVars(start, end, interval));

                for (Resource resource : task.resources()) {
                    resourceToIntervals.get(resource).add(interval);
                }

                if (taskIndex == platingIndex) {
                    platingStartByDishId.put(dish.dishId(), start);
                    platingEndByDishId.put(dish.dishId(), end);
                }
            }
        }

        for (List<IntervalVar> intervals : resourceToIntervals.values()) {
            if (intervals.size() > 1) {
                model.addNoOverlap(intervals);
            }
        }

        for (DishJob dish : order.dishes()) {
            int platingIndex = findSinglePlatingIndex(dish);
            DishTask platingTask = dish.tasks().get(platingIndex);
            String platingKey = taskKey(dish.dishId(), platingIndex, platingTask.name());
            IntVar platingStart = taskVarsByKey.get(platingKey).start();

            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask current = dish.tasks().get(taskIndex);
                String currentKey = taskKey(dish.dishId(), taskIndex, current.name());
                TaskVars currentVars = taskVarsByKey.get(currentKey);

                for (Integer depIndex : current.dependsOn()) {
                    DishTask dependency = dish.tasks().get(depIndex);
                    String depKey = taskKey(dish.dishId(), depIndex, dependency.name());
                    TaskVars depVars = taskVarsByKey.get(depKey);
                    model.addGreaterOrEqual(currentVars.start(), depVars.end());
                }

                if (taskIndex != platingIndex) {
                    model.addGreaterOrEqual(platingStart, currentVars.end());
                }

                if (current.kind() == TaskKind.COOKING) {
                    model.addLessOrEqual(currentVars.end(), platingStart);
                    model.addGreaterOrEqual(
                            currentVars.end(),
                            LinearExpr.affine(platingStart, 1, -config.toleranceCookingBeforePlatingMinutes())
                    );

                    IntVar cookingGap = model.newIntVar(
                            0,
                            config.toleranceCookingBeforePlatingMinutes(),
                            "gap_cooking_to_plating_" + currentKey
                    );
                    model.addEquality(
                            cookingGap,
                            LinearExpr.weightedSum(
                                    new LinearArgument[]{platingStart, currentVars.end()},
                                    new long[]{1, -1}
                            )
                    );
                    cookingGapVars.add(cookingGap);
                }
            }
        }

        IntVar serviceTime = model.newIntVar(0, horizon, "service_time");
        List<IntVar> platingEnds = new ArrayList<>(platingEndByDishId.values());
        model.addMaxEquality(serviceTime, platingEnds);

        List<IntVar> serviceGapVars = new ArrayList<>();
        for (DishJob dish : order.dishes()) {
            IntVar platingEnd = platingEndByDishId.get(dish.dishId());
            model.addLessOrEqual(platingEnd, serviceTime);
            model.addGreaterOrEqual(
                    platingEnd,
                    LinearExpr.affine(serviceTime, 1, -config.tolerancePlatingBeforeServiceMinutes())
            );

            IntVar serviceGap = model.newIntVar(
                    0,
                    config.tolerancePlatingBeforeServiceMinutes(),
                    "gap_plating_to_service_" + dish.dishId()
            );
            model.addEquality(
                    serviceGap,
                    LinearExpr.weightedSum(
                            new LinearArgument[]{serviceTime, platingEnd},
                            new long[]{1, -1}
                    )
            );
            serviceGapVars.add(serviceGap);
        }

        List<LinearArgument> objectiveVars = new ArrayList<>();
        List<Long> objectiveCoefficients = new ArrayList<>();

        objectiveVars.add(serviceTime);
        objectiveCoefficients.add(1000L);

        for (IntVar serviceGap : serviceGapVars) {
            objectiveVars.add(serviceGap);
            objectiveCoefficients.add(50L);
        }

        for (IntVar cookingGap : cookingGapVars) {
            objectiveVars.add(cookingGap);
            objectiveCoefficients.add(1L);
        }

        model.minimize(LinearExpr.weightedSum(
                objectiveVars.toArray(new LinearArgument[0]),
                objectiveCoefficients.stream().mapToLong(Long::longValue).toArray()
        ));

        CpSolver solver = new CpSolver();
        solver.getParameters().setMaxTimeInSeconds(config.maxSolveSeconds());

        CpSolverStatus status = solver.solve(model);
        if (status != CpSolverStatus.OPTIMAL && status != CpSolverStatus.FEASIBLE) {
            throw new IllegalStateException("No feasible schedule found. Increase tolerances or horizon.");
        }

        List<ScheduledTask> scheduledTasks = new ArrayList<>();
        for (DishJob dish : order.dishes()) {
            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask task = dish.tasks().get(taskIndex);
                String key = taskKey(dish.dishId(), taskIndex, task.name());
                TaskVars vars = taskVarsByKey.get(key);

                scheduledTasks.add(new ScheduledTask(
                        dish.dishId(),
                        dish.dishName(),
                        task.name(),
                        task.kind(),
                        solver.value(vars.start()),
                        solver.value(vars.end()),
                        task.resources()
                ));
            }
        }

        scheduledTasks.sort(Comparator.comparingLong(ScheduledTask::startMinute));

        return new OrderSchedule(order.orderId(), solver.value(serviceTime), scheduledTasks);
    }

    private int computeHorizon(OrderRequest order) {
        int totalDurations = order.dishes().stream()
                .flatMap(dish -> dish.tasks().stream())
                .mapToInt(DishTask::durationMinutes)
                .sum();

        return totalDurations
                + config.toleranceCookingBeforePlatingMinutes()
                + config.tolerancePlatingBeforeServiceMinutes()
                + config.horizonPaddingMinutes();
    }

    private void validate(OrderRequest order) {
        Set<String> dishIds = new HashSet<>();

        for (DishJob dish : order.dishes()) {
            if (!dishIds.add(dish.dishId())) {
                throw new IllegalArgumentException("Duplicate dish id: " + dish.dishId());
            }

            Set<String> taskNames = new HashSet<>();
            int platingCount = 0;

            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask task = dish.tasks().get(taskIndex);

                if (!taskNames.add(task.name())) {
                    throw new IllegalArgumentException(
                            "Duplicate task name in dish " + dish.dishId() + ": " + task.name()
                    );
                }

                if (task.kind() == TaskKind.PLATING) {
                    platingCount++;
                }

                for (Integer depIndex : task.dependsOn()) {
                    if (depIndex == null || depIndex < 0 || depIndex >= dish.tasks().size()) {
                        throw new IllegalArgumentException(
                                "Invalid dependency index in dish " + dish.dishId() + " task " + task.name()
                        );
                    }
                    if (depIndex == taskIndex) {
                        throw new IllegalArgumentException(
                                "Task cannot depend on itself in dish " + dish.dishId() + " task " + task.name()
                        );
                    }
                }
            }

            if (platingCount != 1) {
                throw new IllegalArgumentException(
                        "Each dish must define exactly one PLATING task. Dish: " + dish.dishId()
                );
            }

            ensureAcyclicGraph(dish);
        }
    }

    private void ensureAcyclicGraph(DishJob dish) {
        int n = dish.tasks().size();
        int[] state = new int[n];

        for (int i = 0; i < n; i++) {
            if (state[i] == 0 && hasCycleDfs(dish, i, state)) {
                throw new IllegalArgumentException("Task dependencies contain a cycle in dish: " + dish.dishId());
            }
        }
    }

    private boolean hasCycleDfs(DishJob dish, int node, int[] state) {
        state[node] = 1;

        DishTask task = dish.tasks().get(node);
        for (Integer dep : task.dependsOn()) {
            if (state[dep] == 1) {
                return true;
            }
            if (state[dep] == 0 && hasCycleDfs(dish, dep, state)) {
                return true;
            }
        }

        state[node] = 2;
        return false;
    }

    private int findSinglePlatingIndex(DishJob dish) {
        int found = -1;

        for (int i = 0; i < dish.tasks().size(); i++) {
            if (dish.tasks().get(i).kind() == TaskKind.PLATING) {
                if (found != -1) {
                    throw new IllegalArgumentException(
                            "Dish has more than one PLATING task: " + dish.dishId()
                    );
                }
                found = i;
            }
        }

        if (found == -1) {
            throw new IllegalArgumentException("Dish has no PLATING task: " + dish.dishId());
        }

        return found;
    }

    private String taskKey(String dishId, int taskIndex, String taskName) {
        return dishId + "_" + taskIndex + "_" + taskName;
    }

}
