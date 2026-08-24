// =====================================================
// 🎲 PARI COMBINÉ - Bonus sur matchs combinés
// Fichier séparé : pronostics-combine.js
// 🔥 Inclut le verrouillage UX (ex-pronostics-ux-patch.js §6)
// =====================================================

const COMBINE_CONFIG = {
    minMatches: 2,
    maxMatches: 4,
    multipliers: {
        2: 1.3,   // 2 matchs combinés = x1.3
        3: 1.6,   // 3 matchs combinés = x1.6
        4: 2.0    // 4 matchs combinés = x2.0
    },
    allExactBonus: 1.2,  // Bonus supplémentaire si tous les matchs sont score exact
    minPointsPerMatch: 3  // Minimum 3 pts (bon résultat) pour que le combiné soit validé
};

// ===============================
// STOCKAGE
// ===============================

/**
 * Récupère le combiné d'une journée pour un joueur
 */
async function getPlayerCombine(playerId, season, matchDay) {
    const storageKey = `footballEloCombine_${playerId}_${season}_J${matchDay}`;
    
    try {
        // Firebase
        if (typeof db !== 'undefined') {
            const docId = `${playerId}_${season}_J${matchDay}`;
            const doc = await db.collection('combines').doc(docId).get();
            if (doc.exists) return doc.data();
        }
        
        // localStorage fallback
        const stored = localStorage.getItem(storageKey);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.warn('Erreur getPlayerCombine:', e);
    }
    
    return null; // Pas de combiné
}

/**
 * Sauvegarde le combiné
 */
async function savePlayerCombine(playerId, season, matchDay, combineData) {
    const storageKey = `footballEloCombine_${playerId}_${season}_J${matchDay}`;
    localStorage.setItem(storageKey, JSON.stringify(combineData));
    
    // Firebase
    if (typeof db !== 'undefined') {
        try {
            const docId = `${playerId}_${season}_J${matchDay}`;
            await db.collection('combines').doc(docId).set({
                ...combineData,
                playerId,
                season,
                matchDay,
                savedAt: new Date().toISOString()
            });
        } catch (e) {
            console.warn('Erreur sync combiné Firebase:', e);
        }
    }
}

/**
 * Supprime le combiné
 */
async function deletePlayerCombine(playerId, season, matchDay) {
    const storageKey = `footballEloCombine_${playerId}_${season}_J${matchDay}`;
    localStorage.removeItem(storageKey);
    
    if (typeof db !== 'undefined') {
        try {
            const docId = `${playerId}_${season}_J${matchDay}`;
            await db.collection('combines').doc(docId).delete();
        } catch (e) {
            console.warn('Erreur suppression combiné Firebase:', e);
        }
    }
}

// ===============================
// SÉLECTION DES MATCHS
// ===============================

// Matchs sélectionnés en mémoire
let _combineSelections = {};

function getCombineSelections(matchDay) {
    return _combineSelections[matchDay] || [];
}

function setCombineSelections(matchDay, selections) {
    _combineSelections[matchDay] = selections;
}

/**
 * Toggle un match dans le combiné
 * ⚡ UX (ex-ux-patch §6) : bloque si la journée a commencé
 */
function toggleCombineMatch(matchDay, homeTeamId, awayTeamId) {
    // ⚡ Vérifier si la journée a commencé
    if (typeof isMatchDayStarted === 'function' && isMatchDayStarted(matchDay)) {
        alert('La journée a déjà commencé, impossible de modifier le combiné.');
        return;
    }
    
    const selections = getCombineSelections(matchDay);
    const matchKey = `${homeTeamId}_${awayTeamId}`;
    
    const index = selections.indexOf(matchKey);
    
    if (index > -1) {
        // Retirer
        selections.splice(index, 1);
    } else {
        // Ajouter (max 4)
        if (selections.length >= COMBINE_CONFIG.maxMatches) {
            alert(`Maximum ${COMBINE_CONFIG.maxMatches} matchs dans un combiné`);
            return;
        }
        selections.push(matchKey);
    }
    
    setCombineSelections(matchDay, selections);
    updateCombineUI(matchDay);
}

function loadCombineFromSaved(combineData, matchDay) {
    if (combineData && combineData.matches) {
        setCombineSelections(matchDay, combineData.matches.map(m => `${m.homeTeamId}_${m.awayTeamId}`));
    }
}

// ===============================
// INTERFACE
// ===============================

/**
 * Génère le panneau combiné (affiché au-dessus des matchs)
 */
function renderCombinePanel(matchDay, isLocked) {
    const selections = getCombineSelections(matchDay);
    const count = selections.length;
    const isValid = count >= COMBINE_CONFIG.minMatches;
    const multiplier = COMBINE_CONFIG.multipliers[count] || 1;
    
    let html = `
        <div class="combine-panel" style="
            margin-bottom:1rem;padding:0.75rem 1rem;border-radius:12px;
            background:linear-gradient(135deg,#3498db10,#2980b910);
            border:2px ${isValid ? 'solid' : 'dashed'} #3498db;
        ">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-size:1.3rem;">🎲</span>
                    <div>
                        <div style="font-weight:bold;color:#2980b9;">
                            Pari Combiné ${count > 0 ? `(${count} match${count > 1 ? 's' : ''})` : ''}
                        </div>
                        <div style="font-size:0.8rem;color:#7f8c8d;">
                            ${isValid 
                                ? `×${multiplier} si tous les matchs sont au moins "bon résultat"` 
                                : `Sélectionnez ${COMBINE_CONFIG.minMatches}-${COMBINE_CONFIG.maxMatches} matchs pour un bonus`
                            }
                        </div>
                    </div>
                </div>
                ${isValid ? `
                    <div style="background:#3498db;color:white;padding:0.3rem 0.8rem;border-radius:20px;font-weight:bold;font-size:0.9rem;">
                        ×${multiplier}
                    </div>
                ` : ''}
            </div>
    `;
    
    // Liste des matchs sélectionnés
    if (count > 0) {
        html += `<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.5rem;">`;
        selections.forEach(key => {
            const [homeId, awayId] = key.split('_');
            const homeTeam = allTeams.find(t => t.id == homeId);
            const awayTeam = allTeams.find(t => t.id == awayId);
            
            html += `
                <span style="padding:0.2rem 0.5rem;background:#3498db20;border:1px solid #3498db;
                             border-radius:12px;font-size:0.8rem;color:#2980b9;display:flex;align-items:center;gap:0.3rem;">
                    ${homeTeam?.shortName || '?'} - ${awayTeam?.shortName || '?'}
                    ${!isLocked ? `<span onclick="toggleCombineMatch(${matchDay}, ${homeId}, ${awayId})" 
                                        style="cursor:pointer;color:#e74c3c;font-weight:bold;">✕</span>` : ''}
                </span>
            `;
        });
        html += `</div>`;
    }
    
    html += '</div>';
    return html;
}

/**
 * Génère le bouton combiné pour chaque carte de match
 */
function renderCombineButton(matchDay, homeTeamId, awayTeamId, isLocked) {
    if (isLocked) return '';
    
    const selections = getCombineSelections(matchDay);
    const matchKey = `${homeTeamId}_${awayTeamId}`;
    const isSelected = selections.includes(matchKey);
    const canAdd = selections.length < COMBINE_CONFIG.maxMatches || isSelected;
    
    if (!canAdd && !isSelected) return '';
    
    return `
        <button type="button" class="combine-btn ${isSelected ? 'active' : ''}" 
                onclick="toggleCombineMatch(${matchDay}, ${homeTeamId}, ${awayTeamId})"
                style="padding:0.2rem 0.5rem;border-radius:6px;font-size:0.75rem;cursor:pointer;
                       border:1px solid ${isSelected ? '#3498db' : '#ddd'};
                       background:${isSelected ? '#3498db' : '#f8f9fa'};
                       color:${isSelected ? 'white' : '#7f8c8d'};">
            🎲 ${isSelected ? 'Combiné ✓' : 'Combiné'}
        </button>
    `;
}

/**
 * Met à jour l'affichage du combiné
 */
function updateCombineUI(matchDay) {
    // Mettre à jour le panneau
    const panel = document.querySelector('.combine-panel');
    if (panel) {
        panel.outerHTML = renderCombinePanel(matchDay, false);
    }
    
    // Mettre à jour les boutons
    document.querySelectorAll('.combine-btn').forEach(btn => {
        const matchEl = btn.closest('.prediction-match');
        if (!matchEl) return;
        
        const homeId = parseInt(matchEl.dataset.home);
        const awayId = parseInt(matchEl.dataset.away);
        const matchKey = `${homeId}_${awayId}`;
        const selections = getCombineSelections(matchDay);
        const isSelected = selections.includes(matchKey);
        
        btn.className = `combine-btn ${isSelected ? 'active' : ''}`;
        btn.style.border = `1px solid ${isSelected ? '#3498db' : '#ddd'}`;
        btn.style.background = isSelected ? '#3498db' : '#f8f9fa';
        btn.style.color = isSelected ? 'white' : '#7f8c8d';
        btn.innerHTML = `🎲 ${isSelected ? 'Combiné ✓' : 'Combiné'}`;
    });
}

// ===============================
// SAUVEGARDE AVEC LES PRONOSTICS
// ===============================

/**
 * Prépare les données du combiné pour la sauvegarde
 */
function prepareCombineData(matchDay) {
    const selections = getCombineSelections(matchDay);
    
    if (selections.length < COMBINE_CONFIG.minMatches) return null;
    
    return {
        matches: selections.map(key => {
            const [homeTeamId, awayTeamId] = key.split('_');
            return { homeTeamId: parseInt(homeTeamId), awayTeamId: parseInt(awayTeamId) };
        }),
        matchCount: selections.length,
        multiplier: COMBINE_CONFIG.multipliers[selections.length] || 1
    };
}

/**
 * Sauvegarde le combiné (à appeler dans handleSavePredictions)
 */
async function saveCombineWithPredictions(playerId, season, matchDay) {
    const data = prepareCombineData(matchDay);
    
    if (data) {
        await savePlayerCombine(playerId, season, matchDay, data);
    } else {
        await deletePlayerCombine(playerId, season, matchDay);
    }
}

// ===============================
// CALCUL DES RÉSULTATS
// ===============================

/**
 * Calcule le bonus combiné pour une journée
 * @returns {bonus, breakdown, isSuccess}
 */
// matchDayOrMatches : numéro de journée OU tableau de matchs (les deux formes
// sont utilisées par les appelants — classements, stats, récap).
// Le retour expose bonus/bonusPoints et isSuccess/success (alias) : des
// appelants lisaient bonusPoints/success qui n'existaient pas, et le bonus
// du combiné n'était jamais compté dans les totaux.
function calculateCombineResult(combineData, predictions, matchDayOrMatches) {
    const finalize = r => ({ ...r, bonusPoints: r.bonus, success: r.isSuccess });

    if (!combineData || !combineData.matches || combineData.matches.length < COMBINE_CONFIG.minMatches) {
        return finalize({ bonus: 0, breakdown: null, isSuccess: false, active: false });
    }

    const matchesThisDay = Array.isArray(matchDayOrMatches)
        ? matchDayOrMatches.filter(m => m.finalScore)
        : allMatches.filter(m => m.matchDay === matchDayOrMatches && m.finalScore);
    let allCorrect = true;
    let allExact = true;
    let combineBasePoints = 0;
    const matchResults = [];
    
    for (const combineMatch of combineData.matches) {
        const match = matchesThisDay.find(m =>
            m.homeTeamId == combineMatch.homeTeamId && m.awayTeamId == combineMatch.awayTeamId
        );
        
        if (!match) {
            // Match pas encore joué
            return finalize({ bonus: 0, breakdown: null, isSuccess: false, active: true, pending: true });
        }
        
        const pred = predictions?.find(p =>
            p.homeTeamId == combineMatch.homeTeamId && p.awayTeamId == combineMatch.awayTeamId
        );
        
        if (!pred) {
            allCorrect = false;
            matchResults.push({ match: combineMatch, points: 0, class: 'wrong' });
            continue;
        }
        
        const result = calculatePredictionResult(
            pred.homeScore, pred.awayScore,
            match.finalScore.home, match.finalScore.away,
            pred.savedAt, match
        );
        
        const basePoints = result.points || 0;
        
        if (basePoints < COMBINE_CONFIG.minPointsPerMatch) {
            allCorrect = false;
        }
        if (basePoints !== 9) {
            allExact = false;
        }
        
        combineBasePoints += basePoints;
        matchResults.push({
            match: combineMatch,
            points: basePoints,
            class: result.class
        });
    }
    
    if (!allCorrect) {
        return finalize({
            bonus: 0,
            breakdown: matchResults,
            isSuccess: false,
            active: true,
            pending: false,
            message: '❌ Combiné raté — au moins un match en dessous de 3 pts'
        });
    }
    
    // Combiné réussi !
    let multiplier = combineData.multiplier || COMBINE_CONFIG.multipliers[combineData.matchCount] || 1;
    let bonusPoints = Math.round(combineBasePoints * (multiplier - 1) * 10) / 10;
    
    // Bonus all exact
    let allExactBonus = 0;
    if (allExact && combineData.matchCount >= 2) {
        allExactBonus = Math.round(combineBasePoints * multiplier * (COMBINE_CONFIG.allExactBonus - 1) * 10) / 10;
        bonusPoints += allExactBonus;
    }
    
    return finalize({
        bonus: bonusPoints,
        breakdown: matchResults,
        isSuccess: true,
        active: true,
        pending: false,
        multiplier,
        allExact,
        allExactBonus,
        combineBasePoints,
        message: `✅ Combiné réussi ! +${bonusPoints} pts bonus`
    });
}

// ===============================
// AFFICHAGE DES RÉSULTATS
// ===============================

/**
 * Affiche le résultat du combiné dans le récapitulatif de journée
 */
function renderCombineResult(combineData, predictions, matchDay) {
    const result = calculateCombineResult(combineData, predictions, matchDay);
    
    if (!result.active) return '';
    
    const bgColor = result.isSuccess ? '#27ae6010' : result.pending ? '#f39c1210' : '#e74c3c10';
    const borderColor = result.isSuccess ? '#27ae60' : result.pending ? '#f39c12' : '#e74c3c';
    
    let html = `
        <div style="margin-top:0.75rem;padding:0.75rem;background:${bgColor};
                    border:1px solid ${borderColor}30;border-radius:10px;">
            <div style="font-weight:bold;color:${result.isSuccess ? '#27ae60' : result.pending ? '#f39c12' : '#e74c3c'};margin-bottom:0.5rem;">
                🎲 Pari Combiné (${combineData.matchCount} matchs · ×${combineData.multiplier})
            </div>
    `;
    
    if (result.breakdown) {
        html += `<div style="display:flex;flex-direction:column;gap:0.25rem;font-size:0.85rem;">`;
        result.breakdown.forEach(mr => {
            const homeTeam = allTeams.find(t => t.id == mr.match.homeTeamId);
            const awayTeam = allTeams.find(t => t.id == mr.match.awayTeamId);
            const icon = mr.points >= 9 ? '🏆' : mr.points >= 6 ? '🎯' : mr.points >= 3 ? '✅' : '❌';
            
            html += `
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span>${icon}</span>
                    <span>${homeTeam?.shortName || '?'} - ${awayTeam?.shortName || '?'}</span>
                    <span style="color:#7f8c8d;">${mr.points} pts</span>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    html += `
            <div style="margin-top:0.5rem;font-weight:bold;font-size:0.9rem;">
                ${result.message}
                ${result.allExact ? `<br><span style="color:#f39c12;">🌟 Tous scores exacts ! +${result.allExactBonus} pts bonus supplémentaire</span>` : ''}
            </div>
        </div>
    `;
    
    return html;
}

console.log('🎲 Module pronostics-combine chargé');