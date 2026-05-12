package fr.ultime.restoptim.domain.model;

public record SchedulerConfig(
        double maxSolveSeconds,
        int toleranceCookingBeforePlatingSeconds,
        int tolerancePlatingBeforeServiceSeconds,
        int horizonPaddingSeconds,
        long objectiveWeightServiceTime,
        long objectiveWeightServiceGap,
        long objectiveWeightCookingGap) {

    public SchedulerConfig {
        if (maxSolveSeconds <= 0.0) {
            throw new IllegalArgumentException("maxSolveSeconds doit etre > 0.");
        }
        if (toleranceCookingBeforePlatingSeconds < 0) {
            throw new IllegalArgumentException("toleranceCookingBeforePlatingSeconds doit etre >= 0.");
        }
        if (tolerancePlatingBeforeServiceSeconds < 0) {
            throw new IllegalArgumentException("tolerancePlatingBeforeServiceSeconds doit etre >= 0.");
        }
        if (horizonPaddingSeconds < 0) {
            throw new IllegalArgumentException("horizonPaddingSeconds doit etre >= 0.");
        }
        if (objectiveWeightServiceTime <= 0 || objectiveWeightServiceGap <= 0 || objectiveWeightCookingGap <= 0) {
            throw new IllegalArgumentException("Les poids de l'objectif doivent etre > 0.");
        }
    }
}
