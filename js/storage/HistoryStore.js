const HISTORY_KEY = 'poker.history.v1';
const STATS_KEY = 'poker.stats.v1';
const MAX_HANDS = 500;

const EMPTY_STATS = {
    handsPlayed: 0,
    handsWon: 0,
    handsFolded: 0,
    showdownsSeen: 0,
    showdownsWon: 0,
    showdownsLost: 0,
    totalNet: 0,
    biggestPot: 0,
    biggestWin: 0,
    vpipHands: 0,
    pfrHands: 0
};

export class HistoryStore {
    getAll() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
        catch { return []; }
    }

    getStats() {
        try { return { ...EMPTY_STATS, ...(JSON.parse(localStorage.getItem(STATS_KEY)) || {}) }; }
        catch { return { ...EMPTY_STATS }; }
    }

    appendHand(rec) {
        const all = this.getAll();
        all.push(rec);
        while (all.length > MAX_HANDS) all.shift();

        const stats = this._recomputeFromRecord(this.getStats(), rec);

        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
            localStorage.setItem(STATS_KEY, JSON.stringify(stats));
        } catch (e) {
            if (e && e.name === 'QuotaExceededError') {
                all.splice(0, 100);
                try {
                    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
                    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
                } catch {}
            }
        }
        return stats;
    }

    _recomputeFromRecord(stats, rec) {
        stats.handsPlayed += 1;
        if (rec.humanResult === 'fold') stats.handsFolded += 1;
        if (rec.humanResult === 'win' || rec.humanResult === 'chop') stats.handsWon += 1;

        if (rec.finalStreet !== 'preflop' && rec.finalStreet !== 'showdown-uncontested') {
            if (['flop', 'turn', 'river'].includes(rec.finalStreet)) {
                // no-op — uncontested or human folded later
            }
        }
        if (rec.finalStreet === 'showdown' || rec.finalStreet === 'showdown-uncontested') {
            // Only count as "showdown seen" if human was still in hand at showdown
            if (rec.humanResult !== 'fold') {
                stats.showdownsSeen += 1;
                if (rec.humanResult === 'win' || rec.humanResult === 'chop') stats.showdownsWon += 1;
                else stats.showdownsLost += 1;
            }
        }

        stats.totalNet += (rec.humanNet || 0);

        const potTotal = (rec.pots || []).reduce((s, p) => s + (p.amount || 0), 0);
        if (potTotal > stats.biggestPot) stats.biggestPot = potTotal;
        if ((rec.humanNet || 0) > stats.biggestWin) stats.biggestWin = rec.humanNet;

        const humanPreflop = (rec.humanActions || []).filter(a => a.street === 'preflop');
        const vpipAction = humanPreflop.some(a => a.type === 'call' || a.type === 'bet' || a.type === 'raise' || a.type === 'allIn');
        const pfrAction = humanPreflop.some(a => a.type === 'bet' || a.type === 'raise' || a.type === 'allIn');
        if (vpipAction) stats.vpipHands += 1;
        if (pfrAction) stats.pfrHands += 1;

        return stats;
    }

    clear() {
        localStorage.removeItem(HISTORY_KEY);
        localStorage.removeItem(STATS_KEY);
    }

    exportJSON() {
        const payload = {
            v: 1,
            exportedAt: Date.now(),
            history: this.getAll(),
            stats: this.getStats()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `poker-history-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async importJSON(file) {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || data.v !== 1 || !Array.isArray(data.history)) {
            throw new Error('Invalid or unsupported history file (expected v:1)');
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history.slice(-MAX_HANDS)));
        localStorage.setItem(STATS_KEY, JSON.stringify({ ...EMPTY_STATS, ...(data.stats || {}) }));
    }
}
