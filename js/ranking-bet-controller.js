// =====================================================
// 📊 RANKING BET - CONTROLLER (orchestration)
// =====================================================
// Responsabilité : init, actions UI, orchestration
// Appelle le Model pour les données/calculs
// Passe les résultats à la View pour l'affichage
// =====================================================

// ===============================
// INITIALISATION
// ===============================

/**
 * Point d'entrée principal — appelé depuis pronostics-controller.js
 * quand l'utilisateur clique sur l'onglet "Classement Final"
 */
async function initRankingBetUI(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !currentPlayer) return;

    container.innerHTML = '<div class="loading">Calcul des côtes en cours...</div>';

    // --- MODEL : récupérer les données ---
    const { odds, probabilities, matchDayContext } = getCurrentOdds();
    const existingBet = await getRankingBet(currentPlayer.id, currentSeason);
    const currentRanking = generateRankingForBet();
    const seasonFinished = isSeasonFinished();

    // Initialiser l'ordre de la liste
    if (existingBet && existingBet.predictions) {
        _rankingBetOrder = existingBet.predictions
            .sort((a, b) => a.predictedPosition - b.predictedPosition)
            .map(p => p.teamId);
    } else {
        _rankingBetOrder = currentRanking.map(t => t.id);
    }

    // --- VIEW : afficher ---
    container.innerHTML = renderRankingBetHTML({
        odds, probabilities, matchDayContext,
        existingBet, currentRanking, seasonFinished
    });

    // Post-render : activer le drag & drop
    if (!seasonFinished) {
        initDragAndDrop();
    }
}

// ===============================
// ACTIONS UI
// ===============================

/**
 * Sauvegarde la prédiction depuis l'interface
 */
async function saveRankingBetFromUI() {
    if (!currentPlayer || !currentSeason) return;

    const { odds, matchDayContext } = getCurrentOdds();

    // Récupérer l'existant
    const existing = await getRankingBet(currentPlayer.id, currentSeason);

    const betData = {
        playerId: currentPlayer.id,
        pseudo: currentPlayer.pseudo,
        season: currentSeason,
        predictions: _rankingBetOrder.map((teamId, index) => ({
            teamId,
            predictedPosition: index + 1
        })),
        oddsSnapshot: {},
        submittedAt: existing ? existing.submittedAt : new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        matchDayContext,
        modificationCount: (existing?.modificationCount || 0) + (existing ? 1 : 0)
    };

    // Snapshot des côtes pour chaque team à sa position prédite
    _rankingBetOrder.forEach((teamId, index) => {
        const pos = index + 1;
        if (!betData.oddsSnapshot[teamId]) betData.oddsSnapshot[teamId] = {};
        betData.oddsSnapshot[teamId][pos] = odds[teamId]?.[pos] || 1;
    });

    await saveRankingBet(currentPlayer.id, currentSeason, betData);

    alert(existing
        ? '✅ Prédiction modifiée ! Les côtes actuelles ont été verrouillées.'
        : '✅ Prédiction sauvegardée !');

    // Refresh UI
    initRankingBetUI('rankingBetContainer');
}

/**
 * Remet le classement actuel comme base
 */
function resetRankingBetToDefault() {
    const currentRanking = generateRankingForBet();
    _rankingBetOrder = currentRanking.map(t => t.id);
    refreshRankingBetList();
}

/**
 * Trie par probabilité (position la plus probable pour chaque équipe)
 */
function sortRankingBetByOdds() {
    const { probabilities } = getCurrentOdds();

    _rankingBetOrder.sort((a, b) => {
        let bestPosA = 1, bestProbA = 0;
        let bestPosB = 1, bestProbB = 0;

        Object.keys(probabilities[a] || {}).forEach(pos => {
            if (probabilities[a][pos] > bestProbA) {
                bestProbA = probabilities[a][pos];
                bestPosA = parseInt(pos);
            }
        });
        Object.keys(probabilities[b] || {}).forEach(pos => {
            if (probabilities[b][pos] > bestProbB) {
                bestProbB = probabilities[b][pos];
                bestPosB = parseInt(pos);
            }
        });

        return bestPosA - bestPosB;
    });

    refreshRankingBetList();
}

console.log('🎮 Module ranking-bet-controller chargé');