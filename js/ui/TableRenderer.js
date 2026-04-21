import { CardRenderer } from './CardRenderer.js';
import {
    formatChips, createChipStackHTML, createSeatChipStack,
    avatarBgGradient, avatarInitial, NAME_GENDER
} from '../utils/helpers.js';

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
        const narrow = window.innerWidth < 600;
        if (narrow) {
            return total >= 8 ? [39, 43] : [38, 42];
        }
        // Tighter radii for 8+ seats so left/right seats don't clip the table edge
        if (total >= 9)  return [44, 41];
        if (total === 8) return [46, 42];
        return [46, 42];
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

        const gender = NAME_GENDER[player.name] || 'male';
        const avatarBg = avatarBgGradient(player.name, gender);

        seat.innerHTML = `
            <div class="player-cards" id="cards-${player.seatIndex}"></div>
            <div class="player-info">
                <div class="seat-left">
                    <div class="player-avatar" style="background:${avatarBg}">
                        <span class="avatar-initial">${avatarInitial(player.name)}</span>
                    </div>
                    <div class="player-name">${player.name}</div>
                </div>
                <div class="seat-right">
                    <div class="seat-chip-icon"></div>
                    <div class="player-chips" id="chips-${player.seatIndex}">
                        <span class="chip-balance">${formatChips(player.chips)}</span>
                    </div>
                </div>
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
            chipsEl.innerHTML = `${createSeatChipStack(player.chips)}<span class="chip-balance">${formatChips(player.chips)}</span>`;
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
        // Compute dealer button center relative to table for the deal-from offset
        const tableRect = this.tableArea.getBoundingClientRect();
        let dealerCx = tableRect.width / 2;
        let dealerCy = tableRect.height / 2;
        if (this.dealerButton) {
            const dr = this.dealerButton.getBoundingClientRect();
            dealerCx = dr.left + dr.width / 2 - tableRect.left;
            dealerCy = dr.top + dr.height / 2 - tableRect.top;
        }

        let stagger = 0;
        for (const player of players) {
            const cardsEl = document.getElementById(`cards-${player.seatIndex}`);
            if (!cardsEl) continue;
            cardsEl.innerHTML = '';
            if (player.isSittingOut) continue;

            // Compute fly-from offset: dealer center → seat center
            const seat = this.seatElements[player.seatIndex];
            let fromX = 0, fromY = -180;
            if (seat) {
                const sr = seat.getBoundingClientRect();
                const seatCx = sr.left + sr.width / 2 - tableRect.left;
                const seatCy = sr.top + sr.height / 2 - tableRect.top;
                fromX = Math.round(dealerCx - seatCx);
                fromY = Math.round(dealerCy - seatCy);
            }

            const makeDealtCard = (cardOrBack, idx) => {
                const c = cardOrBack;
                c.style.setProperty('--deal-from-x', `${fromX}px`);
                c.style.setProperty('--deal-from-y', `${fromY}px`);
                c.classList.add('dealing');
                c.style.animationDelay = `${stagger + idx * 60}ms`;
                return c;
            };

            if (player.isHuman && showHuman) {
                player.holeCards.forEach((card, idx) => {
                    cardsEl.appendChild(makeDealtCard(CardRenderer.createCard(card, { size: 'small' }), idx));
                });
            } else {
                cardsEl.appendChild(makeDealtCard(CardRenderer.createCardBack('small'), 0));
                cardsEl.appendChild(makeDealtCard(CardRenderer.createCardBack('small'), 1));
            }
            stagger += 80; // each seat staggers slightly after the previous
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
            // Pulse pot display when it grows
            if (amount > 0) {
                const potDisplay = document.getElementById('pot-display');
                potDisplay?.classList.remove('grow');
                void potDisplay?.offsetWidth; // reflow to restart animation
                potDisplay?.classList.add('grow');
                setTimeout(() => potDisplay?.classList.remove('grow'), 500);
            }
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

    /* Fly chip particles from source to destination element, then call done(). */
    _flyChips(fromEl, toEl, chipCount, done) {
        if (!fromEl || !toEl) { done?.(); return; }
        const containerRect = this.tableArea.getBoundingClientRect();
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const sx = fromRect.left + fromRect.width / 2 - containerRect.left;
        const sy = fromRect.top + fromRect.height / 2 - containerRect.top;
        const tx = toRect.left + toRect.width / 2 - containerRect.left;
        const ty = toRect.top + toRect.height / 2 - containerRect.top;

        const chips = [];
        for (let i = 0; i < chipCount; i++) {
            const chip = document.createElement('div');
            chip.style.cssText = [
                `position:absolute`,
                `left:${sx}px`,`top:${sy}px`,
                `width:14px`,`height:14px`,
                `border-radius:50%`,
                `background:radial-gradient(circle at 35% 35%,#ffe9a8 0%,#e1b959 45%,#a17a2a 100%)`,
                `box-shadow:0 1px 3px rgba(0,0,0,0.5)`,
                `transform:translate(-50%,-50%)`,
                `z-index:600`,
                `pointer-events:none`,
                `transition:left 0.38s cubic-bezier(0.22,1,0.36,1),top 0.38s cubic-bezier(0.22,1,0.36,1),opacity 0.28s`,
            ].join(';');
            this.tableArea.appendChild(chip);
            chips.push(chip);
        }

        requestAnimationFrame(() => {
            chips.forEach((chip, i) => {
                const jx = (Math.random() - 0.5) * 18;
                const jy = (Math.random() - 0.5) * 18;
                setTimeout(() => {
                    chip.style.left = `${tx + jx}px`;
                    chip.style.top = `${ty + jy}px`;
                    setTimeout(() => { chip.style.opacity = '0'; }, 200);
                }, i * 35);
            });
        });

        setTimeout(() => {
            chips.forEach(c => c.remove());
            done?.();
        }, 550 + chipCount * 35);
    }

    /* Called from main.js on bettingRoundEnd — fly each player's bet to the pot. */
    flyBetsToPot(players, done) {
        const potEl = document.getElementById('pot-display');
        const hasBets = players.some(p => p.currentBet > 0);
        if (!potEl || !hasBets) { done?.(); return; }

        let pending = 0;
        const check = () => { if (--pending <= 0) done?.(); };

        for (const player of players) {
            if (player.currentBet <= 0) continue;
            const betEl = this.betElements[player.seatIndex];
            if (!betEl || !betEl.classList.contains('visible')) continue;
            const count = Math.max(2, Math.min(6, Math.ceil(player.currentBet / 25)));
            pending++;
            this._flyChips(betEl, potEl, count, check);
        }
        if (pending === 0) done?.();
    }

    /* Called from main.js on potsAwarded — fly pot chips to winning seat(s). */
    flyPotToWinners(winnerIndices, done) {
        const potEl = document.getElementById('pot-display');
        if (!potEl || !winnerIndices.length) { done?.(); return; }

        let pending = winnerIndices.length;
        const check = () => { if (--pending <= 0) done?.(); };

        for (const idx of winnerIndices) {
            const seat = this.seatElements[idx];
            if (!seat) { check(); continue; }
            this._flyChips(potEl, seat, 8, check);
        }
    }

    resetForNewHand() {
        this.clearHoleCards();
        this.clearCommunityCards();
        this.clearBets();
        this.clearAllActions();
        Object.values(this.seatElements).forEach(el => {
            el.classList.remove('active', 'folded', 'winner');
            // Kill any dangling card-fold or card-deal classes
            el.querySelectorAll('.card').forEach(c => c.classList.remove('folding', 'dealing'));
        });
        this.potAmountEl.textContent = '$0';
        this.potLabelEl.textContent = 'POT';
        const potChipsEl = document.getElementById('pot-chips');
        if (potChipsEl) potChipsEl.innerHTML = '';
        this._lastRenderedPot = null;
    }
}
