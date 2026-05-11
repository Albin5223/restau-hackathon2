# Sujet Hackathon — Jumeau numérique d'un restaurant

**M2 GENIAL**
**Du 11/05/2026 au 15/05/2026**

## Contexte

Le repas gastronomique des Français est inscrit par l'Unesco au patrimoine culturel immatériel de l'humanité. Or, les restaurants en France sont soumis aux contraintes économiques qui leur demandent une performance maximale avec des ressources bornées.

## Objectif du projet

Développer, en équipe de 4, un jumeau numérique d'un restaurant. L'adapter à un ou plusieurs modes de fonctionnement :

- aide à la gestion des commandes en temps réel dans un restaurant ;
- simulation du restaurant en boucle fermée pour prévoir sa performance en fonction de nombre de clients/commande/ressources ;
- jeu vidéo de simulation.

## Consignes

Il n'y a pas de restrictions sur l'utilisation des outils d'intelligence artificielle/LLM.

Toute utilisation de l'IA dans votre projet doit être déclarée dans un manifeste faisant partie des livrables : quels outils, quels prompts, qu'est-ce qui est généré, comment c'est intégré au projet.

Le développement doit se faire sur Moule, ajoutez-nous comme rapporteurs.

## Comment fonctionne un restaurant

- Le restaurant a un certain nombre de tables, un menu et des ressources de cuisine : personnel (commis ou chef), plaque de cuisson ou four.
- Chaque plat du menu demande un certain temps de préparation, de cuisson, de dressage. Chaque étape peut exiger une ou plusieurs ressources.
- Pour simplifier, en première version on aura seulement les plats principaux (pas d'entrée, pas de dessert).
- Les clients d'une table arrivent et passent commande (un plat chacun) au même moment.
- L'application planifie la préparation des plats pour minimiser le temps d'attente. Une contrainte importante est que les plats pour une table doivent être servis chauds et tous au même moment. Ainsi, si on sert le magret de canard (temps de cuisson 9 minutes) et les coquilles Saint-Jacques (2 minutes), on commencera la cuisson du canard à peu près 6 minutes avant les coquilles.
- L'écran dans la cuisine affiche le plan des actions à faire (par exemple comme diagramme de Gantt) et signale à quel moment commencer et terminer chaque étape et servir une table.

On propose de ne pas considérer d'autres aspects importants du fonctionnement du restaurant : les réservations, les prix des plats, l'encaissement, la gestion du personnel, l'approvisionnement, la cave, etc.

## Que mettre dans votre projet

Votre logiciel pourrait en principe contenir les modules suivants :

- le jumeau numérique proprement dit qui représente l'état et les événements du restaurant ;
- une partie front pour configurer les paramètres, importer le menu, etc. ;
- le module d'ordonnancement qui crée pour chaque commande son planning pour la cuisine ;
- une interface visuelle pour afficher le planning et produire des alarmes en cuisine, avec ou sans confirmation/correction des temps par les cuisiniers ;
- (pour le vrai restaurant) une interface pour passer les commandes ;
- (pour la simulation en boucle fermée) un générateur de commandes ;
- affichage, mesure des performances, etc.

À vous de choisir la plateforme pour chaque module, l'architecture réseau et autres aspects technologiques.

## Conseils techniques

Renseignez-vous (avec modération) sur :

- le *job-shop scheduling* (ordonnancement d'atelier), notamment traité dans les OR-Tools de Google ;
- la simulation des systèmes à événements discrets ;
- le processus de Poisson.

Sans aucun doute vous savez faire une application avec une base de données (pour le menu, les clients, les commandes, les ressources, etc.).

Avec un peu de sens commun et l'aide des outils IA, on peut dimensionner/paramétrer le modèle et faire un petit menu avec les étapes et les temps pour préparer chaque plat.

Vous savez aussi gérer les aspects réseau (soit dans une application web, soit en faisant vous-mêmes une application client-serveur).

La représentation de l'état du système et la gestion des événements ne sont pas évidentes. Au cœur de votre simulation serait une file d'événements à venir avec leurs *timestamps*. Chaque fois que l'heure du premier événement arrive, il est sorti de la file et géré. À de nombreuses occasions, on ajoute de nouveaux éléments à la file.

Une autre difficulté consiste à trouver le bon ordonnancement des tâches de préparation. Pour une table, c'est le problème classique de *job-shop scheduling*, avec un critère supplémentaire de terminer la cuisson presque en même temps. Pensez à une métrique de qualité à optimiser. Vous n'avez pas besoin d'être vraiment optimaux, vous pouvez utiliser des heuristiques raisonnables. Pour les tablées suivantes, il faut tenir compte du temps de libération de chaque ressource.

Si vous faites un générateur de commandes, faites simple : les groupes de clients arrivent à des moments aléatoires en suivant un processus de Poisson, leur taille est aléatoire. S'il y a une table disponible de la bonne taille, ils commandent des plats au hasard ; sinon ils s'en vont.

## Livrables

- Un manifeste décrivant l'utilisation de l'IA.
- Un logiciel.
- Documentation technique (README avec instructions d'installation, description de l'architecture, sources de données utilisées).
- Présentation orale de 10 minutes avec démonstration.

## Évaluation

Le projet sera évalué sur les critères suivants :

- Cohérence globale du projet et de son architecture.
- Aspects algorithmiques, en particulier optimisation de performances *job-shop scheduling* et simulation des événements discrets.
- Aspects fonctionnels de la suite d'applications.
- Capacité à travailler en équipe et à présenter les avancées quotidiennes.
- Qualité de la présentation finale.

Les aspects visuels et l'ergonomie de l'application pour clients sont des critères d'évaluation très mineurs.

## Horaires

Tous les jours sauf jeudi (férié) de 9h30 à 17h00 (1h de pause méridienne, les enseignants passent à 9h30 et 16h30). Présentations finales vendredi à 15h30.
