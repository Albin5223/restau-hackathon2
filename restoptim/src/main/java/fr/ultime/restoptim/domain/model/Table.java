package fr.ultime.restoptim.domain.model;

public record Table(
        int id,
        int number,
        int seats,
        TableStatus status,
        Integer partySize,
        String orderId) {
}
