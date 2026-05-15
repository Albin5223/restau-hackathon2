package fr.ultime.restoptim.domain.model;

import java.util.Map;

public record SimulationStats(
        int totalArrivals,
        int totalRejected,
        int totalOrdersPlaced,
        int totalTablesServed,
        int totalClientsServed,
        double avgWaitTimeSec,
        double rejectionRate,
        Map<String, Integer> rejectionReasons,
        Map<String, Long> resourceUsageSeconds
) {}
