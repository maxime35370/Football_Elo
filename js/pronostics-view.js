// ===============================
// PRONOSTICS - VIEW (affichage)
// ===============================
// Responsabilité : générer le HTML, manipuler le DOM
// Ne fait JAMAIS d'appels Firebase
// Reçoit les données du Controller
// ===============================

// ===============================
// SECTIONS AUTH / GAME
// ===============================

function showAuthSection() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('gameSection').style.display = 'none';
}

function showGameSection() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('gameSection').style.display = 'block';
}

// ===============================
// HEADER JOUEUR
// ===============================

function updatePlayerHeader(player) {
    if (!player) return;
    
    document.getElementById('playerName').textContent = player.pseudo;
    
    const stats = player.stats || {};
    document.getElementById('playerStats').textContent = `${stats.totalPoints || 0} pts - ${stats.journeys || 0} journée(s)`;
    document.getElementById('playerRank').textContent = '-';
}

// ===============================
// DEADLINE BADGE
// ===============================

/**
 * Génère le badge de deadline (verrouillé, temps restant, ou ouvert)
 * @returns {Object} { className, innerHTML }
 */
function renderDeadlineBadge(openMatches, nextDeadline) {
    if (openMatches === 0) {
        return {
            className: 'deadline-info locked',
            innerHTML: '<span class="deadline-icon">🔒</span><span class="deadline-text">Tous les matchs commencés</span>'
        };
    }
    
    if (nextDeadline) {
        const now = new Date();
        const diff = nextDeadline - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeText;
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            timeText = `${days}j ${hours % 24}h`;
        } else if (hours > 0) {
            timeText = `${hours}h ${minutes}min`;
        } else {
            timeText = `${minutes} min`;
        }
        
        return {
            className: 'deadline-info open',
            innerHTML: `<span class="deadline-icon">⏰</span><span class="deadline-text">Prochain match dans ${timeText} (${openMatches} ouvert${openMatches > 1 ? 's' : ''})</span>`
        };
    }
    
    return {
        className: 'deadline-info open',
        innerHTML: `<span class="deadline-icon">✅</span><span class="deadline-text">${openMatches} match${openMatches > 1 ? 's' : ''} ouvert${openMatches > 1 ? 's' : ''}</span>`
    };
}

// ===============================
// STATUT PRONOSTICS
// ===============================

/**
 * Met à jour le badge de statut (sauvegardé / non sauvegardé)
 */
function renderPredictionsStatus(statusEl, existingPredictions, openMatches) {
    if (existingPredictions) {
        statusEl.className = 'predictions-status saved';
        const savedDate = existingPredictions.submittedAt ? new Date(existingPredictions.submittedAt) : null;
        const dateText = savedDate && !isNaN(savedDate) ? savedDate.toLocaleString('fr-FR') : 'date inconnue';
        statusEl.textContent = `✅ Pronostics sauvegardés le ${dateText}`;
    } else if (openMatches > 0) {
        statusEl.className = 'predictions-status unsaved';
        statusEl.textContent = '⚠️ Pronostics non sauvegardés';
    } else {
        statusEl.className = 'predictions-status';
        statusEl.textContent = '';
    }
}

// ===============================
// CARTE MATCH (1 match)
// ===============================

/**
 * Génère le HTML d'une carte de match
 * @param {Object} data - Toutes les données nécessaires au rendu
 * @returns {string} HTML
 */
function renderMatchCard(data) {
    const {
        match, homeTeam, awayTeam, prediction,
        isMatchLocked, matchTimeText, matchOdds,
        resultHtml, combineButtonHtml
    } = data;

    // Multiplicateurs de cotes
    let homeMultHtml = '';
    let awayMultHtml = '';
    let drawMultText = '-';

    if (matchOdds) {
        const homeMult = Math.max(0.5, Math.min(3.0, Math.round((matchOdds.home / 2) * 100) / 100));
        const drawMult = Math.max(0.5, Math.min(3.0, Math.round((matchOdds.draw / 2) * 100) / 100));
        const awayMult = Math.max(0.5, Math.min(3.0, Math.round((matchOdds.away / 2) * 100) / 100));
        homeMultHtml = `<span class="team-odds ${homeMult >= 1 ? 'bonus' : 'malus'}">×${homeMult.toFixed(2)}</span>`;
        awayMultHtml = `<span class="team-odds ${awayMult >= 1 ? 'bonus' : 'malus'}">×${awayMult.toFixed(2)}</span>`;
        drawMultText = `×${drawMult.toFixed(2)}`;
    }

    const homeScore = prediction ? prediction.homeScore : '';
    const awayScore = prediction ? prediction.awayScore : '';

    return `
        <div class="prediction-match ${isMatchLocked ? 'locked' : ''} ${resultHtml ? 'has-result' : ''}" 
             data-home="${match.homeTeamId}" 
             data-away="${match.awayTeamId}">
            ${matchTimeText ? `<div class="match-time ${isMatchLocked ? 'locked' : ''}">${isMatchLocked ? '🔒' : '🕐'} ${matchTimeText}</div>` : ''}
            <div class="prediction-team home">
                <span class="team-name">${homeTeam?.shortName || '?'}</span>
                ${homeMultHtml}
                <span class="team-badge">🏠 Domicile</span>
            </div>
            <div class="prediction-score">
                <input type="number" min="0" max="20" class="home-score" 
                       value="${homeScore}" 
                       ${isMatchLocked ? 'disabled' : ''}
                       data-home="${match.homeTeamId}" 
                       data-away="${match.awayTeamId}">
                <span class="separator odds-draw">${drawMultText}</span>
                <input type="number" min="0" max="20" class="away-score" 
                       value="${awayScore}" 
                       ${isMatchLocked ? 'disabled' : ''}
                       data-home="${match.homeTeamId}" 
                       data-away="${match.awayTeamId}">
            </div>
            <div class="prediction-team away">
                ${awayMultHtml}
                <span class="team-name">${awayTeam?.shortName || '?'}</span>
                <span class="team-badge">✈️ Extérieur</span>
            </div>
            ${resultHtml}
            ${!isMatchLocked ? `<div class="joker-slot" data-home="${match.homeTeamId}" data-away="${match.awayTeamId}"></div>` : ''}
            <div class="scorer-slot" data-home="${match.homeTeamId}" data-away="${match.awayTeamId}"></div>
            ${combineButtonHtml ? `<div class="combine-slot">${combineButtonHtml}</div>` : ''}
        </div>
    `;
}

/**
 * Génère le HTML du résultat réel d'un match terminé
 */
function renderMatchResult(prediction, match) {
    if (!match.finalScore) return '';

    const result = calculatePredictionResult(
        prediction?.homeScore, 
        prediction?.awayScore, 
        match.finalScore.home, 
        match.finalScore.away,
        prediction?.savedAt,
        match,
        prediction?.odds
    );
    
    let pointsDisplay = `${result.finalPoints} pts`;
    if (result.oddsMultiplier !== 1) {
        pointsDisplay = `${result.points} × ${result.oddsMultiplier} = ${result.finalPoints} pts`;
    }

    return `
        <div class="actual-result ${result.class}">
            Réel: ${match.finalScore.home}-${match.finalScore.away} | 
            ${result.label}
            <span class="points-badge">${pointsDisplay}</span>
        </div>
    `;
}

/**
 * Détermine l'état de verrouillage et le texte horaire d'un match
 * @returns {Object} { isMatchLocked, matchTimeText }
 */
function getMatchLockState(match) {
    const now = new Date();
    let isMatchLocked = false;
    let matchTimeText = '';

    if (match.finalScore) {
        isMatchLocked = true;
    } else if (match.scheduledAt) {
        const matchTime = new Date(match.scheduledAt);
        isMatchLocked = now >= matchTime;
        matchTimeText = matchTime.toLocaleString('fr-FR', { 
            weekday: 'short', day: 'numeric', month: 'short', 
            hour: '2-digit', minute: '2-digit' 
        });
    }

    return { isMatchLocked, matchTimeText };
}

// ===============================
// FORMULAIRE COMPLET (toutes les cartes)
// ===============================

/**
 * Génère le HTML complet du formulaire de pronostics
 * @param {Object} data - { matchesThisDay, predictionsMap, oddsMap, allTeams, selectedMatchDay, isMatchDayLocked, superJokerHtml }
 * @returns {string} HTML complet
 */
function renderPredictionsFormHTML(data) {
    const { matchesThisDay, predictionsMap, oddsMap, allTeams, selectedMatchDay, isMatchDayLocked, superJokerHtml } = data;
    
    let html = '';
    
    // Bandeau Super Joker
    if (superJokerHtml) {
        html += superJokerHtml;
    }
    
    // Panneau Combiné
    if (typeof renderCombinePanel === 'function') {
        html += renderCombinePanel(selectedMatchDay, isMatchDayLocked);
    }
    
    // Cartes de match
    matchesThisDay.forEach(match => {
        const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
        const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
        const key = `${match.homeTeamId}-${match.awayTeamId}`;
        const prediction = predictionsMap[key];
        const { isMatchLocked, matchTimeText } = getMatchLockState(match);
        
        const resultHtml = renderMatchResult(prediction, match);
        
        const combineButtonHtml = typeof renderCombineButton === 'function'
            ? renderCombineButton(selectedMatchDay, match.homeTeamId, match.awayTeamId, isMatchLocked)
            : '';
        
        html += renderMatchCard({
            match, homeTeam, awayTeam, prediction,
            isMatchLocked, matchTimeText,
            matchOdds: oddsMap[key],
            resultHtml, combineButtonHtml
        });
    });
    
    return html;
}

// ===============================
// POST-RENDER : JOKERS + BUTEURS
// ===============================

/**
 * Injecte les boutons joker dans les slots après le rendu HTML
 */
function renderJokerSlots(jokers, matchesThisDay, selectedMatchDay) {
    document.querySelectorAll('.joker-slot').forEach(slot => {
        const homeId = parseInt(slot.dataset.home);
        const awayId = parseInt(slot.dataset.away);
        const match = matchesThisDay.find(m => m.homeTeamId == homeId && m.awayTeamId == awayId);
        const isLocked = match?.finalScore || (match?.scheduledAt && new Date() >= new Date(match.scheduledAt));
        
        if (typeof renderJokerButton === 'function') {
            slot.innerHTML = renderJokerButton(slot, jokers, selectedMatchDay, homeId, awayId, isLocked);
        }
    });
}

/**
 * Injecte les défis buteur dans les slots après le rendu HTML
 */
function renderScorerSlots(matchesThisDay) {
    if (typeof renderScorerChallenge !== 'function') return;
    
    document.querySelectorAll('.scorer-slot').forEach(slot => {
        const homeId = parseInt(slot.dataset.home);
        const awayId = parseInt(slot.dataset.away);
        const matchKey = `${homeId}_${awayId}`;
        const match = matchesThisDay.find(m => m.homeTeamId == homeId && m.awayTeamId == awayId);
        const isLocked = match?.finalScore || (match?.scheduledAt && new Date() >= new Date(match.scheduledAt));
        const existingPick = window._scorerPicks ? window._scorerPicks[matchKey] : null;
        
        slot.innerHTML = renderScorerChallenge(homeId, awayId, existingPick, isLocked);
    });
}

/**
 * Affiche/masque les boutons sauvegarder/effacer
 */
function toggleActionButtons(hasOpenMatches) {
    document.getElementById('savePredictionsBtn').style.display = hasOpenMatches ? 'inline-flex' : 'none';
    document.getElementById('clearPredictionsBtn').style.display = hasOpenMatches ? 'inline-flex' : 'none';
}

// ===============================
// RÉSUMÉ FIN DE JOURNÉE (FALLBACK)
// ===============================

/**
 * Génère le HTML du résumé simple (sans bonus consolidés)
 */
function renderSummaryFallbackHTML(stats, selectedMatchDay) {
    const { totalPoints, exact, close, good, correct, wrong } = stats;
    const displayPoints = Math.round(totalPoints * 10) / 10;

    return `
        <div class="summary-title">📊 Résumé de la journée ${selectedMatchDay}</div>
        <div class="summary-stats">
            <div class="summary-stat">
                <span class="value">${displayPoints}</span>
                <span class="label">Points</span>
            </div>
            <div class="summary-stat">
                <span class="value">${exact}</span>
                <span class="label">🏆 Exact</span>
            </div>
            <div class="summary-stat">
                <span class="value">${close}</span>
                <span class="label">🎯 Proche</span>
            </div>
            <div class="summary-stat">
                <span class="value">${good + correct}</span>
                <span class="label">✅ Bon</span>
            </div>
            <div class="summary-stat">
                <span class="value">${wrong}</span>
                <span class="label">❌ Raté</span>
            </div>
        </div>
    `;
}

// ===============================
// CLASSEMENT
// ===============================

/**
 * Génère le HTML du tableau de classement
 * @param {Array} playersWithStats - joueurs triés avec leurs stats calculées
 * @param {Object} currentPlayer - joueur connecté (pour highlight)
 * @returns {string} HTML des lignes <tr>
 */
function renderLeaderboardHTML(playersWithStats, currentPlayerObj) {
    if (playersWithStats.length === 0) {
        return '<tr><td colspan="9">Aucun joueur inscrit</td></tr>';
    }
    
    let html = '';
    
    playersWithStats.forEach((player, index) => {
        const rank = index + 1;
        const stats = player.calculatedStats || {};
        
        const totalMatches = (stats.exactScores || 0) + (stats.closeScores || 0) + 
                             (stats.goodScores || 0) + (stats.correctResults || 0) + (stats.wrongResults || 0);
        const successRate = totalMatches > 0 
            ? Math.round(((stats.exactScores || 0) + (stats.closeScores || 0) + (stats.goodScores || 0) + (stats.correctResults || 0)) / totalMatches * 100)
            : 0;
        const journeys = stats.journeysPlayed?.length || stats.journeys || 0;
        const avg = journeys > 0 
            ? ((stats.totalPoints || 0) / journeys).toFixed(1)
            : '0.0';
        
        let rankClass = '';
        if (rank === 1) rankClass = 'rank-1';
        else if (rank === 2) rankClass = 'rank-2';
        else if (rank === 3) rankClass = 'rank-3';
        
        if (currentPlayerObj && player.id === currentPlayerObj.id) {
            rankClass += ' current-player';
        }
        
        let rankIcon = rank;
        if (rank === 1) rankIcon = '🥇';
        else if (rank === 2) rankIcon = '🥈';
        else if (rank === 3) rankIcon = '🥉';
        
        const displayPoints = Math.round((stats.totalPoints || 0) * 10) / 10;
        
        const levelBadge = typeof renderPlayerLevelBadge === 'function' 
            ? renderPlayerLevelBadge(stats.totalPoints || 0, 'small') 
            : '';
        
        html += `
            <tr class="${rankClass}" 
                onclick="showPlayerStatsModal('${player.id}', '${player.pseudo}')" 
                style="cursor:pointer;" 
                title="Cliquer pour voir les statistiques">
                <td><span class="rank-icon">${rankIcon}</span></td>
                <td>${levelBadge} ${player.pseudo}</td>
                <td><strong>${displayPoints}</strong></td>
                <td>${avg}</td>
                <td>${stats.exactScores || 0}</td>
                <td>${stats.closeScores || 0}</td>
                <td>${(stats.goodScores || 0) + (stats.correctResults || 0)}</td>
                <td>${stats.wrongResults || 0}</td>
                <td>${successRate}%</td>
            </tr>
        `;
    });
    
    return html;
}

/**
 * Met à jour le rang et les stats du joueur dans le header
 */
function updatePlayerRankDisplay(playersWithStats, currentPlayerObj) {
    if (!currentPlayerObj) return;
    
    const playerRank = playersWithStats.findIndex(p => p.id === currentPlayerObj.id) + 1;
    if (playerRank > 0) {
        let rankText = `${playerRank}${playerRank === 1 ? 'er' : 'e'}`;
        if (playerRank <= 3) {
            rankText = ['🥇', '🥈', '🥉'][playerRank - 1];
        }
        document.getElementById('playerRank').textContent = rankText;
        
        const playerStats = playersWithStats[playerRank - 1]?.calculatedStats || {};
        const journeys = playerStats.journeysPlayed?.length || 0;
        document.getElementById('playerStats').textContent = 
            `${Math.round((playerStats.totalPoints || 0) * 10) / 10} pts - ${journeys} journée(s)`;
    }
}

// ===============================
// HISTORIQUE
// ===============================

/**
 * Génère le HTML de la liste d'historique
 * @param {Array} history - entrées de pronostics
 * @param {Array} allMatchesArr - tous les matchs joués
 * @param {Array} allTeamsArr - toutes les équipes
 * @returns {string} HTML
 */
function renderHistoryHTML(history, allMatchesArr, allTeamsArr) {
    if (history.length === 0) {
        return '<p style="text-align:center;color:#7f8c8d;">Aucun historique disponible</p>';
    }
    
    let html = '';
    
    for (const entry of history) {
        const matchesThisDay = allMatchesArr.filter(m => m.matchDay === entry.matchDay);
        
        let totalPoints = 0;
        let matchesHtml = '';
        
        entry.predictions.forEach(pred => {
            const match = matchesThisDay.find(m => 
                m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
            );
            
            const homeTeam = allTeamsArr.find(t => t.id == pred.homeTeamId);
            const awayTeam = allTeamsArr.find(t => t.id == pred.awayTeamId);
            
            let result = { points: 0, finalPoints: 0, class: 'wrong', label: '-' };
            let realScore = '-';

            if (match && match.finalScore) {
                result = calculatePredictionResult(
                    pred.homeScore, pred.awayScore,
                    match.finalScore.home, match.finalScore.away,
                    pred.savedAt, match, pred.odds, pred.joker || false
                );
                totalPoints += result.finalPoints;
                realScore = `${match.finalScore.home}-${match.finalScore.away}`;
            }
            
            const jokerBadge = pred.joker ? '<span class="joker-badge">🃏</span>' : '';
            
            matchesHtml += `
                <div class="history-match">
                    <span class="history-match-teams">${jokerBadge}${homeTeam?.shortName || '?'} - ${awayTeam?.shortName || '?'}</span>
                    <div class="history-match-scores">
                        <span class="history-prono">${pred.homeScore}-${pred.awayScore}</span>
                        <span class="history-real">${realScore}</span>
                        <span class="history-points-match ${result.class}">${Math.round((result.finalPoints || result.points) * 10) / 10}</span>
                    </div>
                </div>
            `;
        });
        
        html += `
            <div class="history-card">
                <div class="history-card-header">
                    <span class="history-matchday">Journée ${entry.matchDay}</span>
                    <span class="history-points">${Math.round(totalPoints * 10) / 10} pts</span>
                </div>
                <div class="history-card-body">
                    ${matchesHtml}
                </div>
            </div>
        `;
    }
    
    return html;
}

// ===============================
// PROFIL
// ===============================

/**
 * Génère le HTML du contenu du profil
 * @param {Object} stats - stats calculées du joueur
 * @param {Object} player - joueur connecté
 * @param {string} season - saison en cours
 * @param {Object} jokers - données jokers du joueur
 * @returns {string} HTML
 */
function renderProfileHTML(stats, player, season, jokers) {
    let html = '';
    
    // Niveau et progression
    if (typeof addGamificationToStatsModal === 'function') {
        html += `
            <div class="profile-section">
                <h4>🎮 Niveau & Progression</h4>
                ${addGamificationToStatsModal(stats)}
            </div>
        `;
    }
    
    // Jokers restants
    if (jokers && typeof JOKER_CONFIG !== 'undefined') {
        html += `
            <div class="profile-section">
                <h4>🃏 Jokers</h4>
                <div class="jokers-info">
                    <div class="jokers-remaining">
                        <span class="jokers-count">${jokers.remaining}</span>
                        <span class="jokers-label">/ ${JOKER_CONFIG.maxPerSeason} restants</span>
                    </div>
                    <p class="jokers-desc">
                        Utilisez un joker sur un match pour <strong>doubler</strong> vos points !
                        Sélectionnable dans l'onglet Pronostiquer.
                    </p>
                </div>
            </div>
        `;
    }
    
    // Fallback si aucune fonctionnalité gamification
    if (!html) {
        html = `
            <div class="profile-section">
                <h4>📊 Mes statistiques</h4>
                <div class="stats-overview">
                    <div class="stats-card">
                        <div class="stats-value">${Math.round(stats.totalPoints * 10) / 10}</div>
                        <div class="stats-label">Points totaux</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-value">${stats.journeysPlayed?.length || 0}</div>
                        <div class="stats-label">Journées jouées</div>
                    </div>
                    <div class="stats-card">
                        <div class="stats-value">${stats.exactScores || 0}</div>
                        <div class="stats-label">Scores exacts</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    return html;
}

// ===============================
// SÉLECTEUR DE JOURNÉE
// ===============================

/**
 * Construit les options du sélecteur de journée
 * @returns {number} currentMatchDay - la journée à sélectionner par défaut
 */
function buildMatchDayOptions(select, allMatchesArr, futureMatchesArr, allTeamsArr) {
    select.innerHTML = '';
    
    const playedByDay = {};
    allMatchesArr.forEach(m => {
        const day = m.matchDay || 0;
        playedByDay[day] = (playedByDay[day] || 0) + 1;
    });
    
    const totalByDay = {};
    futureMatchesArr.forEach(m => {
        const day = m.matchDay || 0;
        totalByDay[day] = (totalByDay[day] || 0) + 1;
    });
    allMatchesArr.forEach(m => {
        const day = m.matchDay || 0;
        totalByDay[day] = (totalByDay[day] || 0) + 1;
    });
    
    const matchesPerDay = allTeamsArr.length / 2;
    
    const allDays = new Set([
        ...Object.keys(playedByDay).map(Number),
        ...Object.keys(totalByDay).map(Number)
    ]);
    const sortedDays = [...allDays].sort((a, b) => a - b);
    
    let currentMatchDay = null;
    const now = new Date();
    const POSTPONE_THRESHOLD = 5 * 24 * 60 * 60 * 1000; // 5 jours
    
    for (const day of sortedDays) {
        const played = playedByDay[day] || 0;
        const total = totalByDay[day] || matchesPerDay;
        
        if (played >= total || played >= matchesPerDay) continue; // Journée complète
        
        // Journée incomplète — vérifier si les matchs restants sont reportés loin
        const unplayedMatches = [
            ...futureMatchesArr.filter(m => m.matchDay === day),
            ...allMatchesArr.filter(m => m.matchDay === day && !m.finalScore)
        ];
        
        const allPostponed = unplayedMatches.length > 0 && unplayedMatches.every(m => {
            const scheduled = m.scheduledAt || m.date;
            if (!scheduled) return false;
            return (new Date(scheduled).getTime() - now.getTime()) > POSTPONE_THRESHOLD;
        });
        
        if (allPostponed && played > 0) {
            // Matchs restants reportés à +5 jours et journée déjà entamée → on skip
            continue;
        }
        
        currentMatchDay = day;
        break;
    }
    
    if (!currentMatchDay) {
        const lastPlayed = Math.max(0, ...Object.keys(playedByDay).map(Number));
        currentMatchDay = lastPlayed + 1;
    }
    
    const maxDay = Math.max(...sortedDays, currentMatchDay);
    
    for (let day = 1; day <= maxDay; day++) {
        const played = playedByDay[day] || 0;
        
        let label;
        if (played === 0) {
            label = `Journée ${day} (à venir)`;
        } else if (played >= matchesPerDay) {
            label = `Journée ${day} (terminée)`;
        } else {
            // Vérifier si les matchs restants sont reportés
            const unplayed = [
                ...futureMatchesArr.filter(m => m.matchDay === day),
                ...allMatchesArr.filter(m => m.matchDay === day && !m.finalScore)
            ];
            const hasPostponed = unplayed.some(m => {
                const scheduled = m.scheduledAt || m.date;
                if (!scheduled) return false;
                return (new Date(scheduled).getTime() - now.getTime()) > POSTPONE_THRESHOLD;
            });
            
            if (hasPostponed) {
                label = `Journée ${day} (${played}/${matchesPerDay} · reporté)`;
            } else {
                label = `Journée ${day} (${played}/${matchesPerDay} joués)`;
            }
        }
        
        const option = document.createElement('option');
        option.value = day;
        option.textContent = label;
        select.appendChild(option);
    }
    
    return currentMatchDay;
}

console.log('🎨 Module pronostics-view chargé');