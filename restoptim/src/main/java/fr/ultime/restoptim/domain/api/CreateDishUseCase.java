package fr.ultime.restoptim.domain.api;

import fr.ultime.restoptim.domain.model.dish.CreateDishRequest;
import fr.ultime.restoptim.domain.model.dish.DishId;

public interface CreateDishUseCase {

    DishId createDish(CreateDishRequest request);
}
