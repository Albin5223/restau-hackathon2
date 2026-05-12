package fr.ultime.restoptim.infra.database.repository;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import fr.ultime.restoptim.domain.model.ResourcePool;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.spi.Resources;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class ResourceRepository implements Resources {

    private static final String CAPACITY_QUERY = """
            SELECT rt.name AS name, COUNT(r.resource_id) AS capacity
            FROM resource_types rt
            LEFT JOIN resources r ON r.resource_type = rt.resource_type_id
            GROUP BY rt.resource_type_id, rt.name
            ORDER BY rt.resource_type_id
            """;

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<ResourcePool> getPools() {
        return jdbcTemplate.query(CAPACITY_QUERY, (rs, rowNum) -> new ResourcePool(
                new ResourceType(rs.getString("name")),
                rs.getInt("capacity")));
    }
}
