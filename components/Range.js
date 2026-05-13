import Circle from "../objects/Circle.js";
import Cursor from "../objects/Cursor.js";
import {createRoundedRectPath, getAngle360, getRadAngle, map} from '../utils/utils.js'

class Range extends HTMLElement {

    constructor() {
        super();
        this.attachShadow({mode: 'open'});
    }

    connectedCallback() {
        this.minValue = this.getAttribute('minValue') || -255;
        this.maxValue = this.getAttribute('maxValue') || 255;
        const value = this.getAttribute('value') || 0;
        const size = this.getAttribute('size') || Math.min(window.innerWidth / 2 - 30, 300);
        const label = this.getAttribute('label') || 'Value: ';
        let angle = getAngle360(this.getAttribute('angle'));
        const visibleLabel = this.getAttribute('visibleLabel') === 'true';

        this.shadowRoot.innerHTML = `
            <style>
                
                :host {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin: 10px;         
                }
                
                .container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
    
                canvas {
                    image-rendering: pixelated;
                    border-width: 1px;
                    border-style: solid;
                    border-radius: ${size}px;
                }
                
                #label-canvas {
                    visibility: ${visibleLabel ? 'visible' : 'hidden'};
                }
              
                
            </style>
            <span id="container" class="container">
                <label id="label-canvas" for="canvas">${label}<span id="valueSpan">${value}</span></label>
                <canvas width="${size}" height="${size}" class="canvas" id="canvas"></canvas>
            </span>
        `;

        const geMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const localPoint = getLocalPoint(Math.floor(e.clientX - rect.left), Math.floor(e.clientY - rect.top), pos0, angle);
            cursor.x = localPoint.x;
            cursor.y = localPoint.y;
        };

        const rotateCanvas = () => {
            ctx.translate(pos0.x, pos0.y);
            ctx.rotate((getRadAngle(angle)));
            ctx.translate(-pos0.x, -pos0.y);
        }

        function getLocalPoint(cursorX, cursorY, pivot, angleInDegrees) {
            const dx = cursorX - pivot.x;
            const dy = cursorY - pivot.y;

            const rad = -getRadAngle(angleInDegrees);
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            const rx = dx * cos - dy * sin;
            const ry = dx * sin + dy * cos;

            return {
                x: rx + pivot.x,
                y: ry + pivot.y
            };
        }

        const canvas = this.shadowRoot.querySelector('canvas');
        const ctx = canvas.getContext("2d");
        const padding = 10;
        const trackLineWidth = 6;
        const thumbSuppRingLineWidth = 5;
        const thumbRingLineWidth = 5;
        const centerX = Math.floor(size / 2);
        const centerY = Math.floor(size / 2);
        const pos0 = { x: centerX, y: centerY };
        const thumbRingWidth = Math.floor(size * 0.15);
        const thumbRingHeight = Math.floor(size * 0.3);
        const thumbRingRadius = Math.floor((thumbRingWidth < thumbRingHeight ? thumbRingWidth : thumbRingHeight) * 0.5);
        const thumbSuppRingRadius = Math.floor(thumbRingWidth * 0.3);
        const trackHeight = thumbSuppRingRadius + thumbSuppRingLineWidth + trackLineWidth;
        const cursor = new Cursor(centerX, centerY);

        this.drawObjects = {
            track: null,
            thumb: null,
        }

        let isDragging = false;

        this.draw = (x) => {

            ctx.clearRect(0, 0, size, size);

            ctx.save();
            rotateCanvas();

            this.drawObjects.track = {
                color: "lightgray",
                lineWidth: trackLineWidth,
                x: padding + trackLineWidth + thumbSuppRingRadius / 2,
                y: pos0.y - (trackHeight + trackLineWidth) / 2,
                width: size - padding * 2 - thumbSuppRingRadius - trackLineWidth * 2,
                height: trackHeight + trackLineWidth,
                radius: thumbSuppRingRadius + thumbSuppRingLineWidth,
                path: null,
                minX: null,
                maxX: null,
                init() {
                    this.path = createRoundedRectPath(this.x, this.y, this.width, this.height, this.radius);
                    this.minX = this.x + this.radius;
                    this.maxX = this.x + this.width - this.radius;
                },
                draw() {
                    if (!this.path) this.init();

                    ctx.save();
                    ctx.strokeStyle = this.color;
                    ctx.lineWidth = this.lineWidth;
                    ctx.stroke(this.path);
                    ctx.restore();
                }
            };

            this.drawObjects.track.draw();

            const thumbSuppCircle = new Circle(cursor.x, cursor.y, thumbSuppRingRadius, thumbSuppRingLineWidth);
            const thumbCircle = new Circle(cursor.x, cursor.y, thumbRingRadius, thumbRingLineWidth);

            this.drawObjects.thumb = {
                suppPath: new Path2D(),
                path: new Path2D(),
                pressedPath: new Path2D(),
                draw(x, y) {

                    ctx.save();
                    this.suppPath.arc(x, y, thumbSuppCircle.radius, 0, Math.PI * 2, true);
                    ctx.lineWidth = thumbSuppCircle.lineWidth;
                    ctx.strokeStyle = "lightgray";
                    ctx.stroke(this.suppPath);

                    this.path = createRoundedRectPath(x - thumbRingWidth / 2, y - thumbRingHeight / 2, thumbRingWidth, thumbRingHeight, thumbRingRadius);
                    ctx.globalAlpha = 0.7;
                    ctx.lineWidth = thumbCircle.lineWidth;
                    ctx.fillStyle = "red";
                    ctx.fill(this.path);

                    if (isDragging) {
                        this.pressedPath = this.path;
                        ctx.globalAlpha = 1;
                        ctx.lineWidth = thumbCircle.lineWidth;
                        ctx.strokeStyle = "black";
                        ctx.stroke(this.pressedPath);
                    }

                    ctx.restore();
                },
                isPointInside(x, y) {
                    if (!this.path) this.init();

                    ctx.save();
                    const isHit = ctx.isPointInPath(this.path, x, y);
                    ctx.restore();
                    return isHit;
                }
            };

            this.drawObjects.thumb.draw(x, pos0.y);

            ctx.restore();
        }

        this.draw(pos0.x);

        const handleDown = (e) => {
            geMousePos(e);
            if (this.drawObjects.thumb.isPointInside(cursor.x, cursor.y)) {
                isDragging = true;
                window.addEventListener('mousemove', handleMove);
                window.addEventListener('mouseup', handleUp);
            }
            this.value = 0;
        }
        const handleMove = (e) => {
            if (isDragging) {
                geMousePos(e);
                const x = cursor.x > this.drawObjects.track.maxX ? this.drawObjects.track.maxX : cursor.x < this.drawObjects.track.minX ?  this.drawObjects.track.minX : cursor.x;
                const convValue = Math.floor(map(x, this.drawObjects.track.minX, this.drawObjects.track.maxX, this.minValue, this.maxValue));
                this.dispatchEvent(new CustomEvent('value-change', {
                    detail: {data: convValue},
                    bubbles: true,
                    composed: true
                }));
            }
        }
        const handleUp = (e) => {
            isDragging = false;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            this.dispatchEvent(new CustomEvent('value-change', {
                detail: {data: pos0},
                bubbles: true,
                composed: true
            }));
        }

        canvas.addEventListener('mousedown', handleDown);
        canvas.addEventListener("mousemove", handleMove);
        canvas.addEventListener('mouseup', handleUp);

        // Touch support
        let activeTouchId = null;

        const getTouchPos = (touch) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const localPoint = getLocalPoint(
                Math.floor((touch.clientX - rect.left) * scaleX),
                Math.floor((touch.clientY - rect.top) * scaleY),
                pos0,
                angle
            );
            cursor.x = localPoint.x;
            cursor.y = localPoint.y;
        };

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Only claim the first new touch that lands on the thumb
            for (const touch of e.changedTouches) {
                if (activeTouchId !== null) break; // already claimed
                getTouchPos(touch);
                if (this.drawObjects.thumb.isPointInside(cursor.x, cursor.y)) {
                    activeTouchId = touch.identifier;
                    isDragging = true;
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier !== activeTouchId) continue; // not our finger
                getTouchPos(touch);
                const x = cursor.x > this.drawObjects.track.maxX ? this.drawObjects.track.maxX
                    : cursor.x < this.drawObjects.track.minX ? this.drawObjects.track.minX
                        : cursor.x;
                const convValue = Math.floor(map(x, this.drawObjects.track.minX, this.drawObjects.track.maxX, this.minValue, this.maxValue));
                this.draw(x);
                this.shadowRoot.querySelector('#valueSpan').innerText = convValue;
                this.dispatchEvent(new CustomEvent('value-change', {
                    detail: { data: convValue },
                    bubbles: true,
                    composed: true
                }));
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier !== activeTouchId) continue; // not our finger
                activeTouchId = null;
                isDragging = false;
                this.dispatchEvent(new CustomEvent('value-change', {
                    detail: { data: 0 },
                    bubbles: true,
                    composed: true
                }));
                this.value = 0; // snap back to 0 on release
            }
        }, { passive: false });

    }

    set value(val) {
        this.setAttribute('value', val);
        const convValue = Math.floor(map(val, this.minValue, this.maxValue, this.drawObjects.track.minX, this.drawObjects.track.maxX));
        window.requestAnimationFrame(() => this.draw(convValue));
        this.shadowRoot.querySelector('#valueSpan').innerText = val;
    }

    get value() {
        return this.shadowRoot.querySelector('#valueSpan')?.innerText|| 0;
    }
}

customElements.define('inp-range', Range);