CREATE TABLE IF NOT EXISTS recipe_documents (
    id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    name TEXT    NOT NULL UNIQUE,
    tasks JSON   NOT NULL
);

CREATE TABLE IF NOT EXISTS task_kinds (
    id   INTEGER PRIMARY KEY,
    name TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS resource_types (
    resource_type_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name             TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS resources (
    resource_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    resource_type INTEGER NOT NULL REFERENCES resource_types(resource_type_id)
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    number      INTEGER NOT NULL UNIQUE,
    seats       INTEGER NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'LIBRE',
    party_size  INTEGER,
    commande_id TEXT
);

CREATE TABLE IF NOT EXISTS commandes (
    id        TEXT    PRIMARY KEY,
    table_id  INTEGER NOT NULL REFERENCES restaurant_tables(id),
    placed_at INTEGER NOT NULL,
    schedule  JSON,
    status    TEXT    NOT NULL DEFAULT 'EN_PREPARATION'
);

CREATE TABLE IF NOT EXISTS commande_items (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    commande_id TEXT    NOT NULL REFERENCES commandes(id),
    dish_id     INTEGER NOT NULL REFERENCES recipe_documents(id),
    position    INTEGER NOT NULL
);
