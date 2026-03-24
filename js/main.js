// --- Phaser Setup ---
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// --- Game State ---
let gameState = {
    money: 1000,
    food: 0,
    population: 100,
    workers: []
};

// UI References
const moneyDisplay = document.getElementById('money-display');
const foodDisplay = document.getElementById('food-display');
const announcement = document.getElementById('announcement');

function updateUI() {
    moneyDisplay.textContent = `$${gameState.money}`;
    foodDisplay.textContent = gameState.food;
}

function showAnnouncement(text) {
    announcement.textContent = text;
    announcement.style.opacity = '1';
    setTimeout(() => {
        announcement.style.opacity = '0';
    }, 3000);
}

// --- Game Logic ---
let holes;
let crops;
let ground;
let workerGroup;

function preload() {
    this.load.image('grass', 'assets/grass.png');
    this.load.image('hole', 'assets/hole.png');
    this.load.image('crop', 'assets/crop.png');
    this.load.image('worker', 'assets/worker.png');
}

function create() {
    const self = this;
    
    // Create world
    ground = this.add.group();
    holes = this.physics.add.group();
    crops = this.physics.add.group();
    workerGroup = this.physics.add.group();

    // Create Grid
    const tileSize = 64;
    for (let y = 0; y < config.height / tileSize; y++) {
        for (let x = 0; x < config.width / tileSize; x++) {
            const tile = this.add.sprite(x * tileSize + tileSize/2, y * tileSize + tileSize/2, 'grass').setInteractive();
            
            tile.on('pointerdown', () => {
                plantCrop(self, x * tileSize + tileSize/2, y * tileSize + tileSize/2);
            });
            
            ground.add(tile);
        }
    }

    // Initial holes
    for(let i=0; i<5; i++) {
        spawnHole(this);
    }

    // Hole spawning timer
    this.time.addEvent({
        delay: 10000,
        callback: () => spawnHole(this),
        loop: true
    });

    // Collision: Workers fix holes
    this.physics.add.overlap(workerGroup, holes, (worker, hole) => {
        hole.destroy();
        gameState.money += 5; // Reward for maintenance
        updateUI();
        showAnnouncement("Buraco consertado pelo Gari-Engenheiro! +$5");
    });

    // Expose scene to window for hire function
    window.gameScene = this;
}

function update() {
    gameState.workers.forEach(w => {
        // Some random movement
        if (Math.random() < 0.02) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100;
            w.sprite.body.setVelocity(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );
            w.sprite.flipX = w.sprite.body.velocity.x < 0;
        }

        // Keep workers within bounds (manual cleanup though setCollideWorldBounds is set)
        if (w.sprite.x < 0) w.sprite.x = 0;
        if (w.sprite.x > config.width) w.sprite.x = config.width;
        if (w.sprite.y < 0) w.sprite.y = 0;
        if (w.sprite.y > config.height) w.sprite.y = config.height;
    });
}

function spawnHole(scene) {
    const x = Phaser.Math.Between(50, config.width - 50);
    const y = Phaser.Math.Between(50, config.height - 50);
    const hole = scene.physics.add.sprite(x, y, 'hole');
    holes.add(hole);
}

function plantCrop(scene, x, y) {
    if (gameState.money >= 10) {
        gameState.money -= 10;
        updateUI();
        
        const crop = scene.physics.add.sprite(x, y, 'crop');
        crop.setScale(0.5);
        crops.add(crop);

        scene.tweens.add({
            targets: crop,
            scale: 1,
            duration: 5000,
            ease: 'Power1',
            onComplete: () => {
                crop.setTint(0x00ff00);
                crop.setInteractive();
                crop.on('pointerdown', () => {
                    crop.destroy();
                    gameState.food += 10;
                    updateUI();
                    showAnnouncement("Comida colhida! +10 Comida");
                });
            }
        });
    } else {
        showAnnouncement("Dinheiro insuficiente para plantar!");
    }
}

window.hireWorker = function() {
    if (gameState.money >= 100) {
        gameState.money -= 100;
        updateUI();

        const scene = window.gameScene;
        const x = config.width / 2;
        const y = config.height / 2;
        const sprite = scene.physics.add.sprite(x, y, 'worker');
        
        sprite.setCollideWorldBounds(true);
        sprite.setBounce(1, 1);
        
        const angle = Math.random() * Math.PI * 2;
        sprite.setVelocity(Math.cos(angle) * 100, Math.sin(angle) * 100);
        
        workerGroup.add(sprite);
        gameState.workers.push({
            sprite: sprite
        });

        showAnnouncement("Gari-Engenheiro contratado para manutenção!");
    } else {
        showAnnouncement("Dinheiro insuficiente para contratar!");
    }
}
