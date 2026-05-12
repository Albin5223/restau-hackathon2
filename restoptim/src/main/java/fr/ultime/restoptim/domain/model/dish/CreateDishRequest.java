package fr.ultime.restoptim.domain.model.dish;

import fr.ultime.restoptim.domain.model.task.Task;

import java.util.List;

public record CreateDishRequest(
        String name,
        List<Task> tasks
) {
}
