package fr.ultime.restoptim.application.dto;

import lombok.Builder;

@Builder(setterPrefix = "with")
public record TableDto(
        long id,
        int number,
        int seats,
        String status,
        Integer partySize,
        String orderId) {
}
