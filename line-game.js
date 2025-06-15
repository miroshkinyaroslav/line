/*
 * line-game.js
 * Vanilla JS implementation of a small game: the player must click two given
 * points on a Cartesian plane. No external dependencies required.
 *
 * Author: ChatGPT demo вЂ“ June 2025
 */

(() => {
    // --- CONFIG --------------------------------------------------------------
    // Integer coordinate range that will definitely be visible on the board
    const COORD_MIN = -6;
    const COORD_MAX = 6;
    const AXIS_COLOR = "#2c3e50";
    const GRID_COLOR = "#dfe6e9";
    const POINT_TARGET_COLOR = "#e74c3c"; // when shown as marker (cheat mode)
    const POINT_FOUND_COLOR = "#27ae60";
    const UNIT_SIZE = 40; // pixels per one unit of graph (chosen for 500Г—500 px)
    const CLICK_TOLERANCE = 0.3; // В± units within which click counts as correct

    // --- STATE ---------------------------------------------------------------
    let points = []; /** @type {Array<{ x:number, y:number, found:boolean }>} */
    let canvas, ctx, origin;

    // --- INITIALISATION ------------------------------------------------------
    document.addEventListener("DOMContentLoaded", () => {
        setupCanvas();
        document.getElementById("new-game-btn").addEventListener("click", newGame);
        newGame();
    });

    function setupCanvas() {
        const container = document.getElementById("chart-container");
        // Clear any previous canvas (in case of restart)
        container.innerHTML = "";

        canvas = document.createElement("canvas");
        canvas.width = 500;
        canvas.height = 500;
        canvas.style.border = "1px solid #ccc";
        container.appendChild(canvas);

        ctx = canvas.getContext("2d");

        // Origin in the middle of the canvas
        origin = { x: canvas.width / 2, y: canvas.height / 2 };

        canvas.addEventListener("click", onCanvasClick);
    }

    // --- GAME LOGIC ----------------------------------------------------------
    function newGame() {
        // Generate two distinct random integer points within range
        points = [];
        while (points.length < 2) {
            const x = randInt(COORD_MIN, COORD_MAX);
            const y = randInt(COORD_MIN, COORD_MAX);
            if (!points.some(p => p.x === x && p.y === y)) {
                points.push({ x, y, found: false });
            }
        }

        // Update UI list
        const listEl = document.getElementById("points-list");
        listEl.innerHTML = "";
        points.forEach((p, idx) => {
            const span = document.createElement("span");
            span.className = "point";
            span.id = `point-${idx}`;
            span.textContent = `${String.fromCharCode(65 + idx)}(${p.x}, ${p.y})`;
            listEl.appendChild(span);
        });

        document.getElementById("feedback").textContent = "";

        draw();
    }

    function onCanvasClick(evt) {
        const { graphX, graphY } = canvasToGraph(evt.offsetX, evt.offsetY);

        // Find the first not-yet-found point that is within tolerance
        const idx = points.findIndex(
            p => !p.found && distance(p.x, p.y, graphX, graphY) <= CLICK_TOLERANCE
        );

        if (idx !== -1) {
            // Correct!
            points[idx].found = true;
            document.getElementById(`point-${idx}`).classList.add("found");
            document.getElementById("feedback").textContent = `Верно! Точка ${String.fromCharCode(65 + idx)} найдена.`;

            if (points.every(p => p.found)) {
                document.getElementById("feedback").textContent =
                    "Поздравляем! Все точки найдены.";
            }
        } else {
            document.getElementById("feedback").textContent = "Нет, попробуйте еще раз.";
        }

        draw();
    }

    // --- RENDERING -----------------------------------------------------------
    function draw() {
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw base grid & axes
        drawGrid();

        // Draw found points as green filled circles
        points.forEach(p => {
            if (p.found) {
                drawPoint(p.x, p.y, POINT_FOUND_COLOR, true);
            }
        });

        // Uncomment to always show targets (debug/cheat)
        // points.forEach(p => drawPoint(p.x, p.y, POINT_TARGET_COLOR, false));
    }

    function drawGrid() {
        ctx.save();
        ctx.lineWidth = 1;

        // Grid lines
        ctx.strokeStyle = GRID_COLOR;
        for (let x = COORD_MIN; x <= COORD_MAX; x++) {
            const canvasX = origin.x + x * UNIT_SIZE;
            ctx.beginPath();
            ctx.moveTo(canvasX, 0);
            ctx.lineTo(canvasX, canvas.height);
            ctx.stroke();
        }
        for (let y = COORD_MIN; y <= COORD_MAX; y++) {
            const canvasY = origin.y - y * UNIT_SIZE;
            ctx.beginPath();
            ctx.moveTo(0, canvasY);
            ctx.lineTo(canvas.width, canvasY);
            ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = AXIS_COLOR;
        ctx.lineWidth = 2;
        // y-axis
        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, canvas.height);
        ctx.stroke();
        // x-axis
        ctx.beginPath();
        ctx.moveTo(0, origin.y);
        ctx.lineTo(canvas.width, origin.y);
        ctx.stroke();

        // Labels
        ctx.fillStyle = AXIS_COLOR;
        ctx.font = "12px Arial";
        for (let x = COORD_MIN; x <= COORD_MAX; x++) {
            if (x === 0) continue;
            const canvasX = origin.x + x * UNIT_SIZE;
            ctx.fillText(x.toString(), canvasX - 4, origin.y + 14);
        }
        for (let y = COORD_MIN; y <= COORD_MAX; y++) {
            if (y === 0) continue;
            const canvasY = origin.y - y * UNIT_SIZE;
            ctx.fillText(y.toString(), origin.x + 6, canvasY + 4);
        }

        ctx.restore();
    }

    function drawPoint(x, y, color, filled) {
        const { canvasX, canvasY } = graphToCanvas(x, y);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        if (filled) {
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, 6, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, 5, 0, 2 * Math.PI);
            ctx.stroke();
        }

        ctx.restore();
    }

    // --- UTILITY -------------------------------------------------------------
    function graphToCanvas(x, y) {
        return {
            canvasX: origin.x + x * UNIT_SIZE,
            canvasY: origin.y - y * UNIT_SIZE
        };
    }

    function canvasToGraph(canvasX, canvasY) {
        return {
            graphX: (canvasX - origin.x) / UNIT_SIZE,
            graphY: (origin.y - canvasY) / UNIT_SIZE
        };
    }

    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function distance(x1, y1, x2, y2) {
        return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    }
})();