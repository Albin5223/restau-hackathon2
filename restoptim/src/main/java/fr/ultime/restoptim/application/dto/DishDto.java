package fr.ultime.restoptim.application.dto;

import java.util.List;

public record DishDto(Long id, String name, List<TaskDto> tasks) {

}
