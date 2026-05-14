package fr.ultime.restoptim.domain.api;

import fr.ultime.restoptim.domain.model.dish.CreateDishRequest;
import fr.ultime.restoptim.domain.model.dish.Dish;
public interface CreateDishUseCase {

    Dish createDish(CreateDishRequest request);
}
