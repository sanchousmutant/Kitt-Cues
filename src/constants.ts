// Физические константы игры
export const PHYSICS_CONFIG = {
  BASE_FRICTION: 0.985,
  MOBILE_FRICTION: 0.8,
  BASE_MIN_VELOCITY: 0.05,
  MOBILE_MIN_VELOCITY: 0.07,
  BASE_HIT_POWER: 15,
  MOBILE_HIT_POWER: 7,
  PAW_HIT_POWER: 4,
  CAT_COOLDOWN: 60, // кадры (1 секунда при 60 FPS)
} as const;

// Аудио константы
export const AUDIO_CONFIG = {
  MUSIC_VOLUME: 0.45, // базовая громкость музыки (0..1)
  SOUND_EFFECT_VOLUME: 0.15,
  VIBRATION_DURATION: {
    HIT: 50,
    WALL_HIT: 30,
    MEOW: [100, 50, 100] as const,
    SUCCESS: [100, 50, 100, 50, 100] as const,
    TOUCH_START: 20,
    TOUCH_END: 40,
  },
} as const;

// Константы UI
export const UI_CONFIG = {
  MOBILE_BREAKPOINT: 640,
  DEBOUNCE_DELAY: 100,
  ORIENTATION_CHANGE_DELAY: 200,
  ANIMATION_DURATION: 300,
} as const;

// Константы игровой механики
export const GAME_CONFIG = {
  MAX_POWER: 25,
  MIN_POWER_FOR_CLICK: 10,
  POWER_SENSITIVITY: 6, // делитель для вычисления силы из расстояния
  AIM_LINE_LENGTH: 150,
  TABLE_ASPECT_RATIO: 1.5, // соотношение сторон стола
  BORDER_WIDTH: 20,
} as const;

// Музыкальные ноты (частоты в Hz)
export const MUSIC_NOTES = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.00,
  C5: 523.25,
  B4: 493.88,
  D5: 587.33,
  G5: 783.99,
} as const;

// Селекторы DOM элементов
export const DOM_SELECTORS = {
  GAME_AREA: '#game-area',
  TABLE: '#billiard-table',
  TABLE_CONTAINER: '#billiard-table-container',
  CUE: '#cue',
  AIM_LINE: '#aim-line',
  POWER_INDICATOR: '#power-indicator',
  POWER_FILL: '#power-fill',
  BILLIARD_BALLS: '.billiard-ball',
  PYRAMID_CONTAINER: '#ball-pyramid',
  CAT_CONTAINERS: '.cat-container',
  POCKETS: '[data-pocket]',
  SCORE_DISPLAY: '#score-display',
  SCORE_DISPLAY_LANDSCAPE: '#score-display-landscape',
  HELP_MODAL: '#help-modal',
  ROTATION_NOTICE: '#rotation-notice',
} as const;

// Константы для кошек
export const CAT_CONFIG = {
  MOBILE_RADIUS_MULTIPLIER: 0.5,
  MOBILE_COOLDOWN_MULTIPLIER: 2,
  MOBILE_SPEED_THRESHOLD: 3, // минимальная скорость для реакции кота на мобильных
  MOBILE_PAW_POWER_MULTIPLIER: 0.25,
  SWAT_ANIMATION_DURATION: 300,
  SMALL_CAT_ANIMATION_DURATION: 500,
  EMOJI_DISPLAY_DURATION: 1300,
} as const;

// Константы лунок
export const POCKET_CONFIG = {
  VISUAL_RADIUS_MULTIPLIER: 0.95,
  MOBILE_VISUAL_RADIUS_MULTIPLIER: 0.8,
  MIN_RADIUS: 6,
  MIN_MOBILE_RADIUS: 4,
} as const;

// Настройки масштабирования
export const SCALING_CONFIG = {
  BASE_TABLE_WIDTH: 600,
  BASE_TABLE_HEIGHT: 400,
  BREAKPOINTS: {
    XS: 280,
    SM: 320,
    MD: 375,
    LG: 640,
    XL: 1024,
  },
  CAT_SCALES: {
    XS: 0.25,
    SM: 0.3,
    MD: 0.4,
    LG: 0.5,
    XL: 1.1,
  },
  BALL_SIZES: {
    BASE: 16,
    XS: 26,
    SM: 28,
    MD: 30,
    LG: 32,
  } as const,
} as const;

// Константы для настроек
export const STORAGE_KEYS = {
  SOUND_ENABLED: 'kitt-cues-sound',
  MUSIC_ENABLED: 'kitt-cues-music',
  MUSIC_VOLUME: 'kitt-cues-music-volume',
} as const;

// Типы кошек
export const CAT_TYPES = {
  ORANGE: 'cat-orange',
  GRAY: 'cat-gray',
  WHITE: 'cat-white',
  SMALL: 'cat-small',
} as const;