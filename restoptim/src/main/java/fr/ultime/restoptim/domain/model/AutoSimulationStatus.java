package fr.ultime.restoptim.domain.model;

import java.util.List;

public record AutoSimulationStatus(boolean active, List<AutoSimulationLog> logs) {}
