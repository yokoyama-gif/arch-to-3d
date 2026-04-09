const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const WIDTH = 256;
const HEIGHT = 240;
const HUD_HEIGHT = 32;
const TILE = 16;
const MAP_W = WIDTH / TILE;
const MAP_H = (HEIGHT - HUD_HEIGHT) / TILE;
const PLAYER_SPEED = 1.6;
const PLAYER_JUMP = -4.9;
const GRAVITY = 0.28;
const MAX_FALL = 6;

const palette = {
  sky: "#112237",
  sky2: "#18354b",
  hudBg: "#05060c",
  hudLine: "#31576f",
  text: "#f4edce",
  accent: "#f8b94a",
  brick: "#285a8e",
  brickDark: "#173656",
  brickLite: "#74a9d8",
  spike: "#ef5d4c",
  spikeShadow: "#792f27",
  door: "#4dbb63",
  doorLocked: "#647384",
  key: "#ffd84f",
  playerSkin: "#f8d2a7",
  playerShirt: "#f9f2db",
  playerPants: "#3962d5",
  playerBoots: "#b14937",
  playerCap: "#ef5d4c",
  walker: "#ff9a3b",
  walkerDark: "#843f12",
  hopper: "#b46cff",
  hopperDark: "#4f2b76",
  glider: "#67f0ff",
  gliderDark: "#184e69",
  shadow: "rgba(0, 0, 0, 0.25)",
};

const stars = Array.from({ length: 28 }, (_, i) => ({
  x: (17 + i * 29) % WIDTH,
  y: HUD_HEIGHT + 8 + ((i * 19) % (HEIGHT - HUD_HEIGHT - 20)),
  c: i % 3 === 0 ? "#32587b" : i % 3 === 1 ? "#214763" : "#497396",
}));

const keys = {
  left: false,
  right: false,
  jump: false,
  start: false,
  justJump: false,
  justStart: false,
};

const audio = {
  ctx: null,
  ensure() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  },
  tone(freq, duration, type = "square", volume = 0.03, delay = 0) {
    if (!this.ctx) {
      return;
    }
    const at = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(at);
    osc.stop(at + duration);
  },
  jump() {
    this.tone(330, 0.05, "square", 0.02);
  },
  key() {
    this.tone(540, 0.07, "square", 0.028);
    this.tone(720, 0.1, "square", 0.02, 0.05);
  },
  hit() {
    this.tone(180, 0.12, "sawtooth", 0.03);
  },
  clear() {
    this.tone(440, 0.08, "square", 0.025);
    this.tone(660, 0.08, "square", 0.02, 0.08);
    this.tone(880, 0.16, "square", 0.018, 0.16);
  },
  extra() {
    this.tone(660, 0.06, "triangle", 0.025);
    this.tone(990, 0.12, "triangle", 0.02, 0.06);
  },
};

// Add more rooms here. Each stage stays data-driven on purpose.
const STAGES = [
  {
    name: "First Steps",
    map: [
      "................",
      "................",
      "..........###...",
      "................",
      "......###.......",
      "................",
      "...###..........",
      "................",
      "...........###..",
      "................",
      ".###............",
      "................",
      "################",
    ],
    playerStart: { x: 1, row: 12 },
    key: { x: 12, y: 1 },
    exit: { x: 14, row: 12 },
    enemies: [
      { type: "walker", x: 8, row: 12, dir: -1, speed: 0.82 },
      { type: "walker", x: 4, row: 6, dir: 1, speed: 0.62 },
    ],
  },
  {
    name: "Spike Skip",
    map: [
      "................",
      ".......###......",
      "................",
      "...###.....###..",
      "................",
      ".........###....",
      "................",
      ".###............",
      "................",
      ".............##.",
      "................",
      "....^^....^^....",
      "################",
    ],
    playerStart: { x: 1, row: 12 },
    key: { x: 8, y: 0 },
    exit: { x: 14, row: 12 },
    enemies: [
      { type: "walker", x: 12, row: 12, dir: -1, speed: 0.86 },
      { type: "hopper", x: 12, row: 3, dir: -1, speed: 0.92 },
      { type: "walker", x: 2, row: 7, dir: 1, speed: 0.74 },
    ],
  },
  {
    name: "Air Mail",
    map: [
      "................",
      "....###.........",
      "................",
      "..........###...",
      "................",
      "...###..........",
      "...........##...",
      "................",
      "......###.......",
      "................",
      ".##.......###...",
      ".....^^^^.......",
      "################",
    ],
    playerStart: { x: 1, row: 12 },
    key: { x: 4, y: 0 },
    exit: { x: 12, row: 3 },
    enemies: [
      { type: "glider", x: 7, y: 6, axis: "x", min: 3, max: 12, dir: 1, speed: 0.78 },
      { type: "walker", x: 7, row: 8, dir: 1, speed: 0.8 },
      { type: "hopper", x: 11, row: 10, dir: -1, speed: 0.94 },
    ],
  },
  {
    name: "Split Lift",
    map: [
      "................",
      "......##...##...",
      "................",
      "..##......##....",
      "................",
      ".......###......",
      "................",
      ".###........###.",
      "................",
      ".....##.........",
      "................",
      "..^^....^^^^....",
      "################",
    ],
    playerStart: { x: 1, row: 12 },
    key: { x: 12, y: 0 },
    exit: { x: 2, row: 3 },
    enemies: [
      { type: "glider", x: 8, y: 5, axis: "y", min: 2, max: 9, dir: 1, speed: 0.56 },
      { type: "walker", x: 13, row: 7, dir: -1, speed: 0.84 },
      { type: "hopper", x: 7, row: 5, dir: 1, speed: 1.02 },
      { type: "walker", x: 2, row: 7, dir: 1, speed: 0.77 },
    ],
  },
  {
    name: "Crossfire",
    map: [
      "................",
      "...##......##...",
      "................",
      "........###.....",
      "................",
      "..###......###..",
      "................",
      ".......##.......",
      "................",
      ".##.........##..",
      "................",
      "^^^...^^^^...^^^",
      "################",
    ],
    playerStart: { x: 1, row: 12 },
    key: { x: 13, y: 8 },
    exit: { x: 9, row: 3 },
    enemies: [
      { type: "glider", x: 8, y: 1, axis: "x", min: 4, max: 12, dir: 1, speed: 0.92 },
      { type: "walker", x: 3, row: 5, dir: 1, speed: 0.88 },
      { type: "hopper", x: 12, row: 5, dir: -1, speed: 1.04 },
      { type: "glider", x: 10, y: 9, axis: "x", min: 5, max: 13, dir: -1, speed: 0.7 },
    ],
  },
  {
    name: "Lock Tower",
    map: [
      ".......##.......",
      "................",
      "...##......##...",
      "................",
      "......###.......",
      "................",
      ".##..........##.",
      "................",
      "......##........",
      ".............##.",
      "................",
      ".^^..^^..^^..^^.",
      "################",
    ],
    playerStart: { x: 1, row: 12 },
    key: { x: 12, y: 1 },
    exit: { x: 3, row: 2 },
    enemies: [
      { type: "glider", x: 5, y: 2, axis: "y", min: 1, max: 10, dir: 1, speed: 0.66 },
      { type: "glider", x: 10, y: 4, axis: "x", min: 6, max: 13, dir: -1, speed: 0.9 },
      { type: "hopper", x: 13, row: 6, dir: -1, speed: 1.08 },
      { type: "walker", x: 2, row: 6, dir: 1, speed: 0.91 },
      { type: "walker", x: 6, row: 8, dir: -1, speed: 0.84 },
    ],
  },
];

const game = {
  state: "title",
  stateTimer: 0,
  stageIndex: 0,
  loop: 0,
  lives: 3,
  score: 0,
  nextLifeScore: 3000,
  hasKey: false,
  player: null,
  key: null,
  exit: null,
  enemies: [],
  map: STAGES[0].map,
  frame: 0,
};

function groundSpawn(tx, row, w, h) {
  return {
    x: Math.round(tx * TILE + (TILE - w) / 2),
    y: Math.round(HUD_HEIGHT + row * TILE - h),
  };
}

function cellSpawn(tx, ty, w, h) {
  return {
    x: Math.round(tx * TILE + (TILE - w) / 2),
    y: Math.round(HUD_HEIGHT + ty * TILE + (TILE - h) / 2),
  };
}

function createPlayer(spawn) {
  const pos = groundSpawn(spawn.x, spawn.row, 12, 14);
  return {
    ...pos,
    spawn,
    w: 12,
    h: 14,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    invincible: 45,
  };
}

function createEnemy(data, speedScale) {
  if (data.type === "glider") {
    const pos = cellSpawn(data.x, data.y, 12, 12);
    return {
      ...data,
      ...pos,
      w: 12,
      h: 12,
      speed: data.speed * speedScale,
      minPx: data.axis === "x" ? data.min * TILE + 2 : HUD_HEIGHT + data.min * TILE + 2,
      maxPx: data.axis === "x" ? data.max * TILE + 2 : HUD_HEIGHT + data.max * TILE + 2,
    };
  }

  const pos = groundSpawn(data.x, data.row, 12, 12);
  return {
    ...data,
    ...pos,
    w: 12,
    h: 12,
    vx: 0,
    vy: 0,
    onGround: false,
    dir: data.dir || 1,
    speed: data.speed * speedScale,
    hopTimer: 36,
  };
}

function stageNumber() {
  return game.loop * STAGES.length + game.stageIndex + 1;
}

function loadStage(index) {
  game.stageIndex = index;
  const stage = STAGES[index];
  const speedScale = 1 + game.loop * 0.12;
  game.map = stage.map;
  game.hasKey = false;
  game.player = createPlayer(stage.playerStart);
  game.key = {
    ...cellSpawn(stage.key.x, stage.key.y, 10, 10),
    w: 10,
    h: 10,
    taken: false,
  };
  game.exit = {
    ...groundSpawn(stage.exit.x, stage.exit.row, 12, 18),
    w: 12,
    h: 18,
    unlocked: false,
  };
  game.enemies = stage.enemies.map((enemy) => createEnemy(enemy, speedScale));
  game.state = "intro";
  game.stateTimer = 72;
}

function startGame() {
  game.score = 0;
  game.nextLifeScore = 3000;
  game.lives = 3;
  game.loop = 0;
  game.frame = 0;
  loadStage(0);
}

function addScore(points) {
  game.score += points;
  while (game.score >= game.nextLifeScore) {
    game.nextLifeScore += 3000;
    game.lives = Math.min(game.lives + 1, 9);
    audio.extra();
  }
}

function loseLife() {
  if (game.state !== "playing") {
    return;
  }
  audio.hit();
  game.lives -= 1;
  game.state = "dead";
  game.stateTimer = 72;
}

function clearStage() {
  if (game.state !== "playing") {
    return;
  }
  addScore(500 + stageNumber() * 40);
  audio.clear();
  game.state = "clear";
  game.stateTimer = 84;
}

function nextStage() {
  let nextIndex = game.stageIndex + 1;
  if (nextIndex >= STAGES.length) {
    nextIndex = 0;
    game.loop += 1;
  }
  loadStage(nextIndex);
}

function padScore(value) {
  return String(value).padStart(6, "0");
}

function mapCharAt(tx, ty) {
  if (ty < 0) {
    return ".";
  }
  if (tx < 0 || tx >= MAP_W) {
    return "#";
  }
  if (ty >= MAP_H) {
    return ".";
  }
  return game.map[ty][tx];
}

function solidAt(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor((py - HUD_HEIGHT) / TILE);
  return mapCharAt(tx, ty) === "#";
}

function hazardAt(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor((py - HUD_HEIGHT) / TILE);
  return mapCharAt(tx, ty) === "^";
}

function collidesSolid(body) {
  return (
    solidAt(body.x + 1, body.y + 1) ||
    solidAt(body.x + body.w - 2, body.y + 1) ||
    solidAt(body.x + 1, body.y + body.h - 1) ||
    solidAt(body.x + body.w - 2, body.y + body.h - 1)
  );
}

function touchesHazard(body) {
  return (
    hazardAt(body.x + 2, body.y + body.h - 2) ||
    hazardAt(body.x + body.w - 3, body.y + body.h - 2) ||
    hazardAt(body.x + body.w / 2, body.y + body.h - 2) ||
    hazardAt(body.x + 2, body.y + body.h / 2) ||
    hazardAt(body.x + body.w - 3, body.y + body.h / 2)
  );
}

function moveBody(body) {
  body.onGround = false;
  body.x += body.vx;
  if (collidesSolid(body)) {
    const step = Math.sign(body.vx);
    while (collidesSolid(body)) {
      body.x -= step || 1;
    }
    body.vx = 0;
  }

  body.y += body.vy;
  if (collidesSolid(body)) {
    const step = Math.sign(body.vy);
    while (collidesSolid(body)) {
      body.y -= step || 1;
    }
    if (body.vy > 0) {
      body.onGround = true;
    }
    body.vy = 0;
  }

  body.x = Math.max(0, Math.min(WIDTH - body.w, body.x));
}

function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function shouldTurn(enemy) {
  const front = enemy.dir > 0 ? enemy.x + enemy.w + 1 : enemy.x - 1;
  const wallY = enemy.y + enemy.h / 2;
  const footY = enemy.y + enemy.h + 1;
  return solidAt(front, wallY) || !solidAt(front, footY);
}

function updatePlayer() {
  const player = game.player;
  const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

  player.vx = direction * PLAYER_SPEED;
  if (direction !== 0) {
    player.facing = direction;
  }

  if (keys.justJump && player.onGround) {
    player.vy = PLAYER_JUMP;
    player.onGround = false;
    audio.jump();
  }

  player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
  moveBody(player);

  if (player.invincible > 0) {
    player.invincible -= 1;
  }

  if (player.y > HEIGHT || touchesHazard(player)) {
    loseLife();
    return;
  }

  if (!game.key.taken && intersects(player, game.key)) {
    game.key.taken = true;
    game.hasKey = true;
    game.exit.unlocked = true;
    addScore(100);
    audio.key();
  }

  if (game.exit.unlocked && intersects(player, game.exit)) {
    clearStage();
    return;
  }

  if (player.invincible === 0) {
    for (const enemy of game.enemies) {
      if (intersects(player, enemy)) {
        loseLife();
        return;
      }
    }
  }
}

function updateEnemies() {
  for (const enemy of game.enemies) {
    if (enemy.type === "glider") {
      if (enemy.axis === "x") {
        enemy.x += enemy.speed * enemy.dir;
        if (enemy.x < enemy.minPx || enemy.x > enemy.maxPx) {
          enemy.x = Math.max(enemy.minPx, Math.min(enemy.maxPx, enemy.x));
          enemy.dir *= -1;
        }
      } else {
        enemy.y += enemy.speed * enemy.dir;
        if (enemy.y < enemy.minPx || enemy.y > enemy.maxPx) {
          enemy.y = Math.max(enemy.minPx, Math.min(enemy.maxPx, enemy.y));
          enemy.dir *= -1;
        }
      }
      continue;
    }

    if (enemy.onGround && shouldTurn(enemy)) {
      enemy.dir *= -1;
    }

    if (enemy.type === "hopper") {
      enemy.hopTimer -= 1;
      if (enemy.onGround && enemy.hopTimer <= 0) {
        enemy.vy = -4.2;
        enemy.hopTimer = 40;
      }
    }

    enemy.vx = enemy.dir * enemy.speed;
    enemy.vy = Math.min(enemy.vy + 0.24, MAX_FALL - 0.5);
    moveBody(enemy);
  }
}

function update() {
  game.frame += 1;

  switch (game.state) {
    case "title":
      if (keys.justStart || keys.justJump) {
        audio.ensure();
        startGame();
      }
      break;
    case "intro":
      game.stateTimer -= 1;
      if (game.stateTimer <= 0) {
        game.state = "playing";
      }
      break;
    case "playing":
      updatePlayer();
      updateEnemies();
      break;
    case "dead":
      game.stateTimer -= 1;
      if (game.stateTimer <= 0) {
        if (game.lives > 0) {
          loadStage(game.stageIndex);
        } else {
          game.state = "gameover";
        }
      }
      break;
    case "clear":
      game.stateTimer -= 1;
      if (game.stateTimer <= 0) {
        nextStage();
      }
      break;
    case "gameover":
      if (keys.justStart || keys.justJump) {
        audio.ensure();
        startGame();
      }
      break;
  }

  keys.justJump = false;
  keys.justStart = false;
}

function drawText(text, x, y, color = palette.text, align = "left") {
  ctx.fillStyle = color;
  ctx.font = "10px monospace";
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
}

function drawBrick(tx, ty) {
  const x = tx * TILE;
  const y = HUD_HEIGHT + ty * TILE;
  ctx.fillStyle = palette.brickDark;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = palette.brick;
  ctx.fillRect(x, y, TILE, TILE - 1);
  ctx.fillStyle = palette.brickLite;
  ctx.fillRect(x + 1, y + 1, TILE - 2, 2);
  ctx.fillStyle = "#21476f";
  ctx.fillRect(x + 1, y + 7, TILE - 2, 1);
  ctx.fillRect(x + 1, y + 13, TILE - 2, 1);
  ctx.fillRect(x + 7, y + 2, 1, 5);
  ctx.fillRect(x + 4, y + 8, 1, 5);
  ctx.fillRect(x + 11, y + 8, 1, 5);
}

function drawSpike(tx, ty) {
  const x = tx * TILE;
  const y = HUD_HEIGHT + ty * TILE;
  ctx.fillStyle = palette.spikeShadow;
  ctx.fillRect(x, y + 11, TILE, 3);
  ctx.fillStyle = palette.spike;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + i * 4, y + 14);
    ctx.lineTo(x + i * 4 + 2, y + 4 + (i % 2));
    ctx.lineTo(x + i * 4 + 4, y + 14);
    ctx.fill();
  }
}

function drawPlayer(player) {
  if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) {
    return;
  }
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const walk = Math.floor(game.frame / 8) % 2;
  const facing = player.facing < 0;
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(x + 1, y + player.h, player.w - 2, 2);

  ctx.fillStyle = palette.playerCap;
  ctx.fillRect(x + 2, y, 8, 3);
  ctx.fillRect(x + (facing ? 1 : 7), y + 2, 3, 2);

  ctx.fillStyle = palette.playerSkin;
  ctx.fillRect(x + 3, y + 3, 6, 4);
  ctx.fillRect(x + 1, y + 9, 2, 3);
  ctx.fillRect(x + 9, y + 9, 2, 3);

  ctx.fillStyle = palette.playerShirt;
  ctx.fillRect(x + 2, y + 7, 8, 4);

  ctx.fillStyle = palette.playerPants;
  ctx.fillRect(x + 3, y + 11, 6, 2);
  ctx.fillRect(x + 3, y + 13, 2, 1);
  ctx.fillRect(x + 7, y + 13, 2, 1);

  ctx.fillStyle = palette.playerBoots;
  ctx.fillRect(x + 2 + walk, y + 13, 3, 1);
  ctx.fillRect(x + 7 - walk, y + 13, 3, 1);
}

function drawWalker(enemy) {
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  const blink = Math.floor(game.frame / 20) % 2;
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(x + 1, y + enemy.h, enemy.w - 2, 2);
  ctx.fillStyle = palette.walkerDark;
  ctx.fillRect(x + 1, y + 7, 10, 4);
  ctx.fillStyle = palette.walker;
  ctx.fillRect(x + 2, y + 2, 8, 7);
  ctx.fillStyle = "#fff9e2";
  ctx.fillRect(x + 3, y + 4, 2, 2);
  ctx.fillRect(x + 7, y + 4, 2, 2);
  if (!blink) {
    ctx.fillStyle = "#23191a";
    ctx.fillRect(x + 4, y + 5, 1, 1);
    ctx.fillRect(x + 7, y + 5, 1, 1);
  }
  ctx.fillStyle = palette.walkerDark;
  ctx.fillRect(x + 3, y + 11, 2, 1);
  ctx.fillRect(x + 7, y + 11, 2, 1);
}

function drawHopper(enemy) {
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(x + 1, y + enemy.h, enemy.w - 2, 2);
  ctx.fillStyle = palette.hopperDark;
  ctx.fillRect(x + 2, y + 8, 8, 3);
  ctx.fillStyle = palette.hopper;
  ctx.fillRect(x + 1, y + 4, 10, 5);
  ctx.fillRect(x + 3, y + 2, 2, 2);
  ctx.fillRect(x + 7, y + 2, 2, 2);
  ctx.fillStyle = "#fff9e2";
  ctx.fillRect(x + 3, y + 5, 2, 2);
  ctx.fillRect(x + 7, y + 5, 2, 2);
  ctx.fillStyle = "#24172d";
  ctx.fillRect(x + 4, y + 6, 1, 1);
  ctx.fillRect(x + 7, y + 6, 1, 1);
}

function drawGlider(enemy) {
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  const pulse = Math.floor(game.frame / 10) % 2;
  ctx.fillStyle = palette.gliderDark;
  ctx.fillRect(x + 1, y + 2, 10, 8);
  ctx.fillStyle = palette.glider;
  ctx.fillRect(x + 2, y + 1, 8, 10);
  ctx.fillStyle = pulse ? "#fef0a8" : "#ff7a4b";
  ctx.fillRect(x + 4, y + 4, 4, 3);
}

function drawKey(key) {
  if (key.taken) {
    return;
  }
  const bob = Math.sin(game.frame / 12) * 1.5;
  const x = Math.round(key.x);
  const y = Math.round(key.y + bob);
  ctx.fillStyle = palette.key;
  ctx.fillRect(x + 3, y, 4, 4);
  ctx.fillRect(x + 5, y + 4, 2, 5);
  ctx.fillRect(x + 7, y + 6, 2, 1);
  ctx.fillRect(x + 7, y + 8, 2, 1);
  ctx.fillStyle = "#fff3b1";
  ctx.fillRect(x + 4, y + 1, 2, 2);
}

function drawExit(exit) {
  const x = Math.round(exit.x);
  const y = Math.round(exit.y);
  ctx.fillStyle = exit.unlocked ? palette.door : palette.doorLocked;
  ctx.fillRect(x + 1, y + 2, 10, 16);
  ctx.fillStyle = exit.unlocked ? "#d8ffb7" : "#bfc6d0";
  ctx.fillRect(x + 3, y + 4, 6, 10);
  ctx.fillStyle = exit.unlocked ? "#17311b" : "#2b3440";
  ctx.fillRect(x + 8, y + 8, 1, 1);
  if (!exit.unlocked) {
    ctx.fillStyle = palette.key;
    ctx.fillRect(x + 5, y + 8, 2, 3);
  }
}

function drawHud() {
  ctx.fillStyle = palette.hudBg;
  ctx.fillRect(0, 0, WIDTH, HUD_HEIGHT);
  ctx.fillStyle = palette.hudLine;
  ctx.fillRect(0, HUD_HEIGHT - 2, WIDTH, 2);

  drawText(`SCORE ${padScore(game.score)}`, 8, 7);
  drawText(`MEN ${String(game.lives).padStart(2, "0")}`, 108, 7, palette.accent);
  drawText(`STAGE ${String(stageNumber()).padStart(2, "0")}`, 170, 7, palette.text);
  drawText(game.hasKey ? "KEY READY" : "GET KEY", 8, 18, game.hasKey ? "#b4ff8b" : palette.accent);
  drawText(STAGES[game.stageIndex].name.toUpperCase(), 248, 18, "#8fd6ff", "right");
}

function drawBackground() {
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, HUD_HEIGHT, WIDTH, HEIGHT - HUD_HEIGHT);
  ctx.fillStyle = palette.sky2;
  for (let i = 0; i < MAP_H; i += 1) {
    if (i % 2 === 0) {
      ctx.fillRect(0, HUD_HEIGHT + i * TILE, WIDTH, 1);
    }
  }
  for (const star of stars) {
    ctx.fillStyle = star.c;
    ctx.fillRect(star.x, star.y, 1, 1);
  }
}

function drawStage() {
  drawBackground();
  for (let ty = 0; ty < MAP_H; ty += 1) {
    for (let tx = 0; tx < MAP_W; tx += 1) {
      const tile = game.map[ty][tx];
      if (tile === "#") {
        drawBrick(tx, ty);
      } else if (tile === "^") {
        drawSpike(tx, ty);
      }
    }
  }
  drawExit(game.exit);
  drawKey(game.key);
  for (const enemy of game.enemies) {
    if (enemy.type === "walker") {
      drawWalker(enemy);
    } else if (enemy.type === "hopper") {
      drawHopper(enemy);
    } else {
      drawGlider(enemy);
    }
  }
  drawPlayer(game.player);
}

function drawCenterBox(lines, color = palette.text) {
  const boxW = 164;
  const boxH = lines.length * 12 + 18;
  const x = (WIDTH - boxW) / 2;
  const y = HUD_HEIGHT + 42;
  ctx.fillStyle = "rgba(3, 7, 12, 0.82)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = "#8fd6ff";
  ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);
  lines.forEach((line, index) => {
    drawText(line, WIDTH / 2, y + 10 + index * 12, index === 0 ? palette.accent : color, "center");
  });
}

function drawTitle() {
  ctx.fillStyle = palette.hudBg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#8e3f2f";
  ctx.font = "bold 28px monospace";
  ctx.fillText("KEYHOP", WIDTH / 2 + 2, 52);
  ctx.fillStyle = "#fff1bf";
  ctx.fillText("KEYHOP", WIDTH / 2, 50);
  ctx.fillStyle = "#8fd6ff";
  ctx.font = "10px monospace";
  ctx.fillText("ONE SCREEN 8-BIT ACTION", WIDTH / 2, 80);
  drawCenterBox([
    "GET THE KEY",
    "REACH THE EXIT",
    "ENEMY OR SPIKE = MISS",
    "ARROWS MOVE / Z JUMP",
  ]);
  if (Math.floor(game.frame / 24) % 2 === 0) {
    drawText("PRESS ENTER", WIDTH / 2, 184, palette.key, "center");
  }
}

function drawOverlay() {
  if (game.state === "intro") {
    drawCenterBox([`STAGE ${String(stageNumber()).padStart(2, "0")}`, "READY"]);
  } else if (game.state === "clear") {
    drawCenterBox(["STAGE CLEAR", "TO THE NEXT ROOM"], "#b4ff8b");
  } else if (game.state === "dead") {
    drawCenterBox(["MISS", `${Math.max(game.lives, 0)} MEN LEFT`], "#ffd5c5");
  } else if (game.state === "gameover") {
    drawCenterBox(["GAME OVER", "PRESS ENTER"], "#ffd5c5");
  }
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (game.state === "title") {
    drawTitle();
  } else {
    drawStage();
    drawHud();
    drawOverlay();
  }
}

function frame() {
  update();
  render();
  requestAnimationFrame(frame);
}

function handleKey(event, isDown) {
  const code = event.code;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(code)) {
    event.preventDefault();
  }
  if (isDown) {
    audio.ensure();
  }

  if (code === "ArrowLeft" || code === "KeyA") {
    keys.left = isDown;
  }
  if (code === "ArrowRight" || code === "KeyD") {
    keys.right = isDown;
  }
  if (code === "ArrowUp" || code === "KeyW" || code === "KeyZ" || code === "KeyK" || code === "Space") {
    if (isDown && !keys.jump) {
      keys.justJump = true;
    }
    keys.jump = isDown;
  }
  if (code === "Enter") {
    if (isDown && !keys.start) {
      keys.justStart = true;
    }
    keys.start = isDown;
  }
}

window.addEventListener("keydown", (event) => handleKey(event, true));
window.addEventListener("keyup", (event) => handleKey(event, false));

render();
requestAnimationFrame(frame);
