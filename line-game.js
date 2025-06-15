/*
 * line-game.js  – переработанная версия
 */
(() => {
    // ---------- Конфигурация ----------
    const COORD_MIN = -6, COORD_MAX = 6, UNIT_SIZE = 40;
    const AXIS_COLOR = "#2c3e50", GRID_COLOR = "#dfe6e9";
    const POINT_COLOR = "#e74c3c", LINE_COLOR = "#3498db";
    const CLICK_TOLERANCE = 0.3;

    // ---------- Переменные ----------
    let A, B, k, m;
    let selectedPoints = [];
    let wins = 0, losses = 0;

    let canvas, ctx, origin;
    let hoveredPoint = null;
    let uiLocked = false;          // блокировка на 3 с между раундами
    let firstRoundStarted = false; // чтобы таймер настраивался только один раз

    // --- таймер ---
    let timerActive = false;
    let timerDuration = 0;
    let timerRemaining = 0;
    let timerInterval = null;

    // ---------- Инициализация ----------
    document.addEventListener("DOMContentLoaded", () => {
        setupCanvas();
        document.getElementById("check-btn").addEventListener("click", checkSolution);
        newGame();          // сразу старт первой партии
    });

    // ---------- Canvas ----------
    function setupCanvas() {
        const container = document.getElementById("chart-container");
        container.innerHTML = "";
        canvas = document.createElement("canvas");
        canvas.width = 500; canvas.height = 500;
        canvas.style.border = "1px solid #ccc";
        container.appendChild(canvas);

        ctx = canvas.getContext("2d");
        origin = { x: canvas.width / 2, y: canvas.height / 2 };

        canvas.addEventListener("click", onCanvasClick);
        canvas.addEventListener("mousemove", onCanvasHover);
    }

    // ---------- Новый раунд ----------
    function newGame() {
        /* 1. Читаем настройки таймера при КАЖДОМ раунде,
              пока они не зафиксированы первым «Проверить» */
        if (!firstRoundStarted) {
            timerActive = document.getElementById("timer-enable").checked;
            timerDuration = Math.max(
                1,
                +document.getElementById("timer-seconds").value || 30
            );
        }

        stopTimer();   // останавливаем прошлый отсчёт

        /* 2. Случайная прямая  y = kx + m */
        A = { x: 0, y: randInt(COORD_MIN, COORD_MAX) };
        do {
            B = {
                x: randInt(COORD_MIN, COORD_MAX),
                y: randInt(COORD_MIN, COORD_MAX)
            };
        } while (B.x === A.x);

        k = (B.y - A.y) / (B.x - A.x);
        m = A.y;

        /* 3. Выводим уравнение (функция formatK уже есть) */
        const kTex = formatK(B.y - A.y, B.x - A.x);
        const mTex = m !== 0 ? (m > 0 ? ` + ${m}` : ` - ${Math.abs(m)}`) : "";
        document.getElementById("equation").innerHTML =
            `Уравнение прямой: $$y = ${kTex}x${mTex}$$`;
        if (window.MathJax) MathJax.typeset();

        /* 4. Сброс интерфейса и перерисовка */
        selectedPoints = [];
        hoveredPoint = null;
        document.getElementById("feedback").textContent = "";
        updateSelectedPoints();
        unlockUI();
        draw();

        /* 5. Запускаем обратный отсчёт, если включён */
        if (timerActive) startTimer();
        else document.getElementById("round-timer").textContent = "";
      }


    // ---------- Таймер ----------
    function startTimer() {
        timerRemaining = timerDuration;
        updateTimerDisplay();

        timerInterval = setInterval(() => {
            timerRemaining--;
            updateTimerDisplay();

            if (timerRemaining <= 0) {
                clearInterval(timerInterval);

                losses++;
                document.getElementById("feedback").style.color = "#e74c3c";
                document.getElementById("feedback").textContent = "Время вышло!";
                updateStats();
                scheduleNextRound();
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        document.getElementById("round-timer").textContent = "";
    }

    function updateTimerDisplay() {
        document.getElementById("round-timer").textContent =
            `⏱ ${timerRemaining} c`;
    }


    // ---------- Обработчики ----------
    function onCanvasClick(evt) {
        if (uiLocked) return;
        const { graphX, graphY } = canvasToGraph(evt.offsetX, evt.offsetY);
        const sx = Math.round(graphX), sy = Math.round(graphY);
        if (Math.abs(graphX - sx) > CLICK_TOLERANCE || Math.abs(graphY - sy) > CLICK_TOLERANCE) return;
        if (selectedPoints.some(p => p.x === sx && p.y === sy)) return;
        if (selectedPoints.length < 2) {
            selectedPoints.push({ x: sx, y: sy });
            updateSelectedPoints();
            draw();
        }
    }
    function onCanvasHover(evt) {
        if (uiLocked) return;
        const { graphX, graphY } = canvasToGraph(evt.offsetX, evt.offsetY);
        const sx = Math.round(graphX), sy = Math.round(graphY);
        if (Math.abs(graphX - sx) > CLICK_TOLERANCE || Math.abs(graphY - sy) > CLICK_TOLERANCE) {
            hoveredPoint = null;
        } else {
            hoveredPoint = { x: sx, y: sy };
        }
        draw();
    }

    // ---------- Проверка решения ----------
    function checkSolution() {
        if (!firstRoundStarted) {
            firstRoundStarted = true;
            document.getElementById("timer-enable").disabled = true;
            document.getElementById("timer-seconds").disabled = true;
          }
        if (uiLocked) return;
        if (selectedPoints.length !== 2) {
            document.getElementById("feedback").style.color = "#e74c3c";
            document.getElementById("feedback").textContent = "Выберите ровно две точки!";
            return;
        }

        const [P1, P2] = selectedPoints;
        const on1 = Math.abs(P1.y - (k * P1.x + m)) < 0.001;
        const on2 = Math.abs(P2.y - (k * P2.x + m)) < 0.001;

        if (on1 && on2) {
            wins++;
            document.getElementById("feedback").style.color = "#27ae60";
            document.getElementById("feedback").textContent = "Правильно!";
        } else {
            losses++;
            document.getElementById("feedback").style.color = "#e74c3c";
            document.getElementById("feedback").textContent = "Неправильно.";
        }
        updateStats();
        drawSolutionLine(); // зелёная прямая
        scheduleNextRound();
    }

    function scheduleNextRound() {
        lockUI();
        stopTimer();
        setTimeout(newGame, 3000);
    }

    // ---------- UI-helpers ----------
    function lockUI() {
        uiLocked = true;
        document.getElementById("check-btn").disabled = true;
    }
    function unlockUI() {
        uiLocked = false;
        document.getElementById("check-btn").disabled = false;
    }
    function updateSelectedPoints() {
        const box = document.getElementById("selected-points");
        box.innerHTML = selectedPoints.map((p, i) => `<span class="selected-point">${String.fromCharCode(65 + i)}(${p.x},${p.y})</span>`).join(" ");
    }
    function updateStats() {
        document.getElementById("wins").textContent = wins;
        document.getElementById("losses").textContent = losses;
    }

    // ---------- Рисование ----------
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        // все точки
        for (let x = COORD_MIN; x <= COORD_MAX; x++) {
            for (let y = COORD_MIN; y <= COORD_MAX; y++) {
                const sel = selectedPoints.some(p => p.x === x && p.y === y);
                const hov = hoveredPoint && hoveredPoint.x === x && hoveredPoint.y === y;
                drawPoint(x, y, sel ? "#27ae60" : hov ? "#a3e4d7" : "#e0e0e0", sel || hov, sel ? 6 : (hov ? 6 : 3));
            }
        }

        // пунктирная линия, но "бесконечная"
        if (selectedPoints.length === 2) {
            const [P1, P2] = selectedPoints;
            const ends = lineThroughBounds(P1, P2);
            drawLine(ends[0], ends[1], "#3498db", 2, true);
        }
    }
    function drawSolutionLine() {
        const x1 = COORD_MIN, y1 = k * x1 + m;
        const x2 = COORD_MAX, y2 = k * x2 + m;
        drawLine({ x: x1, y: y1 }, { x: x2, y: y2 }, "#27ae60", 3, false);
    }
    function drawGrid() {
        ctx.save(); ctx.lineWidth = 1;
        ctx.strokeStyle = GRID_COLOR;
        for (let x = COORD_MIN; x <= COORD_MAX; x++) {
            const cx = origin.x + x * UNIT_SIZE;
            ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
        }
        for (let y = COORD_MIN; y <= COORD_MAX; y++) {
            const cy = origin.y - y * UNIT_SIZE;
            ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
        }
        ctx.strokeStyle = AXIS_COLOR; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y); ctx.stroke();
        ctx.fillStyle = AXIS_COLOR; ctx.font = "12px Arial";
        for (let x = COORD_MIN; x <= COORD_MAX; x++) { if (x !== 0) { const cx = origin.x + x * UNIT_SIZE; ctx.fillText(x, cx - 4, origin.y + 14); } }
        for (let y = COORD_MIN; y <= COORD_MAX; y++) { if (y !== 0) { const cy = origin.y - y * UNIT_SIZE; ctx.fillText(y, origin.x + 6, cy + 4); } }
        ctx.restore();
    }
    function drawPoint(x, y, color, filled, r) {
        const { canvasX, canvasY } = graphToCanvas(x, y);
        ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(canvasX, canvasY, r, 0, 2 * Math.PI);
        filled ? ctx.fill() : ctx.stroke(); ctx.restore();
    }
    function drawLine(P1, P2, color, width, dashed) {
        const p1 = graphToCanvas(P1.x, P1.y), p2 = graphToCanvas(P2.x, P2.y);
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width;
        if (dashed) ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(p1.canvasX, p1.canvasY); ctx.lineTo(p2.canvasX, p2.canvasY); ctx.stroke();
        ctx.restore();
    }

    // ---------- Геометрия ----------
    function lineThroughBounds(P1, P2) {
        // коэффициенты прямой a*x + b*y + c = 0
        const a = P2.y - P1.y;
        const b = P1.x - P2.x;
        const c = -(a * P1.x + b * P1.y);

        const bounds = [];
        // x = COORD_MIN … MAX
        for (let x of [COORD_MIN, COORD_MAX]) {
            const y = (-c - a * x) / b;
            if (y >= COORD_MIN - 0.001 && y <= COORD_MAX + 0.001) bounds.push({ x, y });
        }
        // y = COORD_MIN … MAX
        for (let y of [COORD_MIN, COORD_MAX]) {
            const x = (-c - b * y) / a;
            if (x >= COORD_MIN - 0.001 && x <= COORD_MAX + 0.001) bounds.push({ x, y });
        }
        // должно быть 2 точки
        return bounds.slice(0, 2);
    }

    // ---------- Утилиты ----------
    // Возвращает строку для коэффициента k в TeX-формате
    function formatK(num, den) {
        // 1) целое число
        if (num % den === 0) {
            const kInt = num / den;
            if (kInt === 1) return "";   //  y =  x …
            if (kInt === -1) return "-";  //  y = -x …
            return kInt.toString();       //  y = 3x …
        }

        // 2) дробь
        let sign = (num * den < 0) ? "-" : "";
        num = Math.abs(num);            // показатели без знаков
        den = Math.abs(den);

        // сокращаем
        const g = (a, b) => b ? g(b, a % b) : a;
        const d = g(num, den);
        num /= d; den /= d;

        return `${sign} \\frac{${num}}{${den}}`;
  }
    function graphToCanvas(x, y) {
        return { canvasX: origin.x + x * UNIT_SIZE, canvasY: origin.y - y * UNIT_SIZE };
    }
    function canvasToGraph(cx, cy) {
        return { graphX: (cx - origin.x) / UNIT_SIZE, graphY: (origin.y - cy) / UNIT_SIZE };
    }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function simplifyFraction(num, den) {
        const g = (a, b) => b ? g(b, a % b) : a, d = g(Math.abs(num), Math.abs(den));
        return { num: num / d, den: den / d };
    }
})();