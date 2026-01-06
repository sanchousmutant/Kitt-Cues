import { DeviceInfo, GameElements, ControlButtons, ScoreElements, VolumeControls } from '../types';
import { DOM_SELECTORS, UI_CONFIG, SCALING_CONFIG } from '../constants';
import { soundManager } from './sound';
import { vibrate, getDeviceInfo } from '../utils/device';
import { debounce } from '../utils/helpers';

export class UIManager {
  private elements: Partial<GameElements> = {};
  private buttons: Partial<ControlButtons> = {};
  private scoreElements: Partial<ScoreElements> = {};
  private volumeControls: Partial<VolumeControls> = {};
  private deviceInfo: DeviceInfo;
  private isMobile: boolean = false;
  private isPortrait: boolean = false;

  constructor() {
    this.deviceInfo = getDeviceInfo();
    this.initializeElements();
    this.setupEventListeners();
    this.checkOrientation();
    this.applyDeviceOptimizations();
  }

  private initializeElements(): void {
    // Основные элементы игры
    this.elements.gameArea = document.querySelector(DOM_SELECTORS.GAME_AREA) as HTMLElement;
    this.elements.table = document.querySelector(DOM_SELECTORS.TABLE) as HTMLElement;
    this.elements.tableContainer = document.querySelector(DOM_SELECTORS.TABLE_CONTAINER) as HTMLElement;
    this.elements.cue = document.querySelector(DOM_SELECTORS.CUE) as HTMLElement;
    this.elements.aimLine = document.querySelector(DOM_SELECTORS.AIM_LINE) as HTMLElement;
    this.elements.powerIndicator = document.querySelector(DOM_SELECTORS.POWER_INDICATOR) as HTMLElement;
    this.elements.powerFill = document.querySelector(DOM_SELECTORS.POWER_FILL) as HTMLElement;
    this.elements.pyramidContainer = document.querySelector(DOM_SELECTORS.PYRAMID_CONTAINER) as HTMLElement;
    this.elements.helpModal = document.querySelector(DOM_SELECTORS.HELP_MODAL) as HTMLElement;
    this.elements.rotationNotice = document.querySelector(DOM_SELECTORS.ROTATION_NOTICE) as HTMLElement;

    // Кнопки управления
    this.buttons.soundToggle = document.querySelector('#sound-toggle') as HTMLButtonElement;
    this.buttons.musicToggle = document.querySelector('#music-toggle') as HTMLButtonElement;
    this.buttons.helpButton = document.querySelector('#help-button') as HTMLButtonElement;
    this.buttons.resetButton = document.querySelector('#reset-button') as HTMLButtonElement;
    this.buttons.closeHelp = document.querySelector('#close-help') as HTMLButtonElement;
    this.buttons.soundToggleLandscape = document.querySelector('#sound-toggle-landscape') as HTMLButtonElement;
    this.buttons.musicToggleLandscape = document.querySelector('#music-toggle-landscape') as HTMLButtonElement;
    this.buttons.helpButtonLandscape = document.querySelector('#help-button-landscape') as HTMLButtonElement;
    this.buttons.resetButtonLandscape = document.querySelector('#reset-button-landscape') as HTMLButtonElement;

    // Элементы отображения счета
    this.scoreElements.scoreDisplay = document.querySelector(DOM_SELECTORS.SCORE_DISPLAY) as HTMLElement;
    this.scoreElements.scoreDisplayLandscape = document.querySelector(DOM_SELECTORS.SCORE_DISPLAY_LANDSCAPE) as HTMLElement;

    // Слайдеры громкости
    this.volumeControls.musicVolume = document.querySelector('#music-volume') as HTMLInputElement;
    this.volumeControls.musicVolumeLandscape = document.querySelector('#music-volume-landscape') as HTMLInputElement;
  }

  private setupEventListeners(): void {
    // Обработчики кнопок
    if (this.buttons.soundToggle) this.addButtonListener(this.buttons.soundToggle, () => this.toggleSound());
    if (this.buttons.musicToggle) this.addButtonListener(this.buttons.musicToggle, () => this.toggleMusic());
    if (this.buttons.helpButton) this.addButtonListener(this.buttons.helpButton, () => this.showHelp());
    if (this.buttons.closeHelp) this.addButtonListener(this.buttons.closeHelp, () => this.hideHelp());

    // Ландшафтные кнопки
    if (this.buttons.soundToggleLandscape) this.addButtonListener(this.buttons.soundToggleLandscape, () => this.toggleSound());
    if (this.buttons.musicToggleLandscape) this.addButtonListener(this.buttons.musicToggleLandscape, () => this.toggleMusic());
    if (this.buttons.helpButtonLandscape) this.addButtonListener(this.buttons.helpButtonLandscape, () => this.showHelp());

    // Слайдеры громкости
    if (this.volumeControls.musicVolume) {
      this.volumeControls.musicVolume.addEventListener('input', (e) =>
        this.setMusicVolumeFromPercent((e.target as HTMLInputElement).value)
      );
    }
    if (this.volumeControls.musicVolumeLandscape) {
      this.volumeControls.musicVolumeLandscape.addEventListener('input', (e) =>
        this.setMusicVolumeFromPercent((e.target as HTMLInputElement).value)
      );
    }

    // Модальное окно
    this.setupModalEventListeners();

    // Клавиатурные сокращения
    this.setupKeyboardListeners();

    // Изменение размера окна и ориентации
    this.setupResizeListeners();
  }

  private addButtonListener(element: HTMLElement | null, action: () => void): void {
    if (!element) return;

    if (this.deviceInfo.isTouch) {
      element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        vibrate(30);
        action();
      }, { passive: false });

      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    } else {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        action();
      });
    }

    // Визуальная обратная связь
    element.addEventListener('touchstart', () => {
      element.style.transform = 'scale(0.95)';
    }, { passive: true });

    element.addEventListener('touchend', () => {
      element.style.transform = 'scale(1)';
    }, { passive: true });

    element.addEventListener('mousedown', () => {
      element.style.transform = 'scale(0.95)';
    });

    element.addEventListener('mouseup', () => {
      element.style.transform = 'scale(1)';
    });
  }

  private setupModalEventListeners(): void {
    if (!this.elements.helpModal) return;

    this.elements.helpModal.addEventListener('click', (e) => {
      if (e.target === this.elements.helpModal) {
        this.hideHelp();
      }
    });

    const modalContent = this.elements.helpModal.querySelector('.bg-white');
    if (modalContent) {
      modalContent.addEventListener('click', (e) => e.stopPropagation());
      modalContent.addEventListener('touchstart', (e) => e.stopPropagation());
      modalContent.addEventListener('touchmove', (e) => {
        const scrollableElement = (e.target as Element).closest('.overflow-y-auto');
        if (!scrollableElement) {
          e.preventDefault();
        }
      }, { passive: false });
    }
  }

  private setupKeyboardListeners(): void {
    document.addEventListener('keydown', (e) => {
      switch (e.key.toLowerCase()) {
        case 'escape':
          this.hideHelp();
          break;
        case 'h':
          this.showHelp();
          break;
        case 's':
          this.toggleSound();
          break;
        case 'm':
          this.toggleMusic();
          break;
      }
    });
  }

  private setupResizeListeners(): void {
    const debouncedResize = debounce(() => this.handleResize(), UI_CONFIG.DEBOUNCE_DELAY);

    window.addEventListener('resize', debouncedResize);

    if (this.deviceInfo.supportsOrientation) {
      window.addEventListener('orientationchange', () => {
        setTimeout(debouncedResize, UI_CONFIG.ORIENTATION_CHANGE_DELAY);
      });
    }
  }

  private handleResize(): void {
    this.checkOrientation();
    this.updateLayout();
    this.positionUIElements();
  }

  checkOrientation(): void {
    this.isMobile = window.innerWidth <= UI_CONFIG.MOBILE_BREAKPOINT;
    this.isPortrait = window.innerHeight > window.innerWidth;

    if (this.elements.rotationNotice) {
      if (this.isMobile && this.isPortrait) {
        this.elements.rotationNotice.style.display = 'flex';
      } else {
        this.elements.rotationNotice.style.display = 'none';
      }
    }
  }

  updateLayout(): void {
    if (!this.elements.gameArea || !this.elements.table || !this.elements.tableContainer) return;

    const gameAreaRect = this.elements.gameArea.getBoundingClientRect();
    const gameAreaStyle = window.getComputedStyle(this.elements.gameArea);

    const paddingLeft = parseFloat(gameAreaStyle.paddingLeft);
    const paddingRight = parseFloat(gameAreaStyle.paddingRight);
    const paddingTop = parseFloat(gameAreaStyle.paddingTop);
    const paddingBottom = parseFloat(gameAreaStyle.paddingBottom);

    const availableWidth = gameAreaRect.width - paddingLeft - paddingRight;
    const availableHeight = gameAreaRect.height - paddingTop - paddingBottom;

    // Рассчитываем оптимальный размер стола
    const aspectRatio = 1.5;
    let tableWidth: number, tableHeight: number;

    if (availableWidth / availableHeight > aspectRatio) {
      tableHeight = availableHeight;
      tableWidth = tableHeight * aspectRatio;
    } else {
      tableWidth = availableWidth;
      tableHeight = tableWidth / aspectRatio;
    }

    const borderWidth = 20;
    const containerWidth = tableWidth + borderWidth * 2;
    const containerHeight = tableHeight + borderWidth * 2;

    // Устанавливаем размеры
    this.elements.tableContainer.style.width = `${containerWidth}px`;
    this.elements.tableContainer.style.height = `${containerHeight}px`;
    this.elements.tableContainer.style.left = `${paddingLeft + (availableWidth - containerWidth) / 2}px`;
    this.elements.tableContainer.style.top = `${paddingTop + (availableHeight - containerHeight) / 2}px`;

    this.elements.table.style.width = `${tableWidth}px`;
    this.elements.table.style.height = `${tableHeight}px`;
    this.elements.table.style.left = `${borderWidth}px`;
    this.elements.table.style.top = `${borderWidth}px`;

    // Применяем динамическое масштабирование
    this.applyDynamicScaling(tableWidth, tableHeight);
  }

  private applyDynamicScaling(tableWidth: number, tableHeight: number): void {
    const scaleFactorX = tableWidth / SCALING_CONFIG.BASE_TABLE_WIDTH;
    const scaleFactorY = tableHeight / SCALING_CONFIG.BASE_TABLE_HEIGHT;
    const scaleFactor = Math.min(scaleFactorX, scaleFactorY);

    this.scaleCats(scaleFactor);
    this.scaleBalls(scaleFactor);
    this.scalePockets(scaleFactor);
    this.scaleCue(scaleFactor);
    this.scaleButtons(scaleFactor);
    this.scaleScore(scaleFactor);
  }

  private scaleCats(scaleFactor: number): void {
    const cats = document.querySelectorAll('.cat-container');
    cats.forEach(cat => {
      let baseScale = 1.0;

      if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.XS) {
        baseScale = SCALING_CONFIG.CAT_SCALES.XS;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.SM) {
        baseScale = SCALING_CONFIG.CAT_SCALES.SM;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.MD) {
        baseScale = SCALING_CONFIG.CAT_SCALES.MD;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.LG) {
        baseScale = SCALING_CONFIG.CAT_SCALES.LG;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.XL) {
        baseScale = SCALING_CONFIG.CAT_SCALES.XL;
      }

      const finalScale = baseScale * scaleFactor;
      (cat as HTMLElement).style.transform = `scale(${Math.max(0.05, finalScale)})`;
    });
  }

  private scaleBalls(scaleFactor: number): void {
    const balls = document.querySelectorAll('.billiard-ball');
    balls.forEach(ball => {
      let baseSize = SCALING_CONFIG.BALL_SIZES.BASE;

      if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.XS) {
        baseSize = SCALING_CONFIG.BALL_SIZES.XS;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.SM) {
        baseSize = SCALING_CONFIG.BALL_SIZES.SM;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.MD) {
        baseSize = SCALING_CONFIG.BALL_SIZES.MD;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.LG) {
        baseSize = SCALING_CONFIG.BALL_SIZES.LG;
      }

      const finalSize = Math.max(3, baseSize * scaleFactor);
      (ball as HTMLElement).style.width = `${finalSize}px`;
      (ball as HTMLElement).style.height = `${finalSize}px`;
    });
  }

  private scalePockets(scaleFactor: number): void {
    const pockets = document.querySelectorAll('[data-pocket]');
    pockets.forEach(pocket => {
      let baseSize = 32;

      if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.XS) {
        baseSize = 12;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.SM) {
        baseSize = 14;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.MD) {
        baseSize = 16;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.LG) {
        baseSize = 20;
      }

      const pocketScaleFactor = Math.max(0.8, scaleFactor);
      const finalSize = Math.max(8, baseSize * pocketScaleFactor);
      (pocket as HTMLElement).style.width = `${finalSize}px`;
      (pocket as HTMLElement).style.height = `${finalSize}px`;
    });
  }

  private scaleCue(scaleFactor: number): void {
    if (!this.elements.cue) return;

    let baseHeight = 8;
    let baseWidth = 40;

    if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.XS) {
      baseHeight = 1;
      baseWidth = 10;
    } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.SM) {
      baseHeight = 1;
      baseWidth = 15;
    } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.MD) {
      baseHeight = 1;
      baseWidth = 20;
    } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.LG) {
      baseHeight = 1;
      baseWidth = 25;
    }

    const finalHeight = Math.max(1, baseHeight * scaleFactor);
    const finalWidth = Math.max(5, baseWidth);

    this.elements.cue.style.height = `${finalHeight}px`;
    this.elements.cue.style.width = `${finalWidth}%`;
  }

  private scaleButtons(scaleFactor: number): void {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
      if (button.closest('.landscape-mobile-controls')) return;

      let baseFontSize = 16;
      let basePaddingX = 16;
      let basePaddingY = 8;
      let baseMinWidth = 40;
      let baseMinHeight = 40;

      if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.SM) {
        baseFontSize = 8;
        basePaddingX = 4;
        basePaddingY = 2;
        baseMinWidth = 12;
        baseMinHeight = 12;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.MD) {
        baseFontSize = 10;
        basePaddingX = 6;
        basePaddingY = 3;
        baseMinWidth = 16;
        baseMinHeight = 16;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.LG) {
        baseFontSize = 12;
        basePaddingX = 8;
        basePaddingY = 4;
        baseMinWidth = 20;
        baseMinHeight = 20;
      }

      const finalFontSize = Math.max(6, baseFontSize * scaleFactor);
      const finalPaddingX = Math.max(2, basePaddingX * scaleFactor);
      const finalPaddingY = Math.max(1, basePaddingY * scaleFactor);
      const finalMinWidth = Math.max(10, baseMinWidth * scaleFactor);
      const finalMinHeight = Math.max(10, baseMinHeight * scaleFactor);

      button.style.fontSize = `${finalFontSize}px`;
      button.style.padding = `${finalPaddingY}px ${finalPaddingX}px`;
      button.style.minWidth = `${finalMinWidth}px`;
      button.style.minHeight = `${finalMinHeight}px`;
    });
  }

  private scaleScore(scaleFactor: number): void {
    const scoreElements = [
      { element: this.scoreElements.scoreDisplay, isLandscape: false },
      { element: this.scoreElements.scoreDisplayLandscape, isLandscape: true }
    ];

    scoreElements.forEach(({ element, isLandscape }) => {
      if (!element) return;

      let baseFontSize = 18;
      let basePaddingX = 32;
      let basePaddingY = 16;

      if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.SM) {
        baseFontSize = 8;
        basePaddingX = 8;
        basePaddingY = 4;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.MD) {
        baseFontSize = 10;
        basePaddingX = 12;
        basePaddingY = 6;
      } else if (window.innerWidth <= SCALING_CONFIG.BREAKPOINTS.LG) {
        baseFontSize = 14;
        basePaddingX = 16;
        basePaddingY = 8;
      } else if (isLandscape) {
        baseFontSize = 12;
        basePaddingX = 12;
        basePaddingY = 4;
      }

      const finalFontSize = Math.max(8, baseFontSize * scaleFactor);
      const finalPaddingX = Math.max(4, basePaddingX * scaleFactor);
      const finalPaddingY = Math.max(2, basePaddingY * scaleFactor);

      element.style.fontSize = `${finalFontSize}px`;
      element.style.padding = `${finalPaddingY}px ${finalPaddingX}px`;

      if (!isLandscape) {
        const baseMinWidth = 80;
        const finalMinWidth = Math.max(40, baseMinWidth * scaleFactor);
        element.style.minWidth = `${finalMinWidth}px`;
      }
    });
  }

  positionUIElements(): void {
    if (!this.elements.gameArea || !this.elements.tableContainer) return;

    const gameAreaRect = this.elements.gameArea.getBoundingClientRect();
    const tableRect = this.elements.tableContainer.getBoundingClientRect();
    const scaleFactor = Math.min(tableRect.width / SCALING_CONFIG.BASE_TABLE_WIDTH, 1.5);
    const margin = Math.max(10, 20 * scaleFactor);

    // Позиционируем элементы относительно стола
    this.positionLeftButtons(gameAreaRect, tableRect, margin);
    this.positionRightElements(gameAreaRect, tableRect, margin);
    this.positionMobileElements(gameAreaRect, tableRect, margin);
  }

  private positionLeftButtons(gameAreaRect: DOMRect, tableRect: DOMRect, margin: number): void {
    const soundToggle = this.buttons.soundToggle;
    if (soundToggle?.parentElement) {
      const leftButtons = soundToggle.parentElement;
      const leftX = tableRect.left - gameAreaRect.left - leftButtons.offsetWidth - margin;

      // Если недостаточно места слева, скрываем или переносим
      if (leftX < 10) {
        leftButtons.style.display = 'none'; // Скрываем на очень узких экранах
      } else {
        leftButtons.style.display = 'flex';
        leftButtons.style.left = `${leftX}px`;
      }
      leftButtons.style.right = 'auto';
    }
  }

  private positionRightElements(gameAreaRect: DOMRect, tableRect: DOMRect, margin: number): void {
    const tableRightEdge = (gameAreaRect.width - this.elements.tableContainer!.offsetWidth) / 2 +
      this.elements.tableContainer!.offsetWidth;
    const commonLeftOffset = tableRightEdge + margin;
    const availableWidth = gameAreaRect.width - commonLeftOffset;

    // Правые кнопки
    const resetButton = this.buttons.resetButton;
    if (resetButton?.parentElement) {
      if (availableWidth < 40) {
        resetButton.parentElement.style.display = 'none';
      } else {
        resetButton.parentElement.style.display = 'block';
        resetButton.parentElement.style.left = `${commonLeftOffset}px`;
        resetButton.parentElement.style.right = 'auto';
      }
    }

    // Счет в правом верхнем углу
    const scoreDisplay = this.scoreElements.scoreDisplay;
    if (scoreDisplay?.parentElement) {
      const topRightScore = scoreDisplay.parentElement;
      const topY = tableRect.top - gameAreaRect.top - topRightScore.offsetHeight - margin;

      if (availableWidth < 80) {
        topRightScore.style.display = 'none';
      } else {
        topRightScore.style.display = 'block';
        topRightScore.style.top = `${Math.max(10, topY)}px`;
        topRightScore.style.left = `${commonLeftOffset}px`;
        topRightScore.style.right = 'auto';
        topRightScore.style.bottom = 'auto';
      }
    }
  }

  private positionMobileElements(gameAreaRect: DOMRect, tableRect: DOMRect, margin: number): void {
    // Мобильные кнопки в ландшафтной ориентации
    const soundToggleLandscape = this.buttons.soundToggleLandscape;
    if (soundToggleLandscape?.parentElement) {
      const mobileButtons = soundToggleLandscape.parentElement;
      const topY = tableRect.top - gameAreaRect.top - mobileButtons.offsetHeight - margin;
      // Гарантируем, что кнопки не улетают вверх за экран
      mobileButtons.style.top = `${Math.max(5, topY)}px`;
      mobileButtons.style.bottom = 'auto';
    }

    const scoreDisplayLandscape = this.scoreElements.scoreDisplayLandscape;
    if (scoreDisplayLandscape?.parentElement) {
      const mobileScore = scoreDisplayLandscape.parentElement;
      const topY = tableRect.top - gameAreaRect.top - mobileScore.offsetHeight - margin;
      // Гарантируем, что счет не улетает вверх за экран
      mobileScore.style.top = `${Math.max(5, topY)}px`;
      mobileScore.style.bottom = 'auto';
    }
  }

  private applyDeviceOptimizations(): void {
    const body = document.body;

    if (this.deviceInfo.isIOS) {
      body.classList.add('ios-device');
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.width = '100%';
      body.style.height = '100%';

      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
      }
    }

    if (this.deviceInfo.isAndroid) {
      body.classList.add('android-device');
      body.style.transform = 'translateZ(0)';
    }

    if (this.deviceInfo.isSamsung) {
      body.classList.add('samsung-browser');
    }
  }

  // Методы для управления звуком и музыкой
  toggleSound(): void {
    soundManager.toggleSound();
    this.updateSoundButtons();
  }

  toggleMusic(): void {
    soundManager.toggleMusic();
    this.updateMusicButtons();
  }

  private updateSoundButtons(): void {
    const enabled = soundManager.isSoundEnabled;
    const icon = enabled ? '🔊' : '🔇';
    const title = enabled ? 'Отключить звуковые эффекты' : 'Включить звуковые эффекты';

    if (this.buttons.soundToggle) {
      this.buttons.soundToggle.textContent = icon;
      this.buttons.soundToggle.title = title;
    }

    if (this.buttons.soundToggleLandscape) {
      this.buttons.soundToggleLandscape.textContent = icon;
      this.buttons.soundToggleLandscape.title = title;
    }
  }

  private updateMusicButtons(): void {
    const enabled = soundManager.isMusicEnabled;
    const icon = enabled ? '🎵' : '🔇';
    const title = enabled ? 'Отключить фоновую музыку' : 'Включить фоновую музыку';

    if (this.buttons.musicToggle) {
      this.buttons.musicToggle.textContent = icon;
      this.buttons.musicToggle.title = title;
    }

    if (this.buttons.musicToggleLandscape) {
      this.buttons.musicToggleLandscape.textContent = icon;
      this.buttons.musicToggleLandscape.title = title;
    }
  }

  setMusicVolumeFromPercent(percent: string): void {
    const clamped = Math.max(0, Math.min(100, Number(percent)));
    const volume = clamped / 100;

    soundManager.setMusicVolume(volume);

    // Синхронизируем оба слайдера
    if (this.volumeControls.musicVolume && this.volumeControls.musicVolume.value !== percent) {
      this.volumeControls.musicVolume.value = String(clamped);
    }
    if (this.volumeControls.musicVolumeLandscape && this.volumeControls.musicVolumeLandscape.value !== percent) {
      this.volumeControls.musicVolumeLandscape.value = String(clamped);
    }
  }

  updateScore(score: number): void {
    const scoreText = `Счет: ${score}`;

    if (this.scoreElements.scoreDisplay) {
      this.scoreElements.scoreDisplay.textContent = scoreText;
    }

    if (this.scoreElements.scoreDisplayLandscape) {
      this.scoreElements.scoreDisplayLandscape.textContent = scoreText;
    }
  }

  showHelp(): void {
    if (this.elements.helpModal) {
      this.elements.helpModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'auto';

      const scrollableContent = this.elements.helpModal.querySelector('.overflow-y-auto');
      if (scrollableContent) {
        (scrollableContent as HTMLElement).scrollTop = 0;
      }
    }
  }

  hideHelp(): void {
    if (this.elements.helpModal) {
      this.elements.helpModal.classList.add('hidden');
      document.body.style.overflow = '';
      document.body.style.touchAction = 'none';
    }
  }

  // Геттеры для элементов
  get gameArea(): HTMLElement | undefined { return this.elements.gameArea; }
  get table(): HTMLElement | undefined { return this.elements.table; }
  get tableContainer(): HTMLElement | undefined { return this.elements.tableContainer; }
  get cue(): HTMLElement | undefined { return this.elements.cue; }
  get aimLine(): HTMLElement | undefined { return this.elements.aimLine; }
  get powerIndicator(): HTMLElement | undefined { return this.elements.powerIndicator; }
  get powerFill(): HTMLElement | undefined { return this.elements.powerFill; }
  get pyramidContainer(): HTMLElement | undefined { return this.elements.pyramidContainer; }
  get resetButton(): HTMLButtonElement | null { return this.buttons.resetButton || null; }
  get resetButtonLandscape(): HTMLButtonElement | null { return this.buttons.resetButtonLandscape || null; }
  get helpModal(): HTMLElement | undefined { return this.elements.helpModal; }

  get isMobileDevice(): boolean { return this.isMobile; }
  get isPortraitMode(): boolean { return this.isPortrait; }

  // Инициализация настроек UI
  loadUISettings(): void {
    this.updateSoundButtons();
    this.updateMusicButtons();

    const volume = Math.round(soundManager.getMusicVolume * 100);
    if (this.volumeControls.musicVolume) {
      this.volumeControls.musicVolume.value = String(volume);
    }
    if (this.volumeControls.musicVolumeLandscape) {
      this.volumeControls.musicVolumeLandscape.value = String(volume);
    }
  }
}