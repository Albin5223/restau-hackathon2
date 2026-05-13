PRAGMA foreign_keys = ON;

DELETE FROM commande_items;
DELETE FROM commandes;
DELETE FROM restaurant_tables;
DELETE FROM resources;
DELETE FROM resource_types;
DELETE FROM task_kinds;
DELETE FROM recipe_documents;
DELETE FROM sqlite_sequence WHERE name IN (
    'commande_items', 'commandes', 'restaurant_tables',
  'resources', 'resource_types', 'recipe_documents', 'task_kinds'
);

-- ─── Ressources ───────────────────────────────────────────────────────────────

INSERT INTO resource_types (resource_type_id, name) VALUES
(1, 'commis'),
(2, 'chef'),
(3, 'plaque'),
(4, 'four');

INSERT INTO resources (resource_id, resource_type) VALUES
(1, 1),  -- commis 1
(2, 1),  -- commis 2
(3, 2),  -- chef
(4, 3),  -- plaque 1
(5, 3),  -- plaque 2
(6, 3),  -- plaque 3
(7, 4);  -- four

INSERT INTO task_kinds (id, name) VALUES
(1, 'PREPARATION'),
(2, 'COOKING'),
(3, 'PLATING');

-- ─── Menu ─────────────────────────────────────────────────────────────────────

INSERT INTO recipe_documents (id, name, tasks) VALUES
(1, 'Magret de canard', '{
  "etapes": [
    {"nom": "Préparer magret",   "kind": 1, "ressource": ["commis"], "duree": 360, "deps": []},
    {"nom": "Préparer écrasé",   "kind": 1, "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Cuire magret",      "kind": 2, "ressource": ["plaque"], "duree": 540, "deps": [1]},
    {"nom": "Cuire écrasé",      "kind": 2, "ressource": ["plaque"], "duree": 300, "deps": [2]},
    {"nom": "Dresser l''assiette", "kind": 3, "ressource": ["chef"],  "duree": 120, "deps": [3, 4]}
  ]
}'),
(2, 'Coquilles Saint-Jacques', '{
  "etapes": [
    {"nom": "Préparer Saint-Jacques", "kind": 1, "ressource": ["commis"], "duree": 300, "deps": []},
    {"nom": "Snacker Saint-Jacques",  "kind": 2, "ressource": ["plaque"], "duree": 120, "deps": [1]},
    {"nom": "Dresser l''assiette",    "kind": 3, "ressource": ["chef"],   "duree": 120, "deps": [2]}
  ]
}'),
(3, 'Bœuf bourguignon', '{
  "etapes": [
    {"nom": "Préparer joue de bœuf", "kind": 1, "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Braiser au four",       "kind": 2, "ressource": ["four"],   "duree": 720, "deps": [1]},
    {"nom": "Dresser l''assiette",   "kind": 3, "ressource": ["chef"],   "duree": 120, "deps": [2]}
  ]
}'),
(4, 'Risotto à la truffe', '{
  "etapes": [
    {"nom": "Préparer riz et bouillon", "kind": 1, "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Cuire risotto",            "kind": 2, "ressource": ["plaque"], "duree": 420, "deps": [1]},
    {"nom": "Dresser l''assiette",      "kind": 3, "ressource": ["chef"],   "duree": 120, "deps": [2]}
  ]
}'),
(5, 'Loup en croûte de sel', '{
  "etapes": [
    {"nom": "Préparer loup",      "kind": 1, "ressource": ["commis"], "duree": 480, "deps": []},
    {"nom": "Cuire au four",      "kind": 2, "ressource": ["four"],   "duree": 900, "deps": [1]},
    {"nom": "Dresser l''assiette", "kind": 3, "ressource": ["chef"],   "duree": 180, "deps": [2]}
  ]
}'),
(6, 'Filet mignon aux champignons sauvages', '{
  "etapes": [
    {"nom": "Préparer champignons sauvages", "kind": 1, "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Préparer filet mignon", "kind": 1, "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Cuire filet poêle", "kind": 2, "ressource": ["plaque"], "duree": 300, "deps": [2]},
    {"nom": "Sauter champignons", "kind": 2, "ressource": ["plaque"], "duree": 180, "deps": [1]},
    {"nom": "Dresser assiette et sauce", "kind": 3, "ressource": ["chef"], "duree": 120, "deps": [3, 4]}
  ]
}'),
(7, 'Côte de veau aux truffes', '{
  "etapes": [
    {"nom": "Préparer sauce à la truffe", "kind": 1, "ressource": ["chef"], "duree": 300, "deps": []},
    {"nom": "Préparer côte de veau", "kind": 1, "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Cuire côte plaque", "kind": 2, "ressource": ["plaque"], "duree": 360, "deps": [2]},
    {"nom": "Infuser et monter sauce", "kind": 2, "ressource": ["chef"], "duree": 120, "deps": [1]},
    {"nom": "Dresser l''assiette", "kind": 3, "ressource": ["chef"], "duree": 120, "deps": [3, 4]}
  ]
}'),
(8, 'Agneau rôti aux épices', '{
  "etapes": [
    {"nom": "Préparer côtelettes d''agneau", "kind": 1, "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Préparer épices et marinades", "kind": 1, "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Rôtir agneau au four", "kind": 2, "ressource": ["four"], "duree": 600, "deps": [1, 2]},
    {"nom": "Préparer légumes accompagnement", "kind": 1, "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Rôtir légumes four", "kind": 2, "ressource": ["four"], "duree": 420, "deps": [4]},
    {"nom": "Dresser assiette", "kind": 3, "ressource": ["chef"], "duree": 120, "deps": [3, 5]}
  ]
}'),
(9, 'Turbot sauvage à la meunière', '{
  "etapes": [
    {"nom": "Préparer turbot", "kind": 1, "ressource": ["commis"], "duree": 300, "deps": []},
    {"nom": "Préparer beurre blanc", "kind": 1, "ressource": ["chef"], "duree": 240, "deps": []},
    {"nom": "Poêler turbot", "kind": 2, "ressource": ["plaque"], "duree": 240, "deps": [1]},
    {"nom": "Finir sauce beurre blanc", "kind": 2, "ressource": ["chef"], "duree": 90, "deps": [2]},
    {"nom": "Dresser assiette", "kind": 3, "ressource": ["chef"], "duree": 120, "deps": [3, 4]}
  ]
}'),
(10, 'Saumon fumé aux betteraves', '{
  "etapes": [
    {"nom": "Préparer saumon", "kind": 1, "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Cuire betteraves", "kind": 2, "ressource": ["four"], "duree": 420, "deps": []},
    {"nom": "Glacer betteraves au vinaigre", "kind": 2, "ressource": ["plaque"], "duree": 180, "deps": [2]},
    {"nom": "Poêler saumon", "kind": 2, "ressource": ["plaque"], "duree": 180, "deps": [1]},
    {"nom": "Dresser l''assiette", "kind": 3, "ressource": ["chef"], "duree": 180, "deps": [3, 4]}
  ]
}'),
(11, 'Bar rayé en croûte d''herbes', '{
  "etapes": [
    {"nom": "Préparer bar", "kind": 1, "ressource": ["commis"], "duree": 360, "deps": []},
    {"nom": "Préparer croûte d''herbes", "kind": 1, "ressource": ["commis"], "duree": 120, "deps": []},
    {"nom": "Cuire bar au four", "kind": 2, "ressource": ["four"], "duree": 540, "deps": [1, 2]},
    {"nom": "Préparer accompagnement", "kind": 1, "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Dresser assiette", "kind": 3, "ressource": ["chef"], "duree": 120, "deps": [3, 4]}
  ]
}'),
(12, 'Homard thermidor', '{
  "etapes": [
    {"nom": "Cuire homard court-bouillon", "kind": 2, "ressource": ["four"], "duree": 600, "deps": []},
    {"nom": "Extraire chair de homard", "kind": 1, "ressource": ["commis"], "duree": 240, "deps": [1]},
    {"nom": "Préparer sauce béarnaise", "kind": 1, "ressource": ["chef"], "duree": 180, "deps": []},
    {"nom": "Garnir et gratiner", "kind": 2, "ressource": ["four"], "duree": 300, "deps": [2, 3]},
    {"nom": "Dresser assiette", "kind": 3, "ressource": ["chef"], "duree": 120, "deps": [4]}
  ]
}'),
(13, 'Langoustines à l''ail et citron', '{
  "etapes": [
    {"nom": "Préparer langoustines", "kind": 1, "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Préparer beurre ail citron", "kind": 1, "ressource": ["chef"], "duree": 120, "deps": []},
    {"nom": "Poêler langoustines", "kind": 2, "ressource": ["plaque"], "duree": 180, "deps": [1]},
    {"nom": "Finir beurre composé", "kind": 2, "ressource": ["chef"], "duree": 60, "deps": [2]},
    {"nom": "Dresser assiette", "kind": 3, "ressource": ["chef"], "duree": 120, "deps": [3, 4]}
  ]
}'),
(14, 'Moules marinière sauce safran', '{
  "etapes": [
    {"nom": "Préparer moules", "kind": 1, "ressource": ["commis"], "duree": 300, "deps": []},
    {"nom": "Préparer court-bouillon safran", "kind": 1, "ressource": ["chef"], "duree": 240, "deps": []},
    {"nom": "Cuire moules", "kind": 2, "ressource": ["plaque"], "duree": 300, "deps": [1, 2]},
    {"nom": "Finir sauce safran", "kind": 2, "ressource": ["chef"], "duree": 90, "deps": [2]},
    {"nom": "Dresser assiette", "kind": 3, "ressource": ["chef"], "duree": 120, "deps": [3, 4]}
  ]
}'),
(15, 'Champignons de Paris rôtis en croûte', '{
  "etapes": [
    {"nom": "Préparer champignons", "kind": 1, "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Préparer croûte de pain", "kind": 1, "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Rôtir champignons four", "kind": 2, "ressource": ["four"], "duree": 480, "deps": [1]},
    {"nom": "Préparer mousse d''ail", "kind": 1, "ressource": ["chef"], "duree": 120, "deps": []},
    {"nom": "Dresser assiette et réduction", "kind": 3, "ressource": ["chef"], "duree": 120, "deps": [2, 3, 4]}
  ]
}');

-- ─── Tables du restaurant ─────────────────────────────────────────────────────

INSERT INTO restaurant_tables (id, number, seats, status) VALUES
(1, 1, 2, 'LIBRE'),
(2, 2, 2, 'LIBRE'),
(3, 3, 4, 'LIBRE'),
(4, 4, 4, 'LIBRE'),
(5, 5, 6, 'LIBRE'),
(6, 6, 2, 'LIBRE'),
(7, 7, 4, 'LIBRE'),
(8, 8, 8, 'LIBRE');
