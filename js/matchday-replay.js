// matchday-replay.js - Multiplex : le film de la journée (ou d'une série)
// Rejoue une plage de journées but par but, à l'heure réelle de chaque
// événement : heure du coup d'envoi + minute de jeu (+ 15 min de pause pour
// les buts de 2ème mi-temps : un but à la 60' d'un match de 18h a lieu à
// 19h15). Le classement est recalculé à chaque événement, comme un multiplex.
// Seuls les matchs joués sont inclus : une journée en cours s'arrête au
// dernier match joué — « là où on est rendu ».

const REPLAY_HALFTIME_BREAK_MIN = 15;   // Pause entre les deux mi-temps
const REPLAY_DEFAULT_KICKOFF = 'T17:00:00'; // Matchs sans heure connue
const REPLAY_MATCH_DURATION_MIN = 90 + REPLAY_HALFTIME_BREAK_MIN;

let replayData = null;      // { steps, dayMatches, otherMatches, baselinePos, days, fromDay, toDay, estimatedCount }
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
    const fromSelect = document.getElementById('replayFromDay');
    const toSelect = document.getElementById('replayToDay');
    if (!fromSelect || !toSelect) return;

    const season = replaySeason();
    const played = getStoredMatches().filter(m => m.season === season && m.finalScore);
    const days = [...new Set(played.map(m => m.matchDay || 0))].filter(d => d > 0).sort((a, b) => a - b);

    if (days.length === 0) {
        fromSelect.innerHTML = '<option value="">—</option>';
        toSelect.innerHTML = '<option value="">—</option>';
        replayStop();
        replayData = null;
        renderReplayEmpty('Aucune journée jouée pour cette saison.');
        return;
    }

    const prevFrom = parseInt(fromSelect.value);
    const prevTo = parseInt(toSelect.value);
    const options = days.map(d => `<option value="${d}">J${d}</option>`).join('');
    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;

    // Par défaut : la dernière journée jouée (ou la plage déjà choisie)
    const last = days[days.length - 1];
    fromSelect.value = days.includes(prevFrom) ? prevFrom : last;
    toSelect.value = days.includes(prevTo) && prevTo >= parseInt(fromSelect.value) ? prevTo : Math.max(parseInt(fromSelect.value), last);
    if (parseInt(toSelect.value) < parseInt(fromSelect.value)) toSelect.value = fromSelect.value;

    // onclick/onchange (pas addEventListener) : initMatchdayReplay se relance
    // après la synchro Firebase, des écouteurs cumulés doublaient les actions
    // (deux toggles = la lecture ne démarrait pas)
    const reload = () => loadReplayRange(parseInt(fromSelect.value), parseInt(toSelect.value));
    fromSelect.onchange = () => {
        if (parseInt(fromSelect.value) > parseInt(toSelect.value)) toSelect.value = fromSelect.value;
        reload();
    };
    toSelect.onchange = () => {
        if (parseInt(toSelect.value) < parseInt(fromSelect.value)) fromSelect.value = toSelect.value;
        reload();
    };
    const seasonBtn = document.getElementById('replaySeasonBtn');
    if (seasonBtn) seasonBtn.onclick = () => {
        fromSelect.value = days[0];
        toSelect.value = last;
        reload();
    };
    const playBtn = document.getElementById('replayPlayBtn');
    if (playBtn) playBtn.onclick = replayTogglePlay;
    const slider = document.getElementById('replaySlider');
    if (slider) slider.oninput = function() {
        replayStop();
        replaySetIndex(parseInt(this.value));
    };
    const occMode = document.getElementById('replayOccMode');
    if (occMode) occMode.onchange = renderReplayOccupancy;
    const posTeam = document.getElementById('replayPosTeam');
    if (posTeam) posTeam.onchange = () => renderReplayPosChart();

    reload();
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

// Compatibilité : rejouer une seule journée
function loadReplayMatchDay(matchDay) {
    loadReplayRange(matchDay, matchDay);
}

function loadReplayRange(fromDay, toDay) {
    replayStop();
    const season = replaySeason();
    const seasonMatches = getStoredMatches().filter(m => m.season === season && m.finalScore);
    const rangeMatchesRaw = seasonMatches.filter(m => {
        const d = m.matchDay || 0;
        return d >= fromDay && d <= toDay;
    });

    if (rangeMatchesRaw.length === 0) {
        replayData = null;
        renderReplayEmpty('Aucun match joué sur cette plage de journées.');
        return;
    }

    let estimatedCount = 0;
    const dayMatches = rangeMatchesRaw.map(m => {
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

    // Événements de la plage, en ordre chronologique réel
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

    // Pas de lecture : un pas initial « avant la plage », puis un pas par
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

    // Classement de départ : la saison AVANT la plage rejouée
    const otherMatches = seasonMatches.filter(m => (m.matchDay || 0) < fromDay);
    const baseline = replayComputeTable(otherMatches, []);
    const baselinePos = {};
    baseline.forEach((row, i) => { baselinePos[row.id] = i + 1; });
    const baselineOrder = baseline.map(row => row.id);

    const days = [...new Set(rangeMatchesRaw.map(m => m.matchDay || 0))].sort((a, b) => a - b);
    replayData = { steps, dayMatches, otherMatches, baselinePos, baselineOrder, estimatedCount, fromDay, toDay, days, matchDay: toDay };

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
    renderReplayOccupancy();
}

// Temps passé par chaque équipe à chaque place du classement.
// Deux modes de comptage :
//  - 'real' : chaque intervalle entre deux événements pèse sa durée réelle —
//    les jours entre deux journées comptent pour la place occupée à ce
//    moment-là (« 12 jours en tête »)
//  - 'live' : seuls les intervalles où au moins un match de la plage est en
//    cours comptent — entre la fin du dernier match du dimanche et le coup
//    d'envoi du vendredi, le classement ne bouge pas, on ne compte rien
// Retourne, par équipe : répartition, place moyenne, place médiane, place la
// plus occupée.
function replayComputeOccupancy(mode) {
    const steps = replayData.steps;
    const occupancy = {}; // teamId -> { pos -> ms }

    // Le pas 0 (« avant les matchs ») est ignoré : la mesure démarre au
    // premier coup d'envoi et s'arrête au dernier événement de la plage
    for (let i = 1; i < steps.length - 1; i++) {
        const t = steps[i].t;
        const duration = steps[i + 1].t - t;
        if (duration <= 0) continue;

        // L'ensemble des matchs en cours est constant sur tout l'intervalle
        // (les coups d'envoi et fins de match sont des bornes d'intervalle)
        if (mode === 'live' && !replayData.dayMatches.some(dm => dm.kickoff <= t && t < dm.end)) {
            continue;
        }

        const liveEntries = [];
        replayData.dayMatches.forEach(dm => {
            if (t >= dm.kickoff) {
                const s = replayScoreAt(dm, t);
                liveEntries.push({ homeTeamId: dm.match.homeTeamId, awayTeamId: dm.match.awayTeamId, home: s.home, away: s.away });
            }
        });

        replayComputeTable(replayData.otherMatches, liveEntries).forEach((row, idx) => {
            const pos = idx + 1;
            if (!occupancy[row.id]) occupancy[row.id] = {};
            occupancy[row.id][pos] = (occupancy[row.id][pos] || 0) + duration;
        });
    }

    const season = replaySeason();
    const teams = (typeof getTeamsBySeason === 'function') ? getTeamsBySeason(season) : getStoredTeams();
    const nPositions = teams.length;

    const rows = teams.map(team => {
        const dist = occupancy[team.id] || {};
        const total = Object.values(dist).reduce((s, ms) => s + ms, 0);
        if (total === 0) return { team, dist, total, avg: null, median: null, mode: null };

        let weighted = 0;
        let mode = null;
        for (const [pos, ms] of Object.entries(dist)) {
            weighted += parseInt(pos) * ms;
            if (mode === null || ms > dist[mode]) mode = parseInt(pos);
        }
        // Médiane pondérée : la place où la moitié du temps est atteinte
        let cumul = 0, median = null;
        for (let pos = 1; pos <= nPositions; pos++) {
            cumul += dist[pos] || 0;
            if (cumul >= total / 2) { median = pos; break; }
        }
        return { team, dist, total, avg: weighted / total, median, mode };
    });

    rows.sort((a, b) => {
        if (a.avg === null) return 1;
        if (b.avg === null) return -1;
        if (a.avg !== b.avg) return a.avg - b.avg;
        if (a.median !== b.median) return a.median - b.median;
        return (a.team.name || '').localeCompare(b.team.name || '', 'fr');
    });
    return { rows, nPositions };
}

// Durée lisible : « 12j 5h », « 3h05 », « 47 min »
function replayFormatDuration(ms) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h${String(minutes % 60).padStart(2, '0')}`;
    const days = Math.floor(hours / 24);
    return `${days}j ${hours % 24}h`;
}

function replayOrdinal(pos) {
    return pos === 1 ? '1re' : `${pos}e`;
}

function renderReplayOccupancy() {
    const tbody = document.querySelector('#replayOccupancy tbody');
    if (!tbody || !replayData) return;

    const title = document.getElementById('replayOccupancyTitle');
    if (title) {
        const range = replayData.fromDay === replayData.toDay
            ? `journée ${replayData.toDay}`
            : `J${replayData.fromDay} → J${replayData.toDay}`;
        title.textContent = `⏱️ Temps passé à chaque place (${range})`;
    }

    const mode = document.getElementById('replayOccMode')?.value || 'real';
    const { rows, nPositions } = replayComputeOccupancy(mode);
    const zoneCfg = replayZonesConfig();

    tbody.innerHTML = rows.map(row => {
        if (row.total === 0) {
            return `<tr><td class="team">${row.team.shortName || row.team.name}</td><td colspan="5" class="occ-none">—</td></tr>`;
        }
        const modeMs = row.dist[row.mode] || 0;
        const modePct = Math.round((modeMs / row.total) * 100);

        // Répartition : une cellule par place, intensité = part du temps
        let cells = '';
        for (let pos = 1; pos <= nPositions; pos++) {
            const ms = row.dist[pos] || 0;
            const share = ms / row.total;
            const pct = Math.round(share * 100);
            const tip = ms > 0
                ? `${replayOrdinal(pos)} : ${replayFormatDuration(ms)} (${pct}%)`
                : `${replayOrdinal(pos)} : jamais`;
            const opacity = ms > 0 ? Math.max(0.15, share) : 0;
            cells += `<span class="occ-cell${ms > 0 ? '' : ' empty'}" style="--occ:${opacity}" title="${tip}"></span>`;
        }

        // Temps par zone : barre empilée titre / Europe / ventre mou / relégation
        const zoneMs = { title: 0, europe: 0, mid: 0, releg: 0 };
        for (const [pos, ms] of Object.entries(row.dist)) {
            zoneMs[replayZoneOf(parseInt(pos), nPositions, zoneCfg)] += ms;
        }
        const zoneBar = ['title', 'europe', 'mid', 'releg'].map(z => {
            const ms = zoneMs[z];
            if (ms <= 0) return '';
            const pct = (ms / row.total) * 100;
            const meta = REPLAY_ZONE_META[z];
            return `<span class="zone-seg" style="width:${pct.toFixed(2)}%;background:${meta.color}"
                          title="${meta.label} : ${replayFormatDuration(ms)} (${Math.round(pct)}%)"></span>`;
        }).join('');

        return `
            <tr>
                <td class="team">${row.team.shortName || row.team.name}</td>
                <td class="occ-avg"><strong>${row.avg.toFixed(1).replace('.', ',')}</strong></td>
                <td>${replayOrdinal(row.median)}</td>
                <td>${replayOrdinal(row.mode)} <span class="occ-pct">(${modePct}%)</span></td>
                <td class="occ-dist"><span class="occ-cells" aria-label="Répartition du temps par place">${cells}</span></td>
                <td class="occ-zones"><span class="zone-bar" aria-label="Temps par zone">${zoneBar}</span></td>
            </tr>
        `;
    }).join('');

    const intervals = replayScanIntervals(mode);
    renderReplayThreads(intervals);
    renderReplayImpacts(intervals);
    renderReplayPosChart(rows);
}

// ===============================
// Fil des leaders, zones, buts à impact
// ===============================

// Palette stable par équipe (indexée sur l'ordre alphabétique de la saison)
const REPLAY_TEAM_COLORS = [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c',
    '#e67e22', '#34495e', '#16a085', '#c0392b', '#2980b9', '#8e44ad',
    '#27ae60', '#d35400', '#7f8c8d', '#f1c40f', '#5d6d7e', '#af7ac5'
];

function replaySeasonTeamsAlpha() {
    const season = replaySeason();
    return ((typeof getTeamsBySeason === 'function') ? getTeamsBySeason(season) : getStoredTeams())
        .slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
}

function replayTeamColor(teamId) {
    const idx = replaySeasonTeamsAlpha().findIndex(t => String(t.id) === String(teamId));
    return REPLAY_TEAM_COLORS[idx % REPLAY_TEAM_COLORS.length] || '#95a5a6';
}

// Zones du championnat (mêmes règles que le classement traditionnel)
function replayZonesConfig() {
    const cfg = (typeof getSeasonConfig === 'function') ? getSeasonConfig() : {};
    return {
        championPlaces: cfg.championPlaces || 1,
        europeanPlaces: cfg.europeanPlaces || 3,
        relegationPlaces: cfg.relegationPlaces || 2
    };
}

function replayZoneOf(pos, nPositions, cfg) {
    if (pos <= cfg.championPlaces) return 'title';
    if (pos <= cfg.europeanPlaces) return 'europe';
    if (nPositions >= 6 && pos > nPositions - cfg.relegationPlaces) return 'releg';
    return 'mid';
}

const REPLAY_ZONE_META = {
    title: { label: '🏆 Titre', color: '#f1c40f' },
    europe: { label: '⭐ Europe', color: '#3498db' },
    mid: { label: 'Ventre mou', color: '#cbd5e0' },
    releg: { label: '🛡️ Relégation', color: '#e74c3c' }
};

// Scan partagé de la timeline : pour chaque pas, l'ordre du classement et le
// poids de l'intervalle qui le suit (0 si non compté dans le mode choisi)
function replayScanIntervals(mode) {
    const steps = replayData.steps;
    const intervals = [];
    for (let i = 1; i < steps.length; i++) {
        const t = steps[i].t;
        const liveEntries = [];
        replayData.dayMatches.forEach(dm => {
            if (t >= dm.kickoff) {
                const s = replayScoreAt(dm, t);
                liveEntries.push({ homeTeamId: dm.match.homeTeamId, awayTeamId: dm.match.awayTeamId, home: s.home, away: s.away });
            }
        });
        const order = replayComputeTable(replayData.otherMatches, liveEntries).map(r => r.id);
        const next = i + 1 < steps.length ? steps[i + 1].t : null;
        let w = next ? next - t : 0;
        if (w > 0 && mode === 'live' && !replayData.dayMatches.some(dm => dm.kickoff <= t && t < dm.end)) w = 0;
        intervals.push({ t, w, order, events: steps[i].events });
    }
    return intervals;
}

// Frises « qui était en tête / lanterne rouge » : segments fusionnés par
// équipe, largeur = part du temps compté
function renderReplayThreads(intervals) {
    const build = (containerId, pickTeam) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const segments = [];
        intervals.forEach(iv => {
            if (iv.w <= 0 || iv.order.length === 0) return;
            const teamId = pickTeam(iv.order);
            const last = segments[segments.length - 1];
            if (last && String(last.teamId) === String(teamId)) {
                last.w += iv.w;
            } else {
                segments.push({ teamId, w: iv.w, from: iv.t });
            }
        });
        const total = segments.reduce((s, seg) => s + seg.w, 0);
        if (total <= 0) { container.innerHTML = ''; return; }
        container.innerHTML = segments.map(seg => {
            const team = getTeamById(seg.teamId);
            const name = team ? team.shortName : '?';
            const pct = (seg.w / total) * 100;
            const from = seg.from.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            return `<span class="thread-seg" style="width:${pct.toFixed(2)}%;background:${replayTeamColor(seg.teamId)}"
                          title="${name} : ${replayFormatDuration(seg.w)} (à partir de ${from})">${pct > 5 ? name : ''}</span>`;
        }).join('');
    };
    build('replayLeaderThread', order => order[0]);
    build('replayLastThread', order => order[order.length - 1]);
}

// Les buts qui ont tout changé : pour chaque pas contenant au moins un but,
// mouvements de places entre l'avant et l'après, changement de leader et
// entrées/sorties de zones
function replayComputeGoalImpacts(intervals) {
    const cfg = replayZonesConfig();
    const nPositions = (replayData.baselineOrder || []).length || intervals[0]?.order.length || 0;
    const posMap = order => { const m = {}; order.forEach((id, i) => { m[id] = i + 1; }); return m; };

    let prevOrder = replayData.baselineOrder || (intervals[0] ? intervals[0].order : []);
    const impacts = [];

    intervals.forEach(iv => {
        const goalEvents = iv.events.filter(e => e.type === 'goal');
        if (goalEvents.length > 0) {
            const before = posMap(prevOrder), after = posMap(iv.order);
            let moves = 0;
            const zoneEvents = [];
            iv.order.forEach(id => {
                const pb = before[id], pa = after[id];
                if (pb === undefined || pa === undefined) return;
                moves += Math.abs(pb - pa);
                const zb = replayZoneOf(pb, nPositions, cfg), za = replayZoneOf(pa, nPositions, cfg);
                if (zb !== za) {
                    const team = getTeamById(id);
                    const name = team ? team.shortName : '?';
                    // Seuls les franchissements de la ligne Europe et de la
                    // ligne rouge sont signalés (titre↔Europe = badge leader)
                    if (za === 'releg') zoneEvents.push(`🔻 ${name} tombe en zone rouge`);
                    else if (zb === 'releg') zoneEvents.push(`🟢 ${name} sort de la zone rouge`);
                    else if (zb === 'mid' && (za === 'europe' || za === 'title')) zoneEvents.push(`⭐ ${name} entre dans les places européennes`);
                    else if (za === 'mid' && (zb === 'europe' || zb === 'title')) zoneEvents.push(`↘️ ${name} quitte les places européennes`);
                }
            });
            const leaderChanged = String(iv.order[0]) !== String(prevOrder[0]);
            const newLeader = leaderChanged ? getTeamById(iv.order[0]) : null;
            if (moves > 0 || leaderChanged || zoneEvents.length > 0) {
                impacts.push({
                    t: iv.t,
                    goals: goalEvents.map(e => e.text),
                    moves, leaderChanged,
                    newLeader: newLeader ? newLeader.shortName : null,
                    zoneEvents
                });
            }
        }
        prevOrder = iv.order;
    });

    impacts.sort((a, b) => {
        if (a.leaderChanged !== b.leaderChanged) return a.leaderChanged ? -1 : 1;
        if (a.moves !== b.moves) return b.moves - a.moves;
        return a.t - b.t;
    });
    return impacts;
}

function renderReplayImpacts(intervals) {
    const list = document.getElementById('replayImpacts');
    if (!list) return;

    const impacts = replayComputeGoalImpacts(intervals).slice(0, 10);
    if (impacts.length === 0) {
        list.innerHTML = '<li class="replay-feed-item muted">Aucun but n\'a fait bouger le classement sur cette plage.</li>';
        return;
    }

    list.innerHTML = impacts.map(imp => {
        const day = imp.t.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        const time = `${imp.t.getHours()}h${String(imp.t.getMinutes()).padStart(2, '0')}`;
        const badges = [];
        if (imp.leaderChanged) badges.push(`<span class="impact-badge leader">👑 ${imp.newLeader} prend la tête</span>`);
        if (imp.moves > 0) badges.push(`<span class="impact-badge moves">↕️ ${imp.moves} place${imp.moves > 1 ? 's' : ''} bougée${imp.moves > 1 ? 's' : ''}</span>`);
        imp.zoneEvents.slice(0, 3).forEach(z => badges.push(`<span class="impact-badge zone">${z}</span>`));
        return `
            <li class="impact-item">
                <div class="impact-when">${day} ${time}</div>
                <div class="impact-goals">${imp.goals.join('<br>')}</div>
                <div class="impact-badges">${badges.join(' ')}</div>
            </li>
        `;
    }).join('');
}

// Séries pour le graphique d'une équipe : place réelle à chaque instant,
// moyenne cumulée (pondérée par le temps) et médiane cumulée. L'axe X est le
// temps COMPTABILISÉ selon le mode : en « pendant les matchs », les trous
// entre matchs sont retirés de l'axe (la courbe ne s'étire pas sur du vide).
function replayComputePositionSeries(teamId, mode) {
    const steps = replayData.steps;
    const season = replaySeason();
    const teams = (typeof getTeamsBySeason === 'function') ? getTeamsBySeason(season) : getStoredTeams();
    const nPositions = teams.length;

    const posSeries = [];  // intervalles {x0, x1, pos, t}
    const avgSeries = [];  // {x, avg, med} après chaque intervalle compté
    const dayMarkers = []; // {x, day} au 1er coup d'envoi de chaque journée
    const seenDays = new Set();
    const dist = {};
    let counted = 0, weighted = 0, x = 0;

    for (let i = 1; i < steps.length; i++) {
        const t = steps[i].t;

        steps[i].events.forEach(ev => {
            if (ev.type === 'start') {
                const day = ev.dm.match.matchDay || 0;
                if (!seenDays.has(day)) { seenDays.add(day); dayMarkers.push({ x, day }); }
            }
        });

        const liveEntries = [];
        replayData.dayMatches.forEach(dm => {
            if (t >= dm.kickoff) {
                const s = replayScoreAt(dm, t);
                liveEntries.push({ homeTeamId: dm.match.homeTeamId, awayTeamId: dm.match.awayTeamId, home: s.home, away: s.away });
            }
        });
        const table = replayComputeTable(replayData.otherMatches, liveEntries);
        const pos = table.findIndex(r => String(r.id) === String(teamId)) + 1;
        if (pos === 0) continue; // équipe hors saison

        const next = i + 1 < steps.length ? steps[i + 1].t : null;
        let w = next ? next - t : 0;
        if (mode === 'live' && !replayData.dayMatches.some(dm => dm.kickoff <= t && t < dm.end)) w = 0;
        if (w <= 0) continue;

        posSeries.push({ x0: x, x1: x + w, pos, t });
        counted += w;
        weighted += pos * w;
        dist[pos] = (dist[pos] || 0) + w;
        let cumul = 0, med = null;
        for (let p = 1; p <= nPositions; p++) {
            cumul += dist[p] || 0;
            if (cumul >= counted / 2) { med = p; break; }
        }
        x += w;
        avgSeries.push({ x, avg: weighted / counted, med });
    }

    return { posSeries, avgSeries, dayMarkers, total: x, nPositions };
}

// Graphique SVG : place réelle en marches (gris), moyenne cumulée en ligne
// pleine (bleu), médiane cumulée en pointillé (orange)
function renderReplayPosChart(occRows) {
    const container = document.getElementById('replayPosChart');
    const select = document.getElementById('replayPosTeam');
    if (!container || !select || !replayData) return;

    // Peupler le sélecteur (ordre alphabétique), conserver la sélection ;
    // par défaut : l'équipe à la meilleure place moyenne
    const season = replaySeason();
    const teams = ((typeof getTeamsBySeason === 'function') ? getTeamsBySeason(season) : getStoredTeams())
        .slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    const previous = select.value;
    select.innerHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    if (previous && teams.some(t => String(t.id) === previous)) {
        select.value = previous;
    } else if (occRows && occRows.length && occRows[0].total > 0) {
        select.value = occRows[0].team.id;
    }

    const teamId = select.value;
    const mode = document.getElementById('replayOccMode')?.value || 'real';
    const { posSeries, avgSeries, dayMarkers, total, nPositions } = replayComputePositionSeries(teamId, mode);

    if (posSeries.length === 0 || total <= 0) {
        container.innerHTML = '<div class="replay-feed-item muted">Pas de données pour cette équipe sur la plage.</div>';
        return;
    }

    const W = 680, H = 260;
    const padL = 34, padR = 12, padT = 14, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const xOf = v => padL + (v / total) * plotW;
    const yOf = pos => padT + ((pos - 1) / Math.max(nPositions - 1, 1)) * plotH;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="rpc-svg" role="img" aria-label="Courbe de place au classement">`;

    // Grille horizontale : une ligne par place
    const labelStep = nPositions > 12 ? 2 : 1;
    for (let p = 1; p <= nPositions; p++) {
        const y = yOf(p);
        svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="rpc-grid"/>`;
        if (p === 1 || p === nPositions || p % labelStep === 0) {
            svg += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" class="rpc-axis">${p}</text>`;
        }
    }

    // Marqueurs de journées (plage multi-journées)
    if (dayMarkers.length > 1) {
        dayMarkers.forEach(mk => {
            const mx = xOf(mk.x);
            svg += `<line x1="${mx}" y1="${padT}" x2="${mx}" y2="${H - padB}" class="rpc-day-line"/>`;
            svg += `<text x="${mx + 3}" y="${H - padB + 14}" class="rpc-axis">J${mk.day}</text>`;
        });
    }

    // Place réelle : marches d'escalier
    let posPath = '';
    posSeries.forEach((seg, i) => {
        const y = yOf(seg.pos);
        posPath += `${i === 0 ? 'M' : 'L'}${xOf(seg.x0).toFixed(1)},${y.toFixed(1)} L${xOf(seg.x1).toFixed(1)},${y.toFixed(1)} `;
    });
    svg += `<path d="${posPath}" class="rpc-pos"/>`;

    // Tooltips par intervalle (limités pour ne pas alourdir le DOM)
    if (posSeries.length <= 400) {
        posSeries.forEach(seg => {
            const dayStr = seg.t.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            const time = `${seg.t.getHours()}h${String(seg.t.getMinutes()).padStart(2, '0')}`;
            svg += `<rect x="${xOf(seg.x0).toFixed(1)}" y="${padT}" width="${Math.max(xOf(seg.x1) - xOf(seg.x0), 1).toFixed(1)}" height="${plotH}" fill="transparent"><title>${dayStr} ${time} : ${replayOrdinal(seg.pos)}</title></rect>`;
        });
    }

    // Médiane cumulée (pointillé) puis moyenne cumulée (ligne pleine, dessus)
    const medPath = avgSeries.map((pt, i) => `${i === 0 ? 'M' : 'L'}${xOf(pt.x).toFixed(1)},${yOf(pt.med).toFixed(1)}`).join(' ');
    svg += `<path d="${medPath}" class="rpc-med"/>`;
    const avgPath = avgSeries.map((pt, i) => `${i === 0 ? 'M' : 'L'}${xOf(pt.x).toFixed(1)},${yOf(pt.avg).toFixed(1)}`).join(' ');
    svg += `<path d="${avgPath}" class="rpc-avg"/>`;

    // Valeurs finales en bout de courbe
    const last = avgSeries[avgSeries.length - 1];
    svg += `<text x="${W - padR - 2}" y="${yOf(last.avg) - 5}" text-anchor="end" class="rpc-label avg">moy. ${last.avg.toFixed(1).replace('.', ',')}</text>`;
    svg += `<text x="${W - padR - 2}" y="${yOf(last.med) + 13}" text-anchor="end" class="rpc-label med">méd. ${replayOrdinal(last.med)}</text>`;

    svg += '</svg>';

    container.innerHTML = svg + `
        <div class="rpc-legend">
            <span><span class="rpc-key rpc-key-pos"></span> Place réelle</span>
            <span><span class="rpc-key rpc-key-avg"></span> Place moyenne (cumulée)</span>
            <span><span class="rpc-key rpc-key-med"></span> Place médiane (cumulée)</span>
        </div>`;
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

// Journée « active » à l'instant t : la plus avancée dont un match a commencé
function replayActiveDay(t) {
    let active = null;
    replayData.dayMatches.forEach(dm => {
        if (dm.kickoff <= t) {
            const d = dm.match.matchDay || 0;
            if (active === null || d > active) active = d;
        }
    });
    return active !== null ? active : replayData.days[0];
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

    // État de chaque match de la plage à l'instant t
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

    // Panneau des matchs : seulement la journée en cours à l'instant t
    // (sur une plage de plusieurs journées, tout afficher serait illisible)
    const activeDay = replayActiveDay(t);
    const dayStates = matchStates.filter(ms => (ms.dm.match.matchDay || 0) === activeDay);
    renderReplayMatches(dayStates, t, replayData.days.length > 1 ? activeDay : null);
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

function renderReplayMatches(matchStates, t, dayLabel) {
    const container = document.getElementById('replayMatches');
    if (!container) return;

    const header = dayLabel
        ? `<div class="replay-matches-header">📅 Journée ${dayLabel}</div>`
        : '';

    container.innerHTML = header + matchStates.map(({ dm, started, finished, score }) => {
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

        // Bilan depuis le début de la plage rejouée
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

// Frise chronologique. Une seule journée : un point par événement, positionné
// proportionnellement à l'heure réelle. Plusieurs journées : des chips « J1,
// J2… » cliquables (des centaines de points seraient illisibles).
function renderReplayTimeline() {
    const container = document.getElementById('replayTimeline');
    if (!container || !replayData) return;

    const steps = replayData.steps;
    if (steps.length < 2) { container.innerHTML = ''; return; }

    if (replayData.days.length > 1) {
        container.className = 'replay-timeline chips';
        container.innerHTML = replayData.days.map(day => {
            // Premier pas dont un événement appartient à cette journée
            const idx = steps.findIndex(s => s.events.some(e => (e.dm.match.matchDay || 0) === day));
            return `<button class="replay-day-chip" data-step="${idx}"
                            onclick="replayStop(); replaySetIndex(${idx})">J${day}</button>`;
        }).join('');
        return;
    }

    container.className = 'replay-timeline';
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
    // Chips de journées : marquer celles déjà passées et la journée courante
    const chips = [...document.querySelectorAll('#replayTimeline .replay-day-chip')];
    chips.forEach((chip, i) => {
        const startIdx = parseInt(chip.dataset.step);
        const nextIdx = i + 1 < chips.length ? parseInt(chips[i + 1].dataset.step) : Infinity;
        chip.classList.toggle('done', replayIndex >= startIdx);
        chip.classList.toggle('current', replayIndex >= startIdx && replayIndex < nextIdx);
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
    const occBody = document.querySelector('#replayOccupancy tbody');
    if (occBody) occBody.innerHTML = '';
    const posChart = document.getElementById('replayPosChart');
    if (posChart) posChart.innerHTML = '';
    ['replayLeaderThread', 'replayLastThread', 'replayImpacts'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    const timeline = document.getElementById('replayTimeline');
    if (timeline) timeline.innerHTML = '';
    const clock = document.getElementById('replayClock');
    if (clock) clock.textContent = '—';
}
