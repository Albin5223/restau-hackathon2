package fr.ultime.restoptim.application.api;

import java.util.ArrayList;
import java.util.List;

import fr.ultime.restoptim.domain.model.dish.DishId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import fr.ultime.restoptim.domain.model.task.TaskId;
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
    private final GetDishByIdUseCase getDishByIdUseCase;
    private final GetDishesUseCase getDishesUseCase;
    private final CreateDishUseCase createDishUseCase;

    private final DishMapper dishMapper;
    private final CreateDishRequestMapper createDishRequestMapper;

    private final Logger logger = LoggerFactory.getLogger(DishController.class);

    @GetMapping
    public List<DishDto> list() {
        return getDishesUseCase.getAllDishes().stream().map(dishMapper::toDto).toList();
    }

    @GetMapping("/{id}")
    public DishDto get(@PathVariable long id) {
        return dishMapper.toDto(getDishByIdUseCase.getDishesById(DishId.from(id)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LongIdResponse create(@RequestBody CreateDishRequestDto body) {
        if (body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom du plat est requis.");
        }
        if (body.tasks() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Les tâches du plat sont requises.");
        }
        return new LongIdResponse(createDishUseCase.createDish(createDishRequestMapper.toDomain(body)).value());
    }



    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        dishes.getDishById(DishId.from(id)).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Plat introuvable : " + id));
        try {
            dishes.delete(DishId.from(id));
        } catch (DataAccessException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce plat est utilisé dans une commande active et ne peut pas être supprimé.");
        }
    }

    @PostMapping("/import")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public List<Long> importDishes(@RequestBody List<CreateDishRequestDto> body) {
        if (body == null || body.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La liste de plats est vide.");
        }
        List<Long> results = new ArrayList<>();
        for (int i = 0; i < body.size(); i++) {
            CreateDishRequestDto createDishRequest = body.get(i);
            if (!createDishRequest.hasName()) {
                logger.warn("Plat #{} : nom manquant", i + 1);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Le nom du plat #" + (i + 1) + " est requis.");
            }
            if (!createDishRequest.hasTasks()) {
                logger.warn("Plat #{} : tâches manquantes", i + 1);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Les tâches du plat \"" + createDishRequest.name() + "\" sont requises.");
            }
            try {
                results.add(createDishUseCase.createDish(createDishRequestMapper.toDomain(createDishRequest)).value());
            } catch (DataIntegrityViolationException e) {
                logger.warn("Plat #{} : nom en doublon - {}", i + 1, createDishRequest.name());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Un plat avec le nom \"" + createDishRequest.name().trim() + "\" existe déjà.");
                String tasksJson = objectMapper.writeValueAsString(req.tasks());
                results.add(toResponse(dishes.save(req.name().trim(), tasksJson)));
            } catch (DataAccessException e) {
                if (isUniqueViolation(e)){
                    logger.warn("Plat #{} : violation de contrainte unique - {}", i + 1, req.name());
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Un plat avec le nom \"" + req.name().trim() + "\" existe déjà.");
                }
                logger.warn("Plat #{} : erreur de base de données - {} : {}", i + 1, req.name(), e.getMessage());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Erreur de base de données pour \"" + req.name() + "\".");
            } catch (JsonProcessingException e) {
                logger.warn("Plat #{} : format de tâches invalide - {}", i + 1, req.name());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Format de tâches invalide pour \"" + req.name() + "\".");
            } catch (ResponseStatusException e) {
                throw e;
            } catch (Exception e) {
                logger.warn("Plat #{} : erreur inattendue - {} : {}", i + 1, createDishRequest.name(), e.getMessage());
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Erreur pour \"" + createDishRequest.name() + "\" : " + e.getMessage());
            }
        }
        return results;
    }

    /** SQLite peut lever UncategorizedSQLException au lieu de DataIntegrityViolationException
     *  pour les violations UNIQUE — on détecte via le message. */
    private static boolean isUniqueViolation(Exception e) {
        String msg = e.getMessage() != null ? e.getMessage().toUpperCase() : "";
        return msg.contains("UNIQUE") || msg.contains("SQLITE_CONSTRAINT");
    }

    private DishResponse toResponse(Dish dish) {
        List<StepDto> etapes = dish.tasks().stream()
                .map(t -> new StepDto(
                        t.name(),
                        t.resources().stream().map(ResourceType::name).toList(),
                        t.duration(),
                        t.dependencies().stream().map(TaskId::value).toList(),
                        t.kind().name().toLowerCase()))
                .toList();
        return new DishResponse(dish.id().value(), dish.name(), new TasksDto(etapes));
    }

    public record CreateDishRequest(String name, TasksDto tasks) {}

    public record DishResponse(long id, String name, TasksDto tasks) {}

    public record TasksDto(List<StepDto> etapes) {}

    public record StepDto(String nom, List<String> ressource, int duree, List<Long> deps, String kind) {}
}
