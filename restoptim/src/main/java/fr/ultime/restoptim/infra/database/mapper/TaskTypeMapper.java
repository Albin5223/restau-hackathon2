package fr.ultime.restoptim.infra.database.mapper;

import fr.ultime.restoptim.domain.model.task.TaskType;
import org.springframework.stereotype.Service;

@Service
public class TaskTypeMapper {

    public TaskType toDomain(String dto) {
        return switch (dto) {
            case "COOKING" -> TaskType.COOKING;
            case "PLATING" -> TaskType.PLATING;
            case "PREPARATION" -> TaskType.PREPARATION;
            case "OTHER" -> TaskType.OTHER;
            case null -> null;
            default -> throw new IllegalArgumentException();
        };
    }
}
