package fr.ultime.restoptim.domain.model;

import java.util.List;

public record OrderRequest(String orderId, List<DishJob> jobs) {
}
