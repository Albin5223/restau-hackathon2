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
            @Value("${restoptim.scheduler.horizon-padding-minutes:15}") int horizonPaddingMinutes,
            @Value("${restoptim.scheduler.objective-weight-service-time:1000}") long objectiveWeightServiceTime,
            @Value("${restoptim.scheduler.objective-weight-service-gap:50}") long objectiveWeightServiceGap,
            @Value("${restoptim.scheduler.objective-weight-cooking-gap:1}") long objectiveWeightCookingGap) {
        return new SchedulerConfig(
                maxSolveSeconds,
                toleranceCookingBeforePlatingMinutes,
                tolerancePlatingBeforeServiceMinutes,
                horizonPaddingMinutes,
                objectiveWeightServiceTime,
                objectiveWeightServiceGap,
                objectiveWeightCookingGap);
    }
}
