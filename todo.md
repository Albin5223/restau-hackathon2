# TODO

- [ ] BDD
  - [ ] Modélisation
  - [ ] Générer les données

## Gestion des données

- données statiques en base
  - menus
  - ressources par plat
  - temps par étapes par plat
  - machines
  - ouvriers
- données dynamiques ??
  - état des ressources à l'instant T

## Moteur

- Communication -> Gantt
- Gestion du temps
- Gestion des ressources
  - tables, stock, personnel, machines
- Gestion des event
  - commandes
  - fin de cuisson/étape
  - critère principal: de terminer la cuisson presque en meme temps

## Simulateur

Si vous faites un g ́en ́erateur de commandes, faites simple : les groupes de clients
arrivent en moments al ́eatoires en suivant un processus de Poisson, leur taille
est al ́eatoire. S’il y a une table disponible de la bonne taille, ils commandent
des plats au hasard ; sinon ils s’en vont
