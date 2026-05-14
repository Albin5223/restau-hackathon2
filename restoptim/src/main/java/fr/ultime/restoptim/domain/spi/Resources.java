package fr.ultime.restoptim.domain.spi;

import java.util.List;

import fr.ultime.restoptim.domain.model.ResourcePool;

public interface Resources {

    List<ResourcePool> getPools();

    /** Crée un nouveau type de ressource (avec 0 instance). */
    void createType(String name);

    /** Supprime un type. Refusé si le type contient encore des instances. */
    void deleteType(String name);

    /** Ajoute une instance au type donné. */
    void addInstance(String typeName);

    /** Supprime une instance (la plus récente) du type donné. */
    void removeInstance(String typeName);
}
