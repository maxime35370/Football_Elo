// admin-pronos-tracker.js - Page Admin : suivi de la participation aux pronos
//
// Pour une journée donnée : qui a saisi ses pronostics, combien de matchs
// sur le total, et qui relancer avant le coup d'envoi. Réservé à l'admin
// (garde Firebase Auth dans la page), aucun score n'est affiché ici.

let ptSeason = '';
let ptFixtures = [];   // fixtures (jouées + à venir) de la saison, dédupliquées
let ptPlayers = [];

document.addEventListener('DOMContentLoaded', async function() {
    ptSeason = getCurrentSeason();
    document.getElementById('trackerSeason').textContent = ptSeason;

    // Fixtures de la saison : matchs joués + calendrier (dédupliqués)
    const played = (await getStoredMatchesAsync()).filter(m => m.season === ptSeason);
    const future = await loadFutureMatchesAsync(ptSeason);
    const seen = new Set();
    ptFixtures = [...played, ...future].filter(m => {
        const key = `${m.homeTeamId}-${m.awayTeamId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    ptPlayers = await ptGetAllPlayers();

    ptPopulateDaySelector(played, future);
    document.getElementById('trackerDay').addEventListener('change', ptRefresh);
    await ptRefresh();
});

async function ptGetAllPlayers() {
    try {
        const snapshot = await db.collection('pronostiqueurs').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('Erreur chargement pronostiqueurs:', e);
        return [];
    }
}

async function ptGetPredictionsForDay(matchDay) {
    try {
        const snapshot = await db.collection('pronostics')
            .where('season', '==', ptSeason)
            .where('matchDay', '==', matchDay)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('Erreur chargement pronostics:', e);
        return [];
    }
}

// Sélecteur de journée : par défaut, la prochaine à jouer
function ptPopulateDaySelector(played, future) {
    const select = document.getElementById('trackerDay');
    const days = [...new Set(ptFixtures.map(m => m.matchDay).filter(Boolean))].sort((a, b) => a - b);

    const playedKeys = new Set(played.map(m => `${m.homeTeamId}-${m.awayTeamId}`));
    const upcomingDays = future
        .filter(m => !playedKeys.has(`${m.homeTeamId}-${m.awayTeamId}`))
        .map(m => m.matchDay)
        .filter(Boolean);
    const defaultDay = upcomingDays.length > 0
        ? Math.min(...upcomingDays)
        : (days.length > 0 ? days[days.length - 1] : 1);

    select.innerHTML = days.map(d =>
        `<option value="${d}"${d === defaultDay ? ' selected' : ''}>Journée ${d}</option>`).join('');
}

async function ptRefresh() {
    const day = parseInt(document.getElementById('trackerDay').value);
    const container = document.getElementById('trackerContent');
    container.innerHTML = '<p style="color:#7f8c8d;">Chargement...</p>';

    const dayFixtures = ptFixtures.filter(m => m.matchDay === day);
    const totalMatches = dayFixtures.length;
    const predictions = await ptGetPredictionsForDay(day);
    const predsByPlayer = {};
    predictions.forEach(p => { predsByPlayer[p.playerId] = p; });

    // Premier coup d'envoi de la journée (deadline de relance)
    const kickoffs = dayFixtures.map(m => m.scheduledAt).filter(Boolean).map(d => new Date(d)).sort((a, b) => a - b);
    let deadlineHtml = '';
    if (kickoffs.length > 0) {
        const first = kickoffs[0];
        const text = first.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) +
            ' ' + first.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const remaining = first - new Date();
        const remainText = remaining > 0
            ? `— dans ${Math.floor(remaining / 3600000)}h${String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0')}`
            : '— journée commencée';
        deadlineHtml = `<p class="tracker-deadline">⏰ Premier coup d'envoi : <strong>${text}</strong> ${remainText}</p>`;
    }

    // Un prono compte s'il vise un match de la journée et a les deux scores
    const dayKeys = new Set(dayFixtures.map(m => `${m.homeTeamId}-${m.awayTeamId}`));
    const rows = ptPlayers.map(player => {
        const doc = predsByPlayer[player.id];
        let filled = 0, lastSaved = null;
        if (doc && Array.isArray(doc.predictions)) {
            filled = doc.predictions.filter(p =>
                dayKeys.has(`${p.homeTeamId}-${p.awayTeamId}`) &&
                p.homeScore !== '' && p.homeScore != null &&
                p.awayScore !== '' && p.awayScore != null
            ).length;
            lastSaved = doc.submittedAt || null;
        }
        return { pseudo: player.pseudo || player.id, filled, lastSaved };
    }).sort((a, b) => a.filled - b.filled || a.pseudo.localeCompare(b.pseudo, 'fr'));

    const complete = rows.filter(r => r.filled >= totalMatches && totalMatches > 0);
    const missing = rows.filter(r => r.filled === 0);
    const partial = rows.filter(r => r.filled > 0 && r.filled < totalMatches);

    const statusOf = r => {
        if (totalMatches === 0) return '—';
        if (r.filled >= totalMatches) return '<span class="tracker-ok">✅ Complet</span>';
        if (r.filled > 0) return '<span class="tracker-partial">🟡 Partiel</span>';
        return '<span class="tracker-missing">❌ Rien saisi</span>';
    };

    const savedText = r => {
        if (!r.lastSaved) return '—';
        const d = new Date(r.lastSaved);
        return isNaN(d.getTime()) ? '—'
            : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
              d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    container.innerHTML = `
        <div class="tracker-summary">
            <span class="tracker-big">${complete.length}/${rows.length}</span> joueurs ont tout saisi
            (journée de ${totalMatches} match${totalMatches > 1 ? 's' : ''})
        </div>
        ${deadlineHtml}
        ${(missing.length + partial.length) > 0 ? `
            <p class="tracker-relance">📣 À relancer :
                ${[...missing, ...partial].map(r => `<strong>${r.pseudo}</strong> (${r.filled}/${totalMatches})`).join(', ')}
            </p>` : (rows.length > 0 ? '<p class="tracker-allgood">🎉 Tout le monde a pronostiqué !</p>' : '<p>Aucun pronostiqueur inscrit.</p>')}
        <table class="stats-table tracker-table">
            <thead><tr><th>Joueur</th><th>Pronos saisis</th><th>Statut</th><th>Dernière sauvegarde</th></tr></thead>
            <tbody>
                ${rows.map(r => `
                    <tr>
                        <td style="text-align:left;font-weight:600;">${r.pseudo}</td>
                        <td>${r.filled}/${totalMatches}</td>
                        <td>${statusOf(r)}</td>
                        <td>${savedText(r)}</td>
                    </tr>`).join('')}
            </tbody>
        </table>
    `;
}
