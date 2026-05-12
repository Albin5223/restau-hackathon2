package fr.ultime.restoptim.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.model.AutoSimulationStatus;
import fr.ultime.restoptim.domain.service.AutoSimulationService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/simulation/auto")
@RequiredArgsConstructor
public class AutoSimulationController {

    private final AutoSimulationService autoSimulationService;

    @GetMapping("/status")
    public AutoSimulationStatus status() {
        return autoSimulationService.getStatus();
    }

    @PostMapping("/start")
    public void start(@RequestBody StartRequest body) {
        double speed = (body.speedMultiplier() != null && body.speedMultiplier() > 0) ? body.speedMultiplier() : 1.0;
        try {
            autoSimulationService.start(body.durationMin(), body.arrivalRatePerHour(), body.avgPartySize(), speed);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    @PostMapping("/stop")
    public void stop() {
        autoSimulationService.stop();
    }

    public record StartRequest(
            int durationMin,
            double arrivalRatePerHour,
            int avgPartySize,
            Double speedMultiplier) {}
}
