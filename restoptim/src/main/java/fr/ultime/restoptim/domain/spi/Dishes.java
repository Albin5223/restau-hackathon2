package fr.ultime.restoptim.domain.spi;

import java.util.List;

import fr.ultime.restoptim.domain.model.Dish;

public interface Dishes{

    List<Dish> getDishes();
    Dish getDishById(int id);
}
