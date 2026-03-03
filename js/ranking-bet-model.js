// =====================================================
// 📊 RANKING BET - MODEL (données)
// =====================================================
// Responsabilité : config, Monte Carlo, Firebase CRUD,
// calculs de résultats, génération classement
// Ne touche JAMAIS au DOM
// =====================================================

// ===============================
// CONFIGURATION
// ===============================

const RANKING_BET_CONFIG = {
    monteCarloSimulations: 500,
    minOdds: 1.01,
    maxOdds: 50.0,
    scoring: {
        exact: 1.0,
        off1: 0.4,
        off2_3: 0.15,
        off4plus: 0
    },
    refreshCooldownMs: 60000
};

// ===============================
// CLASSEMENT AUTONOME
// ===============================

function generateRankingForBet() {
    if (typeof generateRanking === 'function') {
        return generateRanking(null, currentSeason, null, false, 'all');
    }

    const stats = {};
    allTeams.forEach(team => {
        stats[team.id] = {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            played: 0, won: 0, drawn: 0, lost: 0,
            goalsFor: 0, goalsAgainst: 0, points: 0,
            elo: 1500
        };
    });

    allMatches.forEach(match => {
        if (!match.finalScore) return;
        const home = stats[match.homeTeamId];
        const away = stats[match.awayTeamId];
        if (!home || !away) return;

        home.played++; away.played++;
        home.goalsFor += match.finalScore.home;
        home.goalsAgainst += match.finalScore.away;
        away.goalsFor += match.finalScore.away;
        away.goalsAgainst += match.finalScore.home;

        if (match.finalScore.home > match.finalScore.away) {
            home.won++; home.points += 3; away.lost++;
        } else if (match.finalScore.home < match.finalScore.away) {
            away.won++; away.points += 3; home.lost++;
        } else {
            home.drawn++; home.points += 1; away.drawn++; away.points += 1;
        }
    });

    if (typeof EloSystem !== 'undefined') {
        try {
            const eloResults = EloSystem.recalculateAllEloRatings(allTeams, allMatches);
            eloResults.forEach(t => { if (stats[t.id]) stats[t.id].elo = t.elo; });
        } catch (e) {
            console.warn('Elo non disponible pour ranking bet:', e);
        }
    }

    const ranking = Object.values(stats);
    ranking.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const diffA = a.goalsFor - a.goalsAgainst;
        const diffB = b.goalsFor - b.goalsAgainst;
        if (diffB !== diffA) return diffB - diffA;
        return b.goalsFor - a.goalsFor;
    });

    return ranking;
}

// ===============================
// MONTE CARLO — PROBABILITÉS
// ===============================

function calculatePositionProbabilities(numSims) {
    numSims = numSims || RANKING_BET_CONFIG.monteCarloSimulations;

    const positionCounts = {};
    allTeams.forEach(team => {
        positionCounts[team.id] = {};
        for (let pos = 1; pos <= allTeams.length; pos++) {
            positionCounts[team.id][pos] = 0;
        }
    });

    const currentRanking = generateRankingForBet();

    const remainingMatches = futureMatches.filter(m => {
        return !allMatches.some(am =>
            am.homeTeamId == m.homeTeamId && am.awayTeamId == m.awayTeamId && am.matchDay == m.matchDay
        );
    });

    if (remainingMatches.length === 0) {
        currentRanking.forEach((team, index) => {
            positionCounts[team.id][index + 1] = numSims;
        });
    } else {
        for (let sim = 0; sim < numSims; sim++) {
            const simStats = {};
            allTeams.forEach(team => {
                const current = currentRanking.find(t => t.id == team.id);
                simStats[team.id] = {
                    points: current?.points || 0,
                    goalsFor: current?.goalsFor || 0,
                    goalsAgainst: current?.goalsAgainst || 0
                };
            });

            remainingMatches.forEach(match => {
                const homeTeam = currentRanking.find(t => t.id == match.homeTeamId);
                const awayTeam = currentRanking.find(t => t.id == match.awayTeamId);
                const homeElo = homeTeam?.elo || 1500;
                const awayElo = awayTeam?.elo || 1500;

                const adjustedHomeElo = homeElo + 65;
                const expectedHome = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));

                let drawProb = 0.26;
                let homeWinProb = expectedHome * (1 - drawProb);
                let awayWinProb = (1 - expectedHome) * (1 - drawProb);
                const total = homeWinProb + drawProb + awayWinProb;
                homeWinProb /= total; drawProb /= total; awayWinProb /= total;

                const rand = Math.random();
                let homeGoals, awayGoals;

                if (rand < homeWinProb) {
                    homeGoals = Math.floor(Math.random() * 3) + 1;
                    awayGoals = Math.floor(Math.random() * homeGoals);
                } else if (rand < homeWinProb + drawProb) {
                    homeGoals = Math.floor(Math.random() * 3);
                    awayGoals = homeGoals;
                } else {
                    awayGoals = Math.floor(Math.random() * 3) + 1;
                    homeGoals = Math.floor(Math.random() * awayGoals);
                }

                simStats[match.homeTeamId].goalsFor += homeGoals;
                simStats[match.homeTeamId].goalsAgainst += awayGoals;
                simStats[match.awayTeamId].goalsFor += awayGoals;
                simStats[match.awayTeamId].goalsAgainst += homeGoals;

                if (homeGoals > awayGoals) {
                    simStats[match.homeTeamId].points += 3;
                } else if (homeGoals === awayGoals) {
                    simStats[match.homeTeamId].points += 1;
                    simStats[match.awayTeamId].points += 1;
                } else {
                    simStats[match.awayTeamId].points += 3;
                }
            });

            const simRanking = allTeams.map(t => ({
                id: t.id,
                points: simStats[t.id].points,
                goalDiff: simStats[t.id].goalsFor - simStats[t.id].goalsAgainst,
                goalsFor: simStats[t.id].goalsFor
            }));

            simRanking.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
                return b.goalsFor - a.goalsFor;
            });

            simRanking.forEach((team, index) => {
                positionCounts[team.id][index + 1]++;
            });
        }
    }

    const probabilities = {};
    allTeams.forEach(team => {
        probabilities[team.id] = {};
        for (let pos = 1; pos <= allTeams.length; pos++) {
            probabilities[team.id][pos] = positionCounts[team.id][pos] / numSims;
        }
    });

    return probabilities;
}

// ===============================
// PROBABILITÉS → CÔTES
// ===============================

function probabilitiesToOdds(probabilities) {
    const odds = {};

    Object.keys(probabilities).forEach(teamId => {
        odds[teamId] = {};
        Object.keys(probabilities[teamId]).forEach(pos => {
            const prob = probabilities[teamId][pos];
            let cote;

            if (prob <= 0) cote = RANKING_BET_CONFIG.maxOdds;
            else if (prob >= 1) cote = RANKING_BET_CONFIG.minOdds;
            else {
                cote = Math.round((1 / prob) * 100) / 100;
                cote = Math.max(RANKING_BET_CONFIG.minOdds, Math.min(RANKING_BET_CONFIG.maxOdds, cote));
            }

            odds[teamId][pos] = cote;
        });
    });

    return odds;
}

// ===============================
// CACHE DES CÔTES
// ===============================

let _oddsCache = null;
let _oddsCacheTime = 0;

function getCurrentOdds() {
    const now = Date.now();

    if (_oddsCache && (now - _oddsCacheTime) < RANKING_BET_CONFIG.refreshCooldownMs) {
        return _oddsCache;
    }

    console.log('📊 Calcul des côtes via Monte Carlo...');
    const startTime = performance.now();

    const probabilities = calculatePositionProbabilities();
    const odds = probabilitiesToOdds(probabilities);

    const elapsed = Math.round(performance.now() - startTime);
    console.log(`📊 Côtes calculées en ${elapsed}ms`);

    _oddsCache = {
        odds,
        probabilities,
        calculatedAt: new Date().toISOString(),
        matchDayContext: Math.max(0, ...allMatches.map(m => m.matchDay || 0))
    };
    _oddsCacheTime = now;

    return _oddsCache;
}

function invalidateOddsCache() {
    _oddsCache = null;
    _oddsCacheTime = 0;
}

// ===============================
// FIREBASE — STOCKAGE
// ===============================

async function getRankingBet(playerId, season) {
    try {
        const docId = `${playerId}_${season}`;

        if (typeof db !== 'undefined') {
            const doc = await db.collection('rankingBets').doc(docId).get();
            if (doc.exists) return doc.data();
        }

        const stored = localStorage.getItem(`footballEloRankingBet_${docId}`);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.error('Erreur getRankingBet:', e);
    }

    return null;
}

async function saveRankingBet(playerId, season, betData) {
    const docId = `${playerId}_${season}`;

    localStorage.setItem(`footballEloRankingBet_${docId}`, JSON.stringify(betData));

    if (typeof db !== 'undefined') {
        try {
            await db.collection('rankingBets').doc(docId).set(betData);
        } catch (e) {
            console.error('Erreur saveRankingBet Firebase:', e);
        }
    }
}

async function getAllRankingBets(season) {
    try {
        if (typeof db !== 'undefined') {
            const snapshot = await db.collection('rankingBets')
                .where('season', '==', season)
                .get();
            return snapshot.docs.map(doc => doc.data());
        }
    } catch (e) {
        console.error('Erreur getAllRankingBets:', e);
    }
    return [];
}

// ===============================
// CALCUL DES RÉSULTATS
// ===============================

function calculateRankingBetResults(bet, finalRanking) {
    if (!bet || !bet.predictions || !bet.oddsSnapshot) {
        return { totalPoints: 0, details: [] };
    }

    let totalPoints = 0;
    const details = [];

    bet.predictions.forEach(pred => {
        const team = allTeams.find(t => t.id == pred.teamId);
        const finalPos = finalRanking.findIndex(t => t.id == pred.teamId) + 1;
        const predictedPos = pred.predictedPosition;
        const offset = Math.abs(finalPos - predictedPos);

        const lockedOdds = bet.oddsSnapshot[pred.teamId]?.[predictedPos] || 1;

        let multiplier, label;
        if (offset === 0) { multiplier = RANKING_BET_CONFIG.scoring.exact; label = '🏆 Exact !'; }
        else if (offset === 1) { multiplier = RANKING_BET_CONFIG.scoring.off1; label = '🎯 ±1'; }
        else if (offset <= 3) { multiplier = RANKING_BET_CONFIG.scoring.off2_3; label = `📍 ±${offset}`; }
        else { multiplier = RANKING_BET_CONFIG.scoring.off4plus; label = `❌ ±${offset}`; }

        const points = Math.round(lockedOdds * multiplier * 100) / 100;
        totalPoints += points;

        details.push({
            teamId: pred.teamId,
            teamName: team?.shortName || '?',
            predictedPos, finalPos, offset,
            lockedOdds, multiplier, points, label
        });
    });

    return {
        totalPoints: Math.round(totalPoints * 10) / 10,
        details: details.sort((a, b) => a.predictedPos - b.predictedPos)
    };
}

// ===============================
// CLASSEMENT ENTRE JOUEURS
// ===============================

async function getRankingBetLeaderboard(season) {
    const allBets = await getAllRankingBets(season);
    const finalRanking = generateRankingForBet();

    const leaderboard = allBets.map(bet => {
        const results = calculateRankingBetResults(bet, finalRanking);
        return {
            playerId: bet.playerId,
            pseudo: bet.pseudo,
            totalPoints: results.totalPoints,
            exacts: results.details.filter(d => d.offset === 0).length,
            close: results.details.filter(d => d.offset === 1).length,
            matchDayContext: bet.matchDayContext,
            modifications: bet.modificationCount || 0
        };
    });

    leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
    return leaderboard;
}

// ===============================
// HELPERS
// ===============================

/**
 * Retourne les matchs restants non joués
 */
function getRemainingMatches() {
    return futureMatches.filter(m => {
        return !allMatches.some(am =>
            am.homeTeamId == m.homeTeamId && am.awayTeamId == m.awayTeamId && am.matchDay == m.matchDay
        );
    });
}

/**
 * Vérifie si la saison est terminée
 */
function isSeasonFinished() {
    return getRemainingMatches().length === 0 && allMatches.length > 0;
}

console.log('📊 Module ranking-bet-model chargé');