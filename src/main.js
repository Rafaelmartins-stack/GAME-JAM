import './style.css'

// --- Configuration & Constants ---
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const SPAWN_INTERVAL = 4000;
const EVENT_INTERVAL = 12000; // Blind spot event frequency
const MAX_STRESS = 100;
const STRESS_INCREASE_RATE = 0.08;
const STRESS_DECREASE_RATE = 0.03;

// --- Assets ---
const bgImage = new Image();
bgImage.src = new URL('./assets/background.png', import.meta.url).href;

// --- Game State ---
let state = 'MENU'; // MENU, PLAYING, RESULTS
let score = 0;
let stress = 0;
let lastSpawnTime = 0;
let lastEventTime = 0;
let vehicles = [];
let pedestrians = [];
let effects = [];
let slowZones = [];
let isDrawingZone = false;
let currentZoneStart = null;
let currentDragPos = null;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// --- UI Elements ---
const screens = {
  menu: document.getElementById('main-menu'),
  hud: document.getElementById('hud'),
  results: document.getElementById('results-screen')
};

const ui = {
  score: document.getElementById('score-val'),
  stressFill: document.getElementById('stress-fill'),
  finalSaves: document.getElementById('final-saves'),
  safetyPercent: document.getElementById('safety-percent'),
  factText: document.getElementById('fact-text')
};

// --- Classes ---

class Vehicle {
  constructor(type, path) {
    this.type = type; // 'car', 'truck', 'bike'
    this.path = path;
    this.progress = 0;
    this.speed = type === 'bike' ? 0.0008 : 0.0012;
    this.baseSpeed = this.speed;
    this.isDistracted = type !== 'bike' && Math.random() < 0.25;
    this.isBraking = false;
    this.id = Math.random().toString(36).substr(2, 9);
    this.width = type === 'truck' ? 90 : (type === 'bike' ? 30 : 55);
    this.height = type === 'truck' ? 45 : (type === 'bike' ? 15 : 28);
    this.color = this.getRandomColor();
    this.alertActive = false; // For blind spot
    this.inConflict = false; // For events
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.remove = false;
  }

  getRandomColor() {
    if (this.type === 'bike') return '#34d399';
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    // Check slow zones
    let inSlowZone = false;
    slowZones.forEach(zone => {
      if (this.x > zone.x && this.x < zone.x + zone.w && this.y > zone.y && this.y < zone.y + zone.h) {
        inSlowZone = true;
      }
    });

    const targetSpeed = inSlowZone ? this.baseSpeed * 0.3 : this.baseSpeed;
    
    // Distraction effect
    if (this.isDistracted) {
      this.speed = targetSpeed * 1.5; // Distracted drivers go faster/erratic
    } else {
      this.speed = targetSpeed;
    }

    if (stress > 80) {
      this.speed *= 1.35; // Panicked drivers
    }

    // Blind spot handling
    if (this.alertActive) {
      this.isBraking = true;
    }

    if (this.isBraking) {
      this.speed = 0;
    }

    this.progress += this.speed;

    // Follow Path Logic
    const point = this.getPointOnPath(this.progress);
    const nextPoint = this.getPointOnPath(this.progress + 0.01);
    
    this.x = point.x;
    this.y = point.y;
    this.angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x);

    if (this.progress >= 1) {
      this.remove = true;
      score++; // Successfully navigated
    }
  }

  getPointOnPath(t) {
    const p1 = this.path[0];
    const p2 = this.path[1];
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    };
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-this.width/2 + 2, -this.height/2 + 2, this.width, this.height);

    // Body
    ctx.fillStyle = this.color;
    if (this.isDistracted) ctx.fillStyle = '#fde047'; // Yellow for risk
    ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);

    // Roof/Windows
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-this.width/4, -this.height/3, this.width/2, this.height/1.5);

    // Lights
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.width/2 - 5, -this.height/2 + 2, 5, 5);
    ctx.fillRect(this.width/2 - 5, this.height/2 - 7, 5, 5);

    ctx.restore();

    // Icons
    if (this.isDistracted) {
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('📱', this.x, this.y - 45);
      
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 0, ' + (0.5 + Math.sin(Date.now() / 150) * 0.5) + ')';
      ctx.lineWidth = 3;
      ctx.arc(this.x, this.y - 45, 25 + Math.sin(Date.now() / 150) * 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    if (this.type === 'truck' && this.inConflict && !this.alertActive) {
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('👀❓', this.x, this.y - 45);
      
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, ' + (0.5 + Math.sin(Date.now() / 100) * 0.5) + ')';
      ctx.lineWidth = 3;
      ctx.arc(this.x, this.y - 45, 25 + Math.sin(Date.now() / 100) * 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.alertActive) {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 20px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('PARADO', this.x, this.y - 45);
    }
  }
}

// --- Paths ---
const PATHS = [
  [{x: -150, y: 320}, {x: 1430, y: 320}], // Left to Right
  [{x: 1430, y: 400}, {x: -150, y: 400}], // Right to Left
  [{x: 620, y: -150}, {x: 620, y: 870}],   // Top to Bottom
  [{x: 700, y: 870}, {x: 700, y: -150}]   // Bottom to Top
];

const BLIND_SPOT_TRUCK_PATH = [{x: -150, y: 320}, {x: 620, y: 320}, {x: 620, y: 870}];
const BLIND_SPOT_BIKE_PATH = [{x: -150, y: 360}, {x: 1430, y: 360}];

// --- Core Functions ---

function init() {
  resize();
  window.addEventListener('resize', resize);
  
  document.getElementById('start-btn').onclick = startLevel;
  document.getElementById('restart-btn').onclick = () => {
    state = 'MENU';
    showScreen('menu');
  };

  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  
  requestAnimationFrame(gameLoop);
}

function resize() {
  const container = document.getElementById('game-container');
  const ratio = CANVAS_WIDTH / CANVAS_HEIGHT;
  let w = container.clientWidth;
  let h = container.clientHeight;

  if (w / h > ratio) w = h * ratio;
  else h = w / ratio;

  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
}

function startLevel() {
  state = 'PLAYING';
  score = 0;
  stress = 0;
  vehicles = [];
  slowZones = [];
  lastSpawnTime = Date.now();
  showScreen('hud');
}

function showScreen(key) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  if (screens[key]) screens[key].classList.remove('hidden');
}

function spawnVehicle() {
  const pathIdx = Math.floor(Math.random() * PATHS.length);
  const type = Math.random() < 0.15 ? 'truck' : 'car';
  vehicles.push(new Vehicle(type, PATHS[pathIdx]));
}

function spawnBlindSpotEvent() {
  const truck = new Vehicle('truck', BLIND_SPOT_TRUCK_PATH);
  truck.inConflict = true;
  truck.speed = 0.0006;
  
  const bike = new Vehicle('bike', BLIND_SPOT_BIKE_PATH);
  bike.speed = 0.001;
  
  vehicles.push(truck);
  vehicles.push(bike);
  
  spawnEffect(100, 320, '⚠️ CUIDADO: CICLISTA NO PONTO CEGO!');
}

function spawnChildEvent() {
  const x = 500 + Math.random() * 300;
  const y = 200;
  const targetY = 320 + Math.random() * 100;
  
  pedestrians.push({
    type: 'ball',
    x, y, targetY,
    speed: 2,
    remove: false,
    update() {
      if (this.y < this.targetY) this.y += this.speed;
    },
    draw() {
      ctx.beginPath();
      ctx.fillStyle = '#ef4444';
      ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  setTimeout(() => {
    pedestrians.push({
      type: 'child',
      x, y, targetY: targetY - 10,
      speed: 1.5,
      remove: false,
      update() {
        if (this.y < this.targetY) this.y += this.speed;
        
        // Hazard detection: any car near child not in slow zone?
        vehicles.forEach(v => {
          const dist = Math.hypot(v.x - this.x, v.y - this.y);
          if (dist < 40) {
            let safe = false;
            slowZones.forEach(sz => {
              if (v.x > sz.x && v.x < sz.x + sz.w && v.y > sz.y && v.y < sz.y + sz.h) safe = true;
            });
            if (!safe) {
              stress += 15;
              spawnEffect(this.x, this.y, '😱 PERIGO!');
            }
          }
        });
      },
      draw() {
        ctx.beginPath();
        ctx.fillStyle = '#fbbf24';
        ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.fillText('🏃', this.x, this.y + 5);
      }
    });
  }, 1000);
  
  spawnEffect(x, y - 40, '⚽ BOLA NA PISTA!');
}

function handleMouseDown(e) {
  if (state !== 'PLAYING') return;
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  // Check clicking on distracted car or truck in conflict
  let clickedSpecial = false;
  vehicles.forEach(v => {
    const dist = Math.hypot(v.x - x, v.y - y);
    if (dist < 60) {
      if (v.isDistracted) {
        v.isDistracted = false;
        clickedSpecial = true;
        spawnEffect(x, y, '✅ FOCO!');
        score += 5;
      } else if (v.inConflict && !v.alertActive) {
        v.alertActive = true;
        clickedSpecial = true;
        spawnEffect(x, y, '🛑 PARADO!');
        score += 10;
        
        // Resume after delay
        setTimeout(() => {
          v.alertActive = false;
          v.inConflict = false;
        }, 3000);
      }
    }
  });

  if (!clickedSpecial) {
    isDrawingZone = true;
    currentZoneStart = {x, y};
  }
}

function handleMouseMove(e) {
  if (!isDrawingZone) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  currentDragPos = {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function handleMouseUp() {
  if (isDrawingZone && currentDragPos) {
    const x = Math.min(currentZoneStart.x, currentDragPos.x);
    const y = Math.min(currentZoneStart.y, currentDragPos.y);
    const w = Math.abs(currentZoneStart.x - currentDragPos.x);
    const h = Math.abs(currentZoneStart.y - currentDragPos.y);
    
    if (w > 20 && h > 20) {
      slowZones.push({x, y, w, h, life: 500});
      stress += 10; // Creating slow zones increases stress
    }
  }
  isDrawingZone = false;
  currentZoneStart = null;
  currentDragPos = null;
}

function spawnEffect(x, y, text) {
  effects.push({x, y, text, life: 60, opacity: 1});
}

function update() {
  if (state !== 'PLAYING') return;

  // Event Spawning
  if (Date.now() - lastEventTime > EVENT_INTERVAL) {
    if (Math.random() < 0.5) spawnBlindSpotEvent();
    else spawnChildEvent();
    lastEventTime = Date.now();
  }

  // Collision Detection (for events)
  checkCollisions();

  // Update Vehicles
  vehicles.forEach(v => v.update());
  vehicles = vehicles.filter(v => !v.remove);

  // Update Pedestrians
  pedestrians.forEach(p => p.update());
  pedestrians = pedestrians.filter(p => !p.remove);
  // Auto-remove pedestrians after long time
  pedestrians.forEach(p => { if (Math.random() < 0.001) p.remove = true; });

  // Update Slow Zones
  slowZones.forEach(z => z.life--);
  slowZones = slowZones.filter(z => z.life > 0);

  // Update Effects
  effects.forEach(e => {
    e.y -= 1;
    e.opacity -= 0.02;
    e.life--;
  });
  effects = effects.filter(e => e.life > 0);

  // Stress logic
  let stoppedCount = slowZones.length; 
  stress += stoppedCount * STRESS_INCREASE_RATE;
  stress -= STRESS_DECREASE_RATE;
  stress = Math.max(0, Math.min(100, stress));

  // Game over check
  if (stress >= MAX_STRESS) {
    endGame();
  }

  // UI Update
  ui.score.innerText = score;
  ui.stressFill.style.width = stress + '%';
  if (stress > 80) ui.stressFill.style.background = 'var(--accent-red)';
  else if (stress > 50) ui.stressFill.style.background = 'var(--accent-yellow)';
  else ui.stressFill.style.background = 'var(--accent-green)';
}

function checkCollisions() {
  for (let i = 0; i < vehicles.length; i++) {
    for (let j = i + 1; j < vehicles.length; j++) {
      const v1 = vehicles[i];
      const v2 = vehicles[j];
      const dist = Math.hypot(v1.x - v2.x, v1.y - v2.y);
      
      if (dist < 40 && !v1.alertActive && !v2.alertActive) {
        // Accident!
        if (v1.inConflict || v2.inConflict || v1.isDistracted || v2.isDistracted) {
          stress += 25;
          spawnEffect((v1.x + v2.x)/2, (v1.y + v2.y)/2, '💥 ACIDENTE!');
          v1.remove = true;
          v2.remove = true;
        }
      }
    }
  }
}

function endGame() {
  state = 'RESULTS';
  showScreen('results');
  ui.finalSaves.innerText = score;
  ui.safetyPercent.innerText = Math.max(0, 100 - (stress/2)).toFixed(0) + '%';
  
  const tips = [
    "2 segundos no celular aumentam o risco de colisão em 400%.",
    "Manter a calma no trânsito reduz acidentes em 30%.",
    "Áreas de escola exigem velocidade reduzida constante.",
    "O ponto cego de um caminhão pode esconder um carro inteiro."
  ];
  ui.factText.innerText = tips[Math.floor(Math.random() * tips.length)];
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw Background
  if (bgImage.complete) {
    ctx.drawImage(bgImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Draw Slow Zones
  ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  slowZones.forEach(z => {
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeRect(z.x, z.y, z.w, z.h);
  });

  // Draw Drawing Zone
  if (isDrawingZone && currentDragPos) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    const x = Math.min(currentZoneStart.x, currentDragPos.x);
    const y = Math.min(currentZoneStart.y, currentDragPos.y);
    const w = Math.abs(currentZoneStart.x - currentDragPos.x);
    const h = Math.abs(currentZoneStart.y - currentDragPos.y);
    ctx.fillRect(x, y, w, h);
  }

  // Draw Vehicles
  vehicles.forEach(v => v.draw());

  // Draw Pedestrians
  pedestrians.forEach(p => p.draw());

  // Draw Effects
  effects.forEach(e => {
    ctx.globalAlpha = e.opacity;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(e.text, e.x, e.y);
    ctx.globalAlpha = 1;
  });
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

init();
