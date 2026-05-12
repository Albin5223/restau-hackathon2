package fr.ultime.restoptim.domain.spi;

import java.util.List;
import java.util.Optional;

import fr.ultime.restoptim.domain.model.Commande;

public interface Commandes {

    void save(Commande commande);

    Optional<Commande> getCommandeById(String id);

    List<Commande> getActiveCommandes();
}
