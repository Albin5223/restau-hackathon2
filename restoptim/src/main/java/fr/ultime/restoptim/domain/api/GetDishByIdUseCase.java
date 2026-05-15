package fr.ultime.restoptim.domain.api;

import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.dish.DishId;

public interface GetDishByIdUseCase {

    Dish getDishesById(DishId dishId);
}
