package fr.ultime.restoptim.application.dto;

import java.util.List;

public record TaskDto(String nom, List<String> resources, int duration, List<Long> dependencies, String kind) {

}
