export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatChips(amount) {
    return `$${amount.toLocaleString()}`;
}

export function createChipStackHTML(amount) {
    const denominations = [
        { value: 100, cls: 'chip-black' },
        { value: 50, cls: 'chip-blue' },
        { value: 25, cls: 'chip-red' },
        { value: 10, cls: 'chip-green' },
        { value: 5, cls: 'chip-white' }
    ];
    let remaining = amount;
    const chips = [];
    for (const d of denominations) {
        while (remaining >= d.value && chips.length < 8) {
            chips.push(d.cls);
            remaining -= d.value;
        }
    }
    if (chips.length === 0 && amount > 0) chips.push('chip-white');
    return `<div class="chip-stack">${chips.map(c => `<div class="chip ${c}"></div>`).join('')}</div>`;
}

export function getChipIconColor(chipCount) {
    if (chipCount >= 500) return 'chip-black';
    if (chipCount >= 200) return 'chip-blue';
    if (chipCount >= 50) return 'chip-red';
    return 'chip-green';
}

export function cardToString(card) {
    const suitSymbols = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
    return `${card.rank}${suitSymbols[card.suit]}`;
}

export function handToString(cards) {
    return cards.map(cardToString).join(' ');
}

export class EventEmitter {
    constructor() {
        this._listeners = {};
    }

    on(event, callback) {
        if (!this._listeners[event]) {
            this._listeners[event] = [];
        }
        this._listeners[event].push(callback);
        return this;
    }

    off(event, callback) {
        if (!this._listeners[event]) return this;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
        return this;
    }

    emit(event, ...args) {
        if (!this._listeners[event]) return;
        for (const callback of this._listeners[event]) {
            callback(...args);
        }
    }
}
