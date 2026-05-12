package fr.ultime.restoptim.domain.model.job;

import fr.ultime.restoptim.domain.model.dish.Dish;

public record DishJob(JobId jobId, Dish dish) {
}
