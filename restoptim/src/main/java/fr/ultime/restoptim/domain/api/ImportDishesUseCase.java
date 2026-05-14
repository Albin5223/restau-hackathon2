package fr.ultime.restoptim.domain.api;

import fr.ultime.restoptim.domain.model.dish.CreateDishRequest;
import fr.ultime.restoptim.domain.model.dish.Dish;

import java.util.List;

public interface ImportDishesUseCase {

    List<Dish> importDishes(List<CreateDishRequest> request);
}
