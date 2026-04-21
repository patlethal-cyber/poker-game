/* Per-strategy poker stat aggregator.
 *
 * VPIP: Voluntary $ In Pot — hands where the seat called/raised preflop
 *       (blinds alone don't count as voluntary).
 * PFR:  Preflop Raise — hands where the seat raised preflop at least once.
 * AF:   Aggression Factor — (bets + raises) / calls across all streets.
 * bb/100: chip delta / bigBlind / (hands / 100).
 */
export class AgentStats {
    constructor(strategiesBySeat) {
        this.seats = strategiesBySeat.map((strategy, seatIndex) => ({
            seatIndex, strategy,
            hands: 0,
            vpipHands: 0, pfrHands: 0,
            aggActions: 0, callActions: 0,
            chipDelta: 0,
            _vpipFlag: false, _pfrFlag: false
        }));
    }

    /** Called at hand start — reset per-hand flags */
    beginHand() {
        for (const s of this.seats) {
            s._vpipFlag = false;
            s._pfrFlag = false;
        }
    }

    /** Record a playerAction event. */
    recordAction(seatIndex, street, actionType) {
        const s = this.seats[seatIndex];
        if (!s) return;
        if (street === 'preflop') {
            if (actionType === 'call' || actionType === 'raise' ||
                actionType === 'bet' || actionType === 'allIn') {
                s._vpipFlag = true;
            }
            if (actionType === 'raise' || actionType === 'bet' || actionType === 'allIn') {
                s._pfrFlag = true;
            }
        }
        if (actionType === 'bet' || actionType === 'raise' || actionType === 'allIn') s.aggActions++;
        if (actionType === 'call') s.callActions++;
    }

    /** Called at hand end — commit flags + chip delta. */
    endHand(startChips, endChips) {
        for (const s of this.seats) {
            s.hands++;
            if (s._vpipFlag) s.vpipHands++;
            if (s._pfrFlag)  s.pfrHands++;
            s.chipDelta += (endChips[s.seatIndex] - startChips[s.seatIndex]);
        }
    }

    /** Aggregate by strategy; returns rows suitable for rendering. */
    summary(bigBlind) {
        const agg = new Map();
        for (const s of this.seats) {
            const prev = agg.get(s.strategy) || {
                strategy: s.strategy, hands: 0,
                vpipHands: 0, pfrHands: 0,
                aggActions: 0, callActions: 0,
                chipDelta: 0
            };
            prev.hands       += s.hands;
            prev.vpipHands   += s.vpipHands;
            prev.pfrHands    += s.pfrHands;
            prev.aggActions  += s.aggActions;
            prev.callActions += s.callActions;
            prev.chipDelta   += s.chipDelta;
            agg.set(s.strategy, prev);
        }
        return [...agg.values()].map(a => ({
            strategy: a.strategy,
            hands: a.hands,
            vpipPct: a.hands ? (100 * a.vpipHands / a.hands) : 0,
            pfrPct:  a.hands ? (100 * a.pfrHands  / a.hands) : 0,
            af:      a.callActions ? (a.aggActions / a.callActions) : (a.aggActions > 0 ? Infinity : 0),
            bb100:   a.hands ? ((a.chipDelta / bigBlind) / (a.hands / 100)) : 0
        }));
    }
}
