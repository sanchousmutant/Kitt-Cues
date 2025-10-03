import { updateMobileFlags } from './context.js';

export function detectDeviceInfo(win = window) {
    const ua = win.navigator?.userAgent || '';
    return {
        isIOS: /iPad|iPhone|iPod/.test(ua),
        isAndroid: /Android/.test(ua),
        isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
        isChrome: /Chrome/.test(ua) && !/Edg/.test(ua),
        isFirefox: /Firefox/.test(ua),
        isEdge: /Edg/.test(ua),
        isSamsung: /Samsung/.test(ua),
        isTouch: 'ontouchstart' in win || (win.navigator?.maxTouchPoints || 0) > 0,
        supportsVibration: typeof win.navigator?.vibrate === 'function' ||
            typeof win.navigator?.webkitVibrate === 'function' ||
            typeof win.navigator?.mozVibrate === 'function' ||
            typeof win.navigator?.msVibrate === 'function',
        supportsOrientation: 'orientation' in win || 'onorientationchange' in win
    };
}

export function applyDeviceOptimizations(ctx, deviceInfo) {
    const { document: doc, state, window: win } = ctx;
    const body = doc.body;

    if (!body) return;

    if (deviceInfo.isIOS) {
        body.classList.add('ios-device');
        body.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.width = '100%';
        body.style.height = '100%';

        const viewport = doc.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        }
    }

    if (deviceInfo.isAndroid) {
        body.classList.add('android-device');
        body.style.transform = 'translateZ(0)';
    }

    if (deviceInfo.isSamsung) {
        body.classList.add('samsung-browser');
    }

    if (state.isMobile) {
        tryVibrate(ctx, 0);
    }

    updateMobileFlags(ctx);

    setTimeout(() => maybeAttemptFullscreen(ctx, deviceInfo), 100);

    if (deviceInfo.supportsOrientation) {
        win.addEventListener('orientationchange', () => {
            setTimeout(() => {
                updateMobileFlags(ctx);
                handleOrientationDrivenFullscreen(ctx, deviceInfo);
            }, 200);
        });
    }
}

export async function maybeAttemptFullscreen(ctx, deviceInfo) {
    const { state, document: doc } = ctx;
    updateMobileFlags(ctx);

    const shouldBeFullscreen = state.isMobile && !state.isPortrait;
    const active = isFullscreenActive(doc);

    if (shouldBeFullscreen && !active) {
        if (state.allowFullscreen) {
            try {
                await enterFullscreen(doc);
                state.pendingFullscreen = false;
            } catch (error) {
                state.pendingFullscreen = true;
                console.log('Fullscreen request was blocked:', error);
            }
        } else {
            state.pendingFullscreen = true;
        }
    } else if ((!shouldBeFullscreen || state.isPortrait) && active) {
        exitFullscreen(doc);
        state.pendingFullscreen = false;
    }

    const rotationNotice = doc.getElementById('rotation-notice');
    if (rotationNotice) {
        rotationNotice.style.display = state.isMobile && state.isPortrait ? 'flex' : 'none';
    }

    if (deviceInfo.supportsOrientation && state.isMobile) {
        tryVibrate(ctx, 50);
    }
}

export function handleOrientationDrivenFullscreen(ctx, deviceInfo) {
    const { state } = ctx;
    updateMobileFlags(ctx);

    if (state.isMobile && !state.isPortrait) {
        state.pendingFullscreen = true;
    }

    maybeAttemptFullscreen(ctx, deviceInfo);
}

export function tryVibrate(ctx, pattern) {
    const { state, window: win } = ctx;
    if (!state.isMobile) return;

    const nav = win.navigator;
    if (!nav) return;

    const vibrationFn = nav.vibrate || nav.webkitVibrate || nav.mozVibrate || nav.msVibrate;
    if (typeof vibrationFn === 'function' && pattern) {
        try {
            vibrationFn.call(nav, pattern);
        } catch (error) {
            console.log('Vibration not supported:', error);
        }
    }
}

export function enterFullscreen(doc = document) {
    const el = doc.documentElement;
    if (el.requestFullscreen) {
        return el.requestFullscreen();
    }
    if (el.webkitRequestFullscreen) {
        return el.webkitRequestFullscreen();
    }
    if (el.mozRequestFullScreen) {
        return el.mozRequestFullScreen();
    }
    if (el.msRequestFullscreen) {
        return el.msRequestFullscreen();
    }
    return Promise.reject(new Error('Fullscreen API not supported'));
}

export function exitFullscreen(doc = document) {
    if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
    }
}

export function isFullscreenActive(doc = document) {
    return Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
    );
}

export function checkOrientation(ctx) {
    updateMobileFlags(ctx);
    const { document: doc, state } = ctx;
    const rotationNotice = doc.getElementById('rotation-notice');
    if (rotationNotice) {
        rotationNotice.style.display = state.isMobile && state.isPortrait ? 'flex' : 'none';
    }
}

export function requestFullscreenIfPending(ctx, deviceInfo) {
    const { state } = ctx;
    if (!state.pendingFullscreen) return;
    state.allowFullscreen = true;
    maybeAttemptFullscreen(ctx, deviceInfo);
}
