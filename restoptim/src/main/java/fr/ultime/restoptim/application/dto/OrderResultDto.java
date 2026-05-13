package fr.ultime.restoptim.application.dto;

import lombok.Builder;

import java.util.List;

@Builder(setterPrefix = "with")
public record OrderResultDto(String orderId,
                             int tableNumber,
                             long serviceTimeAt,
                             List<GanttTaskDto> scheduledTasks) {
}
