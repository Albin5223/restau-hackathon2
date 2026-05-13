package fr.ultime.restoptim.tooling.model;

import lombok.Builder;
import lombok.Singular;

import java.util.List;

@Builder(setterPrefix = "with")
public record Task(Long id,
                   String name,
                   String kind,
                   @Singular
                   List<String> resources,
                   int duration,
                   @Singular
                   List<Integer> dependencies){
}
