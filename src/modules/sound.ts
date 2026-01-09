import { BackgroundMusic } from '../types';
import { AUDIO_CONFIG, STORAGE_KEYS } from '../constants';
import { vibrate } from '../utils/device';

export class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private backgroundMusic: BackgroundMusic | null = null;
  private ambientOscillator: OscillatorNode | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private isMusicPlaying: boolean = false;
  private musicVolume: number = AUDIO_CONFIG.MUSIC_VOLUME;

  constructor() {
    this.loadSettings();
  }

  async initAudio(): Promise<void> {
    if (this.audioContext) return;

    try {
      // Поддержка всех вариантов AudioContext
      const AudioContextClass = window.AudioContext ||
        (window as any).webkitAudioContext ||
        (window as any).mozAudioContext ||
        (window as any).msAudioContext;

      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 0.5;

        // Для iOS Safari требуется пользовательское взаимодействие
        if (this.audioContext.state === 'suspended') {
          const resumeAudio = () => {
            this.audioContext?.resume().then(() => {
              console.log('Audio context resumed');
              this.startAmbient(); // Запускаем эмбиент после разблокировки
              document.removeEventListener('touchstart', resumeAudio);
              document.removeEventListener('click', resumeAudio);
            });
          };
          document.addEventListener('touchstart', resumeAudio, { once: true });
          document.addEventListener('click', resumeAudio, { once: true });
        } else {
          this.startAmbient();
        }
      } else {
        console.warn('Web Audio API не поддерживается в этом браузере');
      }
    } catch (error) {
      console.warn('Ошибка инициализации Web Audio API:', error);
      this.audioContext = null;
    }
  }

  // Фоновое мурчание (низкий рокот)
  startAmbient(): void {
    if (!this.audioContext || !this.soundEnabled || !this.masterGain || this.ambientOscillator) return;

    try {
      const osc = this.audioContext.createOscillator();
      const g = this.audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.value = 40; // Очень низко

      // Модуляция для эффекта дыхания/мурчания
      const lfo = this.audioContext.createOscillator();
      lfo.frequency.value = 0.5;
      const lfoGain = this.audioContext.createGain();
      lfoGain.gain.value = 5;

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      g.gain.value = 0.05;
      osc.connect(g);
      g.connect(this.masterGain);

      osc.start();
      lfo.start();

      this.ambientOscillator = osc;
    } catch (e) {
      console.error("Error starting ambient sound:", e);
    }
  }

  stopAmbient(): void {
    if (this.ambientOscillator) {
      try {
        this.ambientOscillator.stop();
        this.ambientOscillator.disconnect();
      } catch (e) { }
      this.ambientOscillator = null;
    }
  }

  private musicTimeout: number | null = null;
  // Гамма До мажор (C Major) для приятного звучания
  private scale: number[] = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];

  startMusicLoop(): void {
    const playNextNote = () => {
      if (!this.musicEnabled || !this.audioContext || !this.masterGain) return;

      const now = this.audioContext.currentTime;
      const freq = this.scale[Math.floor(Math.random() * this.scale.length)];

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Мягкое появление и затухание (как у пианино)
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05 * this.musicVolume, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 3.1);

      // Рекурсивный вызов с небольшим разбросом во времени для естественности
      const nextTime = 1500 + Math.random() * 2000;
      this.musicTimeout = window.setTimeout(playNextNote, nextTime);
    };
    playNextNote();
  }

  startBackgroundMusic(): void {
    if (!this.musicEnabled || this.isMusicPlaying || !this.audioContext) return;

    this.isMusicPlaying = true;
    this.startMusicLoop();
  }

  stopBackgroundMusic(): void {
    this.isMusicPlaying = false;

    if (this.musicTimeout !== null) {
      clearTimeout(this.musicTimeout);
      this.musicTimeout = null;
    }
  }

  // Звук столкновения "Клак" (мягкий)
  playHitSound(velocity: number = 10): void {
    if (!this.audioContext || !this.soundEnabled || !this.masterGain) return;

    try {
      const volume = Math.min(Math.max(velocity, 0.1) / 10, 1.0);

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150 + Math.random() * 50, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.audioContext.currentTime + 0.1);

      filter.type = 'lowpass';
      filter.frequency.value = 800;

      gain.gain.setValueAtTime(volume * AUDIO_CONFIG.SOUND_EFFECT_VOLUME, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.audioContext.currentTime + 0.2);

      vibrate(AUDIO_CONFIG.VIBRATION_DURATION.HIT);
    } catch (error) {
      console.log('Error playing hit sound:', error);
    }
  }

  // Звук удара о борт "Туд" (глухой)
  playWallHitSound(velocity: number = 10): void {
    if (!this.audioContext || !this.soundEnabled || !this.masterGain) return;

    try {
      const volume = Math.min(Math.max(velocity, 0.1) / 15, 0.6);

      const noise = this.audioContext.createBufferSource();
      const bufferSize = this.audioContext.sampleRate * 0.1;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      noise.buffer = buffer;
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 150;

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(volume * AUDIO_CONFIG.SOUND_EFFECT_VOLUME, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start();

      vibrate(AUDIO_CONFIG.VIBRATION_DURATION.WALL_HIT);
    } catch (error) {
      console.log('Error playing wall hit sound:', error);
    }
  }

  // Звук попадания в лузу (Магический дзинь)
  playPocketSound(): void {
    if (!this.audioContext || !this.soundEnabled || !this.masterGain) return;

    try {
      const now = this.audioContext.currentTime;

      [440, 554, 659, 880].forEach((freq, i) => {
        if (!this.audioContext || !this.masterGain) return;
        const osc = this.audioContext.createOscillator();
        const g = this.audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, now + i * 0.05);
        g.gain.linearRampToValueAtTime(0.2 * AUDIO_CONFIG.SOUND_EFFECT_VOLUME, now + i * 0.05 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.5);

        osc.connect(g);
        if (this.masterGain) {
          g.connect(this.masterGain);
        }
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.6);
      });
      vibrate([50, 50, 50]);
    } catch (e) {
      console.log('Error playing pocket sound:', e);
    }
  }

  playMeowSound(): void {
    console.log('playMeowSound called - soundEnabled:', this.soundEnabled, 'audioContext:', !!this.audioContext);

    if (!this.audioContext || !this.soundEnabled || !this.masterGain) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(800, this.audioContext.currentTime + 0.1);
      oscillator.frequency.linearRampToValueAtTime(400, this.audioContext.currentTime + 0.3);

      gainNode.gain.setValueAtTime(0.1 * AUDIO_CONFIG.SOUND_EFFECT_VOLUME, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);

      vibrate([...AUDIO_CONFIG.VIBRATION_DURATION.MEOW]);
    } catch (error) {
      console.log('Error playing meow sound:', error);
    }
  }

  playPawHit(velocity: number): void {
    if (!this.audioContext || !this.soundEnabled || !this.masterGain) return;

    try {
      const now = this.audioContext.currentTime;
      const volume = Math.min(velocity / 15, 0.8) * AUDIO_CONFIG.SOUND_EFFECT_VOLUME;

      // 1. Низкочастотный "пуф"
      const bodyOsc = this.audioContext.createOscillator();
      const bodyGain = this.audioContext.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(80, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      bodyGain.gain.setValueAtTime(volume, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.masterGain);
      bodyOsc.start();
      bodyOsc.stop(now + 0.2);

      // 2. Высокочастотный шелест шерсти (белый шум с фильтром)
      const sampleRate = this.audioContext.sampleRate;
      const bufferSize = sampleRate * 0.1;
      const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseSource = this.audioContext.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseFilter = this.audioContext.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1000;
      const noiseGain = this.audioContext.createGain();
      noiseGain.gain.setValueAtTime(volume * 0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noiseSource.start();
    } catch (error) {
      console.error('Error playing paw hit sound:', error);
    }
  }

  toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
    console.log('Sound toggled - soundEnabled is now:', this.soundEnabled);

    if (this.soundEnabled) {
      this.startAmbient();
    } else {
      this.stopAmbient();
    }

    this.saveSettings();
  }

  toggleMusic(): void {
    this.musicEnabled = !this.musicEnabled;

    if (this.musicEnabled) {
      this.startBackgroundMusic();
    } else {
      this.stopBackgroundMusic();
    }

    this.saveSettings();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));

    if (this.backgroundMusic?.gainNode && this.audioContext) {
      this.backgroundMusic.gainNode.gain.setTargetAtTime(
        this.musicVolume,
        this.audioContext.currentTime,
        0.05
      );
    }

    this.saveSettings();
  }

  private loadSettings(): void {
    const savedSound = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    if (savedSound !== null) {
      this.soundEnabled = savedSound === 'true';
    }

    const savedMusic = localStorage.getItem(STORAGE_KEYS.MUSIC_ENABLED);
    if (savedMusic !== null) {
      this.musicEnabled = savedMusic === 'true';
    }

    const savedVolume = localStorage.getItem(STORAGE_KEYS.MUSIC_VOLUME);
    if (savedVolume !== null && !Number.isNaN(Number(savedVolume))) {
      this.musicVolume = Math.max(0, Math.min(100, Number(savedVolume))) / 100;
    }
  }

  private saveSettings(): void {
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(this.soundEnabled));
    localStorage.setItem(STORAGE_KEYS.MUSIC_ENABLED, String(this.musicEnabled));
    localStorage.setItem(STORAGE_KEYS.MUSIC_VOLUME, String(Math.round(this.musicVolume * 100)));
  }

  // Геттеры для состояния
  get isSoundEnabled(): boolean { return this.soundEnabled; }
  get isMusicEnabled(): boolean { return this.musicEnabled; }
  get getMusicVolume(): number { return this.musicVolume; }
  get getIsMusicPlaying(): boolean { return this.isMusicPlaying; }
  playCueFall(): void {
    if (!this.soundEnabled || !this.audioContext || !this.masterGain) return;

    try {
      const now = this.audioContext.currentTime;

      const osc = this.audioContext.createOscillator();
      const g = this.audioContext.createGain();

      osc.type = 'sine';
      // Скользящая вниз частота
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);

      g.gain.setValueAtTime(0.3 * AUDIO_CONFIG.SOUND_EFFECT_VOLUME, now);
      g.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.connect(g);
      g.connect(this.masterGain);
      osc.start();
      osc.stop(now + 0.5);

      // Дополнительный глухой щелчок в конце
      setTimeout(() => this.playThud(8), 350);
    } catch (error) {
      console.error('Error playing cue fall sound:', error);
    }
  }

  private playThud(power: number): void {
    if (!this.soundEnabled || !this.audioContext) return;

    try {
      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

      gainNode.gain.setValueAtTime(power * 0.05 * AUDIO_CONFIG.SOUND_EFFECT_VOLUME, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gainNode);
      if (this.masterGain) {
        gainNode.connect(this.masterGain);
      }

      osc.start();
      osc.stop(now + 0.15);
    } catch (error) {
      console.error('Error playing thud:', error);
    }
  }
}

// Создаем глобальный экземпляр менеджера звука с отложенной инициализацией
// Это предотвращает проблемы с порядком загрузки модулей и циклическими зависимостями
let _soundManager: SoundManager | null = null;

function getSoundManager(): SoundManager {
  if (!_soundManager) {
    _soundManager = new SoundManager();
  }
  return _soundManager;
}

// Экспортируем объект через геттер для предотвращения проблем с инициализацией
export const soundManager = {
  get initAudio() { return getSoundManager().initAudio.bind(getSoundManager()); },
  get playHitSound() { return getSoundManager().playHitSound.bind(getSoundManager()); },
  get playWallHitSound() { return getSoundManager().playWallHitSound.bind(getSoundManager()); },
  get playPocketSound() { return getSoundManager().playPocketSound.bind(getSoundManager()); },
  get playMeowSound() { return getSoundManager().playMeowSound.bind(getSoundManager()); },
  get playPawHit() { return getSoundManager().playPawHit.bind(getSoundManager()); },
  get playCueFall() { return getSoundManager().playCueFall.bind(getSoundManager()); },
  get toggleSound() { return getSoundManager().toggleSound.bind(getSoundManager()); },
  get toggleMusic() { return getSoundManager().toggleMusic.bind(getSoundManager()); },
  get setMusicVolume() { return getSoundManager().setMusicVolume.bind(getSoundManager()); },
  get startBackgroundMusic() { return getSoundManager().startBackgroundMusic.bind(getSoundManager()); },
  get stopBackgroundMusic() { return getSoundManager().stopBackgroundMusic.bind(getSoundManager()); },
  get isSoundEnabled() { return getSoundManager().isSoundEnabled; },
  get isMusicEnabled() { return getSoundManager().isMusicEnabled; },
  get getMusicVolume() { return getSoundManager().getMusicVolume; },
  get getIsMusicPlaying() { return getSoundManager().getIsMusicPlaying; },
};

// Экспортируем функции для обратной совместимости
export const playHitSound = (velocity?: number) => getSoundManager().playHitSound(velocity);
export const playWallHitSound = (velocity?: number) => getSoundManager().playWallHitSound(velocity);
export const playPocketSound = () => getSoundManager().playPocketSound();
export const playMeowSound = () => getSoundManager().playMeowSound();