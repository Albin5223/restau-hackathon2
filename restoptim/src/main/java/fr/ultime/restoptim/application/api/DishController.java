package fr.ultime.restoptim.application.api;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import fr.ultime.restoptim.application.dto.CreateDishRequestDto;
import fr.ultime.restoptim.application.dto.DishDto;
import fr.ultime.restoptim.application.dto.LongIdResponse;
import fr.ultime.restoptim.application.mapper.CreateDishRequestMapper;
import fr.ultime.restoptim.application.mapper.DishMapper;
import fr.ultime.restoptim.domain.api.CreateDishUseCase;
import fr.ultime.restoptim.domain.api.GetDishByIdUseCase;
import fr.ultime.restoptim.domain.api.GetDishesUseCase;
import fr.ultime.restoptim.domain.model.ResourceType;
import fr.ultime.restoptim.domain.model.dish.Dish;
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

}
