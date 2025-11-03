// form-modifier.js - Système de modificateur de forme pour le rating Elo

/**
 * Configuration des bonus/malus de forme
 */
const FORM_CONFIG = {
    // Bonus de forme (victoires consécutives)
    FORM_BONUS: {
        5: 80,   // 5 victoires d'affilée
        4: 55,   // 4 victoires d'affilée
        3: 30    // 3 victoires d'affilée
    },
    
    // Malus de forme (défaites consécutives)
    FORM_MALUS: {
        5: -90,  // 5 défaites d'affilée
        4: -65,  // 4 défaites d'affilée
        3: -40   // 3 défaites d'affilée
    },
    
    // Invincibilité
    UNBEATEN_BONUS: {
        8: 70,   // 8 matchs sans défaite
        5: 40    // 5 matchs sans défaite
    },
    
    // Série sans victoire
    NO_WIN_MALUS: {
        5: -55,  // Aucune victoire sur 5 matchs
        7: -70   // Aucune victoire sur 7 matchs
    },
    
    // Défense
    CLEAN_SHEET_BONUS: {
        3: 30,   // 3 clean sheets sur 5 matchs
        2: 18    // 2 clean sheets sur 5 matchs
    },
    
    LOW_GOALS_CONCEDED_BONUS: 12,  // Moins de 3 buts encaissés sur 5 matchs
    
    NO_CLEAN_SHEET_MALUS: -18,     // Aucun clean sheet sur 5 matchs
    HIGH_GOALS_CONCEDED_MALUS: -35, // Plus de 10 buts encaissés sur 5 matchs
    
    // Attaque
    SCORING_STREAK_BONUS: {
        5: 25,   // Marqué dans 5 matchs consécutifs
        4: 15    // Marqué dans 4 matchs consécutifs
    },
    
    HIGH_GOALS_SCORED_BONUS: 18,   // Plus de 10 buts sur 5 matchs
    SCORING_DROUGHT_MALUS: -20,    // 2+ matchs sans marquer consécutifs
    
    // Limites
    MAX_TOTAL_BONUS: 200,
    MAX_TOTAL_MALUS: -200
};

/**
 * Analyser la forme d'une équipe sur ses derniers matchs
 * @param {Object} team - Équipe avec eloHistory
 * @param {number} lastNMatches - Nombre de matchs à analyser (défaut: 5)
 * @returns {Object} - Analyse complète de la forme
 */
function analyzeTeamForm(team, lastNMatches = 5) {
    if (!team.eloHistory || team.eloHistory.length === 0) {
        return {
            modifier: 0,
            details: [],
            status: 'unknown',
            recentMatches: []
        };
    }
    
    // Récupérer les derniers matchs
    const recentHistory = team.eloHistory.slice(-lastNMatches);
    
    // Extraire les résultats
    const results = recentHistory.map(h => h.result);
    const goalsFor = recentHistory.map(h => h.goalsFor || 0);
    const goalsAgainst = recentHistory.map(h => h.goalsAgainst || 0);
    
    let totalModifier = 0;
    const details = [];
    
    // === 1. ANALYSE DE LA FORME (Victoires/Défaites consécutives) ===
    const formAnalysis = analyzeResultStreak(results);
    totalModifier += formAnalysis.modifier;
    if (formAnalysis.detail) details.push(formAnalysis.detail);
    
    // === 2. INVINCIBILITÉ ===
    const unbeatenAnalysis = analyzeUnbeatenStreak(results);
    totalModifier += unbeatenAnalysis.modifier;
    if (unbeatenAnalysis.detail) details.push(unbeatenAnalysis.detail);
    
    // === 3. SÉRIE SANS VICTOIRE ===
    const noWinAnalysis = analyzeNoWinStreak(results);
    totalModifier += noWinAnalysis.modifier;
    if (noWinAnalysis.detail) details.push(noWinAnalysis.detail);
    
    // === 4. CLEAN SHEETS ===
    const cleanSheetAnalysis = analyzeCleanSheets(goalsAgainst);
    totalModifier += cleanSheetAnalysis.modifier;
    if (cleanSheetAnalysis.detail) details.push(cleanSheetAnalysis.detail);
    
    // === 5. BUTS ENCAISSÉS ===
    const defenseAnalysis = analyzeGoalsConceded(goalsAgainst);
    totalModifier += defenseAnalysis.modifier;
    if (defenseAnalysis.detail) details.push(defenseAnalysis.detail);
    
    // === 6. EFFICACITÉ OFFENSIVE ===
    const attackAnalysis = analyzeAttack(goalsFor);
    totalModifier += attackAnalysis.modifier;
    if (attackAnalysis.detail) details.push(attackAnalysis.detail);
    
    // Limiter le modificateur total
    totalModifier = Math.max(FORM_CONFIG.MAX_TOTAL_MALUS, 
                            Math.min(FORM_CONFIG.MAX_TOTAL_BONUS, totalModifier));
    
    // Déterminer le statut global
    const status = determineFormStatus(totalModifier, results);
    
    return {
        modifier: Math.round(totalModifier),
        details: details,
        status: status,
        recentMatches: results
    };
}

/**
 * Analyser les séries de victoires/défaites
 */
function analyzeResultStreak(results) {
    let modifier = 0;
    let detail = null;
    
    // Compter les victoires consécutives (en partant de la fin)
    let winStreak = 0;
    for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] === 'V') winStreak++;
        else break;
    }
    
    // Compter les défaites consécutives
    let lossStreak = 0;
    for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] === 'D') lossStreak++;
        else break;
    }
    
    // Appliquer les bonus de victoires
    if (winStreak >= 5) {
        modifier = FORM_CONFIG.FORM_BONUS[5];
        detail = `🔥 ${winStreak} victoires consécutives (+${modifier})`;
    } else if (winStreak >= 4) {
        modifier = FORM_CONFIG.FORM_BONUS[4];
        detail = `📈 ${winStreak} victoires consécutives (+${modifier})`;
    } else if (winStreak >= 3) {
        modifier = FORM_CONFIG.FORM_BONUS[3];
        detail = `✅ ${winStreak} victoires consécutives (+${modifier})`;
    }
    
    // Appliquer les malus de défaites
    if (lossStreak >= 5) {
        modifier = FORM_CONFIG.FORM_MALUS[5];
        detail = `❄️ ${lossStreak} défaites consécutives (${modifier})`;
    } else if (lossStreak >= 4) {
        modifier = FORM_CONFIG.FORM_MALUS[4];
        detail = `📉 ${lossStreak} défaites consécutives (${modifier})`;
    } else if (lossStreak >= 3) {
        modifier = FORM_CONFIG.FORM_MALUS[3];
        detail = `⚠️ ${lossStreak} défaites consécutives (${modifier})`;
    }
    
    return { modifier, detail };
}

/**
 * Analyser l'invincibilité
 */
function analyzeUnbeatenStreak(results) {
    let modifier = 0;
    let detail = null;
    
    // Compter les matchs sans défaite (en partant de la fin)
    let unbeatenStreak = 0;
    for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] !== 'D') unbeatenStreak++;
        else break;
    }
    
    if (unbeatenStreak >= 8) {
        modifier = FORM_CONFIG.UNBEATEN_BONUS[8];
        detail = `🛡️ Invaincu depuis ${unbeatenStreak} matchs (+${modifier})`;
    } else if (unbeatenStreak >= 5) {
        modifier = FORM_CONFIG.UNBEATEN_BONUS[5];
        detail = `💪 Invaincu depuis ${unbeatenStreak} matchs (+${modifier})`;
    }
    
    return { modifier, detail };
}

/**
 * Analyser les séries sans victoire
 */
function analyzeNoWinStreak(results) {
    let modifier = 0;
    let detail = null;
    
    const victories = results.filter(r => r === 'V').length;
    
    if (victories === 0) {
        if (results.length >= 7) {
            modifier = FORM_CONFIG.NO_WIN_MALUS[7];
            detail = `😰 Aucune victoire sur ${results.length} matchs (${modifier})`;
        } else if (results.length >= 5) {
            modifier = FORM_CONFIG.NO_WIN_MALUS[5];
            detail = `😟 Aucune victoire sur ${results.length} matchs (${modifier})`;
        }
    }
    
    return { modifier, detail };
}

/**
 * Analyser les clean sheets
 */
function analyzeCleanSheets(goalsAgainst) {
    let modifier = 0;
    let detail = null;
    
    const cleanSheets = goalsAgainst.filter(g => g === 0).length;
    
    if (cleanSheets >= 3) {
        modifier = FORM_CONFIG.CLEAN_SHEET_BONUS[3];
        detail = `🧤 ${cleanSheets} clean sheet${cleanSheets > 1 ? 's' : ''} sur ${goalsAgainst.length} matchs (+${modifier})`;
    } else if (cleanSheets === 2) {  // ← CHANGÉ: == au lieu de >=
        modifier = FORM_CONFIG.CLEAN_SHEET_BONUS[2];
        detail = `🧤 ${cleanSheets} clean sheets sur ${goalsAgainst.length} matchs (+${modifier})`;
    } else if (cleanSheets === 1) {  // ← AJOUTÉ: Gérer le cas 1 clean sheet
        // Pas de bonus ni malus pour 1 seul clean sheet
        detail = `🧤 ${cleanSheets} clean sheet sur ${goalsAgainst.length} matchs (neutre)`;
    } else if (cleanSheets === 0 && goalsAgainst.length >= 5) {
        modifier = FORM_CONFIG.NO_CLEAN_SHEET_MALUS;
        detail = `⚠️ Aucun clean sheet sur ${goalsAgainst.length} matchs (${modifier})`;
    }
    
    return { modifier, detail };
}

/**
 * Analyser les buts encaissés
 */
function analyzeGoalsConceded(goalsAgainst) {
    let modifier = 0;
    let detail = null;
    
    const totalConceded = goalsAgainst.reduce((sum, g) => sum + g, 0);
    
    if (totalConceded <= 2 && goalsAgainst.length >= 5) {
        modifier = FORM_CONFIG.LOW_GOALS_CONCEDED_BONUS;
        detail = `🛡️ Défense solide: ${totalConceded} buts encaissés sur ${goalsAgainst.length} matchs (+${modifier})`;
    } else if (totalConceded >= 10) {
        modifier = FORM_CONFIG.HIGH_GOALS_CONCEDED_MALUS;
        detail = `⚠️ Défense poreuse: ${totalConceded} buts encaissés sur ${goalsAgainst.length} matchs (${modifier})`;
    }
    
    return { modifier, detail };
}

/**
 * Analyser l'attaque
 */
function analyzeAttack(goalsFor) {
    let modifier = 0;
    let detail = null;
    
    const totalScored = goalsFor.reduce((sum, g) => sum + g, 0);
    
    // Série avec buts
    let scoringStreak = 0;
    for (let i = goalsFor.length - 1; i >= 0; i--) {
        if (goalsFor[i] > 0) scoringStreak++;
        else break;
    }
    
    if (scoringStreak >= 5) {
        modifier += FORM_CONFIG.SCORING_STREAK_BONUS[5];
        detail = `⚽ But dans ${scoringStreak} matchs consécutifs (+${FORM_CONFIG.SCORING_STREAK_BONUS[5]})`;
    } else if (scoringStreak >= 4) {
        modifier += FORM_CONFIG.SCORING_STREAK_BONUS[4];
        detail = `⚽ But dans ${scoringStreak} matchs consécutifs (+${FORM_CONFIG.SCORING_STREAK_BONUS[4]})`;
    }
    
    // Beaucoup de buts marqués
    if (totalScored >= 10 && goalsFor.length >= 5) {
        modifier += FORM_CONFIG.HIGH_GOALS_SCORED_BONUS;
        const bonusDetail = `⚽ Attaque prolifique: ${totalScored} buts (+${FORM_CONFIG.HIGH_GOALS_SCORED_BONUS})`;
        detail = detail ? detail + ' • ' + bonusDetail : bonusDetail;
    }
    
    // Sécheresse offensive
    let droughtStreak = 0;
    for (let i = goalsFor.length - 1; i >= 0; i--) {
        if (goalsFor[i] === 0) droughtStreak++;
        else break;
    }
    
    if (droughtStreak >= 2) {
        modifier += FORM_CONFIG.SCORING_DROUGHT_MALUS;
        detail = `😰 ${droughtStreak} matchs sans marquer (${FORM_CONFIG.SCORING_DROUGHT_MALUS})`;
    }
    
    return { modifier, detail };
}

/**
 * Déterminer le statut global de forme
 */
function determineFormStatus(modifier, results) {
    if (modifier >= 50) return { icon: '🔥', text: 'En feu', class: 'on-fire' };
    if (modifier >= 20) return { icon: '📈', text: 'Bonne forme', class: 'good-form' };
    if (modifier > -20) return { icon: '😐', text: 'Forme neutre', class: 'neutral' };
    if (modifier > -50) return { icon: '📉', text: 'En difficulté', class: 'struggling' };
    return { icon: '❄️', text: 'En crise', class: 'crisis' };
}

/**
 * Calculer le rating Elo ajusté avec le modificateur de forme
 * @param {Object} team - Équipe avec eloRating et eloHistory
 * @returns {Object} - Rating ajusté et détails
 */
function getAdjustedEloRating(team) {
    const baseRating = team.eloRating || 1500;
    const formAnalysis = analyzeTeamForm(team);
    const adjustedRating = baseRating + formAnalysis.modifier;
    
    return {
        baseRating: baseRating,
        formModifier: formAnalysis.modifier,
        adjustedRating: adjustedRating,
        formStatus: formAnalysis.status,
        formDetails: formAnalysis.details,
        recentForm: formAnalysis.recentMatches
    };
}

/**
 * Formater l'affichage de la forme récente (V-N-D-V-V)
 */
function formatRecentForm(results) {
    return results.join('-');
}

// Export des fonctions
if (typeof window !== 'undefined') {
    window.FormModifier = {
        analyzeTeamForm,
        getAdjustedEloRating,
        formatRecentForm,
        FORM_CONFIG
    };
}