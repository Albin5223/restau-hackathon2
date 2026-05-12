package fr.ultime.restoptim.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import fr.ultime.restoptim.domain.model.Dish;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.spi.Dishes;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/dishes")
@RequiredArgsConstructor
public class DishController {

    private final Dishes dishes;
    private final ObjectMapper objectMapper;

    @GetMapping
    public List<DishResponse> list() {
        return dishes.getDishes().stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    public DishResponse get(@PathVariable int id) {
        return dishes.getDishById(id).map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plat introuvable : " + id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DishResponse create(@RequestBody CreateDishRequest body) {
        if (body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom du plat est requis.");
        }
        if (body.tasks() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Les tâches du plat sont requises.");
        }
        try {
            String tasksJson = objectMapper.writeValueAsString(body.tasks());
            return toResponse(dishes.save(body.name().trim(), tasksJson));
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Format de tâches invalide.");
        }
    }

    private DishResponse toResponse(Dish dish) {
        List<StepDto> etapes = dish.tasks().stream()
                .map(t -> new StepDto(
                        t.name(),
                        t.resources().stream().map(ResourceType::name).toList(),
                        t.duration(),
                        t.dependencies(),
                        t.kind().name().toLowerCase()))
                .toList();
        return new DishResponse(dish.id(), dish.name(), new TasksDto(etapes));
    }

    public record CreateDishRequest(String name, TasksDto tasks) {}

    public record DishResponse(int id, String name, TasksDto tasks) {}

    public record TasksDto(List<StepDto> etapes) {}

    public record StepDto(String nom, List<String> ressource, int duree, List<Integer> deps, String kind) {}
}
