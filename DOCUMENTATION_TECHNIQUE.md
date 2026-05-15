# Documentation technique — Restoptim

Jumeau numérique d'un restaurant. Hackathon M2 GENIAL (11–15 mai 2026).

Ce document décrit l'architecture du projet, les instructions d'installation et les sources de données utilisées, **tel que présent dans ce dépôt**.

---

## 1. Vue d'ensemble

Le dépôt contient deux modules indépendants :

```
restau-hackathon2/
├── restoptim/        # Backend Spring Boot 4 (Java 21) — API REST + ordonnanceur
├── front/            # Frontend Next.js 16 (React 19, TypeScript)
├── docker-compose.yml
├── SUJET.md          # Énoncé du hackathon
├── AI_MANIFEST.md    # Manifeste IA (livrable)
└── README.md         # Présentation + auteurs
```

Le frontend consomme exclusivement une API HTTP exposée par `restoptim`. Aucune autre dépendance externe n'est nécessaire au fonctionnement.

L'application permet :

- de gérer un menu, des tables et des ressources de cuisine (CRUD via API + UI) ;
- de placer une commande sur une table et d'obtenir un planning de cuisine ordonnancé par OR-Tools CP-SAT ;
- d'afficher en temps réel un diagramme de Gantt des tâches actives ;
- d'exécuter une simulation automatique du service (arrivées Poisson, sélection aléatoire de plats, libération automatique des tables) ;
- de « voyager dans le temps » manuellement pour observer l'avancement du planning sans attendre.

---

## 2. Backend — `restoptim/`

### 2.1 Stack technique

D'après `restoptim/pom.xml` :

| Élément             | Version           |
| ------------------- | ----------------- |
| Spring Boot         | 4.0.6             |
| Java                | 21                |
| Build               | Maven (wrapper `./mvnw` fourni) |
| Persistance         | SQLite (driver `org.xerial:sqlite-jdbc`) |
| Dialecte JPA        | `org.hibernate.community.dialect.SQLiteDialect` |
| Solveur             | `com.google.ortools:ortools-java` 9.10.4067 |
| Outils              | Lombok, Jackson (databind) |
| Tests               | Spring Boot starter test, `spring-boot-starter-webmvc-test`, H2 (in-memory) |

Point d'entrée : `fr.ultime.restoptim.RestoptimApplication` (`@SpringBootApplication`).

### 2.2 Organisation des packages

Architecture hexagonale sous `fr.ultime.restoptim` :

```
application/
  api/         → Controllers REST (Spring MVC)
  config/      → SchedulerConfiguration, WebConfig (CORS), JacksonConfig
  dto/         → DTOs de transport HTTP (records)
  mapper/      → DTO ↔ domaine
domain/
  api/         → Use cases côté plats (CreateDishUseCase, GetDishesUseCase, …)
  model/       → Entités métier (records)
    dish/      → Dish, DishId, CreateDishRequest
    order/     → Order, OrderId
    table/     → Table, TableId, TableStatus
    task/      → Task, TaskId, TaskType
    job/       → DishJob, JobId
  service/     → OrderService, AutoSimulationService, ResourceService,
                 TimeShiftService, DishService
  spi/         → Interfaces de persistance (Tables, Orders, Dishes, Resources)
infra/
  database/
    repository/ → Implémentations JdbcTemplate des interfaces SPI
    jdbc/       → Requêtes SQL (JdbcDishes)
    mapper/     → Mapping JSON ↔ records (TasksMapper, OrderScheduleJsonMapper,
                  TaskTypeMapper)
    dto/        → DTOs internes JSON (OrderScheduleJsonDto, TasksJsonDto)
scheduler/    → KitchenScheduler (modèle OR-Tools CP-SAT) + TaskVars
```

Les couches communiquent uniquement via interfaces : `application/api` → `domain/service` → `domain/spi` ← `infra/database/repository`. Le scheduler est utilisé directement par `OrderService` et `SchedulerController`.

### 2.3 Modèle de domaine

Records principaux (immuables) :

| Type             | Champs                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `Table`          | `id`, `number`, `seats`, `status`, `partySize`, `orderId`                                  |
| `TableStatus`    | `LIBRE`, `COMMANDE_PASSEE`, `EN_PREPARATION`, `SERVIE` (sérialisation JSON en minuscules) |
| `Dish`           | `id`, `name`, `tasks: List<Task>`                                                          |
| `Task`           | `id`, `name`, `kind`, `resources`, `duration`, `dependencies`                              |
| `TaskType`       | `PREPARATION`, `COOKING`, `PLATING`, `OTHER`                                               |
| `ResourceType`   | `name` (clé naturelle : `commis`, `chef`, `plaque`, `four`, …)                             |
| `ResourcePool`   | `type`, `capacity`                                                                         |
| `DishJob`        | `jobId`, `dish` — instance d'un plat dans une commande                                     |
| `Order`          | `id`, `tableId`, `placedAt`, `dishIds`, `orderSchedule`                                    |
| `OrderRequest`   | `orderId`, `jobs: List<DishJob>`                                                           |
| `OrderSchedule`  | Résultat du scheduler : liste de `ScheduledTask`                                           |
| `ScheduledTask`  | Tâche planifiée (start/end en secondes relatives, ressources, métadonnées)                 |
| `GanttTask`      | Vue temps absolu pour l'UI (`startAt`/`endAt` en ms)                                       |
| `SchedulerConfig`| Paramètres du solveur (cf. `application.yaml`)                                             |

### 2.4 Endpoints REST

CORS configuré sur `/api/**` pour les origines de `app.cors.allowed-origins` (par défaut `http://localhost:3000,https://restoptim.albin-paris.fr`) — méthodes GET/POST/PUT/PATCH/DELETE/OPTIONS.

#### `/api/dishes` — `DishController`

| Méthode | Chemin                | Effet                                                         |
| ------- | --------------------- | ------------------------------------------------------------- |
| GET     | `/api/dishes`         | Liste tous les plats (DTO).                                   |
| GET     | `/api/dishes/{id}`    | Détail d'un plat.                                             |
| POST    | `/api/dishes`         | Crée un plat (`name`, `tasks`).                               |
| PUT     | `/api/dishes/{id}`    | Met à jour un plat.                                           |
| DELETE  | `/api/dishes/{id}`    | Supprime un plat.                                             |
| POST    | `/api/dishes/import`  | Import en lot (transactionnel) d'une liste de plats.          |

Erreurs : `400 BAD_REQUEST` si `name` vide ou `tasks` absent / liste vide.

#### `/api/tables` — `TableController`

| Méthode | Chemin                       | Effet                                                                 |
| ------- | ---------------------------- | --------------------------------------------------------------------- |
| GET     | `/api/tables`                | Liste des tables.                                                     |
| GET     | `/api/tables/{id}`           | Détail.                                                               |
| POST    | `/api/tables`                | Création (`seats`).                                                   |
| PATCH   | `/api/tables/{id}`           | Met à jour `seats` (table doit être LIBRE).                           |
| DELETE  | `/api/tables/{id}`           | Suppression (table doit être LIBRE).                                  |
| POST    | `/api/tables/{id}/install`   | Installe un groupe (`partySize`) — table doit être LIBRE.             |
| POST    | `/api/tables/{id}/release`   | Libère la table (clôture la commande si présente).                    |
| POST    | `/api/tables/{id}/serve`     | Passe la table à l'état `SERVIE`.                                     |

Toutes les opérations mutatives renvoient `423 LOCKED` si la simulation automatique est active (`AutoSimulationService.isActive()`).

#### `/api/orders` — `OrderController`

| Méthode | Chemin        | Effet                                                                                                  |
| ------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| POST    | `/api/orders` | Place une commande : `tableId`, `dishIds: List<Long>`, `speedMultiplier?` (optionnel, défaut 1.0).     |

Codes de retour :

- `200` + `OrderResultDto` (id de commande, numéro de table, instant de service, tâches planifiées) ;
- `400` si `dishIds` vide, `409` si table indisponible, `423` si simulation auto active.

#### `/api/schedule` — `SchedulerController`

| Méthode | Chemin           | Effet                                                                                            |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| POST    | `/api/schedule`  | Planifie un lot de plats sans les enregistrer en base. Body : `{ orderId?, dishIds: List<Long> }`. |

Erreurs : `400` si liste vide ou plat introuvable, `422` si le solveur ne trouve pas de solution.

#### `/api/cuisine` — `CuisineController`

| Méthode | Chemin               | Effet                                                                  |
| ------- | -------------------- | ---------------------------------------------------------------------- |
| GET     | `/api/cuisine/gantt` | Renvoie toutes les tâches actives (`GanttTask`) + `generatedAt` (ms). |

#### `/api/resources` — `ResourceController`

| Méthode | Chemin                                    | Effet                                                        |
| ------- | ----------------------------------------- | ------------------------------------------------------------ |
| GET     | `/api/resources`                          | Liste des types (`name`, `capacity`).                        |
| GET     | `/api/resources/usage`                    | Pic de demande par type pour les commandes actives.          |
| POST    | `/api/resources`                          | Crée un nouveau type (`name`).                               |
| DELETE  | `/api/resources/{name}`                   | Supprime un type (refusé si encore utilisé).                 |
| POST    | `/api/resources/{name}/instances`         | Ajoute une instance.                                         |
| DELETE  | `/api/resources/{name}/instances`         | Retire une instance (refusé si pic > capacité résultante).   |

#### `/api/simulation/auto` — `AutoSimulationController`

| Méthode | Chemin                            | Effet                                                                                                                 |
| ------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET     | `/api/simulation/auto/status`     | `{ active, logs }`.                                                                                                   |
| POST    | `/api/simulation/auto/start`      | Body : `{ durationMin, arrivalRatePerHour, avgPartySize, speedMultiplier? }`. Renvoie `409` si déjà active.            |
| POST    | `/api/simulation/auto/stop`       | Arrête la simulation et libère toutes les tables.                                                                     |

#### `/api/time` — `TimeController`

| Méthode | Chemin              | Effet                                                                                       |
| ------- | ------------------- | ------------------------------------------------------------------------------------------- |
| GET     | `/api/time`         | `{ offsetMs, autoSimulationActive }`.                                                       |
| POST    | `/api/time/shift`   | Décale l'horloge perçue de `deltaSec` secondes. Refusé (`423`) si simulation auto active.   |
| POST    | `/api/time/reset`   | Remet l'offset à 0.                                                                         |

### 2.5 Ordonnanceur — `scheduler/KitchenScheduler.java`

Solveur OR-Tools **CP-SAT** (`CpModel` / `CpSolver`). Stratégie documentée dans le code source :

- Une commande est composée d'un ou plusieurs `DishJob` ; chaque job déroule les `Task` du plat selon leurs dépendances.
- Toutes les commandes **actives** (statut `EN_PREPARATION`) sont re-planifiées ensemble dans un seul modèle CP-SAT à chaque nouvelle commande.
- Les tâches **en cours d'exécution** sont matérialisées par des `OccupiedInterval` fixes (non re-planifiables), ce qui garantit la cohérence avec ce qui a déjà commencé en cuisine.
- Les tâches **en attente** sont re-optimisées librement, sous contraintes :
  - **Précédence** : chaque tâche commence après la fin de ses dépendances ;
  - **Capacité par ressource** : `CumulativeConstraint` par `ResourceType` avec la capacité issue de la base ;
  - **Dressage en dernier** : toutes les tâches non-dressage d'un job finissent avant le début du dressage ;
  - **Cuisson avant dressage (dure)** : la fin de cuisson précède le début du dressage ;
  - **Délai cuisson→dressage (douce)** : minimisé via une variable `gap` ajoutée à l'objectif ;
  - **Synchronisation table** : fenêtre dans laquelle tous les dressages d'une commande se terminent (paramètre `tolerance-plating-before-service-seconds`).
- Fonction objectif pondérée (`SchedulerConfig`) :
  - `objectiveWeightServiceTime` (poids 1000 par défaut) : temps de service total ;
  - `objectiveWeightServiceGap` (50 par défaut) : écart entre premier et dernier dressage par commande ;
  - `objectiveWeightCookingGap` (50/1 selon le fichier) : délai cuisson→dressage.
- Temps de résolution borné par `max-solve-seconds` (5s par défaut).
- Horizon temporel calculé à partir des durées + `horizon-padding-seconds` (900s).

### 2.6 Services métier

- **`OrderService`** (`@Transactional`) : prise de commande. Vérifie l'état de la table, construit les `DishJob` (durées multipliées par `1/speedMultiplier`), récupère les commandes actives et leurs tâches verrouillées, lance `scheduler.scheduleAll(...)`, met à jour les plannings des commandes existantes et persiste la nouvelle. Expose également `getAllActiveGanttTasks()` consommé par `/api/cuisine/gantt`.
- **`AutoSimulationService`** : simulation à événements discrets pilotée par un `ScheduledExecutorService` mono-thread.
  - Inter-arrivées tirées selon une loi exponentielle de paramètre λ = `arrivalRatePerHour / 3 600 000` ms (processus de Poisson).
  - Taille de groupe uniforme sur `[1, min(avgPartySize*2, 8)]`.
  - À l'arrivée : recherche de la plus petite table libre dont `seats >= partySize` ; refus si aucune table éligible (log `rejected`).
  - Sélection aléatoire des plats dans le menu courant.
  - Polling toutes les 2 s : si tous les dressages d'une commande sont terminés, la table passe à `SERVIE` puis est libérée après un temps de repas simulé tiré uniformément dans `[20, 40]` minutes.
  - Bloque les opérations manuelles via le drapeau `active` consulté par les autres controllers.
  - Journalisation circulaire (200 logs max) consultable via `/api/simulation/auto/status`.
- **`ResourceService`** : garde-fous métier autour de l'interface `Resources` (refus de retirer une instance qui passerait la capacité en deçà du pic des commandes actives, refus de supprimer un type encore utilisé). Calcule le pic par balayage (« sweep ») d'événements +1/−1 sur les intervalles planifiés futurs.
- **`TimeShiftService`** : « voyage temporel » manuel. Décale les `placed_at` de toutes les commandes actives (`shiftActiveOrdersPlacedAt`) et conserve un offset cumulé. Réinitialisé automatiquement au démarrage de la simulation automatique.
- **`DishService`** + use cases `CreateDishUseCase`, `GetDishesUseCase`, `GetDishByIdUseCase`, `UpdateDishUseCase`, `DeleteDishUseCase`, `ImportDishesUseCase` : opérations CRUD sur le menu, branchées sur `Dishes` SPI.

### 2.7 Persistance

Implémentations `JdbcTemplate` dans `infra/database/repository/` :

- `DishRepository implements Dishes` — table `recipe_documents`, colonne `tasks` au format JSON (sérialisation via `TasksMapper`).
- `TableRepository implements Tables` — table `restaurant_tables` ; la suppression d'une table purge en cascade `commande_items` puis `commandes`.
- `OrderRepository implements Orders` — tables `commandes` (`status ∈ {EN_PREPARATION, TERMINEE}`) et `commande_items` (lignes ordonnées par `position`). Champ `schedule` au format JSON (mapping `OrderScheduleJsonMapper`).
- `ResourceRepository implements Resources` — agrégation `resource_types` + `resources` (instances) ; capacité = nombre de lignes `resources` par type.

Initialisation des données : `spring.sql.init.mode=always` lit `schema-sqlite.sql` puis `data-sqlite.sql` au démarrage. JPA est en `ddl-auto: none`.

### 2.8 Configuration

`restoptim/src/main/resources/application.yaml` :

- `app.cors.allowed-origins` — origines autorisées.
- `restoptim.scheduler.*` — paramètres du solveur (cf. §2.5). Tous bindés via `SchedulerConfiguration` → bean `SchedulerConfig`.
- Logger applicatif en `DEBUG` pour `fr.ultime.restoptim`.

Profil `hom` (`application-hom.yaml`) — utilisé par le `CMD` du Dockerfile :

- `spring.datasource.url=jdbc:sqlite:./data/restoptim.db`
- `spring.datasource.hikari.connection-init-sql=PRAGMA foreign_keys=ON`
- Schéma + données rechargés à chaque démarrage (`mode: always`).

### 2.9 Tests

`restoptim/src/test/java/fr/ultime/restoptim/` :

- `RestoptimApplicationTests` — smoke test de chargement de contexte.
- `controller/` — tests d'intégration MVC (`CreateDishControllerIT`, `GetDishesControllerIT`) annotés via `IntegrationTestContext` (combinaison `ApplicationContext` + `DatabaseContext`).
- `tooling/` — utilitaires de test : modèles allégés (`tooling/model/Dish`, `tooling/model/Task`), repository de test (`DishesTestRepository`), service de sérialisation de tâches (`TestTaskSerializationService`).
- `application-test.yaml` + `schema-h2.sql` — profil H2 in-memory pour les tests.

---

## 3. Frontend — `front/`

### 3.1 Stack technique

D'après `front/package.json` :

| Élément        | Version                  |
| -------------- | ------------------------ |
| Next.js        | 16.2.6 (App Router)      |
| React          | 19.2.4                   |
| TypeScript     | ^5                       |
| Tailwind CSS   | v4 (`@tailwindcss/postcss`) |
| ESLint         | ^9 + `eslint-config-next` |
| Bibliothèques  | `@xyflow/react` 12.3 (éditeur de graphe de recettes), `react-markdown` 10 + `remark-gfm` 4 (rendu des réponses du chatbot expérimental) |

`front/AGENTS.md` (et `front/CLAUDE.md` qui y renvoie) précise que cette version de Next.js comporte des breaking changes par rapport aux versions antérieures.

### 3.2 Arborescence

```
front/
├── src/
│   ├── app/                # App Router
│   │   ├── layout.tsx      # Sidebar + providers globaux
│   │   ├── page.tsx        # / (Vue d'ensemble)
│   │   ├── cuisine/        # /cuisine
│   │   ├── salle/          # /salle
│   │   ├── menu/           # /menu
│   │   ├── ressources/     # /ressources
│   │   ├── tables/         # /tables (lien commenté dans la sidebar)
│   │   └── simulation/     # /simulation
│   ├── app/
│   │   └── api/
│   │       └── chat/route.ts        # Route serveur Next.js — proxy Mistral (expérimental)
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── PageHeader.tsx
│   │   ├── GanttChart.tsx           # Gantt SVG mesuré via ResizeObserver
│   │   ├── FloorPlanView.tsx        # Plan de salle
│   │   ├── RecipeGraphEditor.tsx    # Éditeur de DAG (@xyflow/react)
│   │   ├── RecipesProvider.tsx      # Cache + invalidation des plats
│   │   ├── ResourcesProvider.tsx    # Cache des types de ressources
│   │   ├── TimeProvider.tsx         # Offset temporel client
│   │   ├── TimeTravelControls.tsx   # Boutons +5 min / +30 s / reset
│   │   └── ChatBubble.tsx           # Bulle de chat flottante (expérimental)
│   ├── public/
│   │   └── sounds/
│   │       └── dehors.mp3           # Effet sonore lors d'une libération massive de tables
│   └── lib/
│       ├── api.ts          # Client HTTP typé
│       ├── types.ts        # Types alignés sur le backend
│       ├── floorPlan.ts    # Géométrie du plan de salle
│       ├── recipes.ts      # Helpers menu (missingResources, …)
│       ├── format.ts       # Formatage durées / horaires
│       ├── sounds.ts       # Helper de lecture audio (releaseAll)
│       └── chat-tools.ts   # Définitions + exécuteurs des outils du chatbot (expérimental)
├── Dockerfile              # dev (next dev)
├── Dockerfile.prod
└── next.config.ts
```

### 3.3 Routes UI

| Route          | Fichier                       | Rôle                                                                 |
| -------------- | ----------------------------- | -------------------------------------------------------------------- |
| `/`            | `app/page.tsx`                | Vue d'ensemble.                                                      |
| `/cuisine`     | `app/cuisine/page.tsx`        | Diagramme de Gantt des tâches actives (`GET /api/cuisine/gantt`).    |
| `/salle`       | `app/salle/page.tsx`          | Plan de salle (`FloorPlanView`) + actions sur les tables.            |
| `/menu`        | `app/menu/page.tsx`           | CRUD des plats avec `RecipeGraphEditor`.                             |
| `/ressources`  | `app/ressources/page.tsx`     | Gestion des types/instances + indication des plats indisponibles.    |
| `/simulation`  | `app/simulation/page.tsx`     | Lancement de la simulation automatique + commande manuelle + Gantt.  |
| `/tables`      | `app/tables/page.tsx`         | Page tables (lien désactivé dans la sidebar).                        |

### 3.4 Communication avec le backend

- Base URL : `process.env.NEXT_PUBLIC_API_URL` ou `http://localhost:8080` par défaut (`src/lib/api.ts`).
- Toutes les requêtes passent par un helper `request<T>` qui lève `ApiError` sur statut non-2xx.
- Client typé exposant les sous-modules `dishes`, `tables`, `orders`, `cuisine`, `resources`, `time`, `simulation`.
- Le statut de la simulation auto est polling toutes les 5 s par la `Sidebar` ; la page `/simulation` et la page `/cuisine` rafraîchissent leurs données plus fréquemment.

### 3.5 Composants notables

- **`GanttChart`** — diagramme SVG mesuré à l'exécution (`ResizeObserver`). Filtres par ressource/table. Auto-gère l'état vide sans dépendance du parent.
- **`FloorPlanView`** — rendu du plan de salle avec disposition calculée dans `lib/floorPlan.ts`.
- **`RecipeGraphEditor`** — éditeur de graphe de dépendances entre étapes d'un plat, basé sur `@xyflow/react`.
- **`RecipesProvider` / `ResourcesProvider` / `TimeProvider`** — contextes React qui mettent en cache les listes côté client et exposent un `refresh()` pour ré-interroger l'API après une mutation.
- **`TimeTravelControls`** — boutons calant l'horloge perçue (`POST /api/time/shift`) ; masqués pendant la simulation automatique.

### 3.6 Assistant conversationnel (expérimentation)

> ⚠️ **Statut : expérimentation**, hors livrable hackathon. Désactivé automatiquement si `MISTRAL_API_KEY` est absente ou si l'API Mistral renvoie `401/402/403/429` ; le bouton est alors masqué côté UI.

**Composants** : `ChatBubble.tsx` (bulle flottante + rendu Markdown), `app/api/chat/route.ts` (proxy Mistral, boucle `tool_calls` max 6), `lib/chat-tools.ts` (définition et exécution des outils).

**Modèle** : `mistral-small-latest` (format compatible OpenAI, `tool_choice: "auto"`).

**Outils exposés au LLM** :

| Outil | Type | Backend |
| --- | --- | --- |
| `get_tables` / `get_gantt` / `get_dishes` / `get_resources` / `get_simulation_status` | lecture | `GET /api/...` |
| `place_order` | mutation | `POST /api/orders` |
| `release_table` | mutation | `POST /api/tables/{id}/release` |

Les mutations héritent du verrou backend `423 LOCKED` pendant la simulation automatique. Les timestamps epoch ms renvoyés par les tools sont enrichis d'un champ `<nom>Formatted` (`HH:mm:ss`) ; le system prompt interdit l'affichage du brut.

**Configuration** — fichier `.env` à la racine (gitignored, injecté via `env_file:` dans `docker-compose.yml`) :

```
MISTRAL_API_KEY=...
INTERNAL_API_URL=...
```

`INTERNAL_API_URL` dépend du mode :

| Mode | Valeur |
| --- | --- |
| Docker Compose (front + back) | `http://restoptim:8080` |
| Front Docker + back local | `http://host.docker.internal:8080` |
| Tout en local | `http://localhost:8080` |

`GET /api/chat` renvoie `{ available, reason }` — consulté à l'init du composant pour masquer la bulle si indisponible.

**Limites** : pas d'auth ni rate-limiting interne, pas de garde-fou sur les mutations LLM au-delà du system prompt, coût/latence dépendants de Mistral, état de désactivation conservé en mémoire (perdu au redémarrage).

---

## 4. Installation

### 4.1 Avec Docker (recommandé)

Prérequis : Docker + Docker Compose.

```bash
docker compose up -d --build
```

`docker-compose.yml` lance deux services :

| Service     | Image                | Port  | Profil Spring | Notes                                                                                  |
| ----------- | -------------------- | ----- | ------------- | -------------------------------------------------------------------------------------- |
| `front`     | `restoptim-front`    | 3000  | —             | `next dev` ; volumes montés pour hot-reload ; `env_file: .env` (racine projet).        |
| `restoptim` | `restoptim-backend`  | 8080  | `hom`         | `mvn spring-boot:run` ; volume `./restoptim/data`.                                     |

Plateforme imposée : `linux/amd64`.

UI accessible sur <http://localhost:3000>, API sur <http://localhost:8080>.

**Variables d'environnement** (optionnelles, uniquement pour activer le chatbot expérimental — cf. §3.6) :

Créer un fichier `.env` à la racine du projet (gitignored) :

```
MISTRAL_API_KEY=...
INTERNAL_API_URL=http://restoptim:8080
```

Le redémarrage du conteneur `front` est requis après modification (`docker compose restart front`).

### 4.2 Sans Docker

Prérequis : Java 21+, Maven (ou wrapper `./mvnw` fourni), Node.js 20+, npm.

```bash
# Terminal 1 — Backend
cd restoptim
./mvnw spring-boot:run
```

Le backend crée par défaut la base SQLite sous `restoptim/data/restoptim.db` (chemin défini par le profil `hom` ; en mode par défaut sans datasource configurée, la base est créée en mémoire ou nécessite une configuration locale).

```bash
# Terminal 2 — Frontend
cd front
npm install
npm run dev
```

Variable d'environnement optionnelle côté front : `NEXT_PUBLIC_API_URL` (défaut `http://localhost:8080`).

### 4.3 Commandes utiles

```bash
# Backend
./mvnw test               # tests JUnit 5
./mvnw package            # jar exécutable

# Frontend
npm run build             # build de production
npm run lint              # ESLint
```

---

## 5. Sources de données

### 5.1 Schéma SQLite

`restoptim/src/main/resources/schema-sqlite.sql` définit 5 tables :

```sql
recipe_documents(id PK, name UNIQUE, tasks JSON)
resource_types  (resource_type_id PK, name UNIQUE)
resources       (resource_id PK, resource_type FK → resource_types)
restaurant_tables(id PK, number UNIQUE, seats, status DEFAULT 'LIBRE',
                  party_size, commande_id)
commandes       (id PK TEXT, table_id FK → restaurant_tables, placed_at,
                 schedule JSON, status DEFAULT 'EN_PREPARATION')
commande_items  (id PK, commande_id FK → commandes, dish_id FK → recipe_documents,
                 position)
```

Schéma de test équivalent en H2 dans `restoptim/src/test/resources/schema-h2.sql`.

### 5.2 Jeu de données initial

`restoptim/src/main/resources/data-sqlite.sql` (rejoué à chaque démarrage) :

**4 types de ressources** (`resource_types`) :

| id | name     |
| -- | -------- |
| 1  | commis   |
| 2  | chef     |
| 3  | plaque   |
| 4  | four     |

**7 instances de ressources** (`resources`) : 2 commis, 1 chef, 3 plaques, 1 four.

**8 tables** (`restaurant_tables`) : 2/2/4/4/6/2/4/8 couverts, toutes `LIBRE`.

**15 plats** (`recipe_documents`), chacun stocké avec son DAG d'étapes au format JSON (clés : `nom`, `kind ∈ {PREPARATION, COOKING, PLATING}`, `ressource[]`, `duree` en secondes, `deps[]` en indices) :

| id | nom                                       |
| -- | ----------------------------------------- |
| 1  | Magret de canard                          |
| 2  | Coquilles Saint-Jacques                   |
| 3  | Bœuf bourguignon                          |
| 4  | Risotto à la truffe                       |
| 5  | Loup en croûte de sel                     |
| 6  | Filet mignon aux champignons sauvages     |
| 7  | Côte de veau aux truffes                  |
| 8  | Agneau rôti aux épices                    |
| 9  | Turbot sauvage à la meunière              |
| 10 | Saumon fumé aux betteraves                |
| 11 | Bar rayé en croûte d'herbes               |
| 12 | Homard thermidor                          |
| 13 | Langoustines à l'ail et citron            |
| 14 | Moules marinière sauce safran             |
| 15 | Champignons de Paris rôtis en croûte      |

### 5.3 Format d'import de plats

`restoptim/src/main/resources/recipe-import-example.json` donne le format consommé par `POST /api/dishes/import` : tableau d'objets `{ name, tasks: [{ nom, resources[], kind, duration, dependencies[] }] }`. Les indices `dependencies` référencent les positions dans le tableau `tasks` (0-based).

> Note : le format JSON stocké en base (`tasks` dans `recipe_documents`) utilise les clés françaises (`ressource`, `duree`, `deps`, `etapes`) tandis que l'API d'import utilise les clés anglaises (`resources`, `duration`, `dependencies`). Le mapping est assuré par `TasksMapper` côté infra et `CreateDishRequestMapper` côté application.

### 5.4 Données runtime

- Le champ `schedule` de `commandes` contient le `OrderSchedule` produit par le scheduler (sérialisé par `OrderScheduleJsonMapper`).
- Aucune source externe n'est interrogée par le **cœur métier** du backend : les ressources, plats, tables et commandes restent les seuls référentiels utilisés pour l'ordonnancement et la simulation.
- **Exception** : le chatbot expérimental (§3.6), s'il est configuré, effectue des appels sortants vers l'API Mistral (`https://api.mistral.ai/v1/chat/completions`) depuis la route serveur Next.js `/api/chat`. Ces appels sont initiés uniquement par interaction utilisateur et n'alimentent jamais la base de données.
