package fr.ultime.restoptim.application.dto;

import lombok.Builder;

import java.util.List;

@Builder(setterPrefix = "with")
public record GanttTaskDto(String id,
                           String orderId,
                           int tableNumber,
                           String dishName,
                           String taskName,
                           String kind,
                           List<String> resourceNames,
                           long startAt,
                           long endAt) {
}
