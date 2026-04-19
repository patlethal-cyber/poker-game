import { CardRenderer } from './CardRenderer.js';
import { formatChips, createChipStackHTML, getChipIconColor } from '../utils/helpers.js';

export class TableRenderer {
    constructor(tableArea) {
        this.tableArea = tableArea;
        this.seatElements = {};
        this.betElements = {};
        this.dealerButton = null;
        this.communityCardsEl = document.getElementById('community-cards');
        this.potAmountEl = document.getElementById('pot-amount');
        this.potLabelEl = document.getElementById('pot-label');

        this._actionTokens = {};
        this._lastRenderedBet = {};
        this._lastRenderedPot = null;
    }

    init(players) {
        this.totalSeats = players.length;
        for (const player of players) {
            this._createSeatElement(player);
            this._createBetElement(player);
        }

        this.dealerButton = document.createElement('div');
        this.dealerButton.className = 'dealer-button';
        this.dealerButton.textContent = 'D';
        this.tableArea.appendChild(this.dealerButton);

        this.sbLabel = document.createElement('div');
        this.sbLabel.className = 'position-label sb';
        this.sbLabel.textContent = 'SB';
        this.tableArea.appendChild(this.sbLabel);

        this.bbLabel = document.createElement('div');
        this.bbLabel.className = 'position-label bb';
        this.bbLabel.textContent = 'BB';
        this.tableArea.appendChild(this.bbLabel);

        for (const player of players) {
            this._positionSeat(player.seatIndex);
            this._positionBet(player.seatIndex);
        }

        this.communityCardsEl.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const slot = document.createElement('div');
            slot.className = 'community-card-slot';
            slot.dataset.index = i;
            this.communityCardsEl.appendChild(slot);
        }

        this._resizeHandler = () => this._repositionAll();
        window.addEventListener('resize', this._resizeHandler);
    }

    _repositionAll() {
        for (const idx of Object.keys(this.seatElements)) {
            this._positionSeat(parseInt(idx));
            this._positionBet(parseInt(idx));
        }
        const dealerSeat = parseInt(this.dealerButton?.getAttribute('data-seat') ?? '0');
        if (!isNaN(dealerSeat)) this._positionDealerButton(dealerSeat);
        const sbSeat = parseInt(this.sbLabel?.getAttribute('data-seat') ?? '');
        const bbSeat = parseInt(this.bbLabel?.getAttribute('data-seat') ?? '');
        if (!isNaN(sbSeat)) this._positionLabel(this.sbLabel, sbSeat);
        if (!isNaN(bbSeat)) this._positionLabel(this.bbLabel, bbSeat);
    }

    _seatAngle(seatIndex) {
        // seat 0 at bottom center (theta = 90deg), increasing clockwise
        return (90 + 360 * seatIndex / this.totalSeats) * Math.PI / 180;
    }

    _tableRadii() {
        const total = this.totalSeats;
        // Narrow viewports pull seats inward so middle seats don't clip the viewport edge.
        const narrow = window.innerWidth < 600;
        if (narrow) {
            // Portrait: shorter ellipse, seats closer to center
            return total >= 8 ? [40, 45] : [38, 42];
        }
        return total >= 8 ? [48, 44] : [46, 42];
    }

    _positionSeat(seatIndex) {
        const seat = this.seatElements[seatIndex];
        if (!seat) return;
        const theta = this._seatAngle(seatIndex);
        const [rx, ry] = this._tableRadii();
        seat.style.left = `${50 + rx * Math.cos(theta)}%`;
        seat.style.top = `${50 + ry * Math.sin(theta)}%`;
        seat.style.transform = 'translate(-50%, -50%)';
    }

    _positionBet(seatIndex) {
        const bet = this.betElements[seatIndex];
        if (!bet) return;
        const theta = this._seatAngle(seatIndex);
        const [rx, ry] = this._tableRadii();
        bet.style.left = `${50 + rx * 0.55 * Math.cos(theta)}%`;
        bet.style.top = `${50 + ry * 0.55 * Math.sin(theta)}%`;
        bet.style.transform = 'translate(-50%, -50%)';
    }

    _positionDealerButton(seatIndex) {
        if (!this.dealerButton) return;
        const theta = this._seatAngle(seatIndex) + (12 * Math.PI / 180);
        const [rx, ry] = this._tableRadii();
        this.dealerButton.style.left = `${50 + rx * 0.78 * Math.cos(theta)}%`;
        this.dealerButton.style.top = `${50 + ry * 0.78 * Math.sin(theta)}%`;
        this.dealerButton.style.transform = 'translate(-50%, -50%)';
    }

    _positionLabel(labelEl, seatIndex) {
        if (!labelEl) return;
        const theta = this._seatAngle(seatIndex) + (-10 * Math.PI / 180);
        const [rx, ry] = this._tableRadii();
        labelEl.style.left = `${50 + rx * 0.82 * Math.cos(theta)}%`;
        labelEl.style.top = `${50 + ry * 0.82 * Math.sin(theta)}%`;
        labelEl.style.transform = 'translate(-50%, -50%)';
    }

    _createSeatElement(player) {
        const seat = document.createElement('div');
        seat.className = `player-seat${player.isHuman ? ' human' : ''}`;
        seat.dataset.seat = player.seatIndex;
        seat.id = `seat-${player.seatIndex}`;

        const strategyTag = player.strategy ? ` <span class="strategy-tag">(${player.strategy})</span>` : '';

        seat.innerHTML = `
            <div class="player-cards" id="cards-${player.seatIndex}"></div>
            <div class="player-info">
                <div class="player-name">${player.name}${strategyTag}</div>
                <div class="player-chips" id="chips-${player.seatIndex}"><span class="chip-icon ${getChipIconColor(player.chips)}"></span>${formatChips(player.chips)}</div>
                <div class="player-action-label" id="action-${player.seatIndex}"></div>
                <div class="thinking-indicator" id="thinking-${player.seatIndex}">
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                    <div class="thinking-dot"></div>
                </div>
            </div>
        `;

        this.tableArea.appendChild(seat);
        this.seatElements[player.seatIndex] = seat;
    }

    _createBetElement(player) {
        const bet = document.createElement('div');
        bet.className = 'player-bet';
        bet.dataset.seat = player.seatIndex;
        bet.id = `bet-${player.seatIndex}`;
        this.tableArea.appendChild(bet);
        this.betElements[player.seatIndex] = bet;
    }

    updatePlayer(player) {
        const seat = this.seatElements[player.seatIndex];
        if (!seat) return;

        const chipsEl = document.getElementById(`chips-${player.seatIndex}`);
        if (chipsEl) {
            const color = getChipIconColor(player.chips);
            chipsEl.innerHTML = `<span class="chip-icon ${color}"></span>${formatChips(player.chips)}`;
        }

        seat.classList.toggle('folded', player.isFolded);
        seat.classList.toggle('sitting-out', player.isSittingOut);
    }

    setActivePlayer(playerIndex) {
        Object.values(this.seatElements).forEach(el => el.classList.remove('active'));
        if (playerIndex !== null && this.seatElements[playerIndex]) {
            this.seatElements[playerIndex].classList.add('active');
        }
    }

    showPlayerAction(player, action) {
        const seat = player.seatIndex;
        const actionEl = document.getElementById(`action-${seat}`);
        if (!actionEl) return;

        let text = action.type;
        let className = action.type;

        if (action.type === 'call' && action.amount) {
            text = `Call ${formatChips(action.amount)}`;
        } else if (action.type === 'raise' || action.type === 'bet') {
            text = `${action.type} ${formatChips(action.amount)}`;
        } else if (action.type === 'allIn') {
            text = 'ALL IN';
            className = 'all-in';
        }

        actionEl.textContent = text;
        actionEl.className = `player-action-label ${className}`;

        const token = (this._actionTokens[seat] || 0) + 1;
        this._actionTokens[seat] = token;
        setTimeout(() => {
            if (this._actionTokens[seat] === token) {
                actionEl.textContent = '';
            }
        }, 3000);
    }

    clearAllActions() {
        for (const seatIdx of Object.keys(this.seatElements)) {
            const el = document.getElementById(`action-${seatIdx}`);
            if (el) el.textContent = '';
            this._actionTokens[seatIdx] = (this._actionTokens[seatIdx] || 0) + 1;
        }
    }

    showThinking(player, show) {
        const el = document.getElementById(`thinking-${player.seatIndex}`);
        if (el) el.classList.toggle('visible', show);
    }

    dealHoleCards(players, showHuman = true) {
        for (const player of players) {
            const cardsEl = document.getElementById(`cards-${player.seatIndex}`);
            if (!cardsEl) continue;
            cardsEl.innerHTML = '';

            if (player.isSittingOut) continue;

            if (player.isHuman && showHuman) {
                for (const card of player.holeCards) {
                    cardsEl.appendChild(CardRenderer.createCard(card, { animate: true }));
                }
            } else {
                cardsEl.appendChild(CardRenderer.createCardBack('small'));
                cardsEl.appendChild(CardRenderer.createCardBack('small'));
            }
        }
    }

    revealPlayerCards(player) {
        const cardsEl = document.getElementById(`cards-${player.seatIndex}`);
        if (!cardsEl) return;
        cardsEl.innerHTML = '';
        for (const card of player.holeCards) {
            cardsEl.appendChild(CardRenderer.createCard(card, { size: 'small' }));
        }
    }

    clearHoleCards() {
        for (const seatIdx of Object.keys(this.seatElements)) {
            const cardsEl = document.getElementById(`cards-${seatIdx}`);
            if (cardsEl) cardsEl.innerHTML = '';
        }
    }

    dealCommunityCards(cards, allCommunityCards) {
        const slots = this.communityCardsEl.children;
        for (let i = 0; i < allCommunityCards.length; i++) {
            const slot = slots[i];
            if (slot && !slot.querySelector('.card')) {
                slot.innerHTML = '';
                slot.classList.remove('community-card-slot');
                const cardEl = CardRenderer.createCard(allCommunityCards[i], { animate: true });
                slot.appendChild(cardEl);
            }
        }
    }

    clearCommunityCards() {
        const slots = this.communityCardsEl.children;
        for (let i = 0; i < 5; i++) {
            slots[i].innerHTML = '';
            slots[i].className = 'community-card-slot';
        }
    }

    updatePot(amount, descriptions) {
        this.potAmountEl.textContent = formatChips(amount);
        if (descriptions && descriptions.length > 1) {
            this.potLabelEl.textContent = descriptions.map(d => `${d.name}: ${formatChips(d.amount)}`).join(' | ');
        } else {
            this.potLabelEl.textContent = 'POT';
        }

        const potChipsEl = document.getElementById('pot-chips');
        if (potChipsEl && this._lastRenderedPot !== amount) {
            potChipsEl.innerHTML = amount > 0 ? createChipStackHTML(amount) : '';
            this._lastRenderedPot = amount;
        }
    }

    updateBets(players) {
        for (const player of players) {
            const betEl = this.betElements[player.seatIndex];
            if (!betEl) continue;

            if (this._lastRenderedBet[player.seatIndex] === player.currentBet) continue;
            this._lastRenderedBet[player.seatIndex] = player.currentBet;

            if (player.currentBet > 0) {
                betEl.innerHTML = createChipStackHTML(player.currentBet) +
                    `<span class="bet-amount-label">${formatChips(player.currentBet)}</span>`;
                betEl.classList.add('visible');
            } else {
                betEl.innerHTML = '';
                betEl.classList.remove('visible');
            }
        }
    }

    clearBets() {
        Object.values(this.betElements).forEach(el => {
            el.innerHTML = '';
            el.classList.remove('visible');
        });
        this._lastRenderedBet = {};
    }

    moveDealerButton(seatIndex) {
        this.dealerButton.setAttribute('data-seat', seatIndex);
        this._positionDealerButton(seatIndex);
    }

    movePositionLabels(sbIndex, bbIndex) {
        if (this.sbLabel) {
            this.sbLabel.setAttribute('data-seat', sbIndex);
            this.sbLabel.style.display = 'block';
            this._positionLabel(this.sbLabel, sbIndex);
        }
        if (this.bbLabel) {
            this.bbLabel.setAttribute('data-seat', bbIndex);
            this.bbLabel.style.display = 'block';
            this._positionLabel(this.bbLabel, bbIndex);
        }
    }

    showWinner(playerIndex) {
        const seat = this.seatElements[playerIndex];
        if (!seat) return;
        seat.classList.add('winner');
        seat.querySelector('.player-info')?.classList.add('win-animation');

        setTimeout(() => {
            seat.classList.remove('winner');
            seat.querySelector('.player-info')?.classList.remove('win-animation');
        }, 4000);
    }

    resetForNewHand() {
        this.clearHoleCards();
        this.clearCommunityCards();
        this.clearBets();
        this.clearAllActions();
        Object.values(this.seatElements).forEach(el => {
            el.classList.remove('active', 'folded', 'winner');
        });
        this.potAmountEl.textContent = '$0';
        this.potLabelEl.textContent = 'POT';
        const potChipsEl = document.getElementById('pot-chips');
        if (potChipsEl) potChipsEl.innerHTML = '';
        this._lastRenderedPot = null;
    }
}
