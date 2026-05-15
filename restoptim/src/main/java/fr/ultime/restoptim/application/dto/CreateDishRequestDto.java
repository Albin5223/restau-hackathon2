package fr.ultime.restoptim.application.dto;

import java.util.List;

public record CreateDishRequestDto(String name, List<TaskDto> tasks) {

    public boolean hasName() {
        return name != null && !name.isBlank();
    }

    public boolean hasTasks() {
        return tasks != null && !tasks.isEmpty();
    }
}
