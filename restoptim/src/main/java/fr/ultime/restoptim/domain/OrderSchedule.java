package fr.ultime.restoptim.domain;

import java.util.List;

/** Planning complet d'une commande : serviceTime global + liste de tâches planifiées. */
public record OrderSchedule(
        String orderId,
        long serviceTimeMinute,
        List<ScheduledTask> scheduledTasks
) {
}
