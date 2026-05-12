package fr.ultime.restoptim.domain.model;

import java.util.List;

public record Order(
        String id,
        int tableId,
        long placedAt,
        List<Integer> dishIds,
        String scheduleJson) {
}
