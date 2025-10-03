export function createGameContext(win = window, doc = document) {
    const gameArea = doc.getElementById('game-area');
    const table = doc.getElementById('billiard-table');
    const cue = doc.getElementById('cue');
    const aimLine = doc.getElementById('aim-line');
    const powerIndicator = doc.getElementById('power-indicator');
    const powerFill = doc.getElementById('power-fill');
    const pyramidContainer = doc.getElementById('ball-pyramid');

    const dom = {
        gameArea,
        table,
        cue,
        aimLine,
        powerIndicator,
        powerFill,
        pyramidContainer
    };

    const state = {
        friction: 0.985,
        minVelocity: 0.05,
        hitPower: 15,
        pawHitPower: 4,
        catCooldown: 60,
        balls: [],
        cats: [],
        pockets: [],
        score: 0,
        animationFrameId: null,
        cueAngle: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        audioContext: null,
        soundEnabled: true,
        musicEnabled: true,
        backgroundMusic: null,
        isMusicPlaying: false,
        isMobile: win.innerWidth <= 640,
        isPortrait: win.innerHeight > win.innerWidth,
        musicVolume: 0.45,
        didInitialReset: false,
        deferredPrompt: null,
        installButton: null,
        isInstallable: false,
        allowFullscreen: false,
        pendingFullscreen: false
    };

    return {
        window: win,
        document: doc,
        dom,
        state
    };
}

export function updateMobileFlags(ctx) {
    const { state, window: win } = ctx;
    state.isMobile = win.innerWidth <= 640;
    state.isPortrait = win.innerHeight > win.innerWidth;
}
