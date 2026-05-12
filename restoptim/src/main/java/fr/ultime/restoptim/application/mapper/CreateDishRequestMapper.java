package fr.ultime.restoptim.application.mapper;

import fr.ultime.restoptim.application.dto.CreateDishRequestDto;
import fr.ultime.restoptim.domain.model.dish.CreateDishRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
public class CreateDishRequestMapper {

    private final TaskMapper taskMapper;

    public CreateDishRequest toDomain(CreateDishRequestDto dto) {
        return new CreateDishRequest(
                dto.name(),
                taskMapper.toDomain(dto.tasks())
        );
    }
}
