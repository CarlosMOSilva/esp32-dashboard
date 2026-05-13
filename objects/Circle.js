export default class Circle {
    constructor(x, y, radius, lineWidth) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.lineWidth = lineWidth;
    }

    isCircleFullyInside(c1) {
        const dx = c1.x - this.x;
        const dy = c1.y - this.y;
        const centerDist = Math.sqrt(dx * dx + dy * dy);

        const effRadius1 = c1.radius + (c1.lineWidth / 2);

        const internalLimit2 = this.radius - (this.lineWidth / 2);

        return (centerDist + effRadius1) <= internalLimit2;
    }

    getClosestPositionInRadius(x2, y2, r1) {
        const dx = x2 - this.x;
        const dy = y2 - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const x1 = this.x + this.radius * (x2 - this.x) / d - r1 * ((x2 - this.x) / d);
        const y1 = this.y + this.radius * (y2 - this.y) / d - r1 * ((y2 - this.y) / d);
        return {x1: Math.floor(x1), y1: Math.floor(y1)};
    }
}