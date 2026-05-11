package fr.ultime.restoptim.domain.model;

public record SchedulerConfig(
        double maxSolveSeconds,
        int toleranceCookingBeforePlatingMinutes,
        int tolerancePlatingBeforeServiceMinutes,
        int horizonPaddingMinutes) {

    public SchedulerConfig {
        if (maxSolveSeconds <= 0.0) {
            throw new IllegalArgumentException("maxSolveSeconds doit etre > 0.");
        }
        if (toleranceCookingBeforePlatingMinutes < 0) {
            throw new IllegalArgumentException("toleranceCookingBeforePlatingMinutes doit etre >= 0.");
        }
        if (tolerancePlatingBeforeServiceMinutes < 0) {
            throw new IllegalArgumentException("tolerancePlatingBeforeServiceMinutes doit etre >= 0.");
        }
        if (horizonPaddingMinutes < 0) {
            throw new IllegalArgumentException("horizonPaddingMinutes doit etre >= 0.");
        }
    }
}
