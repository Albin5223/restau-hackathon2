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

// ---------------------------------------------------------------------------
// Définitions de domaine
// ---------------------------------------------------------------------------

/** Ressources disponibles : personnel et équipements. */
enum Resource {
    COMMIS_1,
    COMMIS_2,
    CHEF,
    PLANCHA,
    FRITEUSE,
    FOUR,
    CASSEROLE,
    POELE,
    POSTE_DRESSAGE
}

/** Type de tâche pour appliquer des règles métier (cuisson, dressage, autre). */
enum TaskKind {
    COOKING,
    PLATING,
    OTHER
}

/**
 * Définition immuable d'une tâche dans la recette d'un plat.
 * - name : nom humain lisible
 * - kind : type métier (COOKING, PLATING...)
 * - durationMinutes : durée en minutes
 * - resources : liste de ressources nécessaires simultanément
 * - dependsOn : indices des tâches (dans la même liste) dont cette tâche dépend
 */
record DishTask(
        String name,
        TaskKind kind,
        int durationMinutes,
        List<Resource> resources,
        List<Integer> dependsOn
) {
    DishTask {
        // validations simples à la construction
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Le nom de la tâche ne peut pas être vide.");
        }
        if (kind == null) {
            throw new IllegalArgumentException("Le type de tâche (kind) ne peut pas être nul.");
        }
        if (durationMinutes <= 0) {
            throw new IllegalArgumentException("La durée doit être strictement positive.");
        }
        if (resources == null || resources.isEmpty()) {
            throw new IllegalArgumentException("Une tâche doit nécessiter au moins une ressource.");
        }
        if (dependsOn == null) {
            throw new IllegalArgumentException("La liste dependsOn ne peut pas être nulle (peut être vide).");
        }
    }
}

/**
 * Un plat (job) : identifiant, nom et liste ordonnée de tâches formant un DAG.
 * L'ordre dans la liste permet de référencer les dépendances par index.
 */
record DishJob(
        String dishId,
        String dishName,
        List<DishTask> tasks
) {
    DishJob {
        if (dishId == null || dishId.isBlank()) {
            throw new IllegalArgumentException("L'identifiant du plat est requis.");
        }
        if (dishName == null || dishName.isBlank()) {
            throw new IllegalArgumentException("Le nom du plat est requis.");
        }
        if (tasks == null || tasks.isEmpty()) {
            throw new IllegalArgumentException("Un plat doit contenir au moins une tâche.");
        }
    }
}

/** Requête de planification : une commande contient plusieurs plats (jobs). */
record OrderRequest(
        String orderId,
        List<DishJob> dishes
) {
    OrderRequest {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("L'id de commande est requis.");
        }
        if (dishes == null || dishes.isEmpty()) {
            throw new IllegalArgumentException("La commande doit contenir au moins un plat.");
        }
    }
}

/** Configuration du solveur et tolérances métier. */
record SchedulerConfig(
        double maxSolveSeconds,
        int toleranceCookingBeforePlatingMinutes,
        int tolerancePlatingBeforeServiceMinutes,
        int horizonPaddingMinutes
) {
    SchedulerConfig {
        if (maxSolveSeconds <= 0.0) {
            throw new IllegalArgumentException("maxSolveSeconds doit être > 0.");
        }
        if (toleranceCookingBeforePlatingMinutes < 0) {
            throw new IllegalArgumentException("toleranceCookingBeforePlatingMinutes doit être >= 0.");
        }
        if (tolerancePlatingBeforeServiceMinutes < 0) {
            throw new IllegalArgumentException("tolerancePlatingBeforeServiceMinutes doit être >= 0.");
        }
        if (horizonPaddingMinutes < 0) {
            throw new IllegalArgumentException("horizonPaddingMinutes doit être >= 0.");
        }
    }
}

/** Résultat : une tâche planifiée avec ses ressources et son intervalle. */
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

/** Planning complet d'une commande : serviceTime global + liste de tâches planifiées. */
record OrderSchedule(
        String orderId,
        long serviceTimeMinute,
        List<ScheduledTask> scheduledTasks
) {
}

/** Petites variables d'instance pour les IntVar/IntervalVar d'OR-Tools. */
record TaskVars(IntVar start, IntVar end, IntervalVar interval) {
}

// ---------------------------------------------------------------------------
// Moteur principal : KitchenScheduler
// ---------------------------------------------------------------------------

/**
 * KitchenScheduler : classe instanciable qui construit et résout le modèle CP-SAT
 * pour une commande (OrderRequest). Le modèle garantit :
 * - 1 job = 1 plat
 * - tâches avec dépendances (DAG) et parallélisme si possible
 * - ressources exclusives via addNoOverlap par Resource
 * - synchronisation des dressages via un serviceTime global
 * - contraintes métier pour les cuissons (fin proche du dressage)
 */
public class KitchenScheduler {

    private final SchedulerConfig config;

    /**
     * Constructeur : reçoit la configuration et charge les bibliothèques natives OR-Tools.
     */
    public KitchenScheduler(SchedulerConfig config) {
        this.config = config;
        // charge la librairie native OR-Tools (jni). Appel sûr à chaque instance.
        Loader.loadNativeLibraries();
    }

    /**
     * Planifie une commande et retourne le OrderSchedule.
     * Étapes : validation, construction variables, contraintes, objectif, résolution, extraction.
     */
    public OrderSchedule schedule(OrderRequest order) {
        // 1) validation des entrées métiers
        validate(order);

        // 2) création du modèle CP-SAT
        CpModel model = new CpModel();

        // horizon calculé automatiquement (somme durées + marges)
        int horizon = computeHorizon(order);

        // maps pour retrouver les variables par clé stable
        Map<String, TaskVars> taskVarsByKey = new LinkedHashMap<>();

        // map resource -> listes d'intervalles (pour addNoOverlap)
        Map<Resource, List<IntervalVar>> resourceToIntervals = new EnumMap<>(Resource.class);
        for (Resource resource : Resource.values()) {
            resourceToIntervals.put(resource, new ArrayList<>());
        }

        // tracks pour les tâches de PLATING (début/fin par plat)
        Map<String, IntVar> platingStartByDishId = new HashMap<>();
        Map<String, IntVar> platingEndByDishId = new HashMap<>();

        // variables auxiliaires pour objectifs (gaps)
        List<IntVar> cookingGapVars = new ArrayList<>();

        // 3) création des variables start/end/interval pour chaque tâche
        for (DishJob dish : order.dishes()) {
            int platingIndex = findSinglePlatingIndex(dish);

            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask task = dish.tasks().get(taskIndex);
                String key = taskKey(dish.dishId(), taskIndex, task.name());

                // création des IntVar/IntervalVar pour la tâche
                IntVar start = model.newIntVar(0, horizon, "start_" + key);
                IntVar end = model.newIntVar(0, horizon, "end_" + key);
                IntervalVar interval = model.newIntervalVar(
                        start,
                        LinearExpr.constant(task.durationMinutes()),
                        end,
                        "interval_" + key
                );

                taskVarsByKey.put(key, new TaskVars(start, end, interval));

                // enregistrer l'intervalle pour CHAQUE ressource requise
                for (Resource resource : task.resources()) {
                    resourceToIntervals.get(resource).add(interval);
                }

                // si c'est la tâche de PLATING, mémoriser start/end pour le plat
                if (taskIndex == platingIndex) {
                    platingStartByDishId.put(dish.dishId(), start);
                    platingEndByDishId.put(dish.dishId(), end);
                }
            }
        }

        // 4) contraintes de ressources : une NoOverlap par Resource
        for (List<IntervalVar> intervals : resourceToIntervals.values()) {
            if (intervals.size() > 1) {
                model.addNoOverlap(intervals);
            }
        }

        // 5) contraintes de précédence (DAG intra-plat) + contraintes plating/cuisson
        for (DishJob dish : order.dishes()) {
            int platingIndex = findSinglePlatingIndex(dish);
            DishTask platingTask = dish.tasks().get(platingIndex);
            String platingKey = taskKey(dish.dishId(), platingIndex, platingTask.name());
            IntVar platingStart = taskVarsByKey.get(platingKey).start();

            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask current = dish.tasks().get(taskIndex);
                String currentKey = taskKey(dish.dishId(), taskIndex, current.name());
                TaskVars currentVars = taskVarsByKey.get(currentKey);

                // a) dépendances explicites : start(curr) >= end(dep)
                for (Integer depIndex : current.dependsOn()) {
                    DishTask dependency = dish.tasks().get(depIndex);
                    String depKey = taskKey(dish.dishId(), depIndex, dependency.name());
                    TaskVars depVars = taskVarsByKey.get(depKey);
                    model.addGreaterOrEqual(currentVars.start(), depVars.end());
                }

                // b) le PLATING du plat attend la fin de toutes les autres tâches
                if (taskIndex != platingIndex) {
                    model.addGreaterOrEqual(platingStart, currentVars.end());
                }

                // c) contraintes spécifiques aux cuissons : elles doivent finir proche du plating
                if (current.kind() == TaskKind.COOKING) {
                    // cuisson doit finir avant le plating
                    model.addLessOrEqual(currentVars.end(), platingStart);
                    // mais pas trop tôt : end(cooking) >= start(plating) - tolérance
                    model.addGreaterOrEqual(
                            currentVars.end(),
                            LinearExpr.affine(platingStart, 1, -config.toleranceCookingBeforePlatingMinutes())
                    );

                    // variable auxiliaire pour mesurer le gap cuisson->plating (objectif secondaire)
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

        // 6) serviceTime global : on veut que toutes les tâches PLATING finissent proche de ce service
        IntVar serviceTime = model.newIntVar(0, horizon, "service_time");
        List<IntVar> platingEnds = new ArrayList<>(platingEndByDishId.values());
        model.addMaxEquality(serviceTime, platingEnds);

        // variables pour mesurer l'attente entre plating et service (objectif secondaire)
        List<IntVar> serviceGapVars = new ArrayList<>();
        for (DishJob dish : order.dishes()) {
            IntVar platingEnd = platingEndByDishId.get(dish.dishId());
            // plating doit finir <= serviceTime
            model.addLessOrEqual(platingEnd, serviceTime);
            // plating doit aussi finir >= serviceTime - tolérance
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

        // 7) objectif hiérarchique pondéré : priorité 1 = serviceTime, ensuite gaps
        List<LinearArgument> objectiveVars = new ArrayList<>();
        List<Long> objectiveCoefficients = new ArrayList<>();

        // priorité principale : minimiser serviceTime (grand coefficient)
        objectiveVars.add(serviceTime);
        objectiveCoefficients.add(1000L);

        // priorité secondaire : minimiser l'attente plating->service
        for (IntVar serviceGap : serviceGapVars) {
            objectiveVars.add(serviceGap);
            objectiveCoefficients.add(50L);
        }

        // priorité tertiaire : minimiser gap cuisson->plating
        for (IntVar cookingGap : cookingGapVars) {
            objectiveVars.add(cookingGap);
            objectiveCoefficients.add(1L);
        }

        model.minimize(LinearExpr.weightedSum(
                objectiveVars.toArray(new LinearArgument[0]),
                objectiveCoefficients.stream().mapToLong(Long::longValue).toArray()
        ));

        // 8) résolution
        CpSolver solver = new CpSolver();
        solver.getParameters().setMaxTimeInSeconds(config.maxSolveSeconds());

        CpSolverStatus status = solver.solve(model);
        if (status != CpSolverStatus.OPTIMAL && status != CpSolverStatus.FEASIBLE) {
            throw new IllegalStateException("Aucune solution trouvée. Augmentez les tolérances ou l'horizon.");
        }

        // 9) extraction du planning au format métier
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

        // tri pour affichage/consommation : par heure de début
        scheduledTasks.sort(Comparator.comparingLong(ScheduledTask::startMinute));

        return new OrderSchedule(order.orderId(), solver.value(serviceTime), scheduledTasks);
    }

    // -----------------------------------------------------------------------
    // Méthodes utilitaires
    // -----------------------------------------------------------------------

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
     * Validation métier :
     * - dishId uniques
     * - noms de tâches uniques par plat
     * - exactement une tâche PLATING par plat
     * - dépendances valides et absence de cycles
     */
    private void validate(OrderRequest order) {
        Set<String> dishIds = new HashSet<>();

        for (DishJob dish : order.dishes()) {
            if (!dishIds.add(dish.dishId())) {
                throw new IllegalArgumentException("Identifiant de plat dupliqué : " + dish.dishId());
            }

            Set<String> taskNames = new HashSet<>();
            int platingCount = 0;

            for (int taskIndex = 0; taskIndex < dish.tasks().size(); taskIndex++) {
                DishTask task = dish.tasks().get(taskIndex);

                if (!taskNames.add(task.name())) {
                    throw new IllegalArgumentException(
                            "Nom de tâche dupliqué dans le plat " + dish.dishId() + " : " + task.name()
                    );
                }

                if (task.kind() == TaskKind.PLATING) {
                    platingCount++;
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

            if (platingCount != 1) {
                throw new IllegalArgumentException(
                        "Chaque plat doit définir exactement une tâche PLATING. Plat: " + dish.dishId()
                );
            }

            ensureAcyclicGraph(dish);
        }
    }

    /** Vérifie qu'il n'y a pas de cycle dans le DAG des tâches d'un plat. */
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
                return true; // back-edge détecté
            }
            if (state[dep] == 0 && hasCycleDfs(dish, dep, state)) {
                return true;
            }
        }

        state[node] = 2;
        return false;
    }

    /** Trouve l'index unique de la tâche PLATING dans le plat (erreur sinon). */
    private int findSinglePlatingIndex(DishJob dish) {
        int found = -1;

        for (int i = 0; i < dish.tasks().size(); i++) {
            if (dish.tasks().get(i).kind() == TaskKind.PLATING) {
                if (found != -1) {
                    throw new IllegalArgumentException(
                            "Le plat contient plusieurs tâches PLATING : " + dish.dishId()
                    );
                }
                found = i;
            }
        }

        if (found == -1) {
            throw new IllegalArgumentException("Le plat ne contient pas de tâche PLATING : " + dish.dishId());
        }

        return found;
    }

    /** Génère une clé stable pour identifier une tâche instance. */
    private String taskKey(String dishId, int taskIndex, String taskName) {
        return dishId + "_" + taskIndex + "_" + taskName;
    }

}
