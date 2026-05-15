package fr.ultime.restoptim.domain.api;

import fr.ultime.restoptim.domain.model.dish.DishId;

public interface DeleteDishUseCase {

    void deleteDish(DishId dishId);
}
