package fr.ultime.restoptim.controller;

import fr.ultime.restoptim.RestoptimApplication;
import fr.ultime.restoptim.tooling.context.ApplicationContext;
import fr.ultime.restoptim.tooling.context.DatabaseContext;
import fr.ultime.restoptim.tooling.context.IntegrationTestContext;
import fr.ultime.restoptim.tooling.model.Dish;
import fr.ultime.restoptim.tooling.model.Task;
import fr.ultime.restoptim.tooling.repository.DishesTestRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
@SpringBootTest(classes = {RestoptimApplication.class})
@ActiveProfiles("test")
public class GetDishesControllerIT {

    @Autowired
    private MockMvc mockMvc;


    @Autowired
    private IntegrationTestContext testContext;

    @Test
    public void test_can_get_dishes() throws Exception {
        testContext.createContext(ApplicationContext.builder()
                        .withDatabaseContext(DatabaseContext.builder()
                                .withDish(Dish.builder()
                                        .withId(1L)
                                        .withName("dish1")
                                        .withTask(Task.builder()
                                                .withName("cookTask1")
                                                .withKind("COOKING")
                                                .withResource("PLAQUE")
                                                .withDuration(130)
                                                .build())
                                        .build())
                                .build())
                .build());

        mockMvc.perform(get("/api/dishes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("dish1"))
                .andExpect(jsonPath("$[0].name").value("dish1"))
                .andExpect(jsonPath("$[0].tasks").isArray())
                .andExpect(jsonPath("$[0].tasks", hasSize(1)))
                .andExpect(jsonPath("$[0].tasks[0].nom").value("cookTask1"))
                .andExpect(jsonPath("$[0].tasks[0].type").value("COOKING"))
                .andExpect(jsonPath("$[0].tasks[0].duration").value(130))
                .andExpect(jsonPath("$[0].tasks[0].dependencies").isArray())
                .andExpect(jsonPath("$[0].tasks[0].resources").isArray())
                .andExpect(jsonPath("$[0].tasks[0].dependencies", hasSize(0)))
                .andExpect(jsonPath("$[0].tasks[0].resources", hasSize(1)))
                .andExpect(jsonPath("$[0].tasks[0].resources[0]").value("PLAQUE"));
    }

}
