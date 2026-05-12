package fr.ultime.restoptim.domain.spi;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.Table;

public interface Tables {

    List<Table> getTables();

    Optional<Table> getTableById(int id);

    void save(Table table);
}
