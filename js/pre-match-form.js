// pre-match-form.js - Avant chaque match : écart de points & forme
// Pour une équipe choisie, l'état des lieux juste avant le coup d'envoi de
// chaque journée jouée : écart de points avec l'adversaire du jour et sa
// place au classement, puis la comparaison des buts marqués/encaissés des
// deux équipes (saison et 5 derniers matchs). Tout est calculé AVANT le
// match du jour : son résultat n'entre jamais dans les chiffres affichés.

document.addEventListener('DOMContentLoaded', () => {
    // Même délai que les autres blocs de la page classements, le temps que
    // les données (localStorage / Firebase) soient chargées
    setTimeout(initPreMatchForm, 400);
    window.addEventListener('firebaseSyncComplete', () => {
        setTimeout(initPreMatchForm, 200);
    });
    document.getElementById('seasonSelect')?.addEventListener('change', () => {
        setTimeout(initPreMatchForm, 100);
    });
});

function pmfSeason() {
    const seasonSelect = document.getElementById('seasonSelect');
    return (seasonSelect && seasonSelect.value) || getCurrentSeason();
}

function pmfTeams() {
    const season = pmfSeason();
    return (typeof getTeamsBySeason === 'function') ? getTeamsBySeason(season) : getStoredTeams();
}

function pmfTeamsAlpha() {
    return pmfTeams().slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
}

function initPreMatchForm() {
    const select = document.getElementById('pmfTeam');
    if (!select) return;

    const teams = pmfTeamsAlpha();
    if (teams.length === 0) {
        select.innerHTML = '<option value="">—</option>';
        renderPreMatchForm();
        return;
    }

    const previous = select.value;
    select.innerHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    select.value = previous && teams.some(t => String(t.id) === previous) ? previous : teams[0].id;

    select.onchange = renderPreMatchForm;
    renderPreMatchForm();
}

// Classement complet AVANT une journée donnée (mêmes règles que le
// classement traditionnel : points, différence de buts, buts marqués)
function pmfStandingsBefore(seasonMatches, matchDay, teams) {
    const stats = {};
    teams.forEach(t => {
        stats[t.id] = { id: t.id, team: t, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
    });

    seasonMatches.forEach(m => {
        if ((m.matchDay || 0) >= matchDay) return;
        const h = stats[m.homeTeamId], a = stats[m.awayTeamId];
        const hs = m.finalScore.home, as = m.finalScore.away;
        if (h) {
            h.played++;
            h.goalsFor += hs; h.goalsAgainst += as;
            h.points += hs > as ? 3 : hs === as ? 1 : 0;
        }
        if (a) {
            a.played++;
            a.goalsFor += as; a.goalsAgainst += hs;
            a.points += as > hs ? 3 : hs === as ? 1 : 0;
        }
    });

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

// Buts marqués/encaissés d'une équipe sur ses 5 derniers matchs joués AVANT
// une journée donnée (moins de 5 si la saison n'en compte pas encore assez)
function pmfLast5(teamId, seasonMatches, matchDay) {
    const prior = seasonMatches
        .filter(m => (m.matchDay || 0) < matchDay &&
            (String(m.homeTeamId) === String(teamId) || String(m.awayTeamId) === String(teamId)))
        .sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0))
        .slice(-5);

    let gf = 0, ga = 0;
    prior.forEach(m => {
        if (String(m.homeTeamId) === String(teamId)) { gf += m.finalScore.home; ga += m.finalScore.away; }
        else { gf += m.finalScore.away; ga += m.finalScore.home; }
    });
    return { gf, ga, count: prior.length };
}

// Une ligne par match joué par l'équipe, dans l'ordre des journées : l'état
// des lieux (elle + son adversaire du jour) juste avant le coup d'envoi
function pmfComputeRows(teamId) {
    const season = pmfSeason();
    const teams = pmfTeams();
    const seasonMatches = getStoredMatches().filter(m => m.season === season && m.finalScore);
    const teamMatches = seasonMatches
        .filter(m => String(m.homeTeamId) === String(teamId) || String(m.awayTeamId) === String(teamId))
        .sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));

    return teamMatches.map(m => {
        const day = m.matchDay || 0;
        const isHome = String(m.homeTeamId) === String(teamId);
        const oppId = isHome ? m.awayTeamId : m.homeTeamId;

        const standings = pmfStandingsBefore(seasonMatches, day, teams);
        const rowT = standings.find(r => String(r.id) === String(teamId));
        const rowO = standings.find(r => String(r.id) === String(oppId));
        const posT = standings.indexOf(rowT) + 1;
        const posO = standings.indexOf(rowO) + 1;

        return {
            day, opponent: getTeamById(oppId), isHome,
            posT, posO,
            ptsT: rowT.points, ptsO: rowO.points, gap: rowT.points - rowO.points,
            playedBeforeT: rowT.played, playedBeforeO: rowO.played,
            gfT: rowT.goalsFor, gaT: rowT.goalsAgainst,
            gfO: rowO.goalsFor, gaO: rowO.goalsAgainst,
            last5T: pmfLast5(teamId, seasonMatches, day),
            last5O: pmfLast5(oppId, seasonMatches, day)
        };
    });
}

function pmfOrdinal(pos) {
    return pos === 1 ? '1er' : `${pos}e`;
}

// Chart SVG en barres : une barre par journée, hauteur/sens = écart de
// points avec l'adversaire du jour (au-dessus de 0 = on menait, en dessous =
// on était mené). Le nom de l'adversaire et sa place sont en infobulle.
function renderPmfGapChart(rows) {
    const container = document.getElementById('pmfGapChart');
    if (!container) return;

    if (rows.length === 0) {
        container.innerHTML = '<div class="replay-feed-item muted">Aucun match joué par cette équipe sur la saison.</div>';
        return;
    }

    const maxAbs = Math.max(3, ...rows.map(r => Math.abs(r.gap)));
    const W = 680, H = 280;
    const padL = 34, padR = 12, padT = 24, padB = 58;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = rows.length;
    const bw = plotW / n;
    const yOf = v => padT + plotH / 2 - (v / maxAbs) * (plotH / 2);
    const zeroY = yOf(0);
    const step = maxAbs > 12 ? 5 : maxAbs > 6 ? 2 : 1;
    const labelEvery = n > 20 ? 2 : 1;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="pmf-svg" role="img" aria-label="Écart de points avant chaque journée">`;

    for (let v = -Math.floor(maxAbs / step) * step; v <= maxAbs; v += step) {
        const y = yOf(v);
        svg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="pmf-grid"/>`;
        svg += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="pmf-axis">${v > 0 ? '+' + v : v}</text>`;
    }
    svg += `<line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W - padR}" y2="${zeroY.toFixed(1)}" class="pmf-zero"/>`;

    rows.forEach((r, i) => {
        const x = padL + i * bw;
        const barW = Math.max(bw - 6, 4);
        const barX = x + (bw - barW) / 2;
        const barYRaw = yOf(r.gap);
        const y0 = Math.min(zeroY, barYRaw);
        const barH = Math.max(Math.abs(zeroY - barYRaw), 1.5);
        const cls = r.gap > 0 ? 'ahead' : r.gap < 0 ? 'behind' : 'even';
        const oppName = r.opponent ? (r.opponent.shortName || r.opponent.name) : '?';
        const venue = r.isHome ? 'D' : 'E';
        const noData = r.playedBeforeT === 0 && r.playedBeforeO === 0;
        const gapTxt = r.gap > 0 ? `+${r.gap}` : `${r.gap}`;
        const tip = noData
            ? `J${r.day} vs ${oppName} (${venue}) : aucun match joué avant cette journée`
            : `J${r.day} vs ${oppName} (${venue}) — adversaire ${pmfOrdinal(r.posO)}, ${r.ptsO} pt${r.ptsO > 1 ? 's' : ''} — vous ${pmfOrdinal(r.posT)}, ${r.ptsT} pt${r.ptsT > 1 ? 's' : ''} — écart ${gapTxt} pt${Math.abs(r.gap) > 1 ? 's' : ''}`;

        svg += `<rect x="${barX.toFixed(1)}" y="${y0.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" class="pmf-bar ${cls}"><title>${tip.replace(/"/g, '&quot;')}</title></rect>`;

        // Le nom de l'adversaire se colle au bout de la barre, mais sans
        // jamais chevaucher le cadre du graphique ni les libellés « Jx »
        const labelY = r.gap >= 0
            ? Math.max(y0 - 4, padT + 8)
            : Math.min(y0 + barH + 11, H - padB - 6);
        svg += `<text x="${(barX + barW / 2).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" class="pmf-bar-label">${pmfXmlEscape(oppName)}</text>`;

        if (i % labelEvery === 0) {
            svg += `<text x="${(barX + barW / 2).toFixed(1)}" y="${H - padB + 24}" text-anchor="middle" class="pmf-axis">J${r.day}</text>`;
        }
    });

    svg += '</svg>';
    container.innerHTML = svg + `
        <div class="rpc-legend pmf-legend">
            <span><span class="pmf-key ahead"></span> Vous étiez devant au classement</span>
            <span><span class="pmf-key behind"></span> Vous étiez derrière</span>
        </div>`;
}

function pmfXmlEscape(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Plus haut = mieux (buts marqués)
function pmfCellClassHigh(mine, theirs) {
    if (mine > theirs) return 'positive';
    if (mine < theirs) return 'negative';
    return '';
}

// Plus bas = mieux (buts encaissés)
function pmfCellClassLow(mine, theirs) {
    if (mine < theirs) return 'positive';
    if (mine > theirs) return 'negative';
    return '';
}

function renderPmfTable(rows) {
    const tbody = document.querySelector('#pmfTable tbody');
    if (!tbody) return;

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="occ-none">Aucun match joué par cette équipe sur la saison.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const oppName = r.opponent ? (r.opponent.shortName || r.opponent.name) : '?';
        const venue = r.isHome ? 'D' : 'E';
        const gapTxt = r.gap > 0 ? `+${r.gap}` : `${r.gap}`;
        const gapCls = r.gap > 0 ? 'positive' : r.gap < 0 ? 'negative' : '';
        const last5TipT = `Sur ${r.last5T.count} match${r.last5T.count > 1 ? 's' : ''}`;
        const last5TipO = `Sur ${r.last5O.count} match${r.last5O.count > 1 ? 's' : ''}`;

        return `
            <tr>
                <td>${r.day}</td>
                <td class="team-name">${oppName} <span class="pmf-venue">(${venue})</span></td>
                <td>${pmfOrdinal(r.posO)}</td>
                <td class="${gapCls}"><strong>${gapTxt}</strong></td>
                <td class="${pmfCellClassHigh(r.gfT, r.gfO)}">${r.gfT}</td>
                <td class="${pmfCellClassHigh(r.gfO, r.gfT)}">${r.gfO}</td>
                <td class="${pmfCellClassLow(r.gaT, r.gaO)}">${r.gaT}</td>
                <td class="${pmfCellClassLow(r.gaO, r.gaT)}">${r.gaO}</td>
                <td class="${pmfCellClassHigh(r.last5T.gf, r.last5O.gf)}" title="${last5TipT}">${r.last5T.gf}</td>
                <td class="${pmfCellClassHigh(r.last5O.gf, r.last5T.gf)}" title="${last5TipO}">${r.last5O.gf}</td>
                <td class="${pmfCellClassLow(r.last5T.ga, r.last5O.ga)}" title="${last5TipT}">${r.last5T.ga}</td>
                <td class="${pmfCellClassLow(r.last5O.ga, r.last5T.ga)}" title="${last5TipO}">${r.last5O.ga}</td>
            </tr>
        `;
    }).join('');
}

function renderPreMatchForm() {
    const select = document.getElementById('pmfTeam');
    if (!select || !select.value) {
        renderPmfGapChart([]);
        renderPmfTable([]);
        return;
    }
    const rows = pmfComputeRows(select.value);
    renderPmfGapChart(rows);
    renderPmfTable(rows);
}
