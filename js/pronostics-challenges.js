// =====================================================
// 🎲 DÉFIS IA + PRÉDICTION BUTS TOTAUX
// pronostics-challenges.js
// L'IA génère des paris contextuels par journée
// =====================================================

// ===============================
// CONFIGURATION
// ===============================

const CHALLENGE_CONFIG = {
    maxChallengesPerDay: 3,      // 2-3 défis par journée
    pointsCorrect: 2,            // Points par défi réussi
    pointsHard: 3,               // Points pour un défi difficile
    totalGoals: {
        exact: 5,                // Buts totaux journée exact
        off1: 3,                 // ±1 but
        off2: 1,                 // ±2 buts
        off3plus: 0              // ±3+ buts
    }
};

// ===============================
// TYPES DE DÉFIS
// ===============================

const CHALLENGE_TYPES = [
    {
        id: 'over_goals',
        label: (match, threshold) => `+${threshold} buts dans ${match.homeShort} - ${match.awayShort} ?`,
        emoji: '⚽',
        generate: (match) => {
            // Basé sur les Elo : équipes offensives = seuil plus haut
            const avgElo = (match.homeElo + match.awayElo) / 2;
            const threshold = avgElo > 1550 ? 3.5 : avgElo > 1450 ? 2.5 : 1.5;
            return { threshold, difficulty: threshold >= 3.5 ? 'hard' : 'normal' };
        },
        resolve: (match, params) => {
            const totalGoals = match.finalScore.home + match.finalScore.away;
            return totalGoals > params.threshold;
        }
    },
    {
        id: 'btts',
        label: (match) => `Les 2 équipes marquent dans ${match.homeShort} - ${match.awayShort} ?`,
        emoji: '🎯',
        generate: (match) => {
            return { difficulty: 'normal' };
        },
        resolve: (match) => {
            return match.finalScore.home > 0 && match.finalScore.away > 0;
        }
    },
    {
        id: 'clean_sheet',
        label: (match, params) => `Clean sheet pour ${params.teamShort} ?`,
        emoji: '🧤',
        generate: (match) => {
            // L'équipe la plus forte a plus de chances de clean sheet
            const stronger = match.homeElo >= match.awayElo 
                ? { teamId: match.homeTeamId, teamShort: match.homeShort, isHome: true }
                : { teamId: match.awayTeamId, teamShort: match.awayShort, isHome: false };
            return { ...stronger, difficulty: 'hard' };
        },
        resolve: (match, params) => {
            if (params.isHome) return match.finalScore.away === 0;
            return match.finalScore.home === 0;
        }
    },
    {
        id: 'early_goal',
        label: (match) => `But avant la 30e min dans ${match.homeShort} - ${match.awayShort} ?`,
        emoji: '⏱️',
        generate: (match) => {
            return { difficulty: 'normal' };
        },
        resolve: (match) => {
            if (!match.goals || match.goals.length === 0) return false;
            return match.goals.some(g => parseInt(g.minute) < 30);
        }
    },
    {
        id: 'no_draw',
        label: (match) => `Pas de match nul dans ${match.homeShort} - ${match.awayShort} ?`,
        emoji: '🏆',
        generate: (match) => {
            return { difficulty: 'normal' };
        },
        resolve: (match) => {
            return match.finalScore.home !== match.finalScore.away;
        }
    },
    {
        id: 'home_win',
        label: (match) => `${match.homeShort} gagne à domicile ?`,
        emoji: '🏠',
        generate: (match) => {
            // Intéressant quand le favori est à l'extérieur
            const diff = match.awayElo - match.homeElo;
            return { difficulty: diff > 50 ? 'hard' : 'normal' };
        },
        resolve: (match) => {
            return match.finalScore.home > match.finalScore.away;
        }
    },
    {
        id: 'high_scoring',
        label: (match) => `4+ buts dans ${match.homeShort} - ${match.awayShort} ?`,
        emoji: '💥',
        generate: (match) => {
            return { difficulty: 'hard' };
        },
        resolve: (match) => {
            return (match.finalScore.home + match.finalScore.away) >= 4;
        }
    },
    {
        id: 'first_half_goal',
        label: (match) => `But en 1ère mi-temps dans ${match.homeShort} - ${match.awayShort} ?`,
        emoji: '🥅',
        generate: (match) => {
            return { difficulty: 'normal' };
        },
        resolve: (match) => {
            if (!match.goals || match.goals.length === 0) return false;
            return match.goals.some(g => parseInt(g.minute) <= 45);
        }
    }
];


// ===============================
// GÉNÉRATION DES DÉFIS IA
// ===============================

/**
 * Génère les défis pour une journée
 * Utilise un seed basé sur la journée pour être déterministe
 */
function generateChallenges(matchDay) {
    const _futureMatches = typeof futureMatches !== 'undefined' ? futureMatches : [];
    const matchesThisDay = [...allMatches, ..._futureMatches].filter(m => m.matchDay === matchDay);
    
    if (matchesThisDay.length === 0) return [];
    
    // Seed pseudo-aléatoire basé sur la journée (déterministe)
    const seed = matchDay * 7919 + 1301;
    let rng = seed;
    function seededRandom() {
        rng = (rng * 16807 + 0) % 2147483647;
        return (rng - 1) / 2147483646;
    }
    
    // Enrichir les matchs avec les infos Elo
    const enrichedMatches = matchesThisDay.map(m => {
        const homeTeam = allTeams.find(t => t.id == m.homeTeamId);
        const awayTeam = allTeams.find(t => t.id == m.awayTeamId);
        
        let homeElo = 1500, awayElo = 1500;
        if (typeof EloSystem !== 'undefined') {
            try {
                const ratings = EloSystem.recalculateAllEloRatings(allTeams, allMatches);
                homeElo = ratings.find(r => r.id == m.homeTeamId)?.elo || 1500;
                awayElo = ratings.find(r => r.id == m.awayTeamId)?.elo || 1500;
            } catch (e) {}
        }
        
        return {
            ...m,
            homeShort: homeTeam?.shortName || '?',
            awayShort: awayTeam?.shortName || '?',
            homeElo,
            awayElo,
            eloDiff: Math.abs(homeElo - awayElo)
        };
    });
    
    // Sélectionner les matchs les plus intéressants (gros écart Elo ou derby)
    const sortedByInterest = enrichedMatches.sort((a, b) => {
        // Matchs serrés = plus intéressants
        return a.eloDiff - b.eloDiff;
    });
    
    // Choisir les matchs pour les défis
    const challenges = [];
    const usedTypes = new Set();
    const usedMatches = new Set();
    
    // Mélanger les types de défis avec le seed
    const shuffledTypes = [...CHALLENGE_TYPES].sort(() => seededRandom() - 0.5);
    
    for (const challengeType of shuffledTypes) {
        if (challenges.length >= CHALLENGE_CONFIG.maxChallengesPerDay) break;
        if (usedTypes.has(challengeType.id)) continue;
        
        // Choisir un match pour ce défi
        let selectedMatch = null;
        for (const match of sortedByInterest) {
            const matchKey = `${match.homeTeamId}-${match.awayTeamId}`;
            if (usedMatches.has(matchKey)) continue;
            selectedMatch = match;
            break;
        }
        
        if (!selectedMatch) {
            // Si tous les matchs sont pris, réutiliser
            selectedMatch = sortedByInterest[Math.floor(seededRandom() * sortedByInterest.length)];
        }
        
        if (!selectedMatch) continue;
        
        const params = challengeType.generate(selectedMatch);
        const label = challengeType.label(selectedMatch, params);
        
        challenges.push({
            id: `${matchDay}_${challengeType.id}_${selectedMatch.homeTeamId}`,
            type: challengeType.id,
            matchDay,
            homeTeamId: selectedMatch.homeTeamId,
            awayTeamId: selectedMatch.awayTeamId,
            label,
            emoji: challengeType.emoji,
            params,
            points: params.difficulty === 'hard' ? CHALLENGE_CONFIG.pointsHard : CHALLENGE_CONFIG.pointsCorrect,
            difficulty: params.difficulty || 'normal'
        });
        
        usedTypes.add(challengeType.id);
        usedMatches.add(`${selectedMatch.homeTeamId}-${selectedMatch.awayTeamId}`);
    }
    
    return challenges;
}


// ===============================
// STOCKAGE
// ===============================

async function getPlayerChallengeAnswers(playerId, season, matchDay) {
    const docId = `${playerId}_${season}_J${matchDay}`;
    
    try {
        if (typeof db !== 'undefined') {
            const doc = await db.collection('challengeAnswers').doc(docId).get();
            if (doc.exists) return doc.data();
        }
        
        const stored = localStorage.getItem(`footballEloChallenges_${docId}`);
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    
    return null;
}

async function savePlayerChallengeAnswers(playerId, season, matchDay, data) {
    const docId = `${playerId}_${season}_J${matchDay}`;
    
    const saveData = {
        playerId,
        season,
        matchDay,
        ...data,
        savedAt: new Date().toISOString()
    };
    
    localStorage.setItem(`footballEloChallenges_${docId}`, JSON.stringify(saveData));
    
    if (typeof db !== 'undefined') {
        try {
            await db.collection('challengeAnswers').doc(docId).set(saveData);
        } catch (e) {
            console.warn('Erreur save challenges Firebase:', e);
        }
    }
}


// ===============================
// RÉSOLUTION DES DÉFIS
// ===============================

function resolveChallenges(matchDay) {
    const challenges = generateChallenges(matchDay);
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
    
    return challenges.map(challenge => {
        const match = matchesThisDay.find(m => 
            m.homeTeamId == challenge.homeTeamId && m.awayTeamId == challenge.awayTeamId
        );
        
        if (!match || !match.finalScore) {
            return { ...challenge, resolved: false };
        }
        
        const challengeType = CHALLENGE_TYPES.find(t => t.id === challenge.type);
        const answer = challengeType ? challengeType.resolve(match, challenge.params) : null;
        
        return { ...challenge, resolved: true, correctAnswer: answer };
    });
}

/**
 * Calcule les points de défis d'un joueur pour une journée
 */
async function calculateChallengePoints(playerId, season, matchDay) {
    const answers = await getPlayerChallengeAnswers(playerId, season, matchDay);
    if (!answers || !answers.challenges) return { points: 0, details: [] };
    
    const resolved = resolveChallenges(matchDay);
    let totalPoints = 0;
    const details = [];
    
    resolved.forEach(challenge => {
        if (!challenge.resolved) return;
        
        const playerAnswer = answers.challenges[challenge.id];
        if (playerAnswer === undefined || playerAnswer === null) return;
        
        const isCorrect = playerAnswer === challenge.correctAnswer;
        const pts = isCorrect ? challenge.points : 0;
        totalPoints += pts;
        
        details.push({
            label: challenge.label,
            emoji: challenge.emoji,
            playerAnswer,
            correctAnswer: challenge.correctAnswer,
            isCorrect,
            points: pts,
            difficulty: challenge.difficulty
        });
    });
    
    return { points: totalPoints, details };
}


// ===============================
// BUTS TOTAUX JOURNÉE
// ===============================

async function getPlayerTotalGoalsPrediction(playerId, season, matchDay) {
    const docId = `${playerId}_${season}_J${matchDay}`;
    
    try {
        // Lire depuis les challenge answers (même document)
        const data = await getPlayerChallengeAnswers(playerId, season, matchDay);
        if (data && data.totalGoalsPrediction !== undefined) {
            return data.totalGoalsPrediction;
        }
    } catch (e) {}
    
    return null;
}

function calculateActualTotalGoals(matchDay) {
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
    return matchesThisDay.reduce((sum, m) => sum + m.finalScore.home + m.finalScore.away, 0);
}

function calculateTotalGoalsPoints(predicted, actual) {
    if (predicted === null || predicted === undefined) return 0;
    
    const diff = Math.abs(predicted - actual);
    
    if (diff === 0) return CHALLENGE_CONFIG.totalGoals.exact;
    if (diff === 1) return CHALLENGE_CONFIG.totalGoals.off1;
    if (diff === 2) return CHALLENGE_CONFIG.totalGoals.off2;
    return CHALLENGE_CONFIG.totalGoals.off3plus;
}


// ===============================
// INTERFACE — WIDGET DANS LE FORMULAIRE
// ===============================

/**
 * Génère le HTML du widget de défis pour une journée
 */
async function renderChallengesWidget(matchDay) {
    const challenges = generateChallenges(matchDay);
    if (challenges.length === 0) return '';
    
    const existingAnswers = currentPlayer 
        ? await getPlayerChallengeAnswers(currentPlayer.id, currentSeason, matchDay)
        : null;
    
    const resolved = resolveChallenges(matchDay);
    const allResolved = resolved.every(c => c.resolved);
    
    // Vérifier si la journée est verrouillée (au moins un match commencé)
    const _futureMatches = typeof futureMatches !== 'undefined' ? futureMatches : [];
    const matchesThisDay = [...allMatches, ..._futureMatches].filter(m => m.matchDay === matchDay);
    const now = new Date();
    const firstKickoff = matchesThisDay
        .filter(m => m.scheduledAt)
        .map(m => new Date(m.scheduledAt))
        .sort((a, b) => a - b)[0];
    const isLocked = firstKickoff ? now >= firstKickoff : allResolved;
    
    let html = `
        <div class="challenges-widget" style="margin-bottom:1rem;padding:1rem;
                    background:linear-gradient(135deg,#ff758c10,#ff7eb310);
                    border:1px solid #ff758c40;border-radius:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
                <h4 style="margin:0;color:#e74c3c;font-size:1rem;">
                    🎲 Défis IA de la journée
                </h4>
                <span style="font-size:0.8rem;color:#95a5a6;">
                    ${isLocked ? '🔒 Verrouillé' : `${challenges.length} défi(s)`}
                </span>
            </div>
    `;
    
    // Défis
    challenges.forEach((challenge, i) => {
        const savedAnswer = existingAnswers?.challenges?.[challenge.id];
        const resolvedChallenge = resolved.find(r => r.id === challenge.id);
        const isResolved = resolvedChallenge?.resolved;
        const correctAnswer = resolvedChallenge?.correctAnswer;
        
        const difficultyBadge = challenge.difficulty === 'hard' 
            ? `<span style="font-size:0.7rem;background:#e74c3c;color:white;padding:0.1rem 0.4rem;border-radius:10px;">+${challenge.points} pts</span>`
            : `<span style="font-size:0.7rem;background:#3498db;color:white;padding:0.1rem 0.4rem;border-radius:10px;">+${challenge.points} pts</span>`;
        
        let resultHtml = '';
        if (isResolved && savedAnswer !== null && savedAnswer !== undefined) {
            const isCorrect = savedAnswer === correctAnswer;
            resultHtml = isCorrect 
                ? `<span style="color:#27ae60;font-weight:bold;">✅ +${challenge.points}</span>`
                : `<span style="color:#e74c3c;">❌ 0</span>`;
        } else if (isResolved && (savedAnswer === null || savedAnswer === undefined)) {
            resultHtml = `<span style="color:#95a5a6;font-size:0.8rem;">Non répondu</span>`;
        }
        
        html += `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;
                        background:white;border-radius:8px;margin-bottom:4px;
                        ${isResolved && savedAnswer !== undefined && savedAnswer === correctAnswer ? 'border-left:3px solid #27ae60;' : ''}
                        ${isResolved && savedAnswer !== undefined && savedAnswer !== correctAnswer ? 'border-left:3px solid #e74c3c;' : ''}">
                <span style="font-size:1.1rem;">${challenge.emoji}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.85rem;font-weight:500;color:#2c3e50;">${challenge.label}</div>
                    <div style="display:flex;align-items:center;gap:0.3rem;margin-top:0.2rem;">
                        ${difficultyBadge}
                        ${resultHtml}
                    </div>
                </div>
                <div style="display:flex;gap:4px;" data-challenge-id="${challenge.id}">
        `;
        
        if (isLocked && !isResolved) {
            // Verrouillé mais pas encore résolu — montrer la réponse sauvegardée
            html += savedAnswer === true 
                ? `<span style="background:#27ae60;color:white;padding:0.3rem 0.6rem;border-radius:6px;font-size:0.8rem;font-weight:bold;">OUI</span>`
                : savedAnswer === false 
                    ? `<span style="background:#e74c3c;color:white;padding:0.3rem 0.6rem;border-radius:6px;font-size:0.8rem;font-weight:bold;">NON</span>`
                    : `<span style="color:#95a5a6;font-size:0.8rem;">—</span>`;
        } else if (isResolved) {
            // Résolu — montrer réponse + résultat
            const answerColor = savedAnswer === true ? '#27ae60' : savedAnswer === false ? '#e74c3c' : '#95a5a6';
            const answerText = savedAnswer === true ? 'OUI' : savedAnswer === false ? 'NON' : '—';
            html += `<span style="background:${answerColor}20;color:${answerColor};padding:0.3rem 0.6rem;border-radius:6px;font-size:0.8rem;font-weight:bold;">${answerText}</span>`;
            
            // Montrer la bonne réponse
            if (savedAnswer !== correctAnswer) {
                html += `<span style="font-size:0.7rem;color:#95a5a6;margin-left:4px;">(${correctAnswer ? 'OUI' : 'NON'})</span>`;
            }
        } else {
            // Non verrouillé — boutons cliquables
            html += `
                <button type="button" onclick="answerChallenge('${challenge.id}', true)" 
                        style="padding:0.3rem 0.7rem;border-radius:6px;font-size:0.8rem;font-weight:bold;cursor:pointer;
                               border:2px solid ${savedAnswer === true ? '#27ae60' : '#ddd'};
                               background:${savedAnswer === true ? '#27ae60' : 'white'};
                               color:${savedAnswer === true ? 'white' : '#2c3e50'};">
                    OUI
                </button>
                <button type="button" onclick="answerChallenge('${challenge.id}', false)"
                        style="padding:0.3rem 0.7rem;border-radius:6px;font-size:0.8rem;font-weight:bold;cursor:pointer;
                               border:2px solid ${savedAnswer === false ? '#e74c3c' : '#ddd'};
                               background:${savedAnswer === false ? '#e74c3c' : 'white'};
                               color:${savedAnswer === false ? 'white' : '#2c3e50'};">
                    NON
                </button>
            `;
        }
        
        html += `</div></div>`;
    });
    
    // --- BUTS TOTAUX DE LA JOURNÉE ---
    const totalGoalsPrediction = existingAnswers?.totalGoalsPrediction;
    const actualTotalGoals = calculateActualTotalGoals(matchDay);
    const allMatchesPlayed = matchesThisDay.length > 0 && matchesThisDay.every(m => 
        allMatches.some(am => am.homeTeamId == m.homeTeamId && am.awayTeamId == m.awayTeamId && am.matchDay === matchDay && am.finalScore)
    );
    
    html += `
        <div style="margin-top:0.75rem;padding:0.5rem;background:white;border-radius:8px;
                    display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <span style="font-size:1.1rem;">⚽</span>
            <span style="font-size:0.85rem;font-weight:500;color:#2c3e50;flex:1;min-width:120px;">
                Buts totaux de la journée ?
            </span>
    `;
    
    if (isLocked || allMatchesPlayed) {
        // Verrouillé ou terminé
        if (totalGoalsPrediction !== null && totalGoalsPrediction !== undefined) {
            if (allMatchesPlayed) {
                const pts = calculateTotalGoalsPoints(totalGoalsPrediction, actualTotalGoals);
                const diff = Math.abs(totalGoalsPrediction - actualTotalGoals);
                html += `
                    <span style="font-weight:bold;color:#2c3e50;">${totalGoalsPrediction}</span>
                    <span style="color:#7f8c8d;">→ Réel: ${actualTotalGoals}</span>
                    <span style="font-weight:bold;color:${pts > 0 ? '#27ae60' : '#e74c3c'};">
                        ${pts > 0 ? `+${pts} pts` : `0 pt (±${diff})`}
                    </span>
                `;
            } else {
                html += `<span style="font-weight:bold;color:#667eea;">${totalGoalsPrediction} buts</span>`;
            }
        } else {
            html += `<span style="color:#95a5a6;font-size:0.8rem;">Non répondu</span>`;
        }
    } else {
        // Non verrouillé — input
        html += `
            <div style="display:flex;align-items:center;gap:0.3rem;">
                <input type="number" id="totalGoalsInput" min="0" max="100" 
                       value="${totalGoalsPrediction !== null && totalGoalsPrediction !== undefined ? totalGoalsPrediction : ''}"
                       placeholder="?" 
                       style="width:55px;padding:0.3rem;text-align:center;border:2px solid #ddd;
                              border-radius:6px;font-size:0.9rem;font-weight:bold;">
                <span style="font-size:0.75rem;color:#95a5a6;">buts</span>
                <span style="font-size:0.7rem;background:#667eea;color:white;padding:0.1rem 0.4rem;border-radius:10px;">
                    exact +${CHALLENGE_CONFIG.totalGoals.exact} · ±1 +${CHALLENGE_CONFIG.totalGoals.off1} · ±2 +${CHALLENGE_CONFIG.totalGoals.off2}
                </span>
            </div>
        `;
    }
    
    html += `</div>`;
    
    // Bouton sauvegarder (si non verrouillé)
    if (!isLocked) {
        html += `
            <button type="button" onclick="saveChallengeAnswers(${matchDay})" 
                    style="margin-top:0.5rem;width:100%;padding:0.5rem;
                           background:linear-gradient(135deg,#ff758c,#ff7eb3);
                           color:white;border:none;border-radius:8px;
                           font-weight:bold;font-size:0.85rem;cursor:pointer;">
                💾 Sauvegarder les défis
            </button>
        `;
    }
    
    html += '</div>';
    return html;
}


// ===============================
// ACTIONS UI
// ===============================

// Stockage temporaire des réponses
window._challengeAnswers = {};

function answerChallenge(challengeId, answer) {
    window._challengeAnswers[challengeId] = answer;
    
    // Mettre à jour visuellement les boutons
    const container = document.querySelector(`[data-challenge-id="${challengeId}"]`);
    if (!container) return;
    
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
        const isOui = btn.textContent.trim() === 'OUI';
        const isSelected = (isOui && answer === true) || (!isOui && answer === false);
        
        if (isOui) {
            btn.style.borderColor = isSelected ? '#27ae60' : '#ddd';
            btn.style.background = isSelected ? '#27ae60' : 'white';
            btn.style.color = isSelected ? 'white' : '#2c3e50';
        } else {
            btn.style.borderColor = isSelected ? '#e74c3c' : '#ddd';
            btn.style.background = isSelected ? '#e74c3c' : 'white';
            btn.style.color = isSelected ? 'white' : '#2c3e50';
        }
    });
}

async function saveChallengeAnswers(matchDay) {
    if (!currentPlayer || !currentSeason) return;
    
    // Récupérer les réponses existantes
    const existing = await getPlayerChallengeAnswers(currentPlayer.id, currentSeason, matchDay) || {};
    
    // Fusionner avec les nouvelles réponses
    const challenges = { ...existing.challenges, ...window._challengeAnswers };
    
    // Récupérer la prédiction buts totaux
    const totalGoalsInput = document.getElementById('totalGoalsInput');
    const totalGoalsPrediction = totalGoalsInput && totalGoalsInput.value !== '' 
        ? parseInt(totalGoalsInput.value) : (existing.totalGoalsPrediction ?? null);
    
    await savePlayerChallengeAnswers(currentPlayer.id, currentSeason, matchDay, {
        challenges,
        totalGoalsPrediction
    });
    
    // Reset le stockage temporaire
    window._challengeAnswers = {};
    
    if (typeof toastSuccess === 'function') {
        toastSuccess('Défis sauvegardés !');
    } else {
        alert('✅ Défis sauvegardés !');
    }
}


// ===============================
// INTÉGRATION DANS LE FORMULAIRE
// ===============================

/**
 * Ajoute le widget des défis au formulaire de pronostics
 * À appeler après displayPredictionsForm()
 */
async function addChallengesWidget() {
    const container = document.getElementById('predictionsList');
    if (!container || !currentPlayer) return;
    
    const widget = await renderChallengesWidget(selectedMatchDay);
    if (!widget) return;
    
    // Insérer avant la liste des matchs
    container.insertAdjacentHTML('beforebegin', widget);
}

/**
 * Calcule les points totaux des défis + buts pour une journée
 */
async function calculateAllChallengePoints(playerId, season, matchDay) {
    let total = 0;
    const details = [];
    
    // Défis IA
    const challengeResult = await calculateChallengePoints(playerId, season, matchDay);
    total += challengeResult.points;
    details.push(...challengeResult.details);
    
    // Buts totaux
    const answers = await getPlayerChallengeAnswers(playerId, season, matchDay);
    if (answers && answers.totalGoalsPrediction !== null && answers.totalGoalsPrediction !== undefined) {
        const actual = calculateActualTotalGoals(matchDay);
        const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
        
        if (matchesThisDay.length > 0) {
            const pts = calculateTotalGoalsPoints(answers.totalGoalsPrediction, actual);
            total += pts;
            details.push({
                label: `Buts totaux: prédit ${answers.totalGoalsPrediction}, réel ${actual}`,
                emoji: '⚽',
                isCorrect: pts > 0,
                points: pts
            });
        }
    }
    
    return { points: total, details };
}


// ===============================
// AUTO-HOOK : insérer le widget après le rendu du formulaire
// ===============================

const _origDisplayPredictionsFormForChallenges = typeof displayPredictionsForm === 'function' 
    ? displayPredictionsForm : null;

if (_origDisplayPredictionsFormForChallenges) {
    displayPredictionsForm = async function() {
        await _origDisplayPredictionsFormForChallenges();
        
        // Supprimer l'ancien widget s'il existe
        const existing = document.querySelector('.challenges-widget');
        if (existing) existing.remove();
        
        // Ajouter le widget
        await addChallengesWidget();
    };
}


console.log('🎲 Module défis IA + buts totaux chargé');