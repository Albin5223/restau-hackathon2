package fr.ultime.restoptim.infra.database.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import fr.ultime.restoptim.domain.model.Commande;
import fr.ultime.restoptim.domain.spi.Commandes;
import lombok.RequiredArgsConstructor;

@Repository
@RequiredArgsConstructor
public class CommandeRepository implements Commandes {

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

    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void save(Commande commande) {
        jdbcTemplate.update(INSERT_COMMANDE,
                commande.id(), commande.tableId(), commande.placedAt(), commande.scheduleJson());
        for (int i = 0; i < commande.dishIds().size(); i++) {
            jdbcTemplate.update(INSERT_ITEM, commande.id(), commande.dishIds().get(i), i);
        }
    }

    @Override
    public Optional<Commande> getCommandeById(String id) {
        return jdbcTemplate.query(SELECT_BY_ID, (rs, rowNum) -> {
            List<Integer> dishIds = jdbcTemplate.queryForList(SELECT_DISH_IDS, Integer.class, id);
            return new Commande(rs.getString("id"), rs.getInt("table_id"),
                    rs.getLong("placed_at"), dishIds, rs.getString("schedule"));
        }, id).stream().findFirst();
    }

    @Override
    public List<Commande> getActiveCommandes() {
        return jdbcTemplate.query(SELECT_ACTIVE, (rs, rowNum) -> {
            String cid = rs.getString("id");
            List<Integer> dishIds = jdbcTemplate.queryForList(SELECT_DISH_IDS, Integer.class, cid);
            return new Commande(cid, rs.getInt("table_id"),
                    rs.getLong("placed_at"), dishIds, rs.getString("schedule"));
        });
    }
}
