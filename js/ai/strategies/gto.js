/* Shared GTO-flavored decision helpers.
 *
 * Design: each personality is a PROFILES entry with numeric frequencies.
 * The strategy .decide() method:
 *   1) computes hand strength, pot odds, position, street
 *   2) applies profile noise to strength
 *   3) delegates to shouldRaiseGTO / shouldBluff / shouldCallPotOdds
 *   4) if raising, uses gtoBetSize to size the bet
 *
 * The PROFILES numbers below are seed values. The sim harness in tests/
 * validates them empirically — tune here, not in individual strategies.
 */

/* ---------- personality profiles ---------- */

export const PROFILES = {
    Shark: {
        name: 'Shark',
        noise: 0.06,
        openCutoff: {
            preflop: { EP: 0.42, MP: 0.38, LP: 0.36, BLINDS: 0.34 },
            flop: 0.32, turn: 0.36, river: 0.40
        },
        raiseFreq:     { preflop: 0.85, flop: 0.65, turn: 0.55, river: 0.45 },
        threeBetFreq:  { preflop: 0.18, flop: 0.14, turn: 0.11, river: 0.08 },
        bluffFreq:     { preflop: 0.06, flop: 0.10, turn: 0.08, river: 0.06 },
        foldToBet:     { preflop: 1.00, flop: 0.95, turn: 0.92, river: 0.88 },
        valueThresh:   { preflop: 0.55, flop: 0.55, turn: 0.60, river: 0.65 },
        betSize: { preflopBB: [2.5, 3.5], flop: 0.55, turn: 0.70, river: 0.75, threeBetMult: 3.0 }
    },
    Maniac: {
        name: 'Maniac',
        noise: 0.12,
        openCutoff: {
            preflop: { EP: 0.22, MP: 0.20, LP: 0.20, BLINDS: 0.18 },
            flop: 0.24, turn: 0.28, river: 0.32
        },
        raiseFreq:     { preflop: 0.55, flop: 0.72, turn: 0.60, river: 0.50 },
        threeBetFreq:  { preflop: 0.28, flop: 0.26, turn: 0.22, river: 0.18 },
        bluffFreq:     { preflop: 0.25, flop: 0.28, turn: 0.22, river: 0.18 },
        foldToBet:     { preflop: 0.55, flop: 0.55, turn: 0.60, river: 0.65 },
        valueThresh:   { preflop: 0.50, flop: 0.50, turn: 0.55, river: 0.60 },
        betSize: { preflopBB: [3.0, 4.5], flop: 0.70, turn: 0.80, river: 0.90, threeBetMult: 3.5 }
    },
    Rock: {
        name: 'Rock',
        noise: 0.04,
        openCutoff: {
            preflop: { EP: 0.38, MP: 0.36, LP: 0.34, BLINDS: 0.32 },
            flop: 0.40, turn: 0.45, river: 0.50
        },
        raiseFreq:     { preflop: 0.15, flop: 0.18, turn: 0.14, river: 0.10 },
        threeBetFreq:  { preflop: 0.05, flop: 0.04, turn: 0.03, river: 0.02 },
        bluffFreq:     { preflop: 0.00, flop: 0.01, turn: 0.01, river: 0.00 },
        foldToBet:     { preflop: 0.98, flop: 0.95, turn: 0.93, river: 0.90 },
        valueThresh:   { preflop: 0.70, flop: 0.65, turn: 0.70, river: 0.75 },
        betSize: { preflopBB: [2.0, 2.5], flop: 0.45, turn: 0.55, river: 0.60, threeBetMult: 2.5 }
    },
    Fish: {
        name: 'Fish',
        noise: 0.08,
        openCutoff: {
            preflop: { EP: 0.22, MP: 0.22, LP: 0.22, BLINDS: 0.18 },
            flop: 0.18, turn: 0.22, river: 0.25
        },
        raiseFreq:     { preflop: 0.05, flop: 0.14, turn: 0.10, river: 0.08 },
        threeBetFreq:  { preflop: 0.04, flop: 0.03, turn: 0.02, river: 0.01 },
        bluffFreq:     { preflop: 0.02, flop: 0.02, turn: 0.01, river: 0.00 },
        // Defining trait: Fish station-calls — foldToBet is well under GTO strict
        foldToBet:     { preflop: 0.60, flop: 0.50, turn: 0.45, river: 0.40 },
        valueThresh:   { preflop: 0.65, flop: 0.60, turn: 0.65, river: 0.70 },
        betSize: { preflopBB: [2.0, 2.5], flop: 0.40, turn: 0.50, river: 0.55, threeBetMult: 2.5 }
    }
};

/* ---------- helpers ---------- */

/** Clamp to [0,1]. */
export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

/** Apply ±noise/2 uniform jitter to strength. */
export function applyNoise(strength, noise) {
    return clamp01(strength + (Math.random() - 0.5) * noise);
}

/** Derive a position label from seat/dealer/table size.
 *  rel=0 is dealer (BTN), rel=1 is SB, rel=2 is BB. Remaining seats split
 *  into EP / MP / LP by thirds after the BB.
 *  Heads-up and 3-handed tables: only BTN/BLINDS exist, treat all as BLINDS/LP.
 */
export function derivePosition(seatIndex, dealerIndex, tableSize) {
    const rel = ((seatIndex - dealerIndex) % tableSize + tableSize) % tableSize;
    if (rel === 0) return 'LP';              // BTN
    if (rel === 1 || rel === 2) return 'BLINDS';
    const nonBlind = tableSize - 3;          // seats after BB, excluding BTN
    if (nonBlind <= 0) return 'LP';
    const rank = rel - 3;                    // 0 = UTG, nonBlind-1 = CO (before BTN)
    if (rank < nonBlind / 3) return 'EP';
    if (rank < 2 * nonBlind / 3) return 'MP';
    return 'LP';
}

/** Map a gameState to a street label. */
export function streetFromGameState(gameState) {
    if (gameState.street) return gameState.street;
    const n = gameState.communityCards?.length || 0;
    if (n === 0) return 'preflop';
    if (n === 3) return 'flop';
    if (n === 4) return 'turn';
    return 'river';
}

function _cutoffFor(profile, street, position) {
    const v = profile.openCutoff[street];
    if (typeof v === 'number') return v;
    return v[position] ?? v.MP ?? 0.3;
}

/* ---------- decision helpers ---------- */

/** Should the bot raise for value based on strength + frequency?
 *  Preflop: any hand above openCutoff mixes at raiseFreq (tight-aggressive
 *           raise-or-fold philosophy; marginal hands mix at the same rate
 *           rather than bleeding into calls).
 *  Postflop: strong hands at raiseFreq; marginal hands at threeBetFreq. */
export function shouldRaiseGTO(strength, position, street, profile) {
    const cutoff = _cutoffFor(profile, street, position);
    if (strength < cutoff) return false;
    if (street === 'preflop') {
        return Math.random() < profile.raiseFreq[street];
    }
    const valueThresh = profile.valueThresh[street];
    if (strength >= valueThresh) {
        return Math.random() < profile.raiseFreq[street];
    }
    return Math.random() < profile.threeBetFreq[street];
}

/** Should the bot turn a weak hand into a bluff raise? */
export function shouldBluff(strength, pot, stack, street, profile) {
    if (strength >= profile.valueThresh[street]) return false;
    const spr = stack / Math.max(pot, 1);
    // Don't bluff very short stacks on early streets — not credible
    if (spr < 1.5 && street !== 'river') return false;
    return Math.random() < profile.bluffFreq[street];
}

/** Lowest open-cutoff across all positions for this street. Used as a floor
 *  so strategies don't limp-call hands below their open range when facing a bet. */
function _minCutoff(profile, street) {
    const v = profile.openCutoff[street];
    if (typeof v === 'number') return v;
    let m = Infinity;
    for (const k of Object.keys(v)) if (v[k] < m) m = v[k];
    return m;
}

/** Facing a bet, should the bot call?
 *  Tightened GTO with role-specific station tendency:
 *  - Free check (potOdds = 0): always yes. No cost to see the next card.
 *  - strength below min-open-cutoff AND facing a bet: fold (Fish deviates).
 *  - strength >= potOdds: call (standard).
 *  - strength < potOdds: fold with probability foldToBet, else station-call. */
export function shouldCallPotOdds(strength, potOdds, street, profile) {
    if (potOdds <= 0) return true;
    const floor = _minCutoff(profile, street);
    if (strength < floor) {
        // Below our open range vs. a bet — Fish still calls some of the time.
        return Math.random() > profile.foldToBet[street];
    }
    if (strength >= potOdds) return true;
    return Math.random() > profile.foldToBet[street];
}

/** Compute a bet size for the current street and profile.
 *  Preflop: profile.betSize.preflopBB * bigBlind (jittered within range).
 *  Postflop: profile.betSize[street] fraction of pot with ±10% jitter. */
export function gtoBetSize(pot, stack, street, profile, bigBlind) {
    if (street === 'preflop') {
        const [lo, hi] = profile.betSize.preflopBB;
        const mult = lo + Math.random() * (hi - lo);
        return Math.min(stack, Math.max(1, Math.floor(mult * bigBlind)));
    }
    const frac = profile.betSize[street];
    const jitter = 1 + (Math.random() - 0.5) * 0.2;   // ±10%
    return Math.min(stack, Math.max(1, Math.floor(pot * frac * jitter)));
}
