// calendar-tree.js - Arbre de probabilités exhaustif pour une journée
// Génère tous les scénarios possibles (3^N) et calcule la distribution des positions
// OPTIMISÉ : bucket sort O(n) + Int32Array + tableau plat de probas + deltas pré-calculés

// ===============================
// INJECTION DES STYLES
// ===============================
(function() {
    if (document.getElementById('treeStyles')) return;
    const style = document.createElement('style');
    style.id = 'treeStyles';
    style.textContent = `
        .tree-intro {
            text-align: center;
            padding: 1.5rem;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            border-radius: 12px;
            margin-bottom: 1.5rem;
        }
        .tree-intro h3 { margin: 0 0 0.5rem 0; color: #2c3e50; }
        .tree-intro .scenario-count {
            font-size: 1.4rem;
            font-weight: bold;
            color: #8e44ad;
        }
        .tree-calc-time {
            font-size: 0.8rem;
            color: #95a5a6;
            margin-top: 0.5rem;
        }
        .tree-selector {
            text-align: center;
            margin-bottom: 1rem;
            padding: 0.75rem;
            background: #f8f9fa;
            border-radius: 10px;
        }
        .tree-selector select {
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            border: 2px solid #3498db;
            font-size: 0.95rem;
            margin-left: 0.5rem;
        }

        /* Multi-journées */
        .tree-multi-selector {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
            margin-bottom: 1rem;
            padding: 0.75rem;
            background: #f8f9fa;
            border-radius: 10px;
        }
        .tree-multi-selector label {
            font-weight: 600;
            color: #2c3e50;
        }
        .tree-multi-selector select {
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            border: 2px solid #3498db;
            font-size: 0.95rem;
        }
        .tree-add-day-btn {
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            border: 2px solid #8e44ad;
            background: white;
            color: #8e44ad;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s;
        }
        .tree-add-day-btn:hover {
            background: #8e44ad;
            color: white;
        }
        .tree-add-day-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        .tree-add-day-btn:disabled:hover {
            background: white;
            color: #8e44ad;
        }
        .tree-selected-days {
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            flex-wrap: wrap;
            margin-bottom: 0.5rem;
        }
        .tree-day-tag {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            padding: 0.3rem 0.7rem;
            background: #8e44ad;
            color: white;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .tree-day-tag .remove-day {
            cursor: pointer;
            margin-left: 0.2rem;
            opacity: 0.7;
            font-size: 0.9rem;
        }
        .tree-day-tag .remove-day:hover { opacity: 1; }
        .tree-match-total {
            font-size: 0.85rem;
            color: #7f8c8d;
            margin-top: 0.3rem;
        }
        .tree-match-total .count-ok { color: #27ae60; font-weight: 600; }
        .tree-match-total .count-warn { color: #e67e22; font-weight: 600; }
        .tree-match-total .count-over { color: #e74c3c; font-weight: 600; }

        /* Matchs analysés */
        .tree-matches-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 0.6rem;
            margin-bottom: 1.5rem;
        }
        .tree-match-card {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 0.6rem 0.8rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
            border-left: 3px solid #8e44ad;
        }
        .tree-match-day-label {
            font-size: 0.65rem;
            color: #8e44ad;
            font-weight: 600;
            margin-right: 0.3rem;
        }
        .tree-match-probs {
            display: flex;
            gap: 0.2rem;
            font-size: 0.75rem;
        }
        .tree-match-probs span {
            padding: 0.15rem 0.4rem;
            border-radius: 4px;
            font-weight: 600;
        }
        .prob-home { background: #d4edda; color: #155724; }
        .prob-draw { background: #fff3cd; color: #856404; }
        .prob-away { background: #f8d7da; color: #721c24; }

        /* Toggle mode */
        .tree-mode-toggle {
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }
        .tree-mode-btn {
            padding: 0.5rem 1.2rem;
            border: 2px solid #8e44ad;
            border-radius: 20px;
            background: white;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            transition: all 0.2s;
        }
        .tree-mode-btn:hover { background: #f3e8fa; }
        .tree-mode-btn.active {
            background: #8e44ad;
            color: white;
        }

        /* Heatmap */
        .tree-heatmap-container {
            overflow-x: auto;
            margin-bottom: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .tree-heatmap {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.78rem;
        }
        .tree-heatmap thead th {
            padding: 0.5rem 0.3rem;
            background: #2c3e50;
            color: white;
            position: sticky;
            top: 0;
            z-index: 2;
            font-size: 0.75rem;
        }
        .tree-heatmap thead th:first-child,
        .tree-heatmap thead th:nth-child(2) {
            position: sticky;
            left: 0;
            z-index: 3;
        }
        .tree-heatmap td {
            padding: 0.35rem 0.25rem;
            text-align: center;
            border: 1px solid #e9ecef;
            min-width: 42px;
        }
        .tree-heatmap td.team-name {
            text-align: left;
            font-weight: 600;
            min-width: 70px;
            padding-left: 0.5rem;
            background: #f8f9fa;
            position: sticky;
            left: 0;
            z-index: 1;
            white-space: nowrap;
        }
        .tree-heatmap td.current-pts {
            font-weight: bold;
            background: #f8f9fa;
            position: sticky;
            left: 70px;
            z-index: 1;
        }
        .tree-heatmap td.summary-best { color: #27ae60; font-weight: bold; }
        .tree-heatmap td.summary-worst { color: #e74c3c; font-weight: bold; }
        .tree-heatmap td.summary-likely { color: #8e44ad; font-weight: bold; }
        .tree-heatmap td.pts-range { font-size: 0.7rem; color: #7f8c8d; white-space: nowrap; }

        .tree-heatmap tr.champion-zone td.team-name { border-left: 4px solid #f1c40f; }
        .tree-heatmap tr.european-zone td.team-name { border-left: 4px solid #3498db; }
        .tree-heatmap tr.relegation-zone td.team-name { border-left: 4px solid #e74c3c; }

        .tree-empty {
            text-align: center;
            padding: 2rem;
            color: #7f8c8d;
        }

        /* Légende */
        .tree-legend {
            display: flex;
            justify-content: center;
            gap: 1.5rem;
            margin-top: 1rem;
            font-size: 0.8rem;
            color: #7f8c8d;
            flex-wrap: wrap;
        }
        .tree-legend span::before {
            content: '';
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 3px;
            margin-right: 4px;
            vertical-align: middle;
        }
        .tree-legend .leg-champion::before { background: hsla(48, 70%, 50%, 0.6); }
        .tree-legend .leg-europe::before { background: hsla(210, 70%, 50%, 0.6); }
        .tree-legend .leg-mid::before { background: hsla(120, 70%, 50%, 0.3); }
        .tree-legend .leg-relegation::before { background: hsla(0, 70%, 50%, 0.6); }

        @media (max-width: 768px) {
            .tree-matches-grid { grid-template-columns: 1fr; }
            .tree-heatmap { font-size: 0.7rem; }
            .tree-heatmap td { min-width: 35px; padding: 0.25rem 0.15rem; }
            .tree-multi-selector { flex-direction: column; gap: 0.5rem; }
        }

        /* Sélecteur de limite */
        .tree-limit-bar {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
            padding: 0.5rem 0.75rem;
            background: rgba(142, 68, 173, 0.08);
            border-radius: 8px;
            font-size: 0.8rem;
        }
        .tree-limit-bar label {
            color: #7f8c8d;
            font-weight: 500;
        }
        .tree-limit-bar select {
            padding: 0.25rem 0.5rem;
            border-radius: 6px;
            border: 1.5px solid #8e44ad;
            font-size: 0.8rem;
            color: #8e44ad;
            font-weight: 600;
            background: white;
        }
    `;
    document.head.appendChild(style);
})();

// ===============================
// CONSTANTES
// ===============================

let TREE_MAX_MATCHES = 13;

const TREE_LIMIT_OPTIONS = [
    { value: 9,  label: '9 matchs',  detail: '~20K scén. • instantané' },
    { value: 11, label: '11 matchs', detail: '~177K scén. • <1 sec' },
    { value: 13, label: '13 matchs', detail: '~1.6M scén. • ~1 sec' },
    { value: 15, label: '15 matchs', detail: '~14M scén. • ~10 sec ⚠️' },
    { value: 18, label: '18 matchs', detail: '~387M scén. • très long ⛔' },
];

// ===============================
// JOURNÉES DISPONIBLES
// ===============================

function getAvailableTreeMatchdays() {
    const playedKeys = new Set(
        allMatches.map(m => `${m.homeTeamId}-${m.awayTeamId}-${m.matchDay}`)
    );

    const realFuture = futureMatches.filter(m =>
        !playedKeys.has(`${m.homeTeamId}-${m.awayTeamId}-${m.matchDay}`)
    );

    const byDay = {};
    realFuture.forEach(m => {
        const day = m.matchDay || 0;
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(m);
    });

    return Object.entries(byDay)
        .map(([day, matches]) => ({
            day: Number(day),
            count: matches.length,
            matches
        }))
        .sort((a, b) => a.day - b.day);
}

function getMatchesForDays(selectedDays) {
    const available = getAvailableTreeMatchdays();
    const allUnplayed = [];
    const allPlayed = [];
    const dayDetails = [];

    selectedDays.forEach(day => {
        const dayData = available.find(d => d.day === day);
        if (dayData) {
            allUnplayed.push(...dayData.matches);
            dayDetails.push({ day, unplayed: dayData.count });
        }
        const played = allMatches.filter(m => m.matchDay === day);
        allPlayed.push(...played);
    });

    return {
        matchDays: selectedDays,
        unplayedMatches: allUnplayed,
        playedMatches: allPlayed,
        dayDetails,
        isPartial: allPlayed.length > 0,
        totalUnplayed: allUnplayed.length
    };
}

// ===============================
// CLASSEMENT ACTUEL
// ===============================

function getTreeCurrentStandings() {
    const standings = {};

    allTeams.forEach(team => {
        let stats;
        if (typeof calculateTeamStats === 'function') {
            stats = calculateTeamStats(team.id);
        } else {
            stats = treeComputeBasicStats(team.id);
        }

        standings[team.id] = {
            id: team.id,
            name: team.name,
            shortName: team.shortName || team.name.substring(0, 3).toUpperCase(),
            points: stats.points || 0,
            goalDifference: (stats.goalsFor || 0) - (stats.goalsAgainst || 0),
            goalsFor: stats.goalsFor || 0,
            played: stats.played || 0
        };
    });

    return standings;
}

function treeComputeBasicStats(teamId) {
    const stats = { points: 0, goalsFor: 0, goalsAgainst: 0, played: 0 };

    allMatches.forEach(m => {
        if (!m.finalScore) return;
        const isHome = m.homeTeamId == teamId;
        const isAway = m.awayTeamId == teamId;
        if (!isHome && !isAway) return;

        stats.played++;
        const hg = m.finalScore.home;
        const ag = m.finalScore.away;

        if (isHome) {
            stats.goalsFor += hg;
            stats.goalsAgainst += ag;
            if (hg > ag) stats.points += 3;
            else if (hg === ag) stats.points += 1;
        } else {
            stats.goalsFor += ag;
            stats.goalsAgainst += hg;
            if (ag > hg) stats.points += 3;
            else if (hg === ag) stats.points += 1;
        }
    });

    return stats;
}

// ===============================
// PROBABILITÉS ELO
// ===============================

function getTreeMatchProbabilities(match) {
    if (typeof EloSystem !== 'undefined' && teamsWithElo && teamsWithElo.length > 0) {
        const pred = EloSystem.predictMatch(match.homeTeamId, match.awayTeamId, teamsWithElo);
        if (pred) {
            return [
                pred.homeTeam.winProbability / 100,
                pred.drawProbability / 100,
                pred.awayTeam.winProbability / 100
            ];
        }
    }
    return [1 / 3, 1 / 3, 1 / 3];
}

// ===============================
// CALCUL EXHAUSTIF — OPTIMISÉ + PROGRESSION
// ===============================
// Optimisations :
// 1. Bucket sort O(n) au lieu de Array.sort O(n·log n)
// 2. Int32Array pour les entiers
// 3. Tableau plat flatProbs[j*3+outcome] — cache-friendly
// 4. Deltas pré-calculés
// 5. (code-outcome)/3 au lieu de Math.floor
// 6. Chunked async avec barre de progression si > 500K scénarios

const TREE_CHUNK_SIZE = 50000; // Scénarios par chunk
const TREE_PROGRESS_THRESHOLD = 500000; // Afficher progression si > ce seuil

function computeTreeScenarios(matches, baseStandings, onProgress) {
    const n = matches.length;
    const total = Math.pow(3, n);
    const teamIds = allTeams.map(t => t.id);
    const teamCount = teamIds.length;

    const teamIndex = {};
    teamIds.forEach((id, idx) => { teamIndex[id] = idx; });

    const basePoints = new Int32Array(teamCount);
    const baseGD = new Int32Array(teamCount);
    const baseGF = new Int32Array(teamCount);

    teamIds.forEach((id, idx) => {
        basePoints[idx] = baseStandings[id].points;
        baseGD[idx] = baseStandings[id].goalDifference;
        baseGF[idx] = baseStandings[id].goalsFor;
    });

    const homeIdx = new Int32Array(matches.map(m => teamIndex[m.homeTeamId]));
    const awayIdx = new Int32Array(matches.map(m => teamIndex[m.awayTeamId]));

    const matchProbs = matches.map(m => getTreeMatchProbabilities(m));
    const flatProbs = new Float64Array(n * 3);
    for (let j = 0; j < n; j++) {
        flatProbs[j * 3]     = matchProbs[j][0];
        flatProbs[j * 3 + 1] = matchProbs[j][1];
        flatProbs[j * 3 + 2] = matchProbs[j][2];
    }

    const homeDeltas = new Int32Array(n * 3);
    const awayDeltas = new Int32Array(n * 3);
    for (let j = 0; j < n; j++) {
        homeDeltas[j * 3]     = 3; awayDeltas[j * 3]     = 0;
        homeDeltas[j * 3 + 1] = 1; awayDeltas[j * 3 + 1] = 1;
        homeDeltas[j * 3 + 2] = 0; awayDeltas[j * 3 + 2] = 3;
    }

    const positionCounts = Array.from({ length: teamCount }, () => new Float64Array(teamCount));
    const positionProbs = Array.from({ length: teamCount }, () => new Float64Array(teamCount));
    const minPts = new Int32Array(teamCount).fill(0x7FFFFFFF);
    const maxPts = new Int32Array(teamCount).fill(-0x7FFFFFFF);

    const scenPts = new Int32Array(teamCount);

    let globalMaxPts = 0;
    for (let t = 0; t < teamCount; t++) {
        if (basePoints[t] > globalMaxPts) globalMaxPts = basePoints[t];
    }
    const maxPossiblePts = globalMaxPts + n * 3;
    const bucketSize = maxPossiblePts + 1;
    const buckets = new Int32Array(bucketSize * teamCount);
    const bucketLen = new Int32Array(bucketSize);
    const sortResult = new Int32Array(teamCount);

    // Fonction de calcul d'un chunk [start, end)
    function processChunk(start, end) {
        for (let i = start; i < end; i++) {
            scenPts.set(basePoints);

            let scenProb = 1;
            let code = i;

            for (let j = 0; j < n; j++) {
                const outcome = code % 3;
                code = (code - outcome) / 3;

                const j3 = j * 3 + outcome;
                scenProb *= flatProbs[j3];
                scenPts[homeIdx[j]] += homeDeltas[j3];
                scenPts[awayIdx[j]] += awayDeltas[j3];
            }

            let usedMin = maxPossiblePts, usedMax = 0;
            for (let t = 0; t < teamCount; t++) {
                const pts = scenPts[t];
                if (pts < usedMin) usedMin = pts;
                if (pts > usedMax) usedMax = pts;
                buckets[pts * teamCount + bucketLen[pts]] = t;
                bucketLen[pts]++;
            }

            let pos = 0;
            for (let pts = usedMax; pts >= usedMin; pts--) {
                const len = bucketLen[pts];
                if (len === 0) continue;

                if (len === 1) {
                    sortResult[pos++] = buckets[pts * teamCount];
                } else {
                    const start = pos;
                    for (let k = 0; k < len; k++) {
                        sortResult[pos++] = buckets[pts * teamCount + k];
                    }
                    for (let a = start + 1; a < pos; a++) {
                        const val = sortResult[a];
                        const valGD = baseGD[val];
                        const valGF = baseGF[val];
                        let b = a - 1;
                        while (b >= start) {
                            const cmp = sortResult[b];
                            if (baseGD[cmp] > valGD || (baseGD[cmp] === valGD && baseGF[cmp] >= valGF)) break;
                            sortResult[b + 1] = sortResult[b];
                            b--;
                        }
                        sortResult[b + 1] = val;
                    }
                }

                bucketLen[pts] = 0;
            }

            for (let p = 0; p < teamCount; p++) {
                const tIdx = sortResult[p];
                positionCounts[tIdx][p] += 1;
                positionProbs[tIdx][p] += scenProb;
            }

            for (let t = 0; t < teamCount; t++) {
                const pts = scenPts[t];
                if (pts < minPts[t]) minPts[t] = pts;
                if (pts > maxPts[t]) maxPts[t] = pts;
            }
        }
    }

    const result = {
        total,
        teamIds,
        teamIndex,
        teamCount,
        positionCounts,
        positionProbs,
        minPts,
        maxPts,
        matchProbs,
        basePoints
    };

    // Si petit calcul ou pas de callback → synchrone
    if (total <= TREE_PROGRESS_THRESHOLD || !onProgress) {
        processChunk(0, total);
        return result;
    }

    // Sinon → Promise avec chunks async
    return new Promise((resolve) => {
        let current = 0;

        function nextChunk() {
            const end = Math.min(current + TREE_CHUNK_SIZE, total);
            processChunk(current, end);
            current = end;

            const pct = Math.round((current / total) * 100);
            onProgress(pct, current, total);

            if (current < total) {
                setTimeout(nextChunk, 0); // Laisse l'UI respirer
            } else {
                resolve(result);
            }
        }

        nextChunk();
    });
}

// ===============================
// AFFICHAGE PRINCIPAL
// ===============================

let _treeSelectedDays = [];

function displayProbabilityTree(selectedDay) {
    const container = document.getElementById('treeTab');
    if (!container) return;

    const available = getAvailableTreeMatchdays();

    if (available.length === 0) {
        container.innerHTML = '<div class="tree-empty"><p>🌳 Aucun match à venir pour l\'arbre de probabilités.</p></div>';
        return;
    }

    if (_treeSelectedDays.length === 0) {
        _treeSelectedDays = [available[0].day];
    }

    if (selectedDay !== undefined && selectedDay !== null) {
        _treeSelectedDays = [selectedDay];
    }

    renderTreeUI(container, available);
}

function addTreeDay(day) {
    if (_treeSelectedDays.includes(day)) return;
    _treeSelectedDays.push(day);
    _treeSelectedDays.sort((a, b) => a - b);

    const container = document.getElementById('treeTab');
    const available = getAvailableTreeMatchdays();
    renderTreeUI(container, available);
}

function removeTreeDay(day) {
    _treeSelectedDays = _treeSelectedDays.filter(d => d !== day);
    if (_treeSelectedDays.length === 0) {
        const available = getAvailableTreeMatchdays();
        if (available.length > 0) _treeSelectedDays = [available[0].day];
    }

    const container = document.getElementById('treeTab');
    const available = getAvailableTreeMatchdays();
    renderTreeUI(container, available);
}

function changeTreePrimaryDay(day) {
    _treeSelectedDays = [day];
    const container = document.getElementById('treeTab');
    const available = getAvailableTreeMatchdays();
    renderTreeUI(container, available);
}

function changeTreeLimit(value) {
    TREE_MAX_MATCHES = Number(value);
    const container = document.getElementById('treeTab');
    const available = getAvailableTreeMatchdays();
    renderTreeUI(container, available);
}

function renderTreeUI(container, available) {
    const target = getMatchesForDays(_treeSelectedDays);
    const totalMatches = target.totalUnplayed;

    const addableDays = available.filter(d =>
        !_treeSelectedDays.includes(d.day) &&
        (totalMatches + d.count) <= TREE_MAX_MATCHES
    );

    let countClass = 'count-ok';
    if (totalMatches > 11) countClass = 'count-warn';
    if (totalMatches > TREE_MAX_MATCHES) countClass = 'count-over';

    // === Sélecteur de limite ===
    let html = `
        <div class="tree-limit-bar">
            <label>⚙️ Limite :</label>
            <select onchange="changeTreeLimit(this.value)">
                ${TREE_LIMIT_OPTIONS.map(opt => `
                    <option value="${opt.value}" ${opt.value === TREE_MAX_MATCHES ? 'selected' : ''}>
                        ${opt.label} — ${opt.detail}
                    </option>
                `).join('')}
            </select>
        </div>
    `;

    // === Sélecteur multi-journées ===
    html += `<div class="tree-multi-selector">`;

    html += `
        <label>📅 Journée :</label>
        <select onchange="changeTreePrimaryDay(Number(this.value))">
            ${available.map(d => `
                <option value="${d.day}" ${d.day === _treeSelectedDays[0] ? 'selected' : ''}>
                    Journée ${d.day} (${d.count} match${d.count > 1 ? 's' : ''})
                </option>
            `).join('')}
        </select>
    `;

    if (addableDays.length > 0 && totalMatches < TREE_MAX_MATCHES) {
        html += `
            <select id="treeAddDaySelect" style="border-color: #8e44ad;">
                ${addableDays.map(d => `
                    <option value="${d.day}">+ J${d.day} (${d.count}m)</option>
                `).join('')}
            </select>
            <button class="tree-add-day-btn" onclick="addTreeDay(Number(document.getElementById('treeAddDaySelect').value))">
                ➕ Combiner
            </button>
        `;
    }

    html += `</div>`;

    if (_treeSelectedDays.length > 1) {
        html += `<div class="tree-selected-days">`;
        _treeSelectedDays.forEach(day => {
            const dayData = available.find(d => d.day === day);
            const matchCount = dayData ? dayData.count : 0;
            html += `
                <span class="tree-day-tag">
                    J${day} (${matchCount}m)
                    <span class="remove-day" onclick="removeTreeDay(${day})">✕</span>
                </span>
            `;
        });
        html += `</div>`;
        html += `<div class="tree-match-total">Total : <span class="${countClass}">${totalMatches} matchs</span> → ${Math.pow(3, totalMatches).toLocaleString()} scénarios</div>`;
    }

    if (totalMatches === 0) {
        container.innerHTML = html + '<div class="tree-empty"><p>✅ Tous les matchs sélectionnés sont joués.</p></div>';
        return;
    }

    if (totalMatches > TREE_MAX_MATCHES) {
        container.innerHTML = html + `
            <div class="tree-empty">
                <p>⚠️ ${totalMatches} matchs = ${Math.pow(3, totalMatches).toLocaleString()} scénarios — trop lourd.</p>
                <p>Retirez une journée pour rester ≤ ${TREE_MAX_MATCHES} matchs.</p>
            </div>
        `;
        return;
    }

    const totalScenarios = Math.pow(3, totalMatches);
    const showProgress = totalScenarios > TREE_PROGRESS_THRESHOLD;
    
    if (showProgress) {
        container.innerHTML = html + `
            <div class="tree-intro" id="treeProgressZone">
                <p>🔄 Calcul de <strong>${totalScenarios.toLocaleString()}</strong> scénarios...</p>
                <div style="width: 80%; max-width: 400px; margin: 1rem auto; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden;">
                    <div id="treeProgressBar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #8e44ad, #3498db); border-radius: 10px; transition: width 0.1s ease;"></div>
                </div>
                <p id="treeProgressText" style="font-size: 0.85rem; color: #7f8c8d;">0% — 0 / ${totalScenarios.toLocaleString()}</p>
            </div>
        `;
    } else {
        container.innerHTML = html + `
            <div class="tree-intro">
                <p>🔄 Calcul de <strong>${totalScenarios.toLocaleString()}</strong> scénarios...</p>
            </div>
        `;
    }

    setTimeout(async () => {
        const standings = getTreeCurrentStandings();
        const t0 = performance.now();
        
        // Callback de progression
        const onProgress = showProgress ? (pct, current, total) => {
            const bar = document.getElementById('treeProgressBar');
            const text = document.getElementById('treeProgressText');
            if (bar) bar.style.width = pct + '%';
            if (text) {
                const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
                text.textContent = `${pct}% — ${current.toLocaleString()} / ${total.toLocaleString()} (${elapsed}s)`;
            }
        } : null;
        
        // Calcul (sync ou async selon la taille)
        const resultOrPromise = computeTreeScenarios(target.unplayedMatches, standings, onProgress);
        const results = resultOrPromise instanceof Promise ? await resultOrPromise : resultOrPromise;
        
        const elapsed = Math.round(performance.now() - t0);

        window._treeResults = results;
        window._treeStandings = standings;

        renderFullTree(container, target, standings, results, elapsed, available, html);
    }, 30);
}

// ===============================
// RENDU COMPLET
// ===============================

function renderFullTree(container, target, standings, results, elapsed, available, selectorHtml) {
    const config = typeof getSeasonConfig === 'function' ? getSeasonConfig() : { championPlaces: 1, europeanPlaces: 3, relegationPlaces: 2 };
    window._treeConfig = config;

    let html = selectorHtml;

    const daysLabel = target.matchDays.length > 1
        ? `Journées ${target.matchDays.join(' + ')}`
        : `Journée ${target.matchDays[0]}`;

    const timeDisplay = elapsed < 1000 ? `${elapsed} ms` : `${(elapsed / 1000).toFixed(1)} s`;

    html += `
        <div class="tree-intro">
            <h3>🌳 Arbre des probabilités — ${daysLabel}</h3>
            ${target.isPartial
                ? `<p>⚡ ${target.playedMatches.length} match(s) déjà joué(s), ${target.totalUnplayed} restant(s)</p>`
                : `<p>${target.totalUnplayed} matchs à simuler</p>`
            }
            <p><span class="scenario-count">${results.total.toLocaleString()}</span> scénarios exhaustifs</p>
            <p class="tree-calc-time">⚡ Calculé en ${timeDisplay}</p>
        </div>
    `;

    html += `<h4 style="margin: 1rem 0 0.5rem;">⚽ Matchs analysés (probabilités Elo)</h4>`;

    target.matchDays.forEach(day => {
        const dayMatches = target.unplayedMatches.filter(m => m.matchDay === day);

        if (target.matchDays.length > 1) {
            html += `<p style="font-size: 0.85rem; color: #8e44ad; font-weight: 600; margin: 0.5rem 0 0.3rem;">📅 Journée ${day}</p>`;
        }

        html += `<div class="tree-matches-grid">`;
        dayMatches.forEach(match => {
            const home = allTeams.find(t => t.id == match.homeTeamId);
            const away = allTeams.find(t => t.id == match.awayTeamId);
            const globalIdx = target.unplayedMatches.indexOf(match);
            const p = results.matchProbs[globalIdx];
            html += `
                <div class="tree-match-card">
                    <span>
                        ${target.matchDays.length > 1 ? `<span class="tree-match-day-label">J${day}</span>` : ''}
                        🏠 <strong>${home?.shortName || '?'}</strong> — <strong>${away?.shortName || '?'}</strong> ✈️
                    </span>
                    <div class="tree-match-probs">
                        <span class="prob-home">${Math.round(p[0] * 100)}%</span>
                        <span class="prob-draw">${Math.round(p[1] * 100)}%</span>
                        <span class="prob-away">${Math.round(p[2] * 100)}%</span>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    });

    html += `
        <div class="tree-mode-toggle">
            <button class="tree-mode-btn active" data-mode="elo" onclick="toggleTreeMode('elo')">🎯 Pondéré Elo</button>
            <button class="tree-mode-btn" data-mode="equal" onclick="toggleTreeMode('equal')">⚖️ Équiprobable (1/3)</button>
        </div>
    `;

    html += renderTreeHeatmap(results, standings, config, true);

    html += `
        <div class="tree-legend">
            <span class="leg-champion">🏆 Champion</span>
            <span class="leg-europe">🌍 Europe</span>
            <span class="leg-mid">Milieu de tableau</span>
            <span class="leg-relegation">⬇️ Relégation</span>
        </div>
    `;

    container.innerHTML = html;
}

// ===============================
// HEATMAP
// ===============================

function renderTreeHeatmap(results, standings, config, eloWeighted) {
    const { total, teamIds, teamIndex, teamCount, positionCounts, positionProbs, minPts, maxPts, basePoints } = results;
    const data = eloWeighted ? positionProbs : positionCounts;
    const divisor = eloWeighted ? 1 : total;

    const sorted = teamIds.map(id => ({
        id,
        idx: teamIndex[id],
        ...standings[id]
    })).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });

    let html = `<div class="tree-heatmap-container" id="treeHeatmapContainer"><table class="tree-heatmap"><thead><tr>`;
    html += `<th>Équipe</th><th>Pts</th>`;

    for (let p = 1; p <= teamCount; p++) {
        html += `<th>${p}${p === 1 ? 'er' : 'e'}</th>`;
    }
    html += `<th>🏆 Best</th><th>💀 Pire</th><th>📊 Probable</th><th>Pts après</th>`;
    html += `</tr></thead><tbody>`;

    sorted.forEach((team, currentPos) => {
        const tIdx = team.idx;

        let zone = '';
        if (currentPos < config.championPlaces) zone = 'champion-zone';
        else if (currentPos < config.europeanPlaces) zone = 'european-zone';
        else if (currentPos >= teamCount - config.relegationPlaces) zone = 'relegation-zone';

        let bestPos = teamCount - 1, worstPos = 0, bestProb = 0, mostLikelyPos = 0;

        for (let p = 0; p < teamCount; p++) {
            const val = data[tIdx][p] / divisor;
            if (val > 0) {
                if (p < bestPos) bestPos = p;
                if (p > worstPos) worstPos = p;
                if (val > bestProb) { bestProb = val; mostLikelyPos = p; }
            }
        }

        html += `<tr class="${zone}">`;
        html += `<td class="team-name">${team.shortName}</td>`;
        html += `<td class="current-pts">${team.points}</td>`;

        for (let p = 0; p < teamCount; p++) {
            const val = data[tIdx][p] / divisor;
            const pct = val * 100;
            const pctRound = Math.round(pct);

            if (pctRound === 0) {
                html += `<td class="tree-cell">-</td>`;
            } else {
                const hue = p < config.championPlaces ? 48
                    : p < config.europeanPlaces ? 210
                    : p >= teamCount - config.relegationPlaces ? 0
                    : 120;

                const intensity = Math.min(0.85, val * 2);
                const bg = `hsla(${hue}, 70%, 50%, ${intensity})`;
                const color = intensity > 0.35 ? 'white' : '#333';
                const fw = pctRound >= 25 ? 'bold' : 'normal';
                const display = pctRound < 1 ? '<1' : pctRound;

                html += `<td class="tree-cell" style="background:${bg};color:${color};font-weight:${fw};">${display}%</td>`;
            }
        }

        const fmtPos = p => `${p + 1}${p === 0 ? 'er' : 'e'}`;
        html += `<td class="summary-best">${fmtPos(bestPos)}</td>`;
        html += `<td class="summary-worst">${fmtPos(worstPos)}</td>`;
        html += `<td class="summary-likely">${fmtPos(mostLikelyPos)} (${Math.round(bestProb * 100)}%)</td>`;
        html += `<td class="pts-range">${minPts[tIdx]}→${maxPts[tIdx]}</td>`;
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}

// ===============================
// TOGGLE MODE
// ===============================

function toggleTreeMode(mode) {
    const results = window._treeResults;
    const standings = window._treeStandings;
    const config = window._treeConfig;
    if (!results || !standings) return;

    document.querySelectorAll('.tree-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const oldContainer = document.getElementById('treeHeatmapContainer');
    if (oldContainer) {
        const newHtml = renderTreeHeatmap(results, standings, config, mode === 'elo');
        oldContainer.outerHTML = newHtml;
    }
}

console.log('🌳 Module calendar-tree chargé (optimisé)');