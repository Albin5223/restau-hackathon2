package fr.ultime.restoptim.tooling.context;

import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.Optional;

@AllArgsConstructor
@Builder(setterPrefix = "with", toBuilder = true)
public class ApplicationContext {
    private DatabaseContext databaseContext;

    public Optional<DatabaseContext> databaseContext(){
        return Optional.ofNullable(databaseContext);
    }
}
