// Утилита для дебаунса
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => func(...args), delay);
  };
}

// Утилита для троттлинга
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Плавная интерполяция углов (для вращения кия)
export function smoothAngle(current: number, target: number, alpha: number): number {
  // Интерполяция по кратчайшей дуге
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * alpha;
}

// Конвертация градусов в радианы
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Конвертация радианов в градусы
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

// Ограничение значения в пределах диапазона
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Линейная интерполяция между двумя значениями
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Вычисление расстояния между двумя точками
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Вычисление угла между двумя точками
export function angle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Нормализация вектора
export function normalize(x: number, y: number): { x: number; y: number; magnitude: number } {
  const magnitude = Math.sqrt(x * x + y * y);
  if (magnitude === 0) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  return {
    x: x / magnitude,
    y: y / magnitude,
    magnitude
  };
}

// Проверка пересечения двух окружностей
export function circleIntersection(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const dist = distance(x1, y1, x2, y2);
  return dist < (r1 + r2);
}

// Проверка, находится ли точка внутри прямоугольника
export function pointInRect(
  px: number, py: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// Проверка, находится ли точка внутри окружности
export function pointInCircle(
  px: number, py: number,
  cx: number, cy: number, radius: number
): boolean {
  return distance(px, py, cx, cy) <= radius;
}

// Генерация случайного числа в диапазоне
export function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Генерация случайного целого числа в диапазоне
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Выбор случайного элемента из массива
export function randomChoice<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[randomInt(0, array.length - 1)];
}

// Перемешивание массива (алгоритм Фишера-Йетса)
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Форматирование числа с ведущими нулями
export function padZero(num: number, digits: number): string {
  return num.toString().padStart(digits, '0');
}

// Форматирование времени в формате мм:сс
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${padZero(mins, 2)}:${padZero(secs, 2)}`;
}

// Создание задержки (Promise-based)
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Проверка, является ли значение числом
export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}

// Безопасное преобразование в число
export function toNumber(value: any, defaultValue: number = 0): number {
  const num = Number(value);
  return isNumber(num) ? num : defaultValue;
}

// Получение безопасного элемента DOM
export function safeQuerySelector<T extends Element = Element>(
  selector: string,
  parent: Document | Element = document
): T | null {
  try {
    return parent.querySelector<T>(selector);
  } catch (error) {
    console.warn(`Invalid selector: ${selector}`, error);
    return null;
  }
}

// Получение безопасного списка элементов DOM
export function safeQuerySelectorAll<T extends Element = Element>(
  selector: string,
  parent: Document | Element = document
): NodeListOf<T> | [] {
  try {
    return parent.querySelectorAll<T>(selector);
  } catch (error) {
    console.warn(`Invalid selector: ${selector}`, error);
    return [] as any;
  }
}

// Проверка видимости элемента
export function isElementVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && 
         rect.height > 0 && 
         rect.top >= 0 && 
         rect.left >= 0 && 
         rect.bottom <= window.innerHeight && 
         rect.right <= window.innerWidth;
}

// Получение позиции элемента относительно родителя
export function getRelativePosition(
  element: HTMLElement, 
  parent: HTMLElement
): { x: number; y: number } {
  const elementRect = element.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  
  return {
    x: elementRect.left - parentRect.left,
    y: elementRect.top - parentRect.top
  };
}

// Копирование объекта (глубокое)
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (typeof obj === 'object') {
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

// Проверка равенства объектов (поверхностное)
export function shallowEqual(obj1: any, obj2: any): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  
  return true;
}

// Создание уникального ID
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Безопасное округление до определенного количества знаков после запятой
export function roundToDecimals(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

// Проверка поддержки CSS свойства
export function supportsCSSProperty(property: string): boolean {
  const testElement = document.createElement('div');
  return property in testElement.style;
}

// Добавление CSS класса с анимацией
export function addClassWithAnimation(
  element: HTMLElement, 
  className: string, 
  duration: number = 300
): Promise<void> {
  return new Promise(resolve => {
    element.classList.add(className);
    setTimeout(() => resolve(), duration);
  });
}

// Удаление CSS класса с анимацией
export function removeClassWithAnimation(
  element: HTMLElement, 
  className: string, 
  duration: number = 300
): Promise<void> {
  return new Promise(resolve => {
    element.classList.remove(className);
    setTimeout(() => resolve(), duration);
  });
}

// Создание элемента с атрибутами
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  attributes: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  
  // Устанавливаем атрибуты
  Object.assign(element, attributes);
  
  // Добавляем дочерние элементы
  children.forEach(child => {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });
  
  return element;
}

// Класс для работы с событиями
export class EventEmitter<T extends Record<string, any[]> = Record<string, any[]>> {
  private listeners: Map<keyof T, Set<(...args: any[]) => void>> = new Map();

  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
  }

  once<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    const onceWrapper = (...args: T[K]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  clear(): void {
    this.listeners.clear();
  }
}