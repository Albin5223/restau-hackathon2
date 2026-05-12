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
    {"nom": "Préparer magret",   "kind": 1, "ressource": ["commis"], "duree": 6, "deps": []},
    {"nom": "Préparer écrasé",   "kind": 1, "ressource": ["commis"], "duree": 4, "deps": []},
    {"nom": "Cuire magret",      "kind": 2, "ressource": ["plaque"], "duree": 9, "deps": [1]},
    {"nom": "Cuire écrasé",      "kind": 2, "ressource": ["plaque"], "duree": 5, "deps": [2]},
    {"nom": "Dresser l''assiette", "kind": 3, "ressource": ["chef"],  "duree": 2, "deps": [3, 4]}
  ]
}'),
(2, 'Coquilles Saint-Jacques', '{
  "etapes": [
    {"nom": "Préparer Saint-Jacques", "kind": 1, "ressource": ["commis"], "duree": 5, "deps": []},
    {"nom": "Snacker Saint-Jacques",  "kind": 2, "ressource": ["plaque"], "duree": 2, "deps": [1]},
    {"nom": "Dresser l''assiette",    "kind": 3, "ressource": ["chef"],   "duree": 2, "deps": [2]}
  ]
}'),
(3, 'Bœuf bourguignon', '{
  "etapes": [
    {"nom": "Préparer joue de bœuf", "kind": 1, "ressource": ["commis"], "duree": 4, "deps": []},
    {"nom": "Braiser au four",       "kind": 2, "ressource": ["four"],   "duree": 12, "deps": [1]},
    {"nom": "Dresser l''assiette",   "kind": 3, "ressource": ["chef"],   "duree": 2, "deps": [2]}
  ]
}'),
(4, 'Risotto à la truffe', '{
  "etapes": [
    {"nom": "Préparer riz et bouillon", "kind": 1, "ressource": ["commis"], "duree": 3, "deps": []},
    {"nom": "Cuire risotto",            "kind": 2, "ressource": ["plaque"], "duree": 7, "deps": [1]},
    {"nom": "Dresser l''assiette",      "kind": 3, "ressource": ["chef"],   "duree": 2, "deps": [2]}
  ]
}'),
(5, 'Loup en croûte de sel', '{
  "etapes": [
    {"nom": "Préparer loup",      "kind": 1, "ressource": ["commis"], "duree": 8, "deps": []},
    {"nom": "Cuire au four",      "kind": 2, "ressource": ["four"],   "duree": 15, "deps": [1]},
    {"nom": "Dresser l''assiette", "kind": 3, "ressource": ["chef"],   "duree": 3, "deps": [2]}
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
