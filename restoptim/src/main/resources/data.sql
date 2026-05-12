PRAGMA foreign_keys = ON;

DELETE FROM commande_items;
DELETE FROM commandes;
DELETE FROM restaurant_tables;
DELETE FROM resources;
DELETE FROM resource_types;
DELETE FROM recipe_documents;
DELETE FROM sqlite_sequence WHERE name IN (
    'commande_items', 'commandes', 'restaurant_tables',
    'resources', 'resource_types', 'recipe_documents'
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

-- ─── Menu ─────────────────────────────────────────────────────────────────────

INSERT INTO recipe_documents (id, name, tasks) VALUES
(1, 'Magret de canard', '{
  "etapes": [
    {"nom": "Préparer magret",   "kind": "preparation",   "ressource": ["commis"], "duree": 360, "deps": []},
    {"nom": "Préparer écrasé",   "kind": "preparation",   "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Cuire magret",      "kind": "cooking", "ressource": ["plaque"], "duree": 540, "deps": [1]},
    {"nom": "Cuire écrasé",      "kind": "cooking", "ressource": ["plaque"], "duree": 300, "deps": [2]},
    {"nom": "Dresser l''assiette", "kind": "plating", "ressource": ["chef"],  "duree": 120, "deps": [3, 4]}
  ]
}'),
(2, 'Coquilles Saint-Jacques', '{
  "etapes": [
    {"nom": "Préparer Saint-Jacques", "kind": "preparation",   "ressource": ["commis"], "duree": 300, "deps": []},
    {"nom": "Snacker Saint-Jacques",  "kind": "cooking", "ressource": ["plaque"], "duree": 120, "deps": [1]},
    {"nom": "Dresser l''assiette",    "kind": "plating", "ressource": ["chef"],   "duree": 120, "deps": [2]}
  ]
}'),
(3, 'Bœuf bourguignon', '{
  "etapes": [
    {"nom": "Préparer joue de bœuf", "kind": "preparation",   "ressource": ["commis"], "duree": 240, "deps": []},
    {"nom": "Braiser au four",       "kind": "cooking", "ressource": ["four"],   "duree": 720, "deps": [1]},
    {"nom": "Dresser l''assiette",   "kind": "plating", "ressource": ["chef"],   "duree": 120, "deps": [2]}
  ]
}'),
(4, 'Risotto à la truffe', '{
  "etapes": [
    {"nom": "Préparer riz et bouillon", "kind": "preparation",   "ressource": ["commis"], "duree": 180, "deps": []},
    {"nom": "Cuire risotto",            "kind": "cooking", "ressource": ["plaque"], "duree": 420, "deps": [1]},
    {"nom": "Dresser l''assiette",      "kind": "plating", "ressource": ["chef"],   "duree": 120, "deps": [2]}
  ]
}'),
(5, 'Loup en croûte de sel', '{
  "etapes": [
    {"nom": "Préparer loup",      "kind": "preparation",   "ressource": ["commis"], "duree": 480, "deps": []},
    {"nom": "Cuire au four",      "kind": "cooking", "ressource": ["four"],   "duree": 900, "deps": [1]},
    {"nom": "Dresser l''assiette", "kind": "plating", "ressource": ["chef"],   "duree": 180, "deps": [2]}
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
