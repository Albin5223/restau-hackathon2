package fr.ultime.restoptim.infra.database.mapper;

import fr.ultime.restoptim.domain.model.task.TaskType;
import org.springframework.stereotype.Service;

@Service
public class TaskTypeMapper {

    public TaskType toDomain(String dto) {
        if(dto == null)
            return TaskType.OTHER;

        return switch (dto.toUpperCase()) {
            case "COOKING" -> TaskType.COOKING;
            case "PLATING" -> TaskType.PLATING;
            case "PREPARATION" -> TaskType.PREPARATION;
            default -> TaskType.OTHER;
        };
    }
}
