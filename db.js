const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.NODE_ENV === 'test'
  ? path.resolve(__dirname, 'test.database.sqlite')
  : path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Ошибка открытия БД:', err);
});

// Миграции (создание таблиц)
db.serialize(() => {
  // Таблица пользователей (роли: dispatcher, master)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('dispatcher', 'master'))
    )
  `);

  // Таблица заявок
  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientName TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      problemText TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','assigned','in_progress','done','canceled')),
      assignedTo INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignedTo) REFERENCES users(id)
    )
  `);

  // Триггер для автоматического обновления updatedAt
  db.run(`
    CREATE TRIGGER IF NOT EXISTS update_requests_updatedAt
    AFTER UPDATE ON requests
    FOR EACH ROW
    BEGIN
      UPDATE requests SET updatedAt = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END
  `);
});

// Сиды: добавляем пользователей и тестовые заявки, если таблицы пусты
db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
  if (err) return console.error(err);
  if (row.count === 0) {
    const stmt = db.prepare("INSERT INTO users (name, role) VALUES (?, ?)");
    stmt.run("Диспетчер Анна", "dispatcher");
    stmt.run("Мастер Пётр", "master");
    stmt.run("Мастер Иван", "master");
    stmt.finalize();

    // Добавим пару тестовых заявок
    const reqStmt = db.prepare(`
      INSERT INTO requests (clientName, phone, address, problemText, status, assignedTo)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    reqStmt.run("ООО Ромашка", "+7(111)111-11-11", "ул. Ленина 1", "Не включается станок", "new", null);
    reqStmt.run("ИП Сидоров", "+7(222)222-22-22", "пр. Мира 10", "Протекает кран", "assigned", 2); // мастеру Петру
    reqStmt.run("АО Техно", "+7(333)333-33-33", "ул. Гагарина 5", "Замена лампы", "in_progress", 3); // мастеру Ивану
    reqStmt.finalize();
  }
});

module.exports = db;