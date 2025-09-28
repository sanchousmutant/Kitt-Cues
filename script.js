document.addEventListener('DOMContentLoaded', () => {
    const gameArea = document.getElementById('game-area');
    const table = document.getElementById('billiard-table');
    const cue = document.getElementById('cue');
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
        const margin = Math.max(20, 40 * scaleFactor); // Адаптивный отступ
        
        // Дополнительный отступ для маленьких экранов (iPhone SE)
        const isSmallScreen = window.innerWidth <= 375;
        const extraMargin = isSmallScreen ? 60 : 0;
        
        // Левые кнопки
        const soundToggle = document.querySelector('#sound-toggle');
        if (soundToggle && soundToggle.parentElement) {
            const leftButtons = soundToggle.parentElement;
            const leftX = tableRect.left - gameAreaRect.left - leftButtons.offsetWidth - margin;
            leftButtons.style.left = `${Math.max(10, leftX)}px`;
            leftButtons.style.right = 'auto';
        }
        
        // Правая кнопка
        const resetButton = document.querySelector('#reset-button');
        if (resetButton && resetButton.parentElement) {
            const rightButton = resetButton.parentElement;
            const rightX = gameAreaRect.width - (tableRect.right - gameAreaRect.left) - rightButton.offsetWidth - margin;
            rightButton.style.right = `${Math.max(10, rightX)}px`;
            rightButton.style.left = 'auto';
        }
        
        // Счет в правом верхнем углу
        const scoreDisplay = document.querySelector('#score-display');
        if (scoreDisplay && scoreDisplay.parentElement) {
            const topRightScore = scoreDisplay.parentElement;
            const topY = tableRect.top - gameAreaRect.top - topRightScore.offsetHeight - margin;
            const rightX = gameAreaRect.width - (tableRect.right - gameAreaRect.left) - topRightScore.offsetWidth - margin;
            
            // Проверяем, не перекрывает ли счет стол
            const minTopY = Math.max(10, topY);
            const minRightX = Math.max(10, rightX);
            
            // Если счет может перекрыть стол, перемещаем его выше
            if (minTopY < tableRect.top - gameAreaRect.top + 10) {
                topRightScore.style.top = `${tableRect.top - gameAreaRect.top - topRightScore.offsetHeight - margin}px`;
            } else {
                topRightScore.style.top = `${minTopY}px`;
            }
            
            // Сдвигаем счет правее, чтобы он не перекрывал стол
            const extraRightMargin = Math.max(0, (tableRect.right - gameAreaRect.left) - (gameAreaRect.width - minRightX - topRightScore.offsetWidth));
            const finalRightX = minRightX + extraRightMargin + extraMargin;
            
            // Проверяем, не выходит ли счет за левую границу стола
            const scoreLeftEdge = gameAreaRect.width - finalRightX - topRightScore.offsetWidth;
            if (scoreLeftEdge < tableRect.left - gameAreaRect.left + 10) {
                // Если счет перекрывает стол слева, сдвигаем его еще правее
                const safeRightX = gameAreaRect.width - (tableRect.left - gameAreaRect.left) - topRightScore.offsetWidth - 20;
                topRightScore.style.right = `${Math.max(10, safeRightX)}px`;
            } else {
                topRightScore.style.right = `${finalRightX}px`;
            }
            
            topRightScore.style.bottom = 'auto';
            topRightScore.style.left = 'auto';
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
        
        // Создаем очень тихую и ненавязчивую мелодию
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        // Настройки для мягкого звучания
        oscillator1.type = 'sine';
        oscillator2.type = 'triangle';
        
        // Очень тихий уровень громкости (0.02 = 2%)
        gainNode.gain.setValueAtTime(0.02, audioContext.currentTime);
        
        // Мягкий фильтр для более теплого звука
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);
        
        // Простая и успокаивающая мелодия
        const notes = [
            261.63, // C4
            293.66, // D4
            329.63, // E4
            293.66, // D4
            261.63, // C4
            246.94, // B3
            261.63, // C4
            293.66  // D4
        ];
        
        let noteIndex = 0;
        const playNote = () => {
            if (!musicEnabled || !isMusicPlaying) return;
            
            // Плавное изменение частоты
            oscillator1.frequency.setValueAtTime(notes[noteIndex], audioContext.currentTime);
            oscillator2.frequency.setValueAtTime(notes[noteIndex] * 0.5, audioContext.currentTime + 0.1);
            
            noteIndex = (noteIndex + 1) % notes.length;
        };
        
        // Воспроизводим ноту каждые 2 секунды (очень медленно)
        const musicInterval = setInterval(playNote, 2000);
        
        // Подключаем цепочку звука
        oscillator1.connect(filter);
        oscillator2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Запускаем осцилляторы
        oscillator1.start();
        oscillator2.start();
        
        // Сохраняем ссылки для остановки
        backgroundMusic = {
            oscillator1,
            oscillator2,
            gainNode,
            interval: musicInterval
        };
        
        playNote(); // Играем первую ноту сразу
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
        gainNode.gain.setValueAtTime(1, audioContext.currentTime);
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
        gainNode.gain.setValueAtTime(0.7, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
    }

    function playMeowSound() {
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
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
            let radius = Math.max(catRect.width, catRect.height) / 2 + 10;
            if (el.classList.contains('cat-small')) {
                radius = Math.max(catRect.width, catRect.height) / 2 + 25; // Значительно больший радиус для маленького кота
            }
            
            cats.push({
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
            pockets.push({
                x: pocketX,
                y: pocketY,
                radius: 18 // Slightly larger than ball for easier sinking
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
        const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
        
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
        const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
        
        if (clientX !== undefined && clientY !== undefined) {
            dragStartX = clientX - tableRect.left;
            dragStartY = clientY - tableRect.top;
            aimCue(e);
        }
    }

    function endDrag(e) {
        if (!isDragging || animationFrameId) return;
        
        // Проверяем, не кликнули ли по кнопке
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            isDragging = false;
            return;
        }
        
        isDragging = false;
        const tableRect = table.getBoundingClientRect();
        
        // Поддержка как мыши, так и сенсорного ввода
        const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
        
        const dragEndX = clientX - tableRect.left;
        const dragEndY = clientY - tableRect.top;
        const dragDistance = Math.sqrt((dragEndX - dragStartX)**2 + (dragEndY - dragStartY)**2);
        let power = Math.min(dragDistance / 10, 25); // Max power 25
        if (dragDistance < 10) power = HIT_POWER; // Min power for clicks/taps
        hitBall(power);
    }

    function hitBall(power = HIT_POWER) {
        initAudio();
        // Не бить, если шары уже движутся
        if (animationFrameId) return;
        const cueBallObj = balls.find(b => b.el.id === 'cue-ball');
        if (!cueBallObj) return;

        playHitSound();

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
        const soundButton = document.getElementById('sound-toggle');
        const soundButtonLandscape = document.getElementById('sound-toggle-landscape');
        
        if (soundButton) {
            soundButton.textContent = soundEnabled ? '🔊' : '🔇';
            soundButton.title = soundEnabled ? 'Отключить звуковые эффекты' : 'Включить звуковые эффекты';
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
        }
    }

    function hideHelp() {
        const helpModal = document.getElementById('help-modal');
        if (helpModal) {
            helpModal.classList.add('hidden');
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
            soundButton.title = soundEnabled ? 'Отключить звуковые эффекты' : 'Включить звуковые эффекты';
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
    gameArea.addEventListener('mousemove', aimCue);
    gameArea.addEventListener('mousedown', startDrag);
    gameArea.addEventListener('mouseup', endDrag);
    
    // Сенсорное управление
    gameArea.addEventListener('touchmove', e => { 
        e.preventDefault(); 
        aimCue(e); 
    }, { passive: false });
    
    gameArea.addEventListener('touchstart', e => { 
        e.preventDefault(); 
        startDrag(e); 
    }, { passive: false });
    
    gameArea.addEventListener('touchend', e => { 
        e.preventDefault(); 
        endDrag(e); 
    }, { passive: false });
    
    // Предотвращаем контекстное меню на сенсорных устройствах
    gameArea.addEventListener('contextmenu', e => e.preventDefault());

    // Обработчик для новой кнопки сброса
    const resetButton = document.getElementById('reset-button');
    if (resetButton) {
        resetButton.addEventListener('click', (e) => {
            e.stopPropagation();
            resetGame();
        });
    }

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
    
    if (soundToggle) {
        soundToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSound();
        });
    }

    if (musicToggle) {
        musicToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMusic();
        });
    }

    if (helpButton) {
        helpButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showHelp();
        });
    }
    
    
    // Ландшафтные обработчики
    if (soundToggleLandscape) {
        soundToggleLandscape.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSound();
        });
    }

    if (musicToggleLandscape) {
        musicToggleLandscape.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMusic();
        });
    }

    if (helpButtonLandscape) {
        helpButtonLandscape.addEventListener('click', (e) => {
            e.stopPropagation();
            showHelp();
        });
    }
    
    if (resetButtonLandscape) {
        resetButtonLandscape.addEventListener('click', (e) => {
            e.stopPropagation();
            resetGame();
        });
    }

    if (closeHelp) {
        closeHelp.addEventListener('click', hideHelp);
    }
    
    // Закрытие модального окна по клику вне его
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target.id === 'help-modal') {
                hideHelp();
            }
        });
    }

    // Поддержка клавиатуры для модального окна
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideHelp();
        }
        if (e.key === 'h' || e.key === 'H') {
            showHelp();
        }
        if (e.key === 'm' || e.key === 'M') {
            toggleSound();
        }
    });

    // --- Начальный запуск ---
    loadSettings();
    initCats();
    initPockets();
    resetGame();
    
    // Проверяем ориентацию при загрузке
    checkOrientation();
    
    // Применяем динамическое масштабирование
    setTimeout(() => {
        handleResize();
        positionUIElements();
    }, 100);
    
    // Добавляем обработчики событий
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);
    
    // Запускаем фоновую музыку после первого взаимодействия пользователя
    const startMusicOnFirstInteraction = () => {
        if (soundEnabled) {
            initAudio();
            startBackgroundMusic();
        }
        document.removeEventListener('mousedown', startMusicOnFirstInteraction);
        document.removeEventListener('touchstart', startMusicOnFirstInteraction);
    };
    
    document.addEventListener('mousedown', startMusicOnFirstInteraction);
    document.addEventListener('touchstart', startMusicOnFirstInteraction, { passive: true });
});
