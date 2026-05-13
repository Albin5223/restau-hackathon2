package fr.ultime.restoptim.application.dto;

import lombok.Builder;

import java.util.List;

@Builder(setterPrefix = "with")
public record OrderScheduleDto(
        String orderId,
        long serviceTimeSecond,
        List<ScheduledTaskDto> scheduledTasks) {
}
