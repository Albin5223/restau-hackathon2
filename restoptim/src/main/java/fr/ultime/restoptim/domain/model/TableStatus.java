package fr.ultime.restoptim.domain.model;

import java.util.Locale;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum TableStatus {
    LIBRE,
    COMMANDE_PASSEE,
    EN_PREPARATION,
    SERVIE;

    @JsonValue
    public String toJson() {
        return name().toLowerCase(Locale.ROOT);
    }

    @JsonCreator
    public static TableStatus fromJson(String value) {
        return valueOf(value.toUpperCase(Locale.ROOT));
    }
}
