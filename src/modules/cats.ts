import { CatObject, CatEmoji } from '../types';
import { DOM_SELECTORS, CAT_CONFIG } from '../constants';

export class CatManager {
  private cats: CatObject[] = [];
  private isMobile: boolean = false;

  constructor(isMobile: boolean = false) {
    this.isMobile = isMobile;
  }

  initializeCats(table: HTMLElement): CatObject[] {
    this.cats = [];
    const catElements = document.querySelectorAll(DOM_SELECTORS.CAT_CONTAINERS);
    const tableRect = table.getBoundingClientRect();

    catElements.forEach(el => {
      const catRect = el.getBoundingClientRect();
      const catCenterX = (catRect.left - tableRect.left) + catRect.width / 2;
      const catCenterY = (catRect.top - tableRect.top) + catRect.height / 2;

      // Увеличиваем радиус для маленького кота для лучшего взаимодействия
      let radius = Math.max(catRect.width, catRect.height) / 2;
      if (el.classList.contains('cat-small')) {
        radius = Math.max(catRect.width, catRect.height) / 2;
      }
      if (this.isMobile) {
        radius *= CAT_CONFIG.MOBILE_RADIUS_MULTIPLIER;
      }

      const cat: CatObject = {
        el: el as HTMLElement,
        pawEl: el.querySelector('.hitting-paw') as HTMLElement | null,
        x: catCenterX,
        y: catCenterY,
        radius: radius,
        cooldown: 0
      };

      this.cats.push(cat);
    });

    return this.cats;
  }

  updateMobileSettings(isMobile: boolean): void {
    this.isMobile = isMobile;
    // Пересчитываем радиусы кошек при изменении мобильного режима
    this.cats.forEach(cat => {
      const originalRadius = Math.max(cat.el.offsetWidth, cat.el.offsetHeight) / 2;
      cat.radius = this.isMobile ?
        originalRadius * CAT_CONFIG.MOBILE_RADIUS_MULTIPLIER :
        originalRadius;
    });
  }

  showCatEmoji(cat: CatObject, emoji: CatEmoji, table: HTMLElement): void {
    try {
      const emojiElement = document.createElement('div');
      emojiElement.className = 'cat-emoji';
      emojiElement.textContent = emoji;

      // Позиционируем по центру головы кота
      const head = cat.el.querySelector('.cat-head') || cat.el;
      const headRect = head.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const centerX = (headRect.left - tableRect.left) + headRect.width / 2;
      const topY = (headRect.top - tableRect.top) - 6;

      emojiElement.style.left = `${centerX}px`;
      emojiElement.style.top = `${topY}px`;

      table.appendChild(emojiElement);

      setTimeout(() => {
        if (emojiElement.parentElement) {
          emojiElement.remove();
        }
      }, CAT_CONFIG.EMOJI_DISPLAY_DURATION);
    } catch (e) {
      console.warn('Failed to show cat emoji:', e);
    }
  }

  showAllCatsEmoji(emoji: CatEmoji, table: HTMLElement): void {
    this.cats.forEach(cat => {
      this.showCatEmoji(cat, emoji, table);
    });
  }

  updateCatCooldowns(): void {
    this.cats.forEach(cat => {
      if (cat.cooldown > 0) cat.cooldown--;
    });
  }

  isCatReady(cat: CatObject): boolean {
    return cat.cooldown === 0;
  }

  setCatCooldown(cat: CatObject): void {
    cat.cooldown = this.isMobile ?
      CAT_CONFIG.MOBILE_COOLDOWN_MULTIPLIER * 60 : // 60 frames = 1 second at 60fps
      60;
  }

  animateCatSwat(cat: CatObject): void {
    if (cat.el.classList.contains('cat-small')) {
      cat.el.classList.add('swat-animation');
      setTimeout(() => {
        cat.el.classList.remove('swat-animation');
      }, CAT_CONFIG.SMALL_CAT_ANIMATION_DURATION);
    } else {
      const pawElement = cat.pawEl || cat.el;
      pawElement.classList.add('swat-animation');
      setTimeout(() => {
        pawElement.classList.remove('swat-animation');
      }, CAT_CONFIG.SWAT_ANIMATION_DURATION);
    }
  }

  getCatAtPosition(x: number, y: number, radius: number = 0): CatObject | null {
    for (const cat of this.cats) {
      const dx = x - cat.x;
      const dy = y - cat.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < cat.radius + radius) {
        return cat;
      }
    }
    return null;
  }

  getCatsByType(type: string): CatObject[] {
    return this.cats.filter(cat => cat.el.classList.contains(type));
  }

  getAllCats(): CatObject[] {
    return [...this.cats];
  }

  getCatCount(): number {
    return this.cats.length;
  }

  resetAllCats(): void {
    this.cats.forEach(cat => {
      cat.cooldown = 0;
      // Убираем анимации
      cat.el.classList.remove('swat-animation');
      if (cat.pawEl) {
        cat.pawEl.classList.remove('swat-animation');
      }
    });
  }

  // Специальные методы для разных типов кошек
  getOrangeCats(): CatObject[] {
    return this.getCatsByType('cat-orange');
  }

  getGrayCats(): CatObject[] {
    return this.getCatsByType('cat-gray');
  }

  getWhiteCats(): CatObject[] {
    return this.getCatsByType('cat-white');
  }

  getSmallCats(): CatObject[] {
    return this.getCatsByType('cat-small');
  }

  // Методы для анимации конкретных кошек
  makeOrangeCatsHappy(table: HTMLElement): void {
    this.getOrangeCats().forEach(cat => {
      this.showCatEmoji(cat, '😺', table);
    });
  }

  makeGrayCatsSad(table: HTMLElement): void {
    this.getGrayCats().forEach(cat => {
      this.showCatEmoji(cat, '😿', table);
    });
  }

  makeWhiteCatsExcited(table: HTMLElement): void {
    this.getWhiteCats().forEach(cat => {
      this.showCatEmoji(cat, '😸', table);
    });
  }

  makeSmallCatsSurprised(table: HTMLElement): void {
    this.getSmallCats().forEach(cat => {
      this.showCatEmoji(cat, '🙀', table);
    });
  }

  // Получить информацию о коте
  getCatInfo(cat: CatObject): {
    type: string;
    position: { x: number; y: number };
    radius: number;
    cooldown: number;
    isReady: boolean;
  } {
    let type = 'unknown';
    if (cat.el.classList.contains('cat-orange')) type = 'orange';
    else if (cat.el.classList.contains('cat-gray')) type = 'gray';
    else if (cat.el.classList.contains('cat-white')) type = 'white';
    else if (cat.el.classList.contains('cat-small')) type = 'small';

    return {
      type,
      position: { x: cat.x, y: cat.y },
      radius: cat.radius,
      cooldown: cat.cooldown,
      isReady: this.isCatReady(cat)
    };
  }

  // Обновить позиции кошек (если элементы сдвинулись)
  updateCatPositions(table: HTMLElement): void {
    const tableRect = table.getBoundingClientRect();

    this.cats.forEach(cat => {
      const catRect = cat.el.getBoundingClientRect();
      cat.x = (catRect.left - tableRect.left) + catRect.width / 2;
      cat.y = (catRect.top - tableRect.top) + catRect.height / 2;
    });
  }

  // Найти ближайшую к точке кошку
  getClosestCat(x: number, y: number): { cat: CatObject; distance: number } | null {
    let closest: { cat: CatObject; distance: number } | null = null;

    for (const cat of this.cats) {
      const dx = x - cat.x;
      const dy = y - cat.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!closest || distance < closest.distance) {
        closest = { cat, distance };
      }
    }

    return closest;
  }

  // Получить всех кошек в радиусе от точки
  getCatsInRadius(x: number, y: number, radius: number): CatObject[] {
    return this.cats.filter(cat => {
      const dx = x - cat.x;
      const dy = y - cat.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= radius;
    });
  }

  // Проверить, пересекается ли траектория с какой-либо кошкой
  checkTrajectoryIntersection(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    ballRadius: number = 8
  ): CatObject | null {
    const trajectory = {
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY
    };

    for (const cat of this.cats) {
      if (this.lineIntersectsCircle(trajectory, cat.x, cat.y, cat.radius + ballRadius)) {
        return cat;
      }
    }

    return null;
  }

  private lineIntersectsCircle(
    line: { x1: number; y1: number; x2: number; y2: number },
    circleX: number,
    circleY: number,
    radius: number
  ): boolean {
    const A = line.x2 - line.x1;
    const B = line.y2 - line.y1;
    const C = line.x1 - circleX;
    const D = line.y1 - circleY;

    const dot = C * A + D * B;
    const lenSq = A * A + B * B;

    if (lenSq === 0) return false; // Line has no length

    const param = dot / lenSq;

    let closestX: number, closestY: number;

    if (param < 0) {
      closestX = line.x1;
      closestY = line.y1;
    } else if (param > 1) {
      closestX = line.x2;
      closestY = line.y2;
    } else {
      closestX = line.x1 + param * A;
      closestY = line.y1 + param * B;
    }

    const dx = circleX - closestX;
    const dy = circleY - closestY;
    const distanceSq = dx * dx + dy * dy;

    return distanceSq <= radius * radius;
  }
  startCatnado(table: HTMLElement): void {
    const tableRect = table.getBoundingClientRect();
    const cx = tableRect.width / 2;
    const cy = tableRect.height / 2;

    // Убираем котов из потока физики, чтобы они не мешали (хотя игра уже закончена)
    // В данном случае мы просто анимируем их визуальное представление

    const catsData = this.cats.map(cat => {
      const dx = cat.x - cx;
      const dy = cat.y - cy;
      return {
        cat,
        angle: Math.atan2(dy, dx),
        radius: Math.sqrt(dx * dx + dy * dy),
        speed: 0.02,
        expanding: false
      };
    });

    // animationFrame is not used


    const animate = () => {
      let stillVisible = false;

      catsData.forEach(data => {
        // Увеличиваем скорость
        data.speed += 0.002;

        // Обновляем угол
        data.angle += data.speed;

        // Если скорость достаточно большая, начинаем разлет
        if (data.speed > 0.2) {
          data.expanding = true;
        }

        if (data.expanding) {
          data.radius += 10 + data.speed * 50;
        }

        // Вычисляем новую позицию
        // cat.x и cat.y в локальных координатах стола
        const newX = cx + Math.cos(data.angle) * data.radius;
        const newY = cy + Math.sin(data.angle) * data.radius;

        // Обновляем визуальный элемент
        // Нам нужно учесть, что координаты кота (x,y) - это центр
        // А transform работает относительно начальной позиции или требует пересчета
        // Проще всего задать left/top и transform

        data.cat.el.style.left = `${newX - data.cat.el.offsetWidth / 2}px`;
        data.cat.el.style.top = `${newY - data.cat.el.offsetHeight / 2}px`;
        data.cat.el.style.transform = `rotate(${data.angle * 57.29 + 90}deg) scale(${data.expanding ? 1 + data.speed : 1})`;

        // Проверяем, виден ли еще
        if (data.radius < 3000) {
          stillVisible = true;
        }
      });

      if (stillVisible) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }
}

// Создаем глобальный экземпляр менеджера кошек
export const catManager = new CatManager();
