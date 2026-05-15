# Jumeau numérique d'un restaurant

Hackathon M2 GENIAL

## Auteurs

- PARIS Albin
- YAZICI Servan
- LAIDOUNI Mohamed
- FRIEDMANN Eliot
- TALAGRAND Alban
- GROULT Romain

## Présentation du projet

Ce projet est un jumeau numérique de restaurant : un système qui modélise l'état d'un restaurant en temps réel et permet d'optimiser la préparation des commandes en cuisine.

Il repose sur deux briques algorithmiques principales :

- **Job-shop scheduling** (OR-Tools CP-SAT) : planification optimale des tâches de préparation/cuisson/dressage sur les ressources cuisine, avec plusieurs contraintes (les plats d'une même table doivent être servis en même temps, ressources partagées,...).
- **Simulation à événements discrets** : simulation d'un service complet avec arrivées de clients selon un processus de Poisson, pour mesurer les performances du restaurant en boucle fermée.

## Architecture

```txt
restau-hackathon2/
├── restoptim/    # Backend Spring Boot
└── front/        # Frontend Next.js
```

### Backend — `restoptim/`

**Stack :** Spring Boot, Java 21, Maven, SQLite (H2 pour tests), OR-Tools

Architecture hexagonale :

```txt
api/           → Contrôleurs REST (HTTP in/out)
domain/
  model/       → Entités métier (Table, Order, Dish, Task, ResourcePool…)
  service/     → Logique métier (OrderService, AutoSimulationService)
  spi/         → Interfaces de persistance
infra/
  database/    → Implémentations JPA (SQLite)
scheduler/     → Solveur CP-SAT (KitchenScheduler)
```

Composants clés :

| Classe                  | Rôle                                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KitchenScheduler`      | Solveur OR-Tools CP-SAT : planifie les tâches de toutes les commandes actives en respectant les dépendances de recettes, les capacités des ressources, et la contrainte de synchronisation des dressages |
| `OrderService`          | Orchestre la prise de commande et la re-planification dynamique : à chaque nouvelle commande, les tâches en cours sont verrouillées et toutes les tâches en attente sont re-optimisées ensemble          |
| `AutoSimulationService` | Simulation à événements discrets : arrivées Poisson, attribution de tables, passation automatique des commandes, détection de fin de service, libération des tables                                      |

### Frontend — `front/`

**Stack :** Next.js, React, TypeScript

Pages principales :

| Route         | Contenu                                                            |
| ------------- | ------------------------------------------------------------------ |
| `/`           | Dashboard général                                                  |
| `/salle`      | Plan de salle, état des tables en temps réel                       |
| `/menu`       | Gestion du menu (plats, étapes, durées)                            |
| `/cuisine`    | Interface cuisine avec éditeur de recettes (graphe de dépendances) |
| `/simulation` | Simulation manuelle (commande + Gantt) et automatique (Poisson)    |

Composants clés : `GanttChart` (diagramme de Gantt filtrable), `FloorPlanView` (plan de salle interactif), `RecipeGraphEditor` (éditeur de DAG de tâches).

### Communication

Le frontend interroge le backend via REST + polling toutes les 2 secondes pour les états en temps réel (simulation auto, état des tables).

API principale exposée sur `http://localhost:8080`.

## Installation

### Avec Docker (recommandé)

**Prérequis :** Docker et Docker Compose

```bash
docker compose up -d --build
```

### Sans Docker

**Prérequis :** Java 21+, Maven (ou le wrapper `./mvnw` inclus), Node.js 20+ et npm

Ouvrir deux terminaux :

```bash
# Terminal 1 — Backend
cd restoptim
mvn clean package
mvn spring-boot:run
```

```bash
# Terminal 2 — Frontend
cd front
npm install
npm run dev
```

L'application est ensuite accessible depuis [http://localhost:3000](http://localhost:3000)

## Sources de données

Données artificielles générées par AI. pour les tests (voir le prompt dans le manifeste IA).

---

## Features

### Jumeau numérique / Modèle

- [x] Modélisation des tables (nombre, capacité)
- [x] Modélisation du menu (plats principaux)
- [x] Modélisation des étapes par plat (préparation / cuisson / dressage)
- [x] Modélisation des ressources cuisine (commis, chef, plaque, four)
- [x] Persistance de l'état (base de données)

### Ordonnancement (job-shop scheduling)

- [x] Planification des tâches par commande (contraintes de dépendance de recette)
- [x] Contrainte « tous les plats d'une table servis en même temps » (synchronisation du dressage)
- [x] Prise en compte des ressources partagées (contraintes cumulatives)
- [x] Re-planification dynamique à l'arrivée d'une nouvelle commande
- [x] Optimisation via OR-Tools CP-SAT

### Interface cuisine

- [x] Diagramme de Gantt (visualisation du planning)
- [x] Affichage des moments de début/fin de chaque étape
- [ ] Alarmes / signalement des actions à faire
- [x] Filtrage par type de tâche (cuisson, dressage, préparation…)
- [ ] Confirmation/correction des temps par les cuisiniers

### Interface salle / commandes

- [x] Affichage du plan de salle
- [x] Prise de commande par table
- [x] Suivi de l'état des tables (libre / commande passée / en préparation / servie)

### Interface configuration / menu

- [x] Gestion du menu (ajout/modification de plats)
- [x] Éditeur de recettes avec graphe de dépendances de tâches
- [x] Configuration des ressources cuisine
- [x] Import du menu

### Simulation en boucle fermée

- [x] Générateur d'arrivées Poisson (λ paramétrable)
- [x] Taille de groupe aléatoire
- [x] Refus des clients si aucune table disponible adaptée
- [x] Multiplicateur de vitesse (compression du temps)
- [x] Log des événements en temps réel (arrivée, commande, service, refus)
- [ ] Mesure des performances (temps d'attente, taux de remplissage…)

### Simulation manuelle

- [x] Placement manuel d'une commande sur une table
- [x] Visualisation immédiate du planning Gantt résultant


