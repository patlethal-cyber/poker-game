/* ============================================================
 * i18n — Simplified Chinese / English bilingual support
 *
 * Public API:
 *   init()                   — call once at app boot, before rendering
 *   getLang()                — 'en' | 'zh'
 *   setLang(lang)            — set + persist + re-render
 *   toggleLang()             — flip between en/zh
 *   t(key, params?)          — lookup string with {placeholder} substitution
 *   onChange(fn)             — subscribe to language changes; returns unsubscribe
 *
 * DOM integration:
 *   - <element data-i18n="key">           — textContent set to t(key)
 *   - <element data-i18n-attr="attr:key"> — attribute set to t(key)
 *   - applyToDOM() runs on init() and every setLang(); call manually if you
 *     inject new data-i18n nodes after init.
 *
 * Default language detection: navigator.language prefix → 'zh' if 'zh-*',
 * else 'en'. User choice overrides via localStorage key `poker.lang.v1`.
 * ============================================================ */

const STRINGS = {
    en: {
        /* ---------- Start screen ---------- */
        'start.title':              "TEXAS HOLD'EM",
        'start.subtitle':           'No-limit · Single-player vs AI',
        'start.player_count_label': 'Number of players',
        'start.deal_me_in':         'DEAL ME IN',
        'start.play_again':         'Play Again',
        'start.player_count_opt':   '{n} players',

        /* ---------- Top bar ---------- */
        'top.mute':         'Mute sound',
        'top.unmute':       'Unmute sound',
        'top.pause':        'Pause game',
        'top.rankings':     'Hand rankings',
        'top.history':      'Hand history',
        'top.lang_switch':  '中',
        'top.lang_tooltip': 'Switch to Chinese',

        /* ---------- Game info chips ---------- */
        'info.hand':        'Hand',
        'info.blinds':      'Blinds',
        'info.next_blinds': 'Next',
        'info.players':     'Players',
        'info.next_in':     '{n}h',

        /* ---------- Action panel ---------- */
        'action.fold':              'Fold',
        'action.check':             'Check',
        'action.call':              'Call',
        'action.call_amount':       'Call {amount}',
        'action.bet':               'Bet',
        'action.raise_to':          'Raise to',
        'action.all_in':            'All In',
        'action.all_in_amount':     'All In {amount}',
        'action.quick.min':         'Min',
        'action.quick.third':       '⅓ Pot',
        'action.quick.half':        '½ Pot',
        'action.quick.twothirds':   '⅔ Pot',
        'action.quick.pot':         'Pot',
        'action.quick.allin':       'All In',

        /* ---------- Toast / messages ---------- */
        'toast.hand_start':         'Hand #{n} — Blinds {sb}/{bb}',
        'toast.blinds_up':          'Blinds up to {sb}/{bb}',
        'toast.all_in_runout':      'All In — running it out!',
        'toast.you_win':            'You win {amount}!',
        'toast.someone_wins':       '{name} wins {amount}',
        'toast.game_over_human':    'Game Over! You win the tournament!',
        'toast.game_over_ai':       'Game Over! {name} wins the tournament!',
        'toast.game_over_generic':  'Game Over!',
        'toast.dealing_flop':       'Dealing the Flop',
        'toast.dealing_turn':       'Dealing the Turn',
        'toast.dealing_river':      'Dealing the River',

        /* ---------- Showdown ---------- */
        'showdown.title':       'Showdown',
        'showdown.next':        'Next Hand',
        'showdown.countdown':   'Auto-continue in {s}s',
        'showdown.paused':      'Paused — click Next Hand when ready',
        'showdown.folded':      'Folded',
        'showdown.you_label':   ' (You)',

        /* ---------- Pause overlay ---------- */
        'pause.title':       'PAUSED',
        'pause.body':        'Click Resume to continue',
        'pause.resume':      'Resume',
        'pause.auto_paused': 'Auto-paused because you switched tabs. Click Resume when ready.',

        /* ---------- Rankings modal ---------- */
        'rankings.title':       'Hand Rankings',
        'rankings.close':       'Close',

        /* ---------- History modal ---------- */
        'history.title':            'Hand History',
        'history.close':            'Close',
        'history.export':           'Export',
        'history.import':           'Import',
        'history.clear':            'Clear',
        'history.clear_confirm':    'Clear all saved history? This cannot be undone.',
        'history.import_success':   'History imported successfully.',
        'history.import_failed':    'Import failed: {err}',
        'history.empty':            'No hands recorded yet. Play a hand to start tracking.',
        'history.col.hand':         'Hand',
        'history.col.result':       'Result',
        'history.col.net':          'Net',
        'history.col.your_cards':   'Your Cards',
        'history.col.board':        'Board',
        'history.col.winner':       'Winner Hand',
        'history.result.win':       'Won',
        'history.result.loss':      'Lost',
        'history.result.fold':      'Folded',
        'history.result.chop':      'Chopped',
        'history.stats.played':     'Hands Played',
        'history.stats.won':        'Hands Won',
        'history.stats.net':        'Total Net',
        'history.stats.biggest_win':'Biggest Win',
        'history.stats.biggest_pot':'Biggest Pot Seen',
        'history.stats.vpip':       'VPIP',
        'history.stats.pfr':        'PFR',
        'history.stats.sd_win':     'Showdown Win%',

        /* ---------- Stats hint ---------- */
        'hint.stats_title': 'Your stats are here.',
        'hint.stats_body':  'Track hands played, VPIP, showdown win % and more.',
        'hint.dismiss':     'Dismiss',

        /* ---------- Common ---------- */
        'common.close':     'Close',

        /* ---------- Hand rankings (10 names + descriptions) ---------- */
        'rank.10.name': 'Royal Flush',
        'rank.10.desc': '10, J, Q, K, A all same suit — the ultimate hand.',
        'rank.9.name':  'Straight Flush',
        'rank.9.desc':  'Five in a row, all same suit.',
        'rank.8.name':  'Four of a Kind',
        'rank.8.desc':  'Four cards of the same rank.',
        'rank.7.name':  'Full House',
        'rank.7.desc':  'Three of a kind plus a pair.',
        'rank.6.name':  'Flush',
        'rank.6.desc':  'Five cards of the same suit, any order.',
        'rank.5.name':  'Straight',
        'rank.5.desc':  'Five in a row, mixed suits.',
        'rank.4.name':  'Three of a Kind',
        'rank.4.desc':  'Three cards of the same rank.',
        'rank.3.name':  'Two Pair',
        'rank.3.desc':  'Two different pairs.',
        'rank.2.name':  'One Pair',
        'rank.2.desc':  'Two cards of the same rank.',
        'rank.1.name':  'High Card',
        'rank.1.desc':  'Nothing matches — highest card plays.',

        /* ---------- Game over standings ---------- */
        'gameover.summary':         'Game Summary',
        'gameover.hands_played':    'Hands Played',
        'gameover.final_blinds':    'Final Blinds',
        'gameover.your_finish':     'Your Finish',
        'gameover.net_result':      'Net Result',
        'gameover.standings':       'Final Standings',
        'gameover.chips':           'Chips',
        'gameover.finish_n_of_m':   '#{rank} of {total}',

        /* ---------- Rotate overlay (current "want landscape" + future "want portrait") ---------- */
        'rotate.title_to_landscape':  'Please rotate to landscape',
        'rotate.desc_to_landscape':   'This game plays best in landscape. Rotate your phone, or check if rotation lock is on.',
        'rotate.title_to_portrait':   'Please rotate to portrait',
        'rotate.desc_to_portrait':    'This game is designed for portrait mode on phones. Rotate your device, or check if rotation lock is on.',
        'rotate.title_phone_narrow':  'Screen too narrow',
        'rotate.desc_phone_narrow':   "Your phone's screen isn't wide enough for the table. A slightly larger device or a tablet will work better.",
        'rotate.title_too_narrow':    'Browser window too narrow',
        'rotate.desc_too_narrow':     'This game needs at least {w}px of width. Please widen your browser window or press F11 to go fullscreen.',

        /* ---------- AI personality labels (only shown post-game if ever) ---------- */
        // Kept as keys for future use; not currently displayed in UI.
        'ai.shark':    'Shark',
        'ai.maniac':   'Maniac',
        'ai.rock':     'Rock',
        'ai.fish':     'Fish',
        'ai.wildcard': 'Wildcard',
    },

    zh: {
        /* ---------- 开始屏幕 ---------- */
        'start.title':              '德州扑克',
        'start.subtitle':           '无限注 · 单人对战 AI',
        'start.player_count_label': '玩家人数',
        'start.deal_me_in':         '开始游戏',
        'start.play_again':         '再来一局',
        'start.player_count_opt':   '{n} 人',

        /* ---------- 顶部栏 ---------- */
        'top.mute':         '静音',
        'top.unmute':       '取消静音',
        'top.pause':        '暂停',
        'top.rankings':     '牌型',
        'top.history':      '战绩',
        'top.lang_switch':  'EN',
        'top.lang_tooltip': '切换到英文',

        /* ---------- 游戏信息标签 ---------- */
        'info.hand':        '手数',
        'info.blinds':      '盲注',
        'info.next_blinds': '下次',
        'info.players':     '玩家',
        'info.next_in':     '{n} 手后',

        /* ---------- 动作面板 ---------- */
        'action.fold':              '弃牌',
        'action.check':             '过牌',
        'action.call':              '跟注',
        'action.call_amount':       '跟注 {amount}',
        'action.bet':               '下注',
        'action.raise_to':          '加注到',
        'action.all_in':            '全下',
        'action.all_in_amount':     '全下 {amount}',
        'action.quick.min':         '最小',
        'action.quick.third':       '⅓ 池',
        'action.quick.half':        '½ 池',
        'action.quick.twothirds':   '⅔ 池',
        'action.quick.pot':         '满池',
        'action.quick.allin':       '全下',

        /* ---------- Toast 通知 ---------- */
        'toast.hand_start':         '第 {n} 手 — 盲注 {sb}/{bb}',
        'toast.blinds_up':          '盲注升至 {sb}/{bb}',
        'toast.all_in_runout':      '全下 — 一翻到底！',
        'toast.you_win':            '你赢得 {amount}！',
        'toast.someone_wins':       '{name} 赢得 {amount}',
        'toast.game_over_human':    '游戏结束！你赢得了本场锦标赛！',
        'toast.game_over_ai':       '游戏结束！{name} 赢得了本场锦标赛',
        'toast.game_over_generic':  '游戏结束！',
        'toast.dealing_flop':       '正在发翻牌',
        'toast.dealing_turn':       '正在发转牌',
        'toast.dealing_river':      '正在发河牌',

        /* ---------- 摊牌 ---------- */
        'showdown.title':       '摊牌',
        'showdown.next':        '下一手',
        'showdown.countdown':   '{s} 秒后继续',
        'showdown.paused':      '已暂停 — 点击下一手继续',
        'showdown.folded':      '已弃牌',
        'showdown.you_label':   '（你）',

        /* ---------- 暂停覆盖 ---------- */
        'pause.title':       '已暂停',
        'pause.body':        '点击继续返回游戏',
        'pause.resume':      '继续',
        'pause.auto_paused': '切换到其他标签页时自动暂停。点击继续重新开始。',

        /* ---------- 牌型弹窗 ---------- */
        'rankings.title':   '牌型大全',
        'rankings.close':   '关闭',

        /* ---------- 战绩弹窗 ---------- */
        'history.title':            '战绩历史',
        'history.close':            '关闭',
        'history.export':           '导出',
        'history.import':           '导入',
        'history.clear':            '清空',
        'history.clear_confirm':    '清空所有历史？此操作不可撤销。',
        'history.import_success':   '战绩导入成功。',
        'history.import_failed':    '导入失败：{err}',
        'history.empty':            '暂无战绩记录。打一手开始追踪。',
        'history.col.hand':         '手数',
        'history.col.result':       '结果',
        'history.col.net':          '盈亏',
        'history.col.your_cards':   '你的手牌',
        'history.col.board':        '公共牌',
        'history.col.winner':       '赢家牌型',
        'history.result.win':       '赢',
        'history.result.loss':      '输',
        'history.result.fold':      '弃',
        'history.result.chop':      '平分',
        'history.stats.played':     '已玩手数',
        'history.stats.won':        '已赢手数',
        'history.stats.net':        '总盈亏',
        'history.stats.biggest_win':'最大单局赢',
        'history.stats.biggest_pot':'最大底池',
        'history.stats.vpip':       'VPIP',
        'history.stats.pfr':        'PFR',
        'history.stats.sd_win':     '摊牌胜率',

        /* ---------- 战绩提示 ---------- */
        'hint.stats_title': '战绩在这里。',
        'hint.stats_body':  '追踪手数、VPIP、摊牌胜率等数据。',
        'hint.dismiss':     '关闭提示',

        /* ---------- 通用 ---------- */
        'common.close':     '关闭',

        /* ---------- 牌型列表 ---------- */
        'rank.10.name': '皇家同花顺',
        'rank.10.desc': '10、J、Q、K、A 同花色 — 终极牌型。',
        'rank.9.name':  '同花顺',
        'rank.9.desc':  '五张同花色顺连。',
        'rank.8.name':  '四条',
        'rank.8.desc':  '四张同点数的牌。',
        'rank.7.name':  '葫芦',
        'rank.7.desc':  '三条加一对。',
        'rank.6.name':  '同花',
        'rank.6.desc':  '五张同花色的牌，无需顺连。',
        'rank.5.name':  '顺子',
        'rank.5.desc':  '五张顺连，花色不限。',
        'rank.4.name':  '三条',
        'rank.4.desc':  '三张同点数的牌。',
        'rank.3.name':  '两对',
        'rank.3.desc':  '两组不同的对子。',
        'rank.2.name':  '一对',
        'rank.2.desc':  '两张同点数的牌。',
        'rank.1.name':  '高牌',
        'rank.1.desc':  '无成型牌型 — 比最大牌点。',

        /* ---------- 游戏结束 ---------- */
        'gameover.summary':         '本局总结',
        'gameover.hands_played':    '总手数',
        'gameover.final_blinds':    '最终盲注',
        'gameover.your_finish':     '你的名次',
        'gameover.net_result':      '净盈亏',
        'gameover.standings':       '最终排名',
        'gameover.chips':           '筹码',
        'gameover.finish_n_of_m':   '第 {rank} / {total} 名',

        /* ---------- 旋转覆盖（当前需横屏 + 未来需竖屏） ---------- */
        'rotate.title_to_landscape':  '请旋转至横屏',
        'rotate.desc_to_landscape':   '此游戏横屏体验最佳。请旋转手机，或检查屏幕旋转锁是否开启。',
        'rotate.title_to_portrait':   '请旋转回竖屏',
        'rotate.desc_to_portrait':    '此游戏在手机上为竖屏设计。请旋转设备，或检查屏幕旋转锁是否开启。',
        'rotate.title_phone_narrow':  '屏幕过窄',
        'rotate.desc_phone_narrow':   '你的手机屏幕宽度不足以容纳整个牌桌。建议使用稍大设备或平板。',
        'rotate.title_too_narrow':    '浏览器窗口太窄',
        'rotate.desc_too_narrow':     '此游戏需要至少 {w}px 宽度。请加宽浏览器窗口或按 F11 全屏。',

        /* ---------- AI 性格（暂未显示，预留） ---------- */
        'ai.shark':    '鲨鱼',
        'ai.maniac':   '疯子',
        'ai.rock':     '石头',
        'ai.fish':     '鱼',
        'ai.wildcard': '变化球',
    }
};

const LANG_KEY = 'poker.lang.v1';
let currentLang = null;
const listeners = new Set();

/** Detect initial language from saved preference, then navigator.language. */
function detectInitialLang() {
    try {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved === 'en' || saved === 'zh') return saved;
    } catch {}
    const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
    return nav.startsWith('zh') ? 'zh' : 'en';
}

/** Initialize i18n. Call once at app boot, before rendering. */
export function init() {
    currentLang = detectInitialLang();
    applyToDOM();
}

/** Get the current language code ('en' | 'zh'). */
export function getLang() { return currentLang; }

/** Set + persist language; re-applies to DOM and notifies listeners. */
export function setLang(lang) {
    if (lang !== 'en' && lang !== 'zh') return;
    if (lang === currentLang) return;
    currentLang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
    applyToDOM();
    listeners.forEach(fn => {
        try { fn(lang); } catch (e) { console.warn('i18n listener threw:', e); }
    });
}

/** Toggle between en/zh. */
export function toggleLang() {
    setLang(currentLang === 'en' ? 'zh' : 'en');
}

/**
 * Look up a translation. Substitutes {placeholder} occurrences from params.
 * Falls back to English if missing in current language; falls back to the key
 * itself if missing in both. Never throws.
 */
export function t(key, params = {}) {
    const dict = STRINGS[currentLang] || STRINGS.en;
    let str = dict[key];
    if (str === undefined) str = STRINGS.en[key];
    if (str === undefined) return key;  // visible fallback so missing keys are spotted

    if (params && typeof params === 'object') {
        for (const [k, v] of Object.entries(params)) {
            str = str.split(`{${k}}`).join(String(v));
        }
    }
    return str;
}

/** Subscribe to language-change events. Returns an unsubscribe function. */
export function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * Walk the DOM and apply data-i18n / data-i18n-attr attributes.
 *
 *   data-i18n="key"             → element.textContent = t(key)
 *   data-i18n-html="key"        → element.innerHTML = t(key)  (use sparingly; trusted strings only)
 *   data-i18n-attr="attr:key"   → element.setAttribute(attr, t(key))
 *     (Multiple pairs separated by ";", e.g. "aria-label:top.mute;title:top.mute")
 *
 * Called automatically by init() and setLang(). Call manually after injecting
 * new nodes that contain data-i18n attributes.
 */
export function applyToDOM(root = document) {
    if (root === document) {
        document.documentElement.lang = currentLang === 'zh' ? 'zh-Hans' : 'en';
    }
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.dataset.i18nHtml);
    });
    root.querySelectorAll('[data-i18n-attr]').forEach(el => {
        const pairs = el.dataset.i18nAttr.split(';');
        for (const pair of pairs) {
            const [attr, key] = pair.split(':').map(s => s.trim());
            if (attr && key) el.setAttribute(attr, t(key));
        }
    });
}
