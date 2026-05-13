package fr.ultime.restoptim.tooling.context;

import fr.ultime.restoptim.tooling.model.Dish;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@AllArgsConstructor
@Setter
@Getter
public class DatabaseContext {
    private List<Dish> dishes;
}
