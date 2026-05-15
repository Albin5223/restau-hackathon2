package fr.ultime.restoptim.domain.model;

public record SimTimePoint(
        long elapsedSimSec,
        int ordersInKitchen,
        int tablesOccupied,
        int totalArrivals,
        int totalRejected,
        double avgWaitSec
) {}
