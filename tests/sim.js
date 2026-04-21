import { HeadlessTable } from './mockTable.js';
import { AgentStats } from './agentStats.js';
import { assignPersonalities, sharkCap } from '../js/ai/RoleAssigner.js';

function streetFromCommunity(n) {
    if (n === 0) return 'preflop';
    if (n === 3) return 'flop';
    if (n === 4) return 'turn';
    return 'river';
}

async function runSim(nHands, tableSize) {
    const table = new HeadlessTable(tableSize);
    const stats = new AgentStats(table.strategyBySeat);

    table.game.on('playerAction', (data) => {
        const street = streetFromCommunity(table.game.communityCards.length);
        stats.recordAction(data.player.seatIndex, street, data.action.type);
    });

    await table.runHands(nHands, (ev, data) => {
        if (ev === 'handStart') stats.beginHand();
        if (ev === 'handEnd')   stats.endHand(data.startChips, data.endChips);
    });

    return stats.summary(table.game.blindLevel.big);
}

function verifySharkCap(runs = 50) {
    const results = [];
    for (const t of [4, 5, 6, 8, 10]) {
        let maxShark = 0, violations = 0;
        for (let k = 0; k < runs; k++) {
            const roles = assignPersonalities(t);
            const n = roles.filter(r => r === 'Shark').length;
            if (n > maxShark) maxShark = n;
            if (n > sharkCap(t)) violations++;
        }
        results.push({ tableSize: t, cap: sharkCap(t), maxShark, violations, runs });
    }
    return results;
}

function renderResults(rows) {
    const container = document.getElementById('results');
    const cols = ['strategy', 'hands', 'vpipPct', 'pfrPct', 'af', 'bb100'];
    const labels = { strategy: 'Role', hands: 'Hands', vpipPct: 'VPIP %', pfrPct: 'PFR %', af: 'AF', bb100: 'bb/100' };
    const html = [
        '<table>',
        '<thead><tr>', ...cols.map(c => `<th>${labels[c]}</th>`), '</tr></thead>',
        '<tbody>',
        ...rows.map(r => `<tr>${cols.map(c => `<td>${typeof r[c] === 'number' ? r[c].toFixed(c === 'hands' ? 0 : 2) : r[c]}</td>`).join('')}</tr>`),
        '</tbody>',
        '</table>'
    ].join('');
    container.innerHTML = html;
}

function evaluateGate(rows) {
    const by = {};
    for (const r of rows) by[r.strategy] = r;
    const checks = [];

    const sharkFish = (by.Shark?.bb100 ?? 0) - (by.Fish?.bb100 ?? 0);
    checks.push({
        name: 'Shark − Fish bb/100 ≥ 15',
        value: sharkFish.toFixed(1),
        pass: sharkFish >= 15
    });

    const order = ['Shark', 'Maniac', 'Wildcard', 'Rock', 'Fish'];
    let orderOK = true;
    for (let i = 0; i < order.length - 1; i++) {
        const a = by[order[i]]?.bb100 ?? 0;
        const b = by[order[i + 1]]?.bb100 ?? 0;
        if (a < b - 5) orderOK = false;   // allow 5bb wobble for adjacent pairs
    }
    checks.push({ name: 'Expected bb/100 ordering (±5 wobble)', value: order.map(o => `${o}:${(by[o]?.bb100 ?? 0).toFixed(0)}`).join(' '), pass: orderOK });

    const vpipChecks = [
        ['Shark', 18, 32], ['Maniac', 50, 75], ['Rock', 12, 22],
        ['Fish', 40, 65], ['Wildcard', 25, 55]
    ];
    for (const [role, lo, hi] of vpipChecks) {
        const v = by[role]?.vpipPct;
        if (v === undefined) continue;
        checks.push({
            name: `${role} VPIP ∈ [${lo}, ${hi}]%`,
            value: `${v.toFixed(1)}%`,
            pass: v >= lo && v <= hi
        });
    }

    const pfrVpip = [
        ['Shark', '>', 0.65], ['Fish', '<', 0.15], ['Rock', '<', 0.30]
    ];
    for (const [role, op, thresh] of pfrVpip) {
        const vp = by[role]?.vpipPct, pf = by[role]?.pfrPct;
        if (!vp) continue;
        const ratio = pf / vp;
        const ok = op === '>' ? ratio > thresh : ratio < thresh;
        checks.push({ name: `${role} PFR/VPIP ${op} ${thresh}`, value: ratio.toFixed(2), pass: ok });
    }

    const afChecks = [
        ['Shark', '>', 2.0], ['Maniac', '>', 3.0], ['Rock', '<', 1.0], ['Fish', '<', 0.8]
    ];
    for (const [role, op, thresh] of afChecks) {
        const af = by[role]?.af;
        if (af === undefined) continue;
        const ok = op === '>' ? af > thresh : af < thresh;
        checks.push({ name: `${role} AF ${op} ${thresh}`, value: af.toFixed(2), pass: ok });
    }

    return checks;
}

function renderGate(checks) {
    const container = document.getElementById('gate');
    const html = [
        '<h3>Pass Criteria</h3>',
        '<table class="gate">',
        '<thead><tr><th>Check</th><th>Value</th><th>Result</th></tr></thead>',
        '<tbody>',
        ...checks.map(c => `<tr class="${c.pass ? 'pass' : 'fail'}"><td>${c.name}</td><td>${c.value}</td><td>${c.pass ? 'PASS' : 'FAIL'}</td></tr>`),
        '</tbody></table>',
        `<p><strong>${checks.filter(c => c.pass).length} / ${checks.length} passed.</strong></p>`
    ].join('');
    container.innerHTML = html;
}

function renderCapCheck(rows) {
    const container = document.getElementById('cap-results');
    const html = [
        '<h3>Shark Cap Check</h3>',
        '<table>',
        '<thead><tr><th>Table Size</th><th>Cap</th><th>Max Sharks Seen</th><th>Violations</th><th>Runs</th></tr></thead>',
        '<tbody>',
        ...rows.map(r => `<tr class="${r.violations === 0 ? 'pass' : 'fail'}"><td>${r.tableSize}</td><td>${r.cap}</td><td>${r.maxShark}</td><td>${r.violations}</td><td>${r.runs}</td></tr>`),
        '</tbody></table>'
    ].join('');
    container.innerHTML = html;
}

document.getElementById('run').addEventListener('click', async () => {
    const n = +document.getElementById('n-hands').value;
    const t = +document.getElementById('table-size').value;
    const status = document.getElementById('status');
    status.textContent = `Running ${n} hands at ${t} seats…`;
    const t0 = performance.now();
    try {
        const rows = await runSim(n, t);
        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
        status.textContent = `Done in ${elapsed}s.`;
        renderResults(rows);
        renderGate(evaluateGate(rows));
    } catch (e) {
        status.textContent = `Error: ${e.message}`;
        console.error(e);
    }
});

document.getElementById('run-cap-check').addEventListener('click', () => {
    renderCapCheck(verifySharkCap(50));
});
