package fr.ultime.restoptim.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import fr.ultime.restoptim.domain.model.SchedulerConfig;

@Configuration
public class SchedulerConfiguration {

    @Bean
    public SchedulerConfig schedulerConfig(
            @Value("${restoptim.scheduler.max-solve-seconds:5}") double maxSolveSeconds,
            @Value("${restoptim.scheduler.tolerance-cooking-before-plating-minutes:10}") int toleranceCookingBeforePlatingMinutes,
            @Value("${restoptim.scheduler.tolerance-plating-before-service-minutes:3}") int tolerancePlatingBeforeServiceMinutes,
            @Value("${restoptim.scheduler.horizon-padding-minutes:15}") int horizonPaddingMinutes) {
        return new SchedulerConfig(
                maxSolveSeconds,
                toleranceCookingBeforePlatingMinutes,
                tolerancePlatingBeforeServiceMinutes,
                horizonPaddingMinutes);
    }
}
