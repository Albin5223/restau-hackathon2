package fr.ultime.restoptim.application.mapper;

import fr.ultime.restoptim.application.dto.TaskDto;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.task.Task;
import fr.ultime.restoptim.domain.model.task.TaskId;
import fr.ultime.restoptim.infra.database.mapper.TaskTypeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskMapper {

    private final TaskTypeMapper taskTypeMapper;

    public Task toDomain(TaskDto taskDto, int index) {
        return new Task(
                TaskId.from((long) index),
                taskDto.nom(),
                taskTypeMapper.toDomain(taskDto.kind()),
                taskDto.resources().stream().map(ResourceType::from).toList(),
                taskDto.duration(),
                taskDto.dependencies().stream().map(TaskId::from).toList()
        );
    }

    public List<Task> toDomain(List<TaskDto> tasks) {
        List<Task> result = new ArrayList<>();
        for (int i = 0; i < tasks.size(); i++) {
            result.add(toDomain(tasks.get(i), i));
        }
        return result;
    }

    public TaskDto toDto(Task task) {
        return new TaskDto(
                task.name(),
                task.resources().stream().map(ResourceType::name).toList(),
                task.duration(),
                task.dependencies().stream().map(TaskId::value).toList(),
                task.kind().name()
        );
    }
}
