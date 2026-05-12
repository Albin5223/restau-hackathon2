package fr.ultime.restoptim.domain.model.order;

import java.util.List;

public record Order(
        OrderId id,
        int tableId,
        long placedAt,
        List<Integer> dishIds,
        String scheduleJson) {
}
