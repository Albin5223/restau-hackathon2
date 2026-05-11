PRAGMA foreign_keys = ON;

DELETE FROM resources;
DELETE FROM resource_types;
DELETE FROM recipe_documents;
DELETE FROM sqlite_sequence WHERE name IN ('resources', 'resource_types', 'recipe_documents');

INSERT INTO recipe_documents (id, name, tasks) VALUES
(
    1,
    'steak frites',
    '{
      "etapes": [
        {"nom": "préparer steak", "kind": "other", "ressource": ["commis"], "duree": 3, "deps": []},
        {"nom": "cuire steak", "kind": "cooking", "ressource": ["plaque"], "duree": 8, "deps": [1]},
        {"nom": "préparer frites", "kind": "other", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "cuire frites", "kind": "cooking", "ressource": ["friteuse"], "duree": 7, "deps": [3]},
        {"nom": "dresser l''assiette", "kind": "plating", "ressource": ["chef"], "duree": 2, "deps": [2, 4]}
      ]
    }'
),
(
    2,
    'burger frites',
    '{
      "etapes": [
        {"nom": "préparer steak", "kind": "other", "ressource": ["commis"], "duree": 3, "deps": []},
        {"nom": "cuire steak", "kind": "cooking", "ressource": ["plaque"], "duree": 8, "deps": [1]},
        {"nom": "toaster le bun", "kind": "cooking", "ressource": ["toaster"], "duree": 2, "deps": []},
        {"nom": "préparer frites", "kind": "other", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "cuire frites", "kind": "cooking", "ressource": ["friteuse"], "duree": 7, "deps": [4]},
        {"nom": "assembler le burger", "kind": "other", "ressource": ["chef"], "duree": 3, "deps": [2, 3]},
        {"nom": "dresser", "kind": "plating", "ressource": ["chef"], "duree": 2, "deps": [5, 6]}
      ]
    }'
),
(
    3,
    'salade césar',
    '{
      "etapes": [
        {"nom": "laver la salade", "kind": "other", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "cuire le poulet", "kind": "cooking", "ressource": ["plaque"], "duree": 10, "deps": []},
        {"nom": "préparer les croûtons", "kind": "cooking", "ressource": ["four"], "duree": 5, "deps": []},
        {"nom": "préparer la sauce", "kind": "other", "ressource": ["chef"], "duree": 3, "deps": []},
        {"nom": "assembler la salade", "kind": "plating", "ressource": ["chef"], "duree": 3, "deps": [1, 2, 3, 4]}
      ]
    }'
),
(
    4,
    'omelette jambon fromage',
    '{
      "etapes": [
        {"nom": "casser et battre les oeufs", "kind": "other", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "préparer le jambon", "kind": "other", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "râper le fromage", "kind": "other", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "cuire l''omelette", "kind": "cooking", "ressource": ["poêle", "commis"], "duree": 6, "deps": [1, 2, 3]},
        {"nom": "dresser", "kind": "plating", "ressource": ["chef"], "duree": 2, "deps": [4]}
      ]
    }'
);

INSERT INTO resource_types (resource_type_id, name) VALUES
(1, 'commis'),
(2, 'chef'),
(3, 'plaque'),
(4, 'friteuse'),
(5, 'toaster'),
(6, 'four'),
(7, 'poêle');

INSERT INTO resources (resource_id, resource_type) VALUES
(1, 1),
(2, 1),
(3, 1),
(4, 2),
(5, 3),
(6, 4),
(7, 5),
(8, 6),
(9, 7);
