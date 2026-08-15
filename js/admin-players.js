// admin-players.js - Page Admin : référentiel des joueurs (buteurs)
//
// Deux blocs :
//   1. Les joueurs du référentiel (fiche : prénom/nom/surnom, alias,
//      historique de clubs) avec transfert mercato et suppression.
//   2. Les buteurs "détectés" dans les matchs mais pas encore liés à un
//      joueur : sélection multiple → fusion en un joueur du référentiel.

let apMatches = [];
let apTeams = [];
let apDetected = [];
let apEditingId = null;   // id du joueur en cours d'édition (null = création)
let apFormStints = [];    // stints en cours d'édition dans le formulaire

// ===============================
// INITIALISATION
// ===============================

document.addEventListener('DOMContentLoaded', async function() {
    apTeams = await getStoredTeamsAsync();
    apMatches = await getStoredMatchesAsync();
    await loadPlayersRegistry();

    apPopulateFormSelectors();
    apRefreshAll();

    document.getElementById('playerForm').addEventListener('submit', apSavePlayerForm);
    document.getElementById('cancelPlayerBtn').addEventListener('click', apClosePlayerForm);
    document.getElementById('addStintBtn').addEventListener('click', apAddStintFromSelectors);
    document.getElementById('newPlayerBtn').addEventListener('click', () => apOpenPlayerForm(null));
    document.getElementById('detectedSearch').addEventListener('input', apRenderDetected);
    document.getElementById('detectedSeason').addEventListener('change', apRefreshAll);
    document.getElementById('mergeSelectionBtn').addEventListener('click', apCreateFromSelection);
});

function apRefreshAll() {
    apDetected = apComputeDetected();
    apRenderPlayers();
    apRenderDetected();
    apUpdateCounts();
}

function apUpdateCounts() {
    document.getElementById('playerCount').textContent =
        `${playersRegistry.length} joueur${playersRegistry.length > 1 ? 's' : ''}`;
    document.getElementById('detectedCount').textContent =
        `${apDetected.length} buteur${apDetected.length > 1 ? 's' : ''} non lié${apDetected.length > 1 ? 's' : ''}`;
}

function apTeamShort(teamId) {
    const team = apTeams.find(t => String(t.id) === String(teamId));
    return team ? team.shortName : `#${teamId}`;
}

// ===============================
// BUTEURS DÉTECTÉS (NON LIÉS)
// ===============================

// Regroupe les buts non résolus par (nom normalisé, club) pour proposer la
// création/fusion de joueurs. Limité à la saison choisie dans le filtre
// (saison active par défaut, « Toutes les saisons » disponible).
function apComputeDetected() {
    const buckets = {};
    const seasonSel = document.getElementById('detectedSeason');
    const seasonFilter = seasonSel ? seasonSel.value : 'all';

    apMatches.forEach(match => {
        if (seasonFilter !== 'all' && match.season !== seasonFilter) return;
        (match.goals || []).forEach(goal => {
            if (!goal.scorer) return;
            const teamId = String(goal.teamId);
            if (plResolvePlayer(goal.scorer, teamId, goal.scorerFull)) return; // déjà lié

            const key = `${plNormalizeName(goal.scorerFull || goal.scorer)}_${teamId}`;
            if (!buckets[key]) {
                buckets[key] = {
                    key,
                    normKeys: new Set(),
                    teamId,
                    rawNames: {},
                    goals: 0,
                    seasons: new Set(),
                    firstDate: match.scheduledAt || match.date || ''
                };
            }
            const b = buckets[key];
            b.goals++;
            b.normKeys.add(plNormalizeName(goal.scorer));
            if (goal.scorerFull) b.normKeys.add(plNormalizeName(goal.scorerFull));
            const raw = goal.scorerFull || goal.scorer;
            b.rawNames[raw] = (b.rawNames[raw] || 0) + 1;
            if (match.season) b.seasons.add(match.season);
            const d = match.scheduledAt || match.date || '';
            if (d && (!b.firstDate || d < b.firstDate)) b.firstDate = d;
        });
    });

    return Object.values(buckets)
        .map(b => ({
            ...b,
            displayName: Object.entries(b.rawNames).sort((a, c) => c[1] - a[1])[0][0],
            seasons: [...b.seasons].sort()
        }))
        .sort((a, b) => b.goals - a.goals);
}

function apRenderDetected() {
    const container = document.getElementById('detectedList');
    const search = plNormalizeName(document.getElementById('detectedSearch').value);

    const visible = apDetected.filter(b =>
        !search || plNormalizeName(b.displayName).includes(search) ||
        plNormalizeName(apTeamShort(b.teamId)).includes(search)
    );

    if (visible.length === 0) {
        container.innerHTML = '<p style="color:#7f8c8d;padding:1rem;">Aucun buteur non lié 🎉</p>';
        return;
    }

    container.innerHTML = visible.map(b => `
        <label class="detected-row">
            <input type="checkbox" class="detected-check" value="${b.key}">
            <span class="detected-name">${b.displayName}</span>
            <span class="team-badge">${apTeamShort(b.teamId)}</span>
            <span class="detected-goals">⚽ ${b.goals}</span>
            <span class="detected-seasons">${b.seasons.join(', ')}</span>
        </label>
    `).join('');
}

// Fusionne les buteurs cochés en un joueur du référentiel (pré-remplit le
// formulaire ; rien n'est sauvegardé avant validation).
function apCreateFromSelection() {
    const checked = [...document.querySelectorAll('.detected-check:checked')]
        .map(cb => apDetected.find(b => b.key === cb.value))
        .filter(Boolean);

    if (checked.length === 0) {
        alert('Coche au moins un buteur détecté à transformer en joueur.');
        return;
    }

    // Trié par première apparition : le premier club = club d'arrivée initial
    const ordered = [...checked].sort((a, b) => (a.firstDate || '').localeCompare(b.firstDate || ''));

    const aliases = new Set();
    ordered.forEach(b => b.normKeys.forEach(k => aliases.add(k)));

    const stints = [];
    ordered.forEach((b, i) => {
        if (!stints.some(s => String(s.teamId) === String(b.teamId))) {
            stints.push({
                teamId: String(b.teamId),
                season: b.seasons[0] || '',
                phase: stints.length === 0 ? 'start' : 'mercato'
            });
        }
    });

    apOpenPlayerForm(null, {
        lastName: ordered[0].displayName,
        aliases: [...aliases],
        stints
    });
}

// ===============================
// LISTE DES JOUEURS
// ===============================

function apRenderPlayers() {
    const container = document.getElementById('playersList');

    if (playersRegistry.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <h4>📭 Aucun joueur dans le référentiel</h4>
                <p>Coche des buteurs détectés ci-dessous et fusionne-les en joueur.</p>
            </div>`;
        return;
    }

    // Labels désambiguïsés sur l'ensemble du référentiel
    const rows = playersRegistry.map(p => ({
        playerId: p.id,
        name: p.lastName,
        firstName: p.firstName || '',
        customLabel: p.customLabel || '',
        clubs: (p.stints || []).map(s => ({ teamId: s.teamId, goals: 0 }))
    }));
    plBuildLabels(rows, apTeams);

    container.innerHTML = playersRegistry.map(p => {
        const row = rows.find(r => r.playerId === p.id);
        const stintsHtml = (p.stints || []).map((s, i) =>
            `<span class="stint-chip${i === (p.stints.length - 1) ? ' stint-current' : ''}">
                ${apTeamShort(s.teamId)}
                <small>${s.season || ''}${s.phase === 'mercato' ? ' (mercato)' : ''}</small>
            </span>`
        ).join(' → ');

        return `
        <div class="team-card player-card">
            <div class="team-header">
                <div class="team-name">${row ? row.label : p.lastName}</div>
                <div class="team-short">${p.firstName || ''}</div>
            </div>
            <div class="team-info">
                <div class="player-stints">${stintsHtml || '<em>Aucun club</em>'}</div>
                <div class="player-aliases">Alias : ${(p.aliases || []).map(a => `<code>${a}</code>`).join(' ') || '—'}</div>
                ${p.customLabel ? `<div>Surnom : <strong>${p.customLabel}</strong></div>` : ''}
            </div>
            <div class="team-actions">
                <button class="btn btn-info btn-small" onclick="apOpenPlayerForm('${p.id}')">✏️ Modifier</button>
                <button class="btn btn-warning btn-small" onclick="apQuickTransfer('${p.id}')">🔁 Transfert</button>
                <button class="btn btn-danger btn-small" onclick="apDeletePlayer('${p.id}')">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// ===============================
// FORMULAIRE JOUEUR
// ===============================

function apPopulateFormSelectors() {
    // Filtre saison des buteurs détectés : saison active par défaut
    const detectedSeason = document.getElementById('detectedSeason');
    const seasonsList = (typeof getSeasonsOrderedByDate === 'function' ? getSeasonsOrderedByDate() : []) || [];
    detectedSeason.innerHTML = seasonsList.map(s =>
        `<option value="${s.name}"${s.isActive ? ' selected' : ''}>${s.name}</option>`).join('') +
        '<option value="all">Toutes les saisons</option>';

    const clubSelect = document.getElementById('stintTeam');
    clubSelect.innerHTML = [...apTeams]
        .sort((a, b) => (a.shortName || '').localeCompare(b.shortName || '', 'fr'))
        .map(t => `<option value="${t.id}">${t.shortName} — ${t.name}</option>`).join('');

    const seasonSelect = document.getElementById('stintSeason');
    const seasons = (typeof getSeasonsOrderedByDate === 'function' ? getSeasonsOrderedByDate() : []) || [];
    seasonSelect.innerHTML = seasons.map(s =>
        `<option value="${s.name}"${s.isActive ? ' selected' : ''}>${s.name}</option>`).join('');
}

function apOpenPlayerForm(playerId, prefill) {
    apEditingId = playerId;
    const player = playerId ? playersRegistry.find(p => p.id === playerId) : null;
    const src = player || prefill || {};

    document.getElementById('playerFormTitle').textContent =
        player ? `✏️ Modifier ${player.lastName}` : '➕ Nouveau joueur';
    document.getElementById('playerLastName').value = src.lastName || '';
    document.getElementById('playerFirstName').value = src.firstName || '';
    document.getElementById('playerCustomLabel').value = src.customLabel || '';
    document.getElementById('playerAliases').value = (src.aliases || []).join(', ');
    apFormStints = (src.stints || []).map(s => ({ ...s }));

    apRenderFormStints();
    const section = document.getElementById('playerFormSection');
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
}

function apClosePlayerForm() {
    apEditingId = null;
    apFormStints = [];
    document.getElementById('playerFormSection').style.display = 'none';
}

function apRenderFormStints() {
    const container = document.getElementById('formStints');
    if (apFormStints.length === 0) {
        container.innerHTML = '<em style="color:#7f8c8d;">Aucun club — ajoute au moins un club ci-dessous.</em>';
        return;
    }
    container.innerHTML = apFormStints.map((s, i) => `
        <span class="stint-chip${i === apFormStints.length - 1 ? ' stint-current' : ''}">
            ${apTeamShort(s.teamId)}
            <small>${s.season || ''}${s.phase === 'mercato' ? ' (mercato)' : ''}</small>
            <button type="button" class="stint-remove" onclick="apRemoveStint(${i})" title="Retirer">✖</button>
        </span>${i < apFormStints.length - 1 ? ' → ' : ''}
    `).join('');
}

function apAddStintFromSelectors() {
    apFormStints.push({
        teamId: String(document.getElementById('stintTeam').value),
        season: document.getElementById('stintSeason').value,
        phase: document.getElementById('stintPhase').value
    });
    apRenderFormStints();
}

function apRemoveStint(index) {
    apFormStints.splice(index, 1);
    apRenderFormStints();
}

async function apSavePlayerForm(event) {
    event.preventDefault();

    const lastName = document.getElementById('playerLastName').value.trim();
    if (!lastName) { alert('Le nom est obligatoire.'); return; }
    if (apFormStints.length === 0) { alert('Ajoute au moins un club.'); return; }

    const firstName = document.getElementById('playerFirstName').value.trim();
    const customLabel = document.getElementById('playerCustomLabel').value.trim();

    // Alias saisis + clés dérivées du nom et du prénom+nom
    const aliases = new Set(
        document.getElementById('playerAliases').value
            .split(',').map(a => plNormalizeName(a)).filter(Boolean)
    );
    aliases.add(plNormalizeName(lastName));
    if (firstName) aliases.add(plNormalizeName(`${firstName} ${lastName}`));

    const data = {
        lastName,
        firstName,
        customLabel,
        aliases: [...aliases],
        stints: apFormStints.map(s => ({ ...s }))
    };

    if (apEditingId) {
        const player = playersRegistry.find(p => p.id === apEditingId);
        Object.assign(player, data);
    } else {
        playersRegistry.push({ id: `pl_${Date.now()}`, ...data });
    }

    await savePlayersRegistry();
    apClosePlayerForm();
    apRefreshAll();
}

// Transfert rapide : ajoute un stint (mercato) sans passer par tout le formulaire
function apQuickTransfer(playerId) {
    apOpenPlayerForm(playerId);
    document.getElementById('stintPhase').value = 'mercato';
    document.getElementById('stintTeam').focus();
}

async function apDeletePlayer(playerId) {
    const player = playersRegistry.find(p => p.id === playerId);
    if (!player) return;
    if (!confirm(`Supprimer ${player.firstName || ''} ${player.lastName} du référentiel ?\n(Les buts en base ne sont pas touchés, le joueur redeviendra un buteur "détecté".)`)) return;

    playersRegistry = playersRegistry.filter(p => p.id !== playerId);
    await savePlayersRegistry();
    apRefreshAll();
}
