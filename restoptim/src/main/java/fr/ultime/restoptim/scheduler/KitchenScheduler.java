package fr.ultime.restoptim.scheduler;

import com.google.ortools.Loader;
import com.google.ortools.sat.CpModel;
import com.google.ortools.sat.CpSolver;
import com.google.ortools.sat.CpSolverStatus;
import com.google.ortools.sat.IntVar;
import com.google.ortools.sat.IntervalVar;
import com.google.ortools.sat.LinearArgument;
import com.google.ortools.sat.LinearExpr;

import fr.ultime.restoptim.domain.DishJob;
import fr.ultime.restoptim.domain.DishTask;
import fr.ultime.restoptim.domain.OrderRequest;
import fr.ultime.restoptim.domain.OrderSchedule;
import fr.ultime.restoptim.domain.Resource;
import fr.ultime.restoptim.domain.ScheduledTask;
import fr.ultime.restoptim.domain.TaskKind;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Moteur CP-SAT qui planifie une commande (OrderRequest) en respectant :
 * - 1 job = 1 plat
 * - tâches avec dépendances (DAG) et parallélisme possible
 * - ressources exclusives via addNoOverlap par Resource
 * - synchronisation des dressages via un serviceTime global
 * - contraintes métier sur les cuissons (fin proche du dressage)
 */
public class KitchenScheduler {

    // Poids de l'objectif hiérarchique (service > gap plating > gap cuisson).
    private static final long WEIGHT_SERVICE_TIME = 1000L;
    private static final long WEIGHT_PLATING_TO_SERVICE_GAP = 50L;
    private static final long WEIGHT_COOKING_TO_PLATING_GAP = 1L;

    // Chargement unique de la lib native OR-Tools.
    private static volatile boolean nativeLoaded = false;

    private static void ensureNativeLoaded() {
        if (!nativeLoaded) {
            synchronized (KitchenScheduler.class) {
                if (!nativeLoaded) {
                    Loader.loadNativeLibraries();
                    nativeLoaded = true;
                }
            }
        }
    }

    private final SchedulerConfig config;

    public KitchenScheduler(SchedulerConfig config) {
        this.config = config;
        ensureNativeLoaded();
    }

    /** Petits IntVar/IntervalVar pour une tâche donnée. */
    private record TaskVars(IntVar start, IntVar end, IntervalVar interval) {
    }

    /** Contexte de construction du modèle, passé entre les étapes. */
    private record ModelContext(
            CpModel model,
            int horizon,
            Map<String, Integer> platingIndexByDish,
            Map<String, TaskVars> taskVarsByKey,
            Map<String, IntVar> platingStartByDish,
            Map<String, IntVar> platingEndByDish,
            Map<Resource, List<IntervalVar>> resourceToIntervals,
            List<IntVar> cookingGapVars
    ) {
    }

    /** Planifie une commande et retourne le OrderSchedule. */
    public OrderSchedule schedule(OrderRequest order) {
        Map<String, Integer> platingIndexByDish = validate(order);

        ModelContext ctx = createModelContext(order, platingIndexByDish);
        createTaskVars(order, ctx);
        addResourceConstraints(ctx);
        addPrecedenceAndCookingConstraints(order, ctx);

        IntVar serviceTime = addServiceConstraints(order, ctx);
        List<IntVar> serviceGapVars = collectServiceGapVars(order, ctx, serviceTime);

        buildObjective(ctx.model(), serviceTime, serviceGapVars, ctx.cookingGapVars());

        CpSolver solver = solve(ctx.model());
        return extractSchedule(order, ctx, solver, serviceTime);
    }

    // -------------------------------------------------------------------------
    // Étapes de construction du modèle
    // -------------------------------------------------------------------------

    private ModelContext createModelContext(OrderRequest order, Map<String, Integer> platingIndexByDish) {
        CpModel model = new CpModel();
        int horizon = computeHorizon(order);

        Map<Resource, List<IntervalVar>> resourceToIntervals = new EnumMap<>(Resource.class);
        for (Resource resource : Resource.values()) {
            resourceToIntervals.put(resource, new ArrayList<>());
        }

        return new ModelContext(
                model,
                horizon,
                platingIndexByDish,
                new LinkedHashMap<>(),
                new HashMap<>(),
                new HashMap<>(),
                resourceToIntervals,
                new ArrayList<>()
        );
    }

    private void createTaskVars(OrderRequest order, ModelContext ctx) {
        for (DishJob dish : order.dishes()) {
            int platingIndex = ctx.platingIndexByDish().get(dish.dishId());

            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask task = dish.tasks().get(taskIndex);
                String key = taskKey(dish.dishId(), taskIndex, task.name());

                IntVar start = ctx.model().newIntVar(0, ctx.horizon(), "start_" + key);
                IntVar end = ctx.model().newIntVar(0, ctx.horizon(), "end_" + key);
                IntervalVar interval = ctx.model().newIntervalVar(
                        start,
                        LinearExpr.constant(task.durationMinutes()),
                        end,
                        "interval_" + key
                );

                ctx.taskVarsByKey().put(key, new TaskVars(start, end, interval));

                for (Resource resource : task.resources()) {
                    ctx.resourceToIntervals().get(resource).add(interval);
                }

                if (taskIndex == platingIndex) {
                    ctx.platingStartByDish().put(dish.dishId(), start);
                    ctx.platingEndByDish().put(dish.dishId(), end);
                }
            }
        }
    }

    private void addResourceConstraints(ModelContext ctx) {
        for (List<IntervalVar> intervals : ctx.resourceToIntervals().values()) {
            if (intervals.size() > 1) {
                ctx.model().addNoOverlap(intervals);
            }
        }
    }

    private void addPrecedenceAndCookingConstraints(OrderRequest order, ModelContext ctx) {
        for (DishJob dish : order.dishes()) {
            int platingIndex = ctx.platingIndexByDish().get(dish.dishId());
            IntVar platingStart = ctx.platingStartByDish().get(dish.dishId());

            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask current = dish.tasks().get(taskIndex);
                String currentKey = taskKey(dish.dishId(), taskIndex, current.name());
                TaskVars currentVars = ctx.taskVarsByKey().get(currentKey);

                // a) dépendances explicites : start(curr) >= end(dep)
                for (Integer depIndex : current.dependsOn()) {
                    DishTask dependency = dish.tasks().get(depIndex);
                    String depKey = taskKey(dish.dishId(), depIndex, dependency.name());
                    TaskVars depVars = ctx.taskVarsByKey().get(depKey);
                    ctx.model().addGreaterOrEqual(currentVars.start(), depVars.end());
                }

                // b) le PLATING attend la fin de toutes les autres tâches du plat
                if (taskIndex != platingIndex) {
                    ctx.model().addGreaterOrEqual(platingStart, currentVars.end());
                }

                // c) cuissons : fin proche du plating (tolérance configurable)
                if (current.kind() == TaskKind.COOKING) {
                    addCookingTimingConstraints(ctx, currentKey, currentVars, platingStart);
                }
            }
        }
    }

    private void addCookingTimingConstraints(
            ModelContext ctx,
            String currentKey,
            TaskVars currentVars,
            IntVar platingStart
    ) {
        ctx.model().addLessOrEqual(currentVars.end(), platingStart);
        ctx.model().addGreaterOrEqual(
                currentVars.end(),
                LinearExpr.affine(platingStart, 1, -config.toleranceCookingBeforePlatingMinutes())
        );

        IntVar cookingGap = ctx.model().newIntVar(
                0,
                config.toleranceCookingBeforePlatingMinutes(),
                "gap_cooking_to_plating_" + currentKey
        );
        ctx.model().addEquality(
                cookingGap,
                LinearExpr.weightedSum(
                        new LinearArgument[]{platingStart, currentVars.end()},
                        new long[]{1, -1}
                )
        );
        ctx.cookingGapVars().add(cookingGap);
    }

    private IntVar addServiceConstraints(OrderRequest order, ModelContext ctx) {
        IntVar serviceTime = ctx.model().newIntVar(0, ctx.horizon(), "service_time");
        List<IntVar> platingEnds = new ArrayList<>(ctx.platingEndByDish().values());
        ctx.model().addMaxEquality(serviceTime, platingEnds);
        return serviceTime;
    }

    private List<IntVar> collectServiceGapVars(OrderRequest order, ModelContext ctx, IntVar serviceTime) {
        List<IntVar> serviceGapVars = new ArrayList<>();
        for (DishJob dish : order.dishes()) {
            IntVar platingEnd = ctx.platingEndByDish().get(dish.dishId());

            ctx.model().addLessOrEqual(platingEnd, serviceTime);
            ctx.model().addGreaterOrEqual(
                    platingEnd,
                    LinearExpr.affine(serviceTime, 1, -config.tolerancePlatingBeforeServiceMinutes())
            );

            IntVar serviceGap = ctx.model().newIntVar(
                    0,
                    config.tolerancePlatingBeforeServiceMinutes(),
                    "gap_plating_to_service_" + dish.dishId()
            );
            ctx.model().addEquality(
                    serviceGap,
                    LinearExpr.weightedSum(
                            new LinearArgument[]{serviceTime, platingEnd},
                            new long[]{1, -1}
                    )
            );
            serviceGapVars.add(serviceGap);
        }
        return serviceGapVars;
    }

    private void buildObjective(
            CpModel model,
            IntVar serviceTime,
            List<IntVar> serviceGapVars,
            List<IntVar> cookingGapVars
    ) {
        List<LinearArgument> vars = new ArrayList<>();
        List<Long> coeffs = new ArrayList<>();

        vars.add(serviceTime);
        coeffs.add(WEIGHT_SERVICE_TIME);

        for (IntVar gap : serviceGapVars) {
            vars.add(gap);
            coeffs.add(WEIGHT_PLATING_TO_SERVICE_GAP);
        }
        for (IntVar gap : cookingGapVars) {
            vars.add(gap);
            coeffs.add(WEIGHT_COOKING_TO_PLATING_GAP);
        }

        model.minimize(LinearExpr.weightedSum(
                vars.toArray(new LinearArgument[0]),
                coeffs.stream().mapToLong(Long::longValue).toArray()
        ));
    }

    private CpSolver solve(CpModel model) {
        CpSolver solver = new CpSolver();
        solver.getParameters().setMaxTimeInSeconds(config.maxSolveSeconds());

        CpSolverStatus status = solver.solve(model);
        if (status != CpSolverStatus.OPTIMAL && status != CpSolverStatus.FEASIBLE) {
            throw new IllegalStateException("Aucune solution trouvée. Augmentez les tolérances ou l'horizon.");
        }
        return solver;
    }

    private OrderSchedule extractSchedule(
            OrderRequest order,
            ModelContext ctx,
            CpSolver solver,
            IntVar serviceTime
    ) {
        List<ScheduledTask> scheduledTasks = new ArrayList<>();
        for (DishJob dish : order.dishes()) {
            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask task = dish.tasks().get(taskIndex);
                String key = taskKey(dish.dishId(), taskIndex, task.name());
                TaskVars vars = ctx.taskVarsByKey().get(key);

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

    // -------------------------------------------------------------------------
    // Validation et utilitaires
    // -------------------------------------------------------------------------

    /** Calcule un horizon sûr : somme des durées + marges. */
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

    /**
     * Validation métier + retour de l'index PLATING par plat (calculé une seule fois).
     * Vérifie : dishId uniques, noms de tâches uniques par plat, exactement 1 PLATING par plat,
     * dépendances valides, DAG acyclique.
     */
    private Map<String, Integer> validate(OrderRequest order) {
        Set<String> dishIds = new HashSet<>();
        Map<String, Integer> platingIndexByDish = new HashMap<>();

        for (DishJob dish : order.dishes()) {
            if (!dishIds.add(dish.dishId())) {
                throw new IllegalArgumentException("Identifiant de plat dupliqué : " + dish.dishId());
            }

            Set<String> taskNames = new HashSet<>();
            int platingIndex = -1;

            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask task = dish.tasks().get(taskIndex);

                if (!taskNames.add(task.name())) {
                    throw new IllegalArgumentException(
                            "Nom de tâche dupliqué dans le plat " + dish.dishId() + " : " + task.name()
                    );
                }

                if (task.kind() == TaskKind.PLATING) {
                    if (platingIndex != -1) {
                        throw new IllegalArgumentException(
                                "Le plat contient plusieurs tâches PLATING : " + dish.dishId()
                        );
                    }
                    platingIndex = taskIndex;
                }

                for (Integer depIndex : task.dependsOn()) {
                    if (depIndex == null || depIndex < 0 || depIndex >= dish.tasks().size()) {
                        throw new IllegalArgumentException(
                                "Dépendance invalide dans le plat " + dish.dishId() + " tâche " + task.name()
                        );
                    }
                    if (depIndex == taskIndex) {
                        throw new IllegalArgumentException(
                                "Une tâche ne peut pas dépendre d'elle-même : " + dish.dishId() + " / " + task.name()
                        );
                    }
                }
            }

            if (platingIndex == -1) {
                throw new IllegalArgumentException(
                        "Chaque plat doit définir exactement une tâche PLATING. Plat: " + dish.dishId()
                );
            }

            ensureAcyclicGraph(dish);
            platingIndexByDish.put(dish.dishId(), platingIndex);
        }

        return platingIndexByDish;
    }

    private void ensureAcyclicGraph(DishJob dish) {
        int n = dish.tasks().size();
        int[] state = new int[n]; // 0=non visité,1=en cours,2=terminé

        for (int i = 0; i < n; i++) {
            if (state[i] == 0 && hasCycleDfs(dish, i, state)) {
                throw new IllegalArgumentException("Les dépendances forment un cycle dans le plat : " + dish.dishId());
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

    private String taskKey(String dishId, int taskIndex, String taskName) {
        return dishId + "_" + taskIndex + "_" + taskName;
    }
}
