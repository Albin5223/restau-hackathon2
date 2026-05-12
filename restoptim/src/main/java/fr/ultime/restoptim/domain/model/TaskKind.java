package fr.ultime.restoptim.domain.model;

public enum TaskKind {
    PREPARATION(1),
    COOKING(2),
    PLATING(3),
    OTHER(0);

    private final int id;

    TaskKind(int id) {
        this.id = id;
    }

    public static TaskKind fromId(int id) {
        for (TaskKind kind : values()) {
            if (kind.id == id) {
                return kind;
            }
        }
        return OTHER;
    }
}