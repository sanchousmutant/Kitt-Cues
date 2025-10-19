// Временная JavaScript версия для GitHub Pages
// Основана на TypeScript рефакторинге, но упрощена для прямого выполнения в браузере

// Константы (упрощенная версия из constants.ts)
const PHYSICS_CONFIG = {
  BASE_FRICTION: 0.985,
  MOBILE_FRICTION: 0.8,
  BASE_MIN_VELOCITY: 0.05,
  MOBILE_MIN_VELOCITY: 0.07,
  BASE_HIT_POWER: 15,
  MOBILE_HIT_POWER: 7,
  PAW_HIT_POWER: 4,
  CAT_COOLDOWN: 60,
};

const GAME_CONFIG = {
  MAX_POWER: 25,
  MIN_POWER_FOR_CLICK: 10,
  POWER_SENSITIVITY: 6,
  AIM_LINE_LENGTH: 150,
  TABLE_ASPECT_RATIO: 1.5,
  BORDER_WIDTH: 20,
};

// Простое управление устройством
function isMobileDevice() {
  return window.innerWidth <= 640;
}

function isPortraitOrientation() {
  return window.innerHeight > window.innerWidth;
}

function vibrate(pattern) {
  const isMobile = isMobileDevice();
  if (!isMobile || !('vibrate' in navigator)) return;
  
  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.log('Vibration not supported:', error);
  }
}

// Базовый игровой класс
class SimpleGame {
  constructor() {
    this.balls = [];
    this.cats = [];
    this.pockets = [];
    this.score = 0;
    this.animationFrameId = null;
    this.cueAngle = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.isMobile = isMobileDevice();
    this.soundEnabled = true;
    this.audioContext = null;

    this.initializeElements();
    this.setupEventListeners();
    this.resetGame();
  }

  initializeElements() {
    this.gameArea = document.getElementById('game-area');
    this.table = document.getElementById('billiard-table');
    this.tableContainer = document.getElementById('billiard-table-container');
    this.cue = document.getElementById('cue');
    this.aimLine = document.getElementById('aim-line');
    this.powerIndicator = document.getElementById('power-indicator');
    this.powerFill = document.getElementById('power-fill');
    this.pyramidContainer = document.getElementById('ball-pyramid');
    this.helpModal = document.getElementById('help-modal');
  }

  setupEventListeners() {
    if (!this.gameArea) return;

    // Управление игрой
    this.gameArea.addEventListener('mousemove', (e) => this.aimCue(e));
    this.gameArea.addEventListener('mousedown', (e) => this.startDrag(e));
    window.addEventListener('mouseup', (e) => this.endDrag(e));

    // Сенсорное управление
    this.gameArea.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.aimCue(e);
      this.updatePowerIndicatorFromEvent(e);
    }, { passive: false });

    this.gameArea.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startDrag(e);
      vibrate(20);
    }, { passive: false });

    this.gameArea.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.endDrag(e);
      vibrate(40);
    }, { passive: false });

    // Кнопки
    const resetButton = document.getElementById('reset-button');
    const resetButtonLandscape = document.getElementById('reset-button-landscape');
    const soundToggle = document.getElementById('sound-toggle');
    const soundToggleLandscape = document.getElementById('sound-toggle-landscape');
    const helpButton = document.getElementById('help-button');
    const helpButtonLandscape = document.getElementById('help-button-landscape');
    const closeHelp = document.getElementById('close-help');

    if (resetButton) resetButton.addEventListener('click', () => this.resetGame());
    if (resetButtonLandscape) resetButtonLandscape.addEventListener('click', () => this.resetGame());
    if (soundToggle) soundToggle.addEventListener('click', () => this.toggleSound());
    if (soundToggleLandscape) soundToggleLandscape.addEventListener('click', () => this.toggleSound());
    if (helpButton) helpButton.addEventListener('click', () => this.showHelp());
    if (helpButtonLandscape) helpButtonLandscape.addEventListener('click', () => this.showHelp());
    if (closeHelp) closeHelp.addEventListener('click', () => this.hideHelp());

    // Клавиатура
    document.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case 'escape': this.hideHelp(); break;
        case 'h': this.showHelp(); break;
        case 's': this.toggleSound(); break;
      }
    });
  }

  initializeBalls() {
    this.balls = [];
    if (!this.table || !this.pyramidContainer) return;

    this.pyramidContainer.style.display = 'block';
    
    const ballElements = document.querySelectorAll('.billiard-ball');
    const tableRect = this.table.getBoundingClientRect();
    
    ballElements.forEach(el => {
      el.style.transform = '';
      el.style.display = 'block';
      
      const elRect = el.getBoundingClientRect();
      const posX = (elRect.left - tableRect.left) + elRect.width / 2;
      const posY = (elRect.top - tableRect.top) + elRect.height / 2;
      
      const ball = {
        el: el,
        x: posX,
        y: posY,
        vx: 0,
        vy: 0,
        radius: el.offsetWidth / 2,
        sunk: false
      };
      
      this.balls.push(ball);
      
      this.table.appendChild(el);
      el.style.position = 'absolute';
      el.style.left = '0px';
      el.style.top = '0px';
    });
    
    this.pyramidContainer.innerHTML = '';
    this.pyramidContainer.style.display = 'none';
    this.render();
  }

  initializeCats() {
    this.cats = [];
    if (!this.table) return;

    const catElements = document.querySelectorAll('.cat-container');
    const tableRect = this.table.getBoundingClientRect();

    catElements.forEach(el => {
      const catRect = el.getBoundingClientRect();
      const catCenterX = (catRect.left - tableRect.left) + catRect.width / 2;
      const catCenterY = (catRect.top - tableRect.top) + catRect.height / 2;
      
      let radius = Math.max(catRect.width, catRect.height) / 2;
      if (this.isMobile) radius *= 0.1;

      this.cats.push({
        el: el,
        pawEl: el.querySelector('.hitting-paw'),
        x: catCenterX,
        y: catCenterY,
        radius: radius,
        cooldown: 0
      });
    });
  }

  initializePockets() {
    this.pockets = [];
    if (!this.table) return;

    const pocketElements = document.querySelectorAll('[data-pocket]');
    const tableRect = this.table.getBoundingClientRect();
    
    pocketElements.forEach((el) => {
      const pocketRect = el.getBoundingClientRect();
      const pocketX = (pocketRect.left - tableRect.left) + pocketRect.width / 2;
      const pocketY = (pocketRect.top - tableRect.top) + pocketRect.height / 2;
      
      const visualRadius = Math.max(el.offsetWidth, el.offsetHeight) / 2;
      let pocketRadius = Math.max(6, visualRadius * 0.95);
      
      if (this.isMobile) {
        pocketRadius = Math.max(4, visualRadius * 0.5);
      }
      
      this.pockets.push({
        x: pocketX,
        y: pocketY,
        radius: pocketRadius
      });
    });
  }

  aimCue(e) {
    const cueBallObj = this.balls.find(b => b.el.id === 'cue-ball');
    if (!cueBallObj || !e || !this.table || !this.cue) return;

    const tableRect = this.table.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    if (clientX === undefined || clientY === undefined) return;
    
    let mouseX = clientX - tableRect.left;
    let mouseY = clientY - tableRect.top;

    const padding = 20;
    mouseX = Math.max(padding, Math.min(this.table.offsetWidth - padding, mouseX));
    mouseY = Math.max(padding, Math.min(this.table.offsetHeight - padding, mouseY));

    const targetAngle = Math.atan2(mouseY - cueBallObj.y, mouseX - cueBallObj.x);
    const followFactor = this.isMobile ? 0.08 : 0.15;
    
    // Простая интерполяция угла
    const diff = Math.atan2(Math.sin(targetAngle - this.cueAngle), Math.cos(targetAngle - this.cueAngle));
    this.cueAngle = this.cueAngle + diff * followFactor;

    this.updateCuePosition(cueBallObj);
    this.updateAimLine(cueBallObj.x, cueBallObj.y, this.cueAngle + Math.PI);
  }

  updateCuePosition(cueBall) {
    if (!this.cue) return;

    const degrees = this.cueAngle * (180 / Math.PI);
    const clearance = cueBall.radius + 6;
    const tipX = cueBall.x + Math.cos(this.cueAngle) * clearance;
    const tipY = cueBall.y + Math.sin(this.cueAngle) * clearance;

    this.cue.style.transformOrigin = 'left center';
    this.cue.style.left = '0px';
    this.cue.style.top = '0px';
    this.cue.style.transform = 
      `translate(${tipX}px, ${tipY - this.cue.offsetHeight / 2}px) rotate(${degrees}deg)`;
  }

  updateAimLine(startX, startY, angle) {
    if (!this.aimLine) return;
    
    this.aimLine.style.left = '0px';
    this.aimLine.style.top = '0px';
    this.aimLine.style.width = `${GAME_CONFIG.AIM_LINE_LENGTH}px`;
    this.aimLine.style.transform = 
      `translate(${startX}px, ${startY - 1}px) rotate(${angle * (180 / Math.PI)}deg)`;
    this.aimLine.style.transformOrigin = 'left center';
    
    if (this.isDragging) {
      this.aimLine.classList.add('visible');
    }
  }

  updatePowerIndicator(power) {
    if (!this.powerIndicator || !this.powerFill) return;
    
    const powerPercent = Math.min((power / GAME_CONFIG.MAX_POWER) * 100, 100);
    this.powerFill.style.width = `${powerPercent}%`;
    
    if (this.isDragging && power > 0) {
      this.powerIndicator.classList.add('visible');
      
      const cueBallObj = this.balls.find(b => b.el.id === 'cue-ball');
      if (cueBallObj) {
        this.powerIndicator.style.left = `${cueBallObj.x - 50}px`;
        this.powerIndicator.style.top = `${cueBallObj.y - 30}px`;
      }
    }
  }

  updatePowerIndicatorFromEvent(e) {
    if (!this.isDragging || !this.table) return;

    const tableRect = this.table.getBoundingClientRect();
    let currentX, currentY;

    if (e.touches && e.touches.length > 0) {
      currentX = e.touches[0].clientX - tableRect.left;
      currentY = e.touches[0].clientY - tableRect.top;
    } else {
      currentX = e.clientX - tableRect.left;
      currentY = e.clientY - tableRect.top;
    }

    const distance = Math.sqrt(
      (currentX - this.dragStartX) ** 2 + 
      (currentY - this.dragStartY) ** 2
    );
    const power = Math.min(distance / GAME_CONFIG.POWER_SENSITIVITY, GAME_CONFIG.MAX_POWER);
    this.updatePowerIndicator(power);
  }

  startDrag(e) {
    if (this.animationFrameId) return;
    
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return;
    }
    
    this.isDragging = true;
    
    if (!this.table) return;
    const tableRect = this.table.getBoundingClientRect();
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    if (clientX === undefined || clientY === undefined) return;
    
    this.dragStartX = clientX - tableRect.left;
    this.dragStartY = clientY - tableRect.top;
    
    this.aimCue(e);
    
    if (this.aimLine) this.aimLine.classList.add('visible');
    if (this.powerIndicator) this.powerIndicator.classList.add('visible');
  }

  endDrag(e) {
    if (!this.isDragging || this.animationFrameId) return;
    
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.closest('button'))) {
      this.isDragging = false;
      this.hideVisualHelpers();
      return;
    }
    
    this.isDragging = false;
    
    if (!this.table) return;
    const tableRect = this.table.getBoundingClientRect();
    
    let clientX, clientY;
    if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else if (e.clientX !== undefined) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      clientX = this.dragStartX + tableRect.left;
      clientY = this.dragStartY + tableRect.top;
    }
    
    const dragEndX = clientX - tableRect.left;
    const dragEndY = clientY - tableRect.top;
    const dragDistance = Math.sqrt(
      (dragEndX - this.dragStartX) ** 2 + 
      (dragEndY - this.dragStartY) ** 2
    );
    
    let power = Math.min(dragDistance / GAME_CONFIG.POWER_SENSITIVITY, GAME_CONFIG.MAX_POWER);
    if (dragDistance < 10) {
      power = this.isMobile ? PHYSICS_CONFIG.MOBILE_HIT_POWER : PHYSICS_CONFIG.BASE_HIT_POWER;
    }
    
    this.hideVisualHelpers();
    this.hitBall(power);
  }

  hideVisualHelpers() {
    if (this.aimLine) this.aimLine.classList.remove('visible');
    if (this.powerIndicator) this.powerIndicator.classList.remove('visible');
  }

  hitBall(power) {
    if (this.animationFrameId) return;
    
    const cueBallObj = this.balls.find(b => b.el.id === 'cue-ball');
    if (!cueBallObj) return;

    this.playHitSound();

    // Применяем силу к битку
    cueBallObj.vx = -Math.cos(this.cueAngle) * power;
    cueBallObj.vy = -Math.sin(this.cueAngle) * power;
    
    // Анимация отката кия
    if (this.cue) {
      const degrees = this.cueAngle * (180 / Math.PI);
      const recoil = Math.min(power * 0.8, 30);
      const baseTransform = `rotate(${degrees}deg)`;
      const hitTransform = `rotate(${degrees}deg) translateX(-${recoil}px)`;

      this.cue.style.transform = hitTransform;
      setTimeout(() => {
        if (this.cue) this.cue.style.transform = baseTransform;
      }, 100);
    }

    this.startGameLoop();
    
    if (this.cue) {
      this.cue.style.visibility = 'hidden';
    }

    vibrate(Math.min(power * 2, 30));
  }

  startGameLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  gameLoop() {
    this.updatePhysics();
    this.render();
    
    const allStopped = this.balls.every(b => b.sunk || (b.vx === 0 && b.vy === 0));
    if (allStopped) {
      this.animationFrameId = null;
      this.onGameStopped();
    } else {
      this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }
  }

  updatePhysics() {
    // Обновляем кулдауны котов
    this.cats.forEach(cat => {
      if (cat.cooldown > 0) cat.cooldown--;
    });

    const friction = this.isMobile ? PHYSICS_CONFIG.MOBILE_FRICTION : PHYSICS_CONFIG.BASE_FRICTION;
    const minVelocity = this.isMobile ? PHYSICS_CONFIG.MOBILE_MIN_VELOCITY : PHYSICS_CONFIG.BASE_MIN_VELOCITY;

    for (const ball of this.balls) {
      if (ball.sunk) continue;

      // Применяем трение
      if (Math.abs(ball.vx) < minVelocity) ball.vx = 0;
      if (Math.abs(ball.vy) < minVelocity) ball.vy = 0;
      
      if (ball.vx === 0 && ball.vy === 0) continue;

      ball.vx *= friction;
      ball.vy *= friction;
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Проверяем попадание в лузы
      this.checkPocketCollisions(ball);
      if (ball.sunk) continue;

      // Столкновения со стенами
      this.checkWallCollisions(ball);

      // Столкновения с кошками
      this.checkCatCollisions(ball);
    }

    // Столкновения шаров между собой
    this.checkBallCollisions();
  }

  checkPocketCollisions(ball) {
    for (const pocket of this.pockets) {
      const dx = ball.x - pocket.x;
      const dy = ball.y - pocket.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if ((distance + ball.radius) < pocket.radius && !ball.sunk) {
        ball.sunk = true;
        ball.vx = 0;
        ball.vy = 0;
        ball.el.style.display = 'none';
        
        if (ball.el.id !== 'cue-ball') {
          this.score++;
          this.updateScore();
          this.playHitSound();
        } else {
          // Возвращаем биток
          setTimeout(() => {
            ball.x = this.table.offsetWidth * 0.25;
            ball.y = this.table.offsetHeight * 0.5;
            ball.vx = 0;
            ball.vy = 0;
            ball.sunk = false;
            ball.el.style.display = 'block';
            this.render();
          }, 1000);
        }
        return;
      }
    }
  }

  checkWallCollisions(ball) {
    if ((ball.x - ball.radius < 0 && ball.vx < 0) || 
        (ball.x + ball.radius > this.table.offsetWidth && ball.vx > 0)) {
      ball.vx *= -1;
      this.playWallHitSound();
      if (ball.x - ball.radius < 0) ball.x = ball.radius;
      if (ball.x + ball.radius > this.table.offsetWidth) ball.x = this.table.offsetWidth - ball.radius;
    }
    
    if ((ball.y - ball.radius < 0 && ball.vy < 0) || 
        (ball.y + ball.radius > this.table.offsetHeight && ball.vy > 0)) {
      ball.vy *= -1;
      this.playWallHitSound();
      if (ball.y - ball.radius < 0) ball.y = ball.radius;
      if (ball.y + ball.radius > this.table.offsetHeight) ball.y = this.table.offsetHeight - ball.radius;
    }
  }

  checkCatCollisions(ball) {
    for (const cat of this.cats) {
      if (cat.cooldown > 0 || ball.sunk) continue;
      
      const dx = ball.x - cat.x;
      const dy = ball.y - cat.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < ball.radius + cat.radius) {
        if (this.isMobile) {
          const speed = Math.hypot(ball.vx, ball.vy);
          if (speed < 3) continue;
        }

        this.playMeowSound();
        cat.cooldown = this.isMobile ? PHYSICS_CONFIG.CAT_COOLDOWN * 2 : PHYSICS_CONFIG.CAT_COOLDOWN;
        
        // Анимация лапки
        const pawElement = cat.pawEl || cat.el;
        pawElement.classList.add('swat-animation');
        setTimeout(() => pawElement.classList.remove('swat-animation'), 300);

        // Отталкиваем шар
        const angle = Math.atan2(dy, dx);
        const effectivePawPower = this.isMobile ? 
          Math.max(1, PHYSICS_CONFIG.PAW_HIT_POWER * 0.25) : 
          PHYSICS_CONFIG.PAW_HIT_POWER;
        
        ball.vx = Math.cos(angle) * effectivePawPower;
        ball.vy = Math.sin(angle) * effectivePawPower;

        // Предотвращаем залипание
        const overlap = (ball.radius + cat.radius) - distance + 1;
        ball.x += Math.cos(angle) * overlap;
        ball.y += Math.sin(angle) * overlap;
      }
    }
  }

  checkBallCollisions() {
    for (let i = 0; i < this.balls.length; i++) {
      if (this.balls[i].sunk) continue;
      
      for (let j = i + 1; j < this.balls.length; j++) {
        if (this.balls[j].sunk) continue;
        
        const ball1 = this.balls[i];
        const ball2 = this.balls[j];
        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ball1.radius + ball2.radius) {
          const angle = Math.atan2(dy, dx);
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);

          // Упрощенная физика столкновений
          let vx1 = ball1.vx * cos + ball1.vy * sin;
          let vy1 = ball1.vy * cos - ball1.vx * sin;
          let vx2 = ball2.vx * cos + ball2.vy * sin;
          let vy2 = ball2.vy * cos - ball2.vx * sin;

          const tempVx = vx1;
          vx1 = vx2;
          vx2 = tempVx;

          ball1.vx = vx1 * cos - vy1 * sin;
          ball1.vy = vy1 * cos + vx1 * sin;
          ball2.vx = vx2 * cos - vy2 * sin;
          ball2.vy = vy2 * cos + vx2 * sin;

          // Разделяем шары
          const overlap = (ball1.radius + ball2.radius) - distance + 1;
          const moveX = (overlap / 2) * cos;
          const moveY = (overlap / 2) * sin;
          ball1.x -= moveX;
          ball1.y -= moveY;
          ball2.x += moveX;
          ball2.y += moveY;

          this.playHitSound();
        }
      }
    }
  }

  onGameStopped() {
    const cueBallObj = this.balls.find(b => b.el.id === 'cue-ball');
    if (cueBallObj && this.cue) {
      this.cue.style.visibility = 'visible';
      this.updateCuePosition(cueBallObj);
    }
  }

  render() {
    this.balls.forEach(ball => {
      if (!ball.sunk) {
        ball.el.style.left = '0px';
        ball.el.style.top = '0px';
        ball.el.style.transform = `translate(${ball.x - ball.radius}px, ${ball.y - ball.radius}px)`;
      }
    });
  }

  updateScore() {
    const scoreDisplay = document.getElementById('score-display');
    const scoreDisplayLandscape = document.getElementById('score-display-landscape');
    
    const scoreText = `Счет: ${this.score}`;
    if (scoreDisplay) scoreDisplay.textContent = scoreText;
    if (scoreDisplayLandscape) scoreDisplayLandscape.textContent = scoreText;
  }

  resetGame() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.score = 0;
    this.updateScore();
    
    this.initializePockets();
    this.initializeBalls();
    this.initializeCats();
    
    // Позиционируем шары
    const cueBall = this.balls.find(b => b.el.id === 'cue-ball');
    if (cueBall && this.table) {
      cueBall.x = this.table.offsetWidth * 0.25;
      cueBall.y = this.table.offsetHeight * 0.5;
    }
    
    this.positionColoredBalls();
    this.render();
    this.showCueAtDefaultPosition();
  }

  positionColoredBalls() {
    if (!this.table) return;

    const coloredBalls = this.balls.filter(b => b.el.id !== 'cue-ball');
    const ballRadius = coloredBalls[0]?.radius || 12;
    const tableWidth = this.table.offsetWidth;
    const tableHeight = this.table.offsetHeight;
    
    const triangleX = Math.min(tableWidth * 0.6, tableWidth - ballRadius * 8);
    const triangleY = tableHeight * 0.5;
    const ballSpacing = Math.min(ballRadius * 2.2, (tableWidth - triangleX) / 4);
    
    const positions = [
      [triangleX, triangleY],
      [triangleX + ballSpacing, triangleY - ballSpacing * 0.5],
      [triangleX + ballSpacing, triangleY + ballSpacing * 0.5],
      [triangleX + ballSpacing * 2, triangleY - ballSpacing],
      [triangleX + ballSpacing * 2, triangleY],
      [triangleX + ballSpacing * 2, triangleY + ballSpacing],
      [triangleX + ballSpacing * 3, triangleY - ballSpacing * 1.5],
      [triangleX + ballSpacing * 3, triangleY - ballSpacing * 0.5],
      [triangleX + ballSpacing * 3, triangleY + ballSpacing * 0.5],
      [triangleX + ballSpacing * 3, triangleY + ballSpacing * 1.5],
    ];
    
    positions.forEach(([x, y], index) => {
      if (index < coloredBalls.length) {
        const ball = coloredBalls[index];
        ball.x = Math.max(ballRadius, Math.min(tableWidth - ballRadius, x));
        ball.y = Math.max(ballRadius, Math.min(tableHeight - ballRadius, y));
      }
    });
  }

  showCueAtDefaultPosition() {
    const cueBallObj = this.balls.find(b => b.el.id === 'cue-ball');
    if (cueBallObj && this.cue) {
      this.cue.style.visibility = 'visible';
      this.cueAngle = 0;
      this.updateCuePosition(cueBallObj);
    }
  }

  // Простые звуковые эффекты
  initAudio() {
    if (this.audioContext) return;
    
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    } catch (error) {
      console.warn('Audio context initialization failed:', error);
    }
  }

  playHitSound() {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
    } catch (error) {
      console.log('Error playing hit sound:', error);
    }
  }

  playWallHitSound() {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
    } catch (error) {
      console.log('Error playing wall hit sound:', error);
    }
  }

  playMeowSound() {
    if (!this.soundEnabled) return;
    this.initAudio();
    if (!this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(800, this.audioContext.currentTime + 0.1);
      oscillator.frequency.linearRampToValueAtTime(400, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Error playing meow sound:', error);
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    
    const soundButton = document.getElementById('sound-toggle');
    const soundButtonLandscape = document.getElementById('sound-toggle-landscape');
    
    const icon = this.soundEnabled ? '🔊' : '🔇';
    const title = this.soundEnabled ? 'Отключить звук' : 'Включить звук';
    
    if (soundButton) {
      soundButton.textContent = icon;
      soundButton.title = title;
    }
    
    if (soundButtonLandscape) {
      soundButtonLandscape.textContent = icon;
      soundButtonLandscape.title = title;
    }
  }

  showHelp() {
    if (this.helpModal) {
      this.helpModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  hideHelp() {
    if (this.helpModal) {
      this.helpModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  new SimpleGame();
});