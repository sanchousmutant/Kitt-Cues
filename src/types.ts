// Базовые игровые типы
export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export interface BallObject extends Position, Velocity {
  el: HTMLElement;
  radius: number;
  sunk: boolean;
}

export interface CatObject extends Position {
  el: HTMLElement;
  pawEl: HTMLElement | null;
  radius: number;
  cooldown: number;
  initialPosition: {
    left: string;
    top: string;
    transform: string;
  };
}

export interface PocketObject extends Position {
  radius: number;
}

// Конфигурация устройства
export interface DeviceInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isSamsung: boolean;
  isTouch: boolean;
  supportsVibration: boolean;
  supportsOrientation: boolean;
}

// Состояние игры
export interface GameState {
  balls: BallObject[];
  cats: CatObject[];
  pockets: PocketObject[];
  score: number;
  animationFrameId: number | null;
  cueAngle: number;
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  didInitialReset: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  isMusicPlaying: boolean;
  musicVolume: number;
  isFoulPending?: boolean;
  stats: {
    playerShots: number;
    catHits: number;
    foulCount: number;
  };
  previousState?: {
    balls: { x: number; y: number; sunk: boolean; vx: number; vy: number }[];
    score: number;
  };
}

// Аудио контекст и узлы
export interface BackgroundMusic {
  oscillator1: OscillatorNode;
  oscillator2: OscillatorNode;
  gainNode: GainNode;
  interval: number;
}

// Настройки физики
export interface PhysicsSettings {
  friction: number;
  minVelocity: number;
  hitPower: number;
}

// Размеры и позиционирование
export interface Dimensions {
  width: number;
  height: number;
}

export interface Rect extends Dimensions, Position { }

// Конфигурация масштабирования
export interface ScalingConfig {
  scaleFactor: number;
  tableWidth: number;
  tableHeight: number;
}

// События вибрации
export type VibrationPattern = number | number[];

// Типы элементов DOM
export interface GameElements {
  gameArea: HTMLElement;
  table: HTMLElement;
  tableContainer: HTMLElement;
  cue: HTMLElement;
  aimLine: HTMLElement;
  powerIndicator: HTMLElement;
  powerFill: HTMLElement;
  pyramidContainer: HTMLElement;
  helpModal: HTMLElement;
  rotationNotice: HTMLElement;
  trajectoryCanvas: HTMLCanvasElement;
  gameOverModal: HTMLElement | null;
  finalScore: HTMLElement | null;
}

// Кнопки управления
export interface ControlButtons {
  soundToggle: HTMLButtonElement | null;
  musicToggle: HTMLButtonElement | null;
  helpButton: HTMLButtonElement | null;
  resetButton: HTMLButtonElement | null;
  closeHelp: HTMLButtonElement | null;
  soundToggleLandscape: HTMLButtonElement | null;
  musicToggleLandscape: HTMLButtonElement | null;
  helpButtonLandscape: HTMLButtonElement | null;
  resetButtonLandscape: HTMLButtonElement | null;
  restartButtonModal: HTMLButtonElement | null;
}

// Элементы отображения счета
export interface ScoreElements {
  scoreDisplay: HTMLElement | null;
  scoreDisplayLandscape: HTMLElement | null;
}

// Слайдеры громкости
export interface VolumeControls {
  musicVolume: HTMLInputElement | null;
  musicVolumeLandscape: HTMLInputElement | null;
}

// PWA события
export interface PWAEvents {
  deferredPrompt: Event | null;
  installButton: HTMLButtonElement | null;
  isInstallable: boolean;
}

// Функциональные типы
export type EventHandler = (event: Event) => void;
export type TouchEventHandler = (event: TouchEvent) => void;
export type MouseEventHandler = (event: MouseEvent) => void;
export type ButtonAction = () => void;

// Конфигурация анимации
export interface AnimationConfig {
  duration: number;
  easing?: string;
  delay?: number;
}

// Результат вычислений
export interface CalculationResult {
  angle: number;
  distance: number;
  power: number;
}

// Настройки производительности
export interface PerformanceSettings {
  enableAnimations: boolean;
  reducedMotion: boolean;
  highRefreshRate: boolean;
}

// Эмодзи для котов
export type CatEmoji = '😿' | '😺' | '😸' | '🙀';

// Статус игры
export type GameStatus = 'idle' | 'aiming' | 'playing' | 'paused';

// Типы событий касания
export type TouchEventType = 'touchstart' | 'touchmove' | 'touchend';

// Режимы отображения
export type DisplayMode = 'portrait' | 'landscape';

// Уровни качества графики
export type GraphicsQuality = 'low' | 'medium' | 'high';