const COLS = 10;
const ROWS = 20;
const BLOCK = 32;
const LOCK_DELAY = 550;
const QUEUE_SIZE = 5;
const SCORE_TABLE = [0, 100, 300, 500, 800];

const TETROMINOES = {
  I: {
    color: "#48e5ff",
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  O: {
    color: "#ffd34d",
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: "#cf62ff",
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  S: {
    color: "#6fff8d",
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  Z: {
    color: "#ff648b",
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  J: {
    color: "#4e7cff",
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  L: {
    color: "#ffb157",
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
};

const boardCanvas = document.getElementById("board");
const nextCanvas = document.getElementById("next");
const holdCanvas = document.getElementById("hold");
const overlay = document.getElementById("overlay");
const overlayLabel = document.getElementById("overlay-label");
const overlayButton = document.getElementById("overlay-button");
const startPauseButton = document.getElementById("startPause");
const restartButton = document.getElementById("restart");
const toast = document.getElementById("toast");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const statusEl = document.getElementById("status");

const boardContext = boardCanvas.getContext("2d");
const nextContext = nextCanvas.getContext("2d");
const holdContext = holdCanvas.getContext("2d");

const state = {
  board: createBoard(),
  bag: [],
  queue: [],
  current: null,
  hold: null,
  holdUsed: false,
  score: 0,
  lines: 0,
  level: 1,
  combo: -1,
  status: "playing",
  lastTime: 0,
  fallAccumulator: 0,
  lockAccumulator: 0,
};

let toastTimer = 0;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function copyMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function shuffle(items) {
  const array = items.slice();

  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }

  return array;
}

function refillQueue() {
  while (state.queue.length < QUEUE_SIZE) {
    if (state.bag.length === 0) {
      state.bag = shuffle(Object.keys(TETROMINOES));
    }

    state.queue.push(state.bag.pop());
  }
}

function firstOccupiedRow(matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    if (matrix[y].some(Boolean)) {
      return y;
    }
  }

  return 0;
}

function createPiece(type) {
  const matrix = copyMatrix(TETROMINOES[type].matrix);
  const width = matrix[0].length;

  return {
    type,
    matrix,
    x: Math.floor((COLS - width) / 2),
    y: -firstOccupiedRow(matrix),
  };
}

function collides(piece) {
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (!piece.matrix[y][x]) {
        continue;
      }

      const boardX = piece.x + x;
      const boardY = piece.y + y;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }

      if (boardY >= 0 && state.board[boardY][boardX]) {
        return true;
      }
    }
  }

  return false;
}

function setCurrentPiece(type) {
  state.current = createPiece(type);
  state.lockAccumulator = 0;
  state.fallAccumulator = 0;

  if (collides(state.current)) {
    endGame();
  }
}

function spawnNextPiece() {
  refillQueue();
  const nextType = state.queue.shift();
  refillQueue();
  setCurrentPiece(nextType);
  state.holdUsed = false;
}

function resetGame() {
  state.board = createBoard();
  state.bag = [];
  state.queue = [];
  state.current = null;
  state.hold = null;
  state.holdUsed = false;
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.combo = -1;
  state.status = "playing";
  state.lastTime = 0;
  state.fallAccumulator = 0;
  state.lockAccumulator = 0;

  refillQueue();
  spawnNextPiece();
  syncHud();
  syncOverlay();
  draw();
  showToast("READY");
}

function getDropInterval() {
  return Math.max(90, 940 - (state.level - 1) * 65);
}

function syncHud() {
  scoreEl.textContent = state.score.toLocaleString("ja-JP");
  linesEl.textContent = state.lines.toLocaleString("ja-JP");
  levelEl.textContent = String(state.level);
  statusEl.textContent =
    state.status === "playing" ? "RUN" : state.status === "paused" ? "PAUSE" : "OVER";

  startPauseButton.textContent =
    state.status === "playing" ? "一時停止" : state.status === "paused" ? "再開" : "もう一度";
}

function syncOverlay() {
  if (state.status === "paused") {
    overlay.classList.remove("hidden");
    overlayLabel.textContent = "PAUSED";
    overlayButton.textContent = "再開";
    return;
  }

  if (state.status === "over") {
    overlay.classList.remove("hidden");
    overlayLabel.textContent = "GAME OVER";
    overlayButton.textContent = "もう一度";
    return;
  }

  overlay.classList.add("hidden");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 900);
}

function endGame() {
  state.status = "over";
  syncHud();
  syncOverlay();
  showToast("GAME OVER");
}

function mergePiece() {
  for (let y = 0; y < state.current.matrix.length; y += 1) {
    for (let x = 0; x < state.current.matrix[y].length; x += 1) {
      if (!state.current.matrix[y][x]) {
        continue;
      }

      const boardX = state.current.x + x;
      const boardY = state.current.y + y;

      if (boardY < 0) {
        endGame();
        return;
      }

      state.board[boardY][boardX] = state.current.type;
    }
  }
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (state.board[y].every(Boolean)) {
      state.board.splice(y, 1);
      state.board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    state.combo += 1;
    const baseScore = SCORE_TABLE[cleared] * state.level;
    const comboBonus = state.combo > 0 ? state.combo * 50 * state.level : 0;
    const previousLevel = state.level;

    state.lines += cleared;
    state.level = Math.floor(state.lines / 10) + 1;
    state.score += baseScore + comboBonus;

    if (cleared === 4) {
      showToast("TETRIS");
    } else if (state.level > previousLevel) {
      showToast(`LEVEL ${state.level}`);
    } else {
      showToast(`${cleared} LINE CLEAR`);
    }
  } else {
    state.combo = -1;
  }
}

function lockPiece() {
  mergePiece();

  if (state.status === "over") {
    return;
  }

  clearLines();
  spawnNextPiece();
  syncHud();
}

function isGrounded(piece = state.current) {
  if (!piece) {
    return false;
  }

  const test = {
    ...piece,
    y: piece.y + 1,
  };

  return collides(test);
}

function attemptMove(dx, dy) {
  if (state.status !== "playing" || !state.current) {
    return false;
  }

  const moved = {
    ...state.current,
    x: state.current.x + dx,
    y: state.current.y + dy,
  };

  if (collides(moved)) {
    return false;
  }

  state.current = moved;
  state.lockAccumulator = 0;
  return true;
}

function softDrop() {
  if (state.status !== "playing") {
    return;
  }

  if (attemptMove(0, 1)) {
    state.score += 1;
    state.fallAccumulator = 0;
    syncHud();
  }
}

function hardDrop() {
  if (state.status !== "playing" || !state.current) {
    return;
  }

  let distance = 0;

  while (attemptMove(0, 1)) {
    distance += 1;
  }

  if (distance > 0) {
    state.score += distance * 2;
    syncHud();
  }

  lockPiece();
}

function rotateMatrix(matrix, direction) {
  const transposed = matrix[0].map((_, column) => matrix.map((row) => row[column]));
  return direction > 0 ? transposed.map((row) => row.reverse()) : transposed.reverse();
}

function rotatePiece(direction) {
  if (state.status !== "playing" || !state.current) {
    return;
  }

  const rotated = rotateMatrix(state.current.matrix, direction);
  const kicks =
    state.current.type === "I"
      ? [
          [0, 0],
          [1, 0],
          [-1, 0],
          [2, 0],
          [-2, 0],
          [0, -1],
          [1, -1],
          [-1, -1],
        ]
      : [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, -1],
          [2, 0],
          [-2, 0],
          [1, -1],
          [-1, -1],
        ];

  for (const [offsetX, offsetY] of kicks) {
    const candidate = {
      ...state.current,
      matrix: rotated,
      x: state.current.x + offsetX,
      y: state.current.y + offsetY,
    };

    if (!collides(candidate)) {
      state.current = candidate;
      state.lockAccumulator = 0;
      return;
    }
  }
}

function holdPiece() {
  if (state.status !== "playing" || !state.current || state.holdUsed) {
    return;
  }

  const currentType = state.current.type;

  if (state.hold) {
    const heldType = state.hold;
    state.hold = currentType;
    setCurrentPiece(heldType);
  } else {
    state.hold = currentType;
    spawnNextPiece();
  }

  if (state.status === "over") {
    return;
  }

  state.holdUsed = true;
  showToast("HOLD");
}

function togglePause() {
  if (state.status === "over") {
    return;
  }

  state.status = state.status === "playing" ? "paused" : "playing";
  syncHud();
  syncOverlay();
}

function shadeColor(hex, amount) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const clamp = (channel) => Math.min(255, Math.max(0, channel));

  const red = clamp((value >> 16) + amount);
  const green = clamp(((value >> 8) & 0xff) + amount);
  const blue = clamp((value & 0xff) + amount);

  return `rgb(${red}, ${green}, ${blue})`;
}

function drawCell(context, x, y, size, color, alpha = 1) {
  const pixelX = x * size;
  const pixelY = y * size;

  context.save();
  context.globalAlpha = alpha;

  const fill = context.createLinearGradient(pixelX, pixelY, pixelX + size, pixelY + size);
  fill.addColorStop(0, shadeColor(color, 35));
  fill.addColorStop(0.55, color);
  fill.addColorStop(1, shadeColor(color, -32));

  context.fillStyle = fill;
  context.fillRect(pixelX + 1, pixelY + 1, size - 2, size - 2);

  context.strokeStyle = shadeColor(color, 70);
  context.lineWidth = 2;
  context.strokeRect(pixelX + 2, pixelY + 2, size - 4, size - 4);

  context.fillStyle = "rgba(255, 255, 255, 0.16)";
  context.fillRect(pixelX + 5, pixelY + 5, size - 14, 5);
  context.restore();
}

function drawGhost() {
  const ghost = {
    ...state.current,
    matrix: copyMatrix(state.current.matrix),
    x: state.current.x,
    y: state.current.y,
  };

  while (!collides({ ...ghost, y: ghost.y + 1 })) {
    ghost.y += 1;
  }

  boardContext.save();
  boardContext.strokeStyle = TETROMINOES[state.current.type].color;
  boardContext.lineWidth = 2;
  boardContext.globalAlpha = 0.28;

  for (let y = 0; y < ghost.matrix.length; y += 1) {
    for (let x = 0; x < ghost.matrix[y].length; x += 1) {
      if (!ghost.matrix[y][x]) {
        continue;
      }

      const drawX = ghost.x + x;
      const drawY = ghost.y + y;

      if (drawY < 0) {
        continue;
      }

      boardContext.strokeRect(drawX * BLOCK + 4, drawY * BLOCK + 4, BLOCK - 8, BLOCK - 8);
    }
  }

  boardContext.restore();
}

function drawBoardBackground() {
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  const boardGradient = boardContext.createLinearGradient(0, 0, 0, boardCanvas.height);
  boardGradient.addColorStop(0, "#070d20");
  boardGradient.addColorStop(1, "#03050b");
  boardContext.fillStyle = boardGradient;
  boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  boardContext.strokeStyle = "rgba(120, 164, 224, 0.1)";
  boardContext.lineWidth = 1;

  for (let x = 1; x < COLS; x += 1) {
    boardContext.beginPath();
    boardContext.moveTo(x * BLOCK + 0.5, 0);
    boardContext.lineTo(x * BLOCK + 0.5, boardCanvas.height);
    boardContext.stroke();
  }

  for (let y = 1; y < ROWS; y += 1) {
    boardContext.beginPath();
    boardContext.moveTo(0, y * BLOCK + 0.5);
    boardContext.lineTo(boardCanvas.width, y * BLOCK + 0.5);
    boardContext.stroke();
  }
}

function drawBoard() {
  drawBoardBackground();

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const type = state.board[y][x];
      if (!type) {
        continue;
      }

      drawCell(boardContext, x, y, BLOCK, TETROMINOES[type].color);
    }
  }

  if (!state.current) {
    return;
  }

  drawGhost();

  for (let y = 0; y < state.current.matrix.length; y += 1) {
    for (let x = 0; x < state.current.matrix[y].length; x += 1) {
      if (!state.current.matrix[y][x]) {
        continue;
      }

      const drawX = state.current.x + x;
      const drawY = state.current.y + y;

      if (drawY < 0) {
        continue;
      }

      drawCell(boardContext, drawX, drawY, BLOCK, TETROMINOES[state.current.type].color);
    }
  }
}

function drawMiniPiece(context, type, centerX, offsetY, cellSize) {
  const { matrix, color } = TETROMINOES[type];
  let minX = matrix[0].length;
  let maxX = 0;
  let minY = matrix.length;
  let maxY = 0;

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) {
        continue;
      }

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const startX = centerX - (width * cellSize) / 2;
  const startY = offsetY + (4 * cellSize - height * cellSize) / 2;

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) {
        continue;
      }

      context.save();
      context.translate(startX, startY);
      drawCell(context, x - minX, y - minY, cellSize, color);
      context.restore();
    }
  }
}

function drawHold() {
  holdContext.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  holdContext.fillStyle = "rgba(6, 10, 20, 0.96)";
  holdContext.fillRect(0, 0, holdCanvas.width, holdCanvas.height);

  if (state.hold) {
    drawMiniPiece(holdContext, state.hold, holdCanvas.width / 2, 20, 24);
  }
}

function drawQueue() {
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextContext.fillStyle = "rgba(6, 10, 20, 0.96)";
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  state.queue.slice(0, QUEUE_SIZE).forEach((type, index) => {
    drawMiniPiece(nextContext, type, nextCanvas.width / 2, index * 84 + 8, 22);
  });
}

function draw() {
  drawBoard();
  drawHold();
  drawQueue();
}

function update(delta) {
  if (state.status !== "playing" || !state.current) {
    return;
  }

  state.fallAccumulator += delta;

  if (state.fallAccumulator >= getDropInterval()) {
    state.fallAccumulator = 0;
    attemptMove(0, 1);
  }

  if (isGrounded()) {
    state.lockAccumulator += delta;

    if (state.lockAccumulator >= LOCK_DELAY) {
      lockPiece();
    }
  } else {
    state.lockAccumulator = 0;
  }
}

function loop(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const delta = timestamp - state.lastTime;
  state.lastTime = timestamp;

  update(delta);
  draw();
  window.requestAnimationFrame(loop);
}

function handleKeyDown(event) {
  const gameKeys = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowDown",
    "ArrowUp",
    "Space",
    "KeyZ",
    "KeyX",
    "KeyC",
    "ShiftLeft",
    "ShiftRight",
    "KeyP",
  ];

  if (gameKeys.includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "KeyP") {
    togglePause();
    return;
  }

  if (state.status !== "playing") {
    if (state.status === "over" && event.code === "Enter") {
      resetGame();
    }
    return;
  }

  switch (event.code) {
    case "ArrowLeft":
    case "KeyA":
      attemptMove(-1, 0);
      break;
    case "ArrowRight":
    case "KeyD":
      attemptMove(1, 0);
      break;
    case "ArrowDown":
    case "KeyS":
      softDrop();
      break;
    case "ArrowUp":
    case "KeyX":
    case "KeyW":
      rotatePiece(1);
      break;
    case "KeyZ":
    case "ControlLeft":
      rotatePiece(-1);
      break;
    case "Space":
      hardDrop();
      break;
    case "KeyC":
    case "ShiftLeft":
    case "ShiftRight":
      holdPiece();
      break;
    default:
      break;
  }
}

function invokeAction(action) {
  switch (action) {
    case "left":
      attemptMove(-1, 0);
      break;
    case "right":
      attemptMove(1, 0);
      break;
    case "down":
      softDrop();
      break;
    case "rotateLeft":
      rotatePiece(-1);
      break;
    case "rotateRight":
      rotatePiece(1);
      break;
    case "drop":
      hardDrop();
      break;
    case "hold":
      holdPiece();
      break;
    case "pause":
      if (state.status === "over") {
        resetGame();
      } else {
        togglePause();
      }
      break;
    default:
      break;
  }
}

function bindTouchControls() {
  const repeatableActions = new Set(["left", "right", "down"]);

  document.querySelectorAll("[data-action]").forEach((button) => {
    let repeatTimeout = 0;
    let repeatInterval = 0;

    const stopRepeat = () => {
      window.clearTimeout(repeatTimeout);
      window.clearInterval(repeatInterval);
    };

    const startRepeat = (event) => {
      event.preventDefault();
      const { action } = button.dataset;

      invokeAction(action);

      if (!repeatableActions.has(action)) {
        return;
      }

      repeatTimeout = window.setTimeout(() => {
        repeatInterval = window.setInterval(() => {
          invokeAction(action);
        }, 90);
      }, 170);
    };

    button.addEventListener("pointerdown", startRepeat);
    button.addEventListener("pointerup", stopRepeat);
    button.addEventListener("pointerleave", stopRepeat);
    button.addEventListener("pointercancel", stopRepeat);
  });
}

window.addEventListener("keydown", handleKeyDown, { passive: false });
startPauseButton.addEventListener("click", () => {
  if (state.status === "over") {
    resetGame();
    return;
  }

  togglePause();
});

restartButton.addEventListener("click", resetGame);
overlayButton.addEventListener("click", () => {
  if (state.status === "over") {
    resetGame();
  } else {
    togglePause();
  }
});

bindTouchControls();
resetGame();
window.requestAnimationFrame(loop);
