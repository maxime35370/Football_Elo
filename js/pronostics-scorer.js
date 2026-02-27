// =====================================================
// ⚽ DÉFI BUTEUR - Prédiction du premier buteur
// Fichier séparé : pronostics-scorer.js
// 🔥 Inclut les améliorations UX (ex-pronostics-ux-patch.js §1)
// =====================================================

// Points bonus
const SCORER_FIRST_EXACT = 4;   // Premier buteur exact
const SCORER_SCORED = 1;         // A marqué dans le match (mais pas premier)

// ===============================
// RÉCUPÉRATION DES BUTEURS PAR ÉQUIPE
// ===============================

/**
 * Récupère le top des buteurs d'une équipe cette saison
 * @returns [{name, goals, matches}] trié par buts décroissants
 */
function getTeamTopScorers(teamId, limit = 10) {
    const scorers = {};
    
    allMatches.forEach(match => {
        if (!match.goals || match.goals.length === 0) return;
        
        match.goals.forEach(goal => {
            if (goal.teamId != teamId) return;
            
            // Normaliser le nom
            const name = normalizeScorer(goal.scorer);
            
            if (!scorers[name]) {
                scorers[name] = { name, goals: 0, matchIds: new Set() };
            }
            scorers[name].goals++;
            scorers[name].matchIds.add(match.id);
        });
    });
    
    return Object.values(scorers)
        .map(s => ({ name: s.name, goals: s.goals, matches: s.matchIds.size }))
        .sort((a, b) => b.goals - a.goals)
        .slice(0, limit);
}

/**
 * Récupère le top buteurs des DEUX équipes d'un match
 */
function getMatchTopScorers(homeTeamId, awayTeamId) {
    return {
        home: getTeamTopScorers(homeTeamId),
        away: getTeamTopScorers(awayTeamId)
    };
}

/**
 * Normalise un nom de buteur pour la comparaison
 */
function normalizeScorer(name) {
    if (!name) return '';
    return name.trim()
        .replace(/-/g, ' ')
        .toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/**
 * Compare deux noms de buteurs (tolérance souple)
 */
function matchScorerNames(pred, actual) {
    const p = normalizeScorer(pred).toLowerCase();
    const a = normalizeScorer(actual).toLowerCase();
    
    if (p === a) return true;
    
    // Vérifier si l'un contient l'autre (ex: "Mbappé" vs "Kylian Mbappé")
    if (p.includes(a) || a.includes(p)) return true;
    
    // Vérifier le nom de famille uniquement
    const pParts = p.split(' ');
    const aParts = a.split(' ');
    const pLast = pParts[pParts.length - 1];
    const aLast = aParts[aParts.length - 1];
    
    if (pLast === aLast && pLast.length > 2) return true;
    
    return false;
}

// ===============================
// INTERFACE - SÉLECTION DU BUTEUR
// (UX amélioré — ex-pronostics-ux-patch.js §1)
// ===============================

/**
 * Génère le HTML du défi buteur pour une carte de match
 * - Si buteur sélectionné : badge compact cliquable avec ✏️
 * - Sinon : checkbox pour activer + picker
 * - Auto-collapse après sélection
 */
function renderScorerChallenge(homeTeamId, awayTeamId, existingPick, isLocked) {
    const matchKey = `${homeTeamId}_${awayTeamId}`;
    const homeTeam = allTeams.find(t => t.id == homeTeamId);
    const awayTeam = allTeams.find(t => t.id == awayTeamId);
    
    if (isLocked && !existingPick) {
        return ''; // Pas de défi si verrouillé et pas de pick
    }
    
    const scorers = getMatchTopScorers(homeTeamId, awayTeamId);
    
    let html = `
        <div class="scorer-challenge" data-match="${matchKey}" style="margin-top:0.5rem;">
    `;
    
    if (isLocked) {
        // Affichage lecture seule
        html += `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.75rem;
                        background:linear-gradient(135deg,#8e44ad10,#9b59b610);
                        border:1px solid #8e44ad40;border-radius:8px;font-size:0.85rem;">
                <span>⚽</span>
                <span style="color:#8e44ad;font-weight:600;">1er buteur : ${existingPick}</span>
            </div>
        `;
    } else if (existingPick) {
        // ✅ BUTEUR DÉJÀ SÉLECTIONNÉ → Badge compact cliquable
        html += `
            <div class="scorer-pick-display" 
                 onclick="toggleScorerPicker('${matchKey}')"
                 style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.7rem;
                        background:linear-gradient(135deg,#8e44ad15,#9b59b620);
                        border:1px solid #8e44ad60;border-radius:20px;cursor:pointer;
                        font-size:0.82rem;color:#8e44ad;font-weight:600;
                        max-width:200px;transition:all 0.2s;">
                <span>⚽</span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${existingPick}</span>
                <span style="opacity:0.6;font-size:0.75rem;">✏️</span>
            </div>
            <div class="scorer-picker" id="scorerPicker_${matchKey}" style="display:none;margin-top:0.3rem;">
                ${_renderScorerPickerContent(matchKey, homeTeam, awayTeam, scorers, existingPick)}
            </div>
        `;
    } else {
        // ❌ PAS DE BUTEUR → Checkbox + picker
        html += `
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;">
                <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;font-size:0.85rem;color:#8e44ad;">
                    <input type="checkbox" class="scorer-toggle" data-match="${matchKey}" 
                           onchange="toggleScorerChallenge('${matchKey}')">
                    ⚽ Défi 1er buteur
                    <span style="font-size:0.75rem;color:#95a5a6;">(+${SCORER_FIRST_EXACT} pts)</span>
                </label>
            </div>
            <div class="scorer-picker" id="scorerPicker_${matchKey}" style="display:none;">
                ${_renderScorerPickerContent(matchKey, homeTeam, awayTeam, scorers, null)}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

/**
 * Génère le contenu interne du picker (boutons buteurs + champ custom)
 * Utilisé par renderScorerChallenge pour éviter la duplication
 */
function _renderScorerPickerContent(matchKey, homeTeam, awayTeam, scorers, existingPick) {
    let html = `<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.3rem;">`;
    
    // Buteurs de l'équipe domicile
    if (scorers.home.length > 0) {
        html += `<div style="font-size:0.7rem;color:#7f8c8d;width:100%;">🏠 ${homeTeam?.shortName || '?'}</div>`;
        scorers.home.slice(0, 5).forEach(s => {
            const selected = existingPick && matchScorerNames(existingPick, s.name);
            html += `
                <button type="button" class="scorer-btn ${selected ? 'selected' : ''}" 
                        onclick="selectScorer('${matchKey}', '${s.name.replace(/'/g, "\\'")}')"
                        style="padding:0.2rem 0.5rem;border-radius:12px;font-size:0.75rem;cursor:pointer;
                               border:1px solid ${selected ? '#8e44ad' : '#ddd'};
                               background:${selected ? '#8e44ad' : '#f8f9fa'};
                               color:${selected ? 'white' : '#2c3e50'};
                               transition:all 0.15s;">
                    ${s.name} <span style="opacity:0.6;">(${s.goals})</span>
                </button>
            `;
        });
    }
    
    // Buteurs de l'équipe extérieur
    if (scorers.away.length > 0) {
        html += `<div style="font-size:0.7rem;color:#7f8c8d;width:100%;margin-top:0.2rem;">✈️ ${awayTeam?.shortName || '?'}</div>`;
        scorers.away.slice(0, 5).forEach(s => {
            const selected = existingPick && matchScorerNames(existingPick, s.name);
            html += `
                <button type="button" class="scorer-btn ${selected ? 'selected' : ''}" 
                        onclick="selectScorer('${matchKey}', '${s.name.replace(/'/g, "\\'")}')"
                        style="padding:0.2rem 0.5rem;border-radius:12px;font-size:0.75rem;cursor:pointer;
                               border:1px solid ${selected ? '#8e44ad' : '#ddd'};
                               background:${selected ? '#8e44ad' : '#f8f9fa'};
                               color:${selected ? 'white' : '#2c3e50'};
                               transition:all 0.15s;">
                    ${s.name} <span style="opacity:0.6;">(${s.goals})</span>
                </button>
            `;
        });
    }
    
    // Champ "Autre" avec bouton OK
    const isCustom = existingPick && !scorers.home.concat(scorers.away).some(s => matchScorerNames(existingPick, s.name));
    html += `
        </div>
        <div style="display:flex;align-items:center;gap:0.3rem;margin-top:0.3rem;">
            <input type="text" class="scorer-custom" id="scorerCustom_${matchKey}" 
                   placeholder="Autre joueur..." 
                   value="${isCustom ? existingPick : ''}"
                   style="padding:0.3rem 0.5rem;border:1px solid ${isCustom ? '#8e44ad' : '#ddd'};
                          border-radius:6px;font-size:0.8rem;flex:1;max-width:200px;
                          ${isCustom ? 'background:#8e44ad10;color:#8e44ad;font-weight:600;' : ''}">
            <button type="button" onclick="selectCustomScorer('${matchKey}')"
                    style="padding:0.3rem 0.6rem;background:#8e44ad;color:white;
                           border:none;border-radius:6px;font-size:0.75rem;cursor:pointer;
                           font-weight:600;">
                OK
            </button>
        </div>
    `;
    
    return html;
}

/**
 * Toggle le picker buteur (badge compact ✏️ → ouvre/ferme le picker)
 */
function toggleScorerPicker(matchKey) {
    const picker = document.getElementById(`scorerPicker_${matchKey}`);
    if (picker) {
        const isVisible = picker.style.display !== 'none';
        picker.style.display = isVisible ? 'none' : 'block';
    }
}

/**
 * Toggle le défi buteur pour un match (checkbox mode)
 */
function toggleScorerChallenge(matchKey) {
    const picker = document.getElementById(`scorerPicker_${matchKey}`);
    const toggle = document.querySelector(`.scorer-toggle[data-match="${matchKey}"]`);
    
    if (picker && toggle) {
        picker.style.display = toggle.checked ? 'block' : 'none';
        
        if (!toggle.checked) {
            // Désélectionner le buteur
            clearScorerSelection(matchKey);
        }
    }
}

/**
 * Sélectionner un buteur depuis les boutons
 * Auto-collapse le picker après 200ms et affiche le badge compact
 */
function selectScorer(matchKey, scorerName) {
    // Désélectionner tous les boutons de ce match
    const container = document.querySelector(`.scorer-challenge[data-match="${matchKey}"]`);
    if (container) {
        container.querySelectorAll('.scorer-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.style.background = '#f8f9fa';
            btn.style.color = '#2c3e50';
            btn.style.borderColor = '#ddd';
        });
        
        // Sélectionner le bon
        container.querySelectorAll('.scorer-btn').forEach(btn => {
            if (btn.textContent.includes(scorerName)) {
                btn.classList.add('selected');
                btn.style.background = '#8e44ad';
                btn.style.color = 'white';
                btn.style.borderColor = '#8e44ad';
            }
        });
        
        // Vider le champ custom
        const customInput = document.getElementById(`scorerCustom_${matchKey}`);
        if (customInput) {
            customInput.value = '';
            customInput.style.borderColor = '#ddd';
            customInput.style.background = '';
            customInput.style.color = '';
            customInput.style.fontWeight = '';
        }
    }
    
    // Stocker la sélection
    storeScorerPick(matchKey, scorerName);
    
    // Auto-collapse le picker après 200ms et remplacer par badge compact
    setTimeout(() => {
        _collapseScorerToBadge(matchKey, scorerName);
    }, 200);
}

/**
 * Sélection via le champ "Autre" + bouton OK
 */
function selectCustomScorer(matchKey) {
    const customInput = document.getElementById(`scorerCustom_${matchKey}`);
    if (!customInput) return;
    
    const name = customInput.value.trim();
    if (!name) return;
    
    // Désélectionner les boutons
    const container = document.querySelector(`.scorer-challenge[data-match="${matchKey}"]`);
    if (container) {
        container.querySelectorAll('.scorer-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.style.background = '#f8f9fa';
            btn.style.color = '#2c3e50';
            btn.style.borderColor = '#ddd';
        });
    }
    
    // Highlight le champ custom
    customInput.style.borderColor = '#8e44ad';
    customInput.style.background = '#8e44ad10';
    customInput.style.color = '#8e44ad';
    customInput.style.fontWeight = '600';
    
    storeScorerPick(matchKey, name);
    
    // Auto-collapse le picker après 200ms et remplacer par badge compact
    setTimeout(() => {
        _collapseScorerToBadge(matchKey, name);
    }, 200);
}

/**
 * Collapse le picker et affiche le badge compact cliquable
 */
function _collapseScorerToBadge(matchKey, scorerName) {
    const container = document.querySelector(`.scorer-challenge[data-match="${matchKey}"]`);
    if (!container) return;
    
    // Cacher le picker
    const picker = container.querySelector('.scorer-picker');
    if (picker) picker.style.display = 'none';
    
    // Cacher la checkbox si elle existe
    const checkboxLabel = container.querySelector('label');
    if (checkboxLabel) checkboxLabel.style.display = 'none';
    
    // Vérifier si le badge existe déjà, sinon le créer
    let badge = container.querySelector('.scorer-pick-display');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'scorer-pick-display';
        badge.onclick = () => toggleScorerPicker(matchKey);
        badge.style.cssText = `display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.7rem;
            background:linear-gradient(135deg,#8e44ad15,#9b59b620);
            border:1px solid #8e44ad60;border-radius:20px;cursor:pointer;
            font-size:0.82rem;color:#8e44ad;font-weight:600;
            max-width:200px;transition:all 0.2s;`;
        container.insertBefore(badge, container.firstChild);
    }
    
    badge.innerHTML = `
        <span>⚽</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${scorerName}</span>
        <span style="opacity:0.6;font-size:0.75rem;">✏️</span>
    `;
    badge.style.display = 'inline-flex';
}

/**
 * Efface la sélection de buteur
 */
function clearScorerSelection(matchKey) {
    storeScorerPick(matchKey, null);
}

/**
 * Stocke temporairement le pick (sera sauvegardé avec les pronostics)
 */
function storeScorerPick(matchKey, scorerName) {
    if (!window._scorerPicks) window._scorerPicks = {};
    window._scorerPicks[matchKey] = scorerName;
    
    // Persister dans localStorage en backup
    try {
        localStorage.setItem('footballElo_scorerPicks', JSON.stringify(window._scorerPicks));
    } catch (e) {}
}

/**
 * Récupère tous les picks de buteurs en cours
 */
function getScorerPicks() {
    if (window._scorerPicks && Object.keys(window._scorerPicks).length > 0) {
        return window._scorerPicks;
    }
    // Fallback localStorage
    try {
        const stored = localStorage.getItem('footballElo_scorerPicks');
        if (stored) {
            window._scorerPicks = JSON.parse(stored);
            return window._scorerPicks;
        }
    } catch (e) {}
    return {};
}

// ===============================
// SAUVEGARDE / CHARGEMENT
// ===============================

/**
 * Ajoute les picks buteurs aux prédictions avant sauvegarde
 * Appelé dans handleSavePredictions
 */
function addScorerPicksToPredictions(predictions) {
    const picks = getScorerPicks();
    
    predictions.forEach(pred => {
        const matchKey = `${pred.homeTeamId}_${pred.awayTeamId}`;
        if (picks[matchKey]) {
            pred.scorerPick = picks[matchKey];
        } else {
            delete pred.scorerPick;
        }
    });
    
    return predictions;
}

/**
 * Charge les picks buteurs existants depuis les prédictions sauvegardées
 */
function loadScorerPicksFromPredictions(predictions) {
    window._scorerPicks = {};
    
    if (!predictions) return;
    
    predictions.forEach(pred => {
        if (pred.scorerPick) {
            const matchKey = `${pred.homeTeamId}_${pred.awayTeamId}`;
            window._scorerPicks[matchKey] = pred.scorerPick;
        }
    });
    
    // Persister dans localStorage
    try {
        localStorage.setItem('footballElo_scorerPicks', JSON.stringify(window._scorerPicks));
    } catch (e) {}
}

// ===============================
// CALCUL DES RÉSULTATS
// ===============================

/**
 * Calcule les points du défi buteur pour un match
 * @param scorerPick - nom du buteur prédit
 * @param match - objet match avec goals[]
 * @returns {points, label, isFirstScorer}
 */
function calculateScorerResult(scorerPick, match) {
    if (!scorerPick || !match || !match.goals || match.goals.length === 0) {
        if (!scorerPick) return { points: 0, label: '', isFirstScorer: false, participated: false };
        // Match 0-0 = buteur raté
        return { points: 0, label: '⚽❌ Pas de but dans le match', isFirstScorer: false, participated: true };
    }
    
    // Trier les buts par minute
    const sortedGoals = [...match.goals].sort((a, b) => {
        if (a.minute !== b.minute) return a.minute - b.minute;
        return (a.extraTime || 0) - (b.extraTime || 0);
    });
    
    const firstGoal = sortedGoals[0];
    
    // Vérifier si c'est le premier buteur
    if (matchScorerNames(scorerPick, firstGoal.scorer)) {
        return {
            points: SCORER_FIRST_EXACT,
            label: `⚽🎯 1er buteur ! (+${SCORER_FIRST_EXACT} pts)`,
            isFirstScorer: true,
            participated: true
        };
    }
    
    // Vérifier si le joueur a marqué dans le match (mais pas en premier)
    const hasScored = sortedGoals.some(g => matchScorerNames(scorerPick, g.scorer));
    
    if (hasScored) {
        return {
            points: SCORER_SCORED,
            label: `⚽✅ A marqué (+${SCORER_SCORED} pt)`,
            isFirstScorer: false,
            participated: true
        };
    }
    
    return {
        points: 0,
        label: '⚽❌ N\'a pas marqué',
        isFirstScorer: false,
        participated: true
    };
}

/**
 * Calcule le total des points défi buteur pour une journée
 */
function calculateScorerPointsForMatchDay(predictions, matchDay) {
    let totalPoints = 0;
    let details = [];
    
    if (!predictions) return { totalPoints: 0, details: [] };
    
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
    
    predictions.forEach(pred => {
        if (!pred.scorerPick) return;
        
        const match = matchesThisDay.find(m =>
            m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
        );
        
        if (!match) return;
        
        const result = calculateScorerResult(pred.scorerPick, match);
        totalPoints += result.points;
        
        if (result.participated) {
            const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
            const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
            
            details.push({
                match: `${homeTeam?.shortName || '?'} - ${awayTeam?.shortName || '?'}`,
                pick: pred.scorerPick,
                result: result
            });
        }
    });
    
    return { totalPoints, details };
}

// ===============================
// AFFICHAGE DES RÉSULTATS
// ===============================

/**
 * Affiche le résultat du défi buteur dans la carte de match (après le résultat principal)
 */
function renderScorerResult(scorerPick, match) {
    if (!scorerPick) return '';
    
    const result = calculateScorerResult(scorerPick, match);
    if (!result.participated) return '';
    
    const bgColor = result.isFirstScorer ? '#8e44ad15' : result.points > 0 ? '#27ae6015' : '#e74c3c10';
    const borderColor = result.isFirstScorer ? '#8e44ad' : result.points > 0 ? '#27ae60' : '#e74c3c';
    
    // Trouver le vrai premier buteur
    let firstScorerInfo = '';
    if (match.goals && match.goals.length > 0) {
        const sorted = [...match.goals].sort((a, b) => a.minute - b.minute || (a.extraTime || 0) - (b.extraTime || 0));
        const first = sorted[0];
        const team = allTeams.find(t => t.id == first.teamId);
        const time = first.extraTime > 0 ? `${first.minute}+${first.extraTime}'` : `${first.minute}'`;
        firstScorerInfo = `1er but : ${first.scorer} (${team?.shortName || '?'}) ${time}`;
    }
    
    return `
        <div style="margin-top:0.3rem;padding:0.3rem 0.5rem;background:${bgColor};
                    border-left:3px solid ${borderColor};border-radius:4px;font-size:0.8rem;">
            <div>${result.label}</div>
            <div style="color:#7f8c8d;font-size:0.75rem;">
                Choix : ${scorerPick} ${firstScorerInfo ? `· ${firstScorerInfo}` : ''}
            </div>
        </div>
    `;
}

/**
 * Résumé défi buteur dans le récapitulatif de journée
 */
function renderScorerSummary(predictions, matchDay) {
    const { totalPoints, details } = calculateScorerPointsForMatchDay(predictions, matchDay);
    
    if (details.length === 0) return '';
    
    const firstScorers = details.filter(d => d.result.isFirstScorer).length;
    const scoredButNotFirst = details.filter(d => d.result.points === SCORER_SCORED).length;
    const missed = details.filter(d => d.result.points === 0).length;
    
    return `
        <div style="margin-top:0.75rem;padding:0.75rem;background:linear-gradient(135deg,#8e44ad10,#9b59b610);
                    border:1px solid #8e44ad30;border-radius:10px;">
            <div style="font-weight:bold;color:#8e44ad;margin-bottom:0.5rem;">
                ⚽ Défi Buteur : +${totalPoints} pts
            </div>
            <div style="display:flex;gap:1rem;font-size:0.85rem;flex-wrap:wrap;">
                ${firstScorers > 0 ? `<span>🎯 ${firstScorers} 1er buteur</span>` : ''}
                ${scoredButNotFirst > 0 ? `<span>✅ ${scoredButNotFirst} a marqué</span>` : ''}
                ${missed > 0 ? `<span>❌ ${missed} raté</span>` : ''}
            </div>
        </div>
    `;
}

console.log('⚽ Module pronostics-scorer chargé');