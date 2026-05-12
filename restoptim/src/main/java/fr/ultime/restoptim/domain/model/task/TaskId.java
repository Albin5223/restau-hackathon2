package fr.ultime.restoptim.domain.model.task;

public record TaskId(Long value) {
    public static TaskId from(Long value){
        return new TaskId(value);
    }
}
