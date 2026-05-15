package fr.ultime.restoptim.domain.model.order;

public record OrderId(String value) {

    public static OrderId from(String value){
        return new OrderId(value);
    }

    public boolean isBlank() {
        return value == null || value.isBlank();
    }
}
