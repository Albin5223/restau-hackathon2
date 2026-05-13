package fr.ultime.restoptim.application.mapper;

import fr.ultime.restoptim.application.dto.ScheduledTaskDto;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.ScheduledTask;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ScheduledTaskMapper {

    public ScheduledTaskDto toDto(ScheduledTask scheduledTask) {
        return ScheduledTaskDto.builder()
                .withJobId(scheduledTask.jobId().value())
                .withDishId(scheduledTask.dishId().value())
                .withDishName(scheduledTask.dishName())
                .withTaskId(scheduledTask.taskId().value())
                .withTaskName(scheduledTask.taskName())
                .withKind(scheduledTask.kind().name())
                .withStartSecond(scheduledTask.startSecond())
                .withEndSecond(scheduledTask.endSecond())
                .withResources(scheduledTask.resources().stream().map(ResourceType::name).toList())
                .withAssignedResourceNames(scheduledTask.assignedResourceNames())
                .build();
    }
}
