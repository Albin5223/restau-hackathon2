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

        TasksJsonDto dtos = objectMapper.convertValue(jsonString, TasksJsonDto.class);

        for (int i = 0; i < dtos.getTasks().size(); i++) {
            tasks.add(new Task(
                    TaskId.from((long) i),
                    dtos.getTasks().get(i).getNom(),
                    taskTypeMapper.toDomain(dtos.getTasks().get(i).getType()),
                    dtos.getTasks().get(i).getResources().stream()
                            .map(ResourceType::from)
                            .toList(),
                    dtos.getTasks().get(i).getDuration(),
                    dtos.getTasks().get(i).getDependencies().stream()
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
