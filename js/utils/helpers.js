export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* Abortable delay — rejects if aborted. Used for pause/stop control. */
export function abortableDelay(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
        const t = setTimeout(resolve, ms);
        const onAbort = () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

export function formatChips(amount) {
    return `$${amount.toLocaleString()}`;
}

/* Chip denominations (descending). Used by stack builder. */
const CHIP_DENOMS = [
    { value: 500,  cls: 'chip-purple' },
    { value: 100,  cls: 'chip-black'  },
    { value: 25,   cls: 'chip-green'  },
    { value: 10,   cls: 'chip-blue'   },
    { value: 5,    cls: 'chip-red'    },
    { value: 1,    cls: 'chip-white'  }
];

/* Build visually stacked chip columns. Max columns + height capped. */
export function createChipStackHTML(amount, opts = {}) {
    const maxCols = opts.maxCols ?? 3;
    const maxPerCol = opts.maxPerCol ?? 6;
    if (amount <= 0) return '';

    let remaining = amount;
    const chips = [];
    for (const d of CHIP_DENOMS) {
        while (remaining >= d.value && chips.length < maxCols * maxPerCol) {
            chips.push(d.cls);
            remaining -= d.value;
        }
    }
    if (chips.length === 0) chips.push('chip-white');

    // Group into columns
    const colSize = Math.ceil(chips.length / maxCols);
    const cols = [];
    for (let i = 0; i < chips.length; i += colSize) {
        cols.push(chips.slice(i, i + colSize));
    }

    return `<div class="chip-stack">${
        cols.map(col =>
            `<div class="chip-stack-col">${
                col.map(c => `<div class="chip-disc ${c}"></div>`).join('')
            }</div>`
        ).join('')
    }</div>`;
}

/* Smaller stack icon for seat badge (balance). */
export function createSeatChipStack(chipAmount) {
    // 1 tier per magnitude — visual cue of chip volume, not precise
    let tiers;
    if (chipAmount >= 2000) tiers = 5;
    else if (chipAmount >= 1000) tiers = 4;
    else if (chipAmount >= 500) tiers = 3;
    else if (chipAmount >= 100) tiers = 2;
    else tiers = 1;
    const color = getChipIconColor(chipAmount);
    // Replace primary color with tiered variant
    const tierColors = {
        'chip-black':  ['chip-black',  'chip-purple', 'chip-purple', 'chip-gold',  'chip-gold'],
        'chip-blue':   ['chip-blue',   'chip-blue',   'chip-black',  'chip-black', 'chip-purple'],
        'chip-red':    ['chip-red',    'chip-blue',   'chip-blue',   'chip-black', 'chip-black'],
        'chip-green':  ['chip-green',  'chip-red',    'chip-blue',   'chip-black', 'chip-black'],
    };
    const palette = tierColors[color] || tierColors['chip-red'];
    const chipClasses = palette.slice(0, tiers);
    return `<span class="seat-chip-stack">${
        chipClasses.map(c => `<span class="stack-chip ${c}" style="background:${chipGradient(c)}"></span>`).join('')
    }</span>`;
}

function chipGradient(cls) {
    const map = {
        'chip-white':  'linear-gradient(180deg, #f2ede4, #c4baa0)',
        'chip-red':    'linear-gradient(180deg, #d53c3c, #962828)',
        'chip-green':  'linear-gradient(180deg, #2f9b55, #1f6b3c)',
        'chip-blue':   'linear-gradient(180deg, #3a73c7, #274f8a)',
        'chip-black':  'linear-gradient(180deg, #2c2d38, #0d0e16)',
        'chip-purple': 'linear-gradient(180deg, #6e4aa8, #46316e)',
        'chip-gold':   'linear-gradient(180deg, #e1b959, #8a6b28)'
    };
    return map[cls] || map['chip-red'];
}

export function getChipIconColor(chipCount) {
    if (chipCount >= 1500) return 'chip-black';
    if (chipCount >= 500)  return 'chip-blue';
    if (chipCount >= 100)  return 'chip-red';
    return 'chip-green';
}

export function cardToString(card) {
    const suitSymbols = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
    return `${card.rank}${suitSymbols[card.suit]}`;
}

export function handToString(cards) {
    return cards.map(cardToString).join(' ');
}

/* ============================================================
   Avatar + name system
   ============================================================ */

/* Name → gender map. Used to drive avatar generation (modern flat portraits). */
export const NAME_GENDER = {
    // male
    'Alex':   'male',   'Jin':    'male',   'Sam':    'male',
    'Kai':    'male',   'Oscar':  'male',   'Leo':    'male',
    'Theo':   'male',   'Ravi':   'male',   'Eli':    'male',
    'Remy':   'male',   'Marcus': 'male',   'Jack':   'male',
    'Ethan':  'male',   'Noah':   'male',   'Lucas':  'male',
    'Dylan':  'male',   'Aaron':  'male',
    // female
    'Maya':   'female', 'Priya':  'female', 'Nina':   'female',
    'Ivy':    'female', 'Zoe':    'female', 'Dana':   'female',
    'Mila':   'female', 'Luna':   'female', 'Lucy':   'female',
    'Emma':   'female', 'Ava':    'female', 'Sophia': 'female',
    'Chloe':  'female', 'Nora':   'female', 'Lily':   'female'
};

export const NAME_POOL_MALE = [
    'Alex', 'Jin', 'Sam', 'Kai', 'Oscar', 'Leo',
    'Theo', 'Ravi', 'Eli', 'Remy', 'Marcus', 'Jack',
    'Ethan', 'Noah', 'Lucas', 'Dylan', 'Aaron'
];
export const NAME_POOL_FEMALE = [
    'Maya', 'Priya', 'Nina', 'Ivy', 'Zoe', 'Dana',
    'Mila', 'Luna', 'Lucy', 'Emma', 'Ava', 'Sophia',
    'Chloe', 'Nora', 'Lily'
];

/* Modern initial-based avatar — gender-themed gradient background.
   No external service dependency. */
export function avatarBgGradient(name, gender) {
    // Deterministic hue from name so same name always gets same color
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const femalePalette = [
        ['#f3a6c0', '#d86a8f'],  // pink
        ['#c89ee0', '#8e5cb8'],  // violet
        ['#f2c97d', '#d99444'],  // peach
        ['#a7d4e8', '#5a9fbf'],  // sky
        ['#e8b5d4', '#b06a94'],  // rose
        ['#b9e0b4', '#6ea466'],  // mint
    ];
    const malePalette = [
        ['#8fb5e0', '#3f6fa8'],  // blue
        ['#a7c9a0', '#567b4f'],  // olive
        ['#d9a475', '#94683a'],  // sand
        ['#9ea8d4', '#5a6399'],  // slate-blue
        ['#8fc7c0', '#3f8277'],  // teal
        ['#c7a88f', '#805a3f'],  // brown
    ];
    const palette = gender === 'female' ? femalePalette : malePalette;
    const [c1, c2] = palette[h % palette.length];
    return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
}

/* Legacy API retained — but now returns empty so <img> is not inserted.
   Avatar is drawn from CSS gradient + initial only. */
export function avatarUrl(name, gender) {
    return '';
}

export function avatarInitial(name) {
    return (name || '?').trim().slice(0, 1).toUpperCase();
}

export class EventEmitter {
    constructor() {
        this._listeners = {};
    }

    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
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
