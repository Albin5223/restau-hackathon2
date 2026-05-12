package fr.ultime.restoptim.infra.database.repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import fr.ultime.restoptim.domain.model.Dish;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.Task;
import fr.ultime.restoptim.domain.model.TaskKind;
import fr.ultime.restoptim.domain.spi.Dishes;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class DishRepository implements Dishes {

    private static final String SELECT_ALL =
            "SELECT id, name, tasks FROM recipe_documents ORDER BY id";
    private static final String SELECT_BY_ID =
            "SELECT id, name, tasks FROM recipe_documents WHERE id = ?";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public List<Dish> getDishes() {
        return jdbcTemplate.query(SELECT_ALL, (rs, rowNum) -> mapRowToDish(rs));
    }

    @Override
    public Dish save(String name, String tasksJson) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(conn -> {
            PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO recipe_documents (name, tasks) VALUES (?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, name);
            ps.setString(2, tasksJson);
            return ps;
        }, keyHolder);
        int id = Objects.requireNonNull(keyHolder.getKey()).intValue();
        return new Dish(id, name, parseTasks(tasksJson));
    }

    @Override
    public Optional<Dish> getDishById(int id) {
        return jdbcTemplate.query(SELECT_BY_ID, (rs, rowNum) -> mapRowToDish(rs), id)
                .stream()
                .findFirst();
    }

    private Dish mapRowToDish(ResultSet rs) throws SQLException {
        int id = rs.getInt("id");
        String name = rs.getString("name");
        String tasksJson = rs.getString("tasks");
        return new Dish(id, name, parseTasks(tasksJson));
    }

    private List<Task> parseTasks(String tasksJson) {
        try {
            JsonNode root = objectMapper.readTree(tasksJson);
            JsonNode etapes = root.path("etapes");

            List<Task> tasks = new ArrayList<>();
            for (int i = 0; i < etapes.size(); i++) {
                JsonNode step = etapes.get(i);
                int taskId = i + 1;
                String taskName = step.path("nom").asText();
                int duration = step.path("duree").asInt();
                TaskKind kind = parseKind(step.path("kind"));
                List<ResourceType> resources = parseResources(step.path("ressource"));
                List<Integer> dependencies = parseDependencies(step.path("deps"));
                tasks.add(new Task(taskId, taskName, kind, resources, duration, dependencies));
            }
            return inferPlatingIfMissing(tasks);
        } catch (Exception exception) {
            throw new IllegalArgumentException("JSON de recette invalide : " + tasksJson, exception);
        }
    }

    private TaskKind parseKind(JsonNode kindNode) {
        if (kindNode == null || kindNode.isMissingNode() || kindNode.isNull() || !kindNode.isInt()) {
            return TaskKind.OTHER;
        }
        return TaskKind.fromId(kindNode.asInt());
    }

    private List<ResourceType> parseResources(JsonNode resourceNode) {
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
            for (JsonNode dep : depsNode) {
                dependencies.add(dep.asInt());
            }
        }
        return dependencies;
    }

    /**
     * Si aucune étape n'est marquée PLATING, la dernière est promue automatiquement.
     * Nécessaire pour les recettes sans champ "kind" explicite.
     */
    private List<Task> inferPlatingIfMissing(List<Task> tasks) {
        if (tasks.isEmpty() || tasks.stream().anyMatch(t -> t.kind() == TaskKind.PLATING)) {
            return tasks;
        }
        int lastIndex = tasks.size() - 1;
        Task last = tasks.get(lastIndex);
        tasks.set(lastIndex, new Task(
                last.id(), last.name(), TaskKind.PLATING,
                last.resources(), last.duration(), last.dependencies()));
        return tasks;
    }
}
