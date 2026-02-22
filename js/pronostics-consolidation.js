// =====================================================
// 🔥 CONSOLIDATION DES POINTS + RÉCAP JOURNÉE
// pronostics-consolidation.js
// Charger APRÈS tous les autres modules pronostics
// =====================================================

// ===============================
// 1. PATCH calculatePlayerDetailedStats
//    Ajoute : Super Joker, Buteur, Combiné, MVP
// ===============================

const _origCalculatePlayerDetailedStats = typeof calculatePlayerDetailedStats === 'function' 
    ? calculatePlayerDetailedStats : null;

calculatePlayerDetailedStats = async function(playerId) {
    // Appeler l'original pour les points de base
    const stats = _origCalculatePlayerDetailedStats 
        ? await _origCalculatePlayerDetailedStats(playerId) 
        : { totalPoints: 0, pointsByMatchDay: {}, cumulativePoints: {}, journeysPlayed: [], 
            exactScores: 0, closeScores: 0, goodScores: 0, correctResults: 0, wrongResults: 0 };
    
    // Ajouter les champs bonus
    stats.bonusPoints = {
        superJoker: 0,
        scorer: 0,
        combine: 0,
        challenges: 0,
        mvp: 0,
        total: 0
    };
    stats.bonusByMatchDay = {};
    
    try {
        const season = currentSeason;
        
        // --- SUPER JOKER ---
        let superJokerMatchDay = null;
        if (typeof getSuperJoker === 'function') {
            const sj = await getSuperJoker(playerId, season);
            if (sj && sj.used && sj.matchDay) {
                superJokerMatchDay = sj.matchDay;
                const baseDayPoints = stats.pointsByMatchDay[sj.matchDay] || 0;
                // Le Super Joker multiplie par 1.5 → le bonus est 0.5 × base
                const sjBonus = Math.round(baseDayPoints * 0.5 * 10) / 10;
                stats.bonusPoints.superJoker = sjBonus;
                
                if (!stats.bonusByMatchDay[sj.matchDay]) stats.bonusByMatchDay[sj.matchDay] = {};
                stats.bonusByMatchDay[sj.matchDay].superJoker = sjBonus;
                
                // Mettre à jour les points de la journée
                stats.pointsByMatchDay[sj.matchDay] = Math.round((baseDayPoints + sjBonus) * 10) / 10;
            }
        }
        
        // --- DÉFI BUTEUR ---
        if (typeof calculateScorerPointsForMatchDay === 'function') {
            for (const matchDay of stats.journeysPlayed) {
                try {
                    const preds = await getPlayerPredictions(playerId, season, matchDay);
                    if (preds && preds.predictions) {
                        const scorerResult = calculateScorerPointsForMatchDay(preds.predictions, matchDay);
                        const scorerPts = scorerResult?.totalPoints || 0;
                        if (scorerPts > 0) {
                            stats.bonusPoints.scorer += scorerPts;
                            if (!stats.bonusByMatchDay[matchDay]) stats.bonusByMatchDay[matchDay] = {};
                            stats.bonusByMatchDay[matchDay].scorer = scorerPts;
                            stats.pointsByMatchDay[matchDay] = Math.round((stats.pointsByMatchDay[matchDay] + scorerPts) * 10) / 10;
                        }
                    }
                } catch (e) {
                    console.error(`❌ Erreur scorer J${matchDay}:`, e);
                }
            }
        } else {
            console.warn('⚠️ calculateScorerPointsForMatchDay non trouvée');
        }
        
        // --- PARI COMBINÉ ---
        if (typeof calculateCombineResult === 'function' && typeof getPlayerCombine === 'function') {
            for (const matchDay of stats.journeysPlayed) {
                try {
                    const combine = await getPlayerCombine(playerId, season, matchDay);
                    if (combine && combine.matches) {
                        const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
                        const predictions = await getPlayerPredictions(playerId, season, matchDay);
                        
                        if (predictions && predictions.predictions) {
                            const combineResult = calculateCombineResult(combine, predictions.predictions, matchesThisDay);
                            if (combineResult && combineResult.bonusPoints > 0) {
                                stats.bonusPoints.combine += combineResult.bonusPoints;
                                if (!stats.bonusByMatchDay[matchDay]) stats.bonusByMatchDay[matchDay] = {};
                                stats.bonusByMatchDay[matchDay].combine = combineResult.bonusPoints;
                                stats.pointsByMatchDay[matchDay] = Math.round((stats.pointsByMatchDay[matchDay] + combineResult.bonusPoints) * 10) / 10;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`❌ Erreur combiné J${matchDay}:`, e);
                }
            }
        }
        
        // --- DÉFIS IA + BUTS TOTAUX ---
        if (typeof calculateAllChallengePoints === 'function') {
            for (const matchDay of stats.journeysPlayed) {
                try {
                    const challengeResult = await calculateAllChallengePoints(playerId, season, matchDay);
                    if (challengeResult && challengeResult.points > 0) {
                        stats.bonusPoints.challenges = (stats.bonusPoints.challenges || 0) + challengeResult.points;
                        if (!stats.bonusByMatchDay[matchDay]) stats.bonusByMatchDay[matchDay] = {};
                        stats.bonusByMatchDay[matchDay].challenges = challengeResult.points;
                        stats.pointsByMatchDay[matchDay] = Math.round((stats.pointsByMatchDay[matchDay] + challengeResult.points) * 10) / 10;
                    }
                } catch (e) {}
            }
        }
        
        // --- MVP BONUS ---
        if (typeof getMVPBonusForPlayer === 'function') {
            for (const matchDay of stats.journeysPlayed) {
                try {
                    const mvpBonus = await getMVPBonusForPlayer(playerId, season, matchDay);
                    if (mvpBonus && mvpBonus > 0) {
                        stats.bonusPoints.mvp += mvpBonus;
                        if (!stats.bonusByMatchDay[matchDay]) stats.bonusByMatchDay[matchDay] = {};
                        stats.bonusByMatchDay[matchDay].mvp = mvpBonus;
                        stats.pointsByMatchDay[matchDay] = Math.round((stats.pointsByMatchDay[matchDay] + mvpBonus) * 10) / 10;
                    }
                } catch (e) {}
            }
        }
        
        // --- RECALCUL TOTAL ---
        stats.bonusPoints.total = Math.round(
            (stats.bonusPoints.superJoker + stats.bonusPoints.scorer + 
             stats.bonusPoints.combine + (stats.bonusPoints.challenges || 0) + stats.bonusPoints.mvp) * 10
        ) / 10;
        
        // Recalculer totalPoints et cumulativePoints
        let cumul = 0;
        stats.totalPoints = 0;
        
        // Trier les journées
        const sortedDays = stats.journeysPlayed.sort((a, b) => a - b);
        for (const md of sortedDays) {
            const dayPts = stats.pointsByMatchDay[md] || 0;
            stats.totalPoints += dayPts;
            cumul += dayPts;
            stats.cumulativePoints[md] = Math.round(cumul * 10) / 10;
        }
        stats.totalPoints = Math.round(stats.totalPoints * 10) / 10;
        
    } catch (e) {
        console.error('Erreur consolidation bonus:', e);
    }
    
    return stats;
};


// ===============================
// 2. PATCH getMatchDayRanking
//    Même logique pour le classement par journée
// ===============================

const _origGetMatchDayRanking = typeof getMatchDayRanking === 'function' 
    ? getMatchDayRanking : null;

getMatchDayRanking = async function(matchDay) {
    // Appeler l'original
    const ranking = _origGetMatchDayRanking 
        ? await _origGetMatchDayRanking(matchDay) 
        : { players: [], iaResult: null, matchesPlayed: 0 };
    
    if (!ranking.players || ranking.players.length === 0) return ranking;
    
    const season = currentSeason;
    
    // Ajouter les bonus à chaque joueur
    for (const player of ranking.players) {
        player.bonuses = {};
        let bonusTotal = 0;
        
        // Super Joker
        if (typeof getSuperJoker === 'function') {
            try {
                const sj = await getSuperJoker(player.playerId, season);
                if (sj && sj.used && sj.matchDay === matchDay) {
                    const sjBonus = Math.round(player.points * 0.5 * 10) / 10;
                    player.bonuses.superJoker = sjBonus;
                    bonusTotal += sjBonus;
                }
            } catch (e) {}
        }
        
        // Buteur
        if (typeof calculateScorerPointsForMatchDay === 'function') {
            try {
                const preds = await getPlayerPredictions(player.playerId, season, matchDay);
                if (preds && preds.predictions) {
                    const scorerResult = calculateScorerPointsForMatchDay(preds.predictions, matchDay);
                    const scorerPts = scorerResult?.totalPoints || 0;
                    if (scorerPts > 0) {
                        player.bonuses.scorer = scorerPts;
                        bonusTotal += scorerPts;
                    }
                }
            } catch (e) {}
        }
        
        // Combiné
        if (typeof calculateCombineResult === 'function' && typeof getPlayerCombine === 'function') {
            try {
                const combine = await getPlayerCombine(player.playerId, season, matchDay);
                if (combine && combine.matches) {
                    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
                    const predictions = await getPlayerPredictions(player.playerId, season, matchDay);
                    if (predictions && predictions.predictions) {
                        const result = calculateCombineResult(combine, predictions.predictions, matchesThisDay);
                        if (result && result.bonusPoints > 0) {
                            player.bonuses.combine = result.bonusPoints;
                            bonusTotal += result.bonusPoints;
                        }
                    }
                }
            } catch (e) {}
        }
        
        // MVP
        if (typeof getMVPBonusForPlayer === 'function') {
            try {
                const mvpBonus = await getMVPBonusForPlayer(player.playerId, season, matchDay);
                if (mvpBonus > 0) {
                    player.bonuses.mvp = mvpBonus;
                    bonusTotal += mvpBonus;
                }
            } catch (e) {}
        }
        
        // Défis IA + buts totaux
        if (typeof calculateAllChallengePoints === 'function') {
            try {
                const challengeResult = await calculateAllChallengePoints(player.playerId, season, matchDay);
                if (challengeResult && challengeResult.points > 0) {
                    player.bonuses.challenges = challengeResult.points;
                    bonusTotal += challengeResult.points;
                }
            } catch (e) {}
        }
        
        player.bonusTotal = Math.round(bonusTotal * 10) / 10;
        player.totalWithBonus = Math.round((player.points + bonusTotal) * 10) / 10;
    }
    
    // Re-trier avec les bonus inclus
    ranking.players.sort((a, b) => b.totalWithBonus - a.totalWithBonus);
    
    // Re-attribuer les rangs
    ranking.players.forEach((p, i) => {
        p.rank = i + 1;
        p.points = p.totalWithBonus; // Écraser pour compatibilité
    });
    
    return ranking;
};


// ===============================
// 3. PATCH getMatchDayLeaderboard
//    Pour le résumé rapide
// ===============================

const _origGetMatchDayLeaderboard = typeof getMatchDayLeaderboard === 'function'
    ? getMatchDayLeaderboard : null;

getMatchDayLeaderboard = async function(matchDay) {
    const leaderboard = _origGetMatchDayLeaderboard 
        ? await _origGetMatchDayLeaderboard(matchDay) 
        : [];
    
    if (!leaderboard || leaderboard.length === 0) return leaderboard;
    
    const season = currentSeason;
    
    for (const player of leaderboard) {
        let bonusTotal = 0;
        
        // Super Joker
        if (typeof getSuperJoker === 'function') {
            try {
                const sj = await getSuperJoker(player.playerId, season);
                if (sj && sj.used && sj.matchDay === matchDay) {
                    bonusTotal += Math.round(player.points * 0.5 * 10) / 10;
                }
            } catch (e) {}
        }
        
        // Buteur
        if (typeof calculateScorerPointsForMatchDay === 'function') {
            try {
                const preds = await getPlayerPredictions(player.playerId, season, matchDay);
                if (preds && preds.predictions) {
                    const scorerResult = calculateScorerPointsForMatchDay(preds.predictions, matchDay);
                    if (scorerResult?.totalPoints > 0) bonusTotal += scorerResult.totalPoints;
                }
            } catch (e) {}
        }
        
        // Combiné
        if (typeof calculateCombineResult === 'function' && typeof getPlayerCombine === 'function') {
            try {
                const combine = await getPlayerCombine(player.playerId, season, matchDay);
                if (combine && combine.matches) {
                    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
                    const predictions = await getPlayerPredictions(player.playerId, season, matchDay);
                    if (predictions && predictions.predictions) {
                        const result = calculateCombineResult(combine, predictions.predictions, matchesThisDay);
                        if (result && result.bonusPoints > 0) bonusTotal += result.bonusPoints;
                    }
                }
            } catch (e) {}
        }
        
        // MVP
        if (typeof getMVPBonusForPlayer === 'function') {
            try {
                const mvpBonus = await getMVPBonusForPlayer(player.playerId, season, matchDay);
                if (mvpBonus > 0) bonusTotal += mvpBonus;
            } catch (e) {}
        }
        
        // Défis IA + buts totaux
        if (typeof calculateAllChallengePoints === 'function') {
            try {
                const challengeResult = await calculateAllChallengePoints(player.playerId, season, matchDay);
                if (challengeResult && challengeResult.points > 0) bonusTotal += challengeResult.points;
            } catch (e) {}
        }
        
        player.points = Math.round((player.points + bonusTotal) * 10) / 10;
    }
    
    leaderboard.sort((a, b) => b.points - a.points);
    return leaderboard;
};


// ===============================
// 4. RÉCAP FIN DE JOURNÉE
// ===============================

/**
 * Calcule le récap complet d'un joueur pour une journée
 */
async function getMatchDayRecap(playerId, matchDay) {
    const season = currentSeason;
    const predictions = await getPlayerPredictions(playerId, season, matchDay);
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
    
    if (!predictions || !predictions.predictions || matchesThisDay.length === 0) {
        return null;
    }
    
    const recap = {
        matchDay,
        // Points de base
        basePoints: 0,
        matches: [],
        exact: 0, close: 0, good: 0, correct: 0, wrong: 0,
        // Bonus
        bonuses: [],
        totalBonus: 0,
        // Total
        totalPoints: 0,
        // Classement
        rank: null, totalPlayers: 0,
        previousRank: null, // rang global avant cette journée
        newRank: null,      // rang global après cette journée
        // MVP
        isMVP: false,
        mvpPseudo: null
    };
    
    // --- Calcul des matchs ---
    for (const pred of predictions.predictions) {
        const match = matchesThisDay.find(m => 
            m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
        );
        if (!match) continue;
        
        const result = calculatePredictionResult(
            pred.homeScore, pred.awayScore,
            match.finalScore.home, match.finalScore.away,
            pred.savedAt, match, pred.odds, pred.joker || false
        );
        
        const pts = result.finalPoints || result.points;
        recap.basePoints += pts;
        
        const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
        const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
        
        recap.matches.push({
            homeTeam: homeTeam?.shortName || '?',
            awayTeam: awayTeam?.shortName || '?',
            predHome: pred.homeScore,
            predAway: pred.awayScore,
            realHome: match.finalScore.home,
            realAway: match.finalScore.away,
            points: pts,
            basePoints: result.points,
            class: result.class,
            label: result.label,
            joker: pred.joker || false,
            oddsMultiplier: result.oddsMultiplier
        });
        
        if (result.points === 9) recap.exact++;
        else if (result.points === 6) recap.close++;
        else if (result.points === 4) recap.good++;
        else if (result.points > 0) recap.correct++;
        else recap.wrong++;
    }
    
    recap.basePoints = Math.round(recap.basePoints * 10) / 10;
    recap.totalPoints = recap.basePoints;
    
    // --- Super Joker ---
    if (typeof getSuperJoker === 'function') {
        try {
            const sj = await getSuperJoker(playerId, season);
            if (sj && sj.used && sj.matchDay === matchDay) {
                const sjBonus = Math.round(recap.basePoints * 0.5 * 10) / 10;
                recap.bonuses.push({ type: 'superJoker', label: '🃏✨ Super Joker (×1.5)', points: sjBonus });
                recap.totalBonus += sjBonus;
            }
        } catch (e) {}
    }
    
    // --- Buteur ---
    if (typeof calculateScorerPointsForMatchDay === 'function') {
        try {
            if (predictions && predictions.predictions) {
                const scorerResult = calculateScorerPointsForMatchDay(predictions.predictions, matchDay);
                const scorerPts = scorerResult?.totalPoints || 0;
                if (scorerPts > 0) {
                    recap.bonuses.push({ type: 'scorer', label: '⚽ Défi buteur', points: scorerPts });
                    recap.totalBonus += scorerPts;
                }
                // Ajouter le détail par match
                if (scorerResult?.details) {
                    scorerResult.details.forEach(d => {
                        if (d.result?.participated) {
                            recap.bonuses.push({ 
                                type: 'scorerDetail', 
                                label: `  └ ${d.pick} (${d.match}) : ${d.result.label}`, 
                                points: d.result.points 
                            });
                        }
                    });
                }
            }
        } catch (e) {}
    }
    
    // --- Combiné ---
    if (typeof calculateCombineResult === 'function' && typeof getPlayerCombine === 'function') {
        try {
            const combine = await getPlayerCombine(playerId, season, matchDay);
            if (combine && combine.matches) {
                const combineResult = calculateCombineResult(combine, predictions.predictions, matchesThisDay);
                if (combineResult && combineResult.bonusPoints > 0) {
                    recap.bonuses.push({ type: 'combine', label: '🎲 Pari combiné', points: combineResult.bonusPoints });
                    recap.totalBonus += combineResult.bonusPoints;
                } else if (combineResult && !combineResult.success) {
                    recap.bonuses.push({ type: 'combine', label: '🎲 Pari combiné (raté)', points: 0 });
                }
            }
        } catch (e) {}
    }
    
    // --- MVP ---
    if (typeof getMVP === 'function') {
        try {
            const mvp = await getMVP(season, matchDay);
            if (mvp) {
                recap.mvpPseudo = mvp.pseudo;
                if (mvp.playerId === playerId) {
                    recap.isMVP = true;
                    recap.bonuses.push({ type: 'mvp', label: '🏆 MVP de la journée', points: MVP_BONUS_POINTS || 2 });
                    recap.totalBonus += MVP_BONUS_POINTS || 2;
                }
            }
        } catch (e) {}
    }
    
    // --- Défis IA + Buts totaux ---
    if (typeof calculateAllChallengePoints === 'function') {
        try {
            const challengeResult = await calculateAllChallengePoints(playerId, season, matchDay);
            if (challengeResult && challengeResult.points > 0) {
                recap.bonuses.push({ type: 'challenges', label: '🎲 Défis IA', points: challengeResult.points });
                recap.totalBonus += challengeResult.points;
            }
            // Stocker les détails pour le récap détaillé
            if (challengeResult && challengeResult.details) {
                recap.challengeDetails = challengeResult.details;
            }
        } catch (e) {}
    }
    
    recap.totalBonus = Math.round(recap.totalBonus * 10) / 10;
    recap.totalPoints = Math.round((recap.basePoints + recap.totalBonus) * 10) / 10;
    
    // --- Classement de la journée ---
    try {
        const ranking = await getMatchDayRanking(matchDay);
        const playerData = ranking.players.find(p => p.playerId === playerId);
        if (playerData) {
            recap.rank = playerData.rank;
            recap.totalPlayers = ranking.players.length;
        }
    } catch (e) {}
    
    return recap;
}


// ===============================
// 5. AFFICHAGE RÉCAP JOURNÉE
// ===============================

/**
 * Affiche le récap complet dans un conteneur
 */
function renderMatchDayRecap(recap) {
    if (!recap) return '<p style="text-align:center;color:#95a5a6;">Aucune donnée</p>';
    
    let html = `<div class="matchday-recap" style="max-width:600px;margin:0 auto;">`;
    
    // --- EN-TÊTE ---
    const rankLabel = recap.rank ? `${recap.rank}${recap.rank === 1 ? 'er' : 'e'} / ${recap.totalPlayers}` : '';
    
    html += `
        <div style="text-align:center;margin-bottom:1rem;">
            <h3 style="margin:0 0 0.25rem;color:#2c3e50;">📋 Journée ${recap.matchDay}</h3>
            ${rankLabel ? `<div style="font-size:0.9rem;color:#7f8c8d;">${rankLabel}</div>` : ''}
        </div>
    `;
    
    // --- SCORE TOTAL ---
    const hasBonuses = recap.bonuses.length > 0;
    
    html += `
        <div style="text-align:center;margin-bottom:1.25rem;padding:1rem;
                    background:linear-gradient(135deg,#667eea15,#764ba215);
                    border-radius:12px;">
            <div style="font-size:2.2rem;font-weight:bold;color:#667eea;">
                ${recap.totalPoints} <span style="font-size:1rem;color:#95a5a6;">pts</span>
            </div>
            ${hasBonuses ? `
                <div style="font-size:0.85rem;color:#7f8c8d;margin-top:0.25rem;">
                    Base ${recap.basePoints} + Bonus ${recap.totalBonus}
                </div>
            ` : ''}
            ${recap.isMVP ? `
                <div style="margin-top:0.5rem;font-size:1.1rem;">
                    🏆 <strong style="color:#f39c12;">MVP de la journée !</strong>
                </div>
            ` : ''}
        </div>
    `;
    
    // --- STATS RÉSUMÉ ---
    html += `
        <div style="display:flex;justify-content:center;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap;">
            ${recap.exact > 0 ? `<span style="background:#f39c1220;color:#f39c12;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.85rem;font-weight:600;">🏆 ${recap.exact}</span>` : ''}
            ${recap.close > 0 ? `<span style="background:#9b59b620;color:#9b59b6;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.85rem;font-weight:600;">🎯 ${recap.close}</span>` : ''}
            ${(recap.good + recap.correct) > 0 ? `<span style="background:#27ae6020;color:#27ae60;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.85rem;font-weight:600;">✅ ${recap.good + recap.correct}</span>` : ''}
            ${recap.wrong > 0 ? `<span style="background:#e74c3c20;color:#e74c3c;padding:0.25rem 0.6rem;border-radius:20px;font-size:0.85rem;font-weight:600;">❌ ${recap.wrong}</span>` : ''}
        </div>
    `;
    
    // --- BONUS ---
    if (recap.bonuses.length > 0) {
        html += `<div style="margin-bottom:1rem;">`;
        recap.bonuses.forEach(b => {
            const color = b.points > 0 ? '#27ae60' : '#95a5a6';
            html += `
                <div style="display:flex;align-items:center;justify-content:space-between;
                            padding:0.4rem 0.75rem;margin-bottom:3px;
                            background:${b.points > 0 ? '#27ae6008' : '#f8f9fa'};
                            border-radius:6px;border-left:3px solid ${color};">
                    <span style="font-size:0.85rem;">${b.label}</span>
                    <span style="font-weight:bold;color:${color};">
                        ${b.points > 0 ? `+${b.points}` : '0'}
                    </span>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    // --- DÉTAIL DES MATCHS ---
    html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
    
    recap.matches.forEach(m => {
        const bg = m.class === 'exact' ? '#f39c1210' : 
                   m.class === 'close' ? '#9b59b610' :
                   m.class === 'correct' ? '#27ae6008' : '#e74c3c08';
        const borderColor = m.class === 'exact' ? '#f39c12' : 
                            m.class === 'close' ? '#9b59b6' :
                            m.class === 'correct' ? '#27ae60' : '#e74c3c';
        
        html += `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;
                        background:${bg};border-left:3px solid ${borderColor};border-radius:6px;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.85rem;font-weight:600;color:#2c3e50;">
                        ${m.homeTeam} ${m.realHome} - ${m.realAway} ${m.awayTeam}
                    </div>
                    <div style="font-size:0.75rem;color:#7f8c8d;">
                        Prono : ${m.predHome} - ${m.predAway}
                        ${m.joker ? ' 🃏' : ''}
                        ${m.oddsMultiplier > 1 ? ` · ×${m.oddsMultiplier}` : ''}
                    </div>
                </div>
                <div style="text-align:right;min-width:50px;">
                    <div style="font-weight:bold;color:${borderColor};">${m.points} pts</div>
                    <div style="font-size:0.7rem;color:#95a5a6;">${m.label.split(' ')[0]}</div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // --- MVP INFO ---
    if (recap.mvpPseudo && !recap.isMVP) {
        html += `
            <div style="text-align:center;margin-top:1rem;font-size:0.85rem;color:#7f8c8d;">
                🏆 MVP : <strong>${recap.mvpPseudo}</strong>
            </div>
        `;
    }
    
    html += `</div>`;
    return html;
}

/**
 * Affiche le récap dans la section résumé après les pronos
 * Override de displayPredictionsSummary
 */
const _origDisplayPredictionsSummary = typeof displayPredictionsSummary === 'function'
    ? displayPredictionsSummary : null;

displayPredictionsSummary = async function(predictionsData, matches) {
    const container = document.getElementById('predictionsSummary');
    if (!container || !currentPlayer) {
        if (_origDisplayPredictionsSummary) return _origDisplayPredictionsSummary(predictionsData, matches);
        return;
    }
    
    // Vérifier si au moins un match est terminé
    const hasResults = matches.some(m => m.finalScore);
    if (!hasResults) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = '<div style="text-align:center;padding:1rem;color:#7f8c8d;">Calcul du récap...</div>';
    
    try {
        const recap = await getMatchDayRecap(currentPlayer.id, selectedMatchDay);
        if (recap) {
            let html = renderMatchDayRecap(recap);
            
            // Ajouter la comparaison IA si disponible
            if (typeof calculateIAComparison === 'function') {
                const iaComparison = await calculateIAComparison(currentPlayer.id, selectedMatchDay);
                if (iaComparison && typeof renderIAComparisonSummary === 'function') {
                    html += renderIAComparisonSummary(iaComparison);
                }
            }
            
            container.innerHTML = html;
        } else {
            if (_origDisplayPredictionsSummary) {
                return _origDisplayPredictionsSummary(predictionsData, matches);
            }
        }
    } catch (e) {
        console.error('Erreur récap journée:', e);
        if (_origDisplayPredictionsSummary) {
            return _origDisplayPredictionsSummary(predictionsData, matches);
        }
    }
};


// ===============================
// 6. RÉCAP DANS LE CLASSEMENT JOURNÉE
// ===============================

/**
 * Ajoute les badges bonus dans l'affichage du classement journée
 */
function renderBonusBadges(bonuses) {
    if (!bonuses) return '';
    let badges = '';
    if (bonuses.superJoker) badges += `<span title="Super Joker +${bonuses.superJoker}" style="font-size:0.7rem;">🃏✨</span> `;
    if (bonuses.scorer) badges += `<span title="Buteur +${bonuses.scorer}" style="font-size:0.7rem;">⚽</span> `;
    if (bonuses.combine) badges += `<span title="Combiné +${bonuses.combine}" style="font-size:0.7rem;">🎲</span> `;
    if (bonuses.challenges) badges += `<span title="Défis IA +${bonuses.challenges}" style="font-size:0.7rem;">🎲🤖</span> `;
    if (bonuses.mvp) badges += `<span title="MVP +${bonuses.mvp}" style="font-size:0.7rem;">🏆</span> `;
    return badges;
}


// ===============================
// 7. (Supprimé) — calculateScorerPointsForMatchDay
//    Défini dans pronostics-scorer.js
//    Signature: calculateScorerPointsForMatchDay(predictions, matchDay)
//    Retourne: {totalPoints, details}
// ===============================


// ===============================
// 8. FIX — getMVPBonusForPlayer
//    Force override (la version originale est buggée)
// ===============================

// Toujours redéfinir, même si elle existe déjà
window.getMVPBonusForPlayer = async function(playerId, season, matchDay) {
    try {
        if (typeof getMVP !== 'function') return 0;
        
        // Le bonus MVP s'applique sur la journée SUIVANTE
        // → on cherche si ce joueur était MVP de la journée précédente
        const prevMatchDay = matchDay - 1;
        if (prevMatchDay < 1) return 0;
        
        const mvp = await getMVP(season, prevMatchDay);
        
        // Vérification stricte : mvp doit exister ET avoir un playerId qui match
        if (!mvp || !mvp.playerId) return 0;
        if (String(mvp.playerId) !== String(playerId)) return 0;
        
        return typeof MVP_BONUS_POINTS !== 'undefined' ? MVP_BONUS_POINTS : 2;
    } catch (e) {
        console.warn('getMVPBonusForPlayer error:', e);
        return 0;
    }
};


console.log('🔥 Module consolidation chargé — tous les bonus intégrés au classement');