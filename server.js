const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();

// 👇 Позволяет использовать порт хостинга при деплое (Render/Railway), а локально — 3000
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. MIDDLEWARE (прослойки)
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, './')));

// ==========================================
// 2. ХЕЛПЕРЫ (вспомогательные функции)
// ==========================================

/**
 * Возвращает внутренний ID пользователя по его Telegram ID.
 * Если пользователя нет — создает нового.
 */
function getOrCreateUserId(telegramId) {
  const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId.toString());
  
  if (user) {
    return user.id;
  }

  const insertUser = db.prepare('INSERT INTO users (telegram_id) VALUES (?)');
  const info = insertUser.run(telegramId.toString());
  return info.lastInsertRowid;
}

/**
 * Валидация входящих данных для добавления воды.
 * Возвращает текст ошибки или null, если всё ок.
 */
function validateWaterData({ userId, amount, date, time }) {
  if (!userId) return 'Не указан userId';
  if (!date) return 'Не указана дата';
  if (!time) return 'Не указано время';
  if (!amount || amount <= 0 || amount > 5000) return 'Некорректное количество воды';
  return null;
}

// ==========================================
// 3. МАРШРУТЫ (API)
// ==========================================

// Тестовый пинг
app.get('/api/ping', (req, res) => {
  res.json({ message: 'Сервер работает!', status: 'ok' });
});

// --- ДОБАВЛЕНИЕ ВОДЫ (POST) ---
app.post('/api/water', (req, res) => {
  const { userId, amount, date, time } = req.body;

  // Валидация
  const errorMessage = validateWaterData({ userId, amount, date, time });
  if (errorMessage) {
    return res.status(400).json({ error: errorMessage });
  }

  try {
    // Получаем (или создаем) внутренний ID пользователя
    const dbUserId = getOrCreateUserId(userId);

    // Записываем воду
    const insert = db.prepare(`
      INSERT INTO water_logs (user_id, amount, date, time) 
      VALUES (?, ?, ?, ?)
    `);
    const result = insert.run(dbUserId, amount, date, time);

    // Логирование в консоль сервера (для отладки)
    console.log(`📥 Добавлено ${amount} мл для пользователя ${userId}. ID записи: ${result.lastInsertRowid}`);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('❌ Ошибка при добавлении воды:', error);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

// --- ПОЛУЧЕНИЕ ВОДЫ (GET) ---
app.get('/api/water', (req, res) => {
  const { userId, date } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Не указан userId' });
  }

  try {
    // Находим внутренний ID пользователя (без создания нового)
    const user = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(userId.toString());
    
    // Если пользователь еще не пил воду — возвращаем пустой массив
    if (!user) {
      return res.json([]);
    }

    // Ищем записи (все или за конкретную дату)
    let logs;
    if (date) {
      logs = db.prepare(
        'SELECT * FROM water_logs WHERE user_id = ? AND date = ? ORDER BY id DESC'
      ).all(user.id, date);
    } else {
      logs = db.prepare(
        'SELECT * FROM water_logs WHERE user_id = ? ORDER BY id DESC'
      ).all(user.id);
    }

    res.json(logs);
  } catch (error) {
    console.error('❌ Ошибка при получении данных:', error);
    res.status(500).json({ error: 'Ошибка при получении данных' });
  }
});

// --- УДАЛЕНИЕ ЗАПИСИ (DELETE) ---
app.delete('/api/water/:id', (req, res) => {
  const { id } = req.params;

  try {
    const deleteStmt = db.prepare('DELETE FROM water_logs WHERE id = ?');
    const result = deleteStmt.run(id);

    if (result.changes > 0) {
      console.log(`🗑️ Удалена запись с ID: ${id}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Запись не найдена' });
    }
  } catch (error) {
    console.error('❌ Ошибка при удалении:', error);
    res.status(500).json({ error: 'Ошибка при удалении' });
  }
});

// ==========================================
// 4. ЗАПУСК СЕРВЕРА
// ==========================================

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📂 Статика раздается из: ${path.join(__dirname, '../public')}`);
});
