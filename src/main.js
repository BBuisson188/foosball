const BOARD = {
  width: 1536,
  height: 1007,
  field: { left: 94, right: 1442, top: 78, bottom: 930 },
  goal: { top: 342, bottom: 657, depth: 64 },
};

const FRAME_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

const ASSET_PATHS = {
  board: "assets/foosball_empty_bars.png",
  ball: "assets/foosball_ball.png",
  redFrames: framePaths("red"),
  blueFrames: framePaths("blue"),
};

const WIN_SCORE = 8;

const DIFFICULTY = {
  easy: {
    reaction: 0.28,
    rodSpeed: 360,
    error: 82,
    kickChance: 0.24,
    spinChance: 0.04,
    prediction: 0.12,
    activeRadius: 270,
  },
  medium: {
    reaction: 0.18,
    rodSpeed: 520,
    error: 42,
    kickChance: 0.46,
    spinChance: 0.09,
    prediction: 0.28,
    activeRadius: 390,
  },
  hard: {
    reaction: 0.1,
    rodSpeed: 720,
    error: 18,
    kickChance: 0.68,
    spinChance: 0.16,
    prediction: 0.46,
    activeRadius: 510,
  },
};

const RODS = [
  { id: "red_goal", team: "red", x: 166, count: 3, baseY: [238, 498, 758], zone: [104, 536, 130, 394] },
  { id: "red_defense", team: "red", x: 321, count: 2, baseY: [336, 668], zone: [263, 536, 130, 394] },
  { id: "blue_attack", team: "blue", x: 489, count: 3, baseY: [238, 498, 758] },
  { id: "red_midfield", team: "red", x: 675, count: 5, baseY: [174, 337, 500, 663, 826], zone: [607, 536, 130, 394] },
  { id: "blue_midfield", team: "blue", x: 846, count: 5, baseY: [174, 337, 500, 663, 826] },
  { id: "red_attack", team: "red", x: 1027, count: 3, baseY: [238, 498, 758], zone: [977, 536, 130, 394] },
  { id: "blue_defense", team: "blue", x: 1193, count: 2, baseY: [336, 668] },
  { id: "blue_goal", team: "blue", x: 1353, count: 3, baseY: [238, 498, 758] },
];

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const els = {
  menu: document.querySelector("#menu"),
  startButton: document.querySelector("#startButton"),
  difficultyButtons: [...document.querySelectorAll(".difficulty")],
  hud: document.querySelector("#hud"),
  redScore: document.querySelector("#redScore"),
  blueScore: document.querySelector("#blueScore"),
  statusText: document.querySelector("#statusText"),
  ballButton: document.querySelector("#ballButton"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  rotateNotice: document.querySelector("#rotateNotice"),
  endScreen: document.querySelector("#endScreen"),
  winnerTitle: document.querySelector("#winnerTitle"),
  winnerLabel: document.querySelector("#winnerLabel"),
  restartButton: document.querySelector("#restartButton"),
};

const viewport = {
  dpr: 1,
  width: 0,
  height: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const game = {
  assets: null,
  mode: "menu",
  difficulty: "easy",
  scores: { red: 0, blue: 0 },
  lastConceded: "blue",
  shake: 0,
  flash: 0,
  time: 0,
  pausedForGoal: 0,
  winningTeam: null,
};

const input = {
  pointers: new Map(),
  maxTouches: 2,
};

let rods = [];
let ball = null;
let audio = null;
let lastNow = performance.now();
let accumulator = 0;

const FIXED_DT = 1 / 120;
const MAX_FRAME_DT = 1 / 20;

init();

async function init() {
  setupEvents();
  resize();
  game.assets = await loadAssets();
  resetMatch();
  requestAnimationFrame(loop);
}

function framePaths(team) {
  const folder = team === "red" ? "red player frames" : "blue player frames";
  return Object.fromEntries(
    FRAME_ANGLES.map((angle) => [
      angle,
      `assets/foosball_sprite_pack/${folder}/foosball_frame_${String(angle).padStart(3, "0")}.png`,
    ]),
  );
}

function setupEvents() {
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);

  els.difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      game.difficulty = button.dataset.difficulty;
      els.difficultyButtons.forEach((item) => item.classList.toggle("selected", item === button));
    });
  });

  els.startButton.addEventListener("click", () => {
    ensureAudio();
    resetMatch();
    game.mode = "waiting";
    els.menu.classList.add("hidden");
    els.hud.classList.remove("hidden");
    showBallButton("Tap BALL to serve");
  });

  els.restartButton.addEventListener("click", () => {
    resetMatch();
    game.mode = "waiting";
    els.endScreen.classList.add("hidden");
    els.hud.classList.remove("hidden");
    showBallButton("Tap BALL to serve");
  });

  els.ballButton.addEventListener("click", () => {
    ensureAudio();
    serveBall();
  });

  els.fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  canvas.addEventListener("pointerup", onPointerUp, { passive: false });
  canvas.addEventListener("pointercancel", onPointerUp, { passive: false });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  document.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
}

function resize() {
  viewport.dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  canvas.width = Math.floor(viewport.width * viewport.dpr);
  canvas.height = Math.floor(viewport.height * viewport.dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);

  const scale = Math.min(viewport.width / BOARD.width, viewport.height / BOARD.height);
  viewport.scale = scale;
  viewport.offsetX = (viewport.width - BOARD.width * scale) * 0.5;
  viewport.offsetY = (viewport.height - BOARD.height * scale) * 0.5;
  els.rotateNotice.classList.toggle("hidden", viewport.width >= viewport.height);
}

function loadAssets() {
  const imageJobs = [
    ["board", ASSET_PATHS.board],
    ["ball", ASSET_PATHS.ball],
    ...Object.entries(ASSET_PATHS.redFrames).map(([angle, path]) => [`red_${angle}`, path]),
    ...Object.entries(ASSET_PATHS.blueFrames).map(([angle, path]) => [`blue_${angle}`, path]),
  ];

  return Promise.all(imageJobs.map(([key, path]) => loadImage(path).then((image) => [key, image]))).then(
    (entries) => Object.fromEntries(entries),
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

function resetMatch() {
  game.scores.red = 0;
  game.scores.blue = 0;
  game.lastConceded = "blue";
  game.shake = 0;
  game.flash = 0;
  game.pausedForGoal = 0;
  game.winningTeam = null;
  rods = RODS.map(createRod);
  ball = createBall();
  updateHud();
}

function createRod(config) {
  const minY = Math.min(...config.baseY);
  const maxY = Math.max(...config.baseY);
  return {
    ...config,
    offset: 0,
    targetOffset: 0,
    velocityY: 0,
    state: "neutral",
    angle: 90,
    targetAngle: 90,
    activePointerId: null,
    lastActive: -999,
    kickTimer: 0,
    kickPower: 0,
    spinTimer: 0,
    spinSpeed: 0,
    cooldown: 0,
    aiTarget: 0,
    aiThink: 0,
    minOffset: BOARD.field.top + 80 - minY,
    maxOffset: BOARD.field.bottom - 80 - maxY,
    shake: 0,
  };
}

function createBall() {
  return {
    x: BOARD.width * 0.5,
    y: BOARD.height * 0.5,
    vx: 0,
    vy: 0,
    radius: 17,
    state: "waiting",
    trail: [],
    driftPhase: Math.random() * Math.PI * 2,
    wobblePhase: Math.random() * Math.PI * 2,
    squash: 0,
    lastHit: "",
  };
}

function loop(now) {
  const dt = Math.min((now - lastNow) / 1000, MAX_FRAME_DT);
  lastNow = now;
  accumulator += dt;

  while (accumulator >= FIXED_DT) {
    update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 18);
  game.flash = Math.max(0, game.flash - dt * 3.2);

  updateRods(dt);

  if (game.mode === "playing") {
    updateAi(dt);
    updateBall(dt);
  }

  updateAudio();
}

function updateRods(dt) {
  for (const rod of rods) {
    rod.cooldown = Math.max(0, rod.cooldown - dt);
    rod.shake = Math.max(0, rod.shake - dt * 12);

    if (rod.kickTimer > 0) {
      rod.kickTimer -= dt;
      const forwardAngle = rod.team === "red" ? 0 : 180;
      rod.targetAngle = rod.kickTimer > 0.06 ? forwardAngle : 90;
      if (rod.kickTimer <= 0) {
        rod.state = "neutral";
        rod.targetAngle = 90;
      }
    }

    if (rod.spinTimer > 0) {
      rod.spinTimer -= dt;
      rod.angle = wrapAngle(rod.angle + rod.spinSpeed * dt);
      if (rod.spinTimer <= 0) {
        rod.state = Math.random() < 0.68 ? "neutral" : "lifted";
        rod.targetAngle = rod.state === "lifted" ? getLiftAngle(rod) : 90;
      }
    } else {
      rod.angle = approachAngle(rod.angle, rod.targetAngle, dt * 760);
    }

    const previousOffset = rod.offset;
    rod.offset = approach(rod.offset, rod.targetOffset, dt * 1100);
    rod.offset = clamp(rod.offset, rod.minOffset, rod.maxOffset);
    rod.velocityY = (rod.offset - previousOffset) / dt;
  }
}

function updateAi(dt) {
  const settings = DIFFICULTY[game.difficulty];
  const blueRods = rods.filter((rod) => rod.team === "blue");

  for (const rod of blueRods) {
    rod.aiThink -= dt;
    if (rod.aiThink <= 0) {
      rod.aiThink = settings.reaction + Math.random() * settings.reaction * 0.7;
      const predictedY = ball.y + ball.vy * settings.prediction;
      const distanceX = Math.abs(ball.x - rod.x);
      const noise = (Math.random() * 2 - 1) * settings.error;
      const playerYs = rod.baseY.map((y) => y + rod.offset);
      const closest = playerYs.reduce((best, y) => (Math.abs(y - predictedY) < Math.abs(best - predictedY) ? y : best));
      const rawTarget = rod.offset + (predictedY + noise - closest);
      const tracking = distanceX < settings.activeRadius ? rawTarget : Math.sin(game.time * 0.75 + rod.x) * 40;
      rod.aiTarget = clamp(tracking, rod.minOffset, rod.maxOffset);

      if (distanceX < 80 && Math.random() < settings.kickChance && rod.cooldown <= 0) {
        if (Math.random() < settings.spinChance) {
          triggerSpin(rod, 1.1);
        } else {
          triggerKick(rod, 0.85 + Math.random() * 0.6);
        }
      }
    }

    const previousTarget = rod.targetOffset;
    rod.targetOffset = approach(rod.targetOffset, rod.aiTarget, settings.rodSpeed * dt);
    rod.velocityY = (rod.targetOffset - previousTarget) / Math.max(dt, 0.001);
  }
}

function updateBall(dt) {
  if (ball.state !== "active") return;

  const speed = Math.hypot(ball.vx, ball.vy);
  ball.driftPhase += dt * 1.8;
  ball.wobblePhase += dt * (2.4 + speed * 0.01);

  const driftStrength = clamp(1 - speed / 820, 0.02, 1) * 42;
  const drift = Math.sin(ball.driftPhase) * driftStrength * dt;
  ball.vx += Math.cos(ball.driftPhase * 0.7) * drift;
  ball.vy += Math.sin(ball.driftPhase * 0.9) * drift;

  ball.vx *= 1 - 0.09 * dt;
  ball.vy *= 1 - 0.09 * dt;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.trail.unshift({ x: ball.x, y: ball.y, age: 0, speed });
  ball.trail = ball.trail.filter((point, index) => {
    point.age += dt;
    return index < 9 && point.age < 0.2;
  });
  ball.squash = Math.max(0, ball.squash - dt * 5.5);

  collideWalls();
  collidePlayers();
  enforceBallSpeed();
  checkGoal();
}

function collideWalls() {
  const r = ball.radius;
  if (ball.y - r < BOARD.field.top) {
    ball.y = BOARD.field.top + r;
    ball.vy = Math.abs(ball.vy) * 0.82;
    wallHit();
  } else if (ball.y + r > BOARD.field.bottom) {
    ball.y = BOARD.field.bottom - r;
    ball.vy = -Math.abs(ball.vy) * 0.82;
    wallHit();
  }

  const inGoalMouth = ball.y > BOARD.goal.top && ball.y < BOARD.goal.bottom;

  if (ball.x - r < BOARD.field.left && !inGoalMouth) {
    ball.x = BOARD.field.left + r;
    ball.vx = Math.abs(ball.vx) * 0.84;
    wallHit();
  } else if (ball.x + r > BOARD.field.right && !inGoalMouth) {
    ball.x = BOARD.field.right - r;
    ball.vx = -Math.abs(ball.vx) * 0.84;
    wallHit();
  }
}

function collidePlayers() {
  for (const rod of rods) {
    const lifted = rod.state === "lifted" && rod.spinTimer <= 0;
    if (lifted) continue;

    for (const baseY of rod.baseY) {
      const px = rod.x;
      const py = baseY + rod.offset;
      const dx = ball.x - px;
      const dy = ball.y - py;
      const radius = ball.radius + 34;
      const distSq = dx * dx + dy * dy;

      if (distSq > radius * radius) continue;

      const dist = Math.max(Math.sqrt(distSq), 0.001);
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = px + nx * radius;
      ball.y = py + ny * radius;

      const active = isRodActive(rod);
      const toward = rod.team === "red" ? 1 : -1;
      const kickBoost = rod.kickTimer > 0 ? 450 * rod.kickPower : 0;
      const spinBoost = rod.spinTimer > 0 ? 650 : 0;
      const verticalInfluence = clamp(rod.velocityY * 0.72, -520, 520);
      const incoming = Math.hypot(ball.vx, ball.vy);
      const baseSpeed = active ? Math.max(incoming * 0.78, 210) : Math.max(incoming * 0.34, 96);
      const normalX = Math.abs(nx) < 0.2 ? toward : nx;
      const outgoingX = Math.sign(normalX || toward) * (baseSpeed + kickBoost + spinBoost);

      ball.vx = outgoingX;
      ball.vy = ball.vy * (active ? 0.35 : 0.18) + ny * baseSpeed * 0.55 + verticalInfluence;

      if (!active) {
        rod.shake = 1;
      }

      ball.squash = clamp((kickBoost + spinBoost + incoming) / 900, 0.18, 0.85);
      game.shake = Math.max(game.shake, ball.squash * 0.55);
      playHit(active || kickBoost > 0 ? "player" : "soft");
      enforceBallSpeed();
      return;
    }
  }
}

function checkGoal() {
  const r = ball.radius;
  const inGoalMouth = ball.y > BOARD.goal.top && ball.y < BOARD.goal.bottom;

  if (inGoalMouth && ball.x + r < BOARD.field.left - BOARD.goal.depth * 0.32) {
    scoreGoal("blue");
  } else if (inGoalMouth && ball.x - r > BOARD.field.right + BOARD.goal.depth * 0.32) {
    scoreGoal("red");
  }
}

function scoreGoal(team) {
  if (game.mode !== "playing") return;
  game.scores[team] += 1;
  game.lastConceded = team === "red" ? "blue" : "red";
  game.mode = game.scores[team] >= WIN_SCORE ? "ended" : "waiting";
  ball.state = "waiting";
  ball.vx = 0;
  ball.vy = 0;
  game.flash = 1;
  game.shake = 1.2;
  playGoal();
  updateHud();

  if (game.mode === "ended") {
    game.winningTeam = team;
    els.hud.classList.add("hidden");
    els.ballButton.classList.add("hidden");
    els.winnerLabel.textContent = `${game.scores.red} - ${game.scores.blue}`;
    els.winnerTitle.textContent = `${team.toUpperCase()} Wins`;
    els.endScreen.classList.remove("hidden");
  } else {
    showBallButton(`${team.toUpperCase()} scores`);
  }
}

function enforceBallSpeed() {
  const speed = Math.hypot(ball.vx, ball.vy);
  const min = 120;
  const max = 980;

  if (speed < min) {
    const angle = speed > 1 ? Math.atan2(ball.vy, ball.vx) : Math.random() * Math.PI * 2;
    ball.vx = Math.cos(angle) * min;
    ball.vy = Math.sin(angle) * min;
  } else if (speed > max) {
    ball.vx = (ball.vx / speed) * max;
    ball.vy = (ball.vy / speed) * max;
  }
}

function wallHit() {
  ball.squash = Math.max(ball.squash, 0.28);
  game.shake = Math.max(game.shake, 0.18);
  playHit("wall");
}

function onPointerDown(event) {
  if (game.mode !== "playing" && game.mode !== "waiting") return;
  if (game.mode === "waiting") return;
  event.preventDefault();
  ensureAudio();

  const boardPoint = screenToBoard(event.clientX, event.clientY);
  const rod = findRedRodInZone(boardPoint.x, boardPoint.y);
  if (!rod) return;

  if (input.pointers.size >= input.maxTouches && event.pointerType !== "mouse") return;

  if (rod.activePointerId !== null) {
    input.pointers.delete(rod.activePointerId);
  }

  canvas.setPointerCapture?.(event.pointerId);
  rod.activePointerId = event.pointerId;
  rod.lastActive = game.time;
  if (rod.state === "lifted") {
    rod.state = "neutral";
    rod.targetAngle = 90;
  }

  input.pointers.set(event.pointerId, {
    id: event.pointerId,
    rodId: rod.id,
    startX: boardPoint.x,
    startY: boardPoint.y,
    x: boardPoint.x,
    y: boardPoint.y,
    lastX: boardPoint.x,
    lastY: boardPoint.y,
    lastT: performance.now(),
    vx: 0,
    vy: 0,
  });
}

function onPointerMove(event) {
  const pointer = input.pointers.get(event.pointerId);
  if (!pointer) return;
  event.preventDefault();

  const boardPoint = screenToBoard(event.clientX, event.clientY);
  const now = performance.now();
  const dt = Math.max((now - pointer.lastT) / 1000, 0.001);
  pointer.lastX = pointer.x;
  pointer.lastY = pointer.y;
  pointer.vx = (boardPoint.x - pointer.x) / dt;
  pointer.vy = (boardPoint.y - pointer.y) / dt;
  pointer.x = boardPoint.x;
  pointer.y = boardPoint.y;
  pointer.lastT = now;

  const rod = rods.find((item) => item.id === pointer.rodId);
  if (!rod) return;

  rod.lastActive = game.time;
  rod.targetOffset = clamp(rod.targetOffset + pointer.vy * 0.012, rod.minOffset, rod.maxOffset);

  const horizontalDelta = pointer.x - pointer.startX;
  const deadZone = 11;
  if (Math.abs(horizontalDelta) < deadZone) return;

  if (horizontalDelta < -deadZone) {
    rod.state = "lifted";
    rod.targetAngle = getLiftAngle(rod);
  } else if (horizontalDelta > deadZone && rod.cooldown <= 0) {
    triggerKick(rod, clamp(Math.abs(pointer.vx) / 900, 0.35, 1.55));
    pointer.startX = pointer.x;
  }
}

function onPointerUp(event) {
  const pointer = input.pointers.get(event.pointerId);
  if (!pointer) return;
  event.preventDefault();

  const rod = rods.find((item) => item.id === pointer.rodId);
  if (rod) {
    const fastForwardRelease = pointer.vx > 760;
    if (fastForwardRelease && rod.cooldown <= 0) {
      triggerSpin(rod, clamp(pointer.vx / 1000, 0.8, 1.8));
    } else if (rod.state !== "lifted" && rod.spinTimer <= 0) {
      rod.targetAngle = 90;
    }
    rod.activePointerId = null;
    rod.lastActive = game.time;
  }

  input.pointers.delete(event.pointerId);
}

function triggerKick(rod, power) {
  rod.state = "kicking";
  rod.kickTimer = 0.16;
  rod.kickPower = power;
  rod.cooldown = 0.18;
  rod.targetAngle = rod.team === "red" ? 0 : 180;
}

function triggerSpin(rod, power) {
  rod.state = "spinning";
  rod.spinTimer = 0.42;
  rod.spinSpeed = (rod.team === "red" ? -1 : 1) * (960 + power * 420);
  rod.cooldown = 0.45;
}

function getLiftAngle(rod) {
  return rod.team === "red" ? 180 : 0;
}

function isRodActive(rod) {
  if (rod.team === "blue") {
    return Math.abs(ball.x - rod.x) < DIFFICULTY[game.difficulty].activeRadius || Math.abs(rod.velocityY) > 80;
  }
  return rod.activePointerId !== null || game.time - rod.lastActive < 0.14;
}

function findRedRodInZone(x, y) {
  return rods.find((rod) => {
    if (rod.team !== "red" || !rod.zone) return false;
    const [zx, zy, zw, zh] = rod.zone;
    return x >= zx && x <= zx + zw && y >= zy && y <= zy + zh;
  });
}

function serveBall() {
  if (game.mode !== "waiting") return;

  ball.state = "active";
  ball.x = BOARD.width * 0.5 + (Math.random() * 2 - 1) * 42;
  ball.y = BOARD.field.bottom + 58;
  ball.vx = (Math.random() * 2 - 1) * 125;
  ball.vy = -(500 + Math.random() * 110);
  ball.trail = [];
  ball.squash = 0.2;
  game.mode = "playing";
  els.ballButton.classList.add("hidden");
  els.statusText.textContent = `${game.difficulty.toUpperCase()} AI`;
  playServe();
}

async function toggleFullscreen() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;

  try {
    if (fullscreenElement) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
      if (exitFullscreen) {
        await exitFullscreen.call(document);
      }
    } else {
      const target = document.documentElement;
      const requestFullscreen = target.requestFullscreen || target.webkitRequestFullscreen;
      if (requestFullscreen) {
        await requestFullscreen.call(target);
      } else {
        els.statusText.textContent = "Fullscreen unavailable";
      }
    }
  } catch (error) {
    els.statusText.textContent = "Fullscreen blocked";
  }

  updateFullscreenButton();
}

function updateFullscreenButton() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  els.fullscreenButton.classList.toggle("is-fullscreen", Boolean(fullscreenElement));
  els.fullscreenButton.setAttribute("aria-label", fullscreenElement ? "Exit fullscreen" : "Enter fullscreen");
  els.fullscreenButton.title = fullscreenElement ? "Exit fullscreen" : "Fullscreen";
}

function showBallButton(status) {
  els.statusText.textContent = status;
  els.ballButton.classList.remove("hidden");
}

function updateHud() {
  els.redScore.textContent = game.scores.red;
  els.blueScore.textContent = game.scores.blue;
}

function render() {
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  ctx.save();

  const shakeX = game.shake > 0 ? (Math.random() * 2 - 1) * game.shake * 6 : 0;
  const shakeY = game.shake > 0 ? (Math.random() * 2 - 1) * game.shake * 5 : 0;
  ctx.translate(viewport.offsetX + shakeX, viewport.offsetY + shakeY);
  ctx.scale(viewport.scale, viewport.scale);

  if (game.assets) {
    ctx.drawImage(game.assets.board, 0, 0, BOARD.width, BOARD.height);
  }

  drawActiveZones();
  drawPlayers();
  drawBall();
  drawGoalFlash();

  ctx.restore();
}

function drawActiveZones() {
  for (const rod of rods) {
    if (rod.team !== "red" || !rod.zone || !isRodActive(rod)) continue;
    const [x, y, w, h] = rod.zone;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#ffe36a";
    ctx.strokeStyle = "#fff7b4";
    ctx.lineWidth = 5;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlayers() {
  if (!game.assets) return;
  for (const rod of rods) {
    for (const baseY of rod.baseY) {
      const y = baseY + rod.offset + (rod.shake ? Math.sin(game.time * 90) * rod.shake * 4 : 0);
      drawPlayerSprite(rod, rod.x, y);
    }
  }
}

function drawPlayerSprite(rod, x, y) {
  const team = rod.team;
  const frames = getBlendFrames(rod.angle);
  const size = 308;
  const liftAlpha = rod.state === "lifted" ? 0.82 : 1;

  ctx.save();
  ctx.globalAlpha = liftAlpha * (1 - frames.mix);
  ctx.translate(x, y);
  ctx.drawImage(game.assets[`${team}_${frames.a}`], -size * 0.5, -size * 0.5, size, size);
  if (frames.mix > 0.01) {
    ctx.globalAlpha = liftAlpha * frames.mix;
    ctx.drawImage(game.assets[`${team}_${frames.b}`], -size * 0.5, -size * 0.5, size, size);
  }
  ctx.restore();
}

function getBlendFrames(angle) {
  const normalized = wrapAngle(angle);
  const lower = Math.floor(normalized / 45) * 45;
  const upper = (lower + 45) % 360;
  const mix = (normalized - lower) / 45;
  return { a: lower, b: upper, mix };
}

function drawBall() {
  if (!game.assets || ball.state === "waiting") return;
  const speed = Math.hypot(ball.vx, ball.vy);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = ball.trail.length - 1; i >= 0; i -= 1) {
    const point = ball.trail[i];
    const alpha = clamp((0.18 - point.age) / 0.18, 0, 1) * clamp(speed / 760, 0, 0.45);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffb039";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, ball.radius * (1.1 + i * 0.05), ball.radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const wobble = clamp(1 - speed / 520, 0, 1) * Math.sin(ball.wobblePhase) * 1.8;
  const angle = Math.atan2(ball.vy, ball.vx);
  const squashX = 1 + ball.squash * 0.32;
  const squashY = 1 - ball.squash * 0.18;
  const imageSize = 98;

  ctx.save();
  ctx.translate(ball.x + wobble, ball.y);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#090703";
  ctx.beginPath();
  ctx.ellipse(6 + ball.vx * 0.012, 11 + ball.vy * 0.008, 23, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(ball.x + wobble, ball.y);
  ctx.rotate(angle);
  ctx.scale(squashX, squashY);
  ctx.rotate(-angle);
  ctx.drawImage(game.assets.ball, -imageSize * 0.5, -imageSize * 0.5, imageSize, imageSize * (1024 / 1536));
  ctx.restore();
}

function drawGoalFlash() {
  if (game.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = game.flash * 0.34;
  ctx.fillStyle = "#fff2a8";
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  ctx.restore();
}

function screenToBoard(clientX, clientY) {
  return {
    x: (clientX - viewport.offsetX) / viewport.scale,
    y: (clientY - viewport.offsetY) / viewport.scale,
  };
}

function ensureAudio() {
  if (!audio) audio = createAudio();
  if (!audio) return;
  if (audio.ctx.state === "suspended") {
    audio.ctx.resume();
  }
}

function createAudio() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  const audioCtx = new AudioContextCtor();
  const master = audioCtx.createGain();
  const rolling = audioCtx.createGain();
  const rollingFilter = audioCtx.createBiquadFilter();
  const noise = createNoise(audioCtx);

  master.gain.value = 0.55;
  rolling.gain.value = 0;
  rollingFilter.type = "lowpass";
  rollingFilter.frequency.value = 420;
  noise.connect(rollingFilter);
  rollingFilter.connect(rolling);
  rolling.connect(master);
  master.connect(audioCtx.destination);
  noise.start();

  return { ctx: audioCtx, master, rolling, rollingFilter };
}

function createNoise(audioCtx) {
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  return noise;
}

function updateAudio() {
  if (!audio) return;
  const speed = ball?.state === "active" ? Math.hypot(ball.vx, ball.vy) : 0;
  const target = clamp((speed - 80) / 720, 0, 1) * 0.035;
  audio.rolling.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.08);
  audio.rollingFilter.frequency.setTargetAtTime(260 + speed * 0.9, audio.ctx.currentTime, 0.12);
}

function playHit(type) {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  const filter = audio.ctx.createBiquadFilter();
  const isWall = type === "wall";
  const isSoft = type === "soft";

  osc.type = isWall ? "triangle" : "square";
  osc.frequency.setValueAtTime(isSoft ? 145 : isWall ? 230 : 340, now);
  osc.frequency.exponentialRampToValueAtTime(isSoft ? 70 : 92, now + 0.08);
  filter.type = "lowpass";
  filter.frequency.value = isSoft ? 520 : 1400;
  gain.gain.setValueAtTime(isSoft ? 0.045 : isWall ? 0.07 : 0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (isSoft ? 0.08 : 0.11));

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  osc.start(now);
  osc.stop(now + 0.12);
}

function playServe() {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(560, now + 0.08);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(now);
  osc.stop(now + 0.15);
}

function playGoal() {
  if (!audio) return;
  const now = audio.ctx.currentTime;
  [0, 0.08, 0.16].forEach((offset, index) => {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300 + index * 140, now + offset);
    osc.frequency.exponentialRampToValueAtTime(520 + index * 180, now + offset + 0.18);
    gain.gain.setValueAtTime(0.12, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.28);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(now + offset);
    osc.stop(now + offset + 0.3);
  });
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function approach(value, target, amount) {
  if (value < target) return Math.min(value + amount, target);
  return Math.max(value - amount, target);
}

function approachAngle(value, target, amount) {
  const delta = ((((target - value) % 360) + 540) % 360) - 180;
  if (Math.abs(delta) <= amount) return wrapAngle(target);
  return wrapAngle(value + Math.sign(delta) * amount);
}

function wrapAngle(value) {
  return ((value % 360) + 360) % 360;
}
