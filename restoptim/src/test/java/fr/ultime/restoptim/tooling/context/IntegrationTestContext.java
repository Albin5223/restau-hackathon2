package fr.ultime.restoptim.tooling.context;

import fr.ultime.restoptim.tooling.model.Dish;
import fr.ultime.restoptim.tooling.repository.DishesTestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class IntegrationTestContext {

    @Autowired
    private DishesTestRepository dishRepository;

    public void createContext(ApplicationContext applicationContext){
        applicationContext.databaseContext().ifPresent(this::createContext);
    }

    private void createContext(DatabaseContext databaseContext) {
        Optional.ofNullable(databaseContext.getDishes()).ifPresent(dishes -> dishes.forEach(this::createContext));
    }

    private void createContext(Dish dish) {
        dishRepository.insert(dish);
    }
}
