package fr.ultime.restoptim.application.api;

import fr.ultime.restoptim.application.dto.DelayTaskRequest;
import fr.ultime.restoptim.application.dto.GanttResponseDto;
import fr.ultime.restoptim.application.dto.GanttTaskDto;
import fr.ultime.restoptim.application.mapper.GanttTaskMapper;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.model.GanttResponse;
import fr.ultime.restoptim.domain.service.OrderService;
import lombok.RequiredArgsConstructor;

import java.util.List;

@RestController
@RequestMapping("/api/cuisine")
@RequiredArgsConstructor
public class CuisineController {

    private final OrderService orderService;
    private final GanttTaskMapper ganttTaskMapper;

    @GetMapping("/gantt")
    public GanttResponseDto gantt() {
        return new GanttResponseDto(orderService.getAllActiveGanttTasks().stream().map(
                ganttTaskMapper::toDto
        ).toList(), System.currentTimeMillis());
    }

    @PostMapping("/gantt/delay")
    public void delayTask(@RequestBody DelayTaskRequest request) {
        try {
            orderService.delayTask(request.ganttTaskId(), request.additionalSeconds());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }
}
