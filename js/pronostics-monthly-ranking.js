// =====================================================
// 📅 CLASSEMENT MENSUEL
// Fichier : pronostics-monthly-ranking.js
// Permet de filtrer le classement par mois
// =====================================================

// ===============================
// CONFIGURATION
// ===============================

const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// ===============================
// MAPPING JOURNÉE → MOIS
// ===============================

/**
 * Détermine le mois d'une journée de championnat
 * basé sur la date du 1er match de cette journée
 * @returns {string|null} Format 'YYYY-MM' ou null
 */
function getMatchDayMonth(matchDay) {
    const matchesThisDay = [
        ...allMatches.filter(m => m.matchDay === matchDay),
        ...(typeof futureMatches !== 'undefined' ? futureMatches.filter(m => m.matchDay === matchDay) : [])
    ];

    // Trouver la date la plus ancienne (= 1er match de la journée)
    let earliest = null;

    for (const m of matchesThisDay) {
        const dateStr = m.scheduledAt || m.playedAt || m.date;
        if (!dateStr) continue;
        const d = new Date(dateStr);
        if (!isNaN(d) && (!earliest || d < earliest)) {
            earliest = d;
        }
    }

    if (!earliest) return null;

    const year = earliest.getFullYear();
    const month = String(earliest.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Retourne toutes les journées jouées regroupées par mois
 * @returns {Object} { 'YYYY-MM': [matchDay1, matchDay2, ...], ... }
 */
function getMatchDaysByMonth() {
    const playedDays = [...new Set(allMatches.map(m => m.matchDay).filter(Boolean))];
    const byMonth = {};

    for (const day of playedDays) {
        const month = getMatchDayMonth(day);
        if (!month) continue;
        if (!byMonth[month]) byMonth[month] = [];
        byMonth[month].push(day);
    }

    // Trier les journées dans chaque mois
    Object.values(byMonth).forEach(days => days.sort((a, b) => a - b));

    return byMonth;
}

/**
 * Retourne la liste des mois disponibles (triés chronologiquement)
 * @returns {Array} [{ key: 'YYYY-MM', label: 'Mars 2026', matchDays: [...] }, ...]
 */
function getAvailableMonths() {
    const byMonth = getMatchDaysByMonth();

    return Object.entries(byMonth)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, matchDays]) => {
            const [year, month] = key.split('-');
            const monthName = MONTH_NAMES[parseInt(month) - 1];
            return {
                key,
                label: `${monthName} ${year}`,
                matchDays
            };
        });
}

// ===============================
// SÉLECTEUR DE PÉRIODE
// ===============================

/**
 * Injecte le sélecteur de période (Saison / Mois) dans l'onglet classement
 */
function initMonthlySelector() {
    const leaderboardTab = document.getElementById('leaderboardTab');
    if (!leaderboardTab) return;

    // Vérifier si le sélecteur existe déjà
    if (document.getElementById('periodSelector')) return;

    const months = getAvailableMonths();
    if (months.length === 0) return;

    // Déterminer le mois courant
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Créer le sélecteur
    const selectorHtml = `
        <div id="periodSelector" style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
            <label style="font-weight:600;color:#2c3e50;font-size:0.9rem;">📅 Période :</label>
            <select id="periodSelect" onchange="onPeriodChange()" style="
                padding:0.4rem 0.8rem;border:2px solid #667eea;border-radius:8px;
                font-size:0.9rem;color:#2c3e50;background:white;cursor:pointer;
                font-weight:500;">
                <option value="season">🏆 Saison complète</option>
                ${months.map(m => `
                    <option value="${m.key}" ${m.key === currentMonthKey ? 'selected' : ''}>
                        📅 ${m.label} (J${m.matchDays[0]}–J${m.matchDays[m.matchDays.length - 1]})
                    </option>
                `).join('')}
            </select>
            <span id="periodInfo" style="font-size:0.8rem;color:#7f8c8d;"></span>
        </div>
    `;

    // Insérer avant le tableau
    const table = leaderboardTab.querySelector('#leaderboardTable') || leaderboardTab.querySelector('table');
    if (table) {
        table.insertAdjacentHTML('beforebegin', selectorHtml);
    } else {
        leaderboardTab.insertAdjacentHTML('afterbegin', selectorHtml);
    }

    // Sélectionner "Saison" par défaut à l'ouverture
    document.getElementById('periodSelect').value = 'season';
}

/**
 * Appelé quand l'utilisateur change de période
 */
async function onPeriodChange() {
    const select = document.getElementById('periodSelect');
    const value = select.value;

    if (value === 'season') {
        // Classement saison → appeler le loadLeaderboard normal
        document.getElementById('periodInfo').textContent = '';
        if (typeof loadLeaderboard === 'function') {
            await loadLeaderboard();
        }
    } else {
        // Classement mensuel
        await loadMonthlyLeaderboard(value);
    }
}

// ===============================
// CALCUL STATS MENSUELLES
// ===============================

/**
 * Calcule les stats d'un joueur pour un ensemble de journées
 * Inclut : points pronostics + bonus buteur + bonus joker
 */
async function calculateMonthlyStats(playerId, matchDays) {
    const stats = {
        totalPoints: 0,
        exactScores: 0,
        closeScores: 0,
        goodScores: 0,
        correctResults: 0,
        wrongResults: 0,
        totalPredictions: 0,
        journeysPlayed: [],
        scorerBonus: 0,
        scorerCorrect: 0,
        jokerBonus: 0,
        bestDay: { matchDay: null, points: 0 }
    };

    for (const matchDay of matchDays) {
        const predictions = await getPlayerPredictions(playerId, currentSeason, matchDay);
        if (!predictions || !predictions.predictions) continue;

        const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay);
        if (matchesThisDay.length === 0) continue;

        let dayPoints = 0;
        let hasPlayed = false;

        for (const pred of predictions.predictions) {
            const match = matchesThisDay.find(m =>
                m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
            );

            if (!match || !match.finalScore) continue;

            hasPlayed = true;
            stats.totalPredictions++;

            const result = calculatePredictionResult(
                pred.homeScore, pred.awayScore,
                match.finalScore.home, match.finalScore.away,
                pred.savedAt, match, pred.odds, pred.joker || false
            );

            const points = result.finalPoints || result.points;
            dayPoints += points;
            stats.totalPoints += points;

            // Compteurs par type
            if (result.points === 9) stats.exactScores++;
            else if (result.points === 6) stats.closeScores++;
            else if (result.points === 5 || result.points === 4) stats.goodScores++;
            else if (result.points === 3) stats.correctResults++;
            else if (result.class !== 'late') stats.wrongResults++;

            // Bonus joker (déjà inclus dans finalPoints via le calcul)
            if (pred.joker && result.points > 0) {
                stats.jokerBonus += points - result.points; // Différence = bonus joker
            }

            // Bonus buteur
            if (pred.scorerPick && match.goals) {
                const scorerFound = match.goals.some(g =>
                    g.scorer && pred.scorerPick &&
                    g.scorer.toLowerCase().includes(pred.scorerPick.toLowerCase())
                );
                if (scorerFound) {
                    stats.scorerCorrect++;
                    // Points buteur : 3 pts par défaut (ou config si dispo)
                    const scorerPts = typeof SCORER_CONFIG !== 'undefined' ? (SCORER_CONFIG.points || 3) : 3;
                    stats.scorerBonus += scorerPts;
                    stats.totalPoints += scorerPts;
                }
            }
        }

        if (hasPlayed) {
            stats.journeysPlayed.push(matchDay);
            if (dayPoints > stats.bestDay.points) {
                stats.bestDay = { matchDay, points: dayPoints };
            }
        }
    }

    // Récap consolidé : ajouter les bonus des défis (challenges) si disponible
    if (typeof getMatchDayRecap === 'function') {
        for (const matchDay of matchDays) {
            try {
                const recap = await getMatchDayRecap(playerId, matchDay);
                if (recap && recap.challengeBonus) {
                    stats.totalPoints += recap.challengeBonus;
                }
            } catch (e) {
                // Silencieux — pas de recap pour cette journée
            }
        }
    }

    return stats;
}

// ===============================
// AFFICHAGE CLASSEMENT MENSUEL
// ===============================

/**
 * Charge et affiche le classement pour un mois donné
 * @param {string} monthKey - Format 'YYYY-MM'
 */
async function loadMonthlyLeaderboard(monthKey) {
    const tbody = document.querySelector('#leaderboardTable tbody');
    tbody.innerHTML = '<tr><td colspan="9">Chargement du classement mensuel...</td></tr>';

    const byMonth = getMatchDaysByMonth();
    const matchDays = byMonth[monthKey];

    if (!matchDays || matchDays.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">Aucune journée pour ce mois</td></tr>';
        return;
    }

    // Info période
    const [year, month] = monthKey.split('-');
    const monthName = MONTH_NAMES[parseInt(month) - 1];
    const infoEl = document.getElementById('periodInfo');
    if (infoEl) {
        infoEl.textContent = `J${matchDays[0]} à J${matchDays[matchDays.length - 1]} · ${matchDays.length} journée(s)`;
    }

    try {
        const players = await getAllPlayers();
        const playersWithStats = [];

        for (const player of players) {
            const stats = await calculateMonthlyStats(player.id, matchDays);
            if (stats.journeysPlayed.length === 0) continue; // Pas joué ce mois

            playersWithStats.push({
                ...player,
                calculatedStats: stats
            });
        }

        // Trier par points
        playersWithStats.sort((a, b) =>
            (b.calculatedStats?.totalPoints || 0) - (a.calculatedStats?.totalPoints || 0)
        );

        if (playersWithStats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9">Aucun pronostic pour ce mois</td></tr>';
            return;
        }

        // Réutiliser le rendu du classement existant
        tbody.innerHTML = renderLeaderboardHTML(playersWithStats, currentPlayer);

        // Ajouter un résumé mensuel sous le tableau
        renderMonthlySummary(playersWithStats, monthName, year, matchDays);

        // Mettre à jour le rang du joueur connecté
        updatePlayerRankDisplay(playersWithStats, currentPlayer);

    } catch (error) {
        console.error('Erreur loadMonthlyLeaderboard:', error);
        tbody.innerHTML = '<tr><td colspan="9">Erreur de chargement</td></tr>';
    }
}

// ===============================
// RÉSUMÉ MENSUEL
// ===============================

/**
 * Affiche un résumé visuel sous le tableau pour le mois sélectionné
 */
function renderMonthlySummary(playersWithStats, monthName, year, matchDays) {
    // Retirer l'ancien résumé s'il existe
    const old = document.getElementById('monthlySummary');
    if (old) old.remove();

    if (playersWithStats.length === 0) return;

    // Stats du mois
    const leader = playersWithStats[0];
    const leaderStats = leader.calculatedStats;

    // Meilleurs du mois dans chaque catégorie
    let bestExact = { pseudo: '-', count: 0 };
    let bestScorer = { pseudo: '-', count: 0 };
    let bestDay = { pseudo: '-', matchDay: null, points: 0 };

    playersWithStats.forEach(p => {
        const s = p.calculatedStats;
        if (s.exactScores > bestExact.count) {
            bestExact = { pseudo: p.pseudo, count: s.exactScores };
        }
        if (s.scorerCorrect > bestScorer.count) {
            bestScorer = { pseudo: p.pseudo, count: s.scorerCorrect };
        }
        if (s.bestDay.points > bestDay.points) {
            bestDay = { pseudo: p.pseudo, matchDay: s.bestDay.matchDay, points: s.bestDay.points };
        }
    });

    const summaryHtml = `
        <div id="monthlySummary" style="margin-top:1rem;padding:1rem;background:linear-gradient(135deg,#667eea10,#764ba210);
                    border:2px solid #667eea40;border-radius:12px;">
            <h4 style="margin:0 0 0.75rem;color:#667eea;">
                📅 Résumé ${monthName} ${year}
            </h4>
            <div style="display:flex;flex-wrap:wrap;gap:0.75rem;">
                <div style="flex:1;min-width:140px;background:white;padding:0.6rem;border-radius:8px;text-align:center;">
                    <div style="font-size:1.3rem;font-weight:bold;color:#f1c40f;">🏆 ${leader.pseudo}</div>
                    <div style="font-size:0.85rem;color:#7f8c8d;">Leader · ${Math.round(leaderStats.totalPoints * 10) / 10} pts</div>
                </div>
                <div style="flex:1;min-width:140px;background:white;padding:0.6rem;border-radius:8px;text-align:center;">
                    <div style="font-size:1.3rem;font-weight:bold;color:#e74c3c;">🎯 ${bestExact.pseudo}</div>
                    <div style="font-size:0.85rem;color:#7f8c8d;">Sniper · ${bestExact.count} exact(s)</div>
                </div>
                <div style="flex:1;min-width:140px;background:white;padding:0.6rem;border-radius:8px;text-align:center;">
                    <div style="font-size:1.3rem;font-weight:bold;color:#27ae60;">⚽ ${bestScorer.pseudo}</div>
                    <div style="font-size:0.85rem;color:#7f8c8d;">Buteurs · ${bestScorer.count} trouvé(s)</div>
                </div>
                <div style="flex:1;min-width:140px;background:white;padding:0.6rem;border-radius:8px;text-align:center;">
                    <div style="font-size:1.3rem;font-weight:bold;color:#3498db;">💥 ${bestDay.pseudo}</div>
                    <div style="font-size:0.85rem;color:#7f8c8d;">
                        Meilleure J · ${Math.round(bestDay.points * 10) / 10} pts
                        ${bestDay.matchDay ? `(J${bestDay.matchDay})` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Insérer après le tableau
    const table = document.getElementById('leaderboardTable');
    if (table) {
        table.insertAdjacentHTML('afterend', summaryHtml);
    }
}

// ===============================
// HOOK : S'INJECTER DANS LE CLASSEMENT
// ===============================

/**
 * Patch le loadLeaderboard existant pour ajouter le sélecteur
 */
(function hookMonthlySelector() {
    // Attendre que loadLeaderboard soit défini
    const interval = setInterval(() => {
        if (typeof loadLeaderboard === 'function' && !loadLeaderboard._monthlyPatched) {
            const originalLoadLeaderboard = loadLeaderboard;

            loadLeaderboard = async function () {
                await originalLoadLeaderboard.apply(this, arguments);
                initMonthlySelector();

                // Retirer le résumé mensuel quand on est en vue saison
                const old = document.getElementById('monthlySummary');
                if (old) old.remove();
            };

            loadLeaderboard._monthlyPatched = true;
            clearInterval(interval);
            console.log('📅 Monthly selector hooked into loadLeaderboard');
        }
    }, 200);

    // Sécurité : arrêter après 10 secondes
    setTimeout(() => clearInterval(interval), 10000);
})();

console.log('📅 Module pronostics-monthly-ranking chargé');