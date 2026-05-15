package fr.ultime.restoptim.domain.model;

public record SimTimePoint(
        long elapsedSimSec,
        int arrivals,
        int ordersPlaced,
        int tablesServed,
        int rejected,
        double avgWaitSec
) {}
