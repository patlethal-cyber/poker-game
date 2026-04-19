import { SUIT_SYMBOLS, SUIT_COLORS } from '../utils/constants.js';

export class CardRenderer {
    static createCard(card, options = {}) {
        const { faceDown = false, size = 'normal', animate = false } = options;

        const el = document.createElement('div');
        const suitColor = SUIT_COLORS[card.suit];
        const isFaceCard = ['J', 'Q', 'K'].includes(card.rank);

        el.className = `card ${suitColor}${faceDown ? ' face-down' : ''}${isFaceCard ? ' face-card' : ''}${animate ? ' dealing' : ''}`;
        if (size === 'small') el.classList.add('small');
        if (size === 'micro') el.classList.add('micro');

        const suitSymbol = SUIT_SYMBOLS[card.suit];

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

        el._cardData = card;
        return el;
    }

    static _getCenterContent(card, suitSymbol, isFaceCard) {
        if (isFaceCard) {
            return `<div class="card-center">${card.rank}<span class="face-suit">${suitSymbol}</span></div>`;
        }
        if (card.rank === 'A') {
            return `<div class="card-center" style="font-size:36px">${suitSymbol}</div>`;
        }
        return `<div class="card-center">${suitSymbol}</div>`;
    }

    static createCardBack(size = 'normal') {
        const el = document.createElement('div');
        el.className = `card face-down${size === 'small' ? ' small' : ''}`;
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
