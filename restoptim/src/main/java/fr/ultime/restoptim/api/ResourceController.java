package fr.ultime.restoptim.api;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import fr.ultime.restoptim.domain.spi.Resources;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceController {

    private final Resources resources;

    @GetMapping
    public List<ResourceTypeResponse> list() {
        return resources.getPools().stream()
                .map(p -> new ResourceTypeResponse(p.type().name(), p.capacity()))
                .toList();
    }

    public record ResourceTypeResponse(String name, int capacity) {}
}
