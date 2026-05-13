package fr.ultime.restoptim.application.mapper;

import fr.ultime.restoptim.application.dto.TableDto;
import fr.ultime.restoptim.domain.model.table.Table;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class TableMapper {

    public TableDto toDto(Table domain) {
        return TableDto.builder()
                .withId(domain.id().value())
                .withNumber(domain.number())
                .withSeats(domain.seats())
                .withStatus(domain.status().name().toLowerCase(Locale.ROOT))
                .withPartySize(domain.partySize())
                .withOrderId(domain.orderId() == null ? null : domain.orderId().value())
                .build();
    }
}
