package fr.ultime.restoptim.controller;

import fr.ultime.restoptim.RestoptimApplication;
import fr.ultime.restoptim.tooling.model.Dish;
import fr.ultime.restoptim.tooling.model.Task;
import fr.ultime.restoptim.tooling.repository.DishesTestRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
@SpringBootTest(classes = {RestoptimApplication.class})
@ActiveProfiles("test")
public class CreateDishControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DishesTestRepository dishesRepository;

    @Test
    public void test_can_create_dish() throws Exception {
        mockMvc.perform(post("/api/dishes").content("""
                        {
                            "name" :"testDish",
                            "tasks" : [
                                {
                                    "nom" :"nomTask1",
                                    "resources" :["resource1"],
                                    "duration" : 123,
                                    "dependencies":[],
                                    "kind": "COOKING"
                                }
                            ]
                        }
                        """).contentType("application/json"))
                .andExpect(status().isCreated());


        List<Dish> all = dishesRepository.findAll();
        assertThat(all).hasSize(1);

        Dish dishResult = all.getFirst();
        assertThat(dishResult.name()).isEqualTo("testDish");
        assertThat(dishResult.id()).isEqualTo(1L);
        assertThat(dishResult.tasks()).hasSize(1);

        Task taskResult = dishResult.tasks().getFirst();
        assertThat(taskResult.name()).isEqualTo("nomTask1");
        assertThat(taskResult.duration()).isEqualTo(123);
        assertThat(taskResult.dependencies()).isEmpty();
        assertThat(taskResult.kind()).isEqualTo("COOKING");
        assertThat(taskResult.resources()).hasSize(1);

        assertThat(taskResult.resources().getFirst()).isEqualTo("resource1");
    }

}
