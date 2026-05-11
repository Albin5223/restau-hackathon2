package fr.ultime.restoptim.domain.model;
import java.util.List;

public record Dish(int id, String name, List<Task> tasks) {
    
}
