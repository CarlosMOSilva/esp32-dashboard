import Circle from '../objects/Circle.js'
import {map} from '../utils/utils.js'
import Cursor from "../objects/Cursor.js";


class Joystick extends HTMLElement {

    constructor() {
        super();
        this.attachShadow({mode: 'open'});
    }

    static get observedAttributes() {
        return ['x'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'x') {
            this.updateInternalInput(newValue);
        }
    }

    static get observedAttributes() {
        return ['y'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'y') {
            this.updateInternalInput(newValue);
        }
    }

    updateInternalInput(val) {
        const input = this.shadowRoot?.querySelector('input');
        const display = this.shadowRoot?.querySelector('#pwm');
        if (input) input.value = val;
        if (display) display.innerText = val;
    }

    connectedCallback() {
        const minX = this.getAttribute('minX') || -255;
        const maxX = this.getAttribute('maxX') || 255;
        const minY = this.getAttribute('minY') || -255;
        const maxY = this.getAttribute('maxY') || 255;
        const width = this.getAttribute('width') || 350;
        const height = this.getAttribute('height') || 350;
        const label = this.getAttribute('label') || 'Values: ';
        const angle = this.getAttribute('angle') || 0;

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
                }
            </style>
            <span id="container" class="container">
                <label for="canvas">${label}<span id="xValue"></span>, <span id="yValue"></span></label>
                <canvas width="${width}" height="${height}" class="canvas" id="canvas"></canvas>
            </span>
        `;

        const geMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            cursor.x = Math.floor(e.clientX - rect.left);
            cursor.y = Math.floor(e.clientY - rect.top);
        };

        const canvas = this.shadowRoot.querySelector('canvas');
        const xValue = this.shadowRoot.querySelector('#xValue');
        const yValue = this.shadowRoot.querySelector('#yValue');
        xValue.innerText = 0;
        yValue.innerText = 0;

        const ctx = canvas.getContext("2d");

        const padding = 0;
        const extRingLineWidth = 10;
        const thumbSuppRingLineWidth = 5;
        const thumbRingLineWidth = 5;
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);

        //radius
        const thumbRingRadius = Math.floor((width > height ? height : width) * 0.15);
        const thumbSuppRingRadius = Math.floor(thumbRingRadius * 0.3);
        const limitRadius = Math.floor((width > height ? height : width) / 2 - (thumbRingRadius - thumbSuppRingRadius) - thumbSuppRingLineWidth / 2 - thumbRingLineWidth / 2 - padding - extRingLineWidth / 2);

        const limitCircle = new Circle(centerX, centerY, limitRadius, extRingLineWidth);
        const xRealMin = Math.floor(centerX - limitRadius + thumbSuppRingRadius + extRingLineWidth / 2 + thumbSuppRingLineWidth / 2);
        const xRealMax = Math.floor(centerX + limitRadius - thumbSuppRingRadius - extRingLineWidth / 2 - thumbSuppRingLineWidth / 2);
        const yRealMin = Math.floor(centerY - limitRadius + thumbSuppRingRadius + extRingLineWidth / 2 + thumbSuppRingLineWidth / 2);
        const yRealMax = Math.floor(centerY + limitRadius - thumbSuppRingRadius - extRingLineWidth / 2 - thumbSuppRingLineWidth / 2);

        const cursor = new Cursor(centerX, centerY);

        let lastValidX = centerX;
        let lastValidY = centerY;
        let isDragging = false;

        const draw = () => {

            ctx.clearRect(0, 0, width, height);

            const limitRing = new Path2D();
            limitRing.arc(limitCircle.x, limitCircle.y, limitCircle.radius, 0, Math.PI * 2, true);
            ctx.lineWidth = extRingLineWidth;
            ctx.strokeStyle = "lightgray";
            ctx.stroke(limitRing);

            const thumbSuppCircle = new Circle(cursor.x, cursor.y, thumbSuppRingRadius, thumbSuppRingLineWidth);
            const thumbCircle = new Circle(cursor.x, cursor.y, thumbRingRadius, thumbRingLineWidth);

            if (limitCircle.isCircleFullyInside(thumbSuppCircle)) {
                lastValidX = cursor.x;
                lastValidY = cursor.y;
            } else {
                const pos = limitCircle.getClosestPositionInRadius(cursor.x, cursor.y, thumbSuppRingRadius + thumbSuppRingLineWidth / 2 + extRingLineWidth / 2);
                thumbSuppCircle.x = pos.x1;
                thumbSuppCircle.y = pos.y1;
                thumbCircle.x = pos.x1;
                thumbCircle.y = pos.y1;
            }

            const thumbSuppRing = new Path2D();
            thumbSuppRing.arc(thumbSuppCircle.x, thumbSuppCircle.y, thumbSuppCircle.radius, 0, Math.PI * 2, true);
            ctx.lineWidth = thumbSuppCircle.lineWidth;
            ctx.strokeStyle = "lightgray";
            ctx.stroke(thumbSuppRing);

            const thumb = new Path2D();
            thumb.arc(thumbCircle.x, thumbCircle.y, thumbCircle.radius, 0, Math.PI * 2, true);
            ctx.globalAlpha = 0.7;
            ctx.lineWidth = thumbCircle.lineWidth;
            ctx.fillStyle = "red"
            ctx.fill(thumb);

            ctx.save();

            console.log(Math.floor(map(thumbSuppCircle.x, xRealMin, xRealMax, minX, maxX)), Math.floor( - map(thumbSuppCircle.y, yRealMin, yRealMax, minY, maxY)));

        }

        const handleDown = (e) => {
            geMousePos(e);
            const c1 = new Circle(cursor.x, cursor.y, 1, 1);
            const c2 = new Circle(centerX, centerY, thumbRingRadius, thumbRingLineWidth);
            if (c2.isCircleFullyInside(c1)) {
                isDragging = true;
            }
        }
        const handleMove = (e) => {
            if (isDragging) {
                geMousePos(e);
                window.requestAnimationFrame(draw);
                window.addEventListener('mousemove', handleMove);
                window.addEventListener('mouseup', handleUp);
            }
        }
        const handleUp = (e) => {
            isDragging = false;
            cursor.x = centerX;
            cursor.y = centerY;
            window.requestAnimationFrame(draw);
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        }

        canvas.addEventListener("mousemove", handleMove);
        canvas.addEventListener('mousedown', handleDown);
        canvas.addEventListener('mouseup', handleUp);

        canvas.addEventListener('input', (e) => {
            this.dispatchEvent(new CustomEvent('input-change', {
                detail: {value: this.value},
                bubbles: true,
                composed: true
            }));
        });

        window.requestAnimationFrame(draw);
    }

    set x(val) {
        this.setAttribute('x', val);
    }

    get x() {
        return this.shadowRoot.querySelector('input')?.value || 0;
    }

    set y(val) {
        this.setAttribute('y', val);
    }

    get y() {
        return this.shadowRoot.querySelector('input')?.value || 0;
    }
}

customElements.define('joy-stick', Joystick);