// ===============================
// PRONOSTICS - MODEL (données)
// ===============================
// Responsabilité : Firebase CRUD, calculs, logique métier
// Ne touche JAMAIS au DOM
// ===============================

// ===============================
// UTILITAIRES CRYPTO
// ===============================

async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'footballEloSalt2025');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===============================
// FIREBASE - JOUEURS
// ===============================

async function getPlayerByPseudo(pseudo) {
    try {
        const snapshot = await db.collection('pronostiqueurs')
            .where('pseudo', '==', pseudo)
            .limit(1)
            .get();
        
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (error) {
        console.error('Erreur getPlayerByPseudo:', error);
        return null;
    }
}

async function savePlayer(player) {
    try {
        await db.collection('pronostiqueurs').doc(player.id).set(player);
    } catch (error) {
        console.error('Erreur savePlayer:', error);
        throw error;
    }
}

async function updatePlayerStats(playerId, stats) {
    try {
        await db.collection('pronostiqueurs').doc(playerId).update({ stats });
    } catch (error) {
        console.error('Erreur updatePlayerStats:', error);
    }
}

async function getAllPlayers() {
    try {
        const snapshot = await db.collection('pronostiqueurs').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Erreur getAllPlayers:', error);
        return [];
    }
}

// ===============================
// FIREBASE - PRONOSTICS
// ===============================

async function getPlayerPredictions(playerId, season, matchDay) {
    try {
        const docId = `${playerId}_${season}_J${matchDay}`;
        const doc = await db.collection('pronostics').doc(docId).get();
        
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        console.error('Erreur getPlayerPredictions:', error);
        return null;
    }
}

async function savePredictions(playerId, pseudo, season, matchDay, predictions) {
    try {
        const docId = `${playerId}_${season}_J${matchDay}`;
        
        await db.collection('pronostics').doc(docId).set({
            playerId,
            pseudo,
            season,
            matchDay,
            predictions,
            submittedAt: new Date().toISOString(),
            results: null
        });
        
        return true;
    } catch (error) {
        console.error('Erreur savePredictions:', error);
        return false;
    }
}

async function getAllPredictionsForMatchDay(season, matchDay) {
    try {
        const snapshot = await db.collection('pronostics')
            .where('season', '==', season)
            .where('matchDay', '==', matchDay)
            .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Erreur getAllPredictionsForMatchDay:', error);
        return [];
    }
}

async function getPlayerHistory(playerId) {
    try {
        const snapshot = await db.collection('pronostics')
            .where('playerId', '==', playerId)
            .orderBy('matchDay', 'desc')
            .get();
        
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Erreur getPlayerHistory:', error);
        return [];
    }
}

// ===============================
// LOGIQUE MÉTIER - CALCULS
// ===============================

/**
 * Calcule le résultat d'un pronostic vs le score réel
 * @returns {Object} { points, finalPoints, class, label, oddsMultiplier, jokerUsed }
 */
function calculatePredictionResult(predHome, predAway, realHome, realAway, savedAt, match, odds = null, joker = false) {
    // Pas de pronostic
    if (predHome === undefined || predHome === null || predHome === '' ||
        predAway === undefined || predAway === null || predAway === '') {
        return { points: 0, finalPoints: 0, class: 'wrong', label: '❌ Non pronostiqué', oddsMultiplier: 1, jokerUsed: false };
    }
    
    // Vérifier si le pronostic a été fait APRÈS le match
    if (savedAt && match) {
        const pronoDate = new Date(savedAt);
        const matchDate = match.scheduledAt 
            ? new Date(match.scheduledAt) 
            : (match.playedAt ? new Date(match.playedAt) : null);
        
        if (matchDate && pronoDate >= matchDate) {
            return { points: 0, finalPoints: 0, class: 'late', label: '⏰ Trop tard', oddsMultiplier: 1, jokerUsed: false };
        }
    }
    
    predHome = parseInt(predHome);
    predAway = parseInt(predAway);
    
    // Vérifier le résultat (1/N/2)
    const predResult = predHome > predAway ? 'home' : (predHome < predAway ? 'away' : 'draw');
    const realResult = realHome > realAway ? 'home' : (realHome < realAway ? 'away' : 'draw');
    
    if (predResult !== realResult) {
        return { points: 0, finalPoints: 0, class: 'wrong', label: '❌ Mauvais résultat', oddsMultiplier: 1, jokerUsed: joker };
    }
    
    // Bon résultat - calculer l'écart
    const ecart = Math.abs(predHome - realHome) + Math.abs(predAway - realAway);
    
    let basePoints, resultClass, label;
    
    if (ecart === 0) {
        basePoints = 9;
        resultClass = 'exact';
        label = '🏆 Score exact !';
    } else if (ecart === 1) {
        basePoints = 6;
        resultClass = 'close';
        label = '🎯 Score proche';
    } else if (ecart === 2) {
        basePoints = 4;
        resultClass = 'correct';
        label = '✅ Bon + écart 2';
    } else {
        basePoints = 3;
        resultClass = 'correct';
        label = '✅ Bon résultat';
    }
    
    // Appliquer le multiplicateur de cote si disponible
    let oddsMultiplier = 1;
    if (odds && odds[predResult]) {
        oddsMultiplier = Math.round((odds[predResult] / 2) * 100) / 100;
        oddsMultiplier = Math.max(0.5, Math.min(3.0, oddsMultiplier));
    }
    
    let finalPoints = Math.round(basePoints * oddsMultiplier * 10) / 10;
    
    // Appliquer le multiplicateur joker si actif
    if (joker && typeof JOKER_CONFIG !== 'undefined') {
        finalPoints = finalPoints * JOKER_CONFIG.multiplier;
    }
    
    return { 
        points: basePoints, 
        finalPoints: finalPoints,
        class: resultClass, 
        label: label,
        oddsMultiplier: oddsMultiplier,
        jokerUsed: joker
    };
}

// ===============================
// LOGIQUE MÉTIER - HELPERS
// ===============================

/**
 * Récupère et combine les matchs d'une journée (joués + futurs)
 * @returns {Array} matchesThisDay triés par date
 */
function getMatchDayMatches(matchDay, allMatchesArr, futureMatchesArr) {
    const playedMatches = allMatchesArr.filter(m => m.matchDay === matchDay);
    const upcomingMatches = futureMatchesArr.filter(m => m.matchDay === matchDay);

    const playedKeys = new Set(playedMatches.map(m => `${m.homeTeamId}-${m.awayTeamId}`));
    const uniqueUpcoming = upcomingMatches.filter(m => !playedKeys.has(`${m.homeTeamId}-${m.awayTeamId}`));

    const matchesThisDay = [...playedMatches, ...uniqueUpcoming];

    matchesThisDay.sort((a, b) => {
        const dateA = a.scheduledAt ? new Date(a.scheduledAt) : new Date(0);
        const dateB = b.scheduledAt ? new Date(b.scheduledAt) : new Date(0);
        return dateA - dateB;
    });

    return matchesThisDay;
}

/**
 * Calcule les matchs ouverts et la prochaine deadline
 * @returns {Object} { openMatches, nextDeadline }
 */
function computeOpenMatches(matchesThisDay) {
    const now = new Date();
    let openMatches = 0;
    let nextDeadline = null;
    
    matchesThisDay.forEach(match => {
        if (match.finalScore) return;
        
        if (match.scheduledAt) {
            const matchTime = new Date(match.scheduledAt);
            if (now < matchTime) {
                openMatches++;
                if (!nextDeadline || matchTime < nextDeadline) {
                    nextDeadline = matchTime;
                }
            }
        } else {
            openMatches++;
        }
    });
    
    return { openMatches, nextDeadline };
}

/**
 * Construit la map des pronostics existants indexée par clé match
 */
function buildPredictionsMap(existingPredictions) {
    const map = {};
    if (existingPredictions && existingPredictions.predictions) {
        existingPredictions.predictions.forEach(p => {
            map[`${p.homeTeamId}-${p.awayTeamId}`] = p;
        });
    }
    return map;
}

/**
 * Pré-charge les cotes de tous les matchs d'une journée
 * @returns {Object} oddsMap indexée par "homeId-awayId"
 */
async function preloadMatchOdds(matchesThisDay, teamsWithElo) {
    const oddsMap = {};
    if (typeof getMatchOdds !== 'function') return oddsMap;

    const oddsPromises = matchesThisDay.map(async (match) => {
        const key = `${match.homeTeamId}-${match.awayTeamId}`;
        try {
            oddsMap[key] = await getMatchOdds(match, teamsWithElo);
        } catch (e) {
            console.warn('Erreur chargement cotes pour', key);
        }
    });
    await Promise.all(oddsPromises);
    return oddsMap;
}

console.log('📦 Module pronostics-model chargé');