package fr.ultime.restoptim.scheduler;

/** Configuration du solveur et tolérances métier. */
public record SchedulerConfig(
        double maxSolveSeconds,
        int toleranceCookingBeforePlatingMinutes,
        int tolerancePlatingBeforeServiceMinutes,
        int horizonPaddingMinutes
) {
    public SchedulerConfig {
        if (maxSolveSeconds <= 0.0) {
            throw new IllegalArgumentException("maxSolveSeconds doit être > 0.");
        }
        if (toleranceCookingBeforePlatingMinutes < 0) {
            throw new IllegalArgumentException("toleranceCookingBeforePlatingMinutes doit être >= 0.");
        }
        if (tolerancePlatingBeforeServiceMinutes < 0) {
            throw new IllegalArgumentException("tolerancePlatingBeforeServiceMinutes doit être >= 0.");
        }
        if (horizonPaddingMinutes < 0) {
            throw new IllegalArgumentException("horizonPaddingMinutes doit être >= 0.");
        }
    }
}
