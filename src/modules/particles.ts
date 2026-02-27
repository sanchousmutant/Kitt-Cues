import { random } from '../utils/helpers';

interface StarParticle {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
}

export class ParticleManager {
  private gameArea: HTMLElement;
  private particleCount: number = 20; // Number of stars to spawn, matching reference
  private activeParticles: StarParticle[] = []; // Array to hold active particles

  constructor(gameArea: HTMLElement) {
    this.gameArea = gameArea;
  }

  spawnStars(x: number, y: number, color?: string): void {
    for (let i = 0; i < this.particleCount; i++) {
      const particle = this.createStarParticle(x, y, color);
      this.activeParticles.push(particle);
    }
  }

  hasActiveParticles(): boolean {
    return this.activeParticles.length > 0;
  }

  private createStarParticle(x: number, y: number, color?: string): StarParticle {
    const starEl = document.createElement('div'); // Using div as a container
    starEl.classList.add('star-particle');
    starEl.textContent = '★'; // Star character
    this.gameArea.appendChild(starEl);

    // Initial position, centered around the pocket
    starEl.style.position = 'absolute';
    starEl.style.pointerEvents = 'none';
    starEl.style.zIndex = '1000'; // Ensure it's on top
    starEl.style.color = color || '#ffd700'; // Gold color for star by default
    starEl.style.fontSize = `${random(15, 30)}px`; // Increased random font size for stars

    // Initial physics properties
    const angle = random(0, Math.PI * 2);
    const speed = random(2, 4); // Matching reference for speed
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const size = parseFloat(starEl.style.fontSize); // Use font size as effective size

    const particle: StarParticle = {
      el: starEl,
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      life: 1.0,
      decay: random(0.01, 0.02), // Matching reference for decay
      size: size,
      rotation: random(0, 360),
      rotationSpeed: random(-5, 5) // Random rotation speed
    };

    return particle;
  }

  updateParticles(): void {
    const gravity = 0.1; // Matching reference for gravity
    this.activeParticles = this.activeParticles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += gravity; // Apply gravity

      p.life -= p.decay;
      p.rotation += p.rotationSpeed;

      // Update DOM element style
      p.el.style.left = `${p.x}px`;
      p.el.style.top = `${p.y}px`;
      p.el.style.opacity = `${p.life}`;
      p.el.style.transform = `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.life})`;

      if (p.life <= 0) {
        p.el.remove(); // Remove element from DOM
        return false; // Filter out dead particles
      }
      return true; // Keep active particles
    });
  }
}

