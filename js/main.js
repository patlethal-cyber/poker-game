import { Game } from './game/Game.js';
import { AIController } from './ai/AIController.js';
import { TableRenderer } from './ui/TableRenderer.js';
import { ActionPanel } from './ui/ActionPanel.js';
import { MessageLog } from './ui/MessageLog.js';
import { AudioManager } from './ui/AudioManager.js';
import { HistoryStore } from './storage/HistoryStore.js';
import { formatChips } from './utils/helpers.js';

function cardToCode(c) {
    const rank = c.rank === '10' ? 'T' : c.rank;
    const suit = { hearts: 'h', diamonds: 'd', clubs: 'c', spades: 's' }[c.suit];
    return `${rank}${suit}`;
}

class PokerApp {
    constructor() {
        this.game = null;
        this.tableRenderer = null;
        this.actionPanel = null;
        this.messageLog = null;
        this.audio = null;
        this.history = null;
        this._currentRec = null;
    }

    init() {
        this.messageLog = new MessageLog();
        this.audio = new AudioManager();
        this.history = new HistoryStore();
        this._initMuteButton();
        this._initHistoryScreen();

        const startBtn = document.getElementById('start-btn');
        startBtn.addEventListener('click', () => {
            this.audio.resumeIfSuspended();
            this.startNewGame();
        });

        const playerCountEl = document.getElementById('player-count');
        if (playerCountEl) {
            const saved = this._loadSettings().lastPlayerCount;
            if (saved && saved >= 4 && saved <= 10) playerCountEl.value = String(saved);
            playerCountEl.addEventListener('change', () => {
                this._saveSettings({ lastPlayerCount: parseInt(playerCountEl.value) });
            });
        }
    }

    _finalizeHandRecord() {
        const rec = this._currentRec;
        if (!rec || !this.game) return;

        for (const seat of rec.seats) {
            const p = this.game.players[seat.seatIndex];
            if (p) seat.endChips = p.chips;
        }

        const humanSeat = rec.seats.find(s => s.isHuman);
        if (humanSeat) {
            rec.humanNet = humanSeat.endChips - humanSeat.startChips;
            if (rec.humanActions.some(a => a.type === 'fold')) rec.humanResult = 'fold';
            else if (rec.humanNet > 0) rec.humanResult = 'win';
            else if (rec.humanNet === 0) rec.humanResult = 'chop';
            else rec.humanResult = 'loss';
        }

        this.history.appendHand(rec);
        this._currentRec = null;
    }

    _initHistoryScreen() {
        const btnOpen = document.getElementById('btn-history');
        const screen = document.getElementById('history-screen');
        const btnClose = document.getElementById('btn-history-close');
        const btnExport = document.getElementById('btn-history-export');
        const btnImport = document.getElementById('btn-history-import');
        const btnClear = document.getElementById('btn-history-clear');
        const importInput = document.getElementById('history-import-input');
        if (!btnOpen || !screen) return;

        const open = () => {
            this._renderHistory();
            screen.classList.add('visible');
        };
        const close = () => screen.classList.remove('visible');

        btnOpen.addEventListener('click', open);
        btnClose?.addEventListener('click', close);
        btnExport?.addEventListener('click', () => this.history.exportJSON());
        btnImport?.addEventListener('click', () => importInput?.click());
        btnClear?.addEventListener('click', () => {
            if (confirm('Clear all saved history? This cannot be undone.')) {
                this.history.clear();
                this._renderHistory();
            }
        });
        importInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                await this.history.importJSON(file);
                this._renderHistory();
                alert('History imported successfully.');
            } catch (err) {
                alert('Import failed: ' + err.message);
            }
            importInput.value = '';
        });
    }

    _renderHistory() {
        const statsEl = document.getElementById('history-stats');
        const tableEl = document.getElementById('history-table-body');
        if (!statsEl || !tableEl) return;

        const s = this.history.getStats();
        const vpipPct = s.handsPlayed > 0 ? (s.vpipHands / s.handsPlayed * 100).toFixed(1) : '0.0';
        const pfrPct = s.handsPlayed > 0 ? (s.pfrHands / s.handsPlayed * 100).toFixed(1) : '0.0';
        const sdWinPct = s.showdownsSeen > 0 ? (s.showdownsWon / s.showdownsSeen * 100).toFixed(1) : '0.0';
        const netSign = s.totalNet >= 0 ? '+' : '';
        const netClass = s.totalNet > 0 ? 'positive' : s.totalNet < 0 ? 'negative' : '';

        statsEl.innerHTML = `
            <div class="stats-row"><span class="label">Hands Played</span><span class="value">${s.handsPlayed}</span></div>
            <div class="stats-row"><span class="label">Hands Won</span><span class="value">${s.handsWon}</span></div>
            <div class="stats-row"><span class="label">Total Net</span><span class="value ${netClass}">${netSign}${formatChips(Math.abs(s.totalNet))}</span></div>
            <div class="stats-row"><span class="label">Biggest Win</span><span class="value">${formatChips(s.biggestWin)}</span></div>
            <div class="stats-row"><span class="label">Biggest Pot Seen</span><span class="value">${formatChips(s.biggestPot)}</span></div>
            <div class="stats-row"><span class="label">VPIP</span><span class="value">${vpipPct}%</span></div>
            <div class="stats-row"><span class="label">PFR</span><span class="value">${pfrPct}%</span></div>
            <div class="stats-row"><span class="label">Showdown Win%</span><span class="value">${sdWinPct}%</span></div>
        `;

        const all = this.history.getAll().slice().reverse();
        if (all.length === 0) {
            tableEl.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:20px">No hands recorded yet. Play a hand to start tracking.</td></tr>';
            return;
        }
        tableEl.innerHTML = all.map(rec => {
            const net = rec.humanNet || 0;
            const netSign = net > 0 ? '+' : '';
            const netClass = net > 0 ? 'positive' : net < 0 ? 'negative' : '';
            const result = { win: 'Won', loss: 'Lost', fold: 'Folded', chop: 'Chopped' }[rec.humanResult] || rec.humanResult;
            const winnerHand = (rec.pots[0]?.winners[0]?.handName) || '—';
            const street = rec.finalStreet === 'showdown-uncontested' ? 'uncontested' : rec.finalStreet;
            return `<tr>
                <td>#${rec.handNumber}</td>
                <td>${result}</td>
                <td class="${netClass}">${netSign}${formatChips(Math.abs(net))}</td>
                <td>${street}</td>
                <td>${winnerHand}</td>
            </tr>`;
        }).join('');
    }

    _initMuteButton() {
        const btn = document.getElementById('btn-mute');
        if (!btn) return;
        const render = () => {
            btn.textContent = this.audio.muted ? '🔇' : '🔊';
            btn.setAttribute('aria-label', this.audio.muted ? 'Unmute sound' : 'Mute sound');
            btn.classList.toggle('muted', this.audio.muted);
        };
        render();
        btn.addEventListener('click', () => {
            this.audio.toggleMute();
            this.audio.resumeIfSuspended();
            if (!this.audio.muted) this.audio.play('chip-light');
            render();
        });
    }

    _loadSettings() {
        try { return JSON.parse(localStorage.getItem('poker.settings.v1')) || {}; }
        catch { return {}; }
    }

    _saveSettings(partial) {
        const cur = this._loadSettings();
        localStorage.setItem('poker.settings.v1', JSON.stringify({ ...cur, ...partial }));
    }

    _buildPlayerList(count) {
        const AI_POOL = ['Shark', 'Maniac', 'Rock', 'Fish', 'Wildcard'];
        const players = [{ name: 'You', isHuman: true, strategy: null }];
        const counts = {};
        for (let i = 0; i < count - 1; i++) {
            const strat = AI_POOL[i % AI_POOL.length];
            counts[strat] = (counts[strat] || 0) + 1;
            const name = counts[strat] === 1 ? strat : `${strat} ${counts[strat]}`;
            players.push({ name, isHuman: false, strategy: strat });
        }
        return players;
    }

    startNewGame() {
        if (this.game) {
            this.game.stopGame();
            this.game._listeners = {};
        }

        document.getElementById('start-screen').style.display = 'none';
        const statsEl = document.getElementById('game-over-stats');
        if (statsEl) statsEl.style.display = 'none';

        const tableArea = document.getElementById('table-area');
        const seatEls = tableArea.querySelectorAll('.player-seat, .player-bet, .dealer-button, .position-label');
        seatEls.forEach(el => el.remove());

        const playerCountEl = document.getElementById('player-count');
        const count = playerCountEl ? Math.max(4, Math.min(10, parseInt(playerCountEl.value) || 6)) : 6;
        this._saveSettings({ lastPlayerCount: count });

        this.game = new Game();
        this.game.aiController = new AIController();

        this.game.setupPlayers(this._buildPlayerList(count));

        this.tableRenderer = new TableRenderer(tableArea);
        this.tableRenderer.init(this.game.players);
        this.actionPanel = new ActionPanel(this.game);

        this._bindGameEvents();

        this._updateGameInfo();

        this.game.startGame();
    }

    _bindGameEvents() {
        const g = this.game;
        const tr = this.tableRenderer;
        const ap = this.actionPanel;
        const ml = this.messageLog;
        const audio = this.audio;

        g.on('newHand', (data) => {
            tr.resetForNewHand();
            tr.moveDealerButton(g.dealerIndex);
            for (const p of g.players) tr.updatePlayer(p);
            setTimeout(() => tr.movePositionLabels(g.smallBlindIndex, g.bigBlindIndex), 50);
            ml.show(`Hand #${data.handNumber} — Blinds ${formatChips(data.blinds.small)}/${formatChips(data.blinds.big)}`, 4000);
            this._updateGameInfo();

            this._currentRec = {
                id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                ts: Date.now(),
                handNumber: data.handNumber,
                playerCount: g.players.length,
                blinds: { small: data.blinds.small, big: data.blinds.big },
                seats: g.players.map(p => ({
                    name: p.name,
                    strategy: p.strategy,
                    startChips: p.chips,
                    endChips: p.chips,
                    isHuman: p.isHuman,
                    seatIndex: p.seatIndex
                })),
                dealerSeat: g.dealerIndex,
                humanHoleCards: [],
                community: [],
                finalStreet: 'preflop',
                pots: [],
                humanActions: [],
                humanResult: 'fold',
                humanNet: 0
            };
        });

        g.on('blindsUp', (data) => {
            ml.show(`Blinds increase to ${formatChips(data.level.small)}/${formatChips(data.level.big)}!`, 5000);
            audio.play('blinds-up');
            this._updateGameInfo();
        });

        g.on('postBlind', (data) => {
            tr.updatePlayer(data.player);
            tr.updateBets(g.players);
            audio.play('chip-light');
        });

        g.on('dealHoleCards', (data) => {
            tr.dealHoleCards(data.players);
            audio.play('deal');
            const human = g.humanPlayer;
            if (this._currentRec && human) {
                this._currentRec.humanHoleCards = (human.holeCards || []).map(cardToCode);
            }
        });

        g.on('dealCommunityCards', (data) => {
            tr.dealCommunityCards(data.cards, data.all);
            const streetNames = { flop: 'Flop', turn: 'Turn', river: 'River' };
            ml.show(`Dealing the ${streetNames[data.street] || data.street}`, 2000);
            audio.play('deal');
            if (this._currentRec) {
                this._currentRec.community = (data.all || []).map(cardToCode);
                this._currentRec.finalStreet = data.street;
            }
        });

        g.on('playerTurn', (data) => {
            tr.setActivePlayer(data.playerIndex);
            if (data.player.isHuman) {
                ap.show(data.validActions);
            }
        });

        g.on('aiThinking', (data) => {
            tr.showThinking(data.player, true);
        });

        g.on('playerAction', (data) => {
            tr.showThinking(data.player, false);
            tr.showPlayerAction(data.player, data.action);
            tr.updatePlayer(data.player);
            tr.updateBets(g.players);
            tr.updatePot(data.pot, null);

            const bigBlind = g.blindLevel.big;
            const type = data.action.type;
            if (type === 'fold') audio.play('fold');
            else if (type === 'check') audio.play('check');
            else if (type === 'allIn') audio.play('all-in');
            else if (type === 'call' || type === 'bet' || type === 'raise') {
                audio.play(data.action.amount >= bigBlind * 3 ? 'chip-heavy' : 'chip-light');
            }

            if (this._currentRec && data.player.isHuman) {
                const streetMap = {
                    preflop: 'preflop', flop: 'flop', turn: 'turn', river: 'river'
                };
                this._currentRec.humanActions.push({
                    street: streetMap[g.phase] || g.phase,
                    type,
                    amount: data.action.amount || 0
                });
            }
        });

        g.on('bettingRoundEnd', (data) => {
            tr.setActivePlayer(null);
            tr.clearBets();
            tr.clearAllActions();
            tr.updatePot(data.totalPot, data.pots);
        });

        g.on('handWonUncontested', (data) => {
            ml.show(`${data.winner.name} wins ${formatChips(data.amount)}!`, 3000);
            tr.updatePlayer(data.winner);
            tr.showWinner(data.winner.seatIndex);
            audio.play('win');
            this._updateGameInfo();

            if (this._currentRec) {
                this._currentRec.pots = [{
                    amount: data.amount,
                    winners: [{ seat: data.winner.seatIndex, amount: data.amount, handName: 'uncontested' }]
                }];
                this._currentRec.finalStreet = 'showdown-uncontested';
                this._finalizeHandRecord();
            }
        });

        g.on('showdown', (data) => {
            for (const e of data.evaluations) {
                tr.revealPlayerCards(e.player);
            }
            this._showShowdownOverlay(data);
        });

        g.on('potsAwarded', (data) => {
            for (const award of data.awards) {
                const player = g.players[award.playerIndex];
                tr.updatePlayer(player);
                tr.showWinner(award.playerIndex);
                ml.show(`${player.name} wins ${formatChips(award.amount)} with ${data.evaluations.find(e => e.playerIndex === award.playerIndex)?.eval.name || 'best hand'}!`, 6000);
            }
            audio.play('win');
            this._updateGameInfo();

            if (this._currentRec) {
                const potMap = {};
                for (const award of data.awards) {
                    if (!potMap[award.potIndex]) potMap[award.potIndex] = { amount: 0, winners: [] };
                    potMap[award.potIndex].amount += award.amount;
                    const evalInfo = data.evaluations.find(e => e.playerIndex === award.playerIndex);
                    potMap[award.potIndex].winners.push({
                        seat: award.playerIndex,
                        amount: award.amount,
                        handName: evalInfo?.eval?.name || 'unknown'
                    });
                }
                this._currentRec.pots = Object.values(potMap);
                this._currentRec.finalStreet = 'showdown';
                this._finalizeHandRecord();
            }
        });

        g.on('hideShowdown', () => {
            const overlay = document.getElementById('showdown-overlay');
            overlay.classList.add('fading');
            setTimeout(() => {
                overlay.classList.remove('visible', 'fading');
            }, 400);
        });

        g.on('gameOver', (data) => {
            if (data.winner) {
                ml.show(`Game Over! ${data.winner.name} wins the tournament!`, 0);
            } else {
                ml.show('Game Over!', 0);
            }
            setTimeout(() => {
                this._showGameOverStats();
                document.getElementById('start-screen').style.display = '';
                document.getElementById('start-btn').textContent = 'PLAY AGAIN';
            }, 2000);
        });
    }

    _showShowdownOverlay(data) {
        const overlay = document.getElementById('showdown-overlay');
        const content = document.getElementById('showdown-content');

        let html = '<h2>Showdown</h2>';
        for (const e of data.evaluations) {
            const cards = e.player.holeCards.map(c => {
                const color = (c.suit === 'hearts' || c.suit === 'diamonds') ? 'red' : 'black';
                const symbols = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
                return `<span style="color:${color};font-weight:bold">${c.rank}${symbols[c.suit]}</span>`;
            }).join(' ');

            html += `
                <div class="showdown-hand">
                    <span class="showdown-player-name">${e.player.name}</span>
                    <span class="showdown-hand-cards">${cards}</span>
                    <span class="showdown-hand-name">${e.name}</span>
                </div>
            `;
        }

        content.innerHTML = html;
        overlay.classList.add('visible');
    }

    _showGameOverStats() {
        const statsEl = document.getElementById('game-over-stats');
        if (!this.game || !statsEl) return;

        const g = this.game;
        const human = g.humanPlayer;
        const netResult = human.chips - g.config.startingChips;
        const netClass = netResult > 0 ? 'positive' : netResult < 0 ? 'negative' : '';
        const netPrefix = netResult > 0 ? '+' : '';

        const standings = [...g.players].sort((a, b) => b.chips - a.chips);
        const humanRank = standings.findIndex(p => p.isHuman) + 1;

        let standingsHtml = '';
        standings.forEach((p, i) => {
            const rankClass = i === 0 ? 'first' : i === 1 ? 'second' : i === 2 ? 'third' : '';
            const nameStyle = p.isHuman ? 'color: var(--gold); font-weight: 700' : '';
            standingsHtml += `
                <div class="stats-row">
                    <span class="label"><span class="stats-rank ${rankClass}">${i + 1}</span> <span style="${nameStyle}">${p.name}</span></span>
                    <span class="value">${formatChips(p.chips)}</span>
                </div>`;
        });

        statsEl.innerHTML = `
            <h3>Game Summary</h3>
            <div class="stats-row"><span class="label">Hands Played</span><span class="value">${g.handNumber}</span></div>
            <div class="stats-row"><span class="label">Final Blinds</span><span class="value">${formatChips(g.blindLevel.small)}/${formatChips(g.blindLevel.big)}</span></div>
            <div class="stats-row"><span class="label">Your Finish</span><span class="value">#${humanRank} of ${g.players.length}</span></div>
            <div class="stats-row"><span class="label">Net Result</span><span class="value ${netClass}">${netPrefix}${formatChips(Math.abs(netResult))}</span></div>
            <div class="stats-standings">
                <div class="stats-row"><span class="label" style="font-weight:600;color:var(--text-light)">Final Standings</span><span class="value" style="color:var(--text-dim)">Chips</span></div>
                ${standingsHtml}
            </div>
        `;
        statsEl.style.display = '';
    }

    _updateGameInfo() {
        const infoEl = document.getElementById('game-info');
        if (!this.game) return;
        const handNum = this.game.handNumber || 0;
        const blinds = this.game.blindLevel;
        const activePlayers = this.game.activePlayers.length;
        const total = this.game.players.length;
        infoEl.innerHTML = `
            <span>Hand #${handNum}</span>
            <span>Blinds: ${formatChips(blinds.small)}/${formatChips(blinds.big)}</span>
            <span>Players: ${activePlayers}/${total}</span>
        `;
    }
}

function bootPoker() {
    const app = new PokerApp();
    app.init();
    window.__pokerApp = app;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPoker);
} else {
    bootPoker();
}
