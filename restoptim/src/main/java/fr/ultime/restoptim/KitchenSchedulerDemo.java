package fr.ultime.restoptim;

import fr.ultime.restoptim.domain.DishJob;
import fr.ultime.restoptim.domain.DishTask;
import fr.ultime.restoptim.domain.OrderRequest;
import fr.ultime.restoptim.domain.OrderSchedule;
import fr.ultime.restoptim.domain.Resource;
import fr.ultime.restoptim.domain.ScheduledTask;
import fr.ultime.restoptim.domain.TaskKind;
import fr.ultime.restoptim.scheduler.KitchenScheduler;
import fr.ultime.restoptim.scheduler.SchedulerConfig;

import java.util.List;

/**
 * Petit point d'entree de demonstration pour lancer KitchenScheduler.
 */
public class KitchenSchedulerDemo {

	public static void main(String[] args) {
		SchedulerConfig config = new SchedulerConfig(
				5.0,
				10,
				3,
				15);

		KitchenScheduler scheduler = new KitchenScheduler(config);

		DishJob steakFrites = new DishJob(
				"plat_steak_frites",
				"Steak frites",
				List.of(
						new DishTask(
								"prep_steak",
								TaskKind.OTHER,
								3,
								List.of(Resource.COMMIS_1),
								List.of()),
						new DishTask(
								"cuisson_steak",
								TaskKind.COOKING,
								8,
								List.of(Resource.CHEF, Resource.POELE),
								List.of(0)),
						new DishTask(
								"cuisson_frites",
								TaskKind.COOKING,
								6,
								List.of(Resource.COMMIS_2, Resource.FRITEUSE),
								List.of()),
						new DishTask(
								"dressage",
								TaskKind.PLATING,
								2,
								List.of(Resource.CHEF, Resource.POSTE_DRESSAGE),
								List.of(1, 2))));

		DishJob saintJacques = new DishJob(
				"plat_saint_jacques",
				"Saint-Jacques",
				List.of(
						new DishTask(
								"prep_sj",
								TaskKind.OTHER,
								4,
								List.of(Resource.COMMIS_2),
								List.of()),
						new DishTask(
								"saisie_sj",
								TaskKind.COOKING,
								3,
								List.of(Resource.CHEF, Resource.PLANCHA),
								List.of(0)),
						new DishTask(
								"sauce",
								TaskKind.COOKING,
								5,
								List.of(Resource.COMMIS_1, Resource.CASSEROLE),
								List.of(0)),
						new DishTask(
								"dressage",
								TaskKind.PLATING,
								2,
								List.of(Resource.CHEF, Resource.POSTE_DRESSAGE),
								List.of(1, 2))));

		OrderRequest order = new OrderRequest(
				"cmd_demo_001",
				List.of(steakFrites, saintJacques));

		OrderSchedule schedule = scheduler.schedule(order);

		System.out.println("Service global a t=" + schedule.serviceTimeMinute() + " minutes");
		System.out.println("Planning detaille:");

		for (ScheduledTask task : schedule.scheduledTasks()) {
			System.out.printf(
					"[%s] %-14s %-8s : [%2d, %2d]  ressources=%s%n",
					task.dishName(),
					task.taskName(),
					task.kind(),
					task.startMinute(),
					task.endMinute(),
					task.resources());
		}
	}
}
