/*
 * line-game.js — финальная исправленная версия
 */
(() => {
    /* ---------- Константы ---------- */
    const COORD_MIN = -6, COORD_MAX = 6, UNIT = 40;
    const GRID = "#dfe6e9", AXIS = "#2c3e50";
    const CLICK_EPS = 0.3;

    /* ---------- Состояние ---------- */
    let A, B, k, m;                   // коэффициенты прямой
    let selected = [];                // выбранные пользователем точки
    let wins = 0, losses = 0;

    let canvas, ctx, origin;
    let hover = null;
    let uiLocked = false;
    let firstRoundStarted = false;    // фиксируем настройки таймера после 1-го ответа

    /* ---- таймер ---- */
    let timerOn = false;              // активирован ли таймер в текущем раунде
    let timerSec = 30;                // длительность (сек)
    let tRemain = 0;                  // сколько осталось
    let tId = null;                   // id setInterval

    /* ---------- DOM загрузился ---------- */
    document.addEventListener("DOMContentLoaded", () => {
        setupCanvas();
        document.getElementById("check-btn").addEventListener("click", checkAnswer);

        /* изменения чек-бокса или поля секунд до начала игры
           сразу перезапускают таймер (если он ещё не зафиксирован) */
        document.getElementById("timer-enable")
            .addEventListener("change", resetTimerSettingsIfAllowed);
        document.getElementById("timer-seconds")
            .addEventListener("input", resetTimerSettingsIfAllowed);

        newGame();        // стартуем первый раунд
    });

    /* ---------- Canvas ---------- */
    function setupCanvas() {
        const cont = document.getElementById("chart-container");
        canvas = document.createElement("canvas");
        canvas.width = 500; canvas.height = 500;
        canvas.style.border = "1px solid #ccc";
        cont.appendChild(canvas);

        ctx = canvas.getContext("2d");
        origin = { x: canvas.width / 2, y: canvas.height / 2 };

        canvas.addEventListener("click", onCanvasClick);
        canvas.addEventListener("mousemove", onCanvasHover);
    }

    /* ---------- Новый раунд ---------- */
    function newGame() {
        // 1) читаем настройки таймера, если они ещё «не заперты»
        if (!firstRoundStarted) readTimerControls();

        // 2) останавливаем прошлый отсчёт
        stopTimer();

        // 3) генерируем прямую  y = kx + m
        A = { x: 0, y: randInt(COORD_MIN, COORD_MAX) };
        do {
            B = {
                x: randInt(COORD_MIN, COORD_MAX),
                y: randInt(COORD_MIN, COORD_MAX)
            };
        } while (B.x === A.x);              // исключаем вертикаль

        k = (B.y - A.y) / (B.x - A.x);
        m = A.y;

        // 4) выводим уравнение
        const kTex = formatK(B.y - A.y, B.x - A.x);
        const mTex = m !== 0 ? (m > 0 ? ` + ${m}` : ` - ${Math.abs(m)}`) : "";
        document.getElementById("equation").innerHTML =
            `Уравнение прямой: $$y = ${kTex}x${mTex}$$`;
        if (window.MathJax) MathJax.typeset();

        // 5) сброс интерфейса
        selected = []; hover = null;
        document.getElementById("feedback").textContent = "";
        updateSelectedDom();
        unlockUI();
        draw();

        // 6) запускаем / скрываем отсчёт
        if (timerOn) startTimer();
        else document.getElementById("round-timer").textContent = "";
    }

    /* ---------- Таймер ---------- */
    function readTimerControls() {
        const chk = document.getElementById("timer-enable");
        const inp = document.getElementById("timer-seconds");

        timerOn = chk.checked;
        timerSec = Math.max(1, +inp.value || 30);
    }

    function resetTimerSettingsIfAllowed() {
        if (firstRoundStarted) return;  // настройки уже зафиксированы

        readTimerControls();            // обновляем timerOn / timerSec
        stopTimer();
        if (timerOn) startTimer();
    }

    function startTimer() {
        tRemain = timerSec;
        updateTimerDom();

        tId = setInterval(() => {
            tRemain--;
            updateTimerDom();

            if (tRemain <= 0) {
                clearInterval(tId);
                losses++;
                document.getElementById("feedback").style.color = "#e74c3c";
                document.getElementById("feedback").textContent = "Время вышло!";
                updateScoreDom();
                scheduleNextRound();
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(tId);
        document.getElementById("round-timer").textContent = "";
    }

    function updateTimerDom() {
        document.getElementById("round-timer").textContent = `⏱ ${tRemain} c`;
    }

    /* ---------- Проверка ответа ---------- */
    function checkAnswer() {
        /* Первый клик «Проверить»: фиксируем таймер-контролы */
        if (!firstRoundStarted) {
            firstRoundStarted = true;
            document.getElementById("timer-enable").disabled = true;
            document.getElementById("timer-seconds").disabled = true;
        }

        if (uiLocked) return;

        if (selected.length !== 2) {
            showMsg("Выберите ровно две точки!", "#e74c3c");
            return;
        }

        const [P1, P2] = selected;
        const ok1 = Math.abs(P1.y - (k * P1.x + m)) < 1e-3;
        const ok2 = Math.abs(P2.y - (k * P2.x + m)) < 1e-3;

        if (ok1 && ok2) {
            wins++; showMsg("Правильно!", "#27ae60");
        } else {
            losses++; showMsg("Неправильно.", "#e74c3c");
        }
        updateScoreDom();

        drawSolutionLine();             // зелёная
        scheduleNextRound();
    }

    /* ---------- Планируем следующий раунд ---------- */
    function scheduleNextRound() {
        lockUI();
        stopTimer();
        setTimeout(newGame, 3000);
    }

    /* ---------- Canvas events ---------- */
    function onCanvasClick(e) {
        if (uiLocked) return;
        const g = canvasToGraph(e.offsetX, e.offsetY);
        const sx = Math.round(g.x), sy = Math.round(g.y);
        if (Math.abs(g.x - sx) > CLICK_EPS || Math.abs(g.y - sy) > CLICK_EPS) return;
        if (selected.some(p => p.x === sx && p.y === sy)) return;
        if (selected.length < 2) {
            selected.push({ x: sx, y: sy });
            updateSelectedDom();
            draw();
        }
    }

    function onCanvasHover(e) {
        if (uiLocked) return;
        const g = canvasToGraph(e.offsetX, e.offsetY);
        const sx = Math.round(g.x), sy = Math.round(g.y);
        if (Math.abs(g.x - sx) > CLICK_EPS || Math.abs(g.y - sy) > CLICK_EPS)
            hover = null;
        else
            hover = { x: sx, y: sy };
        draw();
    }

    /* ---------- UI-helpers ---------- */
    function lockUI() { uiLocked = true; document.getElementById("check-btn").disabled = true; }
    function unlockUI() { uiLocked = false; document.getElementById("check-btn").disabled = false; }

    function updateSelectedDom() {
        document.getElementById("selected-points").innerHTML =
            selected.map((p, i) =>
                `<span class="selected-point">${String.fromCharCode(65 + i)}(${p.x},${p.y})</span>`
            ).join(" ");
    }

    function updateScoreDom() {
        document.getElementById("wins").textContent = wins;
        document.getElementById("losses").textContent = losses;
    }

    function showMsg(txt, color) {
        const box = document.getElementById("feedback");
        box.style.color = color;
        box.textContent = txt;
    }

    /* ---------- Рисование ---------- */
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        for (let x = COORD_MIN; x <= COORD_MAX; x++) {
            for (let y = COORD_MIN; y <= COORD_MAX; y++) {
                const sel = selected.some(p => p.x === x && p.y === y);
                const hov = hover && hover.x === x && hover.y === y;
                drawPoint(x, y,
                    sel ? "#27ae60" : hov ? "#a3e4d7" : "#e0e0e0",
                    sel || hov,
                    sel || hov ? 6 : 3
                );
            }
        }

        if (selected.length === 2) {
            const [P1, P2] = selected;
            const [E1, E2] = lineEnds(P1, P2);
            drawLine(E1, E2, "#3498db", 2, true);   // синяя пунктирная
        }
    }

    function drawSolutionLine() {
        drawLine({ x: COORD_MIN, y: k * COORD_MIN + m },
            { x: COORD_MAX, y: k * COORD_MAX + m },
            "#27ae60", 3, false);
    }

    function drawGrid() {
        ctx.save();

        /* сетка */
        ctx.lineWidth = 1;
        ctx.strokeStyle = GRID;
        for (let x = COORD_MIN; x <= COORD_MAX; x++) {
            const cx = origin.x + x * UNIT;
            ctx.beginPath();
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx, canvas.height);
            ctx.stroke();
        }
        for (let y = COORD_MIN; y <= COORD_MAX; y++) {
            const cy = origin.y - y * UNIT;
            ctx.beginPath();
            ctx.moveTo(0, cy);
            ctx.lineTo(canvas.width, cy);
            ctx.stroke();
        }

        /* оси */
        ctx.strokeStyle = AXIS;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(canvas.width, origin.y); ctx.stroke();

        /* подписи */
        ctx.fillStyle = AXIS;
        ctx.font = "12px Arial";

        // — X —
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (let x = COORD_MIN; x <= COORD_MAX; x++) {
            if (x === 0) continue;
            const cx = origin.x + x * UNIT;
            ctx.fillText(x, cx, origin.y + 4);
        }

        // — Y —
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for (let y = COORD_MIN; y <= COORD_MAX; y++) {
            if (y === 0) continue;
            const cy = origin.y - y * UNIT;
            ctx.fillText(y, origin.x + 4, cy);
        }

        ctx.restore();
      }

    function drawPoint(x, y, color, filled, r) {
        const c = graphToCanvas(x, y);
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 2 * Math.PI);
        filled ? ctx.fill() : ctx.stroke();
        ctx.restore();
    }

    function drawLine(P1, P2, color, width, dashed) {
        const p1 = graphToCanvas(P1.x, P1.y);
        const p2 = graphToCanvas(P2.x, P2.y);
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = width;
        if (dashed) ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        ctx.restore();
    }

    /* ---------- Геометрия ---------- */
    function lineEnds(P1, P2) {
        const a = P2.y - P1.y, b = P1.x - P2.x, c = -(a * P1.x + b * P1.y);
        const pts = [];
        for (const x of [COORD_MIN, COORD_MAX]) {
            const y = (-c - a * x) / b;
            if (y >= COORD_MIN - 1e-3 && y <= COORD_MAX + 1e-3) pts.push({ x, y });
        }
        for (const y of [COORD_MIN, COORD_MAX]) {
            const x = (-c - b * y) / a;
            if (x >= COORD_MIN - 1e-3 && x <= COORD_MAX + 1e-3) pts.push({ x, y });
        }
        return pts.slice(0, 2);
    }

    /* ---------- Утилиты ---------- */
    function graphToCanvas(x, y) { return { x: origin.x + x * UNIT, y: origin.y - y * UNIT }; }
    function canvasToGraph(cx, cy) { return { x: (cx - origin.x) / UNIT, y: (origin.y - cy) / UNIT }; }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    /* красивый TeX-коэффициент k */
    function formatK(num, den) {
        if (num % den === 0) {
            const v = num / den;
            if (v === 1) return "";
            if (v === -1) return "-";
            return String(v);
        }
        const sign = num * den < 0 ? "-" : "";
        num = Math.abs(num); den = Math.abs(den);
        const g = (a, b) => (b ? g(b, a % b) : a), d = g(num, den);
        num /= d; den /= d;
        return `${sign}\\frac{${num}}{${den}}`;
    }
})();