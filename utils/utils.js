export const map = (value, in_min, in_max, out_min, out_max) => {
    return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

export const getAngle360 = (angle) => {
    let val = angle || 0;
    if (val < 0) {
        val = 360 - Math.abs(val);
    }
    return val;
}

export const getRadAngle = (degAngle) => {
    return degAngle * Math.PI / 180;
}

export function createRoundedRectPath(x, y, width, height, radius) {
    const path = new Path2D();
    path.moveTo(x, y + radius);
    path.arcTo(x, y + height, x + radius, y + height, radius);
    path.arcTo(x + width, y + height, x + width, y + height - radius, radius);
    path.arcTo(x + width, y, x + width - radius, y, radius);
    path.arcTo(x, y, x, y + radius, radius);
    path.closePath();
    return path;
}

/**
 * Checks if a point (x1, y1) is inside a rounded rectangle.
 */
export function isPointInRoundedRect(x1, y1, x, y, width, height, radius) {

    // 1. Quick check: Is it even within the bounding box?
    if (x1 < x || x1 > x + width || y1 < y || y1 > y + height) {
        return false;
    }

    // 2. Check the four corner "danger zones"
    // Top-left
    if (x1 < x + radius && y1 < y + radius) {
        return Math.hypot(x1 - (x + radius), y1 - (y + radius)) <= radius;
    }
    // Top-right
    if (x1 > x + width - radius && y1 < y + radius) {
        return Math.hypot(x1 - (x + width - radius), y1 - (y + radius)) <= radius;
    }
    // Bottom-right
    if (x1 > x + width - radius && y1 > y + height - radius) {
        return Math.hypot(x1 - (x + width - radius), y1 - (y + height - radius)) <= radius;
    }
    // Bottom-left
    if (x1 < x + radius && y1 > y + height - radius) {
        return Math.hypot(x1 - (x + radius), y1 - (y + height - radius)) <= radius;
    }

    // 3. If it's in the box and not excluded by the corners, it's inside!
    return true;
}