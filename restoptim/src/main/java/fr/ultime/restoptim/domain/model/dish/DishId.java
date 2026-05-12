package fr.ultime.restoptim.domain.model.dish;

public record DishId(Long value) {
    public static DishId from(Long value){
        return new DishId(value);
    }
}
