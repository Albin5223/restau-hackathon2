package fr.ultime.restoptim.infra.database.mapper;

import fr.ultime.restoptim.domain.model.OrderSchedule;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.ScheduledTask;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.job.JobId;
import fr.ultime.restoptim.domain.model.order.OrderId;
import fr.ultime.restoptim.domain.model.task.TaskId;
import fr.ultime.restoptim.domain.model.task.TaskType;
import fr.ultime.restoptim.infra.database.dto.OrderScheduleJsonDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class OrderScheduleJsonMapper {
    private final ObjectMapper objectMapper;


    public OrderSchedule toDomain(String jsonString) {
        OrderScheduleJsonDto orderScheduleJsonDto = objectMapper.readValue(jsonString, OrderScheduleJsonDto.class);
        return toDomain(orderScheduleJsonDto);
    }

    private OrderSchedule toDomain(OrderScheduleJsonDto jsonDto) {
        return OrderSchedule.builder()
                .withOrderId(OrderId.from(jsonDto.getOrderId()))
                .withServiceTimeSecond(jsonDto.getServiceTimeSecond())
                .withScheduledTasks(jsonDto.getScheduledTasks().stream().map(this::toDomain).toList())
                .build();


    }

    private ScheduledTask toDomain(OrderScheduleJsonDto.ScheduledTaskJsonDto jsonDto) {
        return ScheduledTask.builder()
                .withJobId(JobId.from(jsonDto.getJobId()))
                .withDishId(DishId.from(jsonDto.getDishId()))
                .withDishName(jsonDto.getDishName())
                .withTaskId(TaskId.from(jsonDto.getTaskId()))
                .withTaskName(jsonDto.getTaskName())
                .withKind(TaskType.valueOf(jsonDto.getKind()))
                .withStartSecond(jsonDto.getStartSecond())
                .withEndSecond(jsonDto.getEndSecond())
                .withResources(jsonDto.getResources().stream().map(ResourceType::from).toList())
                .withAssignedResourceNames(jsonDto.getAssignedResourceNames())
                .build();


    }

    public String toDto(OrderSchedule domain) {
        return objectMapper.writeValueAsString(toJsonDto(domain));
    }

    private OrderScheduleJsonDto toJsonDto(OrderSchedule domain) {
        return OrderScheduleJsonDto.builder()
                .withOrderId(domain.orderId().value())
                .withServiceTimeSecond(domain.serviceTimeSecond())
                .withScheduledTasks(domain.scheduledTasks().stream().map(this::toJsonDto).toList())
                .build();
    }

    private OrderScheduleJsonDto.ScheduledTaskJsonDto toJsonDto(ScheduledTask domain) {
        return OrderScheduleJsonDto.ScheduledTaskJsonDto.builder()
                .withJobId(domain.jobId().value())
                .withDishId(domain.dishId().value())
                .withDishName(domain.dishName())
                .withTaskId(domain.taskId().value())
                .withTaskName(domain.taskName())
                .withKind(domain.kind().name())
                .withStartSecond(domain.startSecond())
                .withEndSecond(domain.endSecond())
                .withResources(domain.resources().stream().map(ResourceType::name).toList())
                .withAssignedResourceNames(domain.assignedResourceNames())
                .build();
    }
}
