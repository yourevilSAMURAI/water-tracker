const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto'); 
const { db, initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; 

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, './')));

// Мидлвар для проверки подлинности данных из Telegram
function verifyTelegramData(req, res, next) {
    if (!BOT_TOKEN) {
        console.warn("⚠️ TELEGRAM_BOT_TOKEN не задан. Защита отключена!");
        req.userId = req.body.userId || req.query.userId || 1; 
        return next();
    }

    const initData = req.headers['x-telegram-init-data'];
    if (!initData) {
        req.userId = 1;
        return next();
    }

    try {
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        urlParams.delete('hash');
        
        const dataCheckString = Array.from(urlParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        if (calculatedHash !== hash) {
            return res.status(403).json({ error: 'Неверная подпись Телеграма' });
        }

        const user = JSON.parse(urlParams.get('user'));
        req.userId = user.id;
        next();
    } catch (error) {
        console.error('Ошибка валидации initData:', error);
        res.status(500).json({ error: 'Ошибка проверки безопасности' });
    }
}

app.use('/api', verifyTelegramData);

// ==========================================================================
// ХЕЛПЕРЫ
// ==========================================================================
async function getOrCreateUserId(telegramId) {
    await db.execute({
        sql: 'INSERT OR IGNORE INTO users (telegram_id) VALUES (?)',
        args: [telegramId.toString()]
    });
    const result = await db.execute({
        sql: 'SELECT id FROM users WHERE telegram_id = ?',
        args: [telegramId.toString()]
    });
    return result.rows[0].id;
}

function validateWaterData({ amount, date, time }) {
    if (!date) return 'Не указана дата';
    if (!time) return 'Не указано время';
    if (!amount || amount <= 0 || amount > 5000) return 'Некорректное количество воды';
    return null;
}

// ==========================================================================
// МАРШРУТЫ
// ==========================================================================
app.get('/api/ping', (req, res) => res.json({ message: 'Сервер работает!', status: 'ok' }));

app.post('/api/water', async (req, res) => {
    const { amount, date, time } = req.body;
    const errorMessage = validateWaterData({ amount, date, time });
    if (errorMessage) return res.status(400).json({ error: errorMessage });

    try {
        const dbUserId = await getOrCreateUserId(req.userId);
        const result = await db.execute({
            sql: 'INSERT INTO water_logs (user_id, amount, date, time) VALUES (?, ?, ?, ?)',
            args: [dbUserId, amount, date, time]
        });

        console.log(`📥 Добавлено ${amount} мл для пользователя ${req.userId}. ID: ${result.lastInsertRowid}`);
        res.json({ success: true, id: Number(result.lastInsertRowid) });
    } catch (error) {
        console.error('❌ Ошибка при добавлении воды:', error);
        res.status(500).json({ error: 'Ошибка базы данных' });
    }
});

app.get('/api/water', async (req, res) => {
    try {
        const userResult = await db.execute({
            sql: 'SELECT id FROM users WHERE telegram_id = ?',
            args: [req.userId.toString()]
        });
        
        if (userResult.rows.length === 0) return res.json([]);
        const dbUserId = userResult.rows[0].id;

        // Запрашиваем историю за последние 60 дней
        const result = await db.execute({
            sql: "SELECT * FROM water_logs WHERE user_id = ? AND date >= date('now', '-60 days') ORDER BY id DESC",
            args: [dbUserId]
        });

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Ошибка при получении данных:', error);
        res.status(500).json({ error: 'Ошибка при получении данных' });
    }
});

app.delete('/api/water/all', async (req, res) => {
    try {
        const userResult = await db.execute({
            sql: 'SELECT id FROM users WHERE telegram_id = ?',
            args: [req.userId.toString()]
        });
        
        if (userResult.rows.length > 0) {
            await db.execute({
                sql: 'DELETE FROM water_logs WHERE user_id = ?',
                args: [userResult.rows[0].id]
            });
            console.log(`🗑️ Вся история удалена для пользователя ${req.userId}`);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Ошибка при сбросе данных:', error);
        res.status(500).json({ error: 'Ошибка при сбросе данных' });
    }
});

app.delete('/api/water/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.execute({
            sql: 'DELETE FROM water_logs WHERE id = ? AND user_id = (SELECT id FROM users WHERE telegram_id = ?)',
            args: [id, req.userId.toString()]
        });

        if (result.rowsAffected > 0) {
            console.log(`🗑️ Удалена запись с ID: ${id}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Запись не найдена или нет прав' });
        }
    } catch (error) {
        console.error('❌ Ошибка при удалении:', error);
        res.status(500).json({ error: 'Ошибка при удалении' });
    }
});

(async () => {
    try {
        await initDB();
        app.listen(PORT, () => console.log(`🚀 Сервер запущен на http://localhost:${PORT}`));
    } catch (error) {
        console.error("Сервер не запущен из-за ошибки БД.");
    }
})();