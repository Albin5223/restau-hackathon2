package fr.ultime.restoptim.domain.spi;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.dish.DishId;

public interface Dishes {

    List<Dish> getDishes();

    Optional<Dish> getDishById(DishId id);

    Dish save(String name, String tasksJson);
}
