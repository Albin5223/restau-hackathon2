package fr.ultime.restoptim.domain.model;

import fr.ultime.restoptim.domain.model.job.DishJob;
import fr.ultime.restoptim.domain.model.order.OrderId;

import java.util.List;

public record OrderRequest(OrderId orderId, List<DishJob> jobs) {
}
