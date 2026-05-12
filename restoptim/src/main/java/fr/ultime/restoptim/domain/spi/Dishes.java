package fr.ultime.restoptim.domain.spi;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.Dish;

public interface Dishes {

    List<Dish> getDishes();

    Optional<Dish> getDishById(int id);

    Dish save(String name, String tasksJson);
}
