// pronostics-consensus.js - Consensus joueurs et Suggestions IA

// ===============================
// CONSENSUS DES JOUEURS
// ===============================

/**
 * Récupère la distribution des pronostics pour un match spécifique
 * (Visible uniquement après le début du match ou la deadline)
 */
async function getMatchConsensus(homeTeamId, awayTeamId, matchDay) {
    const allPredictions = await getAllPredictionsForMatchDay(currentSeason, matchDay);
    
    const consensus = {
        homeWin: 0,
        draw: 0,
        awayWin: 0,
        totalPlayers: 0,
        scores: {},  // Distribution des scores exacts
        avgHomeGoals: 0,
        avgAwayGoals: 0
    };
    
    let totalHomeGoals = 0;
    let totalAwayGoals = 0;
    
    for (const playerPreds of allPredictions) {
        if (!playerPreds.predictions) continue;
        
        const matchPred = playerPreds.predictions.find(p => 
            p.homeTeamId == homeTeamId && p.awayTeamId == awayTeamId
        );
        
        if (!matchPred) continue;
        
        consensus.totalPlayers++;
        totalHomeGoals += matchPred.homeScore;
        totalAwayGoals += matchPred.awayScore;
        
        // Comptage 1/N/2
        if (matchPred.homeScore > matchPred.awayScore) {
            consensus.homeWin++;
        } else if (matchPred.homeScore < matchPred.awayScore) {
            consensus.awayWin++;
        } else {
            consensus.draw++;
        }
        
        // Distribution des scores
        const scoreKey = `${matchPred.homeScore}-${matchPred.awayScore}`;
        consensus.scores[scoreKey] = (consensus.scores[scoreKey] || 0) + 1;
    }
    
    // Calculer les pourcentages et moyennes
    if (consensus.totalPlayers > 0) {
        consensus.homeWinPct = Math.round((consensus.homeWin / consensus.totalPlayers) * 100);
        consensus.drawPct = Math.round((consensus.draw / consensus.totalPlayers) * 100);
        consensus.awayWinPct = Math.round((consensus.awayWin / consensus.totalPlayers) * 100);
        consensus.avgHomeGoals = (totalHomeGoals / consensus.totalPlayers).toFixed(1);
        consensus.avgAwayGoals = (totalAwayGoals / consensus.totalPlayers).toFixed(1);
        
        // Trouver le score le plus populaire
        const sortedScores = Object.entries(consensus.scores)
            .sort((a, b) => b[1] - a[1]);
        
        if (sortedScores.length > 0) {
            consensus.mostPopularScore = sortedScores[0][0];
            consensus.mostPopularScoreCount = sortedScores[0][1];
            consensus.mostPopularScorePct = Math.round((sortedScores[0][1] / consensus.totalPlayers) * 100);
        }
        
        // Top 3 des scores
        consensus.topScores = sortedScores.slice(0, 3).map(([score, count]) => ({
            score,
            count,
            pct: Math.round((count / consensus.totalPlayers) * 100)
        }));
    }
    
    return consensus;
}

/**
 * Vérifie si le consensus est visible pour un match
 * (Après la deadline ou après le début du match)
 */
function isConsensusVisible(match) {
    const now = new Date();
    
    // Si le match a un résultat, le consensus est visible
    if (match.finalScore) return true;
    
    // Si le match a une heure de début et qu'elle est passée
    if (match.scheduledAt) {
        const matchTime = new Date(match.scheduledAt);
        if (now >= matchTime) return true;
    }
    
    return false;
}

/**
 * Génère le HTML pour afficher le consensus d'un match
 */
function renderConsensusDisplay(consensus, homeTeamName, awayTeamName) {
    if (consensus.totalPlayers === 0) {
        return `
            <div class="consensus-empty">
                <p>Aucun pronostic pour ce match</p>
            </div>
        `;
    }
    
    return `
        <div class="consensus-display">
            <div class="consensus-header">
                <span class="consensus-icon">📊</span>
                <span class="consensus-title">Consensus (${consensus.totalPlayers} joueurs)</span>
            </div>
            
            <div class="consensus-distribution">
                <div class="consensus-bar">
                    <div class="consensus-segment home" style="width: ${consensus.homeWinPct}%">
                        ${consensus.homeWinPct > 15 ? consensus.homeWinPct + '%' : ''}
                    </div>
                    <div class="consensus-segment draw" style="width: ${consensus.drawPct}%">
                        ${consensus.drawPct > 15 ? consensus.drawPct + '%' : ''}
                    </div>
                    <div class="consensus-segment away" style="width: ${consensus.awayWinPct}%">
                        ${consensus.awayWinPct > 15 ? consensus.awayWinPct + '%' : ''}
                    </div>
                </div>
                <div class="consensus-labels">
                    <span class="home">${homeTeamName}</span>
                    <span class="draw">Nul</span>
                    <span class="away">${awayTeamName}</span>
                </div>
            </div>
            
            ${consensus.topScores && consensus.topScores.length > 0 ? `
                <div class="consensus-scores">
                    <span class="scores-title">Scores populaires:</span>
                    ${consensus.topScores.map((s, i) => `
                        <span class="score-badge ${i === 0 ? 'top' : ''}">${s.score} (${s.pct}%)</span>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="consensus-avg">
                Score moyen: <strong>${consensus.avgHomeGoals} - ${consensus.avgAwayGoals}</strong>
            </div>
        </div>
    `;
}

// ===============================
// SUGGESTIONS IA
// ===============================

/**
 * Récupère la suggestion IA pour un match
 */
async function getIASuggestion(match) {
    const iaPredictions = await getIAPredictions(currentSeason);
    
    if (!iaPredictions || !iaPredictions.matchDays || !iaPredictions.matchDays[match.matchDay]) {
        return null;
    }
    
    const matchPred = iaPredictions.matchDays[match.matchDay].predictions.find(p =>
        p.homeTeamId == match.homeTeamId && p.awayTeamId == match.awayTeamId
    );
    
    if (!matchPred) return null;
    
    return {
        homeScore: matchPred.homeScore,
        awayScore: matchPred.awayScore,
        homeWinProb: matchPred.homeWinProb,
        drawProb: matchPred.drawProb,
        awayWinProb: matchPred.awayWinProb,
        homeElo: matchPred.homeElo,
        awayElo: matchPred.awayElo
    };
}

/**
 * Génère le HTML pour afficher la suggestion IA
 */
function renderIASuggestion(suggestion, homeTeamName, awayTeamName) {
    if (!suggestion) {
        return '';
    }
    
    // Déterminer le favori
    let favoriteText = '';
    let favoriteClass = '';
    
    if (suggestion.homeScore > suggestion.awayScore) {
        favoriteText = `Victoire ${homeTeamName}`;
        favoriteClass = 'home';
    } else if (suggestion.homeScore < suggestion.awayScore) {
        favoriteText = `Victoire ${awayTeamName}`;
        favoriteClass = 'away';
    } else {
        favoriteText = 'Match nul';
        favoriteClass = 'draw';
    }
    
    return `
        <div class="ia-suggestion">
            <div class="ia-suggestion-header">
                <span class="ia-icon">🤖</span>
                <span class="ia-title">Suggestion IA</span>
            </div>
            <div class="ia-suggestion-content">
                <div class="ia-score">
                    <span class="score">${suggestion.homeScore} - ${suggestion.awayScore}</span>
                    <span class="result ${favoriteClass}">${favoriteText}</span>
                </div>
                <div class="ia-probabilities">
                    <div class="prob-item home">
                        <span class="prob-label">${homeTeamName}</span>
                        <span class="prob-value">${suggestion.homeWinProb}%</span>
                    </div>
                    <div class="prob-item draw">
                        <span class="prob-label">Nul</span>
                        <span class="prob-value">${suggestion.drawProb}%</span>
                    </div>
                    <div class="prob-item away">
                        <span class="prob-label">${awayTeamName}</span>
                        <span class="prob-value">${suggestion.awayWinProb}%</span>
                    </div>
                </div>
            </div>
            <button class="btn-use-suggestion" onclick="applySuggestion(${suggestion.homeScore}, ${suggestion.awayScore}, this)">
                ✨ Utiliser ce score
            </button>
        </div>
    `;
}

/**
 * Applique la suggestion IA dans les inputs du formulaire
 */
function applySuggestion(homeScore, awayScore, button) {
    // Trouver le match card parent
    const matchCard = button.closest('.prediction-match');
    if (!matchCard) return;
    
    // Remplir les inputs
    const homeInput = matchCard.querySelector('.home-score');
    const awayInput = matchCard.querySelector('.away-score');
    
    if (homeInput && !homeInput.disabled) {
        homeInput.value = homeScore;
    }
    if (awayInput && !awayInput.disabled) {
        awayInput.value = awayScore;
    }
    
    // Animation de confirmation
    button.textContent = '✅ Appliqué !';
    button.classList.add('applied');
    
    setTimeout(() => {
        button.textContent = '✨ Utiliser ce score';
        button.classList.remove('applied');
    }, 2000);
}

// ===============================
// INTÉGRATION DANS LE FORMULAIRE
// ===============================

/**
 * Ajoute le consensus et les suggestions IA aux cartes de match
 * À appeler après displayPredictionsForm()
 */
async function enhanceMatchCardsWithConsensus() {
    const matchCards = document.querySelectorAll('.prediction-match');
    
    for (const card of matchCards) {
        const homeTeamId = parseInt(card.dataset.home);
        const awayTeamId = parseInt(card.dataset.away);
        
        // Trouver le match
        const match = [...allMatches, ...futureMatches].find(m => 
            m.homeTeamId == homeTeamId && 
            m.awayTeamId == awayTeamId && 
            m.matchDay === selectedMatchDay
        );
        
        if (!match) continue;
        
        const homeTeam = allTeams.find(t => t.id == homeTeamId);
        const awayTeam = allTeams.find(t => t.id == awayTeamId);
        const homeTeamName = homeTeam?.shortName || '?';
        const awayTeamName = awayTeam?.shortName || '?';
        
        // Container pour les suggestions et consensus
        let enhancementHtml = '<div class="match-enhancements">';
        
        // Suggestion IA (toujours visible si match non verrouillé)
        const isLocked = card.classList.contains('locked');
        if (!isLocked) {
            const suggestion = await getIASuggestion(match);
            if (suggestion) {
                enhancementHtml += renderIASuggestion(suggestion, homeTeamName, awayTeamName);
            }
        }
        
        // Consensus (visible si match commencé ou terminé)
        if (isConsensusVisible(match)) {
            const consensus = await getMatchConsensus(homeTeamId, awayTeamId, selectedMatchDay);
            if (consensus.totalPlayers > 0) {
                enhancementHtml += renderConsensusDisplay(consensus, homeTeamName, awayTeamName);
            }
        }
        
        enhancementHtml += '</div>';
        
        // Ajouter au card (avant le résultat réel si présent)
        const actualResult = card.querySelector('.actual-result');
        if (actualResult) {
            actualResult.insertAdjacentHTML('beforebegin', enhancementHtml);
        } else {
            card.insertAdjacentHTML('beforeend', enhancementHtml);
        }
    }
    if (!showIASuggestions) {
        document.querySelectorAll('.ia-suggestion').forEach(s => {
            s.style.display = 'none';
        });
    }
}

/**
 * Toggle pour afficher/masquer les suggestions IA
 */
let showIASuggestions = false;

function toggleIASuggestions() {
    showIASuggestions = !showIASuggestions;
    
    const suggestions = document.querySelectorAll('.ia-suggestion');
    suggestions.forEach(s => {
        s.style.display = showIASuggestions ? 'block' : 'none';
    });
    
    const btn = document.getElementById('toggleSuggestionsBtn');
    if (btn) {
        btn.textContent = showIASuggestions ? '🤖 Masquer suggestions' : '🤖 Afficher suggestions';
    }
}