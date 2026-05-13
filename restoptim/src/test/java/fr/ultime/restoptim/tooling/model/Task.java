package fr.ultime.restoptim.tooling.model;

import lombok.Builder;

import java.util.List;

@Builder(setterPrefix = "with")
public record Task(Long id,
                   String name,
                   String kind,
                   List<String> resources,
                   int duration,
                   List<Integer> dependencies){
}
