package fr.ultime.restoptim.tooling.context;

import fr.ultime.restoptim.tooling.model.Dish;
import lombok.*;

import java.util.List;

@AllArgsConstructor
@Setter
@Getter
@Builder(setterPrefix = "with")
public class DatabaseContext {
    @Singular
    private List<Dish> dishes;
}
