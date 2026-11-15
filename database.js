const Database = require('better-sqlite3');

// Создаем файл базы данных (если его нет, он появится автоматически)
const db = new Database('water_tracker.db');

// ==========================================
// 1. СОЗДАНИЕ ТАБЛИЦ
// ==========================================

// Таблица пользователей
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    daily_goal INTEGER DEFAULT 2000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Таблица записей о воде
db.exec(`
  CREATE TABLE IF NOT EXISTS water_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

// ==========================================
// 2. ИНДЕКСЫ (для ускорения поиска)
// ==========================================

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_logs_user_date 
  ON water_logs(user_id, date)
`);

console.log('✅ База данных инициализирована.');

// ==========================================
// 3. СОЗДАНИЕ ТЕСТОВОГО ПОЛЬЗОВАТЕЛЯ
// ==========================================

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();

if (userCount.count === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (id, telegram_id) 
    VALUES (1, 'test_user_1')
  `);
  insertUser.run();
  console.log('✅ Тестовый пользователь успешно создан.');
}

module.exports = db;