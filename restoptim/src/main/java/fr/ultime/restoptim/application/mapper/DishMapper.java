package fr.ultime.restoptim.application.mapper;

import fr.ultime.restoptim.application.dto.DishDto;
import fr.ultime.restoptim.domain.model.dish.Dish;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
public class DishMapper {

    private final TaskMapper taskMapper;

    public DishDto toDto(Dish dish) {
        return new DishDto(
                dish.id().value(),
                dish.name(),
                dish.tasks().stream()
                        .map(taskMapper::toDto)
                        .toList()
        );
    }
}
