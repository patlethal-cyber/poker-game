import { Game } from './game/Game.js';
import { AIController } from './ai/AIController.js';
import { assignPersonalities } from './ai/RoleAssigner.js';
import { TableRenderer } from './ui/TableRenderer.js';
import { ActionPanel } from './ui/ActionPanel.js';
import { Toast } from './ui/Toast.js';
import { AudioManager } from './ui/AudioManager.js';
import { HistoryStore } from './storage/HistoryStore.js';
import {
    formatChips, shuffle,
    NAME_POOL_MALE, NAME_POOL_FEMALE, NAME_GENDER, avatarInitial,
    avatarBgGradient
} from './utils/helpers.js';
import { BLIND_SCHEDULE, DEFAULT_CONFIG, HAND_NAMES, TIMING } from './utils/constants.js';
import * as i18n from './i18n.js';
const t = i18n.t;

function cardToCode(c) {
    const rank = c.rank === '10' ? 'T' : c.rank;
    const suit = { hearts: 'h', diamonds: 'd', clubs: 'c', spades: 's' }[c.suit];
    return `${rank}${suit}`;
}

function suitSymbol(s) {
    return { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' }[s];
}

function miniCardHTML(c) {
    const red = c.suit === 'hearts' || c.suit === 'diamonds';
    return `<span class="mini-card${red ? ' red' : ''}">${c.rank}<span class="mini-suit">${suitSymbol(c.suit)}</span></span>`;
}

function microCardHTML(c) {
    const red = c.suit === 'hearts' || c.suit === 'diamonds';
    const colorClass = red ? 'red' : 'black';
    return `<div class="card micro ${colorClass}">
        <div class="card-inner"><div class="card-front">
            <div class="card-center">
                <span class="micro-rank">${c.rank}</span>
                <span class="micro-suit">${suitSymbol(c.suit)}</span>
            </div>
        </div></div>
    </div>`;
}

class PokerApp {
    constructor() {
        this.game = null;
        this.tableRenderer = null;
        this.actionPanel = null;
        this.toast = null;
        this.audio = null;
        this.history = null;
        this._currentRec = null;
        this._paused = false;
        this._showdownCountdownId = null;
    }

    init() {
        // i18n must run first so all subsequent renders use the current language
        i18n.init();

        this.toast = new Toast();
        this.audio = new AudioManager();
        this.history = new HistoryStore();
        this._initTopBar();
        this._initLangToggle();
        this._initHistoryScreen();
        this._initRankingsScreen();
        this._initPauseControls();
        this._initVisibilityAutoPause();
        this._initOrientationCheck();

        // Populate player-count select with i18n labels
        const playerCountEl = document.getElementById('player-count');
        const populatePlayerCount = () => {
            if (!playerCountEl) return;
            const prev = playerCountEl.value;
            playerCountEl.innerHTML = '';
            for (let n = 4; n <= 10; n++) {
                const opt = document.createElement('option');
                opt.value = String(n);
                opt.textContent = t('start.player_count_opt', { n });
                if (n === 6) opt.defaultSelected = true;
                playerCountEl.appendChild(opt);
            }
            if (prev) playerCountEl.value = prev;
        };
        populatePlayerCount();

        const startBtn = document.getElementById('start-btn');
        startBtn.addEventListener('click', () => {
            this.audio.resumeIfSuspended();
            this.startNewGame();
        });

        if (playerCountEl) {
            const saved = this._loadSettings().lastPlayerCount;
            if (saved && saved >= 4 && saved <= 10) playerCountEl.value = String(saved);
            playerCountEl.addEventListener('change', () => {
                this._saveSettings({ lastPlayerCount: parseInt(playerCountEl.value) });
            });
        }

        // Re-render dynamic content (modals, info bar) when language changes.
        // Static labels via data-i18n are handled automatically by applyToDOM().
        i18n.onChange(() => {
            populatePlayerCount();
            // Re-render dynamic-content modals if open
            const historyOpen = document.getElementById('history-screen')?.classList.contains('visible');
            if (historyOpen) this._renderHistory();
            const rankingsOpen = document.getElementById('rankings-screen')?.classList.contains('visible');
            if (rankingsOpen) this._renderRankings();
            // Re-render game info bar
            if (this.game) this._updateGameInfo();
            // Re-render game-over stats panel if visible
            const goEl = document.getElementById('game-over-stats');
            if (goEl && goEl.style.display !== 'none' && this.game) this._showGameOverStats();
            // Re-render orientation overlay text (if currently shown)
            this._refreshOrientationText();
            // Re-render showdown overlay if currently visible
            const sdEl = document.getElementById('showdown-overlay');
            if (sdEl?.classList.contains('visible') && this._pendingShowdown && this._pendingAwards) {
                this._showShowdownOverlay(this._pendingShowdown, this._pendingAwards);
            }
        });
    }

    _initLangToggle() {
        const btn = document.getElementById('btn-lang');
        if (!btn) return;
        btn.addEventListener('click', () => {
            i18n.toggleLang();
            // applyToDOM in i18n updates the button's text via data-i18n automatically
        });
    }

    // ---------------- Orientation / viewport gate ----------------

    _initOrientationCheck() {
        // Mobile = touch device with shortest side < this threshold.
        // 850 leaves iPad mini portrait (744) on the desktop layout while
        // every iPhone (max short side ~430) qualifies as mobile.
        this._mobileMaxShortSide = 850;
        // Desktop minimum width — below this we still warn on desktop.
        this._desktopMinWidth = 620;
        this._refreshOrientationText = this._refreshOrientationText.bind(this);
        window.addEventListener('resize', this._refreshOrientationText);
        window.addEventListener('orientationchange', this._refreshOrientationText);
        this._refreshOrientationText();
    }

    _refreshOrientationText() {
        const overlay = document.getElementById('rotate-overlay');
        if (!overlay) return;
        const titleEl = overlay.querySelector('.rotate-title');
        const descEl = overlay.querySelector('.rotate-desc');
        const iconEl = overlay.querySelector('.rotate-icon');
        const MOBILE_MAX = this._mobileMaxShortSide || 850;
        const DESKTOP_MIN = this._desktopMinWidth || 620;
        const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const portrait = h > w;
        const touch = isTouchDevice();
        const isMobile = touch && Math.min(w, h) < MOBILE_MAX;

        // Block conditions:
        //   - Mobile + landscape  → ask user to rotate to portrait (REVERSED)
        //   - Desktop too narrow  → ask user to widen browser
        let blocked = false;
        let titleKey = null;
        let descKey = null;
        let descParams = {};
        let iconText = '📱';

        if (isMobile && !portrait) {
            blocked = true;
            titleKey = 'rotate.title_to_portrait';
            descKey = 'rotate.desc_to_portrait';
            iconText = '📱';
        } else if (!isMobile && w < DESKTOP_MIN) {
            blocked = true;
            titleKey = 'rotate.title_too_narrow';
            descKey = 'rotate.desc_too_narrow';
            descParams = { w: DESKTOP_MIN };
            iconText = '🖥️';
        }

        overlay.classList.toggle('visible', blocked);
        // Tag <body> so portrait-specific CSS in index.html can apply.
        document.body.classList.toggle('mobile-portrait', isMobile && portrait);

        if (!blocked || !titleEl || !descEl) return;
        if (iconEl) iconEl.textContent = iconText;
        titleEl.textContent = t(titleKey);
        descEl.textContent = t(descKey, descParams);
    }

    // ---------------- Top bar: mute, pause, rankings, stats hint ----------------

    _initTopBar() {
        // Mute
        const muteBtn = document.getElementById('btn-mute');
        const renderMute = () => {
            muteBtn.classList.toggle('muted', this.audio.muted);
            muteBtn.setAttribute('aria-label', this.audio.muted ? t('top.unmute') : t('top.mute'));
            muteBtn.setAttribute('data-tip', this.audio.muted ? t('top.unmute') : t('top.mute'));
        };
        renderMute();
        muteBtn.addEventListener('click', () => {
            this.audio.toggleMute();
            this.audio.resumeIfSuspended();
            if (!this.audio.muted) this.audio.play('chip-light');
            renderMute();
        });
        // Re-render mute label on language change
        i18n.onChange(renderMute);
    }

    _initPauseControls() {
        const pauseBtn = document.getElementById('btn-pause');
        const overlay = document.getElementById('pause-overlay');
        const resumeBtn = document.getElementById('btn-resume');

        pauseBtn?.addEventListener('click', () => this.togglePause(true));
        resumeBtn?.addEventListener('click', () => this.togglePause(false));
    }

    _initVisibilityAutoPause() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.game?.isRunning && !this._paused) {
                this.togglePause(true, /*auto=*/true);
            }
        });
    }

    togglePause(wantPause, auto = false) {
        if (!this.game) return;
        const overlay = document.getElementById('pause-overlay');
        const pauseBtn = document.getElementById('btn-pause');
        this._paused = !!wantPause;
        if (this._paused) {
            overlay?.classList.add('visible');
            pauseBtn?.classList.add('paused');
            this.game.setPaused(true);
            const p = overlay?.querySelector('p');
            if (p) {
                if (auto) {
                    p.textContent = t('pause.auto_paused');
                    delete p.dataset.i18n;  // disable auto re-render to keep custom message
                } else {
                    p.dataset.i18n = 'pause.body';
                    p.textContent = t('pause.body');
                }
            }
        } else {
            overlay?.classList.remove('visible');
            pauseBtn?.classList.remove('paused');
            this.game.setPaused(false);
        }
    }

    _initRankingsScreen() {
        const open = document.getElementById('btn-rankings');
        const close = document.getElementById('btn-rankings-close');
        const screen = document.getElementById('rankings-screen');
        const body = document.getElementById('rankings-body');
        if (!open || !screen || !body) return;

        this._renderRankings();

        let lastFocused = null;
        const openModal = () => {
            lastFocused = document.activeElement;
            screen.classList.add('visible');
            close?.focus();
        };
        const closeModal = () => {
            screen.classList.remove('visible');
            lastFocused?.focus?.();
        };
        open.addEventListener('click', openModal);
        close?.addEventListener('click', closeModal);
        screen.addEventListener('click', (e) => {
            if (e.target === screen) closeModal();
        });
        screen.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && screen.classList.contains('visible')) {
                e.preventDefault();
                closeModal();
            }
        });
    }

    _renderRankings() {
        const body = document.getElementById('rankings-body');
        if (!body) return;

        // Sample hand cards keyed by rank index (1..10). Internal-only data, not translated.
        const SAMPLES = {
            10: ['10h', 'Jh', 'Qh', 'Kh', 'Ah'],
             9: ['5s', '6s', '7s', '8s', '9s'],
             8: ['Kh', 'Kd', 'Kc', 'Ks', '3h'],
             7: ['Qh', 'Qd', 'Qc', '7h', '7d'],
             6: ['2d', '6d', '9d', 'Jd', 'Kd'],
             5: ['4h', '5c', '6d', '7s', '8h'],
             4: ['9h', '9d', '9c', 'Jd', '4s'],
             3: ['Ah', 'Ad', '8c', '8s', '2h'],
             2: ['Jh', 'Jd', '7c', '4s', '2d'],
             1: ['Ad', 'Kc', '9h', '6s', '3d']
        };

        const parseCode = (code) => {
            const rank = code.slice(0, code.length - 1);
            const suit = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' }[code.slice(-1)];
            return { rank: rank === 'T' ? '10' : rank, suit };
        };

        const rankings = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        body.innerHTML = rankings.map(rank => {
            const sample = (SAMPLES[rank] || []).map(parseCode);
            const cardsHTML = sample.map(microCardHTML).join('');
            return `<div class="ranking-row">
                <div class="rank-num">${rank}</div>
                <div class="rank-info">
                    <span class="rank-name">${t(`rank.${rank}.name`)}</span>
                    <span class="rank-ex">${t(`rank.${rank}.desc`)}</span>
                </div>
                <div class="rank-sample">${cardsHTML}</div>
            </div>`;
        }).join('');
    }

    _maybeShowStatsHint() {
        const settings = this._loadSettings();
        if (settings.statsHintSeen) return;
        const hands = this.history.getStats().handsPlayed;
        if (hands < 5) return;

        const hint = document.getElementById('stats-hint');
        const btn = document.getElementById('btn-history');
        const closeBtn = document.getElementById('stats-hint-close');
        if (!hint || !btn) return;

        btn.classList.add('has-news');
        hint.classList.add('visible');

        const dismiss = () => {
            hint.classList.remove('visible');
            btn.classList.remove('has-news');
            this._saveSettings({ statsHintSeen: true });
        };
        closeBtn?.addEventListener('click', dismiss, { once: true });
        setTimeout(() => {
            // Auto-dismiss after 8s
            if (hint.classList.contains('visible')) dismiss();
        }, 8000);
    }

    // ---------------- History screen ----------------

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
            // Clear the news indicator when opened
            btnOpen.classList.remove('has-news');
            document.getElementById('stats-hint')?.classList.remove('visible');
            this._saveSettings({ statsHintSeen: true });
            this._renderHistory();
            screen.classList.add('visible');
        };
        const close = () => screen.classList.remove('visible');

        btnOpen.addEventListener('click', open);
        btnClose?.addEventListener('click', close);
        btnExport?.addEventListener('click', () => this.history.exportJSON());
        btnImport?.addEventListener('click', () => importInput?.click());
        btnClear?.addEventListener('click', () => {
            if (confirm(t('history.clear_confirm'))) {
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
                alert(t('history.import_success'));
            } catch (err) {
                alert(t('history.import_failed', { err: err.message }));
            }
            importInput.value = '';
        });
        screen.addEventListener('click', (e) => {
            if (e.target === screen) close();
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
            <div class="stats-row"><span class="label">${t('history.stats.played')}</span><span class="value">${s.handsPlayed}</span></div>
            <div class="stats-row"><span class="label">${t('history.stats.won')}</span><span class="value">${s.handsWon}</span></div>
            <div class="stats-row"><span class="label">${t('history.stats.net')}</span><span class="value ${netClass}">${netSign}${formatChips(Math.abs(s.totalNet))}</span></div>
            <div class="stats-row"><span class="label">${t('history.stats.biggest_win')}</span><span class="value">${formatChips(s.biggestWin || 0)}</span></div>
            <div class="stats-row"><span class="label">${t('history.stats.biggest_pot')}</span><span class="value">${formatChips(s.biggestPot || 0)}</span></div>
            <div class="stats-row"><span class="label">${t('history.stats.vpip')}</span><span class="value">${vpipPct}%</span></div>
            <div class="stats-row"><span class="label">${t('history.stats.pfr')}</span><span class="value">${pfrPct}%</span></div>
            <div class="stats-row"><span class="label">${t('history.stats.sd_win')}</span><span class="value">${sdWinPct}%</span></div>
        `;

        const all = this.history.getAll().slice().reverse();
        if (all.length === 0) {
            tableEl.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--ink-faint);padding:20px">${t('history.empty')}</td></tr>`;
            return;
        }
        const resultKey = { win: 'history.result.win', loss: 'history.result.loss',
                            fold: 'history.result.fold', chop: 'history.result.chop' };
        tableEl.innerHTML = all.map(rec => {
            const net = rec.humanNet || 0;
            const netSign = net > 0 ? '+' : '';
            const netClass = net > 0 ? 'positive' : net < 0 ? 'negative' : '';
            const result = resultKey[rec.humanResult] ? t(resultKey[rec.humanResult]) : rec.humanResult;
            // winnerHand is a poker hand name like "Full House" — translate via rank lookup
            const winnerHandName = rec.pots?.[0]?.winners?.[0]?.handName;
            const winnerHand = this._translateHandName(winnerHandName);

            const renderCode = (code) => {
                if (!code) return '';
                const rank = code.slice(0, code.length - 1);
                const suit = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' }[code.slice(-1)];
                return miniCardHTML({ rank: rank === 'T' ? '10' : rank, suit });
            };
            const yourCards = (rec.humanHoleCards || []).map(renderCode).join('');
            const boardCards = (rec.community || []).map(renderCode).join('');

            return `<tr>
                <td>#${rec.handNumber}</td>
                <td>${result}</td>
                <td class="${netClass}">${netSign}${formatChips(Math.abs(net))}</td>
                <td class="hand-cards"><div class="mini-cards">${yourCards || '—'}</div></td>
                <td class="hand-cards"><div class="mini-cards">${boardCards || '—'}</div></td>
                <td>${winnerHand}</td>
            </tr>`;
        }).join('');
    }

    /** Translate a stored hand-name (e.g. "Full House", "uncontested") to current language. */
    _translateHandName(name) {
        if (!name || name === '—') return '—';
        if (name === 'uncontested') return name;
        // Find the rank index whose English name matches
        for (let i = 1; i <= 10; i++) {
            if (HAND_NAMES[i] === name) return t(`rank.${i}.name`);
        }
        return name;  // unknown, return as-is
    }

    _loadSettings() {
        try { return JSON.parse(localStorage.getItem('poker.settings.v1')) || {}; }
        catch { return {}; }
    }

    _saveSettings(partial) {
        const cur = this._loadSettings();
        localStorage.setItem('poker.settings.v1', JSON.stringify({ ...cur, ...partial }));
    }

    // ---------------- Game setup ----------------

    _buildPlayerList(count) {
        // Gender-balanced: shuffle both pools, interleave
        const males = shuffle(NAME_POOL_MALE);
        const females = shuffle(NAME_POOL_FEMALE);
        const aiCount = count - 1;
        const picked = [];
        const targetFemale = Math.round(aiCount * 0.5);
        for (let i = 0; i < targetFemale && i < females.length; i++) picked.push(females[i]);
        for (let i = 0; i < aiCount - targetFemale && i < males.length; i++) picked.push(males[i]);
        // Shuffle so seating is mixed
        const allNames = shuffle(picked);

        // Weighted personality distribution with a hard shark cap
        const strategies = assignPersonalities(count);

        const players = [{ name: 'You', isHuman: true, strategy: null }];
        for (let i = 0; i < aiCount; i++) {
            players.push({ name: allNames[i], isHuman: false, strategy: strategies[i] });
        }
        return players;
    }

    startNewGame() {
        if (this.game) {
            this.game.stopGame();
            this.game.removeAllListeners();
        }
        if (this.tableRenderer) {
            this.tableRenderer.dispose();
        }
        document.querySelectorAll('.confetti-piece').forEach(el => el.remove());
        // Dismiss any sticky toasts (e.g. "Game Over!") so the new game starts clean
        this.toast?.clear();

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
        const toast = this.toast;
        const audio = this.audio;

        g.on('newHand', (data) => {
            tr.resetForNewHand();
            tr.moveDealerButton(g.dealerIndex);
            for (const p of g.players) tr.updatePlayer(p);
            setTimeout(() => tr.movePositionLabels(g.smallBlindIndex, g.bigBlindIndex), 50);
            toast.show(t('toast.hand_start', {
                n: data.handNumber,
                sb: formatChips(data.blinds.small),
                bb: formatChips(data.blinds.big)
            }), { type: 'info', duration: 3500 });
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
            toast.show(t('toast.blinds_up', {
                sb: formatChips(data.level.small),
                bb: formatChips(data.level.big)
            }), { type: 'blinds' });
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

        g.on('allInRunout', () => {
            toast.show(t('toast.all_in_runout'), { type: 'warning' });
        });

        g.on('dealCommunityCards', (data) => {
            tr.dealCommunityCards(data.cards, data.all);
            const streetKey = { flop: 'toast.dealing_flop', turn: 'toast.dealing_turn', river: 'toast.dealing_river' }[data.street];
            // Street announcement is redundant with the card animation itself —
            // skip the toast for these to reduce notification noise.
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
                this._currentRec.humanActions.push({
                    street: g.phase,
                    type,
                    amount: data.action.amount || 0
                });
            }
        });

        g.on('bettingRoundEnd', (data) => {
            tr.setActivePlayer(null);
            tr.flyBetsToPot(g.players, () => {
                tr.clearBets();
                tr.clearAllActions();
                tr.updatePot(data.totalPot, data.pots);
            });
        });

        g.on('handWonUncontested', (data) => {
            const amount = formatChips(data.amount);
            const msg = data.winner.isHuman
                ? t('toast.you_win', { amount })
                : t('toast.someone_wins', { name: data.winner.name, amount });
            toast.show(msg, { type: 'success' });
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
                this._maybeShowStatsHint();
            }
        });

        g.on('showdown', (data) => {
            for (const e of data.evaluations) {
                tr.revealPlayerCards(e.player);
            }
            this._pendingShowdown = data;
            // Delay actual overlay until potsAwarded so we can show winners + awards
        });

        g.on('potsAwarded', (data) => {
            // Fly pot chips to winner(s) before updating UI
            const winnerIndices = [...new Set(data.awards.map(a => a.playerIndex))];
            tr.flyPotToWinners(winnerIndices, () => {
                for (const award of data.awards) {
                    const player = g.players[award.playerIndex];
                    tr.updatePlayer(player);
                    tr.showWinner(award.playerIndex);
                }
            });
            audio.play('win');
            this._updateGameInfo();

            this._pendingAwards = data;  // cached for i18n re-render
            this._showShowdownOverlay(this._pendingShowdown, data);

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
                this._maybeShowStatsHint();
            }
        });

        g.on('hideShowdown', () => {
            const overlay = document.getElementById('showdown-overlay');
            overlay.classList.remove('visible');
            if (this._showdownCountdownId) {
                clearInterval(this._showdownCountdownId);
                this._showdownCountdownId = null;
            }
        });

        g.on('gameOver', (data) => {
            const overlay = document.getElementById('showdown-overlay');
            overlay?.classList.remove('visible');
            if (this._showdownCountdownId) {
                clearInterval(this._showdownCountdownId);
                this._showdownCountdownId = null;
            }
            tr.setActivePlayer(null);

            const humanWon = data.winner?.isHuman;
            const winMsg = !data.winner
                ? t('toast.game_over_generic')
                : humanWon
                    ? t('toast.game_over_human')
                    : t('toast.game_over_ai', { name: data.winner.name });
            // Game-over message stays sticky until user clicks Play Again
            toast.show(winMsg, { type: humanWon ? 'success' : 'info', duration: 0 });

            if (humanWon) {
                this._launchConfetti();
            }

            setTimeout(() => {
                this._showGameOverStats();
                document.getElementById('start-screen').style.display = '';
                const sb = document.getElementById('start-btn');
                if (sb) {
                    sb.dataset.i18n = 'start.play_again';
                    sb.textContent = t('start.play_again');
                }
            }, humanWon ? 3500 : 2000);
        });
    }

    // ---------------- Showdown overlay (rebuilt) ----------------

    _showShowdownOverlay(showdownData, awardsData) {
        const overlay = document.getElementById('showdown-overlay');
        const content = document.getElementById('showdown-content');
        if (!overlay || !content) return;

        const evals = showdownData.evaluations;
        const community = showdownData.communityCards || [];

        // Build award lookup by seat
        const awardsBySeat = {};
        for (const award of awardsData.awards) {
            awardsBySeat[award.playerIndex] = (awardsBySeat[award.playerIndex] || 0) + award.amount;
        }

        const boardHTML = community.map(microCardHTML).join('');

        // Include folded players so audit is clear, but mute them
        const allPlayersInHand = this.game.players.filter(p => !p.isSittingOut);
        const evalBySeat = {};
        for (const e of evals) evalBySeat[e.playerIndex] = e;

        const rows = allPlayersInHand
            .sort((a, b) => {
                const awardA = awardsBySeat[a.seatIndex] || 0;
                const awardB = awardsBySeat[b.seatIndex] || 0;
                if (awardA !== awardB) return awardB - awardA;
                return (evalBySeat[b.seatIndex]?.eval?.score || 0) - (evalBySeat[a.seatIndex]?.eval?.score || 0);
            })
            .map(p => {
                const isWinner = (awardsBySeat[p.seatIndex] || 0) > 0;
                const isFolded = p.isFolded;
                const evalInfo = evalBySeat[p.seatIndex];
                const handName = evalInfo?.eval?.name || '';
                const cardsHTML = (p.holeCards || []).map(microCardHTML).join('');
                const gender = NAME_GENDER[p.name] || 'male';

                const localizedHandName = this._translateHandName(handName);
                const resultHTML = isFolded
                    ? `<span class="award folded-tag">${t('showdown.folded')}</span>`
                    : isWinner
                        ? `<span class="hand-name">${localizedHandName}</span>
                           <span class="award">+${formatChips(awardsBySeat[p.seatIndex])}</span>`
                        : `<span class="hand-name">${localizedHandName}</span>
                           <span class="award" style="color:var(--ink-faint);font-weight:600">—</span>`;

                const avatarBg = avatarBgGradient(p.name, gender);
                return `<div class="showdown-row${isWinner ? ' winner' : ''}${isFolded ? ' folded' : ''}">
                    <div class="showdown-player">
                        <div class="sd-avatar" style="background:${avatarBg};display:flex;align-items:center;justify-content:center;">
                            <span style="font-family:'DM Serif Display',serif;font-size:13px;color:rgba(255,255,255,0.95)">${avatarInitial(p.name)}</span>
                        </div>
                        <span class="sd-name">${p.name}${p.isHuman ? t('showdown.you_label') : ''}</span>
                    </div>
                    <div class="showdown-cards">${cardsHTML || '<span style="color:var(--ink-faint);font-size:11px">—</span>'}</div>
                    <div class="showdown-result">${resultHTML}</div>
                </div>`;
            }).join('');

        content.innerHTML = `
            <h2>${t('showdown.title')}</h2>
            <div class="board-strip">${boardHTML}</div>
            ${rows}
            <div id="showdown-continue-wrap">
                <button id="showdown-continue">${t('showdown.next')}</button>
                <span id="showdown-countdown">${t('showdown.countdown', { s: TIMING.SHOWDOWN_COUNTDOWN_S })}</span>
            </div>
        `;

        overlay.classList.add('visible');

        // Pause on showdown — user must click continue OR wait for countdown
        const countdownEl = document.getElementById('showdown-countdown');
        const continueBtn = document.getElementById('showdown-continue');
        let seconds = TIMING.SHOWDOWN_COUNTDOWN_S;

        const advance = () => {
            if (this._showdownCountdownId) {
                clearInterval(this._showdownCountdownId);
                this._showdownCountdownId = null;
            }
            overlay.classList.remove('visible');
            this.game.signalShowdownContinue?.();
        };

        continueBtn?.addEventListener('click', advance, { once: true });

        this._showdownCountdownId = setInterval(() => {
            if (this._paused) {
                if (countdownEl) countdownEl.textContent = t('showdown.paused');
                return;
            }
            seconds--;
            if (countdownEl) countdownEl.textContent = t('showdown.countdown', { s: seconds });
            if (seconds <= 0) advance();
        }, 1000);
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
            <h3>${t('gameover.summary')}</h3>
            <div class="stats-row"><span class="label">${t('gameover.hands_played')}</span><span class="value">${g.handNumber}</span></div>
            <div class="stats-row"><span class="label">${t('gameover.final_blinds')}</span><span class="value">${formatChips(g.blindLevel.small)}/${formatChips(g.blindLevel.big)}</span></div>
            <div class="stats-row"><span class="label">${t('gameover.your_finish')}</span><span class="value">${t('gameover.finish_n_of_m', { rank: humanRank, total: g.players.length })}</span></div>
            <div class="stats-row"><span class="label">${t('gameover.net_result')}</span><span class="value ${netClass}">${netPrefix}${formatChips(Math.abs(netResult))}</span></div>
            <div class="stats-standings">
                <div class="stats-row"><span class="label" style="font-weight:600;color:var(--ink)">${t('gameover.standings')}</span><span class="value" style="color:var(--ink-dim)">${t('gameover.chips')}</span></div>
                ${standingsHtml}
            </div>
        `;
        statsEl.style.display = 'block';
    }

    _winVerbName(player) {
        // Legacy helper kept for any internal use; prefer t('toast.you_win'/'toast.someone_wins') directly.
        return player.isHuman ? t('toast.you_win', { amount: '' }).replace(/[!！]?\s*$/, '') : player.name;
    }

    _launchConfetti() {
        const colors = ['#e1b959', '#f2d07a', '#39c06b', '#5aa9ff', '#e5564a', '#ffffff', '#c89a3a'];
        const total = TIMING.CONFETTI_COUNT;
        for (let i = 0; i < total; i++) {
            const el = document.createElement('div');
            el.className = 'confetti-piece';
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 5 + Math.random() * 7;
            const isCircle = Math.random() > 0.4;
            el.style.cssText = `
                left:${Math.random() * 100}vw;
                background:${color};
                width:${size}px;height:${size}px;
                border-radius:${isCircle ? '50%' : '2px'};
                animation-duration:${2.2 + Math.random() * 1.8}s;
                animation-delay:${Math.random() * 0.8}s;
                --tx:${(Math.random() - 0.5) * 240}px;
                --rot:${Math.floor(Math.random() * 3) * 360 + 180}deg;
            `;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), TIMING.CONFETTI_LIFETIME_MS);
        }
    }

    _updateGameInfo() {
        const infoEl = document.getElementById('game-info');
        if (!this.game) { infoEl.innerHTML = ''; return; }
        const handNum = this.game.handNumber || 0;
        const blinds = this.game.blindLevel;
        const activePlayers = this.game.activePlayers.length;
        const total = this.game.players.length;

        // Next blind level preview
        const nextIdx = (this.game.blindLevelIndex || 0) + 1;
        const nextBlinds = BLIND_SCHEDULE[nextIdx];
        const interval = DEFAULT_CONFIG.blindEscalationHands;
        const handsUntilNext = interval - ((handNum - 1) % interval);
        const showNext = nextBlinds && handNum >= 1 && handsUntilNext > 0 && handsUntilNext <= interval;

        infoEl.innerHTML = `
            <span class="chip-tag"><span class="label">${t('info.hand')}</span><span class="value">#${handNum}</span></span>
            <span class="chip-tag blinds"><span class="label">${t('info.blinds')}</span><span class="value">${formatChips(blinds.small)}/${formatChips(blinds.big)}</span></span>
            ${showNext ? `<span class="chip-tag next-blinds"><span class="label">${t('info.next_blinds')}</span><span class="value">${formatChips(nextBlinds.small)}/${formatChips(nextBlinds.big)} · ${t('info.next_in', { n: handsUntilNext })}</span></span>` : ''}
            <span class="chip-tag"><span class="label">${t('info.players')}</span><span class="value">${activePlayers}/${total}</span></span>
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
