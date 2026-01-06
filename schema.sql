DROP TABLE IF EXISTS Users;
CREATE TABLE Users (
  id TEXT PRIMARY KEY,
  last_name TEXT,
  first_name TEXT,
  dob TEXT,
  email TEXT,
  ticket_balance INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS Casts;
CREATE TABLE Casts (
  id INTEGER PRIMARY KEY,
  name TEXT,
  role TEXT,
  systemPrompt TEXT
);

DROP TABLE IF EXISTS Reservations;
CREATE TABLE Reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  cast_id INTEGER,
  scheduled_at DATETIME,
  status TEXT DEFAULT 'pending', -- pending, completed, cancelled
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS ChatLogs;
CREATE TABLE ChatLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  cast_id INTEGER, -- ★追加：誰と話したかを記録
  sender TEXT, -- 'user' or 'ai'
  content TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
