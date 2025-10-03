export function applyFrictionComponent(velocity, friction, minVelocity) {
    const scaled = velocity * friction;
    return Math.abs(scaled) < minVelocity ? 0 : scaled;
}

export function resolveElasticCollision(ballA, ballB) {
    const dx = ballB.x - ballA.x;
    const dy = ballB.y - ballA.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const angle = Math.atan2(dy, dx);
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    const velocityA = rotate(ballA.vx, ballA.vy, sin, cos);
    const velocityB = rotate(ballB.vx, ballB.vy, sin, cos);

    const swappedAx = velocityB.x;
    const swappedBx = velocityA.x;

    const updatedVelocityA = rotateBack(swappedAx, velocityA.y, sin, cos);
    const updatedVelocityB = rotateBack(swappedBx, velocityB.y, sin, cos);

    const overlap = ballA.radius + ballB.radius - distance + 1;
    const moveX = (overlap / 2) * cos;
    const moveY = (overlap / 2) * sin;

    return {
        ballA: {
            vx: updatedVelocityA.x,
            vy: updatedVelocityA.y,
            dx: -moveX,
            dy: -moveY
        },
        ballB: {
            vx: updatedVelocityB.x,
            vy: updatedVelocityB.y,
            dx: moveX,
            dy: moveY
        }
    };
}

function rotate(vx, vy, sin, cos) {
    return {
        x: vx * cos + vy * sin,
        y: vy * cos - vx * sin
    };
}

function rotateBack(vx, vy, sin, cos) {
    return {
        x: vx * cos - vy * sin,
        y: vy * cos + vx * sin
    };
}
