package fr.ultime.restoptim.domain.model.job;

public record JobId(String value) {

    public static JobId from(String value){
        return new JobId(value);
    }

    public boolean isBlank() {
        return value == null || value.isBlank();
    }

    public boolean startsWith(String prefix) {
        return value.startsWith(prefix);
    }

    public String substring(int length) {
        return value.substring(length);
    }
}
