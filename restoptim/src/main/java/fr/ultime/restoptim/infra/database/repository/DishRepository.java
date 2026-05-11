package fr.ultime.restoptim.infra.database.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import fr.ultime.restoptim.domain.model.Dish;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.Task;
import fr.ultime.restoptim.domain.spi.Dishes;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class DishRepository implements Dishes {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public List<Dish> getDishes() {
        return jdbcTemplate.query("SELECT id, name, steps FROM recipe_documents ORDER BY id", (rs, rowNum) -> mapRowToDish(rs));
    }

    private Dish mapRowToDish(ResultSet rs) throws SQLException {
        int id = rs.getInt("id");
        String name = rs.getString("name");
        String stepsJson = rs.getString("steps");

        return new Dish(id, name, parseTasks(stepsJson));
    }

    private List<Task> parseTasks(String stepsJson) throws SQLException {
        try {
            JsonNode root = objectMapper.readTree(stepsJson);
            JsonNode etapes = root.path("etapes");

            List<Task> tasks = new ArrayList<>();
            for (int i = 0; i < etapes.size(); i++) {
                JsonNode step = etapes.get(i);
                int taskId = i + 1;
                String taskName = step.path("nom").asText();
                int duration = step.path("duree").asInt();

                List<ResourceType> resources = parseResources(step.path("ressource"), taskId);
                List<Integer> dependencies = parseDependencies(step.path("deps"));

                tasks.add(new Task(taskId, taskName, resources, duration, dependencies));
            }
            return tasks;
        } catch (Exception exception) {
            throw new SQLException("Impossible de parser le JSON des étapes", exception);
        }
    }

    private List<ResourceType> parseResources(JsonNode resourceNode, int taskId) {
        List<ResourceType> resources = new ArrayList<>();

        if (resourceNode.isArray()) {
            for (int i = 0; i < resourceNode.size(); i++) {
                resources.add(new ResourceType(resourceNode.get(i).asText()));
            }
        } else if (resourceNode.isTextual()) {
            resources.add(new ResourceType(resourceNode.asText()));
        }

        return resources;
    }

    private List<Integer> parseDependencies(JsonNode depsNode) {
        List<Integer> dependencies = new ArrayList<>();
        if (depsNode.isArray()) {
            for (JsonNode dependencyNode : depsNode) {
                dependencies.add(dependencyNode.asInt());
            }
        }
        return dependencies;
    }

    @Override
    public Dish getDishById(int id) {
        List<Dish> dishes = jdbcTemplate.query(
            "SELECT id, name, steps FROM recipe_documents WHERE id = ?",
            (rs, rowNum) -> mapRowToDish(rs),
            id
        );
        return dishes.stream().findFirst().orElse(null);
    }
    
}
