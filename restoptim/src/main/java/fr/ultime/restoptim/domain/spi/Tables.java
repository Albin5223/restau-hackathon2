package fr.ultime.restoptim.domain.spi;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.table.Table;
import fr.ultime.restoptim.domain.model.table.TableId;

public interface Tables {

    List<Table> getTables();

    Optional<Table> getTableById(TableId id);

    void save(Table table);
}
