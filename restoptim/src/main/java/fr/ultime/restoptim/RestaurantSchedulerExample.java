package fr.ultime.restoptim;

import com.google.ortools.sat.*;
import com.google.ortools.Loader;
import java.util.*;

/** Toutes les ressources du restaurant */
enum Resource {
	COMMIS, CHEF, PLANCHA, FRITEUSE, FOUR, CASSEROLE, POELE
}

/** Décrit une étape de recette */
record TaskType(String name, List<Resource> resources, int duration, List<Integer> dependsOn) {
}

/** Un plat = un DAG de TaskType */
record DishType(String name, List<TaskType> tasks) {
}

/** Une commande = liste de plats */
record Order(List<DishType> dishes) {
}

public class RestaurantSchedulerExample {

	public static void main(String[] args) {
		// Correction : charger la librairie native OR-Tools
		Loader.loadNativeLibraries();

		// Définition du menu
		DishType steakFrites = new DishType("Steak-frites", List.of(
				new TaskType("Prép. steak", List.of(Resource.COMMIS), 3, List.of()),
				new TaskType("Prép. frites", List.of(Resource.COMMIS), 2, List.of()),
				new TaskType("Cuisson steak", List.of(Resource.PLANCHA), 8, List.of(0)),
				new TaskType("Friture", List.of(Resource.COMMIS, Resource.FRITEUSE), 5, List.of(1)),
				new TaskType("Dressage", List.of(Resource.CHEF), 1, List.of(2, 3))));
		DishType saintJacques = new DishType("Coquilles St-Jacques", List.of(
				new TaskType("Nettoyage SJ", List.of(Resource.COMMIS, Resource.CASSEROLE), 3, List.of()),
				new TaskType("Sauce crème", List.of(Resource.CHEF, Resource.CASSEROLE), 4, List.of(0)),
				new TaskType("Saisir SJ", List.of(Resource.PLANCHA), 2, List.of(0)),
				new TaskType("Dressage", List.of(Resource.CHEF), 1, List.of(1, 2))));

		// Commande d’exemple : steak-frites + saint-jacques
		Order order = new Order(List.of(steakFrites, saintJacques));
		solve(List.of(order));
	}

	/** Variables CP-SAT pour une tâche instanciée */
	record TaskVars(IntVar start, IntVar end, IntervalVar interval) {
	}

	public static void solve(List<Order> orders) {
		CpModel model = new CpModel();
		int horizon = 60; // minutes

		Map<Resource, List<IntervalVar>> resourceToIntervals = new EnumMap<>(Resource.class);
		for (Resource r : Resource.values())
			resourceToIntervals.put(r, new ArrayList<>());

		List<List<TaskVars>> allTaskVars = new ArrayList<>();

		// 1. Variables et ressources
		for (int orderId = 0; orderId < orders.size(); orderId++) {
			Order order = orders.get(orderId);
			for (int dishIdx = 0; dishIdx < order.dishes().size(); dishIdx++) {
				DishType dish = order.dishes().get(dishIdx);
				List<TaskVars> jobVars = new ArrayList<>();
				for (int taskIdx = 0; taskIdx < dish.tasks().size(); taskIdx++) {
					TaskType task = dish.tasks().get(taskIdx);
					String suffix = "_o" + orderId + "_d" + dishIdx + "_t" + taskIdx;
					IntVar start = model.newIntVar(0, horizon, "start" + suffix);
					IntVar end = model.newIntVar(0, horizon, "end" + suffix);
					IntervalVar interval = model.newIntervalVar(start, model.newConstant(task.duration()), end,
							"interval" + suffix);
					jobVars.add(new TaskVars(start, end, interval));
					for (Resource res : task.resources())
						resourceToIntervals.get(res).add(interval);
				}
				allTaskVars.add(jobVars);
			}
		}

		// 2. Précédences
		int jobOffset = 0;
		for (Order order : orders) {
			for (DishType dish : order.dishes()) {
				List<TaskVars> jobVars = allTaskVars.get(jobOffset);
				for (int taskIdx = 0; taskIdx < dish.tasks().size(); taskIdx++) {
					TaskType task = dish.tasks().get(taskIdx);
					TaskVars current = jobVars.get(taskIdx);
					for (int depIdx : task.dependsOn()) {
						TaskVars dep = jobVars.get(depIdx);
						model.addGreaterOrEqual(current.start(), dep.end());
					}
				}
				jobOffset++;
			}
		}

		// 3. Contraintes de ressources
		for (Resource res : Resource.values()) {
			List<IntervalVar> intervals = resourceToIntervals.get(res);
			if (intervals.size() > 1)
				model.addNoOverlap(intervals);
		}

		// 4. Objectif : minimiser la fin du dernier plat
		List<IntVar> ends = new ArrayList<>();
		for (List<TaskVars> jobVars : allTaskVars)
			ends.add(jobVars.get(jobVars.size() - 1).end());
		IntVar makespan = model.newIntVar(0, horizon, "makespan");
		model.addMaxEquality(makespan, ends);
		model.minimize(makespan);

		// 5. Résolution
		CpSolver solver = new CpSolver();
		CpSolverStatus status = solver.solve(model);

		if (status == CpSolverStatus.OPTIMAL || status == CpSolverStatus.FEASIBLE) {
			System.out.println("Solution trouvée : durée totale = " + solver.value(makespan) + " min");
			int idx = 0;
			for (Order order : orders) {
				for (DishType dish : order.dishes()) {
					System.out.println("Plat : " + dish.name());
					List<TaskVars> jobVars = allTaskVars.get(idx++);
					for (int t = 0; t < dish.tasks().size(); t++) {
						TaskType task = dish.tasks().get(t);
						TaskVars vars = jobVars.get(t);
						System.out.printf("  %-15s : [%2d, %2d]  ressources: %s\n",
								task.name(),
								solver.value(vars.start()),
								solver.value(vars.end()),
								task.resources());
					}
				}
			}
		} else {
			System.out.println("Pas de solution trouvée.");
		}
	}
}