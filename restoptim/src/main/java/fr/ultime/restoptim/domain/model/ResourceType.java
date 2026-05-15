package fr.ultime.restoptim.domain.model;

public record ResourceType(String name) {
    public static ResourceType from(String name) {
        return new ResourceType(name);
    }
}
