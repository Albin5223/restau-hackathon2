package fr.ultime.restoptim.application.mapper;

import fr.ultime.restoptim.application.dto.OrderResultDto;
import fr.ultime.restoptim.domain.model.OrderResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
public class OrderResultMapper {

    private final GanttTaskMapper ganttTaskMapper;

    public OrderResultDto toDto(OrderResult domain) {
        return OrderResultDto.builder()
                .withOrderId(domain.orderId().value())
                .withTableNumber(domain.tableNumber())
                .withServiceTimeAt(domain.serviceTimeAt())
                .withScheduledTasks(domain.scheduledTasks()
                        .stream()
                        .map(ganttTaskMapper::toDto)
                        .toList())
                .build();
    }
}
