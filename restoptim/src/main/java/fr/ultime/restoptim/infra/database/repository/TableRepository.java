package fr.ultime.restoptim.infra.database.repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.order.OrderId;
import fr.ultime.restoptim.domain.model.table.TableId;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import fr.ultime.restoptim.domain.model.table.Table;
import fr.ultime.restoptim.domain.model.table.TableStatus;
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
    private static final String ALL_NUMBERS =
            "SELECT number FROM restaurant_tables ORDER BY number";
    private static final String INSERT =
            "INSERT INTO restaurant_tables(number, seats, status) VALUES (?, ?, 'LIBRE')";
    private static final String DELETE =
            "DELETE FROM restaurant_tables WHERE id = ?";
    private static final String UPDATE_SEATS =
            "UPDATE restaurant_tables SET seats = ? WHERE id = ?";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<Table> getTables() {
        return jdbcTemplate.query(SELECT_ALL, (rs, rowNum) -> mapRow(rs));
    }

    @Override
    public Optional<Table> getTableById(TableId id) {
        return jdbcTemplate.query(SELECT_BY_ID, (rs, rowNum) -> mapRow(rs), id.value())
                .stream()
                .findFirst();
    }

    @Override
    public void save(Table table) {
        jdbcTemplate.update(UPDATE,
                table.status().name(),
                table.partySize(),
                table.orderId() == null ? null : table.orderId().value(),
                table.id().value());
    }

    @Override
    public Table createTable(int seats) {
        List<Integer> existing = jdbcTemplate.queryForList(ALL_NUMBERS, Integer.class);
        int newNumber = 1;
        for (int n : existing) {
            if (n == newNumber) newNumber++;
            else break;
        }
        KeyHolder keyHolder = new GeneratedKeyHolder();
        final int finalNewNumber = newNumber;
        jdbcTemplate.update(conn -> {
            PreparedStatement ps = conn.prepareStatement(INSERT, Statement.RETURN_GENERATED_KEYS);
            ps.setInt(1, finalNewNumber);
            ps.setInt(2, seats);
            return ps;
        }, keyHolder);
        long newId = keyHolder.getKey().longValue();
        return new Table(TableId.from(newId), finalNewNumber, seats, TableStatus.LIBRE, null, null);
    }

    @Override
    public void deleteTable(TableId id) {
        jdbcTemplate.update(
                "DELETE FROM commande_items WHERE commande_id IN (SELECT id FROM commandes WHERE table_id = ?)",
                id.value());
        jdbcTemplate.update("DELETE FROM commandes WHERE table_id = ?", id.value());
        jdbcTemplate.update(DELETE, id.value());
    }

    @Override
    public void updateSeats(TableId id, int seats) {
        jdbcTemplate.update(UPDATE_SEATS, seats, id.value());
    }

    private Table mapRow(ResultSet rs) throws SQLException {
        int rawPartySize = rs.getInt("party_size");
        OrderId orderId = Optional.ofNullable(rs.getString("commande_id")).map(OrderId::from).orElse(null);
        Integer partySize = rs.wasNull() ? null : rawPartySize;
        return new Table(
                TableId.from((long)rs.getInt("id")),
                rs.getInt("number"),
                rs.getInt("seats"),
                TableStatus.valueOf(rs.getString("status")),
                partySize,
                orderId);
    }
}
