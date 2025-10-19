import { BallObject, CatObject, PocketObject, PhysicsSettings } from '../types';
import { PHYSICS_CONFIG, CAT_CONFIG } from '../constants';
import { playHitSound, playWallHitSound, playMeowSound } from './sound';
import { vibrate } from '../utils/device';

export class PhysicsEngine {
  private settings: PhysicsSettings;
  private isMobile: boolean;

  constructor(isMobile: boolean = false) {
    this.isMobile = isMobile;
    this.settings = {
      friction: isMobile ? PHYSICS_CONFIG.MOBILE_FRICTION : PHYSICS_CONFIG.BASE_FRICTION,
      minVelocity: isMobile ? PHYSICS_CONFIG.MOBILE_MIN_VELOCITY : PHYSICS_CONFIG.BASE_MIN_VELOCITY,
      hitPower: isMobile ? PHYSICS_CONFIG.MOBILE_HIT_POWER : PHYSICS_CONFIG.BASE_HIT_POWER,
    };
  }

  updateSettings(isMobile: boolean): void {
    this.isMobile = isMobile;
    this.settings = {
      friction: isMobile ? PHYSICS_CONFIG.MOBILE_FRICTION : PHYSICS_CONFIG.BASE_FRICTION,
      minVelocity: isMobile ? PHYSICS_CONFIG.MOBILE_MIN_VELOCITY : PHYSICS_CONFIG.BASE_MIN_VELOCITY,
      hitPower: isMobile ? PHYSICS_CONFIG.MOBILE_HIT_POWER : PHYSICS_CONFIG.BASE_HIT_POWER,
    };
  }

  updateBallPhysics(
    ball: BallObject,
    tableWidth: number,
    tableHeight: number,
    cats: CatObject[],
    pockets: PocketObject[]
  ): boolean {
    if (ball.sunk) return false;

    // Применяем трение и останавливаем шар при низкой скорости
    if (Math.abs(ball.vx) < this.settings.minVelocity) ball.vx = 0;
    if (Math.abs(ball.vy) < this.settings.minVelocity) ball.vy = 0;
    
    if (ball.vx === 0 && ball.vy === 0) return false;

    ball.vx *= this.settings.friction;
    ball.vy *= this.settings.friction;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Проверяем попадание в лузы
    this.checkPocketCollisions(ball, pockets);
    
    if (ball.sunk) return true;

    // Столкновения со стенами
    this.checkWallCollisions(ball, tableWidth, tableHeight);

    // Столкновения с кошками
    this.checkCatCollisions(ball, cats);

    return true;
  }

  checkPocketCollisions(ball: BallObject, pockets: PocketObject[]): void {
    for (const pocket of pockets) {
      const dx = ball.x - pocket.x;
      const dy = ball.y - pocket.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Засчитываем, только если весь шар внутри радиуса лузы
      if ((distance + ball.radius) < pocket.radius && !ball.sunk) {
        ball.sunk = true;
        ball.vx = 0;
        ball.vy = 0;
        ball.el.style.display = 'none';
        playHitSound();
        return;
      }
    }
  }

  checkWallCollisions(ball: BallObject, tableWidth: number, tableHeight: number): void {
    if ((ball.x - ball.radius < 0 && ball.vx < 0) || (ball.x + ball.radius > tableWidth && ball.vx > 0)) {
      ball.vx *= -1;
      playWallHitSound();
      if (ball.x - ball.radius < 0) ball.x = ball.radius;
      if (ball.x + ball.radius > tableWidth) ball.x = tableWidth - ball.radius;
    }
    
    if ((ball.y - ball.radius < 0 && ball.vy < 0) || (ball.y + ball.radius > tableHeight && ball.vy > 0)) {
      ball.vy *= -1;
      playWallHitSound();
      if (ball.y - ball.radius < 0) ball.y = ball.radius;
      if (ball.y + ball.radius > tableHeight) ball.y = tableHeight - ball.radius;
    }
  }

  checkCatCollisions(ball: BallObject, cats: CatObject[]): void {
    for (const cat of cats) {
      if (cat.cooldown > 0 || ball.sunk) continue;
      
      const dx = ball.x - cat.x;
      const dy = ball.y - cat.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < ball.radius + cat.radius) {
        // На мобильных требуем более высокую скорость для срабатывания
        if (this.isMobile) {
          const speed = Math.hypot(ball.vx, ball.vy);
          if (speed < CAT_CONFIG.MOBILE_SPEED_THRESHOLD) continue;
        }

        this.handleCatHit(ball, cat, dx, dy, distance);
      }
    }
  }

  private handleCatHit(ball: BallObject, cat: CatObject, dx: number, dy: number, distance: number): void {
    playMeowSound();
    cat.cooldown = this.isMobile ? 
      PHYSICS_CONFIG.CAT_COOLDOWN * CAT_CONFIG.MOBILE_COOLDOWN_MULTIPLIER : 
      PHYSICS_CONFIG.CAT_COOLDOWN;
    
    // Анимация лапки/кота
    this.animateCatSwat(cat);

    // Отталкиваем шар
    const angle = Math.atan2(dy, dx);
    const effectivePawPower = this.isMobile ? 
      Math.max(1, PHYSICS_CONFIG.PAW_HIT_POWER * CAT_CONFIG.MOBILE_PAW_POWER_MULTIPLIER) : 
      PHYSICS_CONFIG.PAW_HIT_POWER;
    
    ball.vx = Math.cos(angle) * effectivePawPower;
    ball.vy = Math.sin(angle) * effectivePawPower;

    // Предотвращаем залипание: выталкиваем шар из радиуса кота
    const overlap = (ball.radius + cat.radius) - distance + 1;
    ball.x += Math.cos(angle) * overlap;
    ball.y += Math.sin(angle) * overlap;
  }

  private animateCatSwat(cat: CatObject): void {
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

  checkBallCollisions(balls: BallObject[]): void {
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].sunk) continue;
      
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].sunk) continue;
        
        this.handleBallCollision(balls[i], balls[j]);
      }
    }
  }

  private handleBallCollision(ball1: BallObject, ball2: BallObject): void {
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < ball1.radius + ball2.radius) {
      const angle = Math.atan2(dy, dx);
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      // Вращаем векторы скорости
      let vx1 = ball1.vx * cos + ball1.vy * sin;
      let vy1 = ball1.vy * cos - ball1.vx * sin;
      let vx2 = ball2.vx * cos + ball2.vy * sin;
      let vy2 = ball2.vy * cos - ball2.vx * sin;

      // Обмениваем скорости по оси столкновения
      const tempVx = vx1;
      vx1 = vx2;
      vx2 = tempVx;

      // Вращаем обратно
      ball1.vx = vx1 * cos - vy1 * sin;
      ball1.vy = vy1 * cos + vx1 * sin;
      ball2.vx = vx2 * cos - vy2 * sin;
      ball2.vy = vy2 * cos + vx2 * sin;

      // Разделяем шары, чтобы избежать наложения
      const overlap = (ball1.radius + ball2.radius) - distance + 1;
      const moveX = (overlap / 2) * cos;
      const moveY = (overlap / 2) * sin;
      ball1.x -= moveX;
      ball1.y -= moveY;
      ball2.x += moveX;
      ball2.y += moveY;

      playHitSound();
    }
  }

  updateCats(cats: CatObject[]): void {
    for (const cat of cats) {
      if (cat.cooldown > 0) cat.cooldown--;
    }
  }

  applyForce(ball: BallObject, angle: number, power: number): void {
    // Удар направляем противоположно углу прицеливания
    ball.vx = -Math.cos(angle) * power;
    ball.vy = -Math.sin(angle) * power;
    
    // Добавляем вибрацию на мобильных
    if (this.isMobile) {
      const vibrationIntensity = Math.min(power * 2, 30);
      vibrate(vibrationIntensity);
    }
  }

  areAllBallsStopped(balls: BallObject[]): boolean {
    return balls.every(ball => ball.sunk || (ball.vx === 0 && ball.vy === 0));
  }

  getSettings(): PhysicsSettings {
    return { ...this.settings };
  }
}