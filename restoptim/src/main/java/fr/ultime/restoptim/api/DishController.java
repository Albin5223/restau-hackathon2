package fr.ultime.restoptim.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.model.Dish;
import fr.ultime.restoptim.domain.spi.Dishes;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/dishes")
@RequiredArgsConstructor
public class DishController {

    private final Dishes dishes;

    @GetMapping
    public List<Dish> list() {
        return dishes.getDishes();
    }

    @GetMapping("/{id}")
    public Dish get(@PathVariable int id) {
        Dish dish = dishes.getDishById(id);
        if (dish == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Plat introuvable : " + id);
        }
        return dish;
    }
}
