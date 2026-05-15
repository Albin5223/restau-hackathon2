package fr.ultime.restoptim.application.api;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import fr.ultime.restoptim.domain.service.ResourceService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/resources")
@RequiredArgsConstructor
public class ResourceController {

    private final ResourceService resourceService;

    @GetMapping
    public List<ResourceTypeResponse> list() {
        return resourceService.getPools().stream()
                .map(p -> new ResourceTypeResponse(p.type().name(), p.capacity()))
                .toList();
    }

    @GetMapping("/usage")
    public Map<String, Integer> usage() {
        return resourceService.peakDemandByType();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public List<ResourceTypeResponse> createType(@RequestBody CreateTypeRequest body) {
        try {
            resourceService.createType(body.name());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        return list();
    }

    @DeleteMapping("/{name}")
    public List<ResourceTypeResponse> deleteType(@PathVariable String name) {
        try {
            resourceService.deleteType(name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
        return list();
    }

    @PostMapping("/{name}/instances")
    public List<ResourceTypeResponse> addInstance(@PathVariable String name) {
        try {
            resourceService.addInstance(name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
        return list();
    }

    @DeleteMapping("/{name}/instances")
    public List<ResourceTypeResponse> removeInstance(@PathVariable String name) {
        try {
            resourceService.removeInstance(name);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
        return list();
    }

    public record CreateTypeRequest(String name) {}

    public record ResourceTypeResponse(String name, int capacity) {}
}
