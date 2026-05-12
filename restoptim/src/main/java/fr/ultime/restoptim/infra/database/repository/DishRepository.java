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

import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.task.TaskId;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.task.Task;
import fr.ultime.restoptim.domain.model.task.TaskType;
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
        long id = Objects.requireNonNull(keyHolder.getKey()).longValue();
        return new Dish(DishId.from(id), name, parseTasks(tasksJson));
    }

    @Override
    public Dish update(DishId id, String name, String tasksJson) {
        jdbcTemplate.update(
                "UPDATE recipe_documents SET name = ?, tasks = ? WHERE id = ?",
                name, tasksJson, id.value());
        return new Dish(id, name, parseTasks(tasksJson));
    }

    @Override
    public void delete(DishId id) {
        jdbcTemplate.update("DELETE FROM recipe_documents WHERE id = ?", id.value());
    }

    @Override
    public Optional<Dish> getDishById(DishId id) {
        return jdbcTemplate.query(SELECT_BY_ID, (rs, rowNum) -> mapRowToDish(rs), id.value())
                .stream()
                .findFirst();
    }

    private Dish mapRowToDish(ResultSet rs) throws SQLException {
        long id = rs.getLong("id");
        String name = rs.getString("name");
        String tasksJson = rs.getString("tasks");
        return new Dish(DishId.from(id), name, parseTasks(tasksJson));
    }

    private List<Task> parseTasks(String tasksJson) {
        try {
            JsonNode root = objectMapper.readTree(tasksJson);
            JsonNode etapes = root.path("etapes");

            List<Task> tasks = new ArrayList<>();
            for (int i = 0; i < etapes.size(); i++) {
                JsonNode step = etapes.get(i);
                long taskId = i + 1;
                String taskName = step.path("nom").asText();
                int duration = step.path("duree").asInt();
                TaskType kind = parseKind(step.path("kind"));
                List<ResourceType> resources = parseResources(step.path("ressource"));
                List<Long> dependencies = parseDependencies(step.path("deps"));
                tasks.add(new Task(
                        TaskId.from(taskId),
                        taskName,
                        kind,
                        resources,
                        duration,
                        dependencies.stream()
                                .map(TaskId::from)
                                .toList()
                ));
            }
            return inferPlatingIfMissing(tasks);
        } catch (Exception exception) {
            throw new IllegalArgumentException("JSON de recette invalide : " + tasksJson, exception);
        }
    }

    private TaskType parseKind(JsonNode kindNode) {
        if (kindNode == null || kindNode.isMissingNode() || kindNode.isNull() || !kindNode.isTextual()) {
            return TaskType.OTHER;
        }
        if(kindNode.isInt()) {
            return TaskType.fromId(kindNode.asInt());
        }
        try{
            return TaskType.valueOf(kindNode.asText().toUpperCase());
        } catch (IllegalArgumentException e) {
            return TaskType.OTHER;
        }
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

    private List<Long> parseDependencies(JsonNode depsNode) {
        List<Long> dependencies = new ArrayList<>();
        if (depsNode.isArray()) {
            for (JsonNode dep : depsNode) {
                dependencies.add(dep.asLong());
            }
        }
        return dependencies;
    }

    /**
     * Si aucune étape n'est marquée PLATING, la dernière est promue automatiquement.
     * Nécessaire pour les recettes sans champ "kind" explicite.
     */
    private List<Task> inferPlatingIfMissing(List<Task> tasks) {
        if (tasks.isEmpty() || tasks.stream().anyMatch(t -> t.kind() == TaskType.PLATING)) {
            return tasks;
        }
        int lastIndex = tasks.size() - 1;
        Task last = tasks.get(lastIndex);
        tasks.set(lastIndex, new Task(
                last.id(), last.name(), TaskType.PLATING,
                last.resources(), last.duration(), last.dependencies()));
        return tasks;
    }
}
