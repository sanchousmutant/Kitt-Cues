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
        const baseTableWidth = 600;
        const baseTableHeight = 400;
        const scaleFactorX = tableWidth / baseTableWidth;
        const scaleFactorY = tableHeight / baseTableHeight;
        const scaleFactor = Math.min(scaleFactorX, scaleFactorY);

        const cats = doc.querySelectorAll('.cat-container');
        cats.forEach(cat => {
            let baseScale = 1;
            if (win.innerWidth <= 280) {
                baseScale = 0.1;
            } else if (win.innerWidth <= 320) {
                baseScale = 0.15;
            } else if (win.innerWidth <= 375) {
                baseScale = 0.2;
            } else if (win.innerWidth <= 640) {
                baseScale = 0.3;
            } else if (win.innerWidth <= 1024) {
                baseScale = 1.1;
            }

            const finalScale = Math.max(0.05, baseScale * scaleFactor);
            if (!cat.dataset.baseTransform) {
                cat.dataset.baseTransform = cat.style.transform || '';
            }
            const baseTransform = cat.dataset.baseTransform;
            const transformParts = [];
            if (baseTransform && baseTransform.trim().length > 0) {
                transformParts.push(baseTransform.trim());
            }
            transformParts.push(`scale(${finalScale})`);
            cat.style.transform = transformParts.join(' ');
        });

        const balls = doc.querySelectorAll('.billiard-ball');
        balls.forEach(ball => {
            let baseSize = 16;
            if (win.innerWidth <= 280) {
                baseSize = 4;
            } else if (win.innerWidth <= 320) {
                baseSize = 5;
            } else if (win.innerWidth <= 375) {
                baseSize = 6;
            } else if (win.innerWidth <= 640) {
                baseSize = 10;
            }

            const finalSize = Math.max(3, baseSize * scaleFactor);
            ball.style.width = `${finalSize}px`;
            ball.style.height = `${finalSize}px`;
        });

        const pockets = doc.querySelectorAll('[data-pocket]');
        pockets.forEach(pocket => {
            let baseSize = 32;
            if (win.innerWidth <= 280) {
                baseSize = 12;
            } else if (win.innerWidth <= 320) {
                baseSize = 14;
            } else if (win.innerWidth <= 375) {
                baseSize = 16;
            } else if (win.innerWidth <= 640) {
                baseSize = 20;
            }

            const pocketScaleFactor = Math.max(0.8, scaleFactor);
            const finalSize = Math.max(8, baseSize * pocketScaleFactor);
            pocket.style.width = `${finalSize}px`;
            pocket.style.height = `${finalSize}px`;

            // Dynamic positioning correction
            const offset = -(finalSize * 0.25);
            const index = parseInt(pocket.dataset.pocket);

            // Reset potential conflicting inline styles first
            pocket.style.top = '';
            pocket.style.bottom = '';
            pocket.style.left = '';
            pocket.style.right = '';

            // Apply new dynamic positions
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
                // left is handled by CSS class w/ transform
            } else if (index === 5) { // Bottom-Middle
                pocket.style.bottom = `${offset}px`;
                // left is handled by CSS class w/ transform
            }
        });

        if (dom.cue) {
            let baseHeight = 8;
            let baseWidth = 40;
            if (win.innerWidth <= 280) {
                baseHeight = 1;
                baseWidth = 10;
            } else if (win.innerWidth <= 320) {
                baseHeight = 1;
                baseWidth = 15;
            } else if (win.innerWidth <= 375) {
                baseHeight = 1;
                baseWidth = 20;
            } else if (win.innerWidth <= 640) {
                baseHeight = 1;
                baseWidth = 25;
            }

            const finalHeight = Math.max(1, baseHeight * scaleFactor);
            const finalWidth = Math.max(5, baseWidth);

            dom.cue.style.height = `${finalHeight}px`;
            dom.cue.style.width = `${finalWidth}%`;
        }

        const buttons = doc.querySelectorAll('button');
        buttons.forEach(button => {
            if (button.closest('.landscape-mobile-controls')) return;

            let baseFontSize = 16;
            let basePaddingX = 16;
            let basePaddingY = 8;
            let baseMinWidth = 40;
            let baseMinHeight = 40;

            if (win.innerWidth <= 320) {
                baseFontSize = 8;
                basePaddingX = 4;
                basePaddingY = 2;
                baseMinWidth = 12;
                baseMinHeight = 12;
            } else if (win.innerWidth <= 375) {
                baseFontSize = 10;
                basePaddingX = 6;
                basePaddingY = 3;
                baseMinWidth = 16;
                baseMinHeight = 16;
            } else if (win.innerWidth <= 640) {
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

            button.style.fontSize = `${finalFontSize}px`;
            button.style.padding = `${finalPaddingY}px ${finalPaddingX}px`;
            button.style.minWidth = `${finalMinWidth}px`;
            button.style.minHeight = `${finalMinHeight}px`;
        });

        const landscapeButtons = doc.querySelectorAll('.landscape-mobile-controls button');
        landscapeButtons.forEach(button => {
            let baseFontSize = 10;
            let basePaddingX = 4;
            let basePaddingY = 2;
            let baseMinWidth = 16;
            let baseMinHeight = 16;

            if (win.innerWidth <= 320) {
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

        const scoreElements = [
            doc.getElementById('score-display'),
            doc.getElementById('score-display-landscape')
        ];

        scoreElements.forEach(element => {
            if (!element) return;

            let baseFontSize = 18;
            let basePaddingX = 32;
            let basePaddingY = 16;

            if (win.innerWidth <= 320) {
                baseFontSize = 8;
                basePaddingX = 8;
                basePaddingY = 4;
            } else if (win.innerWidth <= 375) {
                baseFontSize = 10;
                basePaddingX = 12;
                basePaddingY = 6;
            } else if (win.innerWidth <= 640) {
                baseFontSize = 14;
                basePaddingX = 16;
                basePaddingY = 8;
            } else if (element.id === 'score-display-landscape') {
                baseFontSize = 12;
                basePaddingX = 12;
                basePaddingY = 4;
            }

            const finalFontSize = Math.max(8, baseFontSize * scaleFactor);
            const finalPaddingX = Math.max(4, basePaddingX * scaleFactor);
            const finalPaddingY = Math.max(2, basePaddingY * scaleFactor);

            element.style.fontSize = `${finalFontSize}px`;
            element.style.padding = `${finalPaddingY}px ${finalPaddingX}px`;

            if (element.id === 'score-display') {
                const baseMinWidth = 80;
                const finalMinWidth = Math.max(40, baseMinWidth * scaleFactor);
                element.style.minWidth = `${finalMinWidth}px`;
            }
        });
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
