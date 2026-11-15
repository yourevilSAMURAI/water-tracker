// --- 1. БЕЗОПАСНАЯ ЗАГРУЗКА ДАННЫХ (Защита от битого localStorage) ---
function loadData() {
    try {
        let data = JSON.parse(localStorage.getItem('waterHistoryV3'));
        return data || {};
    } catch (e) {
        console.warn("Данные были повреждены. Сброс.");
        localStorage.removeItem('waterHistoryV3');
        return {};
    }
}

let dailyGoal = 2000;
const circumference = 2 * Math.PI * 88;
let db = loadData();
let isJournalView = false; 

// Флаг предупреждения теперь привязан к конкретной дате
let warningShownDate = localStorage.getItem('warningShownDate') || "";

// Умная функция получения сегодняшней даты
function getToday() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

let today = getToday();
let activeDate = today;

const circle = document.getElementById('progress-circle');
const currentText = document.getElementById('current-amount');
const undoBtn = document.getElementById('undo-btn');

// --- 2. МАССИВ ФАКТОВ ---
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
    const factText = document.getElementById('fact-text');
    let newIndex;
    // Ищем новый факт, который не совпадает с текущим
    do {
        newIndex = Math.floor(Math.random() * facts.length);
    } while (facts[newIndex] === factText.textContent && facts.length > 1);
    
    factText.textContent = facts[newIndex];
}

// --- 3. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ---
function updateUI() {
    // Проверка на смену дня (если мы все еще смотрим "сегодня", переключаемся на новый)
    let currentToday = getToday();
    if (currentToday !== today) {
        if (activeDate === today) activeDate = currentToday; // Если смотрели старый сегодня, перекидываем на новый
        today = currentToday;
    }

    let actions = db[activeDate] || [];
    let totalWater = actions.reduce((sum, item) => sum + item.amount, 0);
    
    currentText.textContent = totalWater;
    
    let percent = totalWater / dailyGoal;
    if (percent > 1) percent = 1;
    const offset = circumference - percent * circumference;
    circle.style.strokeDashoffset = offset;

    undoBtn.disabled = actions.length === 0;
    renderJournal(actions);
}

function saveData() {
    localStorage.setItem('waterHistoryV3', JSON.stringify(db));
}

// --- 4. ДОБАВЛЕНИЕ ВОДЫ ---
function addWater(amount) {
    updateUI(); // Проверяем, не наступил ли новый день

    if (!db[activeDate]) db[activeDate] = [];
    const timeString = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    db[activeDate].push({ amount: amount, time: timeString });
    
    saveData();
    updateUI();

    let totalWater = db[activeDate].reduce((sum, item) => sum + item.amount, 0);

    // Показываем предупреждение, только если сегодня дата еще не сохранялась в localStorage
    if (totalWater > dailyGoal * 1.15 && activeDate === today && warningShownDate !== today) {
        document.getElementById('modal-title').textContent = "ВНИМАНИЕ";
        document.getElementById('modal-text').innerHTML = "Вы выпили значительно больше нормы. Чрезмерное потребление воды может привести к водной интоксикации (гипонатриемии), когда уровень натрия в крови падает до опасно низкого уровня, а также создает излишнюю нагрузку на почки.<br><br><b>Будьте внимательны, следите за состоянием своего здоровья, не пренебрегайте сигналами организма.</b>";
        openModal('warning-modal');
        warningShownDate = today;
        localStorage.setItem('warningShownDate', today); // Запоминаем дату
    }
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

// Обработка нажатия Enter в поле ввода
document.getElementById('custom-amount').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        addCustomWater();
        this.blur(); // Убираем фокус (прячем клавиатуру на телефоне)
    }
});

function undoLast() {
    if (db[activeDate] && db[activeDate].length > 0) {
        db[activeDate].pop();
        saveData();
        updateUI();
    }
}

// --- 5. ЖУРНАЛ И ПЕРЕКЛЮЧЕНИЕ ВИДОВ ---
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

// --- 6. МОДАЛКИ И СБРОС ---
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openResetModal() { openModal('reset-modal'); }

// Закрытие по Escape (модалки и панели)
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // 1. Закрываем модалки
        closeModal('warning-modal');
        closeModal('reset-modal');
        
        // 2. Закрываем все открытые боковые панели
        document.querySelectorAll('.side-panel').forEach(panel => {
            panel.classList.remove('show');
        });
    }
});

function executeReset() {
    localStorage.removeItem('waterHistoryV3');
    localStorage.removeItem('warningShownDate'); // Сбрасываем и флаг предупреждения
    window.location.reload();
}

// --- 7. ПАНЕЛИ И КАЛЕНДАРЬ ---
function togglePanel(panelId) {
    updateUI(); // Проверяем дату при открытии панели
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

function renderCalendar() {
    updateUI(); // Обновляем дату
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
        
        // Блокируем будущие дни
        if (dateStr > today) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'calendar-day disabled';
            emptyDiv.innerHTML = `<div>${i}</div><div class="day-glass"><div class="day-glass-fill" style="height: 0%"></div></div>`;
            grid.appendChild(emptyDiv);
            continue; // Пропускаем добавление обработчика клика
        }

        let actions = db[dateStr] || [];
        let totalWater = actions.reduce((sum, item) => sum + item.amount, 0);
        
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

// --- 8. ТЕМА (COLD / DARK) ---
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

// --- ИНИЦИАЛИЗАЦИЯ ---
const savedTheme = localStorage.getItem('waterTheme');
if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('theme-btn').textContent = 'Тема: Dark';
    document.getElementById('subtitle-text').textContent = 'Dark Wave Hydration System';
}

// --- 9. АВТООБНОВЛЕНИЕ ДАТЫ (Проверка полуночи) ---
let lastCheckedToday = getToday();

setInterval(() => {
    const currentToday = getToday();
    // Если день сменился
    if (currentToday !== lastCheckedToday) {
        lastCheckedToday = currentToday;
        updateUI(); // Обновляем основной экран
        // Если открыта панель прогресса — перерисовываем календарь
        if (document.getElementById('history-panel').classList.contains('show')) {
            renderCalendar();
        }
    }
}, 60000); // Проверка раз в минуту

updateUI();