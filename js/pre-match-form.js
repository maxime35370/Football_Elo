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

function pmfXmlEscape(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Pas de grille "rond" selon l'amplitude à couvrir (1, 2, 5, 10...)
function pmfNiceStep(maxAbs) {
    if (maxAbs > 40) return 10;
    if (maxAbs > 20) return 5;
    if (maxAbs > 10) return 2;
    return 1;
}

// Axe X commun aux 3 graphiques : une position par journée jouée, espacées
// également (ce n'est pas une frise temporelle réelle, juste la succession
// des journées de l'équipe choisie)
function pmfXScale(n, plotW, padL) {
    return i => n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
}

function pmfEmptyChart(container) {
    container.innerHTML = '<div class="replay-feed-item muted">Aucun match joué par cette équipe sur la saison.</div>';
}

// Graphique 1 : votre place au classement vs celle de l'adversaire du jour,
// journée après journée — la ligne orange montre si le calendrier se
// corse ou se détend au fil de la saison.
function renderPmfRankChart(rows, nPositions) {
    const container = document.getElementById('pmfRankChart');
    if (!container) return;
    if (rows.length === 0) { pmfEmptyChart(container); return; }

    const W = 680, H = 280;
    const padL = 34, padR = 12, padT = 14, padB = 46;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = rows.length;
    const xOf = pmfXScale(n, plotW, padL);
    const yOf = pos => padT + ((pos - 1) / Math.max(nPositions - 1, 1)) * plotH;
    const labelStep = nPositions > 12 ? 2 : 1;
    const labelEvery = n > 20 ? 2 : 1;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="pmf-svg" role="img" aria-label="Place au classement, vous et l'adversaire du jour">`;

    for (let p = 1; p <= nPositions; p++) {
        const y = yOf(p);
        svg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="pmf-grid"/>`;
        if (p === 1 || p === nPositions || p % labelStep === 0) {
            svg += `<text x="${(padL - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="pmf-axis">${p}</text>`;
        }
    }
    rows.forEach((r, i) => {
        if (i % labelEvery === 0) {
            svg += `<text x="${xOf(i).toFixed(1)}" y="${(H - padB + 16).toFixed(1)}" text-anchor="middle" class="pmf-axis">J${r.day}</text>`;
        }
    });

    const buildLine = key => rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(r[key]).toFixed(1)}`).join(' ');
    svg += `<path d="${buildLine('posO')}" class="pmf-line pmf-line-opp"/>`;
    svg += `<path d="${buildLine('posT')}" class="pmf-line pmf-line-you"/>`;

    rows.forEach((r, i) => {
        const x = xOf(i);
        const oppName = r.opponent ? (r.opponent.shortName || r.opponent.name) : '?';
        const venue = r.isHome ? 'D' : 'E';
        const gapTxt = r.gap > 0 ? `+${r.gap}` : `${r.gap}`;
        const tipOpp = `J${r.day} — adversaire : ${oppName} (${venue}), ${pmfOrdinal(r.posO)}, ${r.ptsO} pt${r.ptsO > 1 ? 's' : ''}`;
        const tipYou = `J${r.day} — vous : ${pmfOrdinal(r.posT)}, ${r.ptsT} pt${r.ptsT > 1 ? 's' : ''} (écart ${gapTxt} pt${Math.abs(r.gap) > 1 ? 's' : ''} vs ${oppName})`;
        svg += `<circle cx="${x.toFixed(1)}" cy="${yOf(r.posO).toFixed(1)}" r="4" class="pmf-dot pmf-dot-opp"><title>${pmfXmlEscape(tipOpp)}</title></circle>`;
        svg += `<circle cx="${x.toFixed(1)}" cy="${yOf(r.posT).toFixed(1)}" r="4" class="pmf-dot pmf-dot-you"><title>${pmfXmlEscape(tipYou)}</title></circle>`;
    });

    svg += '</svg>';
    container.innerHTML = svg + `
        <div class="rpc-legend pmf-legend">
            <span><span class="pmf-key pmf-key-you"></span> Vous</span>
            <span><span class="pmf-key pmf-key-opp"></span> Adversaire du jour</span>
        </div>`;
}

// Graphique 2 : buts marqués (lignes pleines) et encaissés (pointillés),
// total saison avant chaque match, une couleur par équipe (vous / adversaire
// du jour, qui change chaque journée).
function renderPmfGoalsChart(rows) {
    const container = document.getElementById('pmfGoalsChart');
    if (!container) return;
    if (rows.length === 0) { pmfEmptyChart(container); return; }

    const maxVal = Math.max(1, ...rows.flatMap(r => [r.gfT, r.gaT, r.gfO, r.gaO]));
    const W = 680, H = 280;
    const padL = 28, padR = 12, padT = 14, padB = 46;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = rows.length;
    const xOf = pmfXScale(n, plotW, padL);
    const yOf = v => padT + plotH - (v / maxVal) * plotH;
    const step = pmfNiceStep(maxVal);
    const labelEvery = n > 20 ? 2 : 1;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="pmf-svg" role="img" aria-label="Buts marqués et encaissés, saison, avant chaque match">`;

    for (let v = 0; v <= maxVal; v += step) {
        const y = yOf(v);
        svg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="pmf-grid"/>`;
        svg += `<text x="${(padL - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="pmf-axis">${v}</text>`;
    }
    rows.forEach((r, i) => {
        if (i % labelEvery === 0) {
            svg += `<text x="${xOf(i).toFixed(1)}" y="${(H - padB + 16).toFixed(1)}" text-anchor="middle" class="pmf-axis">J${r.day}</text>`;
        }
    });

    const buildLine = key => rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(r[key]).toFixed(1)}`).join(' ');
    svg += `<path d="${buildLine('gaO')}" class="pmf-line pmf-line-opp pmf-dash"/>`;
    svg += `<path d="${buildLine('gaT')}" class="pmf-line pmf-line-you pmf-dash"/>`;
    svg += `<path d="${buildLine('gfO')}" class="pmf-line pmf-line-opp"/>`;
    svg += `<path d="${buildLine('gfT')}" class="pmf-line pmf-line-you"/>`;

    rows.forEach((r, i) => {
        const x = xOf(i);
        const oppName = r.opponent ? (r.opponent.shortName || r.opponent.name) : '?';
        const tipGf = `J${r.day} vs ${oppName} — marqués (saison) : vous ${r.gfT}, adv. ${r.gfO}`;
        const tipGa = `J${r.day} vs ${oppName} — encaissés (saison) : vous ${r.gaT}, adv. ${r.gaO}`;
        svg += `<circle cx="${x.toFixed(1)}" cy="${yOf(r.gfT).toFixed(1)}" r="3" class="pmf-dot pmf-dot-you"><title>${pmfXmlEscape(tipGf)}</title></circle>`;
        svg += `<circle cx="${x.toFixed(1)}" cy="${yOf(r.gfO).toFixed(1)}" r="3" class="pmf-dot pmf-dot-opp"><title>${pmfXmlEscape(tipGf)}</title></circle>`;
        svg += `<circle cx="${x.toFixed(1)}" cy="${yOf(r.gaT).toFixed(1)}" r="3" class="pmf-dot pmf-dot-you"><title>${pmfXmlEscape(tipGa)}</title></circle>`;
        svg += `<circle cx="${x.toFixed(1)}" cy="${yOf(r.gaO).toFixed(1)}" r="3" class="pmf-dot pmf-dot-opp"><title>${pmfXmlEscape(tipGa)}</title></circle>`;
    });

    svg += '</svg>';
    container.innerHTML = svg + `
        <div class="rpc-legend pmf-legend">
            <span><span class="pmf-key pmf-key-you"></span> Vous — marqués</span>
            <span><span class="pmf-key pmf-key-you pmf-key-dash"></span> Vous — encaissés</span>
            <span><span class="pmf-key pmf-key-opp"></span> Adversaire — marqués</span>
            <span><span class="pmf-key pmf-key-opp pmf-key-dash"></span> Adversaire — encaissés</span>
        </div>`;
}

// Graphique 3 : dynamique récente — écart (vous − adversaire) sur les buts
// marqués et encaissés de leurs 5 derniers matchs respectifs. Au-dessus de 0
// = vous étiez en meilleure forme que l'adversaire sur cette période.
function renderPmfFormChart(rows) {
    const container = document.getElementById('pmfFormChart');
    if (!container) return;
    if (rows.length === 0) { pmfEmptyChart(container); return; }

    const diffs = rows.map(r => ({
        day: r.day, opponent: r.opponent,
        gf: r.last5T.gf - r.last5O.gf, ga: r.last5T.ga - r.last5O.ga,
        countT: r.last5T.count, countO: r.last5O.count
    }));
    const maxAbs = Math.max(3, ...diffs.flatMap(d => [Math.abs(d.gf), Math.abs(d.ga)]));
    const W = 680, H = 280;
    const padL = 28, padR = 12, padT = 14, padB = 46;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = diffs.length;
    const xOf = pmfXScale(n, plotW, padL);
    const yOf = v => padT + plotH / 2 - (v / maxAbs) * (plotH / 2);
    const zeroY = yOf(0);
    const step = pmfNiceStep(maxAbs);
    const labelEvery = n > 20 ? 2 : 1;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="pmf-svg" role="img" aria-label="Dynamique récente : écart de buts sur 5 matchs, vous contre l'adversaire du jour">`;

    for (let v = -Math.floor(maxAbs / step) * step; v <= maxAbs; v += step) {
        const y = yOf(v);
        svg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" class="pmf-grid"/>`;
        svg += `<text x="${(padL - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="pmf-axis">${v > 0 ? '+' + v : v}</text>`;
    }
    svg += `<line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W - padR}" y2="${zeroY.toFixed(1)}" class="pmf-zero"/>`;
    diffs.forEach((d, i) => {
        if (i % labelEvery === 0) {
            svg += `<text x="${xOf(i).toFixed(1)}" y="${(H - padB + 16).toFixed(1)}" text-anchor="middle" class="pmf-axis">J${d.day}</text>`;
        }
    });

    const buildLine = key => diffs.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(d[key]).toFixed(1)}`).join(' ');
    svg += `<path d="${buildLine('ga')}" class="pmf-line pmf-line-ga pmf-dash"/>`;
    svg += `<path d="${buildLine('gf')}" class="pmf-line pmf-line-gf"/>`;

    diffs.forEach((d, i) => {
        const x = xOf(i);
        const oppName = d.opponent ? (d.opponent.shortName || d.opponent.name) : '?';
        const period = `vous sur ${d.countT} match${d.countT > 1 ? 's' : ''}, adv. sur ${d.countO} match${d.countO > 1 ? 's' : ''}`;
        const tipGf = `J${d.day} vs ${oppName} — écart buts marqués (5 derniers) : ${d.gf > 0 ? '+' : ''}${d.gf} (${period})`;
        const tipGa = `J${d.day} vs ${oppName} — écart buts encaissés (5 derniers) : ${d.ga > 0 ? '+' : ''}${d.ga} (${period})`;
        svg += `<circle cx="${x.toFixed(1)}" cy="${yOf(d.gf).toFixed(1)}" r="3.5" class="pmf-dot pmf-dot-gf"><title>${pmfXmlEscape(tipGf)}</title></circle>`;
        svg += `<circle cx="${x.toFixed(1)}" cy="${yOf(d.ga).toFixed(1)}" r="3.5" class="pmf-dot pmf-dot-ga"><title>${pmfXmlEscape(tipGa)}</title></circle>`;
    });

    svg += '</svg>';
    container.innerHTML = svg + `
        <div class="rpc-legend pmf-legend">
            <span><span class="pmf-key pmf-key-gf"></span> Écart buts marqués (vous − adv., 5 derniers)</span>
            <span><span class="pmf-key pmf-key-ga pmf-key-dash"></span> Écart buts encaissés (vous − adv., 5 derniers)</span>
        </div>`;
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
        renderPmfRankChart([], 0);
        renderPmfGoalsChart([]);
        renderPmfFormChart([]);
        renderPmfTable([]);
        return;
    }
    const rows = pmfComputeRows(select.value);
    const nPositions = pmfTeams().length;
    renderPmfRankChart(rows, nPositions);
    renderPmfGoalsChart(rows);
    renderPmfFormChart(rows);
    renderPmfTable(rows);
}
