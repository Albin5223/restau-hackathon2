package fr.ultime.restoptim.application.mapper;

import fr.ultime.restoptim.application.dto.GanttTaskDto;
import fr.ultime.restoptim.domain.model.GanttTask;
import org.springframework.stereotype.Service;

@Service
public class GanttTaskMapper {


    public GanttTaskDto toDto(GanttTask domain){
        return GanttTaskDto.builder()
                .withId(domain.id())
                .withTableNumber(domain.tableNumber())
                .withOrderId(domain.orderId().value())
                .withDishName(domain.dishName())
                .withTaskName(domain.taskName())
                .withKind(domain.kind())
                .withResourceNames(domain.resourceNames())
                .withStartAt(domain.startAt())
                .withEndAt(domain.endAt())
                .build();
    }
}
