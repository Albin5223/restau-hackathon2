package fr.ultime.restoptim.application.api;

import java.util.ArrayList;
import java.util.List;

import fr.ultime.restoptim.application.dto.OrderScheduleDto;
import fr.ultime.restoptim.application.mapper.OrderScheduleMapper;
import fr.ultime.restoptim.domain.model.dish.DishId;
import fr.ultime.restoptim.domain.model.job.JobId;
import fr.ultime.restoptim.domain.model.order.OrderId;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.job.DishJob;
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
    private final OrderScheduleMapper orderScheduleMapper;

    @PostMapping
    public OrderScheduleDto schedule(@RequestBody ScheduleRequest body) {
        if (body == null || body.dishIds() == null || body.dishIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "dishIds est requis et non vide.");
        }

        List<DishJob> jobs = new ArrayList<>();
        for (int index = 0; index < body.dishIds().size(); index++) {
            long dishId = body.dishIds().get(index);
            Dish dish = dishes.getDishById(DishId.from(dishId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plat introuvable : " + dishId));
            jobs.add(new DishJob(JobId.from("job_" + index), dish));
        }

        OrderId orderId = (body.orderId() == null || body.orderId().isBlank())
                ? OrderId.from("cmd_" + System.currentTimeMillis())
                : OrderId.from(body.orderId());

        try {
            return orderScheduleMapper.toDto(scheduler.schedule(new OrderRequest(orderId, jobs)));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
        }
    }

    public record ScheduleRequest(String orderId, List<Long> dishIds) {
    }
}
