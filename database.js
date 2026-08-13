const Database = require("better-sqlite3");

const db = new Database("lectures.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS lectures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL
  )
`).run();

console.log("📚 Database даяр!");