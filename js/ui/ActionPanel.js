import { ACTIONS } from '../utils/constants.js';
import { formatChips } from '../utils/helpers.js';

export class ActionPanel {
    constructor(game) {
        this.game = game;
        this.panel = document.getElementById('action-panel');
        this.btnFold = document.getElementById('btn-fold');
        this.btnCheckCall = document.getElementById('btn-check-call');
        this.btnRaise = document.getElementById('btn-raise');
        this.btnAllIn = document.getElementById('btn-all-in');
        this.raiseSlider = document.getElementById('raise-slider');
        this.raiseInput = document.getElementById('raise-input');
        this.raiseControls = document.getElementById('raise-controls');

        this.currentValidActions = [];
        this._bindEvents();
    }

    _bindEvents() {
        this.btnFold.addEventListener('click', () => this._submitAction({ type: ACTIONS.FOLD }));

        this.btnCheckCall.addEventListener('click', () => {
            const checkAction = this.currentValidActions.find(a => a.type === ACTIONS.CHECK);
            const callAction = this.currentValidActions.find(a => a.type === ACTIONS.CALL);
            if (checkAction) {
                this._submitAction({ type: ACTIONS.CHECK });
            } else if (callAction) {
                this._submitAction({ type: ACTIONS.CALL, amount: callAction.amount });
            }
        });

        this.btnRaise.addEventListener('click', () => {
            const raiseTo = parseInt(this.raiseInput.value) || parseInt(this.raiseSlider.value);
            const raiseAction = this._raiseAction || this.currentValidActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
            if (raiseAction) {
                const minTo = raiseAction.minRaiseTo || raiseAction.minAmount;
                const maxTo = raiseAction.maxRaiseTo || raiseAction.maxAmount;
                const clampedTo = Math.max(minTo, Math.min(raiseTo, maxTo));
                const ratio = maxTo > minTo ? (clampedTo - minTo) / (maxTo - minTo) : 0;
                const amount = Math.round(raiseAction.minAmount + ratio * (raiseAction.maxAmount - raiseAction.minAmount));
                this._submitAction({ type: raiseAction.type, amount });
            }
        });

        this.btnAllIn.addEventListener('click', () => {
            const allInAction = this.currentValidActions.find(a => a.type === ACTIONS.ALL_IN);
            if (allInAction) {
                this._submitAction({ type: ACTIONS.ALL_IN, amount: allInAction.amount });
            }
        });

        this.raiseSlider.addEventListener('input', () => {
            this.raiseInput.value = parseInt(this.raiseSlider.value);
        });

        this.raiseInput.addEventListener('input', () => {
            const val = parseInt(this.raiseInput.value);
            if (!isNaN(val)) {
                this.raiseSlider.value = val;
            }
        });

        this.raiseInput.addEventListener('blur', () => {
            const raiseAction = this._raiseAction || this.currentValidActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
            if (raiseAction) {
                const minTo = raiseAction.minRaiseTo || raiseAction.minAmount;
                const maxTo = raiseAction.maxRaiseTo || raiseAction.maxAmount;
                let val = parseInt(this.raiseInput.value) || minTo;
                val = Math.max(minTo, Math.min(val, maxTo));
                this.raiseInput.value = val;
                this.raiseSlider.value = val;
            }
        });

        this.raiseInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.btnRaise.click();
            }
        });

        const quickBets = this.panel.querySelectorAll('.quick-bet');
        quickBets.forEach(btn => {
            btn.addEventListener('click', () => this._applyQuickBet(btn.dataset.quick));
        });

        document.addEventListener('keydown', (e) => this._onKeyDown(e));
    }

    _onKeyDown(e) {
        if (!this.panel.classList.contains('visible')) return;
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const key = e.key.toLowerCase();
        if (key === 'f') {
            e.preventDefault();
            if (!this.btnFold.disabled && this.btnFold.offsetParent !== null) this.btnFold.click();
        } else if (key === 'c') {
            e.preventDefault();
            if (!this.btnCheckCall.disabled && this.btnCheckCall.offsetParent !== null) this.btnCheckCall.click();
        } else if (key === 'r') {
            e.preventDefault();
            if (this.btnRaise.offsetParent !== null) {
                this.raiseInput?.focus();
                this.raiseInput?.select();
            }
        } else if (key === 'a') {
            e.preventDefault();
            if (!this.btnAllIn.disabled && this.btnAllIn.offsetParent !== null) this.btnAllIn.click();
        }
    }

    _applyQuickBet(kind) {
        const raiseAction = this._raiseAction || this.currentValidActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
        const allInAction = this.currentValidActions.find(a => a.type === ACTIONS.ALL_IN);

        if (kind === 'allin') {
            if (allInAction) {
                this._submitAction({ type: ACTIONS.ALL_IN, amount: allInAction.amount });
            }
            return;
        }
        if (!raiseAction) return;

        const minTo = raiseAction.minRaiseTo || raiseAction.minAmount;
        const maxTo = raiseAction.maxRaiseTo || raiseAction.maxAmount;
        const pot = this.game?.potManager?.totalPot + (this.game?._currentRoundBets?.() || 0) || 0;

        let targetTo;
        if (kind === 'min') targetTo = minTo;
        else if (kind === 'half') targetTo = Math.round(pot * 0.5);
        else if (kind === 'pot') targetTo = pot;
        else targetTo = minTo;

        targetTo = Math.max(minTo, Math.min(targetTo, maxTo));
        this.raiseSlider.value = targetTo;
        this.raiseInput.value = targetTo;
    }

    _submitAction(action) {
        this.hide();
        this.game.handleHumanAction(action);
    }

    show(validActions) {
        this.currentValidActions = validActions;

        const hasCheck = validActions.some(a => a.type === ACTIONS.CHECK);
        const callAction = validActions.find(a => a.type === ACTIONS.CALL);
        const raiseAction = validActions.find(a => a.type === ACTIONS.RAISE || a.type === ACTIONS.BET);
        const allInAction = validActions.find(a => a.type === ACTIONS.ALL_IN);

        if (hasCheck) {
            this.btnCheckCall.textContent = 'Check';
        } else if (callAction) {
            this.btnCheckCall.textContent = `Call ${formatChips(callAction.amount)}`;
        }

        if (raiseAction) {
            this.raiseControls.style.display = 'flex';
            this.btnRaise.style.display = '';
            this._raiseAction = raiseAction;
            const minTo = raiseAction.minRaiseTo || raiseAction.minAmount;
            const maxTo = raiseAction.maxRaiseTo || raiseAction.maxAmount;
            this.raiseSlider.min = minTo;
            this.raiseSlider.max = maxTo;
            this.raiseSlider.value = minTo;
            this.raiseInput.min = minTo;
            this.raiseInput.max = maxTo;
            this.raiseInput.value = minTo;
            this.btnRaise.textContent = raiseAction.type === ACTIONS.BET ? 'Bet' : 'Raise to';
        } else {
            this.raiseControls.style.display = 'none';
            this.btnRaise.style.display = 'none';
        }

        if (allInAction) {
            this.btnAllIn.textContent = `All In ${formatChips(allInAction.amount)}`;
            this.btnAllIn.style.display = '';
        } else {
            this.btnAllIn.style.display = 'none';
        }

        this.panel.classList.add('visible');
    }

    hide() {
        this.panel.classList.remove('visible');
    }
}
