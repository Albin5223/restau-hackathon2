# Restau-Hackathon2 — Jumeau numérique d'un restaurant

Hackathon M2 GENIAL (11–15 mai 2026). Voir `SUJET.md` pour l'énoncé complet.

## Objectif

Construire un jumeau numérique de restaurant capable :
- d'aider à la gestion des commandes en temps réel (préparation, cuisson, dressage avec contrainte « tous les plats d'une table servis chauds en même temps ») ;
- de simuler le restaurant en boucle fermée (générateur de commandes type Poisson) pour mesurer la performance ;
- éventuellement de fonctionner comme jeu vidéo de simulation.

Briques techniques attendues : *job-shop scheduling* (OR-Tools), simulation à événements discrets, file d'événements ordonnée par timestamp.

## Architecture du dépôt

```
.
├── front/        # UI Next.js 16 + React 19 + Tailwind v4 (TypeScript)
├── restoptim/    # Backend Spring Boot 4 (Java 21) + JPA/SQLite + OR-Tools
├── SUJET.md      # Énoncé du hackathon
└── README.md     # Liste des auteurs
```

Les deux modules sont indépendants : le front consomme une API HTTP exposée par `restoptim`.

## Backend — `restoptim/`

- **Spring Boot 4.0.6**, **Java 21**, build Maven (`./mvnw`).
- Dépendances clés : `spring-boot-starter-webmvc`, `spring-boot-starter-data-jpa`, `sqlite-jdbc` (runtime), `lombok`, **`ortools-java` 9.10.4067** (pour le scheduling job-shop).
- Package racine : `fr.ultime.restoptim` (entrée : `RestoptimApplication.java`).
- Config : `src/main/resources/application.yaml` (à étendre pour SQLite : `spring.datasource.url=jdbc:sqlite:...`, dialecte JPA communautaire).
- Tests : JUnit 5 via `spring-boot-starter-webmvc-test` et `spring-boot-starter-data-jpa-test`.

Commandes utiles :
```bash
cd restoptim
./mvnw spring-boot:run         # lancer l'API
./mvnw test                    # tests
./mvnw package                 # build du jar
```

Notes :
- OR-Tools embarque des libs natives par plateforme — vérifier la résolution sur macOS arm64 au premier lancement.
- Lombok est annotation processor : éviter de désactiver l'`annotationProcessorPaths` du `maven-compiler-plugin`.

## Frontend — `front/`

- **Next.js 16.2.6** (App Router, `src/app/`), **React 19.2.4**, **Tailwind CSS v4** (`@tailwindcss/postcss`).
- TypeScript strict, alias `@/* → ./src/*`.
- ⚠️ Voir `front/AGENTS.md` : « This is NOT the Next.js you know ». Next.js 16 a des breaking changes par rapport aux versions antérieures (params async, caching par défaut, etc.). **Avant d'écrire du code Next.js, consulter `front/node_modules/next/dist/docs/` plutôt que la mémoire d'entraînement.** Tenir compte des deprecation notices.

Commandes utiles :
```bash
cd front
npm install
npm run dev                    # http://localhost:3000
npm run build
npm run lint
```

## Conventions et garde-fous

- Le code doit refléter le vocabulaire métier du sujet : `Table`, `Commande`, `Plat`, `Étape` (préparation/cuisson/dressage), `Ressource` (commis, chef, plaque, four), `Service`, etc.
- Pour l'ordonnancement : commencer par une heuristique simple alignant les fins de cuisson par table, puis envisager OR-Tools CP-SAT pour la version optimisée. Optimalité non requise — heuristiques raisonnables acceptées.
- Simulation à événements discrets : file de priorité ordonnée par timestamp ; ne jamais avancer le temps par incréments fixes.
- Générateur de commandes : arrivées suivant un **processus de Poisson**, taille de groupe aléatoire, refus si pas de table disponible adaptée.
- Hors-scope explicite (ne pas implémenter) : réservations, prix/encaissement, RH, approvisionnement, cave.

## Livrables à produire

1. Manifeste IA (outils, prompts, ce qui est généré, comment c'est intégré).
2. Logiciel fonctionnel.
3. Doc technique : README avec install, architecture, sources de données.
4. Présentation orale 10 min + démo (vendredi 15h30).

Évaluation : cohérence d'architecture > algorithmique (job-shop + DES) > fonctionnel > travail d'équipe > présentation. Esthétique = critère mineur.
