package fr.ultime.restoptim.application.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import fr.ultime.restoptim.domain.model.GanttResponse;
import fr.ultime.restoptim.domain.service.CommandeService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/cuisine")
@RequiredArgsConstructor
public class CuisineController {

    private final CommandeService commandeService;

    @GetMapping("/gantt")
    public GanttResponse gantt() {
        return new GanttResponse(commandeService.getAllActiveGanttTasks(), System.currentTimeMillis());
    }
}
