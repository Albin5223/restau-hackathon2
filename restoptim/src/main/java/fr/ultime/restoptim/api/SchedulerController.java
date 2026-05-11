package fr.ultime.restoptim.api;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.model.Dish;
import fr.ultime.restoptim.domain.model.DishJob;
import fr.ultime.restoptim.domain.model.OrderRequest;
import fr.ultime.restoptim.domain.model.OrderSchedule;
import fr.ultime.restoptim.domain.spi.Dishes;
import fr.ultime.restoptim.scheduler.KitchenScheduler;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/schedule")
@RequiredArgsConstructor
public class SchedulerController {

    private final KitchenScheduler scheduler;
    private final Dishes dishes;

    @PostMapping
    public OrderSchedule schedule(@RequestBody ScheduleRequest body) {
        if (body == null || body.dishIds() == null || body.dishIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dishIds est requis et non vide.");
        }

        List<DishJob> jobs = new ArrayList<>();
        for (int index = 0; index < body.dishIds().size(); index++) {
            int dishId = body.dishIds().get(index);
            Dish dish = dishes.getDishById(dishId);
            if (dish == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Plat introuvable : " + dishId);
            }
            jobs.add(new DishJob("job_" + index, dish));
        }

        String orderId = (body.orderId() == null || body.orderId().isBlank())
                ? "cmd_" + System.currentTimeMillis()
                : body.orderId();

        return scheduler.schedule(new OrderRequest(orderId, jobs));
    }

    public record ScheduleRequest(String orderId, List<Integer> dishIds) {
    }
}
