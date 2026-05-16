/**
 * signature-canvas.js
 * Gestione acquisizione firma grafica tramite Canvas HTML5.
 * Supporta Touch e Mouse.
 */

function SignatureCanvas(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.isDrawing = false;
    this.hasSignature = false;

    // Configurazione
    this.canvas.width = options.width || 400;
    this.canvas.height = options.height || 200;
    this.canvas.className = "border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-crosshair touch-none";
    this.ctx.strokeStyle = options.color || "#000";
    this.ctx.lineWidth = options.lineWidth || 2;
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";

    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    this.init = function() {
        const self = this;
        
        const getPos = (e) => {
            const rect = self.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const start = (e) => {
            self.isDrawing = true;
            const pos = getPos(e);
            self.ctx.beginPath();
            self.ctx.moveTo(pos.x, pos.y);
            e.preventDefault();
        };

        const move = (e) => {
            if (!self.isDrawing) return;
            const pos = getPos(e);
            self.ctx.lineTo(pos.x, pos.y);
            self.ctx.stroke();
            self.hasSignature = true;
            e.preventDefault();
        };

        const stop = () => {
            self.isDrawing = false;
        };

        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', stop);

        this.canvas.addEventListener('touchstart', start);
        this.canvas.addEventListener('touchmove', move);
        this.canvas.addEventListener('touchend', stop);
    };

    this.clear = function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasSignature = false;
    };

    this.toDataURL = function() {
        if (!this.hasSignature) return null;
        return this.canvas.toDataURL('image/png');
    };

    this.init();
}
