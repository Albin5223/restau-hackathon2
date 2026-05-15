package fr.ultime.restoptim.infra.database.repository;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.OrderSchedule;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.order.Order;
import fr.ultime.restoptim.domain.model.order.OrderId;
import fr.ultime.restoptim.domain.model.table.TableId;
import fr.ultime.restoptim.infra.database.mapper.OrderScheduleJsonMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import fr.ultime.restoptim.domain.spi.Orders;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class OrderRepository implements Orders {

    private static final String INSERT_COMMANDE =
            "INSERT INTO commandes (id, table_id, placed_at, schedule, status) VALUES (?, ?, ?, ?, 'EN_PREPARATION')";
    private static final String INSERT_ITEM =
            "INSERT INTO commande_items (commande_id, dish_id, position) VALUES (?, ?, ?)";
    private static final String SELECT_BY_ID =
            "SELECT id, table_id, placed_at, schedule FROM commandes WHERE id = ?";
    private static final String SELECT_ACTIVE =
            "SELECT id, table_id, placed_at, schedule FROM commandes WHERE status = 'EN_PREPARATION' ORDER BY placed_at";
    private static final String SELECT_DISH_IDS =
            "SELECT dish_id FROM commande_items WHERE commande_id = ? ORDER BY position";
    private static final String COUNT_DISH_REFERENCES =
            "SELECT COUNT(1) FROM commande_items WHERE dish_id = ?";
    private static final String CLOSE_COMMANDE =
            "UPDATE commandes SET status = 'TERMINEE' WHERE id = ?";
    private static final String UPDATE_SCHEDULE =
            "UPDATE commandes SET schedule = ? WHERE id = ?";
    private static final String SHIFT_PLACED_AT =
            "UPDATE commandes SET placed_at = placed_at + ? WHERE status = 'EN_PREPARATION'";

    private final OrderScheduleJsonMapper orderScheduleMapper;
    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void save(Order order) {
        jdbcTemplate.update(INSERT_COMMANDE,
                order.id().value(), order.tableId().value(), order.placedAt(), orderScheduleMapper.toDto(order.orderSchedule()));
        for (int i = 0; i < order.dishIds().size(); i++) {
            jdbcTemplate.update(INSERT_ITEM, order.id().value(), order.dishIds().get(i).value(), i);
        }
    }

    @Override
    public Optional<Order> getOrderById(OrderId orderId) {
        return jdbcTemplate.query(SELECT_BY_ID, (rs, rowNum) -> {
            List<Long> dishIds = jdbcTemplate.queryForList(SELECT_DISH_IDS, Long.class, orderId.value());
            return new Order(OrderId.from(rs.getString("id")), TableId.from(rs.getLong("table_id")),
                    rs.getLong("placed_at"), dishIds.stream().map(DishId::from).toList(), orderScheduleMapper.toDomain(rs.getString("schedule")));
        }, orderId.value()).stream().findFirst();
    }

    @Override
    public void closeOrder(OrderId orderId) {
        jdbcTemplate.update(CLOSE_COMMANDE, orderId.value());
    }

    @Override
    public boolean isDishReferenced(DishId dishId) {
        Integer count = jdbcTemplate.queryForObject(COUNT_DISH_REFERENCES, Integer.class, dishId.value());
        return count != null && count > 0;
    }

    @Override
    public void updateSchedule(OrderId orderId, OrderSchedule orderSchedule) {
        jdbcTemplate.update(UPDATE_SCHEDULE, orderScheduleMapper.toDto(orderSchedule), orderId.value());
    }

    @Override
    public int shiftActiveOrdersPlacedAt(long deltaMs) {
        if (deltaMs == 0) return 0;
        return jdbcTemplate.update(SHIFT_PLACED_AT, deltaMs);
    }

    @Override
    public List<Order> getActiveOrders() {
        return jdbcTemplate.query(SELECT_ACTIVE, (rs, rowNum) -> {
            OrderId orderId = OrderId.from(rs.getString("id"));
            List<Long> dishIds = jdbcTemplate.queryForList(SELECT_DISH_IDS, Long.class, orderId.value());
            return new Order(orderId, TableId.from(rs.getLong("table_id")),
                    rs.getLong("placed_at"), dishIds.stream().map(DishId::from).toList(), orderScheduleMapper.toDomain(rs.getString("schedule")));
        });
    }
}
