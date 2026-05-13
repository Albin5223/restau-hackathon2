package fr.ultime.restoptim.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.service.AutoSimulationService;
import fr.ultime.restoptim.domain.service.TimeShiftService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/time")
@RequiredArgsConstructor
public class TimeController {

    private final TimeShiftService timeShiftService;
    private final AutoSimulationService autoSimulationService;

    @GetMapping
    public TimeStatusResponse status() {
        return new TimeStatusResponse(timeShiftService.getOffsetMs(), autoSimulationService.isActive());
    }

    @PostMapping("/shift")
    public TimeStatusResponse shift(@RequestBody ShiftRequest body) {
        requireManualMode();
        long deltaMs = body.deltaSec() * 1000L;
        long offset = timeShiftService.shift(deltaMs);
        return new TimeStatusResponse(offset, false);
    }

    @PostMapping("/reset")
    public TimeStatusResponse reset() {
        requireManualMode();
        long offset = timeShiftService.reset();
        return new TimeStatusResponse(offset, false);
    }

    private void requireManualMode() {
        if (autoSimulationService.isActive()) {
            throw new ResponseStatusException(HttpStatus.LOCKED,
                    "Simulation automatique en cours — déplacement temporel désactivé.");
        }
    }

    public record ShiftRequest(long deltaSec) {}

    public record TimeStatusResponse(long offsetMs, boolean autoSimulationActive) {}
}
