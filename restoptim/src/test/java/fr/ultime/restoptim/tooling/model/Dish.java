package fr.ultime.restoptim.tooling.model;


import lombok.Builder;
import lombok.Singular;

import java.util.List;

@Builder(setterPrefix = "with")
public record Dish (Long id, String name, @Singular List<Task> tasks){
}
