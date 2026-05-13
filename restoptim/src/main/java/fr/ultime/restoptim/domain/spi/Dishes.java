package fr.ultime.restoptim.domain.spi;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.dish.CreateDishRequest;
import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.task.Task;

public interface Dishes {

    List<Dish> getDishes();

    Optional<Dish> getDishById(DishId id);

    DishId save(CreateDishRequest createDishRequest);

    Dish update(DishId id, String name, List<Task> tasks);

    void delete(DishId id);
}
