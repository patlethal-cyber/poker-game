import { SUIT_SYMBOLS, SUIT_COLORS } from '../utils/constants.js';

/**
 * CardRenderer — produces compact-style playing cards.
 *
 * All cards (community, hole, micro for history/showdown) use the same
 * visual language: rank above suit, centered, no corner pips. Different
 * sizes are picked via the `size` option.
 *
 *   size: 'normal'  — full size (community on desktop)
 *   size: 'small'   — opponent / human hole cards on table
 *   size: 'micro'   — showdown overlay rows + history mini-cards
 */
export class CardRenderer {
    static createCard(card, options = {}) {
        const { faceDown = false, size = 'normal', animate = false } = options;

        const el = document.createElement('div');
        const suitColor = SUIT_COLORS[card.suit];

        const classes = ['card', suitColor];
        if (faceDown) classes.push('face-down');
        if (animate) classes.push('dealing');
        if (size === 'small') classes.push('small');
        if (size === 'micro') classes.push('micro');
        if (card.rank === 'A') classes.push('rank-A');
        el.className = classes.join(' ');

        const suitSymbol = SUIT_SYMBOLS[card.suit];

        // Single compact layout for every size — rank above suit, centered.
        // The micro variant uses different inner class names (kept for back-compat
        // with showdown/history rendering already in main.js).
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
                        <div class="card-center">
                            <span class="card-rank">${card.rank}</span>
                            <span class="card-suit">${suitSymbol}</span>
                        </div>
                    </div>
                    <div class="card-back"></div>
                </div>
            `;
        }

        el._cardData = card;
        return el;
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
