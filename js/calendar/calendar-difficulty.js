// calendar-difficulty.js - Onglet Difficulté du calendrier

// ===============================
// ONGLET DIFFICULTÉ
// ===============================

function displayDifficulty() {
    const container = document.getElementById('difficultyContent');
    if (!container) return;

    // Graphique d'évolution de la difficulté (rendu même si le classement
    // ci-dessous n'a plus de matchs restants à afficher)
    populateDifficultyChartTeams();
    renderDifficultyChart();

    // CORRIGÉ : Filtrer futureMatches pour exclure les matchs déjà joués
    // On compare EXACTEMENT homeTeamId-awayTeamId (pas les deux sens car aller ≠ retour)
    const playedConfrontations = new Set();
    allMatches.forEach(m => {
        // Clé unique : homeTeamId-awayTeamId (sens unique, pas inversé)
        playedConfrontations.add(`${m.homeTeamId}-${m.awayTeamId}`);
    });
    
    const realFutureMatches = futureMatches.filter(m => {
        const key = `${m.homeTeamId}-${m.awayTeamId}`;
        return !playedConfrontations.has(key);
    });
    
    console.log(`Matchs à venir: ${futureMatches.length} total, ${realFutureMatches.length} restants après filtrage`);
    console.log(`Matchs joués: ${allMatches.length}`);
    
    if (realFutureMatches.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Tous les matchs ont été joués ou générez d\'abord le calendrier pour voir la difficulté</p>';
        return;
    }
    
    // S'assurer que les Elo sont calculés
    if (!teamsWithElo || teamsWithElo.length === 0) {
        if (typeof EloSystem !== 'undefined') {
            teamsWithElo = EloSystem.initializeTeamsElo(allTeams);
            const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
            sortedMatches.forEach(match => {
                EloSystem.processMatch(match, teamsWithElo);
            });
        }
    }
    
    console.log('Teams with Elo:', teamsWithElo);
    
    // Créer un map pour accéder rapidement aux Elo
    const eloMap = {};
    teamsWithElo.forEach(t => {
        eloMap[t.id] = t.eloRating || 1500;
    });
    
    console.log('Elo Map:', eloMap);
    
    // Calculer la difficulté pour chaque équipe (utiliser realFutureMatches)
    const difficultyData = allTeams.map(team => {
        const upcomingMatches = realFutureMatches.filter(m => 
            m.homeTeamId == team.id || m.awayTeamId == team.id
        );
        
        // Calculer la moyenne Elo des adversaires
        let totalElo = 0;
        let opponentDetails = [];
        
        upcomingMatches.forEach(match => {
            const opponentId = match.homeTeamId == team.id ? match.awayTeamId : match.homeTeamId;
            const opponentElo = eloMap[opponentId] || 1500;
            totalElo += opponentElo;
            
            const opponent = allTeams.find(t => t.id == opponentId);
            opponentDetails.push({
                name: opponent ? opponent.shortName : '?',
                elo: opponentElo,
                isHome: match.homeTeamId == team.id
            });
        });
        
        const avgOpponentElo = upcomingMatches.length > 0 ? Math.round(totalElo / upcomingMatches.length) : 1500;
        
        return {
            team: team,
            teamElo: eloMap[team.id] || 1500,
            matchesRemaining: upcomingMatches.length,
            avgOpponentElo: avgOpponentElo,
            opponents: opponentDetails,
            difficulty: avgOpponentElo
        };
    }).filter(d => d.matchesRemaining > 0);
    
    // Trier par difficulté décroissante (calendrier le plus difficile en premier)
    difficultyData.sort((a, b) => b.difficulty - a.difficulty);
    
    // Message si aucune équipe n'a de matchs restants
    if (difficultyData.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Tous les matchs ont été joués !</p>';
        return;
    }
    
    // Trouver min/max pour normaliser
    const minDiff = Math.min(...difficultyData.map(d => d.difficulty));
    const maxDiff = Math.max(...difficultyData.map(d => d.difficulty));
    const range = maxDiff - minDiff || 1;
    
    // Générer le HTML
    container.innerHTML = difficultyData.map((data, index) => {
        const percentage = ((data.difficulty - minDiff) / range) * 100;
        let diffClass = 'easy';
        if (percentage > 66) diffClass = 'hard';
        else if (percentage > 33) diffClass = 'medium';
        
        // Tooltip avec le détail des adversaires
        const opponentsTooltip = data.opponents
            .sort((a, b) => b.elo - a.elo)
            .slice(0, 5)
            .map(o => `${o.name}: ${o.elo}${o.isHome ? '' : ' (ext)'}`)
            .join(', ');
        
        return `
            <div class="difficulty-row" title="Adversaires: ${opponentsTooltip}...">
                <div class="difficulty-rank">${index + 1}</div>
                <div class="difficulty-team">
                    ${data.team.shortName}
                    <small style="color:#7f8c8d;">(Elo: ${data.teamElo})</small>
                </div>
                <div class="difficulty-bar-container">
                    <div class="difficulty-bar ${diffClass}" style="width: ${Math.max(percentage, 10)}%">
                        ${data.avgOpponentElo}
                    </div>
                </div>
                <div class="difficulty-matches">${data.matchesRemaining} match${data.matchesRemaining > 1 ? 's' : ''}</div>
            </div>
        `;
    }).join('');
}
// ===============================
// ÉVOLUTION DE LA DIFFICULTÉ PAR JOURNÉE
// ===============================
//
// Après chaque journée jouée, on fige deux valeurs pour l'équipe choisie :
//   - son Elo à ce moment-là,
//   - l'Elo moyen (à ce moment-là) des adversaires qu'il lui reste à jouer.
// Tout est recalculé à la volée en rejouant la saison : rien n'est stocké,
// donc les courbes restent justes si un match est modifié ou supprimé.

const DIFFICULTY_CHART_COLORS = { team: '#3498db', difficulty: '#e67e22', opponent: '#9b59b6' };

function computeDifficultySeries(teamId) {
    if (typeof EloSystem === 'undefined') return null;

    const startingElo = (typeof getSeasonStartingElo === 'function')
        ? (getSeasonStartingElo(currentSeason) || {})
        : {};

    // Historique Elo par équipe (rating après chacun de ses matchs)
    const replayed = EloSystem.recalculateAllEloRatings(allTeams, allMatches, startingElo);
    const historyById = {};
    replayed.forEach(t => { historyById[t.id] = t.eloHistory || []; });

    // Elo d'une équipe à la fin de la journée `day`
    const eloAt = (id, day) => {
        const hist = historyById[id] || [];
        let rating = startingElo[id] ?? (EloSystem.ELO_CONFIG?.INITIAL_RATING || 1500);
        for (const h of hist) {
            if ((h.matchDay || 0) <= day) rating = h.rating;
            else break;
        }
        return rating;
    };

    // Toutes les fixtures de l'équipe : jouées + à venir (dédupliquées)
    const playedKeys = new Set(allMatches.map(m => `${m.homeTeamId}-${m.awayTeamId}`));
    const fixtures = [
        ...allMatches.filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId),
        ...futureMatches.filter(m =>
            (m.homeTeamId == teamId || m.awayTeamId == teamId) &&
            !playedKeys.has(`${m.homeTeamId}-${m.awayTeamId}`))
    ];

    const maxPlayedDay = Math.max(0, ...allMatches.map(m => m.matchDay || 0));

    const points = [];
    for (let day = 0; day <= maxPlayedDay; day++) {
        // Adversaires restants après la journée `day`. À la dernière journée
        // il n'y en a plus : le point existe quand même (Elo final de
        // l'équipe + adversaire du jour), seule la difficulté vaut null et
        // sa courbe s'arrête une journée plus tôt.
        const remaining = fixtures.filter(f => (f.matchDay || Infinity) > day);

        const avg = remaining.length > 0
            ? remaining.reduce((sum, f) => {
                const oppId = f.homeTeamId == teamId ? f.awayTeamId : f.homeTeamId;
                return sum + eloAt(oppId, day);
            }, 0) / remaining.length
            : null;

        // Adversaire affronté à cette journée, évalué à son Elo d'AVANT le
        // match : c'est lui qui explique le gain/la perte d'Elo du point
        let opponentElo = null, opponentShort = null;
        if (day >= 1) {
            const dayMatch = allMatches.find(m => m.matchDay === day &&
                (m.homeTeamId == teamId || m.awayTeamId == teamId));
            if (dayMatch) {
                const oppId = dayMatch.homeTeamId == teamId ? dayMatch.awayTeamId : dayMatch.homeTeamId;
                opponentElo = Math.round(eloAt(oppId, day - 1));
                const oppTeam = allTeams.find(t => t.id == oppId);
                opponentShort = oppTeam ? oppTeam.shortName : '?';
            }
        }

        points.push({
            day,
            label: day === 0 ? 'Début' : `J${day}`,
            teamElo: Math.round(eloAt(teamId, day)),
            difficulty: avg !== null ? Math.round(avg) : null,
            remaining: remaining.length,
            opponentElo,
            opponentShort
        });
    }

    return points;
}

function populateDifficultyChartTeams() {
    const select = document.getElementById('difficultyChartTeam');
    if (!select) return;
    const previous = select.value;
    select.innerHTML = [...allTeams]
        .sort((a, b) => (a.shortName || '').localeCompare(b.shortName || '', 'fr'))
        .map(t => `<option value="${t.id}">${t.shortName}</option>`)
        .join('');
    if (previous && [...select.options].some(o => o.value === previous)) {
        select.value = previous;
    }
}

function renderDifficultyChart() {
    const container = document.getElementById('difficultyChartContainer');
    const select = document.getElementById('difficultyChartTeam');
    if (!container || !select || !select.value) return;

    const points = computeDifficultySeries(select.value);

    if (!points || points.length < 2) {
        container.innerHTML = '<p class="difficulty-chart-empty">La courbe apparaîtra après la première journée jouée.</p>';
        return;
    }

    // Géométrie du SVG (mêmes conventions que la courbe de la modale de match)
    const W = 680, H = 260;
    const M = { top: 24, right: 120, bottom: 28, left: 46 };

    const oppPoints = points.filter(p => p.opponentElo != null);
    // La difficulté est null au dernier point d'une saison terminée (plus
    // d'adversaires restants) : sa courbe s'arrête simplement plus tôt
    const diffPoints = points.filter(p => p.difficulty != null);
    const values = points.map(p => p.teamElo)
        .concat(diffPoints.map(p => p.difficulty))
        .concat(oppPoints.map(p => p.opponentElo));
    const minV = Math.min(...values) - 15;
    const maxV = Math.max(...values) + 15;
    const minDay = points[0].day;
    const maxDay = points[points.length - 1].day;

    const x = d => M.left + ((d - minDay) / (maxDay - minDay)) * (W - M.left - M.right);
    const y = v => M.top + (1 - (v - minV) / (maxV - minV)) * (H - M.top - M.bottom);

    const line = key => points.map(p => `${x(p.day).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

    // Graduations horizontales (4 niveaux arrondis à 10)
    const gridLines = [];
    for (let i = 0; i <= 3; i++) {
        const v = Math.round((minV + (maxV - minV) * (i / 3)) / 10) * 10;
        gridLines.push(`
            <line x1="${M.left}" y1="${y(v).toFixed(1)}" x2="${W - M.right}" y2="${y(v).toFixed(1)}" class="df-grid"/>
            <text x="${M.left - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" class="md-chart-axis">${v}</text>`);
    }

    // Libellés X : Début, milieu, dernière journée
    const midPoint = points[Math.floor(points.length / 2)];
    const xLabels = [points[0], midPoint, points[points.length - 1]]
        .filter((p, i, arr) => arr.findIndex(q => q.day === p.day) === i)
        .map(p => `<text x="${x(p.day).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="md-chart-axis">${p.label}</text>`);

    const last = points[points.length - 1];
    const lastDiff = diffPoints[diffPoints.length - 1];
    const team = allTeams.find(t => t.id == select.value);

    container.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="difficulty-chart-svg" role="img"
             aria-label="Évolution de la difficulté pour ${team ? team.shortName : ''}">
            ${gridLines.join('')}
            <polyline points="${line('teamElo')}" fill="none" stroke="${DIFFICULTY_CHART_COLORS.team}" stroke-width="2.5"/>
            <polyline points="${diffPoints.map(p => `${x(p.day).toFixed(1)},${y(p.difficulty).toFixed(1)}`).join(' ')}" fill="none" stroke="${DIFFICULTY_CHART_COLORS.difficulty}" stroke-width="2.5" stroke-dasharray="6 3"/>
            ${oppPoints.length > 1 ? `<polyline points="${oppPoints.map(p => `${x(p.day).toFixed(1)},${y(p.opponentElo).toFixed(1)}`).join(' ')}" fill="none" stroke="${DIFFICULTY_CHART_COLORS.opponent}" stroke-width="1.5" stroke-dasharray="2 3" opacity="0.9"/>` : ''}
            ${oppPoints.map(p => `
                <circle cx="${x(p.day).toFixed(1)}" cy="${y(p.opponentElo).toFixed(1)}" r="3.5" fill="${DIFFICULTY_CHART_COLORS.opponent}">
                    <title>${p.label} — Adversaire : ${p.opponentShort} (${p.opponentElo})</title>
                </circle>`).join('')}
            ${points.map(p => `
                <circle cx="${x(p.day).toFixed(1)}" cy="${y(p.teamElo).toFixed(1)}" r="3" fill="${DIFFICULTY_CHART_COLORS.team}">
                    <title>${p.label} — ${team ? team.shortName : ''} : ${p.teamElo}</title>
                </circle>`).join('')}
            ${diffPoints.map(p => `
                <circle cx="${x(p.day).toFixed(1)}" cy="${y(p.difficulty).toFixed(1)}" r="3" fill="${DIFFICULTY_CHART_COLORS.difficulty}">
                    <title>${p.label} — Difficulté restante : ${p.difficulty} (${p.remaining} matchs)</title>
                </circle>`).join('')}
            <text x="${W - M.right + 8}" y="${(y(last.teamElo) + 3.5).toFixed(1)}" class="md-chart-label" fill="${DIFFICULTY_CHART_COLORS.team}">${team ? team.shortName : ''} ${last.teamElo}</text>
            ${lastDiff ? `<text x="${W - M.right + 8}" y="${(y(lastDiff.difficulty) + 3.5).toFixed(1)}" class="md-chart-label" fill="${DIFFICULTY_CHART_COLORS.difficulty}">Adv. ${lastDiff.difficulty}</text>` : ''}
            ${xLabels.join('')}
        </svg>
        <div class="difficulty-chart-legend">
            <span><span class="df-dot" style="background:${DIFFICULTY_CHART_COLORS.team}"></span> Elo de l'équipe</span>
            <span><span class="df-dot df-dot-dashed" style="background:${DIFFICULTY_CHART_COLORS.difficulty}"></span> Elo moyen des adversaires restants${lastDiff && lastDiff.remaining ? ` (${lastDiff.remaining} matchs)` : ''}</span>
            <span><span class="df-dot" style="background:${DIFFICULTY_CHART_COLORS.opponent}"></span> Elo de l'adversaire de la journée (survole les points)</span>
        </div>
    `;
}
