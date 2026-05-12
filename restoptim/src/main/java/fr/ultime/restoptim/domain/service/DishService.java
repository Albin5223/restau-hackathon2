package fr.ultime.restoptim.domain.service;

import fr.ultime.restoptim.domain.api.CreateDishUseCase;
import fr.ultime.restoptim.domain.api.GetDishByIdUseCase;
import fr.ultime.restoptim.domain.api.GetDishesUseCase;
import fr.ultime.restoptim.domain.model.dish.CreateDishRequest;
import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.spi.Dishes;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DishService implements GetDishesUseCase, GetDishByIdUseCase, CreateDishUseCase {
    private final Dishes dishes;

    @Override
    public Dish getDishesById(DishId dishId) {
        return dishes.getDishById(dishId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plat introuvable : " + dishId.value()));
    }

    @Override
    public List<Dish> getAllDishes() {
        return dishes.getDishes();
    }

    @Override
    public DishId createDish(CreateDishRequest request) {
        return dishes.save(request);
    }
}
