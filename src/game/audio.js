import { tryVibrate } from './device.js';

const HIT_VOL = 0.15;
const WALL_VOL = 0.15;
const MEOW_VOL = 0.1;

export function createAudioManager(ctx, deviceInfo) {
    const { state, window: win, document: doc } = ctx;

    function initAudio() {
        if (state.audioContext) return;

        try {
            const AudioContextClass =
                win.AudioContext ||
                win.webkitAudioContext ||
                win.mozAudioContext ||
                win.msAudioContext;

            if (!AudioContextClass) {
                console.warn('Web Audio API не поддерживается в этом браузере');
                return;
            }

            state.audioContext = new AudioContextClass();

            if (state.audioContext.state === 'suspended') {
                const resumeAudio = () => {
                    state.audioContext?.resume().finally(() => {
                        doc.removeEventListener('touchstart', resumeAudio);
                        doc.removeEventListener('click', resumeAudio);
                    });
                };

                doc.addEventListener('touchstart', resumeAudio, { once: true });
                doc.addEventListener('click', resumeAudio, { once: true });
            }
        } catch (error) {
            console.warn('Ошибка инициализации Web Audio API:', error);
            state.audioContext = null;
        }
    }

    function createBackgroundMusic() {
        if (!state.audioContext || !state.musicEnabled) return;

        const oscillator1 = state.audioContext.createOscillator();
        const oscillator2 = state.audioContext.createOscillator();
        const gainNode = state.audioContext.createGain();
        const filter = state.audioContext.createBiquadFilter();

        oscillator1.type = 'square';
        oscillator2.type = 'sawtooth';

        gainNode.gain.setValueAtTime(state.musicVolume, state.audioContext.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, state.audioContext.currentTime);
        filter.Q.setValueAtTime(1.5, state.audioContext.currentTime);

        const notes = [
            261.63,
            329.63,
            392,
            523.25,
            392,
            493.88,
            587.33,
            783.99
        ];

        let noteIndex = 0;
        const playNote = () => {
            if (!state.musicEnabled || !state.isMusicPlaying || !state.audioContext) return;

            const note = notes[noteIndex];
            const duration = 0.15;
            const currentTime = state.audioContext.currentTime;

            oscillator1.frequency.setValueAtTime(note, currentTime);
            oscillator2.frequency.setValueAtTime(note * 0.75, currentTime);

            gainNode.gain.cancelScheduledValues(currentTime);
            gainNode.gain.setValueAtTime(state.musicVolume, currentTime);
            gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0005, state.musicVolume * 0.007), currentTime + duration);

            noteIndex = (noteIndex + 1) % notes.length;
        };

        const musicInterval = win.setInterval(playNote, 250);

        oscillator1.connect(filter);
        oscillator2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(state.audioContext.destination);

        oscillator1.start();
        oscillator2.start();

        state.backgroundMusic = {
            oscillator1,
            oscillator2,
            gainNode,
            interval: musicInterval
        };

        playNote();
    }

    function startBackgroundMusic() {
        if (!state.musicEnabled || state.isMusicPlaying) return;
        initAudio();
        if (!state.audioContext) return;
        state.isMusicPlaying = true;
        createBackgroundMusic();
    }

    function stopBackgroundMusic() {
        if (!state.backgroundMusic) return;
        state.isMusicPlaying = false;

        if (state.backgroundMusic.gainNode && state.audioContext) {
            state.backgroundMusic.gainNode.gain.exponentialRampToValueAtTime(
                0.001,
                state.audioContext.currentTime + 0.5
            );
        }

        win.setTimeout(() => {
            state.backgroundMusic?.oscillator1?.stop?.();
            state.backgroundMusic?.oscillator2?.stop?.();
            if (state.backgroundMusic?.interval) win.clearInterval(state.backgroundMusic.interval);
            state.backgroundMusic = null;
        }, 500);
    }

    function playHitSound() {
        if (!state.audioContext || !state.soundEnabled) return;
        try {
            const oscillator = state.audioContext.createOscillator();
            const gainNode = state.audioContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, state.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, state.audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(HIT_VOL, state.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.1);
            oscillator.connect(gainNode);
            gainNode.connect(state.audioContext.destination);
            oscillator.start();
            oscillator.stop(state.audioContext.currentTime + 0.1);
            tryVibrate(ctx, deviceInfo.isTouch ? 50 : 0);
        } catch (error) {
            console.log('Error playing hit sound:', error);
        }
    }

    function playWallHitSound() {
        if (!state.audioContext || !state.soundEnabled) return;
        try {
            const oscillator = state.audioContext.createOscillator();
            const gainNode = state.audioContext.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(150, state.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(80, state.audioContext.currentTime + 0.15);
            gainNode.gain.setValueAtTime(WALL_VOL, state.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.15);
            oscillator.connect(gainNode);
            gainNode.connect(state.audioContext.destination);
            oscillator.start();
            oscillator.stop(state.audioContext.currentTime + 0.15);
            tryVibrate(ctx, deviceInfo.isTouch ? 30 : 0);
        } catch (error) {
            console.log('Error playing wall hit sound:', error);
        }
    }

    function playMeowSound() {
        if (!state.audioContext || !state.soundEnabled) return;
        console.log('playMeowSound called - soundEnabled:', state.soundEnabled, 'audioContext:', Boolean(state.audioContext));
        try {
            const oscillator = state.audioContext.createOscillator();
            const gainNode = state.audioContext.createGain();
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(300, state.audioContext.currentTime);
            oscillator.frequency.linearRampToValueAtTime(800, state.audioContext.currentTime + 0.1);
            oscillator.frequency.linearRampToValueAtTime(400, state.audioContext.currentTime + 0.3);
            gainNode.gain.setValueAtTime(MEOW_VOL, state.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.3);
            oscillator.connect(gainNode);
            gainNode.connect(state.audioContext.destination);
            oscillator.start();
            oscillator.stop(state.audioContext.currentTime + 0.3);
            tryVibrate(ctx, [100, 50, 100]);
        } catch (error) {
            console.log('Error playing meow sound:', error);
        }
    }

    function updateSoundButtons() {
        const soundButton = doc.getElementById('sound-toggle');
        const soundButtonLandscape = doc.getElementById('sound-toggle-landscape');
        if (soundButton) {
            soundButton.textContent = state.soundEnabled ? '🔊' : '🔇';
            soundButton.title = state.soundEnabled ?
                'Отключить звуковые эффекты (мяуканье, удары)' :
                'Включить звуковые эффекты (мяуканье, удары)';
        }
        if (soundButtonLandscape) {
            soundButtonLandscape.textContent = state.soundEnabled ? '🔊' : '🔇';
            soundButtonLandscape.title = state.soundEnabled ?
                'Отключить звуковые эффекты' : 'Включить звуковые эффекты';
        }
    }

    function updateMusicButtons() {
        const musicButton = doc.getElementById('music-toggle');
        const musicButtonLandscape = doc.getElementById('music-toggle-landscape');
        if (musicButton) {
            musicButton.textContent = state.musicEnabled ? '🎵' : '🔇';
            musicButton.title = state.musicEnabled ? 'Отключить фоновую музыку' : 'Включить фоновую музыку';
        }
        if (musicButtonLandscape) {
            musicButtonLandscape.textContent = state.musicEnabled ? '🎵' : '🔇';
            musicButtonLandscape.title = state.musicEnabled ? 'Отключить фоновую музыку' : 'Включить фоновую музыку';
        }
    }

    function syncMusicVolumeInputs(value) {
        const vol = String(value);
        const volumeControl = doc.getElementById('music-volume');
        const volumeControlLandscape = doc.getElementById('music-volume-landscape');
        if (volumeControl && volumeControl.value !== vol) {
            volumeControl.value = vol;
        }
        if (volumeControlLandscape && volumeControlLandscape.value !== vol) {
            volumeControlLandscape.value = vol;
        }
    }

    function toggleSound() {
        state.soundEnabled = !state.soundEnabled;
        updateSoundButtons();
        win.localStorage?.setItem('kitt-cues-sound', String(state.soundEnabled));
    }

    function toggleMusic() {
        state.musicEnabled = !state.musicEnabled;
        updateMusicButtons();
        if (state.musicEnabled) {
            startBackgroundMusic();
        } else {
            stopBackgroundMusic();
        }
        win.localStorage?.setItem('kitt-cues-music', String(state.musicEnabled));
    }

    function setMusicVolumeFromPercent(percent) {
        const clamped = Math.max(0, Math.min(100, Number(percent)));
        state.musicVolume = clamped / 100;
        if (state.backgroundMusic?.gainNode && state.audioContext) {
            state.backgroundMusic.gainNode.gain.setTargetAtTime(
                state.musicVolume,
                state.audioContext.currentTime,
                0.05
            );
        }
        win.localStorage?.setItem('kitt-cues-music-volume', String(clamped));
        syncMusicVolumeInputs(clamped);
    }

    function loadPreferences() {
        const savedSound = win.localStorage?.getItem('kitt-cues-sound');
        if (savedSound !== null) {
            state.soundEnabled = savedSound === 'true';
        }

        const savedMusic = win.localStorage?.getItem('kitt-cues-music');
        if (savedMusic !== null) {
            state.musicEnabled = savedMusic === 'true';
        }

        const savedVolume = win.localStorage?.getItem('kitt-cues-music-volume');
        if (savedVolume !== null && !Number.isNaN(Number(savedVolume))) {
            state.musicVolume = Math.max(0, Math.min(100, Number(savedVolume))) / 100;
        }

        updateSoundButtons();
        updateMusicButtons();
        syncMusicVolumeInputs(Math.round(state.musicVolume * 100));
    }

    return {
        initAudio,
        startBackgroundMusic,
        stopBackgroundMusic,
        playHitSound,
        playWallHitSound,
        playMeowSound,
        toggleSound,
        toggleMusic,
        setMusicVolumeFromPercent,
        loadPreferences
    };
}
