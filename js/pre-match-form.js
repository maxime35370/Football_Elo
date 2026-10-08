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

// Le prochain match NON joué de l'équipe (calendrier généré dans l'onglet
// Calendrier), le plus proche en numéro de journée. null si rien n'est
// programmé après son dernier match joué.
function pmfNextMatch(teamId) {
    const season = pmfSeason();
    const future = (typeof loadFutureMatches === 'function') ? loadFutureMatches(season) : [];
    if (future.length === 0) return null;

    // Une affiche du calendrier reste en base même une fois son match joué
    // (storage.js) : on écarte celles dont le résultat existe déjà
    const playedKeys = new Set(
        getStoredMatches()
            .filter(m => m.season === season && m.finalScore)
            .map(m => `${m.homeTeamId}-${m.awayTeamId}`)
    );

    const candidates = future
        .filter(m => (!m.season || m.season === season) &&
            !playedKeys.has(`${m.homeTeamId}-${m.awayTeamId}`) &&
            (String(m.homeTeamId) === String(teamId) || String(m.awayTeamId) === String(teamId)))
        .sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));

    return candidates[0] || null;
}

// Projection pour le prochain match programmé : mêmes calculs que les
// journées déjà jouées, mais avec TOUS les matchs joués à ce jour (le
// classement/les buts ne bougeront plus avant son coup d'envoi)
function pmfComputePreviewRow(teamId) {
    const nextMatch = pmfNextMatch(teamId);
    if (!nextMatch) return null;

    const season = pmfSeason();
    const teams = pmfTeams();
    const seasonMatches = getStoredMatches().filter(m => m.season === season && m.finalScore);
    const isHome = String(nextMatch.homeTeamId) === String(teamId);
    const oppId = isHome ? nextMatch.awayTeamId : nextMatch.homeTeamId;

    const standings = pmfStandingsBefore(seasonMatches, Infinity, teams);
    const rowT = standings.find(r => String(r.id) === String(teamId));
    const rowO = standings.find(r => String(r.id) === String(oppId));
    if (!rowT || !rowO) return null;
    const posT = standings.indexOf(rowT) + 1;
    const posO = standings.indexOf(rowO) + 1;

    return {
        day: nextMatch.matchDay || 0, opponent: getTeamById(oppId), isHome,
        posT, posO,
        ptsT: rowT.points, ptsO: rowO.points, gap: rowT.points - rowO.points,
        playedBeforeT: rowT.played, playedBeforeO: rowO.played,
        gfT: rowT.goalsFor, gaT: rowT.goalsAgainst,
        gfO: rowO.goalsFor, gaO: rowO.goalsAgainst,
        last5T: pmfLast5(teamId, seasonMatches, Infinity),
        last5O: pmfLast5(oppId, seasonMatches, Infinity),
        isPreview: true
    };
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

// Découpe une série en deux tracés : la ligne pleine sur les journées déjà
// jouées, et un segment pointillé reliant la dernière journée jouée au
// prochain match (projection) quand il y en a un.
function pmfSplitPaths(rows, xOf, valueOf) {
    const n = rows.length;
    const hasPreview = n > 0 && rows[n - 1].isPreview;
    const histCount = hasPreview ? n - 1 : n;

    let main = '';
    for (let i = 0; i < histCount; i++) {
        main += `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${valueOf(rows[i]).toFixed(1)} `;
    }

    let preview = '';
    if (hasPreview && histCount > 0) {
        preview = `M${xOf(histCount - 1).toFixed(1)},${valueOf(rows[histCount - 1]).toFixed(1)} `
            + `L${xOf(histCount).toFixed(1)},${valueOf(rows[histCount]).toFixed(1)}`;
    }

    return { main: main.trim(), preview };
}

function pmfDot(x, y, cls, isPreview, tip) {
    const previewCls = isPreview ? ' pmf-dot-preview' : '';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isPreview ? 4.5 : 3.5}" class="pmf-dot ${cls}${previewCls}"><title>${pmfXmlEscape(tip)}</title></circle>`;
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

    const pathsOpp = pmfSplitPaths(rows, xOf, r => yOf(r.posO));
    const pathsYou = pmfSplitPaths(rows, xOf, r => yOf(r.posT));
    svg += `<path d="${pathsOpp.main}" class="pmf-line pmf-line-opp"/>`;
    if (pathsOpp.preview) svg += `<path d="${pathsOpp.preview}" class="pmf-line pmf-line-opp pmf-preview"/>`;
    svg += `<path d="${pathsYou.main}" class="pmf-line pmf-line-you"/>`;
    if (pathsYou.preview) svg += `<path d="${pathsYou.preview}" class="pmf-line pmf-line-you pmf-preview"/>`;

    rows.forEach((r, i) => {
        const x = xOf(i);
        const oppName = r.opponent ? (r.opponent.shortName || r.opponent.name) : '?';
        const venue = r.isHome ? 'D' : 'E';
        const gapTxt = r.gap > 0 ? `+${r.gap}` : `${r.gap}`;
        const when = r.isPreview ? ` — prochain match (projection à date)` : '';
        const tipOpp = `J${r.day} — adversaire : ${oppName} (${venue}), ${pmfOrdinal(r.posO)}, ${r.ptsO} pt${r.ptsO > 1 ? 's' : ''}${when}`;
        const tipYou = `J${r.day} — vous : ${pmfOrdinal(r.posT)}, ${r.ptsT} pt${r.ptsT > 1 ? 's' : ''} (écart ${gapTxt} pt${Math.abs(r.gap) > 1 ? 's' : ''} vs ${oppName})${when}`;
        svg += pmfDot(x, yOf(r.posO), 'pmf-dot-opp', r.isPreview, tipOpp);
        svg += pmfDot(x, yOf(r.posT), 'pmf-dot-you', r.isPreview, tipYou);
    });

    svg += '</svg>';
    container.innerHTML = svg + `
        <div class="rpc-legend pmf-legend">
            <span><span class="pmf-key pmf-key-you"></span> Vous</span>
            <span><span class="pmf-key pmf-key-opp"></span> Adversaire du jour</span>
            ${rows.some(r => r.isPreview) ? '<span>⋯ Prochain match (projection à date)</span>' : ''}
        </div>`;
}

// Panneau latéral : combien de fois l'équipe affrontait un adversaire plus
// fort, de niveau équivalent (± 2 places), ou plus faible — classé sur les
// seules journées déjà jouées (la projection n'est pas un fait acquis)
function pmfRankCompare(r) {
    const diff = r.posO - r.posT; // > 0 : vous étiez mieux classé
    if (diff > 2) return 'stronger';
    if (diff < -2) return 'weaker';
    return 'equal';
}

function renderPmfStrengthSummary(rows) {
    const container = document.getElementById('pmfRankSummary');
    if (!container) return;

    const played = rows.filter(r => !r.isPreview);
    if (played.length === 0) { container.innerHTML = ''; return; }

    const counts = { stronger: 0, equal: 0, weaker: 0 };
    played.forEach(r => counts[pmfRankCompare(r)]++);

    container.innerHTML = `
        <div class="pmf-strength-item stronger">
            <span class="pmf-strength-value">${counts.stronger}</span>
            <span class="pmf-strength-label">fois plus forte que l'adversaire<br>(plus de 2 places d'écart)</span>
        </div>
        <div class="pmf-strength-item equal">
            <span class="pmf-strength-value">${counts.equal}</span>
            <span class="pmf-strength-label">fois de niveau équivalent<br>(± 2 places)</span>
        </div>
        <div class="pmf-strength-item weaker">
            <span class="pmf-strength-value">${counts.weaker}</span>
            <span class="pmf-strength-label">fois plus faible que l'adversaire<br>(plus de 2 places d'écart)</span>
        </div>
    `;
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

    [['gaO', 'pmf-line-opp pmf-dash'], ['gaT', 'pmf-line-you pmf-dash'], ['gfO', 'pmf-line-opp'], ['gfT', 'pmf-line-you']].forEach(([key, cls]) => {
        const paths = pmfSplitPaths(rows, xOf, r => yOf(r[key]));
        svg += `<path d="${paths.main}" class="pmf-line ${cls}"/>`;
        if (paths.preview) svg += `<path d="${paths.preview}" class="pmf-line ${cls} pmf-preview"/>`;
    });

    rows.forEach((r, i) => {
        const x = xOf(i);
        const oppName = r.opponent ? (r.opponent.shortName || r.opponent.name) : '?';
        const when = r.isPreview ? ' — prochain match (à date)' : '';
        const tipGf = `J${r.day} vs ${oppName} — marqués (saison) : vous ${r.gfT}, adv. ${r.gfO}${when}`;
        const tipGa = `J${r.day} vs ${oppName} — encaissés (saison) : vous ${r.gaT}, adv. ${r.gaO}${when}`;
        svg += pmfDot(x, yOf(r.gfT), 'pmf-dot-you', r.isPreview, tipGf);
        svg += pmfDot(x, yOf(r.gfO), 'pmf-dot-opp', r.isPreview, tipGf);
        svg += pmfDot(x, yOf(r.gaT), 'pmf-dot-you', r.isPreview, tipGa);
        svg += pmfDot(x, yOf(r.gaO), 'pmf-dot-opp', r.isPreview, tipGa);
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
        day: r.day, opponent: r.opponent, isPreview: r.isPreview,
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

    const pathsGa = pmfSplitPaths(diffs, xOf, d => yOf(d.ga));
    const pathsGf = pmfSplitPaths(diffs, xOf, d => yOf(d.gf));
    svg += `<path d="${pathsGa.main}" class="pmf-line pmf-line-ga pmf-dash"/>`;
    if (pathsGa.preview) svg += `<path d="${pathsGa.preview}" class="pmf-line pmf-line-ga pmf-dash pmf-preview"/>`;
    svg += `<path d="${pathsGf.main}" class="pmf-line pmf-line-gf"/>`;
    if (pathsGf.preview) svg += `<path d="${pathsGf.preview}" class="pmf-line pmf-line-gf pmf-preview"/>`;

    diffs.forEach((d, i) => {
        const x = xOf(i);
        const oppName = d.opponent ? (d.opponent.shortName || d.opponent.name) : '?';
        const period = `vous sur ${d.countT} match${d.countT > 1 ? 's' : ''}, adv. sur ${d.countO} match${d.countO > 1 ? 's' : ''}`;
        const when = d.isPreview ? ' — prochain match (à date)' : '';
        const tipGf = `J${d.day} vs ${oppName} — écart buts marqués (5 derniers) : ${d.gf > 0 ? '+' : ''}${d.gf} (${period})${when}`;
        const tipGa = `J${d.day} vs ${oppName} — écart buts encaissés (5 derniers) : ${d.ga > 0 ? '+' : ''}${d.ga} (${period})${when}`;
        svg += pmfDot(x, yOf(d.gf), 'pmf-dot-gf', d.isPreview, tipGf);
        svg += pmfDot(x, yOf(d.ga), 'pmf-dot-ga', d.isPreview, tipGa);
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
        const dayLabel = r.isPreview ? `${r.day} <span class="pmf-preview-badge">à venir</span>` : r.day;
        const rowCls = r.isPreview ? ' class="pmf-row-preview"' : '';

        return `
            <tr${rowCls}>
                <td>${dayLabel}</td>
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
        renderPmfStrengthSummary([]);
        renderPmfTable([]);
        return;
    }
    const rows = pmfComputeRows(select.value);
    const preview = pmfComputePreviewRow(select.value);
    const rowsWithPreview = preview ? [...rows, preview] : rows;
    const nPositions = pmfTeams().length;

    renderPmfRankChart(rowsWithPreview, nPositions);
    renderPmfGoalsChart(rowsWithPreview);
    renderPmfFormChart(rowsWithPreview);
    renderPmfStrengthSummary(rows);
    renderPmfTable(rowsWithPreview);
}
