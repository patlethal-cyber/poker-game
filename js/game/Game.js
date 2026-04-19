import { PHASES, DEFAULT_CONFIG, ACTIONS, BLIND_SCHEDULE } from '../utils/constants.js';
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
            await delay(2000);
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
        this.emit('dealCommunityCards', { cards: flopCards, street: 'flop', all: this.communityCards });
        await delay(800);

        this.phase = PHASES.FLOP;
        await this._runBettingRound(this._nextInHandActiveIndex(this.dealerIndex), 0, this.blindLevel.big);

        if (this._checkHandOver()) return;

        this.phase = PHASES.DEAL_TURN;
        const turnCard = this.deck.deal(1);
        this.communityCards.push(...turnCard);
        this.emit('dealCommunityCards', { cards: turnCard, street: 'turn', all: this.communityCards });
        await delay(800);

        this.phase = PHASES.TURN;
        await this._runBettingRound(this._nextInHandActiveIndex(this.dealerIndex), 0, this.blindLevel.big);

        if (this._checkHandOver()) return;

        this.phase = PHASES.DEAL_RIVER;
        const riverCard = this.deck.deal(1);
        this.communityCards.push(...riverCard);
        this.emit('dealCommunityCards', { cards: riverCard, street: 'river', all: this.communityCards });
        await delay(800);

        this.phase = PHASES.RIVER;
        await this._runBettingRound(this._nextInHandActiveIndex(this.dealerIndex), 0, this.blindLevel.big);

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

        await delay(400);
    }

    async _dealHoleCards() {
        this.phase = PHASES.DEAL_HOLE_CARDS;

        for (const player of this.players) {
            if (!player.isSittingOut) {
                player.holeCards = this.deck.deal(2);
            }
        }

        this.emit('dealHoleCards', { players: this.players });
        await delay(600);
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

            await delay(300);
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
            delay(thinkTime)
        ]);

        return action;
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

        await delay(2500);

        const awards = this.potManager.distributePots(evaluations);

        for (const award of awards) {
            this.players[award.playerIndex].chips += award.amount;
        }

        this.emit('potsAwarded', { awards, evaluations });

        await delay(5000);

        this.emit('hideShowdown');

        this._markBustedPlayers();
        this._advanceDealer();
        this.phase = PHASES.WAITING;

        await delay(1000);
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
