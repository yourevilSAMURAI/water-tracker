// ==========================================================================
// 1. КОНФИГУРАЦИЯ И СОСТОЯНИЕ
// ==========================================================================
const dailyGoal = 2000;
const circumference = 2 * Math.PI * 88;
let isJournalView = false;
let db = {}; 
let isSending = false; // Защита от спама

const tg = window.Telegram?.WebApp;
const currentUserId = (tg?.initDataUnsafe?.user) ? tg.initDataUnsafe.user.id : 1;

if (tg) {
    tg.ready();
    tg.expand();
}
console.log(`ID пользователя: ${currentUserId} (${tg?.initDataUnsafe?.user ? 'Telegram' : 'Браузер'})`);

let today = getToday();
let activeDate = today;
let warningShownDate = localStorage.getItem('warningShownDate') || "";

const circle = document.getElementById('progress-circle');
const currentText = document.getElementById('current-amount');
const undoBtn = document.getElementById('undo-btn');
const factText = document.getElementById('fact-text');

// Функция для безопасной передачи данных Телеграма на сервер
function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (tg?.initData) {
        headers['X-Telegram-Init-Data'] = tg.initData;
    }
    return headers;
}

// ==========================================================================
// 2. API ЗАПРОСЫ
// ==========================================================================
async function fetchHistoryFromServer() {
    try {
        const response = await fetch('/api/water', { headers: getHeaders() });
        const logs = await response.json();
        
        const formattedData = {};
        logs.forEach(log => {
            if (!formattedData[log.date]) formattedData[log.date] = [];
            formattedData[log.date].push({ id: log.id, amount: log.amount, time: log.time });
        });
        
        return formattedData;
    } catch (error) {
        console.error("Ошибка загрузки с сервера:", error);
        return {};
    }
}

// Визуальная блокировка кнопок на время запроса
function setLoadingState(isLoading) {
    isSending = isLoading;
    const buttons = document.querySelectorAll('.water-btn, .action-btn, .custom-input');
    buttons.forEach(btn => {
        if (isLoading) btn.style.opacity = '0.5';
        else btn.style.opacity = '1';
    });
}

function addWater(amount) {
    if (isSending) return; 
    setLoadingState(true);

    const now = new Date();
    const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const dateString = getToday(); 
    
    fetch('/api/water', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount, date: dateString, time: timeString })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log("✅ Сохранено! ID:", data.id);
            if (!db[activeDate]) db[activeDate] = [];
            db[activeDate].push({ id: data.id, amount: amount, time: timeString });
            updateUI();
            checkOverLimit();
        } else {
            alert("Ошибка сервера: " + data.error);
        }
    })
    .catch(error => {
        console.error("Ошибка сети:", error);
        alert("Нет связи с сервером. Проверьте интернет.");
    })
    .finally(() => setLoadingState(false));
}

function undoLast() {
    if (isSending) return; 
    if (!db[activeDate] || db[activeDate].length === 0) return;
    
    const lastRecord = db[activeDate][db[activeDate].length - 1];
    if (!lastRecord.id) return alert("Обновите страницу");

    setLoadingState(true);

    fetch(`/api/water/${lastRecord.id}`, { 
        method: 'DELETE',
        headers: getHeaders()
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log("🗑️ Удалено!");
            db[activeDate].pop(); 
            updateUI(); 
        }
    })
    .catch(error => console.error("Ошибка сети:", error))
    .finally(() => setLoadingState(false));
}

// ==========================================================================
// 3. UI (Отрисовка интерфейса)
// ==========================================================================
function updateUI() {
    const currentToday = getToday();
    if (currentToday !== today) {
        if (activeDate === today) activeDate = currentToday; 
        today = currentToday;
    }

    const actions = db[activeDate] || [];
    const totalWater = actions.reduce((sum, item) => sum + item.amount, 0);
    
    currentText.textContent = totalWater;
    
    let percent = totalWater / dailyGoal;
    if (percent > 1) percent = 1;
    const offset = circumference - percent * circumference;
    circle.style.strokeDashoffset = offset;

    undoBtn.disabled = actions.length === 0;
    renderJournal(actions);
}

function renderJournal(actions) {
    const list = document.getElementById('daily-journal');
    list.innerHTML = '';
    
    if (actions.length === 0) {
        list.innerHTML = '<li style="color: #888; justify-content: center;">Нет записей</li>';
        return;
    }
    
    [...actions].reverse().forEach(action => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${action.time}</span> <span>${action.amount} мл</span>`;
        list.appendChild(li);
    });
}

function renderCalendar() {
    updateUI();
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    document.getElementById('history-month-year').textContent = `${monthNames[month]} ${year}`;

    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        if (dateStr > today) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'calendar-day disabled';
            emptyDiv.innerHTML = `<div>${i}</div><div class="day-glass"><div class="day-glass-fill" style="height: 0%"></div></div>`;
            grid.appendChild(emptyDiv);
            continue; 
        }

        const actions = db[dateStr] || [];
        const totalWater = actions.reduce((sum, item) => sum + item.amount, 0);
        
        let glassPercent = (totalWater / dailyGoal) * 100;
        if (glassPercent > 100) glassPercent = 100;

        const dayDiv = document.createElement('div');
        dayDiv.className = `calendar-day ${dateStr === today ? 'today' : ''} ${dateStr === activeDate ? 'active' : ''}`;
        dayDiv.innerHTML = `<div>${i}</div><div class="day-glass"><div class="day-glass-fill" style="height: ${glassPercent}%"></div></div>`;
        
        dayDiv.onclick = () => {
            activeDate = dateStr; 
            updateUI(); 
            renderCalendar(); 
        };
        grid.appendChild(dayDiv);
    }
}

function toggleHistoryView() {
    isJournalView = !isJournalView;
    const calendarView = document.getElementById('calendar-view');
    const journalView = document.getElementById('journal-view');
    const toggleBtn = document.getElementById('view-toggle-btn');
    const panelTitle = document.getElementById('history-month-year');

    if (isJournalView) {
        calendarView.style.display = 'none';
        journalView.style.display = 'block';
        toggleBtn.textContent = 'Календарь';
        panelTitle.textContent = 'ЖУРНАЛ ВОДЫ';
        
        const activeDateObj = new Date(activeDate);
        const day = activeDateObj.getDate();
        const monthNames = ["Января", "Февраля", "Марта", "Апреля", "Мая", "Июня", "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"];
        document.getElementById('journal-title').textContent = `ЗАПИСИ ЗА ${day} ${monthNames[activeDateObj.getMonth()]}`;
    } else {
        calendarView.style.display = 'block';
        journalView.style.display = 'none';
        toggleBtn.textContent = 'Журнал воды';
        renderCalendar(); 
    }
}

// ==========================================================================
// 4. УТИЛИТЫ (Факты, Темы, Даты)
// ==========================================================================
function getToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function checkOverLimit() {
    const actions = db[activeDate] || [];
    const totalWater = actions.reduce((sum, item) => sum + item.amount, 0);
    
    if (totalWater > dailyGoal * 1.15 && activeDate === today && warningShownDate !== today) {
        document.getElementById('modal-title').textContent = "ВНИМАНИЕ";
        document.getElementById('modal-text').innerHTML = "Вы выпили значительно больше нормы. Чрезмерное потребление воды может привести к водной интоксикации (гипонатриемии), когда уровень натрия в крови падает до опасно низкого уровня, а также создает излишнюю нагрузку на почки.<br><br><b>Будьте внимательны, следите за состоянием своего здоровья, не пренебрегайте сигналами организма.</b>";
        openModal('warning-modal');
        warningShownDate = today;
        localStorage.setItem('warningShownDate', today);
    }
}

const facts = [
    "Вода составляет около 60% массы тела взрослого человека.",
    "Вода помогает регулировать температуру тела и смазывать суставы.",
    "Организм теряет воду не только с потом, но и просто при дыхании.",
    "Вода необходима для выработки энергии и работы мозга.",
    "Около 20% потребляемой жидкости мы получаем из еды (супы, фрукты, овощи).",
    "Кровь человека состоит примерно на 90% из воды.",
    "Мышцы человека на 75% состоят из воды.",
    "Даже легкое обезвоживание может вызвать усталость и снизить концентрацию.",
    "Почки взрослого человека перекачивают около 180 литров жидкости в сутки.",
    "Кости человека содержат около 22% воды."
];

function changeFact() {
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * facts.length);
    } while (facts[newIndex] === factText.textContent && facts.length > 1);
    factText.textContent = facts[newIndex];
}

function toggleTheme() {
    const body = document.body;
    const subtitle = document.getElementById('subtitle-text');
    const themeBtn = document.getElementById('theme-btn');

    if (body.hasAttribute('data-theme')) {
        body.removeAttribute('data-theme');
        localStorage.setItem('waterTheme', 'light');
        themeBtn.textContent = 'Тема: Cold';
        subtitle.textContent = 'Cold Wave Hydration System';
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('waterTheme', 'dark');
        themeBtn.textContent = 'Тема: Dark';
        subtitle.textContent = 'Dark Wave Hydration System';
    }
}

function togglePanel(panelId) {
    updateUI();
    const panels = document.querySelectorAll('.side-panel');
    panels.forEach(panel => {
        if (panel.id === panelId) panel.classList.toggle('show');
        else panel.classList.remove('show');
    });
    if (panelId === 'history-panel' && document.getElementById(panelId).classList.contains('show')) {
        if (isJournalView) toggleHistoryView();
        renderCalendar();
    }
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openResetModal() { openModal('reset-modal'); }

function executeReset() {
    if (isSending) return;
    setLoadingState(true);

    fetch(`/api/water/all`, { 
        method: 'DELETE',
        headers: getHeaders()
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log("🗑️ Все данные удалены!");
            localStorage.removeItem('warningShownDate');
            window.location.reload();
        }
    })
    .catch(error => {
        console.error("Ошибка при сбросе:", error);
        alert("Не удалось сбросить данные. Проверьте интернет.");
    })
    .finally(() => setLoadingState(false));
}

function addCustomWater() {
    const input = document.getElementById('custom-amount');
    const amount = parseInt(input.value);
    
    if (isNaN(amount) || amount <= 0 || amount > 3000) {
        input.value = '';
        input.placeholder = 'Свой объём (мл)';
        return;
    }
    
    addWater(amount); 
    input.value = ''; 
    input.placeholder = 'Свой объём (мл)';
}

// ==========================================================================
// 5. ИНИЦИАЛИЗАЦИЯ И СОБЫТИЯ
// ==========================================================================
const savedTheme = localStorage.getItem('waterTheme');
if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('theme-btn').textContent = 'Тема: Dark';
    document.getElementById('subtitle-text').textContent = 'Dark Wave Hydration System';
}

document.getElementById('custom-amount').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        addCustomWater();
        this.blur(); 
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal('warning-modal');
        closeModal('reset-modal');
        document.querySelectorAll('.side-panel').forEach(panel => {
            panel.classList.remove('show');
        });
    }
});

setInterval(() => {
    const currentToday = getToday();
    if (currentToday !== today) {
        today = currentToday;
        updateUI(); 
        if (document.getElementById('history-panel').classList.contains('show')) {
            renderCalendar();
        }
    }
}, 60000); 

async function startApp() {
    db = await fetchHistoryFromServer();
    updateUI();
}

startApp();