package fr.ultime.restoptim.domain.model;

import java.util.List;

public record GanttResponse(List<GanttTask> tasks, long generatedAt) {
}
