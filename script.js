document.addEventListener('DOMContentLoaded', () => {
    const gameArea = document.getElementById('game-area');
    const table = document.getElementById('billiard-table');
    const cue = document.getElementById('cue');
    const aimLine = document.getElementById('aim-line');
    const powerIndicator = document.getElementById('power-indicator');
    const powerFill = document.getElementById('power-fill');
    const ballElements = document.querySelectorAll('.billiard-ball');
    const pyramidContainer = document.getElementById('ball-pyramid');
    
    const FRICTION = 0.985;
    const MIN_VELOCITY = 0.05;
    const HIT_POWER = 15;
    const PAW_HIT_POWER = 8;
    const CAT_COOLDOWN = 60; // 1 секунда (60 кадров)

    let balls = [];
    let cats = [];
    let pockets = [];
    let score = 0;
    let animationFrameId;
    let cueAngle = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let audioContext;
    let soundEnabled = true;
    let musicEnabled = true;
    let backgroundMusic = null;
    let isMusicPlaying = false;
    let isMobile = window.innerWidth <= 640;
    let isPortrait = window.innerHeight > window.innerWidth;

    // --- Определение ориентации и управление уведомлением ---
    function checkOrientation() {
        isMobile = window.innerWidth <= 640;
        isPortrait = window.innerHeight > window.innerWidth;
        const rotationNotice = document.getElementById('rotation-notice');
        
        if (isMobile && isPortrait) {
            // Показываем уведомление о повороте
            if (rotationNotice) {
                rotationNotice.style.display = 'flex';
            }
        } else {
            // Скрываем уведомление
            if (rotationNotice) {
                rotationNotice.style.display = 'none';
            }
        }
    }

    // Обработчик изменения ориентации
    function handleOrientationChange() {
        // Небольшая задержка для корректного определения размеров
        setTimeout(checkOrientation, 100);
    }

    // Обработчик изменения размера окна
    function handleResize() {
        checkOrientation();
        
        // Динамическое масштабирование элементов
        const gameArea = document.getElementById('game-area');
        const table = document.getElementById('billiard-table');
        const tableContainer = document.getElementById('billiard-table-container');
        
        if (gameArea && table && tableContainer) {
            const gameAreaStyle = window.getComputedStyle(gameArea);
            const paddingLeft = parseFloat(gameAreaStyle.paddingLeft);
            const paddingRight = parseFloat(gameAreaStyle.paddingRight);
            const paddingTop = parseFloat(gameAreaStyle.paddingTop);
            const paddingBottom = parseFloat(gameAreaStyle.paddingBottom);
            
            const gameAreaRect = gameArea.getBoundingClientRect();
            const availableWidth = gameAreaRect.width - paddingLeft - paddingRight;
            const availableHeight = gameAreaRect.height - paddingTop - paddingBottom;
            
            // Рассчитываем оптимальный размер стола
            const aspectRatio = 1.5; // Соотношение сторон бильярдного стола (1.5:1)
            let tableWidth, tableHeight;
            
            if (availableWidth / availableHeight > aspectRatio) {
                // Высота ограничивает
                tableHeight = availableHeight;
                tableWidth = tableHeight * aspectRatio;
            } else {
                // Ширина ограничивает
                tableWidth = availableWidth;
                tableHeight = tableWidth / aspectRatio;
            }
            
            // Устанавливаем размеры контейнера немного больше стола для создания бортов
            const borderWidth = 20; // Ширина бортов
            const containerWidth = tableWidth + borderWidth * 2;
            const containerHeight = tableHeight + borderWidth * 2;
            
            // Позиционируем контейнер стола по центру игровой области
            tableContainer.style.width = `${containerWidth}px`;
            tableContainer.style.height = `${containerHeight}px`;
            tableContainer.style.left = `${paddingLeft + (availableWidth - containerWidth) / 2}px`;
            tableContainer.style.top = `${paddingTop + (availableHeight - containerHeight) / 2}px`;
            
            // Позиционируем стол внутри контейнера с отступом для бортов
            table.style.width = `${tableWidth}px`;
            table.style.height = `${tableHeight}px`;
            table.style.left = `${borderWidth}px`;
            table.style.top = `${borderWidth}px`;
            
            // Динамическое масштабирование элементов пропорционально размеру стола
            applyDynamicScaling(tableWidth, tableHeight);
        }
        
        // Переинициализируем элементы при изменении размера
        if (typeof initCats === 'function') initCats();
        if (typeof initPockets === 'function') initPockets();
        if (typeof initBalls === 'function') initBalls();
        
        // Позиционируем UI элементы за пределами стола после обновления размеров
        setTimeout(() => {
            positionUIElements();
        }, 50);
    }

    // Функция для динамического масштабирования элементов
    function applyDynamicScaling(tableWidth, tableHeight) {
        // Базовые размеры стола для расчёта масштаба
        const baseTableWidth = 600;
        const baseTableHeight = 400;
        
        // Рассчитываем коэффициент масштабирования
        const scaleFactorX = tableWidth / baseTableWidth;
        const scaleFactorY = tableHeight / baseTableHeight;
        const scaleFactor = Math.min(scaleFactorX, scaleFactorY);
        
        // Применяем масштабирование к котам
        const cats = document.querySelectorAll('.cat-container');
        cats.forEach(cat => {
            let baseScale = 1.0;
            
            // Учитываем медиа-запросы для базового масштаба
            if (window.innerWidth <= 280) {
                baseScale = 0.1;
            } else if (window.innerWidth <= 320) {
                baseScale = 0.15;
            } else if (window.innerWidth <= 375) {
                baseScale = 0.2;
            } else if (window.innerWidth <= 640) {
                baseScale = 0.3;
            } else if (window.innerWidth <= 1024) {
                baseScale = 1.1;
            }
            
            // Применяем дополнительное масштабирование на основе размера стола
            const finalScale = baseScale * scaleFactor;
            cat.style.transform = `scale(${Math.max(0.05, finalScale)})`;
        });
        
        // Применяем масштабирование к шарам
        const balls = document.querySelectorAll('.billiard-ball');
        balls.forEach(ball => {
            let baseSize = 16;
            
            // Учитываем медиа-запросы для базового размера
            if (window.innerWidth <= 280) {
                baseSize = 4;
            } else if (window.innerWidth <= 320) {
                baseSize = 5;
            } else if (window.innerWidth <= 375) {
                baseSize = 6;
            } else if (window.innerWidth <= 640) {
                baseSize = 10;
            }
            
            const finalSize = Math.max(3, baseSize * scaleFactor);
            ball.style.width = `${finalSize}px`;
            ball.style.height = `${finalSize}px`;
        });
        
        // Применяем масштабирование к лузам
        const pockets = document.querySelectorAll('[data-pocket]');
        pockets.forEach(pocket => {
            let baseSize = 32; // Увеличили ещё больше (было 24px)
            
            // Учитываем медиа-запросы для базового размера, делаем лузы ещё крупнее
            if (window.innerWidth <= 280) {
                baseSize = 12; // Увеличили с 8px до 12px
            } else if (window.innerWidth <= 320) {
                baseSize = 14; // Увеличили с 10px до 14px
            } else if (window.innerWidth <= 375) {
                baseSize = 16; // Увеличили с 12px до 16px
            } else if (window.innerWidth <= 640) {
                baseSize = 20; // Увеличили с 16px до 20px
            }
            
            // Применяем менее агрессивное масштабирование для луз
            const pocketScaleFactor = Math.max(0.8, scaleFactor); // Увеличили минимум с 70% до 80%
            const finalSize = Math.max(8, baseSize * pocketScaleFactor); // Увеличили минимум с 6px до 8px
            pocket.style.width = `${finalSize}px`;
            pocket.style.height = `${finalSize}px`;
        });
        
        // Применяем масштабирование к кию
        const cue = document.getElementById('cue');
        if (cue) {
            let baseHeight = 8;
            let baseWidth = 40;
            
            // Учитываем медиа-запросы для базовых размеров кия
            if (window.innerWidth <= 280) {
                baseHeight = 1;
                baseWidth = 10;
            } else if (window.innerWidth <= 320) {
                baseHeight = 1;
                baseWidth = 15;
            } else if (window.innerWidth <= 375) {
                baseHeight = 1;
                baseWidth = 20;
            } else if (window.innerWidth <= 640) {
                baseHeight = 1;
                baseWidth = 25;
            }
            
            const finalHeight = Math.max(1, baseHeight * scaleFactor);
            const finalWidth = Math.max(5, baseWidth);
            
            cue.style.height = `${finalHeight}px`;
            cue.style.width = `${finalWidth}%`;
        }
        
        // Применяем масштабирование к кнопкам интерфейса
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            let baseFontSize = 16;
            let basePaddingX = 16;
            let basePaddingY = 8;
            let baseMinWidth = 40;
            let baseMinHeight = 40;
            
            // Учитываем медиа-запросы для базовых размеров кнопок
            if (window.innerWidth <= 320) {
                baseFontSize = 8;
                basePaddingX = 4;
                basePaddingY = 2;
                baseMinWidth = 12;
                baseMinHeight = 12;
            } else if (window.innerWidth <= 375) {
                baseFontSize = 10;
                basePaddingX = 6;
                basePaddingY = 3;
                baseMinWidth = 16;
                baseMinHeight = 16;
            } else if (window.innerWidth <= 640) {
                baseFontSize = 12;
                basePaddingX = 8;
                basePaddingY = 4;
                baseMinWidth = 20;
                baseMinHeight = 20;
            }
            
            const finalFontSize = Math.max(6, baseFontSize * scaleFactor);
            const finalPaddingX = Math.max(2, basePaddingX * scaleFactor);
            const finalPaddingY = Math.max(1, basePaddingY * scaleFactor);
            const finalMinWidth = Math.max(10, baseMinWidth * scaleFactor);
            const finalMinHeight = Math.max(10, baseMinHeight * scaleFactor);
            
            // Применяем только если кнопка не является ландшафтной мобильной
            if (!button.closest('.landscape-mobile-controls')) {
                button.style.fontSize = `${finalFontSize}px`;
                button.style.padding = `${finalPaddingY}px ${finalPaddingX}px`;
                button.style.minWidth = `${finalMinWidth}px`;
                button.style.minHeight = `${finalMinHeight}px`;
            }
        });
        
        // Применяем масштабирование к ландшафтным мобильным кнопкам отдельно
        const landscapeButtons = document.querySelectorAll('.landscape-mobile-controls button');
        landscapeButtons.forEach(button => {
            let baseFontSize = 10;
            let basePaddingX = 4;
            let basePaddingY = 2;
            let baseMinWidth = 16;
            let baseMinHeight = 16;
            
            // Дополнительные корректировки для очень маленьких экранов
            if (window.innerWidth <= 320) {
                baseFontSize = 6;
                basePaddingX = 2;
                basePaddingY = 1;
                baseMinWidth = 10;
                baseMinHeight = 10;
            }
            
            const finalFontSize = Math.max(4, baseFontSize * scaleFactor);
            const finalPaddingX = Math.max(1, basePaddingX * scaleFactor);
            const finalPaddingY = Math.max(1, basePaddingY * scaleFactor);
            const finalMinWidth = Math.max(8, baseMinWidth * scaleFactor);
            const finalMinHeight = Math.max(8, baseMinHeight * scaleFactor);
            
            button.style.fontSize = `${finalFontSize}px`;
            button.style.padding = `${finalPaddingY}px ${finalPaddingX}px`;
            button.style.minWidth = `${finalMinWidth}px`;
            button.style.minHeight = `${finalMinHeight}px`;
        });
        
        // Применяем масштабирование к счету
        const scoreElements = [
            { selector: '#score-display', element: document.querySelector('#score-display') },
            { selector: '#score-display-landscape', element: document.querySelector('#score-display-landscape') }
        ];
        
        scoreElements.forEach(({ selector, element }) => {
            if (element) {
                let baseFontSize = 18;
                let basePaddingX = 32;
                let basePaddingY = 16;
                
                // Учитываем медиа-запросы для базовых размеров счета
                if (window.innerWidth <= 320) {
                    baseFontSize = 8;
                    basePaddingX = 8;
                    basePaddingY = 4;
                } else if (window.innerWidth <= 375) {
                    baseFontSize = 10;
                    basePaddingX = 12;
                    basePaddingY = 6;
                } else if (window.innerWidth <= 640) {
                    baseFontSize = 14;
                    basePaddingX = 16;
                    basePaddingY = 8;
                } else if (selector.includes('landscape')) {
                    // Для ландшафтного счета базовые размеры меньше
                    baseFontSize = 12;
                    basePaddingX = 12;
                    basePaddingY = 4;
                }
                
                const finalFontSize = Math.max(8, baseFontSize * scaleFactor);
                const finalPaddingX = Math.max(4, basePaddingX * scaleFactor);
                const finalPaddingY = Math.max(2, basePaddingY * scaleFactor);
                
                element.style.fontSize = `${finalFontSize}px`;
                element.style.padding = `${finalPaddingY}px ${finalPaddingX}px`;
                
                // Также масштабируем минимальную ширину если она задана
                if (selector === '#score-display') {
                    const baseMinWidth = 80;
                    const finalMinWidth = Math.max(40, baseMinWidth * scaleFactor);
                    element.style.minWidth = `${finalMinWidth}px`;
                }
            }
        });
    }

    // --- Позиционирование UI элементов ---
    function positionUIElements() {
        const gameArea = document.getElementById('game-area');
        const tableContainer = document.getElementById('billiard-table-container');
        
        if (!gameArea || !tableContainer) return;
        
        const gameAreaRect = gameArea.getBoundingClientRect();
        const tableRect = tableContainer.getBoundingClientRect();
        
        // Вычисляем масштабный коэффициент на основе размера стола
        const baseTableWidth = 600; // Базовый размер стола для расчета масштаба
        const scaleFactor = Math.min(tableRect.width / baseTableWidth, 1.5); // Ограничиваем масштаб
        const margin = Math.max(10, 20 * scaleFactor); // Адаптивный отступ

        // Левые кнопки за пределами стола (только для больших экранов)
        const soundToggle = document.querySelector('#sound-toggle');
        if (soundToggle && soundToggle.parentElement) {
            const leftButtons = soundToggle.parentElement;
            const leftX = tableRect.left - gameAreaRect.left - leftButtons.offsetWidth - margin;
            leftButtons.style.left = `${Math.max(10, leftX)}px`;
            leftButtons.style.right = 'auto';
        }

        // Calculate a common left offset for the right-side elements
        const tableRightEdge = (gameAreaRect.width - tableContainer.offsetWidth) / 2 + tableContainer.offsetWidth;
        const commonLeftOffset = tableRightEdge + margin;

        // Правые кнопки
        const resetButton = document.querySelector('#reset-button');
        if (resetButton && resetButton.parentElement) {
            const rightButton = resetButton.parentElement;
            rightButton.style.left = `${commonLeftOffset}px`;
            rightButton.style.right = 'auto';

            // Счет в правом верхнем углу
            const scoreDisplay = document.querySelector('#score-display');
            if (scoreDisplay && scoreDisplay.parentElement) {
                const topRightScore = scoreDisplay.parentElement;
                const topY = tableRect.top - gameAreaRect.top - topRightScore.offsetHeight - margin;

                // Position top
                topRightScore.style.top = `${Math.max(10, topY)}px`; // Ensure it's not too close to the top edge

                // Position left to align with reset button
                topRightScore.style.left = `${commonLeftOffset}px`;
                topRightScore.style.right = 'auto';
                
                topRightScore.style.bottom = 'auto';
            }
        }
        
        // Мобильные элементы в ландшафтной ориентации
        const soundToggleLandscape = document.querySelector('#sound-toggle-landscape');
        if (soundToggleLandscape && soundToggleLandscape.parentElement) {
            const mobileButtons = soundToggleLandscape.parentElement;
            const topY = tableRect.top - gameAreaRect.top - mobileButtons.offsetHeight - margin;
            mobileButtons.style.top = `${Math.max(10, topY)}px`;
            mobileButtons.style.bottom = 'auto';
        }
        
        const scoreDisplayLandscape = document.querySelector('#score-display-landscape');
        if (scoreDisplayLandscape && scoreDisplayLandscape.parentElement) {
            const mobileScore = scoreDisplayLandscape.parentElement;
            const topY = tableRect.top - gameAreaRect.top - mobileScore.offsetHeight - margin;
            mobileScore.style.top = `${Math.max(10, topY)}px`;
            mobileScore.style.bottom = 'auto';
        }
    }

    // --- Звуковой движок ---
    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function createBackgroundMusic() {
        if (!audioContext || !musicEnabled) return;

        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        // Настройки для озорного и ритмичного звучания
        oscillator1.type = 'square'; // Более резкий, "игровой" звук
        oscillator2.type = 'sawtooth'; // Добавляет яркости

        // Увеличиваем громкость до 45%
        gainNode.gain.setValueAtTime(0.45, audioContext.currentTime);

        // Фильтр для более яркого звука
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, audioContext.currentTime);
        filter.Q.setValueAtTime(1.5, audioContext.currentTime);

        // Веселая и озорная мелодия в стиле арпеджио
        const notes = [
            // C major arpeggio
            261.63, // C4
            329.63, // E4
            392.00, // G4
            523.25, // C5
            // G major arpeggio
            392.00, // G4
            493.88, // B4
            587.33, // D5
            783.99, // G5
        ];

        let noteIndex = 0;
        const playNote = () => {
            if (!musicEnabled || !isMusicPlaying) return;

            const note = notes[noteIndex];
            const duration = 0.15; // Короткая длительность ноты
            const currentTime = audioContext.currentTime;

            // Основная нота
            oscillator1.frequency.setValueAtTime(note, currentTime);
            // Гармония на квинту ниже
            oscillator2.frequency.setValueAtTime(note * 0.75, currentTime);

            // Короткая атака и затухание для "острого" звука
            gainNode.gain.cancelScheduledValues(currentTime);
            gainNode.gain.setValueAtTime(0.45, currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);

            noteIndex = (noteIndex + 1) % notes.length;
        };

        // Воспроизводим ноту каждые 250 мс (быстрый темп)
        const musicInterval = setInterval(playNote, 250);

        oscillator1.connect(filter);
        oscillator2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator1.start();
        oscillator2.start();

        backgroundMusic = {
            oscillator1,
            oscillator2,
            gainNode,
            interval: musicInterval
        };

        playNote();
    }

    function startBackgroundMusic() {
        if (!musicEnabled || isMusicPlaying || !audioContext) return;
        
        isMusicPlaying = true;
        createBackgroundMusic();
    }

    function stopBackgroundMusic() {
        if (!backgroundMusic) return;
        
        isMusicPlaying = false;
        
        // Плавно уменьшаем громкость
        if (backgroundMusic.gainNode) {
            backgroundMusic.gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
        }
        
        // Останавливаем осцилляторы через полсекунды
        setTimeout(() => {
            if (backgroundMusic.oscillator1) backgroundMusic.oscillator1.stop();
            if (backgroundMusic.oscillator2) backgroundMusic.oscillator2.stop();
            if (backgroundMusic.interval) clearInterval(backgroundMusic.interval);
            backgroundMusic = null;
        }, 500);
    }

    function playHitSound() {
        if (!audioContext || !soundEnabled) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    function playWallHitSound() {
        if (!audioContext || !soundEnabled) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
    }

    function playMeowSound() {
        // Добавляем диагностику для отладки
        console.log('playMeowSound called - soundEnabled:', soundEnabled, 'audioContext:', !!audioContext);
        
        if (!audioContext || !soundEnabled) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }
    // --- Инициализация ---
    function initCats() {
        cats = [];
        const catElements = document.querySelectorAll('.cat-container');
        const tableRect = table.getBoundingClientRect();

        catElements.forEach(el => {
            const catRect = el.getBoundingClientRect();
            const catCenterX = (catRect.left - tableRect.left) + catRect.width / 2;
            const catCenterY = (catRect.top - tableRect.top) + catRect.height / 2;
            
                            // Увеличиваем радиус для маленького кота для лучшего взаимодействия
                            let radius = Math.max(catRect.width, catRect.height) / 2;
                            if (el.classList.contains('cat-small')) {
                                radius = Math.max(catRect.width, catRect.height) / 2; // Значительно больший радиус для маленького кота
                            }            cats.push({
                el: el,
                pawEl: el.querySelector('.hitting-paw'),
                x: catCenterX,
                y: catCenterY,
                radius: radius,
                cooldown: 0
            });
        });
    }

    function initPockets() {
        pockets = [];
        const pocketElements = document.querySelectorAll('[data-pocket]');
        const tableRect = table.getBoundingClientRect();
        pocketElements.forEach((el, index) => {
            const pocketRect = el.getBoundingClientRect();
            const pocketX = (pocketRect.left - tableRect.left) + pocketRect.width / 2;
            const pocketY = (pocketRect.top - tableRect.top) + pocketRect.height / 2;
            
            // Динамически рассчитываем радиус лузы на основе её текущего размера
            const pocketSize = Math.max(el.offsetWidth, el.offsetHeight);
            const pocketRadius = Math.max(15, pocketSize * 1.4); // Увеличили с 12px до 15px минимум, с 1.2 до 1.4 коэффициент
            
            pockets.push({
                x: pocketX,
                y: pocketY,
                radius: pocketRadius
            });
        });
    }

    function initBalls() {
        balls = [];
        pyramidContainer.style.display = 'block';
        ballElements.forEach(el => {
            el.style.transform = '';
            el.style.display = 'block'; // Ensure visibility
            const tableRect = table.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const posX = (elRect.left - tableRect.left) + elRect.width / 2;
            const posY = (elRect.top - tableRect.top) + elRect.height / 2;
            balls.push({
                el: el,
                x: posX,
                y: posY,
                vx: 0,
                vy: 0,
                radius: el.offsetWidth / 2,
                sunk: false
            });
            // Move ball to table directly for visibility
            table.appendChild(el);
            el.style.position = 'absolute';
            el.style.left = '0';
            el.style.top = '0';
            el.style.removeProperty('top');
            el.style.removeProperty('left');
            el.style.removeProperty('transform');
        });
        // Empty pyramid container
        pyramidContainer.innerHTML = '';
        pyramidContainer.style.display = 'none';
        render();
    }

    // --- Физика и игровой цикл ---
    function updatePhysics() {
        cats.forEach(cat => {
            if (cat.cooldown > 0) cat.cooldown--;
        });

        balls.forEach(ball => {
            if (ball.sunk) return;

            if (Math.abs(ball.vx) < MIN_VELOCITY) ball.vx = 0;
            if (Math.abs(ball.vy) < MIN_VELOCITY) ball.vy = 0;
            if (ball.vx === 0 && ball.vy === 0) return;

            ball.vx *= FRICTION;
            ball.vy *= FRICTION;
            ball.x += ball.vx;
            ball.y += ball.vy;

            // Проверка на попадание в лузы (перед другими столкновениями)
            pockets.forEach(pocket => {
                const dx = ball.x - pocket.x;
                const dy = ball.y - pocket.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < pocket.radius && !ball.sunk) {
                    ball.sunk = true;
                    ball.vx = 0;
                    ball.vy = 0;
                    ball.el.style.display = 'none';
                    
                    if (ball.el.id !== 'cue-ball') {
                        score++;
                        const scoreDisplay = document.getElementById('score-display');
                        const scoreDisplayLandscape = document.getElementById('score-display-landscape');
                        
                        if (scoreDisplay) {
                            scoreDisplay.textContent = `Счет: ${score}`;
                        }
                        
                        if (scoreDisplayLandscape) {
                            scoreDisplayLandscape.textContent = `Счет: ${score}`;
                        }
                        
                        playHitSound(); // Sound for sinking
                    } else {
                        // Если биток утонул, вернуть на стартовую позицию после остановки
                        setTimeout(() => {
                            ball.x = table.offsetWidth * 0.25;
                            ball.y = table.offsetHeight * 0.5;
                            ball.vx = 0;
                            ball.vy = 0;
                            ball.sunk = false;
                            ball.el.style.display = 'block';
                            render();
                        }, 1000);
                    }
                    return; // Выходим из обработки этого шара если он утонул
                }
            });

            // Если шар утонул, не обрабатываем дальнейшие столкновения
            if (ball.sunk) return;

            // Столкновения со стенами
            if ((ball.x - ball.radius < 0 && ball.vx < 0) || (ball.x + ball.radius > table.offsetWidth && ball.vx > 0)) {
                ball.vx *= -1;
                playWallHitSound();
                if (ball.x - ball.radius < 0) ball.x = ball.radius;
                if (ball.x + ball.radius > table.offsetWidth) ball.x = table.offsetWidth - ball.radius;
            }
            if ((ball.y - ball.radius < 0 && ball.vy < 0) || (ball.y + ball.radius > table.offsetHeight && ball.vy > 0)) {
                ball.vy *= -1;
                playWallHitSound();
                if (ball.y - ball.radius < 0) ball.y = ball.radius;
                if (ball.y + ball.radius > table.offsetHeight) ball.y = table.offsetHeight - ball.radius;
            }

            // Столкновения с кошками
            cats.forEach(cat => {
                if (cat.cooldown > 0 || ball.sunk) return;
                const dx = ball.x - cat.x;
                const dy = ball.y - cat.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ball.radius + cat.radius) {
                    playMeowSound(); // Используем уже определенную функцию вместо playPawSound
                    cat.cooldown = CAT_COOLDOWN;
                    
                    // Для маленького кота анимируем весь элемент, для остальных - только лапку
                    if (cat.el.classList.contains('cat-small')) {
                        cat.el.classList.add('swat-animation');
                        setTimeout(() => {
                            cat.el.classList.remove('swat-animation');
                        }, 500); // Увеличиваем время для новой анимации
                    } else {
                        const pawElement = cat.pawEl || cat.el;
                        pawElement.classList.add('swat-animation');
                        setTimeout(() => {
                            pawElement.classList.remove('swat-animation');
                        }, 300);
                    }

                    const angle = Math.atan2(dy, dx);
                    ball.vx = Math.cos(angle) * PAW_HIT_POWER;
                    ball.vy = Math.sin(angle) * PAW_HIT_POWER;

                    // Anti-sticking: move ball out of cat's radius
                    const overlap = (ball.radius + cat.radius) - distance + 1;
                    ball.x += Math.cos(angle) * overlap;
                    ball.y += Math.sin(angle) * overlap;
                }
            });
        });

        // Столкновения шаров (только с не утонувшими)
        for (let i = 0; i < balls.length; i++) {
            if (balls[i].sunk) continue;
            for (let j = i + 1; j < balls.length; j++) {
                if (balls[j].sunk) continue;
                const ball1 = balls[i];
                const ball2 = balls[j];
                const dx = ball2.x - ball1.x;
                const dy = ball2.y - ball1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ball1.radius + ball2.radius) {
                    const angle = Math.atan2(dy, dx);
                    const sin = Math.sin(angle);
                    const cos = Math.cos(angle);

                    let vx1 = ball1.vx * cos + ball1.vy * sin;
                    let vy1 = ball1.vy * cos - ball1.vx * sin;
                    let vx2 = ball2.vx * cos + ball2.vy * sin;
                    let vy2 = ball2.vy * cos - ball2.vx * sin;

                    const tempVx = vx1;
                    vx1 = vx2;
                    vx2 = tempVx;

                    ball1.vx = vx1 * cos - vy1 * sin;
                    ball1.vy = vy1 * cos + vx1 * sin;
                    ball2.vx = vx2 * cos - vy2 * sin;
                    ball2.vy = vy2 * cos + vx2 * sin;

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
        }
    }

    function render() {
        balls.forEach(ball => {
            if (!ball.sunk) {
                ball.el.style.transform = `translate(${ball.x - ball.radius}px, ${ball.y - ball.radius}px)`;
                ball.el.style.left = '0px';
                ball.el.style.top = '0px';
            }
        });
    }

    function gameLoop() {
        updatePhysics();
        render();
        const allStopped = balls.every(b => b.sunk || (b.vx === 0 && b.vy === 0));
        if (allStopped) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        } else {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }

    // --- Управление ---
    function aimCue(e) {
        const cueBallObj = balls.find(b => b.el.id === 'cue-ball');
        if (!cueBallObj || !e) return;
        const tableRect = table.getBoundingClientRect();
        // Поддержка как мыши, так и сенсорного ввода
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        if (clientX === undefined || clientY === undefined) return;
        
        let mouseX = clientX - tableRect.left;
        let mouseY = clientY - tableRect.top;

        // Ограничиваем позицию курсора границами зеленого поля
        const padding = 20; // Отступ от края зеленого поля
        mouseX = Math.max(padding, Math.min(table.offsetWidth - padding, mouseX));
        mouseY = Math.max(padding, Math.min(table.offsetHeight - padding, mouseY));

        // Угол от курсора мыши к битку
        const dx = cueBallObj.x - mouseX;
        const dy = cueBallObj.y - mouseY;
        const angle = Math.atan2(dy, dx);
        cueAngle = angle; // Это будет направление удара

        const degrees = angle * (180 / Math.PI);

        // Позиционируем кий так, чтобы его кончик (правый край) был у курсора
        const cueX = mouseX - cue.offsetWidth;
        const cueY = mouseY - cue.offsetHeight / 2;
        
        cue.style.transformOrigin = `right center`;
        cue.style.left = `${cueX}px`;
        cue.style.top = `${cueY}px`;
        cue.style.transform = `rotate(${degrees}deg)`;

        // Показываем линию прицеливания
        updateAimLine(cueBallObj.x, cueBallObj.y, angle);
    }

    function updateAimLine(startX, startY, angle) {
        if (!aimLine) return;
        
        const lineLength = 150; // Длина линии прицеливания
        const endX = startX + Math.cos(angle) * lineLength;
        const endY = startY + Math.sin(angle) * lineLength;
        
        // Позиционируем линию от битка в направлении удара
        aimLine.style.left = `${startX}px`;
        aimLine.style.top = `${startY - 1}px`;
        aimLine.style.width = `${lineLength}px`;
        aimLine.style.transform = `rotate(${angle * (180 / Math.PI)}deg)`;
        aimLine.style.transformOrigin = 'left center';
        
        // Показываем линию только при перетаскивании
        if (isDragging) {
            aimLine.classList.add('visible');
        }
    }

    function updatePowerIndicator(power) {
        if (!powerIndicator || !powerFill) return;
        
        const maxPower = 25;
        const powerPercent = Math.min((power / maxPower) * 100, 100);
        
        powerFill.style.width = `${powerPercent}%`;
        
        // Показываем индикатор только при перетаскивании
        if (isDragging && power > 0) {
            powerIndicator.classList.add('visible');
            
            // Позиционируем индикатор рядом с битком
            const cueBallObj = balls.find(b => b.el.id === 'cue-ball');
            if (cueBallObj) {
                powerIndicator.style.left = `${cueBallObj.x - 50}px`;
                powerIndicator.style.top = `${cueBallObj.y - 30}px`;
            }
        }
    }

    function startDrag(e) {
        if (animationFrameId) return;
        
        // Проверяем, не кликнули ли по кнопке
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            return;
        }
        
        isDragging = true;
        const tableRect = table.getBoundingClientRect();
        
        // Поддержка как мыши, так и сенсорного ввода
        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        if (clientX !== undefined && clientY !== undefined) {
            dragStartX = clientX - tableRect.left;
            dragStartY = clientY - tableRect.top;
            aimCue(e);
            
            // Показываем визуальные помощники
            if (aimLine) aimLine.classList.add('visible');
            if (powerIndicator) powerIndicator.classList.add('visible');
        }
    }

    function endDrag(e) {
        if (!isDragging || animationFrameId) return;
        
        // Проверяем, не кликнули ли по кнопке
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            isDragging = false;
            hideVisualHelpers();
            return;
        }
        
        isDragging = false;
        const tableRect = table.getBoundingClientRect();
        
        // Поддержка как мыши, так и сенсорного ввода
        let clientX, clientY;
        if (e && e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e && e.changedTouches && e.changedTouches.length > 0) {
            // Для touchend используем changedTouches
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else if (e) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else {
            // Если событие не передано, используем последние известные координаты
            clientX = dragStartX + tableRect.left;
            clientY = dragStartY + tableRect.top;
        }
        
        const dragEndX = clientX - tableRect.left;
        const dragEndY = clientY - tableRect.top;
        const dragDistance = Math.sqrt((dragEndX - dragStartX)**2 + (dragEndY - dragStartY)**2);
        let power = Math.min(dragDistance / 10, 25); // Max power 25
        if (dragDistance < 10) power = HIT_POWER; // Min power for clicks/taps
        
        // Скрываем визуальные помощники
        hideVisualHelpers();
        
        hitBall(power);
    }

    function hideVisualHelpers() {
        if (aimLine) aimLine.classList.remove('visible');
        if (powerIndicator) powerIndicator.classList.remove('visible');
    }

    function hitBall(power = HIT_POWER) {
        initAudio();
        // Не бить, если шары уже движутся
        if (animationFrameId) return;
        const cueBallObj = balls.find(b => b.el.id === 'cue-ball');
        if (!cueBallObj) return;

        playHitSound();

        // Вибрация на сенсорных устройствах (если поддерживается)
        if (navigator.vibrate && isMobile) {
            const vibrationIntensity = Math.min(power * 2, 30); // Интенсивность вибрации зависит от силы
            navigator.vibrate(vibrationIntensity);
        }

        // Придаем скорость битку с учетом силы
        cueBallObj.vx = Math.cos(cueAngle) * power;
        cueBallObj.vy = Math.sin(cueAngle) * power;
        
        // Анимация удара (откат пропорционален силе)
        const degrees = cueAngle * (180 / Math.PI);
        const baseTransform = `rotate(${degrees}deg)`;
        const recoil = Math.min(power * 0.8, 30);
        const hitTransform = `rotate(${degrees}deg) translateX(-${recoil}px)`;

        cue.style.transform = hitTransform;
        setTimeout(() => {
            cue.style.transform = baseTransform;
        }, 100);

        gameLoop();
    }

    function resetGame() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        score = 0;
        const scoreDisplay = document.getElementById('score-display');
        const scoreDisplayLandscape = document.getElementById('score-display-landscape');
        
        if (scoreDisplay) {
            scoreDisplay.textContent = `Счет: ${score}`;
        }
        
        if (scoreDisplayLandscape) {
            scoreDisplayLandscape.textContent = `Счет: ${score}`;
        }
        
        initPockets();
        initBalls();
        
        // Сброс всех шаров
        balls.forEach(ball => {
            ball.sunk = false;
            ball.vx = 0;
            ball.vy = 0;
            ball.el.style.display = 'block';
        });
        
        // Позиционируем белый шар слева по центру
        const cueBall = balls.find(b => b.el.id === 'cue-ball');
        if (cueBall) {
            cueBall.x = table.offsetWidth * 0.25; // 25% от ширины стола слева
            cueBall.y = table.offsetHeight * 0.5;  // 50% от высоты стола (центр)
        }
        
        // Позиционируем разноцветные шары справа в виде треугольника
        const coloredBalls = balls.filter(b => b.el.id !== 'cue-ball');
        const ballRadius = coloredBalls[0]?.radius || 12;
        const tableWidth = table.offsetWidth;
        const tableHeight = table.offsetHeight;
        
        // Убеждаемся, что треугольник помещается в пределах стола
        const triangleX = Math.min(tableWidth * 0.6, tableWidth - ballRadius * 8); // Максимум 60% или с отступом
        const triangleY = tableHeight * 0.5; // 50% от высоты стола (центр)
        const ballSpacing = Math.min(ballRadius * 2.2, (tableWidth - triangleX) / 4); // Адаптивное расстояние
        
        // Создаем треугольник из 10 шаров (4 ряда: 1, 2, 3, 4)
        let ballIndex = 0;
        
        // Функция для безопасного позиционирования шара
        const setBallPosition = (ball, x, y) => {
            // Ограничиваем позицию в пределах стола с учетом радиуса шара
            ball.x = Math.max(ballRadius, Math.min(tableWidth - ballRadius, x));
            ball.y = Math.max(ballRadius, Math.min(tableHeight - ballRadius, y));
        };
        
        // Ряд 1 (1 шар)
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX, triangleY);
            ballIndex++;
        }
        
        // Ряд 2 (2 шара)
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing, triangleY - ballSpacing * 0.5);
            ballIndex++;
        }
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing, triangleY + ballSpacing * 0.5);
            ballIndex++;
        }
        
        // Ряд 3 (3 шара)
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing * 2, triangleY - ballSpacing);
            ballIndex++;
        }
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing * 2, triangleY);
            ballIndex++;
        }
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing * 2, triangleY + ballSpacing);
            ballIndex++;
        }
        
        // Ряд 4 (4 шара)
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing * 3, triangleY - ballSpacing * 1.5);
            ballIndex++;
        }
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing * 3, triangleY - ballSpacing * 0.5);
            ballIndex++;
        }
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing * 3, triangleY + ballSpacing * 0.5);
            ballIndex++;
        }
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing * 3, triangleY + ballSpacing * 1.5);
            ballIndex++;
        }
        render();
        aimCue({ clientX: table.getBoundingClientRect().left, clientY: table.getBoundingClientRect().top + table.offsetHeight / 2 });
    }

    function toggleSound() {
        soundEnabled = !soundEnabled;
        console.log('Sound toggled - soundEnabled is now:', soundEnabled); // Диагностика
        
        const soundButton = document.getElementById('sound-toggle');
        const soundButtonLandscape = document.getElementById('sound-toggle-landscape');
        
        if (soundButton) {
            soundButton.textContent = soundEnabled ? '🔊' : '🔇';
            soundButton.title = soundEnabled ? 'Отключить звуковые эффекты (мяуканье, удары)' : 'Включить звуковые эффекты (мяуканье, удары)';
        }
        
        if (soundButtonLandscape) {
            soundButtonLandscape.textContent = soundEnabled ? '🔊' : '🔇';
            soundButtonLandscape.title = soundEnabled ? 'Отключить звуковые эффекты' : 'Включить звуковые эффекты';
        }
        
        // Сохраняем настройку в localStorage
        localStorage.setItem('kitt-cues-sound', soundEnabled);
    }

    function toggleMusic() {
        musicEnabled = !musicEnabled;
        const musicButton = document.getElementById('music-toggle');
        const musicButtonLandscape = document.getElementById('music-toggle-landscape');
        
        if (musicButton) {
            musicButton.textContent = musicEnabled ? '🎵' : '🔇';
            musicButton.title = musicEnabled ? 'Отключить фоновую музыку' : 'Включить фоновую музыку';
        }
        
        if (musicButtonLandscape) {
            musicButtonLandscape.textContent = musicEnabled ? '🎵' : '🔇';
            musicButtonLandscape.title = musicEnabled ? 'Отключить фоновую музыку' : 'Включить фоновую музыку';
        }
        
        // Управляем фоновой музыкой
        if (musicEnabled) {
            startBackgroundMusic();
        } else {
            stopBackgroundMusic();
        }
        
        // Сохраняем настройку в localStorage
        localStorage.setItem('kitt-cues-music', musicEnabled);
    }

    function showHelp() {
        const helpModal = document.getElementById('help-modal');
        if (helpModal) {
            helpModal.classList.remove('hidden');
            // Предотвращаем скроллинг фона на мобильных
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'auto';
            
            // Фокусируемся на скроллируемом контенте для лучшей доступности
            const scrollableContent = helpModal.querySelector('.overflow-y-auto');
            if (scrollableContent) {
                scrollableContent.scrollTop = 0; // Сбрасываем позицию скролла
            }
        }
    }

    function hideHelp() {
        const helpModal = document.getElementById('help-modal');
        if (helpModal) {
            helpModal.classList.add('hidden');
            // Восстанавливаем скроллинг фона
            document.body.style.overflow = '';
            document.body.style.touchAction = 'none';
        }
    }

    function loadSettings() {
        // Загружаем настройки звуковых эффектов
        const savedSound = localStorage.getItem('kitt-cues-sound');
        if (savedSound !== null) {
            soundEnabled = savedSound === 'true';
        }
        const soundButton = document.getElementById('sound-toggle');
        const soundButtonLandscape = document.getElementById('sound-toggle-landscape');
        
        if (soundButton) {
            soundButton.textContent = soundEnabled ? '🔊' : '🔇';
            soundButton.title = soundEnabled ? 'Отключить звуковые эффекты (мяуканье, удары)' : 'Включить звуковые эффекты (мяуканье, удары)';
        }
        
        if (soundButtonLandscape) {
            soundButtonLandscape.textContent = soundEnabled ? '🔊' : '🔇';
            soundButtonLandscape.title = soundEnabled ? 'Отключить звуковые эффекты' : 'Включить звуковые эффекты';
        }

        // Загружаем настройки фоновой музыки
        const savedMusic = localStorage.getItem('kitt-cues-music');
        if (savedMusic !== null) {
            musicEnabled = savedMusic === 'true';
        }
        const musicButton = document.getElementById('music-toggle');
        const musicButtonLandscape = document.getElementById('music-toggle-landscape');
        
        if (musicButton) {
            musicButton.textContent = musicEnabled ? '🎵' : '🔇';
            musicButton.title = musicEnabled ? 'Отключить фоновую музыку' : 'Включить фоновую музыку';
        }
        
        if (musicButtonLandscape) {
            musicButtonLandscape.textContent = musicEnabled ? '🎵' : '🔇';
            musicButtonLandscape.title = musicEnabled ? 'Отключить фоновую музыку' : 'Включить фоновую музыку';
        }
    }

    // --- Слушатели событий ---
    // Мышь
    gameArea.addEventListener('mousemove', e => {
        aimCue(e);
        
        // Обновляем показатель силы при перетаскивании мышью
        if (isDragging) {
            const tableRect = table.getBoundingClientRect();
            const currentX = e.clientX - tableRect.left;
            const currentY = e.clientY - tableRect.top;
            const distance = Math.sqrt((currentX - dragStartX)**2 + (currentY - dragStartY)**2);
            const power = Math.min(distance / 10, 25);
            updatePowerIndicator(power);
        }
    });
    gameArea.addEventListener('mousedown', startDrag);
    window.addEventListener('mouseup', endDrag);
    
    // Сенсорное управление
    gameArea.addEventListener('touchmove', e => { 
        if (!document.getElementById('help-modal').classList.contains('hidden')) return;
        e.preventDefault(); 
        if (e.touches && e.touches.length > 0) {
            aimCue(e);
            
            // Обновляем показатель силы при перетаскивании
            if (isDragging) {
                const tableRect = table.getBoundingClientRect();
                const currentX = e.touches[0].clientX - tableRect.left;
                const currentY = e.touches[0].clientY - tableRect.top;
                const distance = Math.sqrt((currentX - dragStartX)**2 + (currentY - dragStartY)**2);
                const power = Math.min(distance / 10, 25);
                updatePowerIndicator(power);
            }
        }
    }, { passive: false });
    
    gameArea.addEventListener('touchstart', e => { 
        if (!document.getElementById('help-modal').classList.contains('hidden')) return;
        e.preventDefault(); 
        if (e.touches && e.touches.length > 0) {
            startDrag(e); 
        }
    }, { passive: false });
    
    gameArea.addEventListener('touchend', e => { 
        e.preventDefault(); 
        endDrag(e); 
    }, { passive: false });
    
    // Предотвращаем контекстное меню на сенсорных устройствах
    gameArea.addEventListener('contextmenu', e => e.preventDefault());

    // --- Универсальный обработчик кликов и касаний для кнопок ---
    function addButtonListener(element, action) {
        if (element) {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                action();
            };
            element.addEventListener('click', handler);
            element.addEventListener('touchstart', handler);
        }
    }

    // Обработчик для новой кнопки сброса
    const resetButton = document.getElementById('reset-button');
    addButtonListener(resetButton, resetGame);

    // Обработчики для новых кнопок
    const soundToggle = document.getElementById('sound-toggle');
    const musicToggle = document.getElementById('music-toggle');
    const helpButton = document.getElementById('help-button');
    const closeHelp = document.getElementById('close-help');
    const helpModal = document.getElementById('help-modal');
    
    
    // Ландшафтные мобильные кнопки
    const soundToggleLandscape = document.getElementById('sound-toggle-landscape');
    const musicToggleLandscape = document.getElementById('music-toggle-landscape');
    const helpButtonLandscape = document.getElementById('help-button-landscape');
    const resetButtonLandscape = document.getElementById('reset-button-landscape');
    
    addButtonListener(soundToggle, toggleSound);
    addButtonListener(musicToggle, toggleMusic);
    addButtonListener(helpButton, showHelp);
    
    // Ландшафтные обработчики
    addButtonListener(soundToggleLandscape, toggleSound);
    addButtonListener(musicToggleLandscape, toggleMusic);
    addButtonListener(helpButtonLandscape, showHelp);
    addButtonListener(resetButtonLandscape, resetGame);

    addButtonListener(closeHelp, hideHelp);
    
    // Закрытие модального окна по клику вне его
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target.id === 'help-modal') {
                hideHelp();
            }
        });
        
        // Предотвращаем закрытие при клике на содержимое
        const modalContent = helpModal.querySelector('.bg-white');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Обработка сенсорных событий для предотвращения конфликтов
            modalContent.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            });
            
            modalContent.addEventListener('touchmove', (e) => {
                // Разрешаем скроллинг только внутри скроллируемой области
                const scrollableElement = e.target.closest('.overflow-y-auto');
                if (!scrollableElement) {
                    e.preventDefault();
                }
            }, { passive: false });
        }
    }

    // Поддержка клавиатуры для модального окна и управления
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideHelp();
        }
        if (e.key === 'h' || e.key === 'H') {
            showHelp();
        }
        if (e.key === 's' || e.key === 'S') {
            toggleSound(); // Звуковые эффекты (мяуканье, удары)
        }
        if (e.key === 'm' || e.key === 'M') {
            toggleMusic(); // Фоновая музыка
        }
    });

    // --- Начальный запуск ---
    loadSettings();
    initCats();
    initPockets();
    resetGame();
    
    // Добавляем класс для динамического масштабирования
    if (gameArea) {
        gameArea.classList.add('dynamic-scaling');
    }
    
    // Проверяем ориентацию при загрузке
    checkOrientation();
    
    // Применяем динамическое масштабирование
    setTimeout(() => {
        handleResize();
        positionUIElements();
    }, 100);
    
    // Дополнительный вызов для корректного позиционирования UI при загрузке
    setTimeout(() => {
        positionUIElements();
    }, 300);
    
    // Добавляем обработчики событий
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);
    
    // Обработчик для корректного позиционирования при изменении размера
    window.addEventListener('resize', () => {
        setTimeout(() => {
            positionUIElements();
        }, 50);
    });
    
    // Запускаем фоновую музыку после первого взаимодействия пользователя
    const startMusicOnFirstInteraction = () => {
        if (musicEnabled) { // Проверяем, включена ли музыка
            initAudio();
            startBackgroundMusic();
        }
        // Удаляем обработчики, чтобы избежать повторного запуска
        document.removeEventListener('mousedown', startMusicOnFirstInteraction);
        document.removeEventListener('touchstart', startMusicOnFirstInteraction);
    };
    
    document.addEventListener('mousedown', startMusicOnFirstInteraction);
    document.addEventListener('touchstart', startMusicOnFirstInteraction, { passive: true });
});
