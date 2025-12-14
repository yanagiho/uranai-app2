DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS Casts;
DROP TABLE IF EXISTS Reservations;
DROP TABLE IF EXISTS ChatLogs;

CREATE TABLE Users (id TEXT PRIMARY KEY, email TEXT, ticket_balance INTEGER DEFAULT 0);
CREATE TABLE Casts (id INTEGER PRIMARY KEY, name TEXT, system_prompt TEXT, status TEXT DEFAULT 'standby');
CREATE TABLE Reservations (id INTEGER PRIMARY KEY, user_id TEXT, cast_id INTEGER, status TEXT);
CREATE TABLE ChatLogs (id INTEGER PRIMARY KEY, reservation_id INTEGER, sender TEXT, content TEXT, created_at INTEGER DEFAULT (unixepoch()));