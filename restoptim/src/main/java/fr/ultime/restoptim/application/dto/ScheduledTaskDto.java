package fr.ultime.restoptim.application.dto;


import lombok.Builder;

import java.util.List;

@Builder(setterPrefix = "with")
public record ScheduledTaskDto(String jobId,
                               long dishId,
                               String dishName,
                               long taskId,
                               String taskName,
                               String kind,
                               long startSecond,
                               long endSecond,
                               List<String> resources,
                               List<String> assignedResourceNames) {
}
