// calendar-match-details.js - Modale de détails d'un match (clic sur une carte de l'onglet Calendrier)
//
// - Match joué : score, mi-temps, buteurs, impact Elo, contexte avant-match
// - Match à venir : séries en cours, forme, dynamique, et points pris par chaque
//   équipe face à des adversaires de niveau similaire à son adversaire du jour
//   (Elo à ±MD_ELO_RANGE points, ou même place au classement au moment du match)

const MD_ELO_RANGE = 50;      // "Elo similaire" = à ±50 points
const MD_FORM_COUNT = 5;      // Nombre de matchs pour la forme / dynamique

// ===============================
// OUVERTURE / FERMETURE DE LA MODALE
// ===============================

function showCalendarMatchDetails(homeTeamId, awayTeamId, matchDay, status) {
    const source = status === 'played' ? allMatches : futureMatches;
    let match = source.find(m =>
        m.homeTeamId == homeTeamId &&
        m.awayTeamId == awayTeamId &&
        (m.matchDay || 0) == matchDay
    );

    if (!match) {
        // Un match à venir peut ne pas (encore) exister dans futureMatches
        // (ex. carte de pronostic) : l'analyse d'avant-match n'a besoin que
        // des équipes et de la journée, on reconstruit un match minimal.
        if (status !== 'played') {
            match = { homeTeamId, awayTeamId, matchDay: parseInt(matchDay) || 0 };
        } else {
            console.warn('Match introuvable pour la modale de détails');
            return;
        }
    }

    const overlay = ensureMatchDetailsModal();
    const body = overlay.querySelector('#matchDetailsBody');

    const timeline = buildSeasonTimeline();

    body.innerHTML = status === 'played'
        ? renderPlayedMatchDetails(match, timeline)
        : renderUpcomingMatchDetails(match, timeline);

    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeCalendarMatchDetails() {
    const overlay = document.getElementById('matchDetailsOverlay');
    if (overlay) {
        overlay.classList.remove('visible');
        document.body.style.overflow = '';
    }
}

function ensureMatchDetailsModal() {
    let overlay = document.getElementById('matchDetailsOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'matchDetailsOverlay';
    overlay.className = 'match-details-overlay';
    overlay.innerHTML = `
        <div class="md-modal-box">
            <button class="md-modal-close" onclick="closeCalendarMatchDetails()">✕</button>
            <div id="matchDetailsBody"></div>
        </div>
    `;

    // Fermer en cliquant en dehors de la modale
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeCalendarMatchDetails();
    });

    // Fermer avec Échap
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeCalendarMatchDetails();
    });

    document.body.appendChild(overlay);
    return overlay;
}

// ===============================
// TIMELINE DE LA SAISON
// Rejoue tous les matchs joués dans l'ordre pour connaître, au moment de
// chaque match : l'Elo des deux équipes et leur place au classement.
// ===============================

function buildSeasonTimeline() {
    const startingElo = (typeof getSeasonStartingElo === 'function')
        ? getSeasonStartingElo(currentSeason)
        : {};

    const elo = {};
    allTeams.forEach(t => {
        elo[t.id] = (startingElo && startingElo[t.id] != null) ? startingElo[t.id] : 1500;
    });

    // Accumulateur de classement
    const acc = {};
    allTeams.forEach(t => {
        acc[t.id] = { teamId: t.id, points: 0, goalDiff: 0, goalsFor: 0, played: 0 };
    });

    const sorted = allMatches
        .filter(m => m.finalScore)
        .sort((a, b) => {
            if ((a.matchDay || 0) !== (b.matchDay || 0)) {
                return (a.matchDay || 0) - (b.matchDay || 0);
            }
            return new Date(a.date || 0) - new Date(b.date || 0);
        });

    const entries = [];
    let lastDay = null;
    let snapshot = mdSnapshotPositions(acc);

    sorted.forEach(m => {
        const day = m.matchDay || 0;
        if (day !== lastDay) {
            snapshot = mdSnapshotPositions(acc);
            lastDay = day;
        }

        const h = m.homeTeamId, a = m.awayTeamId;
        const entry = {
            match: m,
            homeEloBefore: elo[h] != null ? elo[h] : 1500,
            awayEloBefore: elo[a] != null ? elo[a] : 1500,
            homePosBefore: snapshot.positions[h] || null,
            awayPosBefore: snapshot.positions[a] || null,
            rankingMeaningful: snapshot.meaningful
        };

        let homeChange = 0, awayChange = 0;
        if (typeof EloSystem !== 'undefined' && EloSystem.simulateEloChange) {
            const sim = EloSystem.simulateEloChange(
                entry.homeEloBefore, entry.awayEloBefore,
                m.finalScore.home, m.finalScore.away
            );
            homeChange = sim.homeChange;
            awayChange = sim.awayChange;
        }

        entry.homeChange = homeChange;
        entry.awayChange = awayChange;
        entry.homeEloAfter = entry.homeEloBefore + homeChange;
        entry.awayEloAfter = entry.awayEloBefore + awayChange;

        elo[h] = entry.homeEloAfter;
        elo[a] = entry.awayEloAfter;

        // Mettre à jour le classement
        const hs = m.finalScore.home, as = m.finalScore.away;
        if (acc[h] && acc[a]) {
            acc[h].played++; acc[a].played++;
            acc[h].goalsFor += hs; acc[h].goalDiff += hs - as;
            acc[a].goalsFor += as; acc[a].goalDiff += as - hs;
            if (hs > as) acc[h].points += 3;
            else if (hs < as) acc[a].points += 3;
            else { acc[h].points++; acc[a].points++; }
        }

        entries.push(entry);
    });

    return {
        entries,
        currentElo: elo,
        currentSnapshot: mdSnapshotPositions(acc)
    };
}

// Classement à un instant donné : { positions: {teamId: place}, meaningful: bool }
// meaningful = false tant qu'aucun match n'a été joué (classement arbitraire)
function mdSnapshotPositions(acc) {
    const rows = Object.values(acc).slice().sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
    });

    const positions = {};
    rows.forEach((row, i) => { positions[row.teamId] = i + 1; });

    return {
        positions,
        meaningful: rows.some(r => r.played > 0)
    };
}

// ===============================
// HELPERS
// ===============================

function mdTeam(teamId) {
    return allTeams.find(t => t.id == teamId) || { name: '?', shortName: '?' };
}

function mdFormatDate(match) {
    const raw = match.scheduledAt || match.date;
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';

    let text = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (match.scheduledAt) {
        text += ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return text;
}

// Tous les matchs joués d'une équipe, dans l'ordre, avec le point de vue de l'équipe
function mdTeamResults(teamId, timeline) {
    const results = [];
    timeline.entries.forEach(e => {
        const m = e.match;
        let isHome;
        if (m.homeTeamId == teamId) isHome = true;
        else if (m.awayTeamId == teamId) isHome = false;
        else return;

        const gf = isHome ? m.finalScore.home : m.finalScore.away;
        const ga = isHome ? m.finalScore.away : m.finalScore.home;

        results.push({
            match: m,
            isHome,
            opponentId: isHome ? m.awayTeamId : m.homeTeamId,
            opponentEloBefore: isHome ? e.awayEloBefore : e.homeEloBefore,
            opponentPosBefore: isHome ? e.awayPosBefore : e.homePosBefore,
            rankingMeaningful: e.rankingMeaningful,
            goalsFor: gf,
            goalsAgainst: ga,
            result: gf > ga ? 'V' : (gf === ga ? 'N' : 'D'),
            points: gf > ga ? 3 : (gf === ga ? 1 : 0),
            eloChange: isHome ? e.homeChange : e.awayChange
        });
    });
    return results;
}

// ===============================
// SÉRIES, FORME & DYNAMIQUE
// ===============================

function mdAnalyzeStreaks(results) {
    if (results.length === 0) return null;

    const last = results[results.length - 1].result;

    // Série de résultats identiques
    let streak = 0;
    for (let i = results.length - 1; i >= 0 && results[i].result === last; i--) streak++;

    // Série sans défaite / sans victoire
    let unbeaten = 0;
    for (let i = results.length - 1; i >= 0 && results[i].result !== 'D'; i--) unbeaten++;
    let winless = 0;
    for (let i = results.length - 1; i >= 0 && results[i].result !== 'V'; i--) winless++;

    return { last, streak, unbeaten, winless };
}

function mdStreakHtml(streaks) {
    if (!streaks) {
        return '<div class="md-streak">Aucun match joué cette saison</div>';
    }

    const plural = streaks.streak > 1 ? 's' : '';
    let main = '';
    if (streaks.last === 'V') {
        main = `🔥 ${streaks.streak} victoire${plural} d'affilée`;
    } else if (streaks.last === 'D') {
        main = `❄️ ${streaks.streak} défaite${plural} d'affilée`;
    } else {
        main = `⚖️ ${streaks.streak} nul${plural} d'affilée`;
    }

    const extras = [];
    if (streaks.last !== 'D' && streaks.unbeaten > streaks.streak) {
        extras.push(`${streaks.unbeaten} matchs sans défaite`);
    }
    if (streaks.last !== 'V' && streaks.winless > streaks.streak) {
        extras.push(`${streaks.winless} matchs sans victoire`);
    }

    return `
        <div class="md-streak">${main}</div>
        ${extras.map(e => `<div class="md-streak-extra">dont ${e}</div>`).join('')}
    `;
}

function mdFormHtml(results) {
    const lastN = results.slice(-MD_FORM_COUNT);
    if (lastN.length === 0) return '<span class="md-muted">—</span>';

    return lastN.map(r => {
        const opp = mdTeam(r.opponentId);
        const title = `J${r.match.matchDay || '?'} ${r.isHome ? 'vs' : '@'} ${opp.shortName} : ${r.goalsFor}-${r.goalsAgainst}`;
        return `<span class="md-form-badge md-form-${r.result.toLowerCase()}" title="${title}">${r.result}</span>`;
    }).join('');
}

function mdDynamicsHtml(results) {
    const lastN = results.slice(-MD_FORM_COUNT);
    if (lastN.length === 0) return '<span class="md-muted">—</span>';

    const pts = lastN.reduce((s, r) => s + r.points, 0);
    const gf = lastN.reduce((s, r) => s + r.goalsFor, 0);
    const ga = lastN.reduce((s, r) => s + r.goalsAgainst, 0);
    const eloDelta = lastN.reduce((s, r) => s + r.eloChange, 0);

    let trendIcon, trendLabel;
    if (eloDelta > 10) { trendIcon = '📈'; trendLabel = 'En progression'; }
    else if (eloDelta < -10) { trendIcon = '📉'; trendLabel = 'En baisse'; }
    else { trendIcon = '➡️'; trendLabel = 'Stable'; }

    const eloSign = eloDelta > 0 ? '+' : '';

    return `
        <div class="md-dyn-row"><span class="md-dyn-label">Points</span><span class="md-dyn-value">${pts} / ${lastN.length * 3}</span></div>
        <div class="md-dyn-row"><span class="md-dyn-label">Buts</span><span class="md-dyn-value">${gf} marqués · ${ga} encaissés</span></div>
        <div class="md-dyn-row"><span class="md-dyn-label">Elo</span><span class="md-dyn-value">${eloSign}${eloDelta} pts ${trendIcon}</span></div>
        <div class="md-dyn-trend">${trendIcon} ${trendLabel} (sur les ${lastN.length} derniers matchs)</div>
    `;
}

// ===============================
// POINTS FACE À DES ADVERSAIRES SIMILAIRES
// Pour l'équipe teamId : matchs joués contre des adversaires dont le niveau
// était comparable à celui de refTeamId (son adversaire du jour), soit par
// l'Elo (±MD_ELO_RANGE au moment du match, comparé à l'Elo actuel de la
// référence), soit par la place au classement au moment du match.
// ===============================

function mdAnalyzeVsSimilar(teamId, refTeamId, timeline) {
    const refElo = timeline.currentElo[refTeamId] != null ? timeline.currentElo[refTeamId] : 1500;
    const refPos = timeline.currentSnapshot.positions[refTeamId] || null;

    const results = mdTeamResults(teamId, timeline);
    const rows = results.filter(r => {
        // Ne pas compter les confrontations directes déjà jouées contre la référence :
        // elles sont pertinentes mais relèvent du face-à-face, pas du "niveau similaire"
        if (r.opponentId == refTeamId) return false;

        const eloSimilar = Math.abs(r.opponentEloBefore - refElo) <= MD_ELO_RANGE;
        const samePos = r.rankingMeaningful && refPos != null && r.opponentPosBefore === refPos;

        if (eloSimilar) r.matchReason = samePos ? 'both' : 'elo';
        else if (samePos) r.matchReason = 'pos';

        return eloSimilar || samePos;
    });

    const points = rows.reduce((s, r) => s + r.points, 0);

    return { refElo, refPos, rows, points, count: rows.length };
}

function mdVsSimilarHtml(teamId, refTeamId, timeline) {
    const analysis = mdAnalyzeVsSimilar(teamId, refTeamId, timeline);
    const refTeam = mdTeam(refTeamId);

    if (analysis.count === 0) {
        return `
            <div class="md-similar-total md-muted">Aucun match joué face à une équipe du niveau de ${refTeam.shortName}</div>
        `;
    }

    const avg = (analysis.points / analysis.count).toFixed(2);

    const list = analysis.rows.slice().reverse().map(r => {
        const opp = mdTeam(r.opponentId);
        const reasonIcon = r.matchReason === 'pos' ? '🏅' : '⚡';
        const reasonTitle = r.matchReason === 'pos'
            ? `${opp.shortName} était ${r.opponentPosBefore}e au moment du match (place actuelle de ${refTeam.shortName})`
            : `Elo de ${opp.shortName} au moment du match : ${r.opponentEloBefore} (${refTeam.shortName} aujourd'hui : ${analysis.refElo})`;

        return `
            <div class="md-similar-row" title="${reasonTitle}">
                <span class="md-similar-day">J${r.match.matchDay || '?'}</span>
                <span class="md-similar-opp">${r.isHome ? 'vs' : '@'} ${opp.shortName}</span>
                <span class="md-similar-score">${r.goalsFor}-${r.goalsAgainst}</span>
                <span class="md-form-badge md-form-${r.result.toLowerCase()}">${r.result}</span>
                <span class="md-similar-reason">${reasonIcon}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="md-similar-total">
            <strong>${analysis.points} pt${analysis.points > 1 ? 's' : ''}</strong> en ${analysis.count} match${analysis.count > 1 ? 's' : ''}
            <span class="md-similar-avg">(moy. ${avg} pt/match)</span>
        </div>
        <div class="md-similar-list">${list}</div>
    `;
}

// ===============================
// CONFRONTATIONS DIRECTES (toutes saisons)
// ===============================

function mdHeadToHeadHtml(homeTeamId, awayTeamId, excludeMatch) {
    // allSeasonsMatches contient tous les matchs joués, toutes saisons
    // confondues (chargé par calendar-core) ; repli sur allMatches sinon.
    const pool = (typeof allSeasonsMatches !== 'undefined' && allSeasonsMatches.length > 0)
        ? allSeasonsMatches
        : allMatches;

    // Exclusion par clé (et non par identité d'objet) : le match affiché
    // dans la modale peut être une copie de celui stocké dans le pool.
    const isExcluded = m => excludeMatch &&
        m.homeTeamId == excludeMatch.homeTeamId &&
        m.awayTeamId == excludeMatch.awayTeamId &&
        (m.matchDay || 0) == (excludeMatch.matchDay || 0) &&
        (!m.season || !excludeMatch.season || m.season === excludeMatch.season);

    const meetings = pool
        .filter(m => !isExcluded(m) && m.finalScore &&
            ((m.homeTeamId == homeTeamId && m.awayTeamId == awayTeamId) ||
             (m.homeTeamId == awayTeamId && m.awayTeamId == homeTeamId)))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (meetings.length === 0) {
        return '<div class="md-muted">Première confrontation entre ces deux équipes</div>';
    }

    const homeTeam = mdTeam(homeTeamId);
    const awayTeam = mdTeam(awayTeamId);

    let homeWins = 0, draws = 0, awayWins = 0;
    meetings.forEach(m => {
        const homeSideScore = m.homeTeamId == homeTeamId ? m.finalScore.home : m.finalScore.away;
        const awaySideScore = m.homeTeamId == homeTeamId ? m.finalScore.away : m.finalScore.home;
        if (homeSideScore > awaySideScore) homeWins++;
        else if (homeSideScore < awaySideScore) awayWins++;
        else draws++;
    });

    const list = meetings.slice(0, 6).map(m => {
        const h = mdTeam(m.homeTeamId);
        const a = mdTeam(m.awayTeamId);
        const seasonLabel = m.season ? `<span class="md-h2h-season">${m.season}</span>` : '';
        return `
            <div class="md-h2h-row">
                <span class="md-h2h-match">${h.shortName} ${m.finalScore.home} - ${m.finalScore.away} ${a.shortName}</span>
                ${seasonLabel}
            </div>
        `;
    }).join('');

    return `
        <div class="md-h2h-balance">
            <span class="md-h2h-stat win">${homeWins} V ${homeTeam.shortName}</span>
            <span class="md-h2h-stat draw">${draws} N</span>
            <span class="md-h2h-stat loss">${awayWins} V ${awayTeam.shortName}</span>
        </div>
        <div class="md-h2h-list">${list}</div>
    `;
}

// ===============================
// BILAN DOMICILE / EXTÉRIEUR
// ===============================

function mdVenueRecordHtml(teamId, atHome, timeline) {
    const results = mdTeamResults(teamId, timeline).filter(r => r.isHome === atHome);
    const label = atHome ? '🏠 À domicile' : '✈️ À l\'extérieur';

    if (results.length === 0) {
        return `<div class="md-dyn-row"><span class="md-dyn-label">${label}</span><span class="md-dyn-value md-muted">—</span></div>`;
    }

    const pts = results.reduce((s, r) => s + r.points, 0);
    const w = results.filter(r => r.result === 'V').length;
    const d = results.filter(r => r.result === 'N').length;
    const l = results.filter(r => r.result === 'D').length;

    return `
        <div class="md-dyn-row">
            <span class="md-dyn-label">${label}</span>
            <span class="md-dyn-value">${pts} pt${pts > 1 ? 's' : ''} en ${results.length} m. (${w}V ${d}N ${l}D)</span>
        </div>
    `;
}

// ===============================
// RENDU : MATCH JOUÉ
// ===============================

function renderPlayedMatchDetails(match, timeline) {
    const homeTeam = mdTeam(match.homeTeamId);
    const awayTeam = mdTeam(match.awayTeamId);
    const dateText = mdFormatDate(match);

    const entry = timeline.entries.find(e => e.match === match);

    // Buteurs par équipe (triés par minute)
    const goals = (match.goals || []).slice().sort((a, b) => {
        if (a.minute !== b.minute) return a.minute - b.minute;
        return (a.extraTime || 0) - (b.extraTime || 0);
    });
    const homeGoals = goals.filter(g => g.teamId == match.homeTeamId);
    const awayGoals = goals.filter(g => g.teamId == match.awayTeamId);

    const goalLine = g => `<div class="md-goal">⚽ ${g.scorer} <span class="md-goal-time">${g.displayTime || (g.minute + "'")}</span></div>`;

    const goalsHtml = goals.length > 0 ? `
        <div class="md-section">
            <h4>Buteurs</h4>
            <div class="md-goals">
                <div class="md-goals-side">${homeGoals.map(goalLine).join('') || '<span class="md-muted">—</span>'}</div>
                <div class="md-goals-side away">${awayGoals.map(goalLine).join('') || '<span class="md-muted">—</span>'}</div>
            </div>
        </div>
    ` : '';

    // Contexte avant-match + impact Elo
    let contextHtml = '';
    let eloHtml = '';
    if (entry) {
        const posLine = entry.rankingMeaningful
            ? `<div class="md-context-row">🏅 Avant le match : ${homeTeam.shortName} ${entry.homePosBefore}e · ${awayTeam.shortName} ${entry.awayPosBefore}e</div>`
            : '';
        contextHtml = posLine ? `<div class="md-section"><h4>Contexte avant-match</h4>${posLine}</div>` : '';

        const changeBadge = c => `<span class="md-elo-change ${c >= 0 ? 'positive' : 'negative'}">${c >= 0 ? '+' : ''}${c}</span>`;
        eloHtml = `
            <div class="md-section">
                <h4>Impact Elo</h4>
                <div class="md-elo-grid">
                    <div class="md-elo-team">
                        <span class="md-elo-name">${homeTeam.shortName}</span>
                        <span class="md-elo-values">${entry.homeEloBefore} → ${entry.homeEloAfter} ${changeBadge(entry.homeChange)}</span>
                    </div>
                    <div class="md-elo-team">
                        <span class="md-elo-name">${awayTeam.shortName}</span>
                        <span class="md-elo-values">${entry.awayEloBefore} → ${entry.awayEloAfter} ${changeBadge(entry.awayChange)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    const halftimeHtml = match.halftimeScore
        ? `<div class="md-halftime">Mi-temps : ${match.halftimeScore}</div>`
        : '';

    return `
        <div class="md-header played">
            <div class="md-header-teams">
                <span class="md-header-team">${homeTeam.name}</span>
                <span class="md-header-score">${match.finalScore.home} - ${match.finalScore.away}</span>
                <span class="md-header-team away">${awayTeam.name}</span>
            </div>
            ${halftimeHtml}
            <div class="md-header-sub">Journée ${match.matchDay || '?'}${dateText ? ' · ' + dateText : ''}</div>
        </div>
        ${goalsHtml}
        ${contextHtml}
        ${eloHtml}
        <div class="md-section md-h2h-section">
            <h4>🤜🤛 Autres confrontations directes</h4>
            ${mdHeadToHeadHtml(match.homeTeamId, match.awayTeamId, match)}
        </div>
    `;
}

// ===============================
// RENDU : MATCH À VENIR
// ===============================

function renderUpcomingMatchDetails(match, timeline) {
    const homeTeam = mdTeam(match.homeTeamId);
    const awayTeam = mdTeam(match.awayTeamId);
    const dateText = mdFormatDate(match);

    const homeElo = timeline.currentElo[match.homeTeamId] != null ? timeline.currentElo[match.homeTeamId] : 1500;
    const awayElo = timeline.currentElo[match.awayTeamId] != null ? timeline.currentElo[match.awayTeamId] : 1500;
    const homePos = timeline.currentSnapshot.positions[match.homeTeamId];
    const awayPos = timeline.currentSnapshot.positions[match.awayTeamId];
    const meaningful = timeline.currentSnapshot.meaningful;

    // Probabilités Elo (si disponibles)
    let probaHtml = '';
    if (typeof EloSystem !== 'undefined' && EloSystem.predictMatch && teamsWithElo.length > 0) {
        const pred = EloSystem.predictMatch(match.homeTeamId, match.awayTeamId, teamsWithElo);
        if (pred) {
            probaHtml = `
                <div class="md-proba-bar">
                    <div class="md-proba home" style="width:${pred.homeTeam.winProbability}%" title="Victoire ${homeTeam.shortName}">${pred.homeTeam.winProbability}%</div>
                    <div class="md-proba draw" style="width:${pred.drawProbability}%" title="Match nul">${pred.drawProbability}%</div>
                    <div class="md-proba away" style="width:${pred.awayTeam.winProbability}%" title="Victoire ${awayTeam.shortName}">${pred.awayTeam.winProbability}%</div>
                </div>
            `;
        }
    }

    const teamColumn = (teamId, oppId, atHome) => {
        const team = mdTeam(teamId);
        const opp = mdTeam(oppId);
        const results = mdTeamResults(teamId, timeline);
        const streaks = mdAnalyzeStreaks(results);
        const elo = timeline.currentElo[teamId] != null ? timeline.currentElo[teamId] : 1500;
        const pos = timeline.currentSnapshot.positions[teamId];

        return `
            <div class="md-team-column">
                <div class="md-team-header">
                    <span class="md-team-name">${team.shortName}</span>
                    <span class="md-team-meta">${meaningful && pos ? pos + 'e' : ''} · Elo ${elo}</span>
                </div>
                <div class="md-block">
                    <h5>📊 Série en cours</h5>
                    ${mdStreakHtml(streaks)}
                </div>
                <div class="md-block">
                    <h5>🎽 Forme (${Math.min(results.length, MD_FORM_COUNT)} derniers)</h5>
                    <div class="md-form">${mdFormHtml(results)}</div>
                </div>
                <div class="md-block">
                    <h5>⚡ Dynamique</h5>
                    ${mdDynamicsHtml(results)}
                    ${mdVenueRecordHtml(teamId, atHome, timeline)}
                </div>
                <div class="md-block">
                    <h5>🆚 Face aux équipes du niveau de ${opp.shortName}</h5>
                    ${mdVsSimilarHtml(teamId, oppId, timeline)}
                </div>
            </div>
        `;
    };

    const posNote = meaningful && awayPos && homePos
        ? ` ou classé à la même place (${homeTeam.shortName} : équipes ${awayPos}e au moment du match · ${awayTeam.shortName} : équipes ${homePos}e)`
        : '';

    return `
        <div class="md-header upcoming">
            <div class="md-header-teams">
                <span class="md-header-team">${homeTeam.name}</span>
                <span class="md-header-score upcoming">vs</span>
                <span class="md-header-team away">${awayTeam.name}</span>
            </div>
            <div class="md-header-sub">Journée ${match.matchDay || '?'}${dateText ? ' · ' + dateText : ''} · À venir</div>
            ${probaHtml}
        </div>
        <div class="md-columns">
            ${teamColumn(match.homeTeamId, match.awayTeamId, true)}
            ${teamColumn(match.awayTeamId, match.homeTeamId, false)}
        </div>
        <div class="md-section md-h2h-section">
            <h4>🤜🤛 Confrontations directes</h4>
            ${mdHeadToHeadHtml(match.homeTeamId, match.awayTeamId, null)}
        </div>
        <div class="md-footnote">
            ⚡ Adversaire avec un Elo similaire au moment du match (à ±${MD_ELO_RANGE} pts de l'Elo actuel de l'adversaire du jour)${posNote} 🏅.
            Les confrontations directes déjà jouées entre les deux équipes ne sont pas comptées.
        </div>
    `;
}
