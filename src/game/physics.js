import { applyFrictionComponent, resolveElasticCollision } from './physics-math.js';

export function createPhysicsEngine(ctx, audioManager) {
    const { dom, document: doc, window: win, state } = ctx;
    const { playHitSound, playWallHitSound, playMeowSound } = audioManager;

    const stopListeners = new Set();

    function notifyBallsStopped() {
        stopListeners.forEach(listener => {
            try {
                listener();
            } catch (error) {
                console.error('Balls stopped listener error:', error);
            }
        });
    }

    function onBallsStopped(listener) {
        stopListeners.add(listener);
    }

    function removeBallsStoppedListener(listener) {
        stopListeners.delete(listener);
    }

    function initCats() {
        state.cats = [];
        const { table } = dom;
        if (!table) return;

        const catElements = doc.querySelectorAll('.cat-container');
        const tableRect = table.getBoundingClientRect();

        catElements.forEach(el => {
            const catRect = el.getBoundingClientRect();
            const catCenterX = (catRect.left - tableRect.left) + catRect.width / 2;
            const catCenterY = (catRect.top - tableRect.top) + catRect.height / 2;
            let radius = Math.max(catRect.width, catRect.height) / 2;
            if (el.classList.contains('cat-small')) {
                radius = Math.max(catRect.width, catRect.height) / 2;
            }
            if (state.isMobile) {
                radius *= 0.1;
            }

            state.cats.push({
                el,
                pawEl: el.querySelector('.hitting-paw'),
                x: catCenterX,
                y: catCenterY,
                radius,
                cooldown: 0
            });
        });
    }

    function initPockets() {
        state.pockets = [];
        const { table } = dom;
        if (!table) return;

        const pocketElements = doc.querySelectorAll('[data-pocket]');
        const tableRect = table.getBoundingClientRect();

        pocketElements.forEach(el => {
            const pocketRect = el.getBoundingClientRect();
            const pocketX = (pocketRect.left - tableRect.left) + pocketRect.width / 2;
            const pocketY = (pocketRect.top - tableRect.top) + pocketRect.height / 2;
            const visualRadius = Math.max(el.offsetWidth, el.offsetHeight) / 2;
            let pocketRadius = Math.max(6, visualRadius * 0.95);
            if (state.isMobile) {
                pocketRadius = Math.max(4, visualRadius * 0.5);
            }

            state.pockets.push({
                x: pocketX,
                y: pocketY,
                radius: pocketRadius
            });
        });
    }

    function initBalls() {
        const { table, pyramidContainer } = dom;
        if (!table) return;

        state.balls = [];
        const ballElements = doc.querySelectorAll('.billiard-ball');

        if (pyramidContainer) {
            pyramidContainer.style.display = 'block';
        }

        ballElements.forEach(el => {
            el.style.transform = '';
            el.style.display = 'block';
            const tableRect = table.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const posX = (elRect.left - tableRect.left) + elRect.width / 2;
            const posY = (elRect.top - tableRect.top) + elRect.height / 2;
            state.balls.push({
                el,
                x: posX,
                y: posY,
                vx: 0,
                vy: 0,
                radius: el.offsetWidth / 2,
                sunk: false
            });
            table.appendChild(el);
            el.style.position = 'absolute';
            el.style.left = '0px';
            el.style.top = '0px';
        });

        if (pyramidContainer) {
            pyramidContainer.innerHTML = '';
            pyramidContainer.style.display = 'none';
        }

        render();
    }

    function updateScoreDisplays() {
        const scoreDisplay = doc.getElementById('score-display');
        const scoreDisplayLandscape = doc.getElementById('score-display-landscape');
        if (scoreDisplay) {
            scoreDisplay.textContent = `Счет: ${state.score}`;
        }
        if (scoreDisplayLandscape) {
            scoreDisplayLandscape.textContent = `Счет: ${state.score}`;
        }
    }

    function showCatEmoji(emojiText) {
        const { table } = dom;
        if (!table) return;

        state.cats.forEach(cat => {
            try {
                const emoji = doc.createElement('div');
                emoji.className = 'cat-emoji';
                emoji.textContent = emojiText;
                const head = cat.el.querySelector('.cat-head') || cat.el;
                const headRect = head.getBoundingClientRect();
                const tableRect = table.getBoundingClientRect();
                const centerX = (headRect.left - tableRect.left) + headRect.width / 2;
                const topY = (headRect.top - tableRect.top) - 6;
                emoji.style.left = `${centerX}px`;
                emoji.style.top = `${topY}px`;
                table.appendChild(emoji);
                win.setTimeout(() => {
                    emoji.remove();
                }, 1300);
            } catch (error) {
                console.log('Unable to show cat emoji:', error);
            }
        });
    }

    function updatePhysics() {
        state.cats.forEach(cat => {
            if (cat.cooldown > 0) cat.cooldown--;
        });

        state.balls.forEach(ball => {
            if (ball.sunk) return;

            ball.vx = applyFrictionComponent(ball.vx, state.friction, state.minVelocity);
            ball.vy = applyFrictionComponent(ball.vy, state.friction, state.minVelocity);
            if (ball.vx === 0 && ball.vy === 0) return;
            ball.x += ball.vx;
            ball.y += ball.vy;

            state.pockets.forEach(pocket => {
                const dx = ball.x - pocket.x;
                const dy = ball.y - pocket.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance + ball.radius < pocket.radius && !ball.sunk) {
                    ball.sunk = true;
                    ball.vx = 0;
                    ball.vy = 0;
                    ball.el.style.display = 'none';

                    if (ball.el.id !== 'cue-ball') {
                        state.score++;
                        updateScoreDisplays();
                        playHitSound();
                        showCatEmoji('😿');
                    } else {
                        showCatEmoji('😺');
                        win.setTimeout(() => {
                            const { table } = dom;
                            if (!table) return;
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

            if (ball.sunk) return;

            const { table } = dom;
            if (!table) return;

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

            state.cats.forEach(cat => {
                if (cat.cooldown > 0 || ball.sunk) return;
                const dx = ball.x - cat.x;
                const dy = ball.y - cat.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ball.radius + cat.radius) {
                    if (state.isMobile) {
                        const speed = Math.hypot(ball.vx, ball.vy);
                        if (speed < 3) return;
                    }
                    playMeowSound();
                    cat.cooldown = state.isMobile ? state.catCooldown * 2 : state.catCooldown;

                    if (cat.el.classList.contains('cat-small')) {
                        cat.el.classList.add('swat-animation');
                        win.setTimeout(() => cat.el.classList.remove('swat-animation'), 500);
                    } else {
                        const pawElement = cat.pawEl || cat.el;
                        pawElement.classList.add('swat-animation');
                        win.setTimeout(() => pawElement.classList.remove('swat-animation'), 300);
                    }

                    const angle = Math.atan2(dy, dx);
                    const effectivePawPower = state.isMobile ? Math.max(1, state.pawHitPower * 0.25) : state.pawHitPower;
                    ball.vx = Math.cos(angle) * effectivePawPower;
                    ball.vy = Math.sin(angle) * effectivePawPower;

                    const overlap = (ball.radius + cat.radius) - distance + 1;
                    ball.x += Math.cos(angle) * overlap;
                    ball.y += Math.sin(angle) * overlap;
                }
            });
        });

        for (let i = 0; i < state.balls.length; i++) {
            if (state.balls[i].sunk) continue;
            for (let j = i + 1; j < state.balls.length; j++) {
                if (state.balls[j].sunk) continue;
                const ball1 = state.balls[i];
                const ball2 = state.balls[j];
                const distance = Math.hypot(ball2.x - ball1.x, ball2.y - ball1.y);

                if (distance < ball1.radius + ball2.radius) {
                    const { ballA, ballB } = resolveElasticCollision(ball1, ball2);
                    ball1.vx = ballA.vx;
                    ball1.vy = ballA.vy;
                    ball2.vx = ballB.vx;
                    ball2.vy = ballB.vy;
                    ball1.x += ballA.dx;
                    ball1.y += ballA.dy;
                    ball2.x += ballB.dx;
                    ball2.y += ballB.dy;

                    playHitSound();
                }
            }
        }
    }

    function render() {
        state.balls.forEach(ball => {
            if (!ball.sunk) {
                ball.el.style.left = '0px';
                ball.el.style.top = '0px';
                ball.el.style.transform = `translate(${ball.x - ball.radius}px, ${ball.y - ball.radius}px)`;
            }
        });
    }

    function gameLoop() {
        updatePhysics();
        render();
        const allStopped = state.balls.every(b => b.sunk || (b.vx === 0 && b.vy === 0));
        if (allStopped) {
            if (state.animationFrameId) {
                win.cancelAnimationFrame(state.animationFrameId);
                state.animationFrameId = null;
            }
            notifyBallsStopped();
        } else {
            state.animationFrameId = win.requestAnimationFrame(gameLoop);
        }
    }

    function startLoop() {
        if (state.animationFrameId) return;
        state.animationFrameId = win.requestAnimationFrame(gameLoop);
    }

    function stopLoop() {
        if (state.animationFrameId) {
            win.cancelAnimationFrame(state.animationFrameId);
            state.animationFrameId = null;
        }
    }

    function getCueBall() {
        return state.balls.find(b => b.el.id === 'cue-ball');
    }

    function resetGame() {
        stopLoop();
        state.score = 0;
        updateScoreDisplays();

        initPockets();
        initBalls();

        state.balls.forEach(ball => {
            ball.sunk = false;
            ball.vx = 0;
            ball.vy = 0;
            ball.el.style.display = 'block';
        });

        const cueBall = getCueBall();
        const { table } = dom;
        if (cueBall && table) {
            cueBall.x = table.offsetWidth * 0.25;
            cueBall.y = table.offsetHeight * 0.5;
        }

        state.cueAngle = 0;

        const coloredBalls = state.balls.filter(b => b.el.id !== 'cue-ball');
        const ballRadius = coloredBalls[0]?.radius || 12;
        const tableWidth = table?.offsetWidth || 0;
        const tableHeight = table?.offsetHeight || 0;
        const triangleX = Math.min(tableWidth * 0.6, tableWidth - ballRadius * 8);
        const triangleY = tableHeight * 0.5;
        const ballSpacing = Math.min(ballRadius * 2.2, (tableWidth - triangleX) / 4);

        let ballIndex = 0;
        const setBallPosition = (ball, x, y) => {
            ball.x = Math.max(ballRadius, Math.min(tableWidth - ballRadius, x));
            ball.y = Math.max(ballRadius, Math.min(tableHeight - ballRadius, y));
        };

        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX, triangleY);
            ballIndex++;
        }
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing, triangleY - ballSpacing * 0.5);
            ballIndex++;
        }
        if (ballIndex < coloredBalls.length) {
            setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing, triangleY + ballSpacing * 0.5);
            ballIndex++;
        }

        const row3 = [
            { dx: 2, dy: -1 },
            { dx: 2, dy: 0 },
            { dx: 2, dy: 1 }
        ];
        row3.forEach(({ dx, dy }) => {
            if (ballIndex < coloredBalls.length) {
                setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing * dx, triangleY + ballSpacing * dy);
                ballIndex++;
            }
        });

        const row4 = [
            { dx: 3, dy: -1.5 },
            { dx: 3, dy: -0.5 },
            { dx: 3, dy: 0.5 },
            { dx: 3, dy: 1.5 }
        ];
        row4.forEach(({ dx, dy }) => {
            if (ballIndex < coloredBalls.length) {
                setBallPosition(coloredBalls[ballIndex], triangleX + ballSpacing * dx, triangleY + ballSpacing * dy);
                ballIndex++;
            }
        });

        render();

        if (cueBall && dom.cue) {
            const tipOffset = cueBall.radius + 10;
            const tipX = cueBall.x + Math.cos(state.cueAngle) * tipOffset;
            const tipY = cueBall.y + Math.sin(state.cueAngle) * tipOffset;
            const degrees = state.cueAngle * (180 / Math.PI);
            dom.cue.style.visibility = 'visible';
            dom.cue.style.transformOrigin = 'left center';
            dom.cue.style.left = '0px';
            dom.cue.style.top = '0px';
            dom.cue.style.transform = `translate(${tipX}px, ${tipY - dom.cue.offsetHeight / 2}px) rotate(${degrees}deg)`;
        }
    }

    function isAnyBallMoving() {
        return Boolean(state.animationFrameId);
    }

    function applyMobilePhysicsTweaks() {
        if (state.isMobile) {
            state.friction = 0.8;
            state.minVelocity = 0.07;
            state.hitPower = 7;
        } else {
            state.friction = 0.985;
            state.minVelocity = 0.05;
            state.hitPower = 15;
        }
    }

    applyMobilePhysicsTweaks();

    return {
        initCats,
        initPockets,
        initBalls,
        updateScoreDisplays,
        updatePhysics,
        render,
        startLoop,
        stopLoop,
        resetGame,
        getCueBall,
        onBallsStopped,
        removeBallsStoppedListener,
        isAnyBallMoving,
        applyMobilePhysicsTweaks
    };
}
