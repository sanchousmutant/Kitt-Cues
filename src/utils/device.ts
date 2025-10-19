import { DeviceInfo, VibrationPattern } from '../types';

// Детекция устройства и браузера
export function getDeviceInfo(): DeviceInfo {
  const userAgent = navigator.userAgent;
  
  return {
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isAndroid: /Android/.test(userAgent),
    isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
    isChrome: /Chrome/.test(userAgent) && !/Edg/.test(userAgent),
    isFirefox: /Firefox/.test(userAgent),
    isEdge: /Edg/.test(userAgent),
    isSamsung: /Samsung/.test(userAgent),
    isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    supportsVibration: 'vibrate' in navigator,
    supportsOrientation: 'orientation' in window || 'onorientationchange' in window
  };
}

// Функция для вибрации с кроссбраузерной поддержкой
export function vibrate(pattern: VibrationPattern): void {
  const deviceInfo = getDeviceInfo();
  const isMobile = window.innerWidth <= 640;
  
  if (!isMobile || !deviceInfo.supportsVibration) return;
  
  try {
    // Поддержка различных браузеров и устройств
    const nav = navigator as any;
    if (nav.vibrate) {
      nav.vibrate(pattern);
    } else if (nav.webkitVibrate) {
      nav.webkitVibrate(pattern);
    } else if (nav.mozVibrate) {
      nav.mozVibrate(pattern);
    } else if (nav.msVibrate) {
      nav.msVibrate(pattern);
    }
  } catch (error) {
    // Игнорируем ошибки вибрации - не критично для игры
    console.log('Vibration not supported:', error);
  }
}

// Проверка поддержки fullscreen API
export function isFullscreenSupported(): boolean {
  const doc = document as any;
  return !!(doc.fullscreenEnabled || 
           doc.webkitFullscreenEnabled || 
           doc.mozFullScreenEnabled || 
           doc.msFullscreenEnabled);
}

// Проверка активного полноэкранного режима
export function isFullscreenActive(): boolean {
  const doc = document as any;
  return !!(doc.fullscreenElement || 
           doc.webkitFullscreenElement || 
           doc.mozFullScreenElement || 
           doc.msFullscreenElement);
}

// Вход в полноэкранный режим
export async function enterFullscreen(): Promise<void> {
  if (!isFullscreenSupported()) return;
  
  const el = document.documentElement as any;
  try {
    if (el.requestFullscreen) {
      return await el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      return await el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      return await el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      return await el.msRequestFullscreen();
    }
  } catch (error) {
    console.log('Fullscreen not supported:', error);
  }
}

// Выход из полноэкранного режима
export async function exitFullscreen(): Promise<void> {
  if (!isFullscreenSupported()) return;
  
  const doc = document as any;
  try {
    if (doc.exitFullscreen) {
      return await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      return await doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      return await doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      return await doc.msExitFullscreen();
    }
  } catch (error) {
    console.log('Exit fullscreen not supported:', error);
  }
}

// Проверка мобильного устройства по размеру экрана
export function isMobileDevice(): boolean {
  return window.innerWidth <= 640;
}

// Проверка портретной ориентации
export function isPortraitOrientation(): boolean {
  return window.innerHeight > window.innerWidth;
}

// Получение информации о производительности устройства
export function getPerformanceInfo(): {
  deviceMemory?: number;
  hardwareConcurrency: number;
  connection?: any;
} {
  const nav = navigator as any;
  
  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency || 1,
    connection: nav.connection || nav.mozConnection || nav.webkitConnection
  };
}

// Проверка поддержки Web Audio API
export function isWebAudioSupported(): boolean {
  return !!(window.AudioContext || 
           (window as any).webkitAudioContext || 
           (window as any).mozAudioContext || 
           (window as any).msAudioContext);
}

// Проверка поддержки Service Worker
export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

// Проверка режима отображения PWA
export function isPWAMode(): boolean {
  return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
}

// Получение размеров экрана с учетом плотности пикселей
export function getScreenInfo(): {
  width: number;
  height: number;
  devicePixelRatio: number;
  availableWidth: number;
  availableHeight: number;
} {
  return {
    width: screen.width,
    height: screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    availableWidth: screen.availWidth,
    availableHeight: screen.availHeight
  };
}

// Определение качества графики на основе производительности устройства
export function getRecommendedGraphicsQuality(): 'low' | 'medium' | 'high' {
  const perfInfo = getPerformanceInfo();
  const screenInfo = getScreenInfo();
  const deviceInfo = getDeviceInfo();
  
  // Низкое качество для старых мобильных устройств
  if (deviceInfo.isAndroid && screenInfo.width < 1080) {
    return 'low';
  }
  
  // Учитываем количество ядер процессора
  if (perfInfo.hardwareConcurrency <= 2) {
    return 'low';
  }
  
  // Учитываем объем памяти (если доступно)
  if (perfInfo.deviceMemory && perfInfo.deviceMemory <= 2) {
    return 'low';
  }
  
  // Высокое качество для мощных устройств
  if (perfInfo.hardwareConcurrency >= 8 && screenInfo.devicePixelRatio >= 2) {
    return 'high';
  }
  
  return 'medium';
}

// Проверка поддержки различных форматов изображений
export function getSupportedImageFormats(): {
  webp: boolean;
  avif: boolean;
  jpeg: boolean;
  png: boolean;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return {
    webp: canvas.toDataURL('image/webp').indexOf('image/webp') === 5,
    avif: canvas.toDataURL('image/avif').indexOf('image/avif') === 5,
    jpeg: true, // Всегда поддерживается
    png: true   // Всегда поддерживается
  };
}

// Получение предпочтений пользователя по анимациям
export function getAnimationPreferences(): {
  prefersReducedMotion: boolean;
  prefersReducedData: boolean;
} {
  return {
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    prefersReducedData: window.matchMedia('(prefers-reduced-data: reduce)').matches
  };
}

// Проверка сетевого соединения
export function getNetworkInfo(): {
  isOnline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
} {
  const nav = navigator as any;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  
  return {
    isOnline: navigator.onLine,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
    saveData: connection?.saveData
  };
}

// Адаптивный класс для определения характеристик устройства
export class DeviceDetector {
  private deviceInfo: DeviceInfo;
  private performanceInfo: any;
  private screenInfo: any;
  
  constructor() {
    this.deviceInfo = getDeviceInfo();
    this.performanceInfo = getPerformanceInfo();
    this.screenInfo = getScreenInfo();
  }
  
  get isMobile(): boolean {
    return isMobileDevice();
  }
  
  get isTablet(): boolean {
    return this.screenInfo.width >= 768 && this.screenInfo.width < 1024 && this.deviceInfo.isTouch;
  }
  
  get isDesktop(): boolean {
    return !this.isMobile && !this.isTablet;
  }
  
  get isLowPerformance(): boolean {
    return this.performanceInfo.hardwareConcurrency <= 2 || 
           (this.performanceInfo.deviceMemory && this.performanceInfo.deviceMemory <= 2);
  }
  
  get isHighPerformance(): boolean {
    return this.performanceInfo.hardwareConcurrency >= 8 && 
           this.screenInfo.devicePixelRatio >= 2;
  }
  
  get shouldUseReducedEffects(): boolean {
    return this.isLowPerformance || getAnimationPreferences().prefersReducedMotion;
  }
  
  get recommendedFrameRate(): number {
    if (this.isLowPerformance) return 30;
    if (this.isHighPerformance) return 120;
    return 60;
  }
}