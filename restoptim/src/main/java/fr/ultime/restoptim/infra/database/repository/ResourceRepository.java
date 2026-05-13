package fr.ultime.restoptim.infra.database.repository;

import java.util.List;

import org.springframework.dao.EmptyResultDataAccessException;
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

    @Override
    public void createType(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Le nom du type de ressource est requis.");
        }
        Integer existing = jdbcTemplate.query(
                "SELECT resource_type_id FROM resource_types WHERE name = ?",
                rs -> rs.next() ? rs.getInt(1) : null,
                trimmed);
        if (existing != null) {
            throw new IllegalArgumentException("Le type \"" + trimmed + "\" existe déjà.");
        }
        jdbcTemplate.update("INSERT INTO resource_types (name) VALUES (?)", trimmed);
    }

    @Override
    public void deleteType(String name) {
        int typeId = findTypeIdOrThrow(name);
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM resources WHERE resource_type = ?", Integer.class, typeId);
        if (count != null && count > 0) {
            throw new IllegalStateException(
                    "Impossible de supprimer le type \"" + name + "\" : retirez d'abord toutes ses instances.");
        }
        jdbcTemplate.update("DELETE FROM resource_types WHERE resource_type_id = ?", typeId);
    }

    @Override
    public void addInstance(String typeName) {
        int typeId = findTypeIdOrThrow(typeName);
        jdbcTemplate.update("INSERT INTO resources (resource_type) VALUES (?)", typeId);
    }

    @Override
    public void removeInstance(String typeName) {
        int typeId = findTypeIdOrThrow(typeName);
        Integer resourceId = jdbcTemplate.query(
                "SELECT resource_id FROM resources WHERE resource_type = ? ORDER BY resource_id DESC LIMIT 1",
                rs -> rs.next() ? rs.getInt(1) : null,
                typeId);
        if (resourceId == null) {
            throw new IllegalStateException("Aucune instance à retirer pour le type \"" + typeName + "\".");
        }
        jdbcTemplate.update("DELETE FROM resources WHERE resource_id = ?", resourceId);
    }

    private int findTypeIdOrThrow(String name) {
        try {
            Integer id = jdbcTemplate.queryForObject(
                    "SELECT resource_type_id FROM resource_types WHERE name = ?",
                    Integer.class, name);
            if (id == null) throw new IllegalArgumentException("Type de ressource introuvable : " + name);
            return id;
        } catch (EmptyResultDataAccessException e) {
            throw new IllegalArgumentException("Type de ressource introuvable : " + name);
        }
    }
}
