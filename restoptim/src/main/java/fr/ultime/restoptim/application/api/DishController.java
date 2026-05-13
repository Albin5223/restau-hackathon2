package fr.ultime.restoptim.application.api;

import java.util.List;

import fr.ultime.restoptim.application.dto.CreateDishRequestDto;
import fr.ultime.restoptim.application.dto.DishDto;
import fr.ultime.restoptim.application.dto.LongIdResponse;
import fr.ultime.restoptim.application.mapper.CreateDishRequestMapper;
import fr.ultime.restoptim.application.mapper.DishMapper;
import fr.ultime.restoptim.domain.api.*;
import fr.ultime.restoptim.domain.model.dish.DishId;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/dishes")
@RequiredArgsConstructor
public class DishController {
    private final GetDishByIdUseCase getDishByIdUseCase;
    private final GetDishesUseCase getDishesUseCase;
    private final CreateDishUseCase createDishUseCase;
    private final DeleteDishUseCase deleteDishUseCase;
    private final UpdateDishUseCase updateDishUseCase;
    private final ImportDishesUseCase importDishesUseCase;

    private final DishMapper dishMapper;
    private final CreateDishRequestMapper createDishRequestMapper;

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


    @PutMapping("/{id}")
    public DishDto update(@PathVariable long id, @RequestBody CreateDishRequestDto body) {
        if (body.name() == null || body.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom du plat est requis.");
        }
        if (body.tasks() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Les tâches du plat sont requises.");
        }
        return dishMapper.toDto(updateDishUseCase.update(DishId.from(id), createDishRequestMapper.toDomain(body)));
    }


    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        deleteDishUseCase.deleteDish(DishId.from(id));
    }

    @PostMapping("/import")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public List<DishDto> importDishes(@RequestBody List<CreateDishRequestDto> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La liste de plats est vide.");
        }
        return importDishesUseCase.importDishes(requests.stream()
                        .map(createDishRequestMapper::toDomain)
                        .toList()).stream()
                .map(dishMapper::toDto)
                .toList();
    }
}
