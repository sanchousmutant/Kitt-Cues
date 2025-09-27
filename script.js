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
    const MEDIUM_SPEED = 5; // Средняя скорость для определения отскока от кота

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

    // --- Звуковой движок ---
    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
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
        if (!audioContext || !soundEnabled) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Создаем характерный звук мяукания с изменением частоты
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(500, audioContext.currentTime + 0.1);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.4, audioContext.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.6);
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
            cats.push({
                el: el,
                pawEl: el.querySelector('.hitting-paw'),
                x: catCenterX,
                y: catCenterY,
                radius: Math.max(catRect.width, catRect.height) / 2 + 10,
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

            // Проверка на попадание в лузы (перед стенами)
            let sunkThisFrame = false;
            pockets.forEach(pocket => {
                const dx = ball.x - pocket.x;
                const dy = ball.y - pocket.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < pocket.radius) {
                    sunkThisFrame = true;
                    ball.sunk = true;
                    ball.vx = 0;
                    ball.vy = 0;
                    ball.el.style.display = 'none';
                    if (ball.el.id !== 'cue-ball') {
                        score++;
                        const scoreDisplay = document.getElementById('score-display');
                        if (scoreDisplay) {
                            scoreDisplay.textContent = `Счет: ${score}`;
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
                }
            });

            // Столкновения со стенами (только если не утонул)
            if (!sunkThisFrame) {
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
            }

            // Столкновения с кошками
            cats.forEach(cat => {
                if (cat.cooldown > 0) return;
                const dx = ball.x - cat.x;
                const dy = ball.y - cat.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ball.radius + cat.radius) {
                    // Вычисляем скорость шара
                    const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                    
                    if (ballSpeed > MEDIUM_SPEED) {
                        // Быстрый шар - кот мяукает и отталкивает шар
                        playMeowSound();
                        cat.cooldown = CAT_COOLDOWN;
                        
                        // Анимация испуга кота
                        const catElement = cat.el;
                        catElement.classList.add('cat-scared');
                        setTimeout(() => {
                            catElement.classList.remove('cat-scared');
                        }, 500);
                        
                        // Отскок шара от кота (упругое столкновение)
                        const angle = Math.atan2(dy, dx);
                        const normalizedDx = Math.cos(angle);
                        const normalizedDy = Math.sin(angle);
                        
                        // Отталкиваем шар от кота с сохранением части энергии
                        const bounceForce = ballSpeed * 0.8; // Немного теряем энергию
                        ball.vx = normalizedDx * bounceForce;
                        ball.vy = normalizedDy * bounceForce;
                        
                        // Отодвигаем шар от кота, чтобы избежать залипания
                        const separation = ball.radius + cat.radius + 2;
                        ball.x = cat.x + normalizedDx * separation;
                        ball.y = cat.y + normalizedDy * separation;
                        
                    } else {
                        // Медленный шар - кот играет лапкой (старое поведение)
                        playPawSound();
                        cat.cooldown = CAT_COOLDOWN;
                        
                        const pawElement = cat.pawEl || cat.el;
                        pawElement.classList.add('swat-animation');
                        setTimeout(() => {
                            pawElement.classList.remove('swat-animation');
                        }, 300);

                        const angle = Math.atan2(dy, dx);
                        ball.vx = Math.cos(angle) * PAW_HIT_POWER;
                        ball.vy = Math.sin(angle) * PAW_HIT_POWER;
                    }
                }
            });
        });

        // Столкновения шаров (только с несунkenными)
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

                    const overlap = (ball1.radius + ball2.radius) - distance + 0.1;
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
            ball.el.style.transform = `translate(${ball.x - ball.radius}px, ${ball.y - ball.radius}px)`;
            ball.el.style.left = '0px';
            ball.el.style.top = '0px';
        });
    }

    function gameLoop() {
        updatePhysics();
        render();
        const allStopped = balls.every(b => b.vx === 0 && b.vy === 0);
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
        const mouseX = (e.clientX || (e.touches && e.touches[0].clientX)) - tableRect.left;
        const mouseY = (e.clientY || (e.touches && e.touches[0].clientY)) - tableRect.top;

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
        isDragging = true;
        const tableRect = table.getBoundingClientRect();
        dragStartX = (e.clientX || (e.touches && e.touches[0].clientX)) - tableRect.left;
        dragStartY = (e.clientY || (e.touches && e.touches[0].clientY)) - tableRect.top;
        aimCue(e);
    }

    function endDrag(e) {
        if (!isDragging || animationFrameId) return;
        isDragging = false;
        const tableRect = table.getBoundingClientRect();
        const dragEndX = (e.clientX || (e.touches && e.touches[0].clientX)) - tableRect.left;
        const dragEndY = (e.clientY || (e.touches && e.touches[0].clientY)) - tableRect.top;
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
        if (scoreDisplay) {
            scoreDisplay.textContent = `Счет: ${score}`;
        }
        balls.forEach(ball => {
            ball.sunk = false;
            ball.el.style.display = 'block';
        });
        initPockets();
        initBalls();
        aimCue({ clientX: table.getBoundingClientRect().left, clientY: table.getBoundingClientRect().top + table.offsetHeight / 2 });
    }

    function toggleSound() {
        soundEnabled = !soundEnabled;
        const soundButton = document.getElementById('sound-toggle');
        if (soundButton) {
            soundButton.textContent = soundEnabled ? '🔊' : '🔇';
            soundButton.title = soundEnabled ? 'Отключить звук' : 'Включить звук';
        }
        
        // Сохраняем настройку в localStorage
        localStorage.setItem('kitt-cues-sound', soundEnabled);
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
        const savedSound = localStorage.getItem('kitt-cues-sound');
        if (savedSound !== null) {
            soundEnabled = savedSound === 'true';
            const soundButton = document.getElementById('sound-toggle');
            if (soundButton) {
                soundButton.textContent = soundEnabled ? '🔊' : '🔇';
                soundButton.title = soundEnabled ? 'Отключить звук' : 'Включить звук';
            }
        }
    }

    // --- Слушатели событий ---
    gameArea.addEventListener('mousemove', aimCue);
    gameArea.addEventListener('mousedown', startDrag);
    gameArea.addEventListener('mouseup', endDrag);
    gameArea.addEventListener('touchmove', e => { e.preventDefault(); aimCue(e); });
    gameArea.addEventListener('touchstart', startDrag);
    gameArea.addEventListener('touchend', e => { e.preventDefault(); endDrag(); });

    const resetButton = document.createElement('button');
    resetButton.textContent = 'Начать заново';
    resetButton.className = 'absolute bottom-2 right-2 bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-yellow-700 transition z-10';
    gameArea.appendChild(resetButton);
    resetButton.addEventListener('click', (e) => {
        e.stopPropagation();
        resetGame();
    });

    // Обработчики для новых кнопок
    const soundToggle = document.getElementById('sound-toggle');
    const helpButton = document.getElementById('help-button');
    const closeHelp = document.getElementById('close-help');
    const helpModal = document.getElementById('help-modal');
    
    if (soundToggle) {
        soundToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSound();
        });
    }

    if (helpButton) {
        helpButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showHelp();
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
});
