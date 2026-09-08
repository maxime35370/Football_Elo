// matchday-replay.js - Multiplex : le film de la journée
// Rejoue une journée but par but, à l'heure réelle de chaque événement :
// heure du coup d'envoi + minute de jeu (+ 15 min de pause pour les buts
// de 2ème mi-temps : un but à la 60' d'un match de 18h a lieu à 19h15).
// Le classement est recalculé à chaque événement, comme un multiplex.

const REPLAY_HALFTIME_BREAK_MIN = 15;   // Pause entre les deux mi-temps
const REPLAY_DEFAULT_KICKOFF = 'T17:00:00'; // Matchs sans heure connue
const REPLAY_MATCH_DURATION_MIN = 90 + REPLAY_HALFTIME_BREAK_MIN;

let replayData = null;      // { steps, dayMatches, baselinePos, estimatedCount }
let replayIndex = 0;
let replayTimer = null;
let replayPrevPositions = null; // positions du pas précédent (flèches)

document.addEventListener('DOMContentLoaded', () => {
    // La page classements charge ses données de façon asynchrone : on
    // initialise après un court délai puis on suit les mêmes signaux qu'elle
    setTimeout(initMatchdayReplay, 400);
    window.addEventListener('firebaseSyncComplete', () => {
        setTimeout(initMatchdayReplay, 200);
    });
    document.getElementById('seasonSelect')?.addEventListener('change', () => {
        setTimeout(initMatchdayReplay, 100);
    });
});

function replaySeason() {
    const seasonSelect = document.getElementById('seasonSelect');
    return (seasonSelect && seasonSelect.value) || getCurrentSeason();
}

function initMatchdayReplay() {
    const select = document.getElementById('replayMatchDay');
    if (!select) return;

    const season = replaySeason();
    const played = getStoredMatches().filter(m => m.season === season && m.finalScore);
    const days = [...new Set(played.map(m => m.matchDay || 0))].filter(d => d > 0).sort((a, b) => a - b);

    if (days.length === 0) {
        select.innerHTML = '<option value="">Aucune journée jouée</option>';
        replayStop();
        replayData = null;
        renderReplayEmpty('Aucune journée jouée pour cette saison.');
        return;
    }

    const previous = parseInt(select.value);
    select.innerHTML = days.map(d => `<option value="${d}">Journée ${d}</option>`).join('');
    // Journée par défaut : la dernière jouée (ou celle déjà choisie)
    select.value = days.includes(previous) ? previous : days[days.length - 1];

    select.onchange = () => loadReplayMatchDay(parseInt(select.value));
    document.getElementById('replayPlayBtn')?.addEventListener('click', replayTogglePlay);
    document.getElementById('replaySlider')?.addEventListener('input', function() {
        replayStop();
        replaySetIndex(parseInt(this.value));
    });

    loadReplayMatchDay(parseInt(select.value));
}

// Heure réelle d'un but : coup d'envoi + minute (+ pause si 2ème mi-temps).
// Le temps additionnel s'ajoute (45+3 → coup d'envoi + 48 min).
function replayGoalRealTime(kickoff, goal) {
    const minute = parseInt(goal.minute) || 0;
    const extra = parseInt(goal.extraTime) || 0;
    const offset = minute <= 45
        ? minute + extra
        : REPLAY_HALFTIME_BREAK_MIN + minute + extra;
    return new Date(kickoff.getTime() + offset * 60000);
}

function loadReplayMatchDay(matchDay) {
    replayStop();
    const season = replaySeason();
    const seasonMatches = getStoredMatches().filter(m => m.season === season && m.finalScore);
    const dayMatchesRaw = seasonMatches.filter(m => (m.matchDay || 0) === matchDay);

    if (dayMatchesRaw.length === 0) {
        replayData = null;
        renderReplayEmpty('Aucun match joué pour cette journée.');
        return;
    }

    let estimatedCount = 0;
    const dayMatches = dayMatchesRaw.map(m => {
        let kickoff;
        if (m.scheduledAt) {
            kickoff = new Date(m.scheduledAt);
        } else {
            kickoff = new Date(`${m.date}${REPLAY_DEFAULT_KICKOFF}`);
            estimatedCount++;
        }
        const goals = (m.goals || [])
            .map(g => ({ ...g, realTime: replayGoalRealTime(kickoff, g) }))
            .sort((a, b) => a.realTime - b.realTime);
        const lastGoal = goals.length ? goals[goals.length - 1].realTime.getTime() : 0;
        const end = new Date(Math.max(
            kickoff.getTime() + REPLAY_MATCH_DURATION_MIN * 60000,
            lastGoal + 60000
        ));
        return { match: m, kickoff, goals, end };
    });

    // Événements de la journée, en ordre chronologique réel
    const events = [];
    dayMatches.forEach(dm => {
        const home = getTeamById(dm.match.homeTeamId);
        const away = getTeamById(dm.match.awayTeamId);
        const label = `${home ? home.shortName : '?'} - ${away ? away.shortName : '?'}`;
        events.push({ t: dm.kickoff, type: 'start', dm, text: `🟢 Coup d'envoi de ${label}` });
        dm.goals.forEach(g => {
            const team = getTeamById(g.teamId);
            const scoreAfter = replayScoreAt(dm, g.realTime);
            events.push({
                t: g.realTime, type: 'goal', dm,
                text: `⚽ ${g.displayTime || `${g.minute}'`} ${g.scorer || 'But'}${team ? ` (${team.shortName})` : ''} — ${home ? home.shortName : '?'} ${scoreAfter.home}-${scoreAfter.away} ${away ? away.shortName : '?'}`
            });
        });
        events.push({
            t: dm.end, type: 'end', dm,
            text: `🏁 Fin de ${label} : ${dm.match.finalScore.home}-${dm.match.finalScore.away}`
        });
    });
    events.sort((a, b) => a.t - b.t);

    // Pas de lecture : un pas initial « avant la journée », puis un pas par
    // horodatage distinct (plusieurs buts simultanés = un seul pas)
    const steps = [{ t: new Date(dayMatches.reduce((min, dm) => Math.min(min, dm.kickoff.getTime()), Infinity) - 60000), events: [] }];
    events.forEach(ev => {
        const last = steps[steps.length - 1];
        if (last.events.length > 0 && last.t.getTime() === ev.t.getTime()) {
            last.events.push(ev);
        } else {
            steps.push({ t: ev.t, events: [ev] });
        }
    });

    // Classement de départ : la saison sans les matchs de cette journée
    const otherMatches = seasonMatches.filter(m => (m.matchDay || 0) !== matchDay);
    const baseline = replayComputeTable(otherMatches, []);
    const baselinePos = {};
    baseline.forEach((row, i) => { baselinePos[row.id] = i + 1; });

    replayData = { steps, dayMatches, otherMatches, baselinePos, estimatedCount, matchDay };

    const slider = document.getElementById('replaySlider');
    if (slider) {
        slider.max = steps.length - 1;
        slider.value = 0;
    }
    renderReplayTimeline();

    const note = document.getElementById('replayNote');
    if (note) {
        note.textContent = estimatedCount > 0
            ? `⚠️ ${estimatedCount} match(s) sans heure de coup d'envoi : 17h00 utilisé par défaut.`
            : '';
    }

    replayPrevPositions = null;
    replaySetIndex(0);
}

// Score d'un match à un instant t (buts crédités par équipe, CSC compris)
function replayScoreAt(dm, t) {
    let home = 0, away = 0;
    dm.goals.forEach(g => {
        if (g.realTime > t) return;
        if (String(g.teamId) === String(dm.match.homeTeamId)) home++;
        else if (String(g.teamId) === String(dm.match.awayTeamId)) away++;
    });
    return { home, away };
}

// Classement par points à partir de matchs terminés + scores en direct.
// Mêmes règles que generateRanking : points, différence, buts marqués.
function replayComputeTable(finishedMatches, liveEntries) {
    const season = replaySeason();
    const teams = (typeof getTeamsBySeason === 'function') ? getTeamsBySeason(season) : getStoredTeams();
    const stats = {};
    teams.forEach(t => {
        stats[t.id] = { id: t.id, team: t, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
    });

    const addResult = (homeId, awayId, home, away) => {
        const h = stats[homeId], a = stats[awayId];
        if (h) {
            h.played++;
            h.goalsFor += home; h.goalsAgainst += away;
            h.points += home > away ? 3 : home === away ? 1 : 0;
        }
        if (a) {
            a.played++;
            a.goalsFor += away; a.goalsAgainst += home;
            a.points += away > home ? 3 : home === away ? 1 : 0;
        }
    };

    finishedMatches.forEach(m => addResult(m.homeTeamId, m.awayTeamId, m.finalScore.home, m.finalScore.away));
    liveEntries.forEach(e => addResult(e.homeTeamId, e.awayTeamId, e.home, e.away));

    const rows = Object.values(stats);
    rows.forEach(r => { r.goalDifference = r.goalsFor - r.goalsAgainst; });
    rows.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
        if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
        return (a.team.name || '').localeCompare(b.team.name || '', 'fr');
    });
    return rows;
}

function replaySetIndex(index) {
    if (!replayData) return;
    replayIndex = Math.max(0, Math.min(index, replayData.steps.length - 1));
    if (replayIndex === 0) replayPrevPositions = null; // pas de flèches au départ

    const slider = document.getElementById('replaySlider');
    if (slider) slider.value = replayIndex;

    const step = replayData.steps[replayIndex];
    const t = step.t;

    // Horloge : « ven. 22 août — 19h15 »
    const clock = document.getElementById('replayClock');
    if (clock) {
        const day = t.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        const time = `${t.getHours()}h${String(t.getMinutes()).padStart(2, '0')}`;
        clock.textContent = replayIndex === 0 ? `${day} — avant les matchs` : `${day} — ${time}`;
    }

    // État de chaque match à l'instant t
    const liveEntries = [];
    const matchStates = replayData.dayMatches.map(dm => {
        const started = t >= dm.kickoff;
        const finished = t >= dm.end;
        const score = started ? replayScoreAt(dm, t) : null;
        if (started) {
            liveEntries.push({ homeTeamId: dm.match.homeTeamId, awayTeamId: dm.match.awayTeamId, home: score.home, away: score.away });
        }
        return { dm, started, finished, score };
    });

    const table = replayComputeTable(replayData.otherMatches, liveEntries);

    renderReplayMatches(matchStates, t);
    renderReplayFeed(step);
    renderReplayTable(table);
    highlightReplayTimeline();

    replayPrevPositions = {};
    table.forEach((row, i) => { replayPrevPositions[row.id] = i + 1; });

    // Fin de lecture : remettre le bouton en ▶️
    if (replayTimer && replayIndex >= replayData.steps.length - 1) {
        replayStop();
    }
}

// Minute de jeu affichée pour un match en cours à l'instant t.
// Entre 45' et 51' on affiche « 45+X' » (temps additionnel probable),
// ensuite « MT » jusqu'à la reprise théorique.
function replayLiveMinute(dm, t) {
    const elapsed = Math.floor((t - dm.kickoff) / 60000);
    if (elapsed <= 45) return `${Math.max(elapsed, 1)}'`;
    if (elapsed <= 51) return `45+${elapsed - 45}'`;
    if (elapsed <= 45 + REPLAY_HALFTIME_BREAK_MIN) return 'MT';
    return `${Math.min(elapsed - REPLAY_HALFTIME_BREAK_MIN, 90)}'${elapsed - REPLAY_HALFTIME_BREAK_MIN > 90 ? '+' : ''}`;
}

function renderReplayMatches(matchStates, t) {
    const container = document.getElementById('replayMatches');
    if (!container) return;

    container.innerHTML = matchStates.map(({ dm, started, finished, score }) => {
        const home = getTeamById(dm.match.homeTeamId);
        const away = getTeamById(dm.match.awayTeamId);
        let status, scoreHtml, cls;
        if (!started) {
            const time = `${dm.kickoff.getHours()}h${String(dm.kickoff.getMinutes()).padStart(2, '0')}`;
            status = `🕐 ${time}`;
            scoreHtml = '<span class="replay-score upcoming">- : -</span>';
            cls = 'upcoming';
        } else if (finished) {
            status = '✅ Terminé';
            scoreHtml = `<span class="replay-score">${score.home} : ${score.away}</span>`;
            cls = 'finished';
        } else {
            status = `🔴 ${replayLiveMinute(dm, t)}`;
            scoreHtml = `<span class="replay-score live">${score.home} : ${score.away}</span>`;
            cls = 'live';
        }
        return `
            <div class="replay-match ${cls}">
                <span class="replay-match-status">${status}</span>
                <span class="replay-match-teams">
                    <span class="home">${home ? home.shortName : '?'}</span>
                    ${scoreHtml}
                    <span class="away">${away ? away.shortName : '?'}</span>
                </span>
            </div>
        `;
    }).join('');
}

function renderReplayFeed(step) {
    const feed = document.getElementById('replayFeed');
    if (!feed) return;
    if (step.events.length === 0) {
        feed.innerHTML = '<div class="replay-feed-item muted">La journée n\'a pas encore commencé…</div>';
        return;
    }
    feed.innerHTML = step.events.map(ev =>
        `<div class="replay-feed-item ${ev.type}">${ev.text}</div>`
    ).join('');
}

function renderReplayTable(table) {
    const tbody = document.querySelector('#replayTable tbody');
    if (!tbody) return;

    tbody.innerHTML = table.map((row, i) => {
        const pos = i + 1;
        const prev = replayPrevPositions ? replayPrevPositions[row.id] : pos;
        const base = replayData.baselinePos[row.id] || pos;

        // Flèche : mouvement depuis l'événement précédent
        let move = '<span class="replay-move same">·</span>';
        let rowCls = '';
        if (prev && prev !== pos) {
            if (pos < prev) { move = `<span class="replay-move up">▲${prev - pos}</span>`; rowCls = 'moved-up'; }
            else { move = `<span class="replay-move down">▼${pos - prev}</span>`; rowCls = 'moved-down'; }
        }

        // Bilan depuis le début de la journée
        let dayDelta = '';
        if (base !== pos) {
            dayDelta = pos < base
                ? `<span class="replay-daydelta up">+${base - pos}</span>`
                : `<span class="replay-daydelta down">−${pos - base}</span>`;
        }

        return `
            <tr class="${rowCls}">
                <td class="pos">${pos}</td>
                <td class="move">${move}</td>
                <td class="team">${row.team.shortName || row.team.name} ${dayDelta}</td>
                <td>${row.played}</td>
                <td class="pts"><strong>${row.points}</strong></td>
                <td>${row.goalDifference > 0 ? '+' : ''}${row.goalDifference}</td>
                <td>${row.goalsFor}</td>
            </tr>
        `;
    }).join('');
}

// Frise chronologique : un point par événement, positionné à l'heure réelle
function renderReplayTimeline() {
    const container = document.getElementById('replayTimeline');
    if (!container || !replayData) return;

    const steps = replayData.steps;
    if (steps.length < 2) { container.innerHTML = ''; return; }

    const t0 = steps[0].t.getTime();
    const t1 = steps[steps.length - 1].t.getTime();
    const span = Math.max(t1 - t0, 1);

    container.innerHTML = steps.map((step, i) => {
        if (i === 0) return '';
        const pct = ((step.t.getTime() - t0) / span) * 100;
        const type = step.events.some(e => e.type === 'goal') ? 'goal'
            : step.events.some(e => e.type === 'start') ? 'start' : 'end';
        const icon = type === 'goal' ? '⚽' : type === 'start' ? '🟢' : '🏁';
        const time = `${step.t.getHours()}h${String(step.t.getMinutes()).padStart(2, '0')}`;
        const titles = step.events.map(e => e.text).join('\n');
        return `<button class="replay-dot ${type}" style="left:${pct}%" data-step="${i}"
                        title="${time}\n${titles.replace(/"/g, '&quot;')}"
                        onclick="replayStop(); replaySetIndex(${i})">${icon}</button>`;
    }).join('');
}

function highlightReplayTimeline() {
    document.querySelectorAll('#replayTimeline .replay-dot').forEach(dot => {
        const stepIdx = parseInt(dot.dataset.step);
        dot.classList.toggle('done', stepIdx <= replayIndex);
        dot.classList.toggle('current', stepIdx === replayIndex);
    });
}

function replayTogglePlay() {
    if (replayTimer) { replayStop(); return; }
    if (!replayData) return;

    // Repartir du début si on est à la fin
    if (replayIndex >= replayData.steps.length - 1) {
        replayPrevPositions = null;
        replaySetIndex(0);
    }

    const btn = document.getElementById('replayPlayBtn');
    if (btn) btn.textContent = '⏸️ Pause';

    const tick = () => {
        const speed = parseInt(document.getElementById('replaySpeed')?.value) || 1200;
        replayTimer = setTimeout(() => {
            replaySetIndex(replayIndex + 1);
            if (replayTimer) tick();
        }, speed);
    };
    tick();
}

function replayStop() {
    if (replayTimer) {
        clearTimeout(replayTimer);
        replayTimer = null;
    }
    const btn = document.getElementById('replayPlayBtn');
    if (btn) btn.textContent = '▶️ Lecture';
}

function renderReplayEmpty(message) {
    const container = document.getElementById('replayMatches');
    if (container) container.innerHTML = `<div class="replay-feed-item muted">${message}</div>`;
    const feed = document.getElementById('replayFeed');
    if (feed) feed.innerHTML = '';
    const tbody = document.querySelector('#replayTable tbody');
    if (tbody) tbody.innerHTML = '';
    const timeline = document.getElementById('replayTimeline');
    if (timeline) timeline.innerHTML = '';
    const clock = document.getElementById('replayClock');
    if (clock) clock.textContent = '—';
}
