PRAGMA foreign_keys = ON;

-- Stockage direct de documents JSON
CREATE TABLE IF NOT EXISTS recipe_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    tasks JSON NOT NULL
);


CREATE TABLE IF NOT EXISTS resource_types(
    resource_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT
);

CREATE TABLE IF NOT EXISTS resources(
    resource_id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type INTEGER NOT NULL REFERENCES resource_types(resource_type_id)
);
