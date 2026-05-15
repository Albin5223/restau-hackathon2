package fr.ultime.restoptim.infra.database.mapper;

import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.task.Task;
import fr.ultime.restoptim.domain.model.task.TaskId;
import fr.ultime.restoptim.infra.database.dto.TasksJsonDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TasksMapper {
    private final ObjectMapper objectMapper;
    private final TaskTypeMapper taskTypeMapper;


    public List<Task> toDomain(String jsonString) {
        List<Task> tasks = new ArrayList<>();

        if(jsonString.startsWith("\""))
            jsonString = objectMapper.readValue(jsonString, String.class);

        TasksJsonDto dtos = objectMapper.readValue(jsonString, TasksJsonDto.class);

        for (int i = 0; i < dtos.getEtapes().size(); i++) {
            tasks.add(new Task(
                    TaskId.from((long) i),
                    dtos.getEtapes().get(i).getNom(),
                    taskTypeMapper.toDomain(dtos.getEtapes().get(i).getKind()),
                    dtos.getEtapes().get(i).getRessource().stream()
                            .map(ResourceType::from)
                            .toList(),
                    dtos.getEtapes().get(i).getDuree(),
                    dtos.getEtapes().get(i).getDeps().stream()
                            .map(TaskId::from)
                            .toList()
            ));
        }

        return tasks;
    }

    public String toDto(List<Task> domain) {
        return objectMapper.writeValueAsString(new TasksJsonDto(domain.stream()
                .map(task -> new TasksJsonDto.TaskJsonDto(
                        task.name(),
                        task.kind().name(),
                        task.resources().stream().map(ResourceType::name).toList(),
                        task.duration(),
                        task.dependencies().stream().map(TaskId::value).toList()
                )).toList()));
    }
}
