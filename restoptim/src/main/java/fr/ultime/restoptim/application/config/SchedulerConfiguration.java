package fr.ultime.restoptim.application.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import fr.ultime.restoptim.domain.model.SchedulerConfig;

@Configuration
public class SchedulerConfiguration {

    @Bean
    public SchedulerConfig schedulerConfig(
            @Value("${restoptim.scheduler.max-solve-seconds:5}") double maxSolveSeconds,
            @Value("${restoptim.scheduler.tolerance-cooking-before-plating-seconds:600}") int toleranceCookingBeforePlatingSeconds,
            @Value("${restoptim.scheduler.tolerance-plating-before-service-seconds:180}") int tolerancePlatingBeforeServiceSeconds,
            @Value("${restoptim.scheduler.horizon-padding-seconds:900}") int horizonPaddingSeconds,
            @Value("${restoptim.scheduler.objective-weight-service-time:1000}") long objectiveWeightServiceTime,
            @Value("${restoptim.scheduler.objective-weight-service-gap:50}") long objectiveWeightServiceGap,
            @Value("${restoptim.scheduler.objective-weight-cooking-gap:1}") long objectiveWeightCookingGap) {
        return new SchedulerConfig(
                maxSolveSeconds,
                toleranceCookingBeforePlatingSeconds,
                tolerancePlatingBeforeServiceSeconds,
                horizonPaddingSeconds,
                objectiveWeightServiceTime,
                objectiveWeightServiceGap,
                objectiveWeightCookingGap);
    }
}
