import { updateMobileFlags } from './context.js';
import { requestFullscreenIfPending } from './device.js';

export function createControlManager(ctx, physics, audioManager, deviceInfo, layoutManager, fullscreenHandler) {
    const { dom, document: doc, window: win, state } = ctx;
    const { initAudio, playHitSound, toggleSound, toggleMusic, setMusicVolumeFromPercent, loadPreferences, startBackgroundMusic } = audioManager;

    function smoothAngle(current, target, alpha) {
        const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
        return current + diff * alpha;
    }

    function updateAimLine(startX, startY, angle) {
        if (!dom.aimLine) return;
        const lineLength = 150;
        dom.aimLine.style.left = '0px';
        dom.aimLine.style.top = '0px';
        dom.aimLine.style.width = `${lineLength}px`;
        dom.aimLine.style.transform = `translate(${startX}px, ${startY - 1}px) rotate(${angle * (180 / Math.PI)}deg)`;
        dom.aimLine.style.transformOrigin = 'left center';
        if (state.isDragging) {
            dom.aimLine.classList.add('visible');
        }
    }

    function updatePowerIndicator(power) {
        if (!dom.powerIndicator || !dom.powerFill) return;
        const maxPower = 25;
        const powerPercent = Math.min((power / maxPower) * 100, 100);
        dom.powerFill.style.width = `${powerPercent}%`;
        if (state.isDragging && power > 0) {
            dom.powerIndicator.classList.add('visible');
            const cueBallObj = physics.getCueBall();
            if (cueBallObj) {
                dom.powerIndicator.style.left = `${cueBallObj.x - 50}px`;
                dom.powerIndicator.style.top = `${cueBallObj.y - 30}px`;
            }
        }
    }

    function hideVisualHelpers() {
        dom.aimLine?.classList.remove('visible');
        dom.powerIndicator?.classList.remove('visible');
    }

    function aimCue(event) {
        const cueBallObj = physics.getCueBall();
        if (!cueBallObj || !event) return;

        const tableRect = dom.table.getBoundingClientRect();
        let clientX;
        let clientY;

        if ('touches' in event && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        if (clientX === undefined || clientY === undefined) return;

        let mouseX = clientX - tableRect.left;
        let mouseY = clientY - tableRect.top;

        const padding = 20;
        mouseX = Math.max(padding, Math.min(dom.table.offsetWidth - padding, mouseX));
        mouseY = Math.max(padding, Math.min(dom.table.offsetHeight - padding, mouseY));

        const targetAngle = Math.atan2(mouseY - cueBallObj.y, mouseX - cueBallObj.x);
        const followFactor = state.isMobile ? 0.08 : 0.15;
        state.cueAngle = smoothAngle(state.cueAngle, targetAngle, followFactor);

        const degrees = state.cueAngle * (180 / Math.PI);
        const clearance = cueBallObj.radius + 6;
        const tipX = cueBallObj.x + Math.cos(state.cueAngle) * clearance;
        const tipY = cueBallObj.y + Math.sin(state.cueAngle) * clearance;

        dom.cue.style.transformOrigin = 'left center';
        dom.cue.style.left = '0px';
        dom.cue.style.top = '0px';
        dom.cue.style.transform = `translate(${tipX}px, ${tipY - dom.cue.offsetHeight / 2}px) rotate(${degrees}deg)`;

        updateAimLine(cueBallObj.x, cueBallObj.y, state.cueAngle + Math.PI);
    }

    function startDrag(event) {
        if (physics.isAnyBallMoving()) return;
        if (event.target.tagName === 'BUTTON' || event.target.closest('button')) return;

        state.allowFullscreen = true;
        requestFullscreenIfPending(ctx, deviceInfo);

        state.isDragging = true;
        const tableRect = dom.table.getBoundingClientRect();

        let clientX;
        let clientY;
        if ('touches' in event && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        if (clientX === undefined || clientY === undefined) return;

        state.dragStartX = clientX - tableRect.left;
        state.dragStartY = clientY - tableRect.top;
        aimCue(event);

        dom.aimLine?.classList.add('visible');
        dom.powerIndicator?.classList.add('visible');
    }

    function endDrag(event) {
        if (!state.isDragging || physics.isAnyBallMoving()) {
            state.isDragging = false;
            hideVisualHelpers();
            return;
        }

        if (event?.target?.tagName === 'BUTTON' || event?.target?.closest('button')) {
            state.isDragging = false;
            hideVisualHelpers();
            return;
        }

        state.isDragging = false;
        const tableRect = dom.table.getBoundingClientRect();
        let clientX;
        let clientY;
        if (event && 'touches' in event && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else if (event && 'changedTouches' in event && event.changedTouches.length > 0) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
        } else if (event) {
            clientX = event.clientX;
            clientY = event.clientY;
        } else {
            clientX = state.dragStartX + tableRect.left;
            clientY = state.dragStartY + tableRect.top;
        }

        const dragEndX = clientX - tableRect.left;
        const dragEndY = clientY - tableRect.top;
        const dragDistance = Math.sqrt((dragEndX - state.dragStartX) ** 2 + (dragEndY - state.dragStartY) ** 2);
        let power = Math.min(dragDistance / 6, 25);
        if (dragDistance < 10) power = state.hitPower;

        hideVisualHelpers();
        hitBall(power);
    }

    function hitBall(power = state.hitPower) {
        initAudio();
        if (physics.isAnyBallMoving()) return;
        const cueBallObj = physics.getCueBall();
        if (!cueBallObj) return;

        playHitSound();

        if (win.navigator?.vibrate && state.isMobile) {
            const vibrationIntensity = Math.min(power * 2, 30);
            win.navigator.vibrate(vibrationIntensity);
        }

        cueBallObj.vx = -Math.cos(state.cueAngle) * power;
        cueBallObj.vy = -Math.sin(state.cueAngle) * power;

        const degrees = state.cueAngle * (180 / Math.PI);
        const baseTransform = `rotate(${degrees}deg)`;
        const recoil = Math.min(power * 0.8, 30);
        const hitTransform = `rotate(${degrees}deg) translateX(-${recoil}px)`;
        dom.cue.style.transform = hitTransform;
        win.setTimeout(() => {
            dom.cue.style.transform = baseTransform;
        }, 100);

        physics.startLoop();
        dom.cue.style.visibility = 'hidden';
    }

    function repositionCue() {
        const cueBallObj = physics.getCueBall();
        if (!cueBallObj || !dom.cue) return;
        const tipOffset = cueBallObj.radius + 4;
        const tipX = cueBallObj.x + Math.cos(state.cueAngle) * tipOffset;
        const tipY = cueBallObj.y + Math.sin(state.cueAngle) * tipOffset;
        const degrees = state.cueAngle * (180 / Math.PI);
        dom.cue.style.visibility = 'visible';
        dom.cue.style.transformOrigin = 'left center';
        dom.cue.style.left = '0px';
        dom.cue.style.top = '0px';
        dom.cue.style.transform = `translate(${tipX}px, ${tipY - dom.cue.offsetHeight / 2}px) rotate(${degrees}deg)`;
    }

    function addButtonListener(element, action) {
        if (!element) return;
        if (deviceInfo.isTouch) {
            element.addEventListener('touchstart', event => {
                event.preventDefault();
                event.stopPropagation();
                state.allowFullscreen = true;
                requestFullscreenIfPending(ctx, deviceInfo);
                action();
            }, { passive: false });
            element.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
            });
        } else {
            element.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                state.allowFullscreen = true;
                requestFullscreenIfPending(ctx, deviceInfo);
                action();
            });
        }

        element.addEventListener('touchstart', () => {
            element.style.transform = 'scale(0.95)';
        }, { passive: true });
        element.addEventListener('touchend', () => {
            element.style.transform = 'scale(1)';
        }, { passive: true });
        element.addEventListener('mousedown', () => {
            element.style.transform = 'scale(0.95)';
        });
        element.addEventListener('mouseup', () => {
            element.style.transform = 'scale(1)';
        });
    }

    function showHelp() {
        const helpModal = doc.getElementById('help-modal');
        if (helpModal) {
            helpModal.classList.remove('hidden');
            doc.body.style.overflow = 'hidden';
            doc.body.style.touchAction = 'auto';
            const scrollableContent = helpModal.querySelector('.overflow-y-auto');
            if (scrollableContent) {
                scrollableContent.scrollTop = 0;
            }
        }
    }

    function hideHelp() {
        const helpModal = doc.getElementById('help-modal');
        if (helpModal) {
            helpModal.classList.add('hidden');
            doc.body.style.overflow = '';
            doc.body.style.touchAction = 'none';
        }
    }

    function bindUI() {
        const resetButton = doc.getElementById('reset-button');
        const soundToggleButton = doc.getElementById('sound-toggle');
        const musicToggleButton = doc.getElementById('music-toggle');
        const helpButton = doc.getElementById('help-button');
        const closeHelp = doc.getElementById('close-help');
        const musicVolumeEl = doc.getElementById('music-volume');

        const soundToggleLandscape = doc.getElementById('sound-toggle-landscape');
        const musicToggleLandscape = doc.getElementById('music-toggle-landscape');
        const helpButtonLandscape = doc.getElementById('help-button-landscape');
        const resetButtonLandscape = doc.getElementById('reset-button-landscape');
        const musicVolumeLandscapeEl = doc.getElementById('music-volume-landscape');

        addButtonListener(resetButton, physics.resetGame);
        addButtonListener(soundToggleButton, toggleSound);
        addButtonListener(musicToggleButton, toggleMusic);
        addButtonListener(helpButton, showHelp);

        addButtonListener(soundToggleLandscape, toggleSound);
        addButtonListener(musicToggleLandscape, toggleMusic);
        addButtonListener(helpButtonLandscape, showHelp);
        addButtonListener(resetButtonLandscape, physics.resetGame);
        addButtonListener(closeHelp, hideHelp);

        if (musicVolumeEl) {
            musicVolumeEl.addEventListener('input', event => setMusicVolumeFromPercent(event.target.value));
            musicVolumeEl.addEventListener('change', event => setMusicVolumeFromPercent(event.target.value));
        }

        if (musicVolumeLandscapeEl) {
            musicVolumeLandscapeEl.addEventListener('input', event => setMusicVolumeFromPercent(event.target.value));
            musicVolumeLandscapeEl.addEventListener('change', event => setMusicVolumeFromPercent(event.target.value));
        }

        const helpModal = doc.getElementById('help-modal');
        if (helpModal) {
            helpModal.addEventListener('click', event => {
                if (event.target.id === 'help-modal') hideHelp();
            });

            const modalContent = helpModal.querySelector('.bg-white');
            if (modalContent) {
                modalContent.addEventListener('click', event => event.stopPropagation());
                modalContent.addEventListener('touchstart', event => event.stopPropagation());
                modalContent.addEventListener('touchmove', event => {
                    const scrollableElement = event.target.closest('.overflow-y-auto');
                    if (!scrollableElement) {
                        event.preventDefault();
                    }
                }, { passive: false });
            }
        }
    }

    function bindInputEvents() {
        dom.gameArea.addEventListener('mousemove', event => {
            aimCue(event);
            if (state.isDragging) {
                const tableRect = dom.table.getBoundingClientRect();
                const currentX = event.clientX - tableRect.left;
                const currentY = event.clientY - tableRect.top;
                const distance = Math.sqrt((currentX - state.dragStartX) ** 2 + (currentY - state.dragStartY) ** 2);
                updatePowerIndicator(Math.min(distance / 6, 25));
            }
        });

        dom.gameArea.addEventListener('mousedown', startDrag);
        win.addEventListener('mouseup', endDrag);

        dom.gameArea.addEventListener('touchmove', event => {
            const helpModal = doc.getElementById('help-modal');
            if (helpModal && !helpModal.classList.contains('hidden')) return;
            event.preventDefault();
            event.stopPropagation();
            aimCue(event);
            if (state.isDragging) {
                const tableRect = dom.table.getBoundingClientRect();
                const touch = event.touches[0] || event.changedTouches[0];
                const currentX = touch.clientX - tableRect.left;
                const currentY = touch.clientY - tableRect.top;
                const distance = Math.sqrt((currentX - state.dragStartX) ** 2 + (currentY - state.dragStartY) ** 2);
                updatePowerIndicator(Math.min(distance / 6, 25));
            }
        }, { passive: false });

        dom.gameArea.addEventListener('touchstart', event => {
            const helpModal = doc.getElementById('help-modal');
            if (helpModal && !helpModal.classList.contains('hidden')) return;
            event.preventDefault();
            event.stopPropagation();
            startDrag(event);
        }, { passive: false });

        dom.gameArea.addEventListener('touchend', event => {
            event.preventDefault();
            event.stopPropagation();
            endDrag(event);
        }, { passive: false });

        dom.gameArea.addEventListener('contextmenu', event => {
            event.preventDefault();
            return false;
        });

        dom.gameArea.addEventListener('gesturestart', event => {
            event.preventDefault();
        });
        dom.gameArea.addEventListener('gesturechange', event => {
            event.preventDefault();
        });
        dom.gameArea.addEventListener('gestureend', event => {
            event.preventDefault();
        });

        doc.addEventListener('keydown', event => {
            if (event.key === 'Escape') hideHelp();
            if (event.key === 'h' || event.key === 'H') showHelp();
            if (event.key === 's' || event.key === 'S') toggleSound();
            if (event.key === 'm' || event.key === 'M') toggleMusic();
        });
    }

    function setupBallStopBehaviour() {
        physics.onBallsStopped(repositionCue);
    }

    function prepareInitialState() {
        if (dom.gameArea) {
            dom.gameArea.classList.add('dynamic-scaling');
        }
        loadPreferences();
        physics.initCats();
        physics.initPockets();
        layoutManager.positionUIElements();
        startBackgroundMusicOnFirstInteraction();
    }

    function startBackgroundMusicOnFirstInteraction() {
        const handler = () => {
            if (state.musicEnabled) {
                initAudio();
                startBackgroundMusic();
            }
            state.allowFullscreen = true;
            requestFullscreenIfPending(ctx, deviceInfo);
            if (typeof fullscreenHandler === 'function') {
                fullscreenHandler();
            }
            doc.removeEventListener('mousedown', handler);
            doc.removeEventListener('touchstart', handler);
        };
        doc.addEventListener('mousedown', handler, { once: true });
        doc.addEventListener('touchstart', handler, { once: true });
    }

    function handleResizeSideEffects() {
        updateMobileFlags(ctx);
        physics.applyMobilePhysicsTweaks();
    }

    return {
        aimCue,
        startDrag,
        endDrag,
        hitBall,
        hideVisualHelpers,
        updatePowerIndicator,
        repositionCue,
        bindUI,
        bindInputEvents,
        setupBallStopBehaviour,
        prepareInitialState,
        handleResizeSideEffects
    };
}
