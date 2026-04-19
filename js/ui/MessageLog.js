export class MessageLog {
    constructor() {
        this.messageEl = document.getElementById('message-text');
        this._timeout = null;
    }

    show(text, duration = 3000) {
        if (this._timeout) clearTimeout(this._timeout);

        this.messageEl.style.opacity = '0';
        setTimeout(() => {
            this.messageEl.textContent = text;
            this.messageEl.style.opacity = '1';
        }, 150);

        if (duration > 0) {
            this._timeout = setTimeout(() => {
                this.messageEl.style.opacity = '0';
            }, duration);
        }
    }

    clear() {
        if (this._timeout) clearTimeout(this._timeout);
        this.messageEl.style.opacity = '0';
    }
}
