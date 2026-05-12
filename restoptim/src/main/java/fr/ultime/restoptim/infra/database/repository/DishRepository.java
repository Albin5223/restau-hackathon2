package fr.ultime.restoptim.infra.database.repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.dish.CreateDishRequest;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.infra.database.jdbc.JdbcDishes;
import fr.ultime.restoptim.infra.database.mapper.TasksMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.spi.Dishes;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class DishRepository implements Dishes {
    private final JdbcTemplate jdbcTemplate;
    private final TasksMapper tasksMapper;

    @Override
    public List<Dish> getDishes() {
        return jdbcTemplate.query(
                JdbcDishes.getAllSql(),
                JdbcDishes.getRowMapper(tasksMapper)
        );
    }

    @Override
    public DishId save(CreateDishRequest createDishRequest) {
        GeneratedKeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(conn -> {
            PreparedStatement ps = conn.prepareStatement(
                    JdbcDishes.getInsertSQL(),
                    Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, createDishRequest.name());
            ps.setString(2, tasksMapper.toDto(createDishRequest.tasks()));
            return ps;
        }, keyHolder);

        return DishId.from(Objects.requireNonNull(keyHolder.getKey()).longValue());
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
        return jdbcTemplate.query(
                        JdbcDishes.getByIdSql(),
                        JdbcDishes.getRowMapper(tasksMapper),
                        id.value()
                )
                .stream()
                .findFirst();
    }
}
