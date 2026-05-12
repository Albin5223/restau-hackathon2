package fr.ultime.restoptim.application.api;

import java.util.ArrayList;
import java.util.List;

import fr.ultime.restoptim.domain.model.dish.DishId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
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

import fr.ultime.restoptim.domain.model.dish.Dish;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.spi.Dishes;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/dishes")
@RequiredArgsConstructor
public class DishController {

    private final Dishes dishes;
    private final ObjectMapper objectMapper;

    private final Logger logger = LoggerFactory.getLogger(DishController.class);

    @GetMapping
    public List<DishResponse> list() {
        return dishes.getDishes().stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    public DishResponse get(@PathVariable long id) {
        return dishes.getDishById(DishId.from(id)).map(this::toResponse)
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

    @PostMapping("/import")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public List<DishResponse> importDishes(@RequestBody List<CreateDishRequest> body) {
        if (body == null || body.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La liste de plats est vide.");
        }
        List<DishResponse> results = new ArrayList<>();
        for (int i = 0; i < body.size(); i++) {
            CreateDishRequest req = body.get(i);
            if (req.name() == null || req.name().isBlank()) {
                logger.warn("Plat #{} : nom manquant", i + 1);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Le nom du plat #" + (i + 1) + " est requis.");
            }
            if (req.tasks() == null) {
                logger.warn("Plat #{} : tâches manquantes", i + 1);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Les tâches du plat \"" + req.name() + "\" sont requises.");
            }
            try {
                String tasksJson = objectMapper.writeValueAsString(req.tasks());
                results.add(toResponse(dishes.save(req.name().trim(), tasksJson)));
            } catch (DataIntegrityViolationException e) {
                logger.warn("Plat #{} : nom en doublon - {}", i + 1, req.name());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Un plat avec le nom \"" + req.name().trim() + "\" existe déjà.");
            } catch (JsonProcessingException e) {
                logger.warn("Plat #{} : format de tâches invalide - {}", i + 1, req.name());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Format de tâches invalide pour \"" + req.name() + "\".");
            } catch (ResponseStatusException e) {
                throw e;
            } catch (Exception e) {
                logger.warn("Plat #{} : erreur inattendue - {} : {}", i + 1, req.name(), e.getMessage());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Erreur pour \"" + req.name() + "\" : " + e.getMessage());
            }
        }
        return results;
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
        return new DishResponse(dish.id().value(), dish.name(), new TasksDto(etapes));
    }

    public record CreateDishRequest(String name, TasksDto tasks) {}

    public record DishResponse(long id, String name, TasksDto tasks) {}

    public record TasksDto(List<StepDto> etapes) {}

    public record StepDto(String nom, List<String> ressource, int duree, List<Integer> deps, String kind) {}
}
