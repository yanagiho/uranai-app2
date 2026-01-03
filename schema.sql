DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS Reservations;
DROP TABLE IF EXISTS ChatLogs;

CREATE TABLE Users (
    id TEXT PRIMARY KEY, 
    last_name TEXT,
    first_name TEXT,
    dob TEXT, 
    email TEXT, 
    auth_type TEXT, 
    ticket_balance INTEGER DEFAULT 10,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE Reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    user_id TEXT UNIQUE, 
    cast_id INTEGER, 
    scheduled_at TEXT, 
    status TEXT DEFAULT 'pending',
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE ChatLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    reservation_id INTEGER,
    sender TEXT,
    content TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);
