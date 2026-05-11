PRAGMA foreign_keys = ON;

DELETE FROM recipe_documents;

INSERT INTO recipe_documents (id, name, tasks) VALUES
(
    1,
    'steak frites',
    '{
      "etapes": [
        {"nom": "préparer steak", "ressource": ["commis"], "duree": 3, "deps": []},
        {"nom": "cuire steak", "ressource": ["plaque"], "duree": 8, "deps": [1]},
        {"nom": "préparer frites", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "cuire frites", "ressource": ["friteuse"], "duree": 7, "deps": [3]},
        {"nom": "dresser l''assiette", "ressource": ["chef"], "duree": 2, "deps": [2, 4]}
      ]
    }'
),
(
    2,
    'burger frites',
    '{
      "etapes": [
        {"nom": "préparer steak", "ressource": ["commis"], "duree": 3, "deps": []},
        {"nom": "cuire steak", "ressource": ["plaque"], "duree": 8, "deps": [1]},
        {"nom": "toaster le bun", "ressource": ["toaster"], "duree": 2, "deps": []},
        {"nom": "préparer frites", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "cuire frites", "ressource": ["friteuse"], "duree": 7, "deps": [4]},
        {"nom": "assembler le burger", "ressource": ["chef"], "duree": 3, "deps": [2, 3]},
        {"nom": "dresser", "ressource": ["chef"], "duree": 2, "deps": [5, 6]}
      ]
    }'
),
(
    3,
    'salade césar',
    '{
      "etapes": [
        {"nom": "laver la salade", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "cuire le poulet", "ressource": ["plaque"], "duree": 10, "deps": []},
        {"nom": "préparer les croûtons", "ressource": ["four"], "duree": 5, "deps": []},
        {"nom": "préparer la sauce", "ressource": ["chef"], "duree": 3, "deps": []},
        {"nom": "assembler la salade", "ressource": ["chef"], "duree": 3, "deps": [1, 2, 3, 4]}
      ]
    }'
),
(
    4,
    'omelette jambon fromage',
    '{
      "etapes": [
        {"nom": "casser et battre les oeufs", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "préparer le jambon", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "râper le fromage", "ressource": ["commis"], "duree": 2, "deps": []},
        {"nom": "cuire l''omelette", "ressource": ["poêle", "commis"], "duree": 6, "deps": [1, 2, 3]},
        {"nom": "dresser", "ressource": ["chef"], "duree": 2, "deps": [4]}
      ]
    }'
);


DELETE FROM resource_types;
INSERT INTO resource_types (name) VALUES
('commis'),
('chef'),
('plaque'),
('friteuse'),
('toaster'),
('four'),
('poêle');

DELETE FROM resources;
INSERT INTO resources (resource_type) VALUES
(1),
(1),
(1),
(2),
(3),
(4),
(5),
(6),
(7);
