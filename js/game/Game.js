import { PHASES, DEFAULT_CONFIG, ACTIONS, BLIND_SCHEDULE, TIMING } from '../utils/constants.js';
import { EventEmitter, delay } from '../utils/helpers.js';
import { Deck } from './Deck.js';
import { Player } from './Player.js';
import { PotManager } from './PotManager.js';
import { BettingRound } from './BettingRound.js';
import { HandEvaluator } from './HandEvaluator.js';

export class Game extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.deck = new Deck();
        this.potManager = new PotManager();
        this.players = [];
        this.communityCards = [];
        this.phase = PHASES.WAITING;
        this.dealerIndex = 0;
        this.handNumber = 0;
        this.bettingRound = null;
        this.blindLevel = {
            small: this.config.smallBlind,
            big: this.config.bigBlind
        };
        this.blindLevelIndex = 0;
        this.aiController = null;
        this.isRunning = false;
        this._humanActionResolver = null;
        this._paused = false;
        this._pauseWaiters = [];
        this._showdownContinueResolver = null;
    }

    setPaused(paused) {
        this._paused = !!paused;
        if (!this._paused) {
            const waiters = this._pauseWaiters;
            this._pauseWaiters = [];
            waiters.forEach(w => w());
        }
    }

    /* Await if paused; resolves immediately when unpaused. */
    _awaitUnpaused() {
        if (!this._paused) return Promise.resolve();
        return new Promise(resolve => this._pauseWaiters.push(resolve));
    }

    /* Delay that respects pause: any time we're paused, the timer is held. */
    async _delay(ms) {
        await this._awaitUnpaused();
        await delay(ms);
        await this._awaitUnpaused();
    }

    signalShowdownContinue() {
        if (this._showdownContinueResolver) {
            const r = this._showdownContinueResolver;
            this._showdownContinueResolver = null;
            r();
        }
    }

    setupPlayers(playerConfigs) {
        this.players = playerConfigs.map((cfg, i) =>
            Object.assign(new Player(cfg.name, this.config.startingChips, i, cfg.isHuman), {
                strategy: cfg.strategy || null
            })
        );
    }

    get activePlayers() {
        return this.players.filter(p => !p.isSittingOut);
    }

    get playersInHand() {
        return this.players.filter(p => p.isInHand);
    }

    get humanPlayer() {
        return this.players.find(p => p.isHuman);
    }

    get smallBlindIndex() {
        return this._nextActiveIndex(this.dealerIndex);
    }

    get bigBlindIndex() {
        return this._nextActiveIndex(this.smallBlindIndex);
    }

    _nextActiveIndex(fromIndex) {
        const n = this.players.length;
        for (let offset = 1; offset <= n; offset++) {
            const idx = (fromIndex + offset) % n;
            if (!this.players[idx].isSittingOut) return idx;
        }
        return fromIndex;
    }

    _nextInHandActiveIndex(fromIndex) {
        const n = this.players.length;
        for (let offset = 1; offset <= n; offset++) {
            const idx = (fromIndex + offset) % n;
            if (this.players[idx].isActive) return idx;
        }
        for (let offset = 1; offset <= n; offset++) {
            const idx = (fromIndex + offset) % n;
            if (this.players[idx].isInHand) return idx;
        }
        return fromIndex;
    }

    async startGame() {
        this.isRunning = true;
        this.emit('gameStart', { players: this.players });

        while (this.isRunning) {
            this._markBustedPlayers();
            const notSittingOut = this.players.filter(p => !p.isSittingOut);

            if (notSittingOut.length <= 1 || this.humanPlayer.isSittingOut || this.humanPlayer.chips <= 0) {
                break;
            }

            await this.playHand();
            await this._delay(TIMING.BETWEEN_HANDS_MS);
        }

        this.isRunning = false;
        this._markBustedPlayers();
        const remaining = this.players.filter(p => !p.isSittingOut);
        this.emit('gameOver', {
            winner: remaining.length === 1 ? remaining[0] : null
        });
    }

    _markBustedPlayers() {
        for (const p of this.players) {
            if (p.chips <= 0 && !p.isSittingOut) p.isSittingOut = true;
        }
    }

    stopGame() {
        this.isRunning = false;
    }

    _checkBlindEscalation() {
        const interval = this.config.blindEscalationHands;
        const newIndex = Math.min(
            Math.floor((this.handNumber - 1) / interval),
            BLIND_SCHEDULE.length - 1
        );
        if (newIndex > this.blindLevelIndex) {
            this.blindLevelIndex = newIndex;
            this.blindLevel = { ...BLIND_SCHEDULE[newIndex] };
            this.emit('blindsUp', { level: this.blindLevel, levelIndex: newIndex });
        }
    }

    async playHand() {
        this.handNumber++;
        this._checkBlindEscalation();
        this.deck.reset();
        this.communityCards = [];
        this.potManager.reset();

        for (const player of this.players) {
            player.resetForNewHand();
        }

        if (this.activePlayers.length < 2) {
            return;
        }

        this.emit('newHand', {
            handNumber: this.handNumber,
            dealerIndex: this.dealerIndex,
            blinds: this.blindLevel
        });

        await this._postBlinds();

        await this._dealHoleCards();

        this.phase = PHASES.PRE_FLOP;
        const firstToAct = this._nextActiveIndex(this.bigBlindIndex);
        await this._runBettingRound(firstToAct, this.blindLevel.big, this.blindLevel.big);

        if (this._checkHandOver()) return;

        this.phase = PHASES.DEAL_FLOP;
        const flopCards = this.deck.deal(3);
        this.communityCards.push(...flopCards);
        const allInPreFlop = this._isAllInRunout();
        if (allInPreFlop) this.emit('allInRunout');
        this.emit('dealCommunityCards', { cards: flopCards, street: 'flop', all: this.communityCards, fastForward: allInPreFlop });
        await this._delay(allInPreFlop ? TIMING.COMMUNITY_DEAL_FAST_MS : TIMING.COMMUNITY_DEAL_NORMAL_MS);

        this.phase = PHASES.FLOP;
        if (!allInPreFlop) {
            await this._runBettingRound(this._nextInHandActiveIndex(this.dealerIndex), 0, this.blindLevel.big);
            if (this._checkHandOver()) return;
        }

        this.phase = PHASES.DEAL_TURN;
        const turnCard = this.deck.deal(1);
        this.communityCards.push(...turnCard);
        const allInPreTurn = this._isAllInRunout();
        this.emit('dealCommunityCards', { cards: turnCard, street: 'turn', all: this.communityCards, fastForward: allInPreTurn });
        await this._delay(allInPreTurn ? TIMING.COMMUNITY_DEAL_FAST_MS : TIMING.COMMUNITY_DEAL_NORMAL_MS);

        this.phase = PHASES.TURN;
        if (!allInPreTurn) {
            await this._runBettingRound(this._nextInHandActiveIndex(this.dealerIndex), 0, this.blindLevel.big);
            if (this._checkHandOver()) return;
        }

        this.phase = PHASES.DEAL_RIVER;
        const riverCard = this.deck.deal(1);
        this.communityCards.push(...riverCard);
        const allInPreRiver = this._isAllInRunout();
        this.emit('dealCommunityCards', { cards: riverCard, street: 'river', all: this.communityCards, fastForward: allInPreRiver });
        await this._delay(allInPreRiver ? TIMING.COMMUNITY_DEAL_FAST_MS : TIMING.COMMUNITY_DEAL_NORMAL_MS);

        this.phase = PHASES.RIVER;
        if (!allInPreRiver) {
            await this._runBettingRound(this._nextInHandActiveIndex(this.dealerIndex), 0, this.blindLevel.big);
        }

        if (this._checkHandOver()) return;

        await this._showdown();
    }

    async _postBlinds() {
        const sb = this.players[this.smallBlindIndex];
        const sbAmount = sb.bet(Math.min(this.blindLevel.small, sb.chips));
        this.emit('postBlind', { player: sb, amount: sbAmount, type: 'small' });

        const bb = this.players[this.bigBlindIndex];
        const bbAmount = bb.bet(Math.min(this.blindLevel.big, bb.chips));
        this.emit('postBlind', { player: bb, amount: bbAmount, type: 'big' });

        await this._delay(TIMING.POST_BLIND_MS);
    }

    async _dealHoleCards() {
        this.phase = PHASES.DEAL_HOLE_CARDS;

        for (const player of this.players) {
            if (!player.isSittingOut) {
                player.holeCards = this.deck.deal(2);
            }
        }

        this.emit('dealHoleCards', { players: this.players });
        await this._delay(TIMING.HOLE_DEAL_MS);
    }

    async _runBettingRound(startIndex, currentBet, minRaise) {
        const canAct = this.players.filter(p => p.isActive).length;
        if (canAct < 2) {
            this.emit('bettingRoundStart', { phase: this.phase });
            this.potManager.collectBets(this.players);
            this.emit('bettingRoundEnd', {
                phase: this.phase,
                pots: this.potManager.potDescriptions,
                totalPot: this.potManager.totalPot
            });
            return;
        }

        this.bettingRound = new BettingRound(this.players, startIndex, currentBet, minRaise);

        this.emit('bettingRoundStart', { phase: this.phase });

        while (!this.bettingRound.isComplete && !this.bettingRound.onlyOnePlayerRemaining) {
            const player = this.bettingRound.currentPlayer;

            if (!player.isActive) {
                this.bettingRound.playerActed[this.bettingRound.actionIndex] = true;
                const next = this.bettingRound._findNextPlayer();
                if (next === null) {
                    this.bettingRound.isComplete = true;
                    break;
                }
                this.bettingRound.actionIndex = next;
                continue;
            }

            const validActions = this.bettingRound.getValidActions();

            this.emit('playerTurn', {
                player,
                playerIndex: this.bettingRound.currentPlayerIndex,
                validActions
            });

            let action;
            if (player.isHuman) {
                action = await this._getHumanAction(validActions);
            } else {
                action = await this._getAIAction(player, validActions);
            }

            const result = this.bettingRound.processAction(action);

            this.emit('playerAction', {
                player,
                playerIndex: this.bettingRound.actionIndex,
                action,
                pot: this.potManager.totalPot + this._currentRoundBets()
            });

            await this._delay(TIMING.BETWEEN_ACTIONS_MS);
        }

        this.potManager.collectBets(this.players);
        this.emit('bettingRoundEnd', {
            phase: this.phase,
            pots: this.potManager.potDescriptions,
            totalPot: this.potManager.totalPot
        });

        this.bettingRound = null;
    }

    _currentRoundBets() {
        return this.players.reduce((sum, p) => sum + p.currentBet, 0);
    }

    async _getHumanAction(validActions) {
        const timeout = this.config.humanTurnTimeoutMs;
        return new Promise(resolve => {
            this._humanActionResolver = resolve;

            if (timeout && timeout > 0) {
                const timer = setTimeout(() => {
                    if (this._humanActionResolver === resolve) {
                        this._humanActionResolver = null;
                        const check = validActions.find(a => a.type === ACTIONS.CHECK);
                        resolve(check ? { type: ACTIONS.CHECK } : { type: ACTIONS.FOLD });
                    }
                }, timeout);
                this._humanActionTimer = timer;
            }
        });
    }

    handleHumanAction(action) {
        if (this._humanActionTimer) {
            clearTimeout(this._humanActionTimer);
            this._humanActionTimer = null;
        }
        if (this._humanActionResolver) {
            const resolver = this._humanActionResolver;
            this._humanActionResolver = null;
            resolver(action);
        }
    }

    async _getAIAction(player, validActions) {
        if (!this.aiController) {
            const callAction = validActions.find(a => a.type === ACTIONS.CALL);
            const checkAction = validActions.find(a => a.type === ACTIONS.CHECK);
            return callAction || checkAction || { type: ACTIONS.FOLD };
        }

        const gameState = {
            communityCards: [...this.communityCards],
            pot: this.potManager.totalPot + this._currentRoundBets(),
            currentBet: this.bettingRound.currentBet,
            minRaise: this.bettingRound.lastRaiseAmount,
            playerChips: player.chips,
            playerCurrentBet: player.currentBet,
            holeCards: player.holeCards,
            numActivePlayers: this.playersInHand.length,
            phase: this.phase,
            playersInfo: this.players.map(p => ({
                name: p.name,
                chips: p.chips,
                currentBet: p.currentBet,
                isFolded: p.isFolded,
                isAllIn: p.isAllIn
            }))
        };

        const thinkTime = this.config.aiThinkingDelayMin +
            Math.random() * (this.config.aiThinkingDelayMax - this.config.aiThinkingDelayMin);

        this.emit('aiThinking', { player });

        const [action] = await Promise.all([
            this.aiController.decide(player, gameState, validActions),
            this._delay(thinkTime)
        ]);

        return action;
    }

    /* True when all remaining players are all-in (no one can bet). Used to fast-forward streets. */
    _isAllInRunout() {
        const inHand = this.playersInHand;
        if (inHand.length < 2) return false;
        return inHand.every(p => p.isAllIn || p.chips === 0);
    }

    _checkHandOver() {
        const inHand = this.playersInHand;
        if (inHand.length <= 1) {
            this.potManager.collectBets(this.players);

            const winner = inHand[0];
            const amount = this.potManager.totalPot;
            winner.chips += amount;

            this.emit('handWonUncontested', {
                winner,
                amount
            });

            this._markBustedPlayers();
            this._advanceDealer();
            this.phase = PHASES.WAITING;
            return true;
        }

        return false;
    }

    async _showdown() {
        this.phase = PHASES.SHOWDOWN;

        const inHand = this.playersInHand;
        const evaluations = [];

        for (const player of inHand) {
            const allCards = [...player.holeCards, ...this.communityCards];
            const eval_ = HandEvaluator.evaluate(allCards);
            const playerIndex = this.players.indexOf(player);
            evaluations.push({ player, playerIndex, eval: eval_ });
        }

        evaluations.sort((a, b) => b.eval.score - a.eval.score);

        this.emit('showdown', {
            evaluations: evaluations.map(e => ({
                player: e.player,
                playerIndex: e.playerIndex,
                hand: e.eval.bestHand,
                name: e.eval.name,
                ranking: e.eval.ranking,
                eval: e.eval
            })),
            communityCards: this.communityCards
        });

        await this._delay(TIMING.SHOWDOWN_REVEAL_MS);

        const awards = this.potManager.distributePots(evaluations);

        for (const award of awards) {
            this.players[award.playerIndex].chips += award.amount;
        }

        this.emit('potsAwarded', { awards, evaluations });

        // Wait for user to click continue (or countdown auto-advance in main.js)
        await new Promise(resolve => {
            this._showdownContinueResolver = resolve;
        });

        this.emit('hideShowdown');

        this._markBustedPlayers();
        this._advanceDealer();
        this.phase = PHASES.WAITING;

        await this._delay(TIMING.POST_HAND_MS);
    }

    _advanceDealer() {
        this.dealerIndex = this._nextActiveIndex(this.dealerIndex);
    }

    getGameState() {
        return {
            phase: this.phase,
            players: this.players.map(p => ({
                name: p.name,
                chips: p.chips,
                currentBet: p.currentBet,
                isFolded: p.isFolded,
                isAllIn: p.isAllIn,
                isSittingOut: p.isSittingOut,
                isHuman: p.isHuman,
                holeCards: p.isHuman ? p.holeCards : null,
                seatIndex: p.seatIndex
            })),
            communityCards: this.communityCards,
            dealerIndex: this.dealerIndex,
            pots: this.potManager.potDescriptions,
            totalPot: this.potManager.totalPot + this._currentRoundBets(),
            handNumber: this.handNumber,
            blindLevel: this.blindLevel
        };
    }
}
