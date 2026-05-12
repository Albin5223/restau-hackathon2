package fr.ultime.restoptim.domain.api;

import fr.ultime.restoptim.domain.model.dish.Dish;

import java.util.List;

public interface GetDishesUseCase {

    List<Dish> getAllDishes();
}
