package fr.ultime.restoptim.infra.database.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.List;

@Getter
@RequiredArgsConstructor
public class TasksJsonDto {

    @JsonProperty("etapes")
    private final List<TaskJsonDto> tasks;

    @Getter
    @RequiredArgsConstructor
    public static class TaskJsonDto{

        @JsonProperty("nom")
        private final String nom;

        @JsonProperty("kind")
        private final String type;

        @JsonProperty("ressource")
        private final List<String> resources;

        @JsonProperty("duree")
        private final Integer duration;

        @JsonProperty("deps")
        private final List<Long> dependencies;

    }
}
