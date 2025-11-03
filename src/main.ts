import { BallObject, GameState } from './types';
import { DOM_SELECTORS, GAME_CONFIG, POCKET_CONFIG } from './constants';
import { PhysicsEngine } from './modules/physics';
import { soundManager } from './modules/sound';
import { UIManager } from './modules/ui';
import { catManager } from './modules/cats';
import { debounce, smoothAngle, clamp, distance, angle } from './utils/helpers';
import { isMobileDevice, isPortraitOrientation, vibrate, enterFullscreen, exitFullscreen, isFullscreenActive } from './utils/device';

class Game {
  private physicsEngine: PhysicsEngine;
  private uiManager: UIManager;
  private gameState: GameState;
  private isMobile: boolean = false;
  private isPortrait: boolean = false;
  private didInitialReset: boolean = false;

  constructor() {
    this.isMobile = isMobileDevice();
    this.isPortrait = isPortraitOrientation();
    
    // Инициализация движков и менеджеров
    this.physicsEngine = new PhysicsEngine(this.isMobile);
    this.uiManager = new UIManager();
    
    // Начальное состояние игры
    this.gameState = {
      balls: [],
      cats: [],
      pockets: [],
      score: 0,
      animationFrameId: null,
      cueAngle: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      didInitialReset: false,
      soundEnabled: soundManager.isSoundEnabled,
      musicEnabled: soundManager.isMusicEnabled,
      isMusicPlaying: soundManager.getIsMusicPlaying,
      musicVolume: soundManager.getMusicVolume
    };

    this.init();
  }

  private async init(): Promise<void> {
    // Ждем полной загрузки DOM
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    this.setupEventListeners();
    this.uiManager.loadUISettings();
    
    // Инициализация игровых объектов
    this.initializeCats();
    this.initializePockets();
    
    // Настройка layout
    this.setupLayout();
    
    // Настройка PWA
    this.setupPWA();
  }

  private setupEventListeners(): void {
    const gameArea = this.uiManager.gameArea;
    if (!gameArea) return;

    // Обработчики для управления игрой
    this.setupGameControls(gameArea);
    
    // Обработчики для кнопок UI
    this.setupUIControls();
    
    // Обработчики изменения размера и ориентации
    this.setupResizeHandlers();
  }

  private setupGameControls(gameArea: HTMLElement): void {
    // Мышь
    gameArea.addEventListener('mousemove', (e) => this.aimCue(e));
    gameArea.addEventListener('mousedown', (e) => this.startDrag(e));
    window.addEventListener('mouseup', (e) => this.endDrag(e));
    
    // Сенсорное управление
    gameArea.addEventListener('touchmove', (e) => {
      if (this.uiManager.helpModal && !this.uiManager.helpModal.classList.contains('hidden')) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      if (e.touches?.length > 0) {
        this.aimCue(e);
        this.updatePowerIndicatorFromEvent(e);
      }
    }, { passive: false });
    
    gameArea.addEventListener('touchstart', (e) => {
      if (this.uiManager.helpModal && !this.uiManager.helpModal.classList.contains('hidden')) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      if (e.touches?.[0]) {
        this.startDrag(e);
        vibrate(20);
      }
    }, { passive: false });
    
    gameArea.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      this.endDrag(e);
      if (this.gameState.isDragging) {
        vibrate(40);
      }
    }, { passive: false });

    // Предотвращаем контекстное меню и жесты
    gameArea.addEventListener('contextmenu', (e) => e.preventDefault());
    gameArea.addEventListener('gesturestart', (e) => e.preventDefault());
    gameArea.addEventListener('gesturechange', (e) => e.preventDefault());
    gameArea.addEventListener('gestureend', (e) => e.preventDefault());
  }

  private setupUIControls(): void {
    // Кнопка сброса игры
    if (this.uiManager.resetButton) {
      this.addButtonHandler(this.uiManager.resetButton, () => this.resetGame());
    }
    if (this.uiManager.resetButtonLandscape) {
      this.addButtonHandler(this.uiManager.resetButtonLandscape, () => this.resetGame());
    }
  }

  private addButtonHandler(button: HTMLElement, handler: () => void): void {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler();
    });
  }

  private setupResizeHandlers(): void {
    const debouncedRecomputeLayout = debounce(() => {
      this.handleResize();
      this.uiManager.positionUIElements();
      
      if (!this.didInitialReset) {
        this.resetGame();
        this.didInitialReset = true;
      }
      
      this.maybeAttemptFullscreen();
    }, 100);

    window.addEventListener('resize', debouncedRecomputeLayout);
    
    window.addEventListener('orientationchange', () => {
      setTimeout(debouncedRecomputeLayout, 200);
    });

    // Первоначальная настройка
    setTimeout(debouncedRecomputeLayout, 100);
    setTimeout(() => this.uiManager.positionUIElements(), 300);
  }

  private handleResize(): void {
    this.isMobile = isMobileDevice();
    this.isPortrait = isPortraitOrientation();
    
    this.physicsEngine.updateSettings(this.isMobile);
    catManager.updateMobileSettings(this.isMobile);
    this.uiManager.checkOrientation();
    this.uiManager.updateLayout();
    
    // Переинициализируем игровые объекты
    this.initializeCats();
    this.initializePockets();
    this.initializeBalls();
  }

  private maybeAttemptFullscreen(): void {
    const newIsPortrait = isPortraitOrientation();
    const orientationChanged = newIsPortrait !== this.isPortrait;
    this.isPortrait = newIsPortrait;
    this.isMobile = isMobileDevice();
    
    if (this.isMobile && !this.isPortrait && !isFullscreenActive()) {
      setTimeout(() => enterFullscreen(), 100);
    }
    
    if (this.isMobile && this.isPortrait && isFullscreenActive()) {
      exitFullscreen();
    }
    
    if (orientationChanged && this.isMobile) {
      vibrate(50);
    }
  }

  private setupPWA(): void {
    // PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('beforeinstallprompt event received');
      e.preventDefault();
      // Здесь можно показать кнопку установки PWA
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA successfully installed');
      vibrate([100, 50, 100]);
    });

    // Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .then((registration) => {
            console.log('✅ Service Worker registered successfully:', registration.scope);
          })
          .catch((registrationError) => {
            console.log('❌ Service Worker registration failed:', registrationError);
          });
      });
    }
  }

  private setupLayout(): void {
    if (this.uiManager.gameArea) {
      this.uiManager.gameArea.classList.add('dynamic-scaling');
    }
  }

  private initializeCats(): void {
    if (!this.uiManager.table) return;
    this.gameState.cats = catManager.initializeCats(this.uiManager.table);
  }

  private initializePockets(): void {
    this.gameState.pockets = [];
    if (!this.uiManager.table) return;

    const pocketElements = document.querySelectorAll(DOM_SELECTORS.POCKETS);
    const tableRect = this.uiManager.table.getBoundingClientRect();
    
    pocketElements.forEach((el) => {
      const pocketRect = el.getBoundingClientRect();
      const pocketX = (pocketRect.left - tableRect.left) + pocketRect.width / 2;
      const pocketY = (pocketRect.top - tableRect.top) + pocketRect.height / 2;
      
      const visualRadius = Math.max((el as HTMLElement).offsetWidth, (el as HTMLElement).offsetHeight) / 2;
      let pocketRadius = Math.max(
        POCKET_CONFIG.MIN_RADIUS, 
        visualRadius * POCKET_CONFIG.VISUAL_RADIUS_MULTIPLIER
      );
      
      if (this.isMobile) {
        pocketRadius = Math.max(
          POCKET_CONFIG.MIN_MOBILE_RADIUS, 
          visualRadius * POCKET_CONFIG.MOBILE_VISUAL_RADIUS_MULTIPLIER
        );
      }
      
      this.gameState.pockets.push({
        x: pocketX,
        y: pocketY,
        radius: pocketRadius
      });
    });
  }

  private initializeBalls(): void {
    this.gameState.balls = [];
    if (!this.uiManager.table || !this.uiManager.pyramidContainer) return;

    this.uiManager.pyramidContainer.style.display = 'block';
    
    const ballElements = document.querySelectorAll(DOM_SELECTORS.BILLIARD_BALLS);
    const tableRect = this.uiManager.table.getBoundingClientRect();
    
    ballElements.forEach(el => {
      (el as HTMLElement).style.transform = '';
      (el as HTMLElement).style.display = 'block';
      
      const elRect = el.getBoundingClientRect();
      const posX = (elRect.left - tableRect.left) + elRect.width / 2;
      const posY = (elRect.top - tableRect.top) + elRect.height / 2;
      
      const ball: BallObject = {
        el: el as HTMLElement,
        x: posX,
        y: posY,
        vx: 0,
        vy: 0,
        radius: (el as HTMLElement).offsetWidth / 2,
        sunk: false
      };
      
      this.gameState.balls.push(ball);
      
      // Переносим шар на стол
      this.uiManager.table!.appendChild(el);
      (el as HTMLElement).style.position = 'absolute';
      (el as HTMLElement).style.left = '0px';
      (el as HTMLElement).style.top = '0px';
    });
    
    this.uiManager.pyramidContainer.innerHTML = '';
    this.uiManager.pyramidContainer.style.display = 'none';
    this.render();
  }

  private aimCue(e: MouseEvent | TouchEvent): void {
    const cueBallObj = this.gameState.balls.find(b => b.el.id === 'cue-ball');
    if (!cueBallObj || !e || !this.uiManager.table || !this.uiManager.cue) return;

    const tableRect = this.uiManager.table.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return;
    }
    
    let mouseX = clientX - tableRect.left;
    let mouseY = clientY - tableRect.top;

    // Ограничиваем позицию курсора границами стола
    const padding = 20;
    mouseX = clamp(mouseX, padding, this.uiManager.table.offsetWidth - padding);
    mouseY = clamp(mouseY, padding, this.uiManager.table.offsetHeight - padding);

    const targetAngle = angle(cueBallObj.x, cueBallObj.y, mouseX, mouseY);
    const followFactor = this.isMobile ? 0.08 : 0.15;
    this.gameState.cueAngle = smoothAngle(this.gameState.cueAngle, targetAngle, followFactor);

    this.updateCuePosition(cueBallObj);
    this.updateAimLine(cueBallObj.x, cueBallObj.y, this.gameState.cueAngle + Math.PI);
  }

  private updateCuePosition(cueBall: BallObject): void {
    if (!this.uiManager.cue) return;

    const degrees = this.gameState.cueAngle * (180 / Math.PI);
    const clearance = cueBall.radius + 6;
    const tipX = cueBall.x + Math.cos(this.gameState.cueAngle) * clearance;
    const tipY = cueBall.y + Math.sin(this.gameState.cueAngle) * clearance;

    this.uiManager.cue.style.transformOrigin = 'left center';
    this.uiManager.cue.style.left = '0px';
    this.uiManager.cue.style.top = '0px';
    this.uiManager.cue.style.transform = 
      `translate(${tipX}px, ${tipY - this.uiManager.cue.offsetHeight / 2}px) rotate(${degrees}deg)`;
  }

  private updateAimLine(startX: number, startY: number, angle: number): void {
    if (!this.uiManager.aimLine) return;
    
    const lineLength = GAME_CONFIG.AIM_LINE_LENGTH;
    
    this.uiManager.aimLine.style.left = '0px';
    this.uiManager.aimLine.style.top = '0px';
    this.uiManager.aimLine.style.width = `${lineLength}px`;
    this.uiManager.aimLine.style.transform = 
      `translate(${startX}px, ${startY - 1}px) rotate(${angle * (180 / Math.PI)}deg)`;
    this.uiManager.aimLine.style.transformOrigin = 'left center';
    
    if (this.gameState.isDragging) {
      this.uiManager.aimLine.classList.add('visible');
    }
  }

  private updatePowerIndicator(power: number): void {
    if (!this.uiManager.powerIndicator || !this.uiManager.powerFill) return;
    
    const powerPercent = Math.min((power / GAME_CONFIG.MAX_POWER) * 100, 100);
    this.uiManager.powerFill.style.width = `${powerPercent}%`;
    
    if (this.gameState.isDragging && power > 0) {
      this.uiManager.powerIndicator.classList.add('visible');
      
      const cueBallObj = this.gameState.balls.find(b => b.el.id === 'cue-ball');
      if (cueBallObj) {
        this.uiManager.powerIndicator.style.left = `${cueBallObj.x - 50}px`;
        this.uiManager.powerIndicator.style.top = `${cueBallObj.y - 30}px`;
      }
    }
  }

  private updatePowerIndicatorFromEvent(e: MouseEvent | TouchEvent): void {
    if (!this.gameState.isDragging || !this.uiManager.table) return;

    const tableRect = this.uiManager.table.getBoundingClientRect();
    let currentX: number, currentY: number;

    if ('touches' in e && e.touches.length > 0) {
      currentX = e.touches[0].clientX - tableRect.left;
      currentY = e.touches[0].clientY - tableRect.top;
    } else if ('clientX' in e) {
      currentX = e.clientX - tableRect.left;
      currentY = e.clientY - tableRect.top;
    } else {
      return;
    }

    const distance = Math.sqrt(
      (currentX - this.gameState.dragStartX) ** 2 + 
      (currentY - this.gameState.dragStartY) ** 2
    );
    const power = Math.min(distance / GAME_CONFIG.POWER_SENSITIVITY, GAME_CONFIG.MAX_POWER);
    this.updatePowerIndicator(power);
  }

  private startDrag(e: MouseEvent | TouchEvent): void {
    if (this.gameState.animationFrameId) return;
    
    if ((e.target as Element)?.tagName === 'BUTTON' || (e.target as Element)?.closest('button')) {
      return;
    }
    
    this.gameState.isDragging = true;
    
    if (!this.uiManager.table) return;
    const tableRect = this.uiManager.table.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return;
    }
    
    this.gameState.dragStartX = clientX - tableRect.left;
    this.gameState.dragStartY = clientY - tableRect.top;
    
    this.aimCue(e);
    
    if (this.uiManager.aimLine) this.uiManager.aimLine.classList.add('visible');
    if (this.uiManager.powerIndicator) this.uiManager.powerIndicator.classList.add('visible');
  }

  private endDrag(e: MouseEvent | TouchEvent): void {
    if (!this.gameState.isDragging || this.gameState.animationFrameId) return;
    
    if ((e.target as Element)?.tagName === 'BUTTON' || (e.target as Element)?.closest('button')) {
      this.gameState.isDragging = false;
      this.hideVisualHelpers();
      return;
    }
    
    this.gameState.isDragging = false;
    
    if (!this.uiManager.table) return;
    const tableRect = this.uiManager.table.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    if ('changedTouches' in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      clientX = this.gameState.dragStartX + tableRect.left;
      clientY = this.gameState.dragStartY + tableRect.top;
    }
    
    const dragEndX = clientX - tableRect.left;
    const dragEndY = clientY - tableRect.top;
    const dragDistance = distance(
      dragEndX, dragEndY, 
      this.gameState.dragStartX, this.gameState.dragStartY
    );
    
    let power = Math.min(dragDistance / GAME_CONFIG.POWER_SENSITIVITY, GAME_CONFIG.MAX_POWER);
    if (dragDistance < 10) {
      power = this.physicsEngine.getSettings().hitPower;
    }
    
    this.hideVisualHelpers();
    this.hitBall(power);
  }

  private hideVisualHelpers(): void {
    if (this.uiManager.aimLine) this.uiManager.aimLine.classList.remove('visible');
    if (this.uiManager.powerIndicator) this.uiManager.powerIndicator.classList.remove('visible');
  }

  private hitBall(power: number = this.physicsEngine.getSettings().hitPower): void {
    soundManager.initAudio();
    
    if (this.gameState.animationFrameId) return;
    
    const cueBallObj = this.gameState.balls.find(b => b.el.id === 'cue-ball');
    if (!cueBallObj) return;

    soundManager.playHitSound();
    this.physicsEngine.applyForce(cueBallObj, this.gameState.cueAngle, power);
    
    // Анимация удара кием
    if (this.uiManager.cue) {
      const degrees = this.gameState.cueAngle * (180 / Math.PI);
      const recoil = Math.min(power * 0.8, 30);
      const baseTransform = `rotate(${degrees}deg)`;
      const hitTransform = `rotate(${degrees}deg) translateX(-${recoil}px)`;

      this.uiManager.cue.style.transform = hitTransform;
      setTimeout(() => {
        if (this.uiManager.cue) {
          this.uiManager.cue.style.transform = baseTransform;
        }
      }, 100);
    }

    this.startGameLoop();
    
    if (this.uiManager.cue) {
      this.uiManager.cue.style.visibility = 'hidden';
    }
  }

  private startGameLoop(): void {
    if (this.gameState.animationFrameId) {
      cancelAnimationFrame(this.gameState.animationFrameId);
    }
    
    this.gameState.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  private gameLoop(): void {
    this.updatePhysics();
    this.render();
    
    const allStopped = this.physicsEngine.areAllBallsStopped(this.gameState.balls);
    if (allStopped) {
      this.gameState.animationFrameId = null;
      this.onGameStopped();
    } else {
      this.gameState.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    }
  }

  private updatePhysics(): void {
    catManager.updateCatCooldowns();
    
    if (!this.uiManager.table) return;
    
    for (const ball of this.gameState.balls) {
      const wasMoving = this.physicsEngine.updateBallPhysics(
        ball,
        this.uiManager.table.offsetWidth,
        this.uiManager.table.offsetHeight,
        this.gameState.cats,
        this.gameState.pockets
      );

      // Обрабатываем события забивания шаров
      if (ball.sunk && wasMoving) {
        this.onBallSunk(ball);
      }
    }

    this.physicsEngine.checkBallCollisions(this.gameState.balls);
  }

  private onBallSunk(ball: BallObject): void {
    if (ball.el.id !== 'cue-ball') {
      this.gameState.score++;
      this.uiManager.updateScore(this.gameState.score);
      
      // Показываем грустные эмодзи над котами
      if (this.uiManager.table) {
        catManager.showAllCatsEmoji('😿', this.uiManager.table);
      }
    } else {
      // Радостные коты при забитии битка
      if (this.uiManager.table) {
        catManager.showAllCatsEmoji('😺', this.uiManager.table);
      }
      
      // Возвращаем биток на стартовую позицию
      setTimeout(() => {
        if (this.uiManager.table) {
          ball.x = this.uiManager.table.offsetWidth * 0.25;
          ball.y = this.uiManager.table.offsetHeight * 0.5;
          ball.vx = 0;
          ball.vy = 0;
          ball.sunk = false;
          ball.el.style.display = 'block';
          this.render();
        }
      }, 1000);
    }
  }

  private onGameStopped(): void {
    // Показываем кий после полной остановки шаров
    const cueBallObj = this.gameState.balls.find(b => b.el.id === 'cue-ball');
    if (cueBallObj && this.uiManager.cue) {
      // Используем переменные для позиционирования кия
      this.uiManager.cue.style.visibility = 'visible';
      this.updateCuePosition(cueBallObj);
    }
  }

  private render(): void {
    this.gameState.balls.forEach(ball => {
      if (!ball.sunk) {
        ball.el.style.left = '0px';
        ball.el.style.top = '0px';
        ball.el.style.transform = `translate(${ball.x - ball.radius}px, ${ball.y - ball.radius}px)`;
      }
    });
  }

  public resetGame(): void {
    if (this.gameState.animationFrameId) {
      cancelAnimationFrame(this.gameState.animationFrameId);
      this.gameState.animationFrameId = null;
    }
    
    this.gameState.score = 0;
    this.uiManager.updateScore(this.gameState.score);
    
    this.initializePockets();
    this.initializeBalls();
    
    // Сброс всех шаров
    this.gameState.balls.forEach(ball => {
      if (ball && ball.el) {
        ball.sunk = false;
        ball.vx = 0;
        ball.vy = 0;
        ball.el.style.display = 'block';
      }
    });
    
    // Позиционируем белый шар слева по центру
    const cueBall = this.gameState.balls.find(b => b && b.el && b.el.id === 'cue-ball');
    if (cueBall && this.uiManager.table) {
      cueBall.x = this.uiManager.table.offsetWidth * 0.25;
      cueBall.y = this.uiManager.table.offsetHeight * 0.5;
    }
    
    this.positionColoredBalls();
    catManager.resetAllCats();
    this.render();
    this.showCueAtDefaultPosition();
  }

  private positionColoredBalls(): void {
    if (!this.uiManager.table) return;

    const coloredBalls = this.gameState.balls.filter(b => b && b.el && b.el.id !== 'cue-ball');
    
    // Проверяем, что есть шары для позиционирования
    if (coloredBalls.length === 0) return;
    
    const ballRadius = coloredBalls[0]?.radius || 12;
    const tableWidth = this.uiManager.table.offsetWidth;
    const tableHeight = this.uiManager.table.offsetHeight;
    
    const triangleX = Math.min(tableWidth * 0.6, tableWidth - ballRadius * 8);
    const triangleY = tableHeight * 0.5;
    const ballSpacing = Math.min(ballRadius * 2.2, (tableWidth - triangleX) / 4);
    
    // let ballIndex = 0; // Не используется в текущей реализации
    
    const setBallPosition = (ball: BallObject, x: number, y: number) => {
      ball.x = clamp(x, ballRadius, tableWidth - ballRadius);
      ball.y = clamp(y, ballRadius, tableHeight - ballRadius);
    };
    
    // Треугольник из 10 шаров (4 ряда: 1, 2, 3, 4)
    const positions = [
      // Ряд 1 (1 шар)
      [triangleX, triangleY],
      // Ряд 2 (2 шара)
      [triangleX + ballSpacing, triangleY - ballSpacing * 0.5],
      [triangleX + ballSpacing, triangleY + ballSpacing * 0.5],
      // Ряд 3 (3 шара)
      [triangleX + ballSpacing * 2, triangleY - ballSpacing],
      [triangleX + ballSpacing * 2, triangleY],
      [triangleX + ballSpacing * 2, triangleY + ballSpacing],
      // Ряд 4 (4 шара)
      [triangleX + ballSpacing * 3, triangleY - ballSpacing * 1.5],
      [triangleX + ballSpacing * 3, triangleY - ballSpacing * 0.5],
      [triangleX + ballSpacing * 3, triangleY + ballSpacing * 0.5],
      [triangleX + ballSpacing * 3, triangleY + ballSpacing * 1.5],
    ];
    
    positions.forEach(([x, y], index) => {
      if (index < coloredBalls.length && coloredBalls[index]) {
        setBallPosition(coloredBalls[index], x, y);
      }
    });
  }

  private showCueAtDefaultPosition(): void {
    const cueBallObj = this.gameState.balls.find(b => b.el.id === 'cue-ball');
    if (cueBallObj && this.uiManager.cue) {
      this.uiManager.cue.style.visibility = 'visible';
      this.gameState.cueAngle = 0; // вправо по оси X
      this.updateCuePosition(cueBallObj);
    }
  }

  // Метод для обработки первого взаимодействия пользователя
  public handleFirstInteraction(): void {
    soundManager.initAudio();
    if (soundManager.isMusicEnabled) {
      soundManager.startBackgroundMusic();
    }
    this.maybeAttemptFullscreen();
  }
}

// Инициализация игры при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  
  // Запускаем фоновую музыку и полноэкранный режим после первого взаимодействия
  const startOnFirstInteraction = () => {
    game.handleFirstInteraction();
    document.removeEventListener('mousedown', startOnFirstInteraction);
    document.removeEventListener('touchstart', startOnFirstInteraction);
  };
  
  document.addEventListener('mousedown', startOnFirstInteraction);
  document.addEventListener('touchstart', startOnFirstInteraction, { passive: true });
});