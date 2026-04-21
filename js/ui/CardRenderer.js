import { SUIT_SYMBOLS, SUIT_COLORS } from '../utils/constants.js';

export class CardRenderer {
    static createCard(card, options = {}) {
        const { faceDown = false, size = 'normal', animate = false } = options;

        const el = document.createElement('div');
        const suitColor = SUIT_COLORS[card.suit];
        const isFaceCard = ['J', 'Q', 'K'].includes(card.rank);
        const isAce = card.rank === 'A';

        const classes = ['card', suitColor];
        if (faceDown) classes.push('face-down');
        if (isFaceCard) classes.push('face-card');
        if (isAce) classes.push('rank-A');
        if (animate) classes.push('dealing');
        if (size === 'small') classes.push('small');
        if (size === 'micro') classes.push('micro');
        el.className = classes.join(' ');

        const suitSymbol = SUIT_SYMBOLS[card.suit];

        if (size === 'micro') {
            el.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <div class="card-center">
                            <span class="micro-rank">${card.rank}</span>
                            <span class="micro-suit">${suitSymbol}</span>
                        </div>
                    </div>
                    <div class="card-back"></div>
                </div>
            `;
        } else {
            el.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <div class="card-corner card-corner-top">
                            <span class="rank">${card.rank}</span>
                            <span class="suit">${suitSymbol}</span>
                        </div>
                        ${CardRenderer._getCenterContent(card, suitSymbol, isFaceCard)}
                        <div class="card-corner card-corner-bottom">
                            <span class="rank">${card.rank}</span>
                            <span class="suit">${suitSymbol}</span>
                        </div>
                    </div>
                    <div class="card-back"></div>
                </div>
            `;
        }

        el._cardData = card;
        return el;
    }

    static _getCenterContent(card, suitSymbol, isFaceCard) {
        if (isFaceCard) {
            return `<div class="card-center">${card.rank}<span class="face-suit">${suitSymbol}</span></div>`;
        }
        return `<div class="card-center">${suitSymbol}</div>`;
    }

    static createCardBack(size = 'normal') {
        const el = document.createElement('div');
        const classes = ['card', 'face-down'];
        if (size === 'small') classes.push('small');
        if (size === 'micro') classes.push('micro');
        el.className = classes.join(' ');
        el.innerHTML = `
            <div class="card-inner">
                <div class="card-front"></div>
                <div class="card-back"></div>
            </div>
        `;
        return el;
    }

    static flipCard(cardEl) {
        cardEl.classList.remove('face-down');
    }
}
