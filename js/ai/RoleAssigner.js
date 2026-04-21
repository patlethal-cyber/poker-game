import { shuffle } from '../utils/helpers.js';

/* Default personality distribution. Weights sum to 1.0.
   Fish is slightly over-weighted for playability (friendly games shouldn't
   be uniformly punishing). */
export const DEFAULT_WEIGHTS = {
    Shark:    0.20,
    Maniac:   0.20,
    Rock:     0.20,
    Fish:     0.25,
    Wildcard: 0.15
};

/* Shark is the toughest persona. Hard cap so the human never faces a table
   stacked with Sharks. Max 2 at a full 10-seat table; max 1 everywhere else. */
export function sharkCap(tableSize) {
    return tableSize === 10 ? 2 : 1;
}

const ROLES = ['Shark', 'Maniac', 'Rock', 'Fish', 'Wildcard'];

/**
 * Assign AI personalities to seats.
 * @param {number} tableSize  Total seats including the human.
 * @param {object} [weights]  Personality weight map (keys must be subset of ROLES).
 * @returns {string[]}        aiCount = tableSize - 1 personality names, shuffled.
 */
export function assignPersonalities(tableSize, weights = DEFAULT_WEIGHTS) {
    const aiCount = tableSize - 1;
    if (aiCount <= 0) return [];

    // Special case: a 4-seat table (3 AI) with weighted rounding produces a
    // predictable Shark/Maniac/Fish every time, making games feel identical.
    // Sample 3 *distinct* roles uniformly, then enforce the shark cap.
    if (tableSize === 4) {
        return _sampleDistinct(ROLES, aiCount, sharkCap(tableSize));
    }

    // Hamilton rounding: floor(weight * aiCount), distribute leftovers by
    // largest fractional remainder.
    const slots = {};
    const remainders = [];
    let assigned = 0;
    for (const [role, w] of Object.entries(weights)) {
        const exact = w * aiCount;
        const floor = Math.floor(exact);
        slots[role] = floor;
        assigned += floor;
        remainders.push({ role, frac: exact - floor });
    }
    remainders.sort((a, b) => b.frac - a.frac);
    let leftover = aiCount - assigned;
    for (let i = 0; leftover > 0 && i < remainders.length; i++, leftover--) {
        slots[remainders[i].role]++;
    }

    // Enforce shark cap: push overflow to Fish (~60%) and Wildcard (~40%).
    const cap = sharkCap(tableSize);
    if ((slots.Shark || 0) > cap) {
        const overflow = slots.Shark - cap;
        slots.Shark = cap;
        const toFish = Math.ceil(overflow * 0.6);
        const toWild = overflow - toFish;
        slots.Fish     = (slots.Fish || 0) + toFish;
        slots.Wildcard = (slots.Wildcard || 0) + toWild;
    }

    // Flatten and shuffle.
    const result = [];
    for (const [role, n] of Object.entries(slots)) {
        for (let i = 0; i < n; i++) result.push(role);
    }
    // Defensive padding for exotic weight maps that undercount.
    while (result.length < aiCount) result.push('Fish');
    if (result.length > aiCount) result.length = aiCount;

    return shuffle(result);
}

function _sampleDistinct(pool, k, sharkMax) {
    const bag = shuffle(pool).slice(0, k);
    let sharks = bag.filter(r => r === 'Shark').length;
    if (sharks <= sharkMax) return shuffle(bag);
    const unused = pool.filter(r => r !== 'Shark' && !bag.includes(r));
    let i = 0;
    for (let s = 0; s < bag.length && sharks > sharkMax; s++) {
        if (bag[s] === 'Shark') {
            bag[s] = i < unused.length ? unused[i++] : 'Fish';
            sharks--;
        }
    }
    return shuffle(bag);
}
