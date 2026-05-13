package fr.ultime.restoptim.tooling.serializer;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import fr.ultime.restoptim.tooling.model.Task;

import lombok.*;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TestTaskSerializationService {

    private final ObjectMapper objectMapper;

    public String serialize(List<Task> tasks)  {
        try {
            return objectMapper.writeValueAsString(
                    new TasksDto(tasks.stream().map(
                            task -> TasksDto.TaskDto.builder()
                                    .withDeps(task.dependencies())
                                    .withKind(task.kind())
                                    .withNom(task.name())
                                    .withDuree(task.duration())
                                    .withRessource(task.resources())
                                    .build()
                    ).toList())
            );
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

    public List<Task> deserialize(String json)  {
        try {
            if (json.startsWith("\"")) {
                json = objectMapper.readValue(json, String.class);
            }
            return objectMapper.readValue(json, TasksDto.class)
                    .getEtapes()
                    .stream()
                    .map(task -> Task.builder()
                            .withKind(task.getKind())
                            .withDependencies(task.getDeps())
                            .withResources(task.getRessource())
                            .withName(task.getNom())
                            .withDuration(task.getDuree())
                            .build())
                    .toList();
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

    @NoArgsConstructor
    @Setter
    @AllArgsConstructor
    @Builder(setterPrefix = "with")
    @Getter
    public static class TasksDto {

        @Singular
        private List<TaskDto> etapes;

        @NoArgsConstructor
        @Setter
        @AllArgsConstructor
        @Builder(setterPrefix = "with")
        @Getter
        public static class TaskDto {

            private String nom;

            private String kind;

            private List<String> ressource;

            private Integer duree;

            @Singular
            private List<Integer> deps;
        }
    }
}