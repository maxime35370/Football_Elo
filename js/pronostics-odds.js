// pronostics-odds.js - Système de cotes dynamiques

// ===============================
// CALCUL DES COTES
// ===============================

// Cotes de base selon l'Elo
function calculateBaseOdds(homeElo, awayElo) {
    const homeAdvantage = 65;
    const adjustedHomeElo = homeElo + homeAdvantage;
    
    // Probabilité de victoire domicile
    const homeExpectancy = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
    
    // Probabilité de nul
    const eloDiff = Math.abs(adjustedHomeElo - awayElo);
    let drawProb = Math.max(0.18, 0.32 - (eloDiff / 800));
    
    // Probabilités finales
    let homeWinProb = homeExpectancy * (1 - drawProb);
    let awayWinProb = (1 - homeExpectancy) * (1 - drawProb);
    
    // Normaliser
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb /= total;
    drawProb /= total;
    awayWinProb /= total;
    
    // Convertir en cotes (1 / probabilité)
    // Avec une marge de 5% pour le "bookmaker"
    const margin = 0.95;
    
    return {
        home: Math.round((1 / homeWinProb) * margin * 100) / 100,
        draw: Math.round((1 / drawProb) * margin * 100) / 100,
        away: Math.round((1 / awayWinProb) * margin * 100) / 100,
        probabilities: {
            home: Math.round(homeWinProb * 100),
            draw: Math.round(drawProb * 100),
            away: Math.round(awayWinProb * 100)
        }
    };
}

// Récupérer la distribution des pronostics des joueurs
async function getPredictionsDistribution(season, matchDay, homeTeamId, awayTeamId) {
    try {
        const allPredictions = await getAllPredictionsForMatchDay(season, matchDay);
        
        let homeWinCount = 0;
        let drawCount = 0;
        let awayWinCount = 0;
        let totalPredictions = 0;
        
        for (const playerPred of allPredictions) {
            const pred = playerPred.predictions.find(p => 
                p.homeTeamId == homeTeamId && p.awayTeamId == awayTeamId
            );
            
            if (!pred) continue;
            
            totalPredictions++;
            
            if (pred.homeScore > pred.awayScore) {
                homeWinCount++;
            } else if (pred.homeScore < pred.awayScore) {
                awayWinCount++;
            } else {
                drawCount++;
            }
        }
        
        if (totalPredictions === 0) {
            return null;
        }
        
        return {
            home: Math.round((homeWinCount / totalPredictions) * 100),
            draw: Math.round((drawCount / totalPredictions) * 100),
            away: Math.round((awayWinCount / totalPredictions) * 100),
            totalPredictions: totalPredictions,
            counts: {
                home: homeWinCount,
                draw: drawCount,
                away: awayWinCount
            }
        };
        
    } catch (error) {
        console.error('Erreur getPredictionsDistribution:', error);
        return null;
    }
}

// Ajuster les cotes selon la distribution des pronos
function adjustOddsWithDistribution(baseOdds, distribution) {
    if (!distribution || distribution.totalPredictions < 3) {
        // Pas assez de données, retourner les cotes de base
        return {
            ...baseOdds,
            adjusted: false,
            distribution: null
        };
    }
    
    const avgPrediction = 100 / 3; // 33.3%
    
    // Plus un résultat est populaire, moins il rapporte
    // Formule: cote ajustée = cote de base × (moyenne / pourcentage réel)
    
    const adjustFactor = (basePercent, actualPercent) => {
        if (actualPercent === 0) return 2.0; // Double la cote si personne n'a parié
        if (actualPercent >= 80) return 0.5; // Divise par 2 si trop populaire
        return Math.max(0.5, Math.min(2.0, avgPrediction / actualPercent));
    };
    
    return {
        home: Math.round(baseOdds.home * adjustFactor(baseOdds.probabilities.home, distribution.home) * 100) / 100,
        draw: Math.round(baseOdds.draw * adjustFactor(baseOdds.probabilities.draw, distribution.draw) * 100) / 100,
        away: Math.round(baseOdds.away * adjustFactor(baseOdds.probabilities.away, distribution.away) * 100) / 100,
        probabilities: baseOdds.probabilities,
        adjusted: true,
        distribution: distribution
    };
}

// Calculer les cotes finales pour un match
async function getMatchOdds(match, teamsWithElo) {
    // Récupérer les Elo
    const homeEloData = teamsWithElo?.find(t => t.id == match.homeTeamId);
    const awayEloData = teamsWithElo?.find(t => t.id == match.awayTeamId);
    
    const homeElo = homeEloData?.eloRating || 1500;
    const awayElo = awayEloData?.eloRating || 1500;
    
    // Cotes de base
    const baseOdds = calculateBaseOdds(homeElo, awayElo);
    
    // Distribution des pronos
    const distribution = await getPredictionsDistribution(
        currentSeason, 
        match.matchDay, 
        match.homeTeamId, 
        match.awayTeamId
    );
    
    // Cotes ajustées
    const adjustedOdds = adjustOddsWithDistribution(baseOdds, distribution);
    
    return adjustedOdds;
}

// ===============================
// MULTIPLICATEUR DE TIMING
// ===============================

function getTimingMultiplier(savedAt, matchStart) {
    if (!savedAt || !matchStart) return 1.0;
    
    const saveDate = new Date(savedAt);
    const matchDate = new Date(matchStart);
    
    const hoursBeforeMatch = (matchDate - saveDate) / (1000 * 60 * 60);
    
    if (hoursBeforeMatch > 48) return 1.2;   // 48h+ avant → bonus 20%
    if (hoursBeforeMatch > 24) return 1.0;   // 24-48h → normal
    if (hoursBeforeMatch > 6)  return 0.9;   // 6-24h → malus 10%
    if (hoursBeforeMatch > 1)  return 0.75;  // 1-6h → malus 25%
    return 0.5;                               // <1h → malus 50%
}

// ===============================
// CALCUL DES POINTS AVEC COTES
// ===============================

async function calculatePointsWithOdds(prediction, match, teamsWithElo) {
    // Points de base
    const baseResult = calculatePredictionResult(
        prediction.homeScore, 
        prediction.awayScore,
        match.finalScore.home, 
        match.finalScore.away,
        prediction.savedAt,
        match
    );
    
    if (baseResult.points === 0) {
        return {
            basePoints: 0,
            oddsMultiplier: 1,
            timingMultiplier: 1,
            finalPoints: 0,
            breakdown: baseResult
        };
    }
    
    // Récupérer les cotes
    const odds = await getMatchOdds(match, teamsWithElo);
    
    // Déterminer le résultat prédit
    let predResult;
    if (prediction.homeScore > prediction.awayScore) {
        predResult = 'home';
    } else if (prediction.homeScore < prediction.awayScore) {
        predResult = 'away';
    } else {
        predResult = 'draw';
    }
    
    // Multiplicateur de cote (normalisé entre 0.5 et 2.0)
    let oddsMultiplier = 1;
    if (odds.adjusted && odds.distribution) {
        const popularity = odds.distribution[predResult];
        // Plus c'est populaire, moins ça rapporte
        if (popularity >= 60) {
            oddsMultiplier = 0.7;
        } else if (popularity >= 40) {
            oddsMultiplier = 0.85;
        } else if (popularity <= 15) {
            oddsMultiplier = 1.5;
        } else if (popularity <= 25) {
            oddsMultiplier = 1.2;
        }
    }
    
    // Multiplicateur de timing
    const timingMultiplier = getTimingMultiplier(prediction.savedAt, match.scheduledAt);
    
    // Points finaux
    const finalPoints = Math.round(baseResult.points * oddsMultiplier * timingMultiplier * 10) / 10;
    
    return {
        basePoints: baseResult.points,
        oddsMultiplier: oddsMultiplier,
        timingMultiplier: timingMultiplier,
        finalPoints: finalPoints,
        breakdown: baseResult,
        odds: odds
    };
}

// ===============================
// AFFICHAGE DES COTES
// ===============================

function renderOddsDisplay(odds, homeTeamName, awayTeamName) {
    const isAdjusted = odds.adjusted && odds.distribution;
    
    let html = `
        <div class="odds-display ${isAdjusted ? 'adjusted' : ''}">
            <div class="odds-header">
                <span class="odds-title">📊 Cotes ${isAdjusted ? 'dynamiques' : 'Elo'}</span>
                ${isAdjusted ? `<span class="odds-players">${odds.distribution.totalPredictions} joueurs</span>` : ''}
            </div>
            <div class="odds-row">
                <div class="odds-option">
                    <span class="odds-label">${homeTeamName}</span>
                    <span class="odds-value">×${odds.home.toFixed(2)}</span>
                    ${isAdjusted ? `<span class="odds-pop">${odds.distribution.home}%</span>` : ''}
                    <div class="odds-bar">
                        <div class="odds-fill home" style="width: ${odds.probabilities.home}%"></div>
                    </div>
                </div>
                <div class="odds-option">
                    <span class="odds-label">Nul</span>
                    <span class="odds-value">×${odds.draw.toFixed(2)}</span>
                    ${isAdjusted ? `<span class="odds-pop">${odds.distribution.draw}%</span>` : ''}
                    <div class="odds-bar">
                        <div class="odds-fill draw" style="width: ${odds.probabilities.draw}%"></div>
                    </div>
                </div>
                <div class="odds-option">
                    <span class="odds-label">${awayTeamName}</span>
                    <span class="odds-value">×${odds.away.toFixed(2)}</span>
                    ${isAdjusted ? `<span class="odds-pop">${odds.distribution.away}%</span>` : ''}
                    <div class="odds-bar">
                        <div class="odds-fill away" style="width: ${odds.probabilities.away}%"></div>
                    </div>
                </div>
            </div>
    `;
    
    if (isAdjusted) {
        // Trouver le meilleur ratio
        const bestValue = Math.min(
            odds.distribution.home > 0 ? odds.home : 999,
            odds.distribution.draw > 0 ? odds.draw : 999,
            odds.distribution.away > 0 ? odds.away : 999
        );
        
        let tip = '';
        if (odds.draw === bestValue && odds.distribution.draw < 25) {
            tip = `💡 Le nul est peu populaire (${odds.distribution.draw}%), ça peut rapporter gros !`;
        } else if (odds.away === bestValue && odds.distribution.away < 20) {
            tip = `💡 Victoire ${awayTeamName} risquée mais rentable (×${odds.away.toFixed(2)}) !`;
        }
        
        if (tip) {
            html += `<div class="odds-tip">${tip}</div>`;
        }
    }
    
    html += `</div>`;
    
    return html;
}

// Afficher le détail des points avec multiplicateurs
function renderPointsBreakdown(pointsData) {
    const { basePoints, oddsMultiplier, timingMultiplier, finalPoints } = pointsData;
    
    if (finalPoints === 0) {
        return `<span class="points-final">0 pts</span>`;
    }
    
    let html = `
        <div class="points-breakdown">
            <span class="points-base">${basePoints} pts</span>
    `;
    
    if (oddsMultiplier !== 1) {
        const oddsClass = oddsMultiplier > 1 ? 'bonus' : 'malus';
        html += `<span class="points-mult ${oddsClass}">×${oddsMultiplier.toFixed(2)} cote</span>`;
    }
    
    if (timingMultiplier !== 1) {
        const timingClass = timingMultiplier > 1 ? 'bonus' : 'malus';
        const timingLabel = timingMultiplier > 1 ? '⏰ early' : '⏰ late';
        html += `<span class="points-mult ${timingClass}">×${timingMultiplier.toFixed(2)} ${timingLabel}</span>`;
    }
    
    html += `
            <span class="points-equals">=</span>
            <span class="points-final">${finalPoints} pts</span>
        </div>
    `;
    
    return html;
}

// ===============================
// INTÉGRATION DANS LE FORMULAIRE
// ===============================

async function addOddsToMatchCard(matchElement, match, teamsWithElo) {
    const odds = await getMatchOdds(match, teamsWithElo);
    
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    const oddsHtml = renderOddsDisplay(odds, homeTeam?.shortName || '?', awayTeam?.shortName || '?');
    
    // Insérer après les inputs de score
    const scoreDiv = matchElement.querySelector('.prediction-score');
    if (scoreDiv) {
        const oddsDiv = document.createElement('div');
        oddsDiv.className = 'match-odds-container';
        oddsDiv.innerHTML = oddsHtml;
        scoreDiv.after(oddsDiv);
    }
}

// ===============================
// MODE COTES (TOGGLE)
// ===============================

let oddsMode = false;

function toggleOddsMode() {
    oddsMode = !oddsMode;
    
    const btn = document.getElementById('oddsModeBtn');
    if (btn) {
        btn.classList.toggle('active', oddsMode);
        btn.textContent = oddsMode ? '📊 Cotes ON' : '📊 Cotes OFF';
    }
    
    // Rafraîchir l'affichage
    if (typeof displayPredictionsForm === 'function') {
        displayPredictionsForm();
    }
}

function isOddsModeEnabled() {
    return oddsMode;
}