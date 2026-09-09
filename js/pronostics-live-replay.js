// pronostics-live-replay.js — Multiplex des pronostiqueurs
// Rejoue le classement des pronostiqueurs d'une journée but par but, à
// l'heure réelle de chaque but (coup d'envoi + minute, +15 min de pause en
// 2ème mi-temps). À chaque instant t, on construit des « matchs virtuels »
// (score et buts connus à cet instant) et on les passe dans le MOTEUR DE
// POINTS EXISTANT : calculatePredictionResult (cotes + joker ×2),
// calculateScorerResult (défi buteur, +4 1er buteur / +1 par but, CSC),
// calculateCombineResult (combiné perdu dès qu'un match bascule), les défis
// IA (resolve() sur le match virtuel), les buts totaux, le Super Joker
// (×1.5 de la base du moment) et le bonus MVP (journée précédente, fixe).
// Aucune règle réimplémentée : mêmes fonctions que le classement officiel.

const PLR_HALFTIME_BREAK_MIN = 15;
const PLR_MATCH_DURATION_MIN = 90 + PLR_HALFTIME_BREAK_MIN;
const PLR_DEFAULT_KICKOFF = 'T17:00:00';

let plrData = null;   // { matchDay, dayMatches, steps, players, challengeDefs, estimatedCount }
let plrIndex = 0;
let plrTimer = null;
let plrPrevRanks = null;
let plrPrevTotals = null;

// Heure réelle d'un but (même règle que le Multiplex du classement)
function plrGoalRealTime(kickoff, goal) {
    const minute = parseInt(goal.minute) || 0;
    const extra = parseInt(goal.extraTime) || 0;
    const offset = minute <= 45 ? minute + extra : PLR_HALFTIME_BREAK_MIN + minute + extra;
    return new Date(kickoff.getTime() + offset * 60000);
}

// Initialisation de l'onglet (appelée au clic sur l'onglet Multiplex)
let _plrInitDone = false;
async function initPronoLiveReplay() {
    const select = document.getElementById('plrMatchDay');
    if (!select) return;

    const played = allMatches.filter(m => m.finalScore);
    const days = [...new Set(played.map(m => m.matchDay || 0))].filter(d => d > 0).sort((a, b) => a - b);

    if (days.length === 0) {
        select.innerHTML = '<option value="">Aucune journée jouée</option>';
        plrRenderEmpty('Aucune journée jouée pour cette saison.');
        return;
    }

    const previous = parseInt(select.value);
    select.innerHTML = days.map(d => `<option value="${d}">Journée ${d}</option>`).join('');
    select.value = days.includes(previous) ? previous : days[days.length - 1];

    select.onchange = () => plrLoadDay(parseInt(select.value));
    const playBtn = document.getElementById('plrPlayBtn');
    if (playBtn) playBtn.onclick = plrTogglePlay;
    const slider = document.getElementById('plrSlider');
    if (slider) slider.oninput = function() {
        plrStop();
        plrSetIndex(parseInt(this.value));
    };

    // Ne recharger que si la journée affichée change (l'onglet peut être rouvert)
    if (!_plrInitDone || !plrData || plrData.matchDay !== parseInt(select.value)) {
        _plrInitDone = true;
        await plrLoadDay(parseInt(select.value));
    }
}

async function plrLoadDay(matchDay) {
    plrStop();
    const status = document.getElementById('plrStatus');
    if (status) status.textContent = '⏳ Chargement des pronostics…';

    // 1. Timeline des matchs joués de la journée
    const dayMatchesRaw = allMatches.filter(m => (m.matchDay || 0) === matchDay && m.finalScore);
    if (dayMatchesRaw.length === 0) {
        plrData = null;
        plrRenderEmpty('Aucun match joué pour cette journée.');
        if (status) status.textContent = '';
        return;
    }

    let estimatedCount = 0;
    const dayMatches = dayMatchesRaw.map(m => {
        let kickoff;
        if (m.scheduledAt) {
            kickoff = new Date(m.scheduledAt);
        } else {
            kickoff = new Date(`${m.date}${PLR_DEFAULT_KICKOFF}`);
            estimatedCount++;
        }
        const goals = (m.goals || [])
            .map(g => ({ ...g, realTime: plrGoalRealTime(kickoff, g) }))
            .sort((a, b) => a.realTime - b.realTime);
        const lastGoal = goals.length ? goals[goals.length - 1].realTime.getTime() : 0;
        const end = new Date(Math.max(kickoff.getTime() + PLR_MATCH_DURATION_MIN * 60000, lastGoal + 60000));
        return { match: m, kickoff, goals, end };
    });

    const events = [];
    dayMatches.forEach(dm => {
        const home = allTeams.find(t => t.id == dm.match.homeTeamId);
        const away = allTeams.find(t => t.id == dm.match.awayTeamId);
        const label = `${home ? home.shortName : '?'} - ${away ? away.shortName : '?'}`;
        events.push({ t: dm.kickoff, type: 'start', dm, text: `🟢 Coup d'envoi de ${label}` });
        dm.goals.forEach(g => {
            const team = allTeams.find(t => t.id == g.teamId);
            const score = plrScoreAt(dm, g.realTime);
            events.push({
                t: g.realTime, type: 'goal', dm,
                text: `⚽ ${g.displayTime || `${g.minute}'`} ${g.scorer || 'But'}${team ? ` (${team.shortName})` : ''} — ${home ? home.shortName : '?'} ${score.home}-${score.away} ${away ? away.shortName : '?'}`
            });
        });
        events.push({ t: dm.end, type: 'end', dm, text: `🏁 Fin de ${label} : ${dm.match.finalScore.home}-${dm.match.finalScore.away}` });
    });
    events.sort((a, b) => a.t - b.t);

    const steps = [{ t: new Date(dayMatches.reduce((min, dm) => Math.min(min, dm.kickoff.getTime()), Infinity) - 60000), events: [] }];
    events.forEach(ev => {
        const last = steps[steps.length - 1];
        if (last.events.length > 0 && last.t.getTime() === ev.t.getTime()) last.events.push(ev);
        else steps.push({ t: ev.t, events: [ev] });
    });

    // 2. Préchargement des données pronostics (une seule fois par journée) :
    // ensuite chaque pas de lecture est un calcul pur, sans lecture Firestore
    const season = currentSeason;
    const allPlayersList = await getAllPlayers();
    const players = [];
    for (const player of allPlayersList) {
        let predictions = null;
        try { predictions = await getPlayerPredictions(player.id, season, matchDay); } catch (e) {}
        if (!predictions || !predictions.predictions || predictions.predictions.length === 0) continue;

        let combine = null, sjActive = false, answers = null, mvpBonus = 0;
        if (typeof getPlayerCombine === 'function') {
            try { combine = await getPlayerCombine(player.id, season, matchDay); } catch (e) {}
        }
        if (typeof getSuperJoker === 'function') {
            try {
                const sj = await getSuperJoker(player.id, season);
                sjActive = !!(sj && sj.used && sj.matchDay === matchDay);
            } catch (e) {}
        }
        if (typeof getPlayerChallengeAnswers === 'function') {
            try { answers = await getPlayerChallengeAnswers(player.id, season, matchDay); } catch (e) {}
        }
        if (typeof getMVPBonusForPlayer === 'function') {
            try { mvpBonus = (await getMVPBonusForPlayer(player.id, season, matchDay)) || 0; } catch (e) {}
        }

        players.push({ player, predictions: predictions.predictions, combine, sjActive, answers, mvpBonus });
    }

    let challengeDefs = [];
    if (typeof getOrCreateChallenges === 'function') {
        try { challengeDefs = (await getOrCreateChallenges(matchDay)) || []; } catch (e) {}
    }

    plrData = { matchDay, dayMatches, steps, players, challengeDefs, estimatedCount };

    const slider = document.getElementById('plrSlider');
    if (slider) { slider.max = steps.length - 1; slider.value = 0; }
    plrRenderTimeline();

    if (status) {
        status.textContent = players.length === 0
            ? '😴 Aucun pronostic enregistré pour cette journée.'
            : (estimatedCount > 0 ? `⚠️ ${estimatedCount} match(s) sans heure : 17h00 par défaut.` : '');
    }

    plrPrevRanks = null;
    plrPrevTotals = null;
    plrSetIndex(0);
}

function plrScoreAt(dm, t) {
    let home = 0, away = 0;
    dm.goals.forEach(g => {
        if (g.realTime > t) return;
        if (String(g.teamId) === String(dm.match.homeTeamId)) home++;
        else if (String(g.teamId) === String(dm.match.awayTeamId)) away++;
    });
    return { home, away };
}

// Matchs virtuels à l'instant t : les matchs commencés, avec le score et les
// buts connus à cet instant — c'est CE match que voit le moteur de points
function plrVirtualMatchesAt(t) {
    return plrData.dayMatches
        .filter(dm => t >= dm.kickoff)
        .map(dm => ({
            ...dm.match,
            finalScore: plrScoreAt(dm, t),
            goals: dm.goals.filter(g => g.realTime <= t).map(g => ({ ...g }))
        }));
}

// Classement des pronostiqueurs à l'instant t, via le moteur officiel
function plrComputeStandings(t) {
    const virtual = plrVirtualMatchesAt(t);

    const rows = plrData.players.map(p => {
        let base = 0;
        (p.predictions || []).forEach(pred => {
            const vm = virtual.find(m => m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId);
            if (!vm) return;
            const r = calculatePredictionResult(
                pred.homeScore, pred.awayScore,
                vm.finalScore.home, vm.finalScore.away,
                pred.savedAt, vm, pred.odds, pred.joker || false
            );
            base += (r.finalPoints !== undefined ? r.finalPoints : r.points);
        });
        base = Math.round(base * 10) / 10;

        const parts = { superJoker: 0, scorer: 0, combine: 0, challenges: 0, mvp: p.mvpBonus || 0 };

        if (p.sjActive) parts.superJoker = Math.round(base * 0.5 * 10) / 10;

        if (typeof calculateScorerResult === 'function') {
            (p.predictions || []).forEach(pred => {
                if (!pred.scorerPick) return;
                const vm = virtual.find(m => m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId);
                if (!vm) return;
                parts.scorer += calculateScorerResult(pred.scorerPick, vm).points;
            });
        }

        if (p.combine && p.combine.matches && typeof calculateCombineResult === 'function') {
            parts.combine = calculateCombineResult(p.combine, p.predictions || [], virtual)?.bonusPoints || 0;
        }

        // Défis IA + buts totaux : mêmes règles que calculateAllChallengePoints,
        // évaluées sur les matchs virtuels (un défi « validé » peut retomber
        // à 0 si un but change la réponse — c'est voulu)
        if (virtual.length > 0 && p.answers) {
            if (p.answers.challenges && plrData.challengeDefs.length && typeof CHALLENGE_TYPES !== 'undefined') {
                plrData.challengeDefs.forEach(c => {
                    const vm = virtual.find(m => m.homeTeamId == c.homeTeamId && m.awayTeamId == c.awayTeamId);
                    if (!vm) return;
                    const type = CHALLENGE_TYPES.find(ct => ct.id === c.type);
                    if (!type) return;
                    const playerAnswer = p.answers.challenges[c.id];
                    if (playerAnswer === undefined || playerAnswer === null) return;
                    if (playerAnswer === type.resolve(vm, c.params)) parts.challenges += c.points;
                });
            }
            if (p.answers.totalGoalsPrediction !== null && p.answers.totalGoalsPrediction !== undefined
                && typeof calculateTotalGoalsPoints === 'function') {
                const actual = virtual.reduce((s, m) => s + m.finalScore.home + m.finalScore.away, 0);
                parts.challenges += calculateTotalGoalsPoints(p.answers.totalGoalsPrediction, actual);
            }
        }

        const bonus = Math.round((parts.superJoker + parts.scorer + parts.combine + parts.challenges + parts.mvp) * 10) / 10;
        const total = Math.round((base + bonus) * 10) / 10;
        return { playerId: p.player.id, pseudo: p.player.pseudo, base, parts, bonus, total };
    });

    rows.sort((a, b) => b.total - a.total || (a.pseudo || '').localeCompare(b.pseudo || '', 'fr'));
    return rows;
}

function plrSetIndex(index) {
    if (!plrData) return;
    plrIndex = Math.max(0, Math.min(index, plrData.steps.length - 1));
    if (plrIndex === 0) { plrPrevRanks = null; plrPrevTotals = null; }

    const slider = document.getElementById('plrSlider');
    if (slider) slider.value = plrIndex;

    const step = plrData.steps[plrIndex];
    const t = step.t;

    const clock = document.getElementById('plrClock');
    if (clock) {
        const day = t.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        const time = `${t.getHours()}h${String(t.getMinutes()).padStart(2, '0')}`;
        clock.textContent = plrIndex === 0 ? `${day} — avant les matchs` : `${day} — ${time}`;
    }

    const standings = plrComputeStandings(t);

    plrRenderMatches(t);
    plrRenderFeed(step, standings);
    plrRenderTable(standings);
    plrHighlightTimeline();

    plrPrevRanks = {};
    plrPrevTotals = {};
    standings.forEach((row, i) => {
        plrPrevRanks[row.playerId] = i + 1;
        plrPrevTotals[row.playerId] = row.total;
    });

    if (plrTimer && plrIndex >= plrData.steps.length - 1) plrStop();
}

function plrLiveMinute(dm, t) {
    const elapsed = Math.floor((t - dm.kickoff) / 60000);
    if (elapsed <= 45) return `${Math.max(elapsed, 1)}'`;
    if (elapsed <= 51) return `45+${elapsed - 45}'`;
    if (elapsed <= 45 + PLR_HALFTIME_BREAK_MIN) return 'MT';
    return `${Math.min(elapsed - PLR_HALFTIME_BREAK_MIN, 90)}'${elapsed - PLR_HALFTIME_BREAK_MIN > 90 ? '+' : ''}`;
}

function plrRenderMatches(t) {
    const container = document.getElementById('plrMatches');
    if (!container) return;
    container.innerHTML = plrData.dayMatches.map(dm => {
        const home = allTeams.find(tm => tm.id == dm.match.homeTeamId);
        const away = allTeams.find(tm => tm.id == dm.match.awayTeamId);
        const started = t >= dm.kickoff;
        const finished = t >= dm.end;
        let status, score, cls;
        if (!started) {
            status = `🕐 ${dm.kickoff.getHours()}h${String(dm.kickoff.getMinutes()).padStart(2, '0')}`;
            score = '<span class="plr-score upcoming">- : -</span>';
            cls = 'upcoming';
        } else {
            const s = plrScoreAt(dm, t);
            if (finished) { status = '✅ Terminé'; score = `<span class="plr-score">${s.home} : ${s.away}</span>`; cls = 'finished'; }
            else { status = `🔴 ${plrLiveMinute(dm, t)}`; score = `<span class="plr-score live">${s.home} : ${s.away}</span>`; cls = 'live'; }
        }
        return `<div class="plr-match ${cls}"><span class="plr-match-status">${status}</span>
                <span class="plr-match-teams"><span>${home ? home.shortName : '?'}</span>${score}<span>${away ? away.shortName : '?'}</span></span></div>`;
    }).join('');
}

// Fil des événements + les pronostiqueurs qui gagnent/perdent le plus sur ce pas
function plrRenderFeed(step, standings) {
    const feed = document.getElementById('plrFeed');
    if (!feed) return;
    if (step.events.length === 0) {
        feed.innerHTML = '<div class="plr-feed-item muted">La journée n\'a pas encore commencé…</div>';
        return;
    }
    let html = step.events.map(ev => `<div class="plr-feed-item ${ev.type}">${ev.text}</div>`).join('');

    if (plrPrevTotals && step.events.some(e => e.type === 'goal')) {
        const deltas = standings
            .map(row => ({ pseudo: row.pseudo, delta: Math.round((row.total - (plrPrevTotals[row.playerId] || 0)) * 10) / 10 }))
            .filter(d => d.delta !== 0)
            .sort((a, b) => b.delta - a.delta);
        if (deltas.length > 0) {
            const chunks = deltas.slice(0, 4).map(d =>
                `<span class="plr-delta ${d.delta > 0 ? 'up' : 'down'}">${d.delta > 0 ? '📈' : '📉'} ${d.pseudo} ${d.delta > 0 ? '+' : ''}${d.delta}</span>`);
            const rest = deltas.length - 4;
            html += `<div class="plr-feed-item movers">${chunks.join(' ')}${rest > 0 ? ` <span class="plr-delta">+${rest} autres</span>` : ''}</div>`;
        }
    }
    feed.innerHTML = html;
}

function plrFormatParts(parts) {
    const chunks = [];
    if (parts.superJoker) chunks.push(`🃏✨${parts.superJoker}`);
    if (parts.scorer) chunks.push(`⚽${parts.scorer}`);
    if (parts.combine) chunks.push(`🎰${parts.combine}`);
    if (parts.challenges) chunks.push(`🎲${parts.challenges}`);
    if (parts.mvp) chunks.push(`🏆${parts.mvp}`);
    return chunks.join(' ');
}

function plrRenderTable(standings) {
    const tbody = document.querySelector('#plrTable tbody');
    if (!tbody) return;
    if (standings.length === 0) { tbody.innerHTML = ''; return; }

    tbody.innerHTML = standings.map((row, i) => {
        const rank = i + 1;
        const prev = plrPrevRanks ? plrPrevRanks[row.playerId] : rank;
        let move = '<span class="plr-move same">·</span>';
        let rowCls = '';
        if (prev && prev !== rank) {
            if (rank < prev) { move = `<span class="plr-move up">▲${prev - rank}</span>`; rowCls = 'moved-up'; }
            else { move = `<span class="plr-move down">▼${rank - prev}</span>`; rowCls = 'moved-down'; }
        }
        const prevTotal = plrPrevTotals ? plrPrevTotals[row.playerId] : null;
        const delta = prevTotal !== null && prevTotal !== undefined
            ? Math.round((row.total - prevTotal) * 10) / 10 : 0;
        const deltaHtml = delta !== 0
            ? `<span class="plr-pts-delta ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : ''}${delta}</span>` : '';
        const bonuses = plrFormatParts(row.parts);
        const isMe = typeof currentPlayer !== 'undefined' && currentPlayer && currentPlayer.id === row.playerId;
        return `
            <tr class="${rowCls}${isMe ? ' plr-me' : ''}">
                <td class="pos">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</td>
                <td class="move">${move}</td>
                <td class="pseudo">${row.pseudo}</td>
                <td class="pts"><strong>${row.total}</strong> ${deltaHtml}</td>
                <td class="base">${row.base}</td>
                <td class="bonuses">${bonuses || '—'}</td>
            </tr>
        `;
    }).join('');
}

function plrRenderTimeline() {
    const container = document.getElementById('plrTimeline');
    if (!container || !plrData) return;
    const steps = plrData.steps;
    if (steps.length < 2) { container.innerHTML = ''; return; }
    const t0 = steps[0].t.getTime();
    const span = Math.max(steps[steps.length - 1].t.getTime() - t0, 1);
    container.innerHTML = steps.map((step, i) => {
        if (i === 0) return '';
        const pct = ((step.t.getTime() - t0) / span) * 100;
        const type = step.events.some(e => e.type === 'goal') ? 'goal'
            : step.events.some(e => e.type === 'start') ? 'start' : 'end';
        const icon = type === 'goal' ? '⚽' : type === 'start' ? '🟢' : '🏁';
        const time = `${step.t.getHours()}h${String(step.t.getMinutes()).padStart(2, '0')}`;
        const titles = step.events.map(e => e.text).join('\n');
        return `<button class="plr-dot ${type}" style="left:${pct}%" data-step="${i}"
                        title="${time}\n${titles.replace(/"/g, '&quot;')}"
                        onclick="plrStop(); plrSetIndex(${i})">${icon}</button>`;
    }).join('');
}

function plrHighlightTimeline() {
    document.querySelectorAll('#plrTimeline .plr-dot').forEach(dot => {
        const idx = parseInt(dot.dataset.step);
        dot.classList.toggle('done', idx <= plrIndex);
        dot.classList.toggle('current', idx === plrIndex);
    });
}

function plrTogglePlay() {
    if (plrTimer) { plrStop(); return; }
    if (!plrData) return;
    if (plrIndex >= plrData.steps.length - 1) {
        plrPrevRanks = null;
        plrPrevTotals = null;
        plrSetIndex(0);
    }
    const btn = document.getElementById('plrPlayBtn');
    if (btn) btn.textContent = '⏸️ Pause';
    const tick = () => {
        const speed = parseInt(document.getElementById('plrSpeed')?.value) || 1500;
        plrTimer = setTimeout(() => {
            plrSetIndex(plrIndex + 1);
            if (plrTimer) tick();
        }, speed);
    };
    tick();
}

function plrStop() {
    if (plrTimer) { clearTimeout(plrTimer); plrTimer = null; }
    const btn = document.getElementById('plrPlayBtn');
    if (btn) btn.textContent = '▶️ Lecture';
}

function plrRenderEmpty(message) {
    const matches = document.getElementById('plrMatches');
    if (matches) matches.innerHTML = `<div class="plr-feed-item muted">${message}</div>`;
    ['plrFeed', 'plrTimeline'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    const tbody = document.querySelector('#plrTable tbody');
    if (tbody) tbody.innerHTML = '';
    const clock = document.getElementById('plrClock');
    if (clock) clock.textContent = '—';
}
