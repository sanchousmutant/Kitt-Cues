import { updateMobileFlags } from './context.js';

function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

export function createLayoutManager(ctx, physics) {
    const { document: doc, window: win, dom, state } = ctx;

    function applyDynamicScaling(tableWidth, tableHeight) {
        const baseTableWidth = 800;
        const scaleFactor = Math.min(tableWidth / baseTableWidth, tableHeight / (baseTableWidth / 1.5));

        const cats = doc.querySelectorAll('.cat-container');
        cats.forEach(cat => {
            const baseScale = 0.8; 
            const finalScale = Math.max(0.2, baseScale * scaleFactor);
            if (!cat.dataset.baseTransform) {
                cat.dataset.baseTransform = cat.style.transform || '';
            }
            cat.style.transform = `${cat.dataset.baseTransform} scale(${finalScale})`;
        });

        const balls = doc.querySelectorAll('.billiard-ball');
        balls.forEach(ball => {
            const baseSize = 20; 
            const finalSize = Math.max(5, baseSize * scaleFactor);
            ball.style.width = `${finalSize}px`;
            ball.style.height = `${finalSize}px`;
        });

        const pockets = doc.querySelectorAll('[data-pocket]');
        pockets.forEach(pocket => {
            const baseSize = 40; 
            const finalSize = Math.max(10, baseSize * scaleFactor);
            pocket.style.width = `${finalSize}px`;
            pocket.style.height = `${finalSize}px`;
            
            const tableComputedStyle = win.getComputedStyle(dom.table);
            const tablePadding = parseFloat(tableComputedStyle.paddingTop) || 0;
            const offset = -(finalSize * 0.5 + tablePadding);
            const index = parseInt(pocket.dataset.pocket);

            pocket.style.top = '';
            pocket.style.bottom = '';
            pocket.style.left = '';
            pocket.style.right = '';
            pocket.style.transform = '';

            if (index === 0) { // Top-Left
                pocket.style.top = `${offset}px`;
                pocket.style.left = `${offset}px`;
            } else if (index === 1) { // Top-Right
                pocket.style.top = `${offset}px`;
                pocket.style.right = `${offset}px`;
            } else if (index === 2) { // Bottom-Left
                pocket.style.bottom = `${offset}px`;
                pocket.style.left = `${offset}px`;
            } else if (index === 3) { // Bottom-Right
                pocket.style.bottom = `${offset}px`;
                pocket.style.right = `${offset}px`;
            } else if (index === 4) { // Top-Middle
                pocket.style.top = `${offset}px`;
                pocket.style.left = '50%';
                pocket.style.transform = 'translateX(-50%)';
            } else if (index === 5) { // Bottom-Middle
                pocket.style.bottom = `${offset}px`;
                pocket.style.left = '50%';
                pocket.style.transform = 'translateX(-50%)';
            }
        });

        if (dom.cue) {
            const baseHeight = 6;
            const finalHeight = Math.max(2, baseHeight * scaleFactor);
            dom.cue.style.height = `${finalHeight}px`;
            const baseWidth = 40; 
            dom.cue.style.width = `${baseWidth * Math.max(0.5, scaleFactor)}%`;
        }
    }

    function positionUIElements() {
        const { gameArea, powerIndicator } = dom;
        if (!gameArea || !dom.table) return;

        const gameAreaRect = gameArea.getBoundingClientRect();
        const tableRect = dom.table.parentElement?.getBoundingClientRect();
        if (!tableRect) return;

        const baseTableWidth = 600;
        const scaleFactor = Math.min(tableRect.width / baseTableWidth, 1.5);
        const margin = Math.max(10, 20 * scaleFactor);

        const leftButtons = doc.querySelector('#sound-toggle')?.parentElement;
        if (leftButtons && tableRect) {
            const leftX = tableRect.left - gameAreaRect.left - leftButtons.offsetWidth - margin;
            leftButtons.style.left = `${Math.max(10, leftX)}px`;
            leftButtons.style.right = 'auto';
        }

        const tableRightEdge = (gameAreaRect.width - dom.table.parentElement.offsetWidth) / 2 + dom.table.parentElement.offsetWidth;
        const commonLeftOffset = tableRightEdge + margin;

        const resetButton = doc.getElementById('reset-button');
        if (resetButton?.parentElement) {
            const rightButton = resetButton.parentElement;
            rightButton.style.left = `${commonLeftOffset}px`;
            rightButton.style.right = 'auto';

            const scoreDisplay = doc.getElementById('score-display');
            if (scoreDisplay?.parentElement) {
                const topRightScore = scoreDisplay.parentElement;
                const topY = tableRect.top - gameAreaRect.top - topRightScore.offsetHeight - margin;
                topRightScore.style.top = `${Math.max(10, topY)}px`;
                topRightScore.style.left = `${commonLeftOffset}px`;
                topRightScore.style.right = 'auto';
                topRightScore.style.bottom = 'auto';
            }
        }

        const mobileButtons = doc.querySelector('.landscape-mobile-controls');
        if (mobileButtons) {
            const topY = tableRect.top - gameAreaRect.top - mobileButtons.offsetHeight - margin;
            mobileButtons.style.top = `${Math.max(10, topY)}px`;
            mobileButtons.style.bottom = 'auto';
        }

        const mobileScore = doc.getElementById('score-display-landscape')?.parentElement;
        if (mobileScore) {
            const topY = tableRect.top - gameAreaRect.top - mobileScore.offsetHeight - margin;
            mobileScore.style.top = `${Math.max(10, topY)}px`;
            mobileScore.style.bottom = 'auto';
        }

        /* Power indicator is now handled by controls.js dynamically
        if (powerIndicator) {
            powerIndicator.style.left = `${dom.table.offsetWidth * 0.5 - 50}px`;
            powerIndicator.style.top = `${dom.table.offsetHeight * 0.5 - 30}px`;
        }
        */
    }

    function handleResize() {
        updateMobileFlags(ctx);

        const { gameArea } = dom;
        const table = dom.table;
        const tableContainer = doc.getElementById('billiard-table-container');
        if (!gameArea || !table || !tableContainer) return;

        const gameAreaStyle = win.getComputedStyle(gameArea);
        const paddingLeft = parseFloat(gameAreaStyle.paddingLeft);
        const paddingRight = parseFloat(gameAreaStyle.paddingRight);
        const paddingTop = parseFloat(gameAreaStyle.paddingTop);
        const paddingBottom = parseFloat(gameAreaStyle.paddingBottom);

        const gameAreaRect = gameArea.getBoundingClientRect();
        const availableWidth = gameAreaRect.width - paddingLeft - paddingRight;
        const availableHeight = gameAreaRect.height - paddingTop - paddingBottom;

        const aspectRatio = 1.5;
        let tableWidth;
        let tableHeight;

        if (availableWidth / availableHeight > aspectRatio) {
            tableHeight = availableHeight;
            tableWidth = tableHeight * aspectRatio;
        } else {
            tableWidth = availableWidth;
            tableHeight = tableWidth / aspectRatio;
        }

        const borderWidth = 20;
        const containerWidth = tableWidth + borderWidth * 2;
        const containerHeight = tableHeight + borderWidth * 2;

        tableContainer.style.width = `${containerWidth}px`;
        tableContainer.style.height = `${containerHeight}px`;
        tableContainer.style.left = `${paddingLeft + (availableWidth - containerWidth) / 2}px`;
        tableContainer.style.top = `${paddingTop + (availableHeight - containerHeight) / 2}px`;

        table.style.width = `${tableWidth}px`;
        table.style.height = `${tableHeight}px`;
        table.style.left = `${borderWidth}px`;
        table.style.top = `${borderWidth}px`;

        applyDynamicScaling(tableWidth, tableHeight);

        physics.initCats();
        physics.initPockets();
        physics.initBalls();

        win.setTimeout(() => {
            positionUIElements();
        }, 50);
    }

    const recomputeLayout = () => {
        handleResize();
        positionUIElements();
        if (!state.didInitialReset) {
            physics.resetGame();
            state.didInitialReset = true;
        }
    };

    const debouncedRecomputeLayout = debounce(recomputeLayout, 100);

    return {
        recomputeLayout,
        debouncedRecomputeLayout,
        handleResize,
        positionUIElements
    };
}
