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
