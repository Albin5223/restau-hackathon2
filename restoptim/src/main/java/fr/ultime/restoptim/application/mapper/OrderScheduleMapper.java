package fr.ultime.restoptim.application.mapper;

import fr.ultime.restoptim.application.dto.OrderScheduleDto;
import fr.ultime.restoptim.domain.model.OrderSchedule;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OrderScheduleMapper {

    private final ScheduledTaskMapper scheduledTaskMapper;

    public OrderScheduleDto toDto(OrderSchedule domain){
        return OrderScheduleDto.builder()
                .withOrderId(domain.orderId().value())
                .withServiceTimeSecond(domain.serviceTimeSecond())
                .withScheduledTasks(domain.scheduledTasks().stream().map(scheduledTaskMapper::toDto).toList())
                .build();
    }
}
