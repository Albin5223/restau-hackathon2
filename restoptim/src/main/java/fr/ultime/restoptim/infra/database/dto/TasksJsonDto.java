package fr.ultime.restoptim.infra.database.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TasksJsonDto {

    private List<TaskJsonDto> etapes;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TaskJsonDto{

        private String nom;

        private String kind;

        private List<String> ressource;

        private Integer duree;

        private List<Long> deps;

    }
}
