package fr.ultime.restoptim.infra.database.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.order.OrderId;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import fr.ultime.restoptim.domain.model.Table;
import fr.ultime.restoptim.domain.model.TableStatus;
import fr.ultime.restoptim.domain.spi.Tables;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class TableRepository implements Tables {

    private static final String SELECT_ALL =
            "SELECT id, number, seats, status, party_size, commande_id FROM restaurant_tables ORDER BY number";
    private static final String SELECT_BY_ID =
            "SELECT id, number, seats, status, party_size, commande_id FROM restaurant_tables WHERE id = ?";
    private static final String UPDATE =
            "UPDATE restaurant_tables SET status = ?, party_size = ?, commande_id = ? WHERE id = ?";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<Table> getTables() {
        return jdbcTemplate.query(SELECT_ALL, (rs, rowNum) -> mapRow(rs));
    }

    @Override
    public Optional<Table> getTableById(int id) {
        return jdbcTemplate.query(SELECT_BY_ID, (rs, rowNum) -> mapRow(rs), id)
                .stream()
                .findFirst();
    }

    @Override
    public void save(Table table) {
        jdbcTemplate.update(UPDATE,
                table.status().name(),
                table.partySize(),
                table.orderId(),
                table.id());
    }

    private Table mapRow(ResultSet rs) throws SQLException {
        int rawPartySize = rs.getInt("party_size");
        Integer partySize = rs.wasNull() ? null : rawPartySize;
        return new Table(
                rs.getInt("id"),
                rs.getInt("number"),
                rs.getInt("seats"),
                TableStatus.valueOf(rs.getString("status")),
                partySize,
                OrderId.from(rs.getString("commande_id")));
    }
}
