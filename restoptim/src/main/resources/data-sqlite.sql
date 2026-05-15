PRAGMA
foreign_keys = ON;

DELETE
FROM commande_items;
DELETE
FROM commandes;
DELETE
FROM restaurant_tables;
DELETE
FROM resources;
DELETE
FROM resource_types;
DELETE
FROM recipe_documents;

-- ─── Ressources ───────────────────────────────────────────────────────────────

INSERT INTO resource_types (resource_type_id, name)
VALUES (1, 'commis'),
       (2, 'chef'),
       (3, 'plaque'),
       (4, 'four');

INSERT INTO resources (resource_id, resource_type)
VALUES (1, 1), -- commis 1
       (2, 1), -- commis 2
       (3, 2), -- chef
       (4, 3), -- plaque 1
       (5, 3), -- plaque 2
       (6, 3), -- plaque 3
       (7, 4); -- four

-- ─── Menu ─────────────────────────────────────────────────────────────────────

INSERT INTO recipe_documents (id, name, tasks)
VALUES (1, 'Magret de canard', '{
  "etapes": [
    {"nom": "Préparer magret",   "kind": "PREPARATION", "ressource": ["commis"], "duree": 360, "deps": []},
    {"nom": "Préparer écrasé",   "kind": "PREPARATION", "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Cuire magret",      "kind": "COOKING", "ressource": ["plaque"], "duree": 540, "deps": [0]},
    {"nom": "Cuire écrasé",      "kind": "COOKING", "ressource": ["plaque"], "duree": 300, "deps": [1]},
    {"nom": "Dresser l''assiette", "kind": "PLATING", "ressource": ["chef"],  "duree": 120, "deps": [2, 3]}
  ]
}'),
       (2, 'Coquilles Saint-Jacques', '{
  "etapes": [
    {"nom": "Préparer Saint-Jacques", "kind": "PREPARATION", "ressource": ["commis"], "duree": 300, "deps": []},
    {"nom": "Snacker Saint-Jacques",  "kind": "COOKING", "ressource": ["plaque"], "duree": 120, "deps": [0]},
    {"nom": "Dresser l''assiette",    "kind": "PLATING", "ressource": ["chef"],   "duree": 120, "deps": [1]}
  ]
}'),
       (3, 'Bœuf bourguignon', '{
  "etapes": [
    {"nom": "Préparer joue de bœuf", "kind": "PREPARATION", "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Braiser au four",       "kind": "COOKING", "ressource": ["four"],   "duree": 720, "deps": [0]},
    {"nom": "Dresser l''assiette",   "kind": "PLATING", "ressource": ["chef"],   "duree": 120, "deps": [1]}
  ]
}'),
       (4, 'Risotto à la truffe', '{
  "etapes": [
    {"nom": "Préparer riz et bouillon", "kind": "PREPARATION", "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Cuire risotto",            "kind": "COOKING", "ressource": ["plaque"], "duree": 420, "deps": [0]},
    {"nom": "Dresser l''assiette",      "kind": "PLATING", "ressource": ["chef"],   "duree": 120, "deps": [1]}
  ]
}'),
       (5, 'Loup en croûte de sel', '{
  "etapes": [
    {"nom": "Préparer loup",      "kind": "PREPARATION", "ressource": ["commis"], "duree": 480, "deps": []},
    {"nom": "Cuire au four",      "kind": "COOKING", "ressource": ["four"],   "duree": 900, "deps": [0]},
    {"nom": "Dresser l''assiette", "kind": "PLATING", "ressource": ["chef"],   "duree": 180, "deps": [1]}
  ]
}'),
       (6, 'Filet mignon aux champignons sauvages', '{
  "etapes": [
    {"nom": "Préparer champignons sauvages", "kind": "PREPARATION", "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Préparer filet mignon", "kind": "PREPARATION", "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Cuire filet poêle", "kind": "COOKING", "ressource": ["plaque"], "duree": 300, "deps": [1]},
    {"nom": "Sauter champignons", "kind": "COOKING", "ressource": ["plaque"], "duree": 180, "deps": [0]},
    {"nom": "Dresser assiette et sauce", "kind": "PLATING", "ressource": ["chef"], "duree": 120, "deps": [2, 3]}
  ]
}'),
       (7, 'Côte de veau aux truffes', '{
  "etapes": [
    {"nom": "Préparer sauce à la truffe", "kind": "PREPARATION", "ressource": ["chef"], "duree": 300, "deps": []},
    {"nom": "Préparer côte de veau", "kind": "PREPARATION", "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Cuire côte plaque", "kind": "COOKING", "ressource": ["plaque"], "duree": 360, "deps": [1]},
    {"nom": "Infuser et monter sauce", "kind": "COOKING", "ressource": ["chef"], "duree": 120, "deps": [0]},
    {"nom": "Dresser l''assiette", "kind": "PLATING", "ressource": ["chef"], "duree": 120, "deps": [2, 3]}
  ]
}'),
       (8, 'Agneau rôti aux épices', '{
  "etapes": [
    {"nom": "Préparer côtelettes d''agneau", "kind": "PREPARATION", "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Préparer épices et marinades", "kind": "PREPARATION", "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Rôtir agneau au four", "kind": "COOKING", "ressource": ["four"], "duree": 600, "deps": [0, 1]},
    {"nom": "Préparer légumes accompagnement", "kind": "PREPARATION", "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Rôtir légumes four", "kind": "COOKING", "ressource": ["four"], "duree": 420, "deps": [3]},
    {"nom": "Dresser assiette", "kind": "PLATING", "ressource": ["chef"], "duree": 120, "deps": [2, 4]}
  ]
}'),
       (9, 'Turbot sauvage à la meunière', '{
  "etapes": [
    {"nom": "Préparer turbot", "kind": "PREPARATION", "ressource": ["commis"], "duree": 300, "deps": []},
    {"nom": "Préparer beurre blanc", "kind": "PREPARATION", "ressource": ["chef"], "duree": 240, "deps": []},
    {"nom": "Poêler turbot", "kind": "COOKING", "ressource": ["plaque"], "duree": 240, "deps": [0]},
    {"nom": "Finir sauce beurre blanc", "kind": "COOKING", "ressource": ["chef"], "duree": 90, "deps": [1]},
    {"nom": "Dresser assiette", "kind": "PLATING", "ressource": ["chef"], "duree": 120, "deps": [2, 3]}
  ]
}'),
       (10, 'Saumon fumé aux betteraves', '{
  "etapes": [
    {"nom": "Préparer saumon", "kind": "PREPARATION", "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Cuire betteraves", "kind": "COOKING", "ressource": ["four"], "duree": 420, "deps": []},
    {"nom": "Glacer betteraves au vinaigre", "kind": "COOKING", "ressource": ["plaque"], "duree": 180, "deps": [1]},
    {"nom": "Poêler saumon", "kind": "COOKING", "ressource": ["plaque"], "duree": 180, "deps": [0]},
    {"nom": "Dresser l''assiette", "kind": "PLATING", "ressource": ["chef"], "duree": 180, "deps": [2, 3]}
  ]
}'),
       (11, 'Bar rayé en croûte d''herbes', '{
  "etapes": [
    {"nom": "Préparer bar", "kind": "PREPARATION", "ressource": ["commis"], "duree": 360, "deps": []},
    {"nom": "Préparer croûte d''herbes", "kind": "PREPARATION", "ressource": ["commis"], "duree": 120, "deps": []},
    {"nom": "Cuire bar au four", "kind": "COOKING", "ressource": ["four"], "duree": 540, "deps": [0, 1]},
    {"nom": "Préparer accompagnement", "kind": "PREPARATION", "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Dresser assiette", "kind": "PLATING", "ressource": ["chef"], "duree": 120, "deps": [2, 3]}
  ]
}'),
       (12, 'Homard thermidor', '{
  "etapes": [
    {"nom": "Cuire homard court-bouillon", "kind": "COOKING", "ressource": ["four"], "duree": 600, "deps": []},
    {"nom": "Extraire chair de homard", "kind": "PREPARATION", "ressource": ["commis"], "duree": 240, "deps": [0]},
    {"nom": "Préparer sauce béarnaise", "kind": "PREPARATION", "ressource": ["chef"], "duree": 180, "deps": []},
    {"nom": "Garnir et gratiner", "kind": "COOKING", "ressource": ["four"], "duree": 300, "deps": [1, 2]},
    {"nom": "Dresser assiette", "kind": "PLATING", "ressource": ["chef"], "duree": 120, "deps": [3]}
  ]
}'),
       (13, 'Langoustines à l''ail et citron', '{
  "etapes": [
    {"nom": "Préparer langoustines", "kind": "PREPARATION", "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Préparer beurre ail citron", "kind": "PREPARATION", "ressource": ["chef"], "duree": 120, "deps": []},
    {"nom": "Poêler langoustines", "kind": "COOKING", "ressource": ["plaque"], "duree": 180, "deps": [0]},
    {"nom": "Finir beurre composé", "kind": "COOKING", "ressource": ["chef"], "duree": 60, "deps": [1]},
    {"nom": "Dresser assiette", "kind": "PLATING", "ressource": ["chef"], "duree": 120, "deps": [2, 3]}
  ]
}'),
       (14, 'Moules marinière sauce safran', '{
  "etapes": [
    {"nom": "Préparer moules", "kind": "PREPARATION", "ressource": ["commis"], "duree": 300, "deps": []},
    {"nom": "Préparer court-bouillon safran", "kind": "PREPARATION", "ressource": ["chef"], "duree": 240, "deps": []},
    {"nom": "Cuire moules", "kind": "COOKING", "ressource": ["plaque"], "duree": 300, "deps": [0, 1]},
    {"nom": "Finir sauce safran", "kind": "COOKING", "ressource": ["chef"], "duree": 90, "deps": [1]},
    {"nom": "Dresser assiette", "kind": "PLATING", "ressource": ["chef"], "duree": 120, "deps": [2, 3]}
  ]
}'),
       (15, 'Champignons de Paris rôtis en croûte', '{
  "etapes": [
    {"nom": "Préparer champignons", "kind": "PREPARATION", "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Préparer croûte de pain", "kind": "PREPARATION", "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Rôtir champignons four", "kind": "COOKING", "ressource": ["four"], "duree": 480, "deps": [0]},
    {"nom": "Préparer mousse d''ail", "kind": "PREPARATION", "ressource": ["chef"], "duree": 120, "deps": []},
    {"nom": "Dresser assiette et réduction", "kind": "PLATING", "ressource": ["chef"], "duree": 120, "deps": [1, 2, 3]}
  ]
}');

-- ─── Tables du restaurant ─────────────────────────────────────────────────────

INSERT INTO restaurant_tables (id, number, seats, status)
VALUES (1, 1, 2, 'LIBRE'),
       (2, 2, 2, 'LIBRE'),
       (3, 3, 4, 'LIBRE'),
       (4, 4, 4, 'LIBRE'),
       (5, 5, 6, 'LIBRE'),
       (6, 6, 2, 'LIBRE'),
       (7, 7, 4, 'LIBRE'),
       (8, 8, 8, 'LIBRE');
