import { BallObject, GameState } from './types';
import { DOM_SELECTORS, GAME_CONFIG, POCKET_CONFIG, JOYSTICK_CONFIG } from './constants';
import { PhysicsEngine } from './modules/physics';
import { soundManager } from './modules/sound';
import { UIManager } from './modules/ui';
import { catManager } from './modules/cats';
import { JoystickManager } from './modules/joystick';
import { debounce, smoothAngle, clamp, distance, angle } from './utils/helpers';
import { isMobileDevice, isPortraitOrientation, vibrate, enterFullscreen, exitFullscreen, isFullscreenActive } from './utils/device';

class Game {
  private physicsEngine: PhysicsEngine;
  private uiManager: UIManager;
  private joystickManager: JoystickManager | null = null;
  private lastJoystickPower: number = 0;
  private gameState: GameState;
  private isMobile: boolean = false;
  private isPortrait: boolean = false;
  private didInitialReset: boolean = false;
  private trajectoryCtx: CanvasRenderingContext2D | null = null;

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
      musicVolume: soundManager.getMusicVolume,
      stats: {
        playerShots: 0,
        catHits: 0,
        foulCount: 0
      }
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

    // Инициализация джойстика для всех устройств
    this.joystickManager = new JoystickManager();
    this.setupJoystickCallbacks();

    // Инициализация игровых объектов
    this.initializeCats();
    this.initializePockets();

    // Настройка layout
    this.setupLayout();

    // Настройка layout
    this.setupLayout();

    if (this.uiManager.trajectoryCanvas) {
      if (this.uiManager.table) {
        // Force layout update to get correct dimensions
        this.uiManager.table.style.display = 'block'; // Ensure it's rendered
        this.uiManager.trajectoryCanvas.width = this.uiManager.table.clientWidth;
        this.uiManager.trajectoryCanvas.height = this.uiManager.table.clientHeight;
      }
      this.trajectoryCtx = this.uiManager.trajectoryCanvas.getContext('2d');
    }

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
    // Мышь - глобальный слушатель для поддержки перетаскивания за пределы поля
    window.addEventListener('mousemove', (e) => {
      // Обрабатываем событие, если мы тащим шар ИЛИ если курсор над игровым полем
      const isOverGame = e.target instanceof Node && gameArea.contains(e.target);
      if (this.gameState.isDragging || isOverGame) {
        this.aimCue(e);
        this.updatePowerIndicatorFromEvent(e);
      }
    });
    gameArea.addEventListener('mousedown', (e) => this.startDrag(e));
    window.addEventListener('mouseup', (e) => this.endDrag(e));

    // Сенсорное управление
    // Сенсорное управление - глобальное для удобства у краев
    window.addEventListener('touchmove', (e) => {
      if (this.uiManager.helpModal && !this.uiManager.helpModal.classList.contains('hidden')) return;

      const target = e.target as HTMLElement;
      // Разрешаем скролл внутри модалок и списков
      if (target.closest('.overflow-y-auto')) return;

      e.preventDefault();

      if (e.touches?.length > 0) {
        this.aimCue(e);
        this.updatePowerIndicatorFromEvent(e);
      }
    }, { passive: false });

    window.addEventListener('touchstart', (e) => {
      if (this.uiManager.helpModal && !this.uiManager.helpModal.classList.contains('hidden')) return;

      const target = e.target as HTMLElement;

      // Игнорируем касания по кнопкам, интерактивным элементам UI и джойстику
      if (target.closest('button') ||
        target.closest('.overflow-y-auto') ||
        target.closest('.joystick-container')) {
        return;
      }

      e.preventDefault();

      if (e.touches?.[0]) {
        this.startDrag(e);
        this.aimCue(e); // Сразу обновляем направление
        vibrate(20);
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      if (this.uiManager.helpModal && !this.uiManager.helpModal.classList.contains('hidden')) return;

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

  private setupJoystickCallbacks(): void {
    if (!this.joystickManager) return;

    // Callback при движении джойстика
    this.joystickManager.onMove((state) => {
      if (this.gameState.animationFrameId) return; // Не управляем во время анимации

      const cueBallObj = this.gameState.balls.find(b => b.el.id === 'cue-ball');
      if (!cueBallObj || !this.uiManager.table) return;

      // Преобразуем угол джойстика в угол прицеливания
      // Джойстик: угол от центра (0 = вправо, PI/2 = вниз)
      // Механика рогатки: тянем назад - бьем вперед (направление уже инвертировано)
      const aimAngle = state.angle;

      // Обновляем угол кия
      this.gameState.cueAngle = aimAngle;

      // Обновляем позицию кия
      this.updateCuePosition(cueBallObj);

      // Обновляем линию прицеливания (симметрично кию, с противоположной стороны битка)
      this.updateAimLine(cueBallObj.x, cueBallObj.y, aimAngle + Math.PI);

      // Сохраняем силу и обновляем индикатор
      const power = state.power * JOYSTICK_CONFIG.POWER_MULTIPLIER;
      this.lastJoystickPower = power;
      this.updatePowerIndicator(power);

      // Рисуем траекторию
      if (state.power > JOYSTICK_CONFIG.MIN_POWER_THRESHOLD) {
        this.drawTrajectory(cueBallObj);
      }

      // Показываем визуальные помощники
      if (this.uiManager.aimLine) this.uiManager.aimLine.classList.add('visible');
      if (this.uiManager.powerIndicator) this.uiManager.powerIndicator.classList.add('visible');
    });

    // Callback при отпускании джойстика
    this.joystickManager.onRelease(() => {
      if (this.gameState.animationFrameId) return;

      // Скрываем визуальные помощники
      this.hideVisualHelpers();

      // Выполняем удар используя сохраненную силу
      if (this.lastJoystickPower > JOYSTICK_CONFIG.MIN_POWER_THRESHOLD * JOYSTICK_CONFIG.POWER_MULTIPLIER) {
        this.hitBall(this.lastJoystickPower);
        this.lastJoystickPower = 0; // Сбрасываем после удара
      }
    });
  }

  private setupUIControls(): void {
    // Кнопка сброса игры
    if (this.uiManager.resetButton) {
      this.addButtonHandler(this.uiManager.resetButton, () => this.resetGame());
    }
    if (this.uiManager.resetButtonLandscape) {
      this.addButtonHandler(this.uiManager.resetButtonLandscape, () => this.resetGame());
    }

    // Обработчик события завершения Catnado
    document.addEventListener('catnado-finished', () => {
      this.uiManager.showGameOver(this.gameState.score, this.gameState.stats);
    });

    // Обработчик удара кота
    document.addEventListener('cat-hit', () => {
      this.gameState.stats.catHits++;
    });

    // Обработчик запроса на сброс игры из модального окна
    document.addEventListener('game-reset-requested', () => {
      this.resetGame();
    });

    // Экспортируем функцию сброса для HTML onclick
    (window as any).resetGame = () => this.resetGame();
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
    const oldTableWidth = this.uiManager.table?.offsetWidth || 0;
    const oldTableHeight = this.uiManager.table?.offsetHeight || 0;

    this.isMobile = isMobileDevice();
    this.isPortrait = isPortraitOrientation();

    this.physicsEngine.updateSettings(this.isMobile);
    catManager.updateMobileSettings(this.isMobile);
    this.uiManager.checkOrientation();
    this.uiManager.updateLayout();

    if (this.uiManager.trajectoryCanvas && this.uiManager.table) {
      this.uiManager.trajectoryCanvas.width = this.uiManager.table.offsetWidth;
      this.uiManager.trajectoryCanvas.height = this.uiManager.table.offsetHeight;
    }

    // Переинициализируем статические объекты
    this.initializeCats();
    this.initializePockets();

    // Обновляем позиции шаров вместо сброса
    if (oldTableWidth > 0 && oldTableHeight > 0) {
      this.updateBallsOnResize(oldTableWidth, oldTableHeight);
    } else {
      this.initializeBalls();
    }
  }

  private updateBallsOnResize(oldWidth: number, oldHeight: number): void {
    if (!this.uiManager.table) return;

    const newWidth = this.uiManager.table.offsetWidth;
    const newHeight = this.uiManager.table.offsetHeight;

    if (newWidth === 0 || newHeight === 0) return;

    const scaleX = newWidth / oldWidth;
    const scaleY = newHeight / oldHeight;

    this.gameState.balls.forEach(ball => {
      // Масштабируем координаты
      ball.x *= scaleX;
      ball.y *= scaleY;

      // Обновляем радиус (он меняется через CSS в uiManager.updateLayout -> applyDynamicScaling)
      ball.radius = ball.el.offsetWidth / 2;

      // Ограничиваем координаты границами (clamping)
      // Используем простой Math.max / Math.min, так как функция clamp может быть не импортирована
      ball.x = Math.max(ball.radius, Math.min(ball.x, newWidth - ball.radius));
      ball.y = Math.max(ball.radius, Math.min(ball.y, newHeight - ball.radius));

      // Обновляем визуальное положение
      if (!ball.sunk) {
        ball.el.style.transform = `translate(${ball.x - ball.radius}px, ${ball.y - ball.radius}px)`;
      }
    });

    // Обновляем позицию кия если он активен
    if (this.uiManager.cue && this.uiManager.cue.style.visibility === 'visible') {
      const cueBall = this.gameState.balls.find(b => b.el.id === 'cue-ball');
      if (cueBall) {
        this.updateCuePosition(cueBall);
      }
    }
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
      (el as HTMLElement).style.zIndex = '10'; // Ensure balls are above trajectory
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

    // Рисование траектории
    if (this.gameState.isDragging) {
      this.drawTrajectory(cueBallObj);
    }

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
    // Use style height for precise un-rotated height, fallback to offsetHeight
    const styleHeight = parseFloat(this.uiManager.cue.style.height);
    const cueHeight = !isNaN(styleHeight) ? styleHeight : this.uiManager.cue.offsetHeight;

    this.uiManager.cue.style.transform =
      `translate(${tipX}px, ${tipY - cueHeight / 2}px) rotate(${degrees}deg)`;
  }

  private updateAimLine(startX: number, startY: number, angle: number): void {
    if (!this.uiManager.aimLine) return;

    const lineLength = GAME_CONFIG.AIM_LINE_LENGTH;

    // Use style height for precise un-rotated height, fallback to default
    const styleHeight = parseFloat(this.uiManager.aimLine.style.height);
    const computedHeight = parseFloat(window.getComputedStyle(this.uiManager.aimLine).height);
    const lineHeight = !isNaN(styleHeight) ? styleHeight : (!isNaN(computedHeight) ? computedHeight : 2);

    this.uiManager.aimLine.style.left = '0px';
    this.uiManager.aimLine.style.top = '0px';
    this.uiManager.aimLine.style.width = `${lineLength}px`;
    this.uiManager.aimLine.style.transform =
      `translate(${startX}px, ${startY - lineHeight / 2}px) rotate(${angle * (180 / Math.PI)}deg)`;
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
        // Use transform for reliable positioning extended from ball center
        this.uiManager.powerIndicator.style.left = `${cueBallObj.x}px`;
        this.uiManager.powerIndicator.style.top = `${cueBallObj.y}px`;
        this.uiManager.powerIndicator.style.transform = `translate(-50%, -100%) translateY(-${cueBallObj.radius + 20}px)`;
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

    // For visual indicator, we want smooth growth from 0. 
    // The physics hitPower enforcement happens strictly at hit time.
    this.updatePowerIndicator(power);

    if (dragDistance < 10) {
      power = this.physicsEngine.getSettings().hitPower; // Min power for physics
    }

    this.hideVisualHelpers();
    this.hitBall(power);
  }

  private drawTrajectory(cueBall: BallObject): void {
    if (!this.trajectoryCtx || !this.uiManager.trajectoryCanvas) return;

    const ctx = this.trajectoryCtx;
    const canvas = this.uiManager.trajectoryCanvas;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Направление удара противоположно углу кия
    const angle = this.gameState.cueAngle + Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    let collisionPoint = null;
    let hitTarget = null;

    // Raycasting parameters
    const rayLength = 1000;
    const stepSize = 5;

    for (let d = 0; d < rayLength; d += stepSize) {
      const nextX = cueBall.x + cos * d;
      const nextY = cueBall.y + sin * d;

      // Check ball collisions
      for (const b of this.gameState.balls) {
        if (b === cueBall || b.sunk) continue;

        const dist = Math.sqrt((nextX - b.x) ** 2 + (nextY - b.y) ** 2);
        // Используем 1.9 радиуса, чтобы учесть радиус самого битка и целевого шара (с небольшим запасом)
        if (dist < cueBall.radius + b.radius) {
          collisionPoint = { x: nextX, y: nextY };
          hitTarget = b;
          break;
        }
      }
      if (collisionPoint) break;

      // Check wall collisions (с учетом радиуса битка)
      if (nextX < cueBall.radius || nextX > canvas.width - cueBall.radius ||
        nextY < cueBall.radius || nextY > canvas.height - cueBall.radius) {
        collisionPoint = { x: nextX, y: nextY };
        break;
      }
    }

    if (collisionPoint) {
      ctx.save();

      // 1. Пунктирная линия пути
      ctx.beginPath();
      ctx.setLineDash([5, 8]);
      ctx.moveTo(cueBall.x, cueBall.y);
      ctx.lineTo(collisionPoint.x, collisionPoint.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 2. Призрачный шар ("Ghost Ball")
      ctx.beginPath();
      ctx.arc(collisionPoint.x, collisionPoint.y, cueBall.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();

      // 3. Направление отскока прицельного шара (если есть)
      if (hitTarget) {
        const hitAngle = Math.atan2(hitTarget.y - collisionPoint.y, hitTarget.x - collisionPoint.x);

        ctx.beginPath();
        ctx.setLineDash([]); // Сплошная линия
        ctx.moveTo(hitTarget.x, hitTarget.y);
        ctx.lineTo(hitTarget.x + Math.cos(hitAngle) * 60, hitTarget.y + Math.sin(hitAngle) * 60);
        ctx.strokeStyle = 'rgba(243, 229, 171, 0.4)'; // Желтоватый
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private hideVisualHelpers(): void {
    if (this.uiManager.aimLine) this.uiManager.aimLine.classList.remove('visible');
    if (this.uiManager.powerIndicator) this.uiManager.powerIndicator.classList.remove('visible');

    // Очищаем траекторию при отпускании
    if (this.trajectoryCtx && this.uiManager.trajectoryCanvas) {
      this.trajectoryCtx.clearRect(0, 0, this.uiManager.trajectoryCanvas.width, this.uiManager.trajectoryCanvas.height);
    }
  }

  private hitBall(power: number = this.physicsEngine.getSettings().hitPower): void {
    soundManager.initAudio();

    if (this.gameState.animationFrameId) return;

    const cueBallObj = this.gameState.balls.find(b => b.el.id === 'cue-ball');
    if (!cueBallObj) return;

    soundManager.playHitSound(power);
    this.gameState.stats.playerShots++;
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

    // Проверка на падение белого шара (штраф)
    const cueBall = this.gameState.balls.find(b => b.el.id === 'cue-ball');
    if (cueBall && cueBall.sunk && !this.gameState.isFoulPending) {
      // Штраф! Помечаем, что был фол
      soundManager.playCueFall();
      this.gameState.isFoulPending = true;
      // Не прерываем игру, ждем остановки всех шаров
    }

    this.physicsEngine.checkBallCollisions(this.gameState.balls);
  }

  // Удаляем методы saveState и restoreState, так как логика изменилась
  // private saveState(): void {
  //   this.gameState.previousState = {
  //     score: this.gameState.score,
  //     balls: this.gameState.balls.map(b => ({
  //       x: b.x,
  //       y: b.y,
  //       sunk: b.sunk,
  //       vx: b.vx,
  //       vy: b.vy
  //     }))
  //   };
  // }

  // public restoreState(): void {
  //   if (!this.gameState.previousState) return;

  //   console.log('Foul! Restoring state...');

  //   // Восстанавливаем счет (минус 1 за штраф)
  //   this.gameState.score = Math.max(0, this.gameState.previousState.score - 1);
  //   this.uiManager.updateScore(this.gameState.score);

  //   // Восстанавливаем шары
  //   this.gameState.balls.forEach((ball, index) => {
  //     const savedBall = this.gameState.previousState!.balls[index];
  //     if (savedBall) {
  //       ball.x = savedBall.x;
  //       ball.y = savedBall.y;
  //       ball.sunk = savedBall.sunk;
  //       ball.vx = 0;
  //       ball.vy = 0;

  //       // Обновляем визуальное состояние
  //       if (ball.el) {
  //         ball.el.style.display = ball.sunk ? 'none' : 'block';
  //       }
  //     }
  //   });

  //   // Сбрасываем анимацию и состояние
  //   if (this.gameState.animationFrameId) {
  //     cancelAnimationFrame(this.gameState.animationFrameId);
  //     this.gameState.animationFrameId = null;
  //   }

  //   // Показываем кий и обновляем рендер
  //   this.onGameStopped();
  //   this.render();
  // }

  private onBallSunk(ball: BallObject): void {
    if (ball.el.id !== 'cue-ball') {
      this.gameState.score++;
      this.uiManager.updateScore(this.gameState.score);

      // Показываем грустные эмодзи над котами (или ничего если победа)
      if (this.uiManager.table) {
        const allTargetsSunk = this.gameState.balls.every(b => b.el.id === 'cue-ball' || b.sunk);

        if (allTargetsSunk) {
          // Победа! Запускаем Котонадо
          catManager.startCatnado(this.uiManager.table);
        } else {
          catManager.showAllCatsEmoji('😿', this.uiManager.table);
        }
      }
    } else {
      // Для белого шара логика теперь обрабатывается через isFoulPending и onGameStopped
      if (this.uiManager.table) {
        catManager.showAllCatsEmoji('😺', this.uiManager.table);
      }
    }
  }

  private onGameStopped(): void {
    // Проверяем, был ли фол (утоплен белый шар)
    if (this.gameState.isFoulPending) {
      console.log('Foul pending resolved.');
      this.gameState.isFoulPending = false;
      this.gameState.stats.foulCount++;
      this.gameState.score = Math.max(0, this.gameState.score - 1);
      this.uiManager.updateScore(this.gameState.score);

      const cueBall = this.gameState.balls.find(b => b.el.id === 'cue-ball');
      if (cueBall && this.uiManager.table) {
        // Возвращаем биток на исходную позицию
        cueBall.sunk = false;
        cueBall.x = this.uiManager.table.offsetWidth * 0.25;
        cueBall.y = this.uiManager.table.offsetHeight * 0.5;
        cueBall.vx = 0;
        cueBall.vy = 0;
        cueBall.el.style.display = 'block';
      }
    }

    // Показываем кий после полной остановки шаров
    const cueBallObj = this.gameState.balls.find(b => b.el.id === 'cue-ball');
    if (cueBallObj && !cueBallObj.sunk && this.uiManager.cue) {
      // Используем переменные для позиционирования кия
      this.uiManager.cue.style.visibility = 'visible';
      this.updateCuePosition(cueBallObj);
    }

    this.render();
  }

  private render(): void {
    this.gameState.balls.forEach(ball => {
      if (!ball.sunk) {
        ball.el.style.left = '0px';
        ball.el.style.top = '0px';
        // Use visual radius for centering
        // Fallback to physics radius if visual size is not yet set
        const visualWidth = parseFloat(ball.el.style.width);
        const visualRadius = !isNaN(visualWidth) ? visualWidth / 2 : ball.radius;

        ball.el.style.transform = `translate(${ball.x - visualRadius}px, ${ball.y - visualRadius}px)`;
      }
    });
  }

  public resetGame(): void {
    this.uiManager.hideGameOver(); // Скрываем модальное окно проигрыша
    if (this.gameState.animationFrameId) {
      cancelAnimationFrame(this.gameState.animationFrameId);
      this.gameState.animationFrameId = null;
    }

    this.gameState.score = 0;
    this.gameState.stats = {
      playerShots: 0,
      catHits: 0,
      foulCount: 0
    };
    this.uiManager.updateScore(this.gameState.score);

    this.initializePockets();
    this.initializeBalls();

    // Сброс котов
    catManager.resetCats();

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