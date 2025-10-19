import { BackgroundMusic } from '../types';
import { AUDIO_CONFIG, MUSIC_NOTES, STORAGE_KEYS } from '../constants';
import { vibrate } from '../utils/device';

export class SoundManager {
  private audioContext: AudioContext | null = null;
  private backgroundMusic: BackgroundMusic | null = null;
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
        
        // Для iOS Safari требуется пользовательское взаимодействие
        if (this.audioContext.state === 'suspended') {
          const resumeAudio = () => {
            this.audioContext?.resume().then(() => {
              console.log('Audio context resumed');
              document.removeEventListener('touchstart', resumeAudio);
              document.removeEventListener('click', resumeAudio);
            });
          };
          document.addEventListener('touchstart', resumeAudio, { once: true });
          document.addEventListener('click', resumeAudio, { once: true });
        }
      } else {
        console.warn('Web Audio API не поддерживается в этом браузере');
      }
    } catch (error) {
      console.warn('Ошибка инициализации Web Audio API:', error);
      this.audioContext = null;
    }
  }

  createBackgroundMusic(): void {
    if (!this.audioContext || !this.musicEnabled) return;

    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    // Настройки для озорного и ритмичного звучания
    oscillator1.type = 'square';
    oscillator2.type = 'sawtooth';

    // Устанавливаем текущую громкость
    gainNode.gain.setValueAtTime(this.musicVolume, this.audioContext.currentTime);

    // Фильтр для более яркого звука
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, this.audioContext.currentTime);
    filter.Q.setValueAtTime(1.5, this.audioContext.currentTime);

    // Веселая и озорная мелодия в стиле арпеджио
    const notes = [
      MUSIC_NOTES.C4, MUSIC_NOTES.E4, MUSIC_NOTES.G4, MUSIC_NOTES.C5,
      MUSIC_NOTES.G4, MUSIC_NOTES.B4, MUSIC_NOTES.D5, MUSIC_NOTES.G5,
    ];

    let noteIndex = 0;
    const playNote = () => {
      if (!this.musicEnabled || !this.isMusicPlaying || !this.audioContext) return;

      const note = notes[noteIndex];
      const duration = 0.15;
      const currentTime = this.audioContext.currentTime;

      oscillator1.frequency.setValueAtTime(note, currentTime);
      oscillator2.frequency.setValueAtTime(note * 0.75, currentTime);

      gainNode.gain.cancelScheduledValues(currentTime);
      gainNode.gain.setValueAtTime(this.musicVolume, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        Math.max(0.0005, this.musicVolume * 0.007), 
        currentTime + duration
      );

      noteIndex = (noteIndex + 1) % notes.length;
    };

    const musicInterval = setInterval(playNote, 250);

    oscillator1.connect(filter);
    oscillator2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator1.start();
    oscillator2.start();

    this.backgroundMusic = {
      oscillator1,
      oscillator2,
      gainNode,
      interval: musicInterval
    };

    playNote();
  }

  startBackgroundMusic(): void {
    if (!this.musicEnabled || this.isMusicPlaying || !this.audioContext) return;
    
    this.isMusicPlaying = true;
    this.createBackgroundMusic();
  }

  stopBackgroundMusic(): void {
    if (!this.backgroundMusic) return;
    
    this.isMusicPlaying = false;
    
    // Плавно уменьшаем громкость
    if (this.backgroundMusic.gainNode && this.audioContext) {
      this.backgroundMusic.gainNode.gain.exponentialRampToValueAtTime(
        0.001, 
        this.audioContext.currentTime + 0.5
      );
    }
    
    // Останавливаем осцилляторы через полсекунды
    setTimeout(() => {
      if (this.backgroundMusic) {
        this.backgroundMusic.oscillator1.stop();
        this.backgroundMusic.oscillator2.stop();
        clearInterval(this.backgroundMusic.interval);
        this.backgroundMusic = null;
      }
    }, 500);
  }

  playHitSound(): void {
    if (!this.audioContext || !this.soundEnabled) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(AUDIO_CONFIG.SOUND_EFFECT_VOLUME, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      vibrate(AUDIO_CONFIG.VIBRATION_DURATION.HIT);
    } catch (error) {
      console.log('Error playing hit sound:', error);
    }
  }

  playWallHitSound(): void {
    if (!this.audioContext || !this.soundEnabled) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(AUDIO_CONFIG.SOUND_EFFECT_VOLUME, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
      
      vibrate(AUDIO_CONFIG.VIBRATION_DURATION.WALL_HIT);
    } catch (error) {
      console.log('Error playing wall hit sound:', error);
    }
  }

  playMeowSound(): void {
    console.log('playMeowSound called - soundEnabled:', this.soundEnabled, 'audioContext:', !!this.audioContext);
    
    if (!this.audioContext || !this.soundEnabled) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(800, this.audioContext.currentTime + 0.1);
      oscillator.frequency.linearRampToValueAtTime(400, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      vibrate(AUDIO_CONFIG.VIBRATION_DURATION.MEOW);
    } catch (error) {
      console.log('Error playing meow sound:', error);
    }
  }

  toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
    console.log('Sound toggled - soundEnabled is now:', this.soundEnabled);
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
}

// Создаем глобальный экземпляр менеджера звука
export const soundManager = new SoundManager();

// Экспортируем функции для обратной совместимости
export const playHitSound = () => soundManager.playHitSound();
export const playWallHitSound = () => soundManager.playWallHitSound();
export const playMeowSound = () => soundManager.playMeowSound();