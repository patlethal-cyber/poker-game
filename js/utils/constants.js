export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const SUIT_SYMBOLS = {
    hearts: '\u2665',
    diamonds: '\u2666',
    clubs: '\u2663',
    spades: '\u2660'
};
export const SUIT_COLORS = {
    hearts: 'red',
    diamonds: 'red',
    clubs: 'black',
    spades: 'black'
};

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUES = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export const HAND_RANKINGS = {
    HIGH_CARD: 1,
    ONE_PAIR: 2,
    TWO_PAIR: 3,
    THREE_OF_A_KIND: 4,
    STRAIGHT: 5,
    FLUSH: 6,
    FULL_HOUSE: 7,
    FOUR_OF_A_KIND: 8,
    STRAIGHT_FLUSH: 9,
    ROYAL_FLUSH: 10
};

export const HAND_NAMES = {
    1: 'High Card',
    2: 'One Pair',
    3: 'Two Pair',
    4: 'Three of a Kind',
    5: 'Straight',
    6: 'Flush',
    7: 'Full House',
    8: 'Four of a Kind',
    9: 'Straight Flush',
    10: 'Royal Flush'
};

export const PHASES = {
    WAITING: 'waiting',
    DEAL_HOLE_CARDS: 'dealHoleCards',
    PRE_FLOP: 'preflop',
    DEAL_FLOP: 'dealFlop',
    FLOP: 'flop',
    DEAL_TURN: 'dealTurn',
    TURN: 'turn',
    DEAL_RIVER: 'dealRiver',
    RIVER: 'river',
    SHOWDOWN: 'showdown'
};

export const ACTIONS = {
    FOLD: 'fold',
    CHECK: 'check',
    CALL: 'call',
    BET: 'bet',
    RAISE: 'raise',
    ALL_IN: 'allIn'
};

export const DEFAULT_CONFIG = {
    startingChips: 1000,
    smallBlind: 5,
    bigBlind: 10,
    numPlayers: 6,
    aiThinkingDelayMin: 800,
    aiThinkingDelayMax: 2500,
    blindEscalationHands: 10
};

/* Pacing — tuned for feel. All in milliseconds unless otherwise noted.
 *
 * Tuned for experienced players: shorter inter-hand pause, snappier flop/turn/
 * river deals, tighter post-hand → next-hand transition. SHOWDOWN_COUNTDOWN_S
 * stays at 5 (will become dynamic 5/8 by humanResult in the showdown redesign). */
export const TIMING = {
    POST_BLIND_MS: 400,
    HOLE_DEAL_MS: 600,
    BETWEEN_ACTIONS_MS: 300,
    COMMUNITY_DEAL_NORMAL_MS: 600,
    COMMUNITY_DEAL_FAST_MS: 300,
    SHOWDOWN_REVEAL_MS: 2500,
    POST_HAND_MS: 700,
    BETWEEN_HANDS_MS: 1500,
    SHOWDOWN_COUNTDOWN_S: 5,
    CONFETTI_COUNT: 120,
    CONFETTI_LIFETIME_MS: 5500
};

export const BLIND_SCHEDULE = [
    { small: 5, big: 10 },
    { small: 10, big: 20 },
    { small: 15, big: 30 },
    { small: 25, big: 50 },
    { small: 50, big: 100 },
    { small: 75, big: 150 },
    { small: 100, big: 200 },
    { small: 150, big: 300 },
    { small: 200, big: 400 },
    { small: 300, big: 600 }
];

export const SKLANSKY_GROUPS = {
    1: ['AA', 'KK', 'QQ', 'JJ', 'AKs'],
    2: ['TT', 'AQs', 'AJs', 'KQs', 'AKo'],
    3: ['99', 'JTs', 'QJs', 'KJs', 'ATs', 'AQo'],
    4: ['T9s', 'KQo', '88', 'QTs', 'J9s', 'K9s', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s'],
    5: ['77', 'Q9s', 'T8s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'J8s', 'JTo', 'QJo', 'KJo', 'ATo', 'AJo'],
    6: ['66', '55', 'T7s', 'Q8s', 'J7s', '98s', '87s', '97s', '76s', '86s', 'KTo', 'QTo'],
    7: ['44', '33', '22', 'T9o', 'J9o', '65s', '54s', '75s', '64s', 'K9o', 'T8o', '98o'],
    8: ['87o', '97o', '76o', '86o', 'J8o', 'Q9o', '53s', '43s', 'T6s', 'J6s', 'Q7s', 'Q6s']
};
