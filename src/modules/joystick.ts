import { vibrate } from '../utils/device';

export interface JoystickState {
    isActive: boolean;
    angle: number;
    power: number;
    deltaX: number;
    deltaY: number;
}

export class JoystickManager {
    private container: HTMLElement | null = null;
    private base: HTMLElement | null = null;
    private stick: HTMLElement | null = null;
    private state: JoystickState;
    private centerX: number = 0;
    private centerY: number = 0;
    private maxDistance: number = 35;
    private onMoveCallback: ((state: JoystickState) => void) | null = null;
    private onReleaseCallback: ((state: JoystickState) => void) | null = null;

    constructor() {
        this.state = {
            isActive: false,
            angle: 0,
            power: 0,
            deltaX: 0,
            deltaY: 0,
        };

        this.initializeElements();
        this.setupEventListeners();
    }

    private initializeElements(): void {
        this.container = document.querySelector('.joystick-container');
        this.base = document.querySelector('.joystick-base');
        this.stick = document.querySelector('.joystick-stick');

        if (!this.container || !this.base || !this.stick) {
            console.warn('Joystick elements not found');
            return;
        }

        // Вычисляем центр джойстика
        this.updateCenter();
    }

    private updateCenter(): void {
        if (!this.base) return;

        const rect = this.base.getBoundingClientRect();
        this.centerX = rect.width / 2;
        this.centerY = rect.height / 2;

        // Вычисляем максимальное расстояние (радиус базы минус радиус стика)
        const baseRadius = rect.width / 2;
        const stickRadius = this.stick ? this.stick.offsetWidth / 2 : 25;
        this.maxDistance = baseRadius - stickRadius - 5; // 5px запас
    }

    private setupEventListeners(): void {
        if (!this.stick) return;

        // Touch события
        this.stick.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

        // Mouse события для тестирования на десктопе
        this.stick.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();
        e.stopPropagation();

        this.state.isActive = true;
        vibrate(20);
        this.updateCenter();
    }

    private handleTouchMove(e: TouchEvent): void {
        if (!this.state.isActive || !this.base) return;

        e.preventDefault();

        const touch = e.touches[0];
        if (!touch) return;

        const baseRect = this.base.getBoundingClientRect();
        const touchX = touch.clientX - baseRect.left;
        const touchY = touch.clientY - baseRect.top;

        this.updateStickPosition(touchX, touchY);
    }

    private handleTouchEnd(e: TouchEvent): void {
        if (!this.state.isActive) return;

        e.preventDefault();

        this.state.isActive = false;
        this.resetStick();

        if (this.onReleaseCallback) {
            this.onReleaseCallback({ ...this.state });
        }

        vibrate(40);
    }

    private handleMouseDown(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();

        this.state.isActive = true;
        this.updateCenter();
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.state.isActive || !this.base) return;

        const baseRect = this.base.getBoundingClientRect();
        const mouseX = e.clientX - baseRect.left;
        const mouseY = e.clientY - baseRect.top;

        this.updateStickPosition(mouseX, mouseY);
    }

    private handleMouseUp(): void {
        if (!this.state.isActive) return;

        this.state.isActive = false;
        this.resetStick();

        if (this.onReleaseCallback) {
            this.onReleaseCallback({ ...this.state });
        }
    }

    private updateStickPosition(x: number, y: number): void {
        if (!this.stick) return;

        // Вычисляем смещение от центра
        let deltaX = x - this.centerX;
        let deltaY = y - this.centerY;

        // Вычисляем расстояние от центра
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Ограничиваем движение стика в пределах базы
        if (distance > this.maxDistance) {
            const angle = Math.atan2(deltaY, deltaX);
            deltaX = Math.cos(angle) * this.maxDistance;
            deltaY = Math.sin(angle) * this.maxDistance;
        }

        // Обновляем позицию стика
        this.stick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

        // Обновляем состояние
        this.state.deltaX = deltaX;
        this.state.deltaY = deltaY;
        this.state.angle = Math.atan2(deltaY, deltaX);
        this.state.power = Math.min(distance / this.maxDistance, 1);

        // Вызываем callback
        if (this.onMoveCallback) {
            this.onMoveCallback({ ...this.state });
        }
    }

    private resetStick(): void {
        if (!this.stick) return;

        this.stick.style.transform = 'translate(0px, 0px)';
        this.state.deltaX = 0;
        this.state.deltaY = 0;
        this.state.angle = 0;
        this.state.power = 0;
    }

    // Публичные методы для подписки на события
    public onMove(callback: (state: JoystickState) => void): void {
        this.onMoveCallback = callback;
    }

    public onRelease(callback: (state: JoystickState) => void): void {
        this.onReleaseCallback = callback;
    }

    public getState(): JoystickState {
        return { ...this.state };
    }

    public isJoystickActive(): boolean {
        return this.state.isActive;
    }

    public reset(): void {
        this.resetStick();
        this.state.isActive = false;
    }
}
