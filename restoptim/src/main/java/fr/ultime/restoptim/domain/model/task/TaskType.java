package fr.ultime.restoptim.domain.model.task;

public enum TaskType {
    PREPARATION(1),
    COOKING(2),
    PLATING(3),
    OTHER(0);

    private final int id;

    TaskType(int id) {
        this.id = id;
    }

    public static TaskType fromId(int id) {
        for (TaskType kind : values()) {
            if (kind.id == id) {
                return kind;
            }
        }
        return OTHER;
    }
}
