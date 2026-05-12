package fr.ultime.restoptim.domain.model.order;

import fr.ultime.restoptim.domain.model.table.TableId;

import java.util.List;

public record Order(
        OrderId id,
        TableId tableId,
        long placedAt,
        List<Integer> dishIds,
        String scheduleJson) {
}
