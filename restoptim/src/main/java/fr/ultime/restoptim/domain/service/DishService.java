package fr.ultime.restoptim.domain.service;

import fr.ultime.restoptim.domain.api.*;
import fr.ultime.restoptim.domain.model.dish.CreateDishRequest;
import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.spi.Dishes;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DishService implements GetDishesUseCase, GetDishByIdUseCase, CreateDishUseCase, UpdateDishUseCase, DeleteDishUseCase, ImportDishesUseCase {
    private final Dishes dishes;
    private final Logger logger = LoggerFactory.getLogger(DishService.class);


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

    @Override
    public void deleteDish(DishId dishId) {
        dishes.getDishById(dishId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Plat introuvable : " + dishId.value()));
        dishes.delete(dishId);
    }

    @Override
    public Dish update(DishId dishId, CreateDishRequest request) {
        dishes.getDishById(dishId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Plat introuvable : " + dishId.value()));
        return dishes.update(dishId, request.name(), request.tasks());
    }

    @Override
    public List<Dish> importDishes(List<CreateDishRequest> requests) {
        List<Dish> results = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            CreateDishRequest createDishRequest = requests.get(i);
            if (!createDishRequest.hasName()) {
                logger.warn("Plat #{} : nom manquant", i + 1);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Le nom du plat #" + (i + 1) + " est requis.");
            }
            if (!createDishRequest.hasTasks()) {
                logger.warn("Plat #{} : tâches manquantes", i + 1);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Les tâches du plat \"" + createDishRequest.name() + "\" sont requises.");
            }

            DishId dishId = dishes.save(createDishRequest);
            results.add(new Dish(dishId, createDishRequest.name(), createDishRequest.tasks()));
        }
        return results;
    }
}
