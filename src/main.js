import { createGameContext } from './game/context.js';
import { detectDeviceInfo, applyDeviceOptimizations, maybeAttemptFullscreen, checkOrientation } from './game/device.js';
import { createAudioManager } from './game/audio.js';
import { createPhysicsEngine } from './game/physics.js';
import { createLayoutManager } from './game/layout.js';
import { createControlManager } from './game/controls.js';
import { createPWAHandler } from './game/pwa.js';

document.addEventListener('DOMContentLoaded', () => {
    const ctx = createGameContext(window, document);
    const deviceInfo = detectDeviceInfo(window);
    const audioManager = createAudioManager(ctx, deviceInfo);
    const physics = createPhysicsEngine(ctx, audioManager);
    const layoutManager = createLayoutManager(ctx, physics);
    const controls = createControlManager(ctx, physics, audioManager, deviceInfo, layoutManager, () => maybeAttemptFullscreen(ctx, deviceInfo));
    const pwaHandler = createPWAHandler(ctx);

    applyDeviceOptimizations(ctx, deviceInfo);

    controls.bindUI();
    controls.bindInputEvents();
    controls.setupBallStopBehaviour();
    controls.prepareInitialState();

    layoutManager.debouncedRecomputeLayout();
    checkOrientation(ctx);

    const handleResize = () => {
        controls.handleResizeSideEffects();
        layoutManager.debouncedRecomputeLayout();
        maybeAttemptFullscreen(ctx, deviceInfo);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
        setTimeout(handleResize, 200);
    });

    pwaHandler.registerServiceWorker();
    pwaHandler.setupListeners();
});
