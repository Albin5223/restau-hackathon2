package fr.ultime.restoptim.tooling.repository;

import fr.ultime.restoptim.infra.database.jdbc.JdbcDishes;
import fr.ultime.restoptim.tooling.model.Dish;
import fr.ultime.restoptim.tooling.model.Task;
import fr.ultime.restoptim.tooling.serializer.TestTaskSerializationService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Objects;

@Repository
@RequiredArgsConstructor
public class DishesTestRepository {

    private final TestTaskSerializationService testTaskSerializationService;
    private final JdbcTemplate jdbcTemplate;

    public Long insert(Dish dish){
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(conn -> {
            PreparedStatement ps = conn.prepareStatement(
                    JdbcDishes.getInsertSQL(),
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, dish.name());
            ps.setString(2, testTaskSerializationService.serialize(dish.tasks()));
            return ps;
        }, keyHolder);

        return Objects.requireNonNull(keyHolder.getKey()).longValue();
    }

    public List<Dish> findAll() {
        return jdbcTemplate.query("SELECT id, name, tasks FROM recipe_documents", (rs, rowNum) -> {
            long dishId = rs.getLong("id");
            String name = rs.getString("name");
            List<Task> tasks = testTaskSerializationService.deserialize(rs.getString("tasks"));
            return new Dish(dishId, name, tasks);
        });
    }

    public Dish findById(Long id) {
        return jdbcTemplate.query("SELECT id, name, tasks FROM recipe_documents WHERE id = ?", (rs, rowNum) -> {
            long dishId = rs.getLong("id");
            String name = rs.getString("name");
            List<Task> tasks = testTaskSerializationService.deserialize(rs.getString("tasks"));
            return new Dish(dishId, name, tasks);
        }, id).stream().findFirst().orElseThrow();
    }

    public Integer count() {
        return jdbcTemplate.queryForObject("SELECT count(*) FROM recipe_documents", Integer.class);
    }

}
