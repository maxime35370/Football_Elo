// pronostics-live-replay.js — Multiplex des pronostiqueurs
// Rejoue le classement des pronostiqueurs but par but, sur une journée, une
// série de journées ou toute la saison. À chaque instant t, des « matchs
// virtuels » (score et buts connus à cet instant) sont passés dans le MOTEUR
// DE POINTS EXISTANT : calculatePredictionResult (cotes + joker ×2),
// calculateScorerResult (+4 1er buteur / +1 par but, CSC), le combiné, les
// défis IA, les buts totaux, le Super Joker et le bonus MVP. Aucune règle
// réimplémentée. Sur une plage, les points des journées terminées se cument
// et la lecture saute d'événement en événement : les temps morts entre
// matchs et entre journées n'existent pas dans la lecture ni sur le graphe.

const PLR_HALFTIME_BREAK_MIN = 15;
const PLR_MATCH_DURATION_MIN = 90 + PLR_HALFTIME_BREAK_MIN;
const PLR_DEFAULT_KICKOFF = 'T17:00:00';

// Couleurs stables par pronostiqueur (ordre alphabétique des pseudos)
const PLR_COLORS = [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
    '#e67e22', '#34495e', '#16a085', '#c0392b', '#2980b9', '#8e44ad',
    '#27ae60', '#d35400', '#7f8c8d', '#f1c40f'
];

let plrData = null;   // { fromDay, toDay, days, dayContexts, steps, roster, stepRows, estimatedCount }
let plrIndex = 0;
let plrTimer = null;

function plrGoalRealTime(kickoff, goal) {
    const minute = parseInt(goal.minute) || 0;
    const extra = parseInt(goal.extraTime) || 0;
    const offset = minute <= 45 ? minute + extra : PLR_HALFTIME_BREAK_MIN + minute + extra;
    return new Date(kickoff.getTime() + offset * 60000);
}

// Initialisation de l'onglet (appelée au clic sur l'onglet Multiplex)
let _plrInitDone = false;
async function initPronoLiveReplay() {
    const fromSelect = document.getElementById('plrFromDay');
    const toSelect = document.getElementById('plrToDay');
    if (!fromSelect || !toSelect) return;

    const played = allMatches.filter(m => m.finalScore);
    const days = [...new Set(played.map(m => m.matchDay || 0))].filter(d => d > 0).sort((a, b) => a - b);

    if (days.length === 0) {
        fromSelect.innerHTML = '<option value="">—</option>';
        toSelect.innerHTML = '<option value="">—</option>';
        plrRenderEmpty('Aucune journée jouée pour cette saison.');
        return;
    }

    const prevFrom = parseInt(fromSelect.value);
    const prevTo = parseInt(toSelect.value);
    const options = days.map(d => `<option value="${d}">J${d}</option>`).join('');
    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;
    const last = days[days.length - 1];
    fromSelect.value = days.includes(prevFrom) ? prevFrom : last;
    toSelect.value = days.includes(prevTo) && prevTo >= parseInt(fromSelect.value) ? prevTo : Math.max(parseInt(fromSelect.value), last);
    if (parseInt(toSelect.value) < parseInt(fromSelect.value)) toSelect.value = fromSelect.value;

    const reload = () => plrLoadRange(parseInt(fromSelect.value), parseInt(toSelect.value));
    fromSelect.onchange = () => {
        if (parseInt(fromSelect.value) > parseInt(toSelect.value)) toSelect.value = fromSelect.value;
        reload();
    };
    toSelect.onchange = () => {
        if (parseInt(toSelect.value) < parseInt(fromSelect.value)) fromSelect.value = toSelect.value;
        reload();
    };
    const seasonBtn = document.getElementById('plrSeasonBtn');
    if (seasonBtn) seasonBtn.onclick = () => {
        fromSelect.value = days[0];
        toSelect.value = last;
        reload();
    };
    const playBtn = document.getElementById('plrPlayBtn');
    if (playBtn) playBtn.onclick = plrTogglePlay;
    const slider = document.getElementById('plrSlider');
    if (slider) slider.oninput = function() {
        plrStop();
        plrSetIndex(parseInt(this.value));
    };

    if (!_plrInitDone || !plrData || plrData.fromDay !== parseInt(fromSelect.value) || plrData.toDay !== parseInt(toSelect.value)) {
        _plrInitDone = true;
        await reload();
    }
}

async function plrLoadRange(fromDay, toDay) {
    plrStop();
    const status = document.getElementById('plrStatus');
    const setStatus = msg => { if (status) status.textContent = msg; };
    setStatus('⏳ Chargement des pronostics…');

    const season = currentSeason;
    const rangeMatches = allMatches.filter(m => {
        const d = m.matchDay || 0;
        return d >= fromDay && d <= toDay && m.finalScore;
    });
    if (rangeMatches.length === 0) {
        plrData = null;
        plrRenderEmpty('Aucun match joué sur cette plage.');
        setStatus('');
        return;
    }

    const days = [...new Set(rangeMatches.map(m => m.matchDay || 0))].sort((a, b) => a - b);

    // 1. Timelines par journée + événements globaux
    let estimatedCount = 0;
    const events = [];
    const dayContexts = new Map(); // day -> { dayMatches, players: Map, challengeDefs, eventTimes, totalsAt }
    days.forEach(day => {
        const dayMatches = rangeMatches.filter(m => (m.matchDay || 0) === day).map(m => {
            let kickoff;
            if (m.scheduledAt) kickoff = new Date(m.scheduledAt);
            else { kickoff = new Date(`${m.date}${PLR_DEFAULT_KICKOFF}`); estimatedCount++; }
            const goals = (m.goals || [])
                .map(g => ({ ...g, realTime: plrGoalRealTime(kickoff, g) }))
                .sort((a, b) => a.realTime - b.realTime);
            const lastGoal = goals.length ? goals[goals.length - 1].realTime.getTime() : 0;
            const end = new Date(Math.max(kickoff.getTime() + PLR_MATCH_DURATION_MIN * 60000, lastGoal + 60000));
            return { match: m, kickoff, goals, end };
        });
        dayContexts.set(day, { day, dayMatches, players: new Map(), challengeDefs: [] });

        dayMatches.forEach(dm => {
            const home = allTeams.find(t => t.id == dm.match.homeTeamId);
            const away = allTeams.find(t => t.id == dm.match.awayTeamId);
            const label = `${home ? home.shortName : '?'} - ${away ? away.shortName : '?'}`;
            events.push({ t: dm.kickoff, type: 'start', day, dm, text: `🟢 Coup d'envoi de ${label}` });
            dm.goals.forEach(g => {
                const team = allTeams.find(t => t.id == g.teamId);
                const score = plrScoreAt(dm, g.realTime);
                events.push({
                    t: g.realTime, type: 'goal', day, dm,
                    text: `⚽ ${g.displayTime || `${g.minute}'`} ${g.scorer || 'But'}${team ? ` (${team.shortName})` : ''} — ${home ? home.shortName : '?'} ${score.home}-${score.away} ${away ? away.shortName : '?'}`
                });
            });
            events.push({ t: dm.end, type: 'end', day, dm, text: `🏁 Fin de ${label} : ${dm.match.finalScore.home}-${dm.match.finalScore.away}` });
        });
    });
    events.sort((a, b) => a.t - b.t);

    const firstKickoff = Math.min(...[...dayContexts.values()].flatMap(c => c.dayMatches.map(dm => dm.kickoff.getTime())));
    const steps = [{ t: new Date(firstKickoff - 60000), events: [] }];
    events.forEach(ev => {
        const last = steps[steps.length - 1];
        if (last.events.length > 0 && last.t.getTime() === ev.t.getTime()) last.events.push(ev);
        else steps.push({ t: ev.t, events: [ev] });
    });

    // 2. Préchargement Firestore : une fois par (joueur, journée)
    const allPlayersList = await getAllPlayers();
    const roster = new Map(); // playerId -> pseudo (joueurs ayant au moins un prono sur la plage)
    let dayIdx = 0;
    for (const day of days) {
        dayIdx++;
        setStatus(`⏳ Chargement des pronostics… (journée ${day}, ${dayIdx}/${days.length})`);
        const ctx = dayContexts.get(day);
        for (const player of allPlayersList) {
            let predictions = null;
            try { predictions = await getPlayerPredictions(player.id, season, day); } catch (e) {}
            if (!predictions || !predictions.predictions || predictions.predictions.length === 0) continue;
            // Même règle que le classement officiel : sans prono correspondant
            // à un match de la journée, le joueur n'y est pas classé du tout
            const hasMatch = ctx.dayMatches.some(dm => predictions.predictions.some(pred =>
                pred.homeTeamId == dm.match.homeTeamId && pred.awayTeamId == dm.match.awayTeamId));
            if (!hasMatch) continue;

            let combine = null, sjActive = false, answers = null, mvpBonus = 0;
            if (typeof getPlayerCombine === 'function') {
                try { combine = await getPlayerCombine(player.id, season, day); } catch (e) {}
            }
            if (typeof getSuperJoker === 'function') {
                try {
                    const sj = await getSuperJoker(player.id, season);
                    sjActive = !!(sj && sj.used && sj.matchDay === day);
                } catch (e) {}
            }
            if (typeof getPlayerChallengeAnswers === 'function') {
                try { answers = await getPlayerChallengeAnswers(player.id, season, day); } catch (e) {}
            }
            if (typeof getMVPBonusForPlayer === 'function') {
                try { mvpBonus = (await getMVPBonusForPlayer(player.id, season, day)) || 0; } catch (e) {}
            }
            ctx.players.set(player.id, { predictions: predictions.predictions, combine, sjActive, answers, mvpBonus });
            roster.set(player.id, player.pseudo);
        }
        if (typeof getOrCreateChallenges === 'function') {
            try { ctx.challengeDefs = (await getOrCreateChallenges(day)) || []; } catch (e) {}
        }
    }

    // 3. Précalcul : les points d'une journée ne changent qu'à SES événements.
    // On calcule les totaux de chaque journée à chacun de ses événements, puis
    // chaque pas global cumule les journées via une recherche du dernier
    // événement ≤ t. Résultat : lecture et curseur instantanés.
    dayContexts.forEach(ctx => {
        ctx.eventTimes = [];
        ctx.totalsAt = [];
        const dayEventTimes = [...new Set(events.filter(e => e.day === ctx.day).map(e => e.t.getTime()))].sort((a, b) => a - b);
        dayEventTimes.forEach(ms => {
            const t = new Date(ms);
            ctx.eventTimes.push(ms);
            ctx.totalsAt.push(plrComputeDayStandings(ctx, t));
        });
    });

    const zeroRow = () => ({ base: 0, parts: { superJoker: 0, scorer: 0, combine: 0, challenges: 0, mvp: 0 }, total: 0 });
    const stepRows = steps.map(step => {
        const ms = step.t.getTime();
        const perPlayer = new Map();
        roster.forEach((pseudo, playerId) => perPlayer.set(playerId, zeroRow()));
        dayContexts.forEach(ctx => {
            // Dernier événement de la journée ≤ t
            let idx = -1;
            for (let i = ctx.eventTimes.length - 1; i >= 0; i--) {
                if (ctx.eventTimes[i] <= ms) { idx = i; break; }
            }
            if (idx < 0) return;
            const dayTotals = ctx.totalsAt[idx];
            dayTotals.forEach((row, playerId) => {
                const acc = perPlayer.get(playerId);
                if (!acc) return;
                acc.base = Math.round((acc.base + row.base) * 10) / 10;
                Object.keys(acc.parts).forEach(k => {
                    acc.parts[k] = Math.round((acc.parts[k] + row.parts[k]) * 10) / 10;
                });
                acc.total = Math.round((acc.total + row.total) * 10) / 10;
            });
        });
        const rows = [...perPlayer.entries()].map(([playerId, acc]) => ({
            playerId, pseudo: roster.get(playerId), ...acc
        }));
        rows.sort((a, b) => b.total - a.total || (a.pseudo || '').localeCompare(b.pseudo || '', 'fr'));
        return rows;
    });

    plrData = { fromDay, toDay, days, dayContexts, steps, roster, stepRows, estimatedCount };

    const slider = document.getElementById('plrSlider');
    if (slider) { slider.max = steps.length - 1; slider.value = 0; }
    plrRenderTimeline();

    setStatus(roster.size === 0
        ? '😴 Aucun pronostic enregistré sur cette plage.'
        : (estimatedCount > 0 ? `⚠️ ${estimatedCount} match(s) sans heure : 17h00 par défaut.` : ''));

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

// Points d'UNE journée pour tous ses pronostiqueurs à l'instant t, via le
// moteur officiel appliqué aux matchs virtuels de cette journée.
// Retourne Map playerId -> { base, parts, total } (zéros si rien n'a commencé).
function plrComputeDayStandings(ctx, t) {
    const virtual = ctx.dayMatches
        .filter(dm => t >= dm.kickoff)
        .map(dm => ({
            ...dm.match,
            finalScore: plrScoreAt(dm, t),
            goals: dm.goals.filter(g => g.realTime <= t).map(g => ({ ...g }))
        }));

    const result = new Map();
    ctx.players.forEach((p, playerId) => {
        const parts = { superJoker: 0, scorer: 0, combine: 0, challenges: 0, mvp: 0 };
        let base = 0;

        if (virtual.length > 0) {
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

            // Défis IA + buts totaux : un défi « validé » peut retomber à 0
            // si un but change la réponse — c'est voulu
            if (p.answers) {
                if (p.answers.challenges && ctx.challengeDefs.length && typeof CHALLENGE_TYPES !== 'undefined') {
                    ctx.challengeDefs.forEach(c => {
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

            parts.mvp = p.mvpBonus || 0;
        }

        const bonus = Math.round((parts.superJoker + parts.scorer + parts.combine + parts.challenges + parts.mvp) * 10) / 10;
        result.set(playerId, { base, parts, total: Math.round((base + bonus) * 10) / 10 });
    });
    return result;
}

// Journée « active » à l'instant t (la plus avancée dont un match a commencé)
function plrActiveDay(t) {
    let active = null;
    plrData.dayContexts.forEach(ctx => {
        if (ctx.dayMatches.some(dm => dm.kickoff <= t) && (active === null || ctx.day > active)) active = ctx.day;
    });
    return active !== null ? active : plrData.days[0];
}

function plrSetIndex(index) {
    if (!plrData) return;
    plrIndex = Math.max(0, Math.min(index, plrData.steps.length - 1));

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

    plrRenderMatches(t);
    plrRenderFeed(step);
    plrRenderTable();
    plrRenderChart();
    plrHighlightTimeline();

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
    const activeDay = plrActiveDay(t);
    const ctx = plrData.dayContexts.get(activeDay);
    const header = plrData.days.length > 1
        ? `<div class="plr-matches-header">📅 Journée ${activeDay}</div>` : '';

    container.innerHTML = header + ctx.dayMatches.map(dm => {
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

// Fil des événements + les pronostiqueurs qui gagnent/perdent sur ce pas
function plrRenderFeed(step) {
    const feed = document.getElementById('plrFeed');
    if (!feed) return;
    if (step.events.length === 0) {
        feed.innerHTML = '<div class="plr-feed-item muted">La plage n\'a pas encore commencé…</div>';
        return;
    }
    let html = step.events.map(ev => `<div class="plr-feed-item ${ev.type}">${ev.text}</div>`).join('');

    if (plrIndex > 0 && step.events.some(e => e.type === 'goal')) {
        const prev = new Map(plrData.stepRows[plrIndex - 1].map(r => [r.playerId, r.total]));
        const deltas = plrData.stepRows[plrIndex]
            .map(row => ({ pseudo: row.pseudo, delta: Math.round((row.total - (prev.get(row.playerId) || 0)) * 10) / 10 }))
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

function plrRosterColor(playerId) {
    const ids = [...plrData.roster.entries()]
        .sort((a, b) => (a[1] || '').localeCompare(b[1] || '', 'fr'))
        .map(e => e[0]);
    return PLR_COLORS[ids.indexOf(playerId) % PLR_COLORS.length] || '#95a5a6';
}

function plrRenderTable() {
    const tbody = document.querySelector('#plrTable tbody');
    if (!tbody) return;
    const rows = plrData.stepRows[plrIndex];
    if (!rows || rows.length === 0) { tbody.innerHTML = ''; return; }

    const prevRows = plrIndex > 0 ? plrData.stepRows[plrIndex - 1] : null;
    const prevRanks = {};
    const prevTotals = {};
    if (prevRows) prevRows.forEach((r, i) => { prevRanks[r.playerId] = i + 1; prevTotals[r.playerId] = r.total; });

    tbody.innerHTML = rows.map((row, i) => {
        const rank = i + 1;
        const prev = prevRows ? prevRanks[row.playerId] : rank;
        let move = '<span class="plr-move same">·</span>';
        let rowCls = '';
        if (prev && prev !== rank) {
            if (rank < prev) { move = `<span class="plr-move up">▲${prev - rank}</span>`; rowCls = 'moved-up'; }
            else { move = `<span class="plr-move down">▼${rank - prev}</span>`; rowCls = 'moved-down'; }
        }
        const delta = prevRows ? Math.round((row.total - (prevTotals[row.playerId] || 0)) * 10) / 10 : 0;
        const deltaHtml = delta !== 0
            ? `<span class="plr-pts-delta ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : ''}${delta}</span>` : '';
        const bonuses = plrFormatParts(row.parts);
        const isMe = typeof currentPlayer !== 'undefined' && currentPlayer && currentPlayer.id === row.playerId;
        return `
            <tr class="${rowCls}${isMe ? ' plr-me' : ''}">
                <td class="pos">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</td>
                <td class="move">${move}</td>
                <td class="pseudo"><span class="plr-dot-color" style="background:${plrRosterColor(row.playerId)}"></span>${row.pseudo}</td>
                <td class="pts"><strong>${row.total}</strong> ${deltaHtml}</td>
                <td class="base">${row.base}</td>
                <td class="bonuses">${bonuses || '—'}</td>
            </tr>
        `;
    }).join('');
}

// Graphe des points cumulés : une courbe par pronostiqueur, dessinée
// jusqu'au pas courant — elle avance au rythme de la frise. L'axe X est
// l'index des événements : pas de temps morts entre matchs ni journées.
function plrRenderChart() {
    const container = document.getElementById('plrChart');
    if (!container || !plrData) return;
    const { steps, stepRows, roster } = plrData;
    if (roster.size === 0 || steps.length < 2) { container.innerHTML = ''; return; }

    const W = 680, H = 240;
    const padL = 36, padR = 60, padT = 12, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = steps.length - 1;
    const maxY = Math.max(1, ...stepRows[stepRows.length - 1].map(r => r.total));
    const xOf = i => padL + (i / n) * plotW;
    const yOf = v => padT + plotH - (v / maxY) * plotH;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="plr-chart-svg" role="img" aria-label="Points cumulés des pronostiqueurs">`;

    // Grille horizontale (4 niveaux)
    for (let g = 0; g <= 4; g++) {
        const v = (maxY / 4) * g;
        const y = yOf(v);
        svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="plr-grid"/>`;
        svg += `<text x="${padL - 5}" y="${y + 3}" text-anchor="end" class="plr-axis">${Math.round(v)}</text>`;
    }

    // Marqueurs de journées (1er pas contenant un événement de la journée)
    if (plrData.days.length > 1) {
        plrData.days.forEach(day => {
            const idx = steps.findIndex(s => s.events.some(e => e.day === day));
            if (idx < 1) return;
            const x = xOf(idx);
            svg += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" class="plr-day-line"/>`;
            svg += `<text x="${x + 3}" y="${H - padB + 12}" class="plr-axis">J${day}</text>`;
        });
    }

    // Une courbe par joueur, tracée jusqu'au pas courant
    const playerIds = [...roster.keys()];
    const upTo = plrIndex;
    playerIds.forEach(playerId => {
        const color = plrRosterColor(playerId);
        let path = '';
        for (let i = 0; i <= upTo; i++) {
            const row = plrData.stepRows[i].find(r => r.playerId === playerId);
            const v = row ? row.total : 0;
            path += `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)} `;
        }
        svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" opacity="0.9"/>`;
        // Point courant + pseudo
        const cur = plrData.stepRows[upTo].find(r => r.playerId === playerId);
        const cx = xOf(upTo), cy = yOf(cur ? cur.total : 0);
        svg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.2" fill="${color}"/>`;
        svg += `<text x="${(cx + 5).toFixed(1)}" y="${(cy + 3).toFixed(1)}" class="plr-chart-label" fill="${color}">${roster.get(playerId)} ${cur ? cur.total : 0}</text>`;
    });

    svg += '</svg>';
    container.innerHTML = svg;
}

function plrRenderTimeline() {
    const container = document.getElementById('plrTimeline');
    if (!container || !plrData) return;
    const steps = plrData.steps;
    if (steps.length < 2) { container.innerHTML = ''; return; }

    // Plage multi-journées : chips J1, J2… (des centaines de points seraient
    // illisibles) ; journée seule : un point par événement
    if (plrData.days.length > 1) {
        container.className = 'plr-timeline chips';
        container.innerHTML = plrData.days.map(day => {
            const idx = steps.findIndex(s => s.events.some(e => e.day === day));
            return `<button class="plr-day-chip" data-step="${idx}"
                            onclick="plrStop(); plrSetIndex(${idx})">J${day}</button>`;
        }).join('');
        return;
    }

    container.className = 'plr-timeline';
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
    const chips = [...document.querySelectorAll('#plrTimeline .plr-day-chip')];
    chips.forEach((chip, i) => {
        const startIdx = parseInt(chip.dataset.step);
        const nextIdx = i + 1 < chips.length ? parseInt(chips[i + 1].dataset.step) : Infinity;
        chip.classList.toggle('done', plrIndex >= startIdx);
        chip.classList.toggle('current', plrIndex >= startIdx && plrIndex < nextIdx);
    });
}

function plrTogglePlay() {
    if (plrTimer) { plrStop(); return; }
    if (!plrData) return;
    if (plrIndex >= plrData.steps.length - 1) plrSetIndex(0);
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
    ['plrFeed', 'plrTimeline', 'plrChart'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    const tbody = document.querySelector('#plrTable tbody');
    if (tbody) tbody.innerHTML = '';
    const clock = document.getElementById('plrClock');
    if (clock) clock.textContent = '—';
}
