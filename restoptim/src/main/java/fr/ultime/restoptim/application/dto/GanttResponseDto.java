package fr.ultime.restoptim.application.dto;

import java.util.List;

public record GanttResponseDto(List<GanttTaskDto> tasks, long generatedAt) {
}
