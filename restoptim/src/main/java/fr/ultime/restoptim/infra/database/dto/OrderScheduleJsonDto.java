package fr.ultime.restoptim.infra.database.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder(setterPrefix = "with")
public class OrderScheduleJsonDto {
    private String orderId;
    private long serviceTimeSecond;
    private List<ScheduledTaskJsonDto> scheduledTasks;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(setterPrefix = "with")
    public static class ScheduledTaskJsonDto {
        private String jobId;
        private long dishId;
        private String dishName;
        private long taskId;
        private String taskName;
        private String kind;
        private long startSecond;
        private long endSecond;
        private List<String> resources;
        private List<String> assignedResourceNames;
    }
}
