package fr.ultime.restoptim.domain.model.dish;
import fr.ultime.restoptim.domain.model.task.Task;
import lombok.Builder;

import java.util.List;

@Builder(setterPrefix = "with")
public record Dish(DishId id, String name, List<Task> tasks) {
}
