package fr.ultime.restoptim.infra.database.jdbc;

import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.infra.database.mapper.TasksMapper;
import org.springframework.jdbc.core.RowMapper;

public class JdbcDishes {

    private static final String SELECT_ALL = "SELECT id, name, tasks FROM recipe_documents ORDER BY id";
    private static final String SELECT_BY_ID = "SELECT id, name, tasks FROM recipe_documents WHERE id = ?";
    private static final String INSERT = "INSERT INTO recipe_documents (name, tasks) VALUES (?, ?)";

    private JdbcDishes() {

    }

    public static String getInsertSQL() {
        return INSERT;
    }

    public static String getAllSql() {
        return SELECT_ALL;
    }

    public static String getByIdSql() {
        return SELECT_BY_ID;
    }

    public static RowMapper<Dish> getRowMapper(TasksMapper tasksMapper) {
        return (rs, rowNum) -> new Dish(
                DishId.from(rs.getLong("id")),
                rs.getString("name"),
                tasksMapper.toDomain(rs.getString("tasks"))
        );
    }
}
