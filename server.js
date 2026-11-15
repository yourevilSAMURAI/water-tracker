const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, './')));

// Хелперы (теперь асинхронные)
async function getOrCreateUserId(telegramId) {
    const result = await db.execute({
        sql: 'SELECT id FROM users WHERE telegram_id = ?',
        args: [telegramId.toString()]
    });
    
    if (result.rows.length > 0) {
        return result.rows[0].id;
    }

    const insertResult = await db.execute({
        sql: 'INSERT INTO users (telegram_id) VALUES (?)',
        args: [telegramId.toString()]
    });
    return insertResult.lastInsertRowid;
}

function validateWaterData({ userId, amount, date, time }) {
    if (!userId) return 'Не указан userId';
    if (!date) return 'Не указана дата';
    if (!time) return 'Не указано время';
    if (!amount || amount <= 0 || amount > 5000) return 'Некорректное количество воды';
    return null;
}

// Маршруты
app.get('/api/ping', (req, res) => {
    res.json({ message: 'Сервер работает!', status: 'ok' });
});

app.post('/api/water', async (req, res) => {
    const { userId, amount, date, time } = req.body;
    const errorMessage = validateWaterData({ userId, amount, date, time });
    if (errorMessage) return res.status(400).json({ error: errorMessage });

    try {
        const dbUserId = await getOrCreateUserId(userId);
        
        const result = await db.execute({
            sql: 'INSERT INTO water_logs (user_id, amount, date, time) VALUES (?, ?, ?, ?)',
            args: [dbUserId, amount, date, time]
        });

        console.log(`📥 Добавлено ${amount} мл для пользователя ${userId}. ID: ${result.lastInsertRowid}`);
        res.json({ success: true, id: Number(result.lastInsertRowid) });
    } catch (error) {
        console.error('❌ Ошибка при добавлении воды:', error);
        res.status(500).json({ error: 'Ошибка базы данных' });
    }
});

app.get('/api/water', async (req, res) => {
    const { userId, date } = req.query;
    if (!userId) return res.status(400).json({ error: 'Не указан userId' });

    try {
        const userResult = await db.execute({
            sql: 'SELECT id FROM users WHERE telegram_id = ?',
            args: [userId.toString()]
        });
        
        if (userResult.rows.length === 0) return res.json([]);
        const dbUserId = userResult.rows[0].id;

        let result;
        if (date) {
            result = await db.execute({
                sql: 'SELECT * FROM water_logs WHERE user_id = ? AND date = ? ORDER BY id DESC',
                args: [dbUserId, date]
            });
        } else {
            result = await db.execute({
                sql: 'SELECT * FROM water_logs WHERE user_id = ? ORDER BY id DESC',
                args: [dbUserId]
            });
        }

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Ошибка при получении данных:', error);
        res.status(500).json({ error: 'Ошибка при получении данных' });
    }
});

app.delete('/api/water/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.execute({
            sql: 'DELETE FROM water_logs WHERE id = ?',
            args: [id]
        });

        if (result.rowsAffected > 0) {
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

// Запуск сервера
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    });
});