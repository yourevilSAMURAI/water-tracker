const { createClient } = require('@libsql/client');

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function initDB() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id TEXT UNIQUE NOT NULL,
                daily_goal INTEGER DEFAULT 2000,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS water_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.execute(`
            CREATE INDEX IF NOT EXISTS idx_logs_user_date ON water_logs(user_id, date)
        `);

        console.log('✅ База данных Turso инициализирована.');
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ Ошибка инициализации БД:', error);
        throw error; // Останавливаем запуск сервера, если база не работает
    }
}

module.exports = { db, initDB };