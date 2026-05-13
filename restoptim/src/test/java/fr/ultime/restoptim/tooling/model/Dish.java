package fr.ultime.restoptim.tooling.model;


import lombok.Builder;

import java.util.List;

@Builder(setterPrefix = "with")
public record Dish (Long id, String name, List<Task> tasks){
}
