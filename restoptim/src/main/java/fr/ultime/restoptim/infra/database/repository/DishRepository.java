package fr.ultime.restoptim.infra.database.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.jdbc.core.JdbcTemplate;
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
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public List<Dish> getDishes() {
        return jdbcTemplate.query(SELECT_ALL, (rs, rowNum) -> mapRowToDish(rs));
    }

    @Override
    public Dish getDishById(int id) {
        List<Dish> dishes = jdbcTemplate.query(SELECT_BY_ID, (rs, rowNum) -> mapRowToDish(rs), id);
        return dishes.stream().findFirst().orElse(null);
    }

    private Dish mapRowToDish(ResultSet rs) throws SQLException {
        int id = rs.getInt("id");
        String name = rs.getString("name");
        String tasksJson = rs.getString("tasks");
        return new Dish(id, name, parseTasks(tasksJson));
    }

    private List<Task> parseTasks(String tasksJson) throws SQLException {
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
            throw new SQLException("Impossible de parser le JSON des etapes", exception);
        }
    }

    private TaskKind parseKind(JsonNode kindNode) {
        if (kindNode == null || kindNode.isMissingNode() || kindNode.isNull()) {
            return TaskKind.OTHER;
        }
        String raw = kindNode.asText("").trim().toUpperCase(Locale.ROOT);
        return switch (raw) {
            case "COOKING", "CUISSON" -> TaskKind.COOKING;
            case "PLATING", "DRESSAGE" -> TaskKind.PLATING;
            default -> TaskKind.OTHER;
        };
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
     * Si aucune tache n'est marquee PLATING (cas des recettes sans champ "kind"),
     * on promeut la derniere tache en PLATING pour satisfaire le scheduler.
     */
    private List<Task> inferPlatingIfMissing(List<Task> tasks) {
        boolean hasPlating = tasks.stream().anyMatch(task -> task.kind() == TaskKind.PLATING);
        if (hasPlating || tasks.isEmpty()) {
            return tasks;
        }
        int lastIndex = tasks.size() - 1;
        Task last = tasks.get(lastIndex);
        tasks.set(lastIndex, new Task(
                last.id(),
                last.name(),
                TaskKind.PLATING,
                last.resources(),
                last.duration(),
                last.dependencies()));
        return tasks;
    }
}
