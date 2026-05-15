# Manifeste IA — Jumeau numérique d'un restaurant

---

## Outils utilisés

| Outil                    | Usage principal                                            |
| ------------------------ | ---------------------------------------------------------- |
| **Claude Code** (Sonnet) | Génération de données et MVP frontend, debuggage d'issues. |

---

## Ce qui a été généré ou assisté par IA

### Données de test (menu)

Les données de menu (plats, étapes, durées, ressources nécessaires) ont été générées par IA :

```txt
Génère un menu de restaurant bistrot avec plusieurs plats principaux, sans entrée ou dessert. Pour chaque plat, fournis les étapes cuisine (préparation, cuisson, dressage) avec leur durée en secondes et les ressources nécessaires parmi : COMMIS, CHEF, PLAQUE, FOUR. Respecte des durées réalistes. Inspire toi des plats existants dans la base de données.
```

Les données ont été intégrées comme données d'initialisation de la base SQLite.

### Débuggage d'issues et correction

Exemple d'issue débugguée avec l'aide de l'IA :

```txt
Le diagramme de Gantt dans l'onglet Cuisine (/cuisine) n'affiche plus la planification correctement : toutes les barres apparaissent empilées à l'extrême gauche au lieu d'être positionnées sur la timeline. Le même composant GanttChart (front/src/components/GanttChart.tsx) fonctionne pourtant correctement dans l'onglet Simulation (/simulation). La régression date du dernier commit (Gantt scaled in pixels) qui a remplacé un positionnement en pourcentages par un positionnement en pixels via un ResizeObserver. Stack : Next.js 16 App Router, React 19, TypeScript, backend Spring Boot 4 exposant GET /api/cuisine/gantt. Trouve la cause racine de la différence de comportement entre les deux pages, et propose une correction.


Le fix précédent a été appliqué dans la page consommatrice cuisine/page.tsx en rendant GanttChart conditionnellement (seulement quand steps.length > 0). Mais ce pattern devrait déjà être géré en interne par GanttChart, qui possède son propre état vide. Refactore le composant GanttChart.tsx pour que la logique de mesure du DOM fonctionne quelle que soit la façon dont il est monté — avec ou sans données initiales — sans que les pages qui l'utilisent (cuisine/page.tsx, simulation/page.tsx) aient besoin d'adapter leur rendu conditionnel. La solution ne doit pas changer l'API publique du composant (sa prop steps).
```

### MVP du frontend

```txt
# MVP frontend-only
  Stack: Next.js 16 (App Router, src/app/), React 19, TS strict, Tailwind v4.

  ## Règles
  - 100% mock client-side (state + localStorage). Zéro backend.

  ## Mock data (src/lib/mockData.ts)
  - 8 tables (cap 2/4/6), 6 ressources (2 commis, 1 chef, 2 plaques, 1 four).
  - 6 plats menu avec étapes typées { kind, duree(s), ressource[], deps[] }.
  - 4 commandes états variés.

  ## Pages (routes existent, à remplir)
  - `/` dashboard KPIs.
  - `/menu` plats + graph deps.
  - `/tables` plan salle + passer commande.
  - `/cuisine` Gantt SVG (lignes=ressources, blocs=étapes).
  - `/simulation` Poisson + multiplicateur vitesse + métriques.
  - `/ressources` planning occupation.

  ## Algos client
  - Scheduling: aligner fins de cuisson par table (plat long démarre 1er).
  - Simulation: min-heap d'événements, currentTime = peek().t, jamais d'incrément fixe.

  ## Garde-fous
  - Pas de dép lourde (Gantt = SVG maison).
  - `npm run build` + `npm run lint` verts.
  - Lire AGENTS.md + types.ts + pages existantes avant écrire — pas dupliquer.
```

---

## Comment le code généré a été intégré

1. **Revue systématique** : tout code généré par IA a été relu avant d'être intégré.
2. **Adaptation au contexte** : les noms de classes, packages et variables ont été alignés sur le vocabulaire métier du sujet (`Commande` → `Order`, `Étape` → `Task`, etc.).
3. **Tests** : les parties algorithmiques critiques (scheduler, simulation) ont été testées manuellement via l'interface de simulation avant validation.
