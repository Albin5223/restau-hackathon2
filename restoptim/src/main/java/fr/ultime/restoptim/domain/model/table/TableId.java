package fr.ultime.restoptim.domain.model.table;

public record TableId(Long value) {
    public static TableId from(Long value){
        return new TableId(value);
    }
}
