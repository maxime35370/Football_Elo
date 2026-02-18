// =====================================================
// 🔧 PATCH UX — pronostics-ux-patch.js
// Améliorations : buteur persistant, mobile toggle,
// exclusion mutuelle jokers
// Charger APRÈS les autres modules pronostics
// =====================================================

// ===============================
// 1. BUTEUR : AFFICHAGE PERSISTANT
// ===============================

/**
 * Override du renderScorerChallenge pour afficher le nom
 * du buteur choisi (bouton OU manuel) de façon visible
 */
const _originalRenderScorerChallenge = typeof renderScorerChallenge === 'function' ? renderScorerChallenge : null;

function renderScorerChallenge(homeTeamId, awayTeamId, existingPick, isLocked) {
    const matchKey = `${homeTeamId}_${awayTeamId}`;
    const homeTeam = allTeams.find(t => t.id == homeTeamId);
    const awayTeam = allTeams.find(t => t.id == awayTeamId);
    
    if (isLocked && !existingPick) return '';
    
    const scorers = getMatchTopScorers(homeTeamId, awayTeamId);
    const isActive = !!existingPick;
    
    // Déterminer si le pick est un joueur custom
    const allKnownScorers = [...(scorers.home || []), ...(scorers.away || [])];
    const isCustomPick = existingPick && !allKnownScorers.some(s => matchScorerNames(existingPick, s.name));
    
    let html = `<div class="scorer-challenge match-extra-option" data-match="${matchKey}" style="margin-top:0.5rem;">`;
    
    if (isLocked) {
        // Lecture seule
        html += `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.75rem;
                        background:linear-gradient(135deg,#8e44ad10,#9b59b610);
                        border:1px solid #8e44ad40;border-radius:8px;font-size:0.85rem;">
                <span>⚽</span>
                <span style="color:#8e44ad;font-weight:600;">1er buteur : ${existingPick}</span>
            </div>
        `;
    } else {
        // Si buteur déjà choisi : ligne unique compacte, clic pour modifier
        const pickerHidden = isActive;
        
        if (isActive) {
            // Buteur sélectionné → 1 seule ligne cliquable
            html += `
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;">
                    <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;font-size:0.85rem;color:#8e44ad;">
                        <input type="checkbox" class="scorer-toggle" data-match="${matchKey}" 
                               checked onchange="toggleScorerChallenge('${matchKey}')">
                        ⚽
                    </label>
                    <span id="scorerDisplay_${matchKey}" class="scorer-pick-display"
                          style="font-size:0.85rem;font-weight:600;color:#8e44ad;cursor:pointer;
                                 display:flex;align-items:center;gap:0.3rem;"
                          onclick="toggleScorerPicker('${matchKey}')" title="Cliquer pour modifier">
                        ${existingPick} <span style="font-size:0.65rem;opacity:0.5;">✏️</span>
                    </span>
                    <span style="font-size:0.7rem;color:#95a5a6;margin-left:auto;">(+${SCORER_FIRST_EXACT} pts)</span>
                </div>
            `;
        } else {
            // Pas de buteur → toggle classique
            html += `
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;">
                    <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;font-size:0.85rem;color:#8e44ad;">
                        <input type="checkbox" class="scorer-toggle" data-match="${matchKey}" 
                               onchange="toggleScorerChallenge('${matchKey}')">
                        ⚽ Défi 1er buteur
                        <span style="font-size:0.75rem;color:#95a5a6;">(+${SCORER_FIRST_EXACT} pts)</span>
                    </label>
                </div>
            `;
        }
        
        html += `
            <div class="scorer-picker" id="scorerPicker_${matchKey}" style="display:${pickerHidden ? 'none' : 'block'};">
                <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.3rem;">
        `;
        
        // Buteurs domicile
        if (scorers.home.length > 0) {
            html += `<div style="font-size:0.7rem;color:#7f8c8d;width:100%;">🏠 ${homeTeam?.shortName || '?'}</div>`;
            scorers.home.slice(0, 5).forEach(s => {
                const selected = existingPick && matchScorerNames(existingPick, s.name);
                html += renderScorerButton(matchKey, s.name, s.goals, selected);
            });
        }
        
        // Buteurs extérieur
        if (scorers.away.length > 0) {
            html += `<div style="font-size:0.7rem;color:#7f8c8d;width:100%;margin-top:0.2rem;">✈️ ${awayTeam?.shortName || '?'}</div>`;
            scorers.away.slice(0, 5).forEach(s => {
                const selected = existingPick && matchScorerNames(existingPick, s.name);
                html += renderScorerButton(matchKey, s.name, s.goals, selected);
            });
        }
        
        // Champ "Autre" avec bouton de confirmation
        html += `
                </div>
                <div style="display:flex;align-items:center;gap:0.3rem;margin-top:0.3rem;">
                    <input type="text" class="scorer-custom" id="scorerCustom_${matchKey}" 
                           placeholder="Autre joueur..." 
                           value="${isCustomPick ? existingPick : ''}"
                           style="padding:0.3rem 0.5rem;border:1px solid ${isCustomPick ? '#8e44ad' : '#ddd'};
                                  border-radius:6px;font-size:0.8rem;flex:1;max-width:200px;
                                  ${isCustomPick ? 'background:#8e44ad10;font-weight:600;' : ''}">
                    <button type="button" onclick="confirmCustomScorer('${matchKey}')" 
                            style="padding:0.3rem 0.6rem;background:${isCustomPick ? '#8e44ad' : '#667eea'};
                                   color:white;border:none;border-radius:6px;font-size:0.75rem;cursor:pointer;">
                        ${isCustomPick ? '✅' : '✓ OK'}
                    </button>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

function renderScorerButton(matchKey, name, goals, selected) {
    const escapedName = name.replace(/'/g, "\\'");
    return `
        <button type="button" class="scorer-btn ${selected ? 'selected' : ''}" 
                onclick="selectScorer('${matchKey}', '${escapedName}')"
                style="padding:0.2rem 0.5rem;border-radius:12px;font-size:0.75rem;cursor:pointer;
                       border:1px solid ${selected ? '#8e44ad' : '#ddd'};
                       background:${selected ? '#8e44ad' : '#f8f9fa'};
                       color:${selected ? 'white' : '#2c3e50'};">
            ${name} <span style="opacity:0.6;">(${goals})</span>
        </button>
    `;
}

/**
 * Toggle la visibilité de la liste des buteurs (clic sur le badge ✏️)
 */
function toggleScorerPicker(matchKey) {
    const picker = document.getElementById(`scorerPicker_${matchKey}`);
    if (picker) {
        const isOpen = picker.style.display !== 'none';
        picker.style.display = isOpen ? 'none' : 'block';
    }
}

/**
 * Confirmer le joueur custom avec le bouton OK
 */
function confirmCustomScorer(matchKey) {
    const customInput = document.getElementById(`scorerCustom_${matchKey}`);
    if (!customInput) return;
    
    const name = customInput.value.trim();
    if (!name) {
        alert('Saisis un nom de joueur');
        return;
    }
    
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
    
    // Styler l'input comme sélectionné
    customInput.style.border = '1px solid #8e44ad';
    customInput.style.background = '#8e44ad10';
    customInput.style.fontWeight = '600';
    
    // Mettre à jour le bouton OK
    const okBtn = customInput.nextElementSibling;
    if (okBtn) {
        okBtn.textContent = '✅';
        okBtn.style.background = '#8e44ad';
    }
    
    // Stocker et afficher
    storeScorerPick(matchKey, name);
    updateScorerDisplay(matchKey, name);
    
    // Replier la liste après confirmation
    const picker = document.getElementById(`scorerPicker_${matchKey}`);
    if (picker) {
        setTimeout(() => { picker.style.display = 'none'; }, 300);
    }
}

/**
 * Override selectScorer pour mettre à jour l'affichage
 */
const _origSelectScorer = typeof selectScorer === 'function' ? selectScorer : null;
selectScorer = function(matchKey, scorerName) {
    // Désélectionner tous les boutons
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
        
        // Vider le champ custom et reset son style
        const customInput = document.getElementById(`scorerCustom_${matchKey}`);
        if (customInput) {
            customInput.value = '';
            customInput.style.border = '1px solid #ddd';
            customInput.style.background = '';
            customInput.style.fontWeight = '';
        }
        const okBtn = customInput?.nextElementSibling;
        if (okBtn) {
            okBtn.textContent = '✓ OK';
            okBtn.style.background = '#667eea';
        }
    }
    
    storeScorerPick(matchKey, scorerName);
    updateScorerDisplay(matchKey, scorerName);
    
    // Replier la liste après sélection
    const picker = document.getElementById(`scorerPicker_${matchKey}`);
    if (picker) {
        setTimeout(() => { picker.style.display = 'none'; }, 200);
    }
};

/**
 * Met à jour l'affichage du nom du buteur à côté du toggle
 */
function updateScorerDisplay(matchKey, name) {
    let display = document.getElementById(`scorerDisplay_${matchKey}`);
    
    if (name && display) {
        display.innerHTML = `${name} <span style="font-size:0.65rem;opacity:0.5;">✏️</span>`;
    } else if (name && !display) {
        // Créer le display à côté du checkbox
        const toggle = document.querySelector(`.scorer-toggle[data-match="${matchKey}"]`);
        if (!toggle) return;
        
        display = document.createElement('span');
        display.id = `scorerDisplay_${matchKey}`;
        display.className = 'scorer-pick-display';
        display.style.cssText = 'font-size:0.85rem;font-weight:600;color:#8e44ad;cursor:pointer;display:flex;align-items:center;gap:0.3rem;';
        display.title = 'Cliquer pour modifier';
        display.onclick = () => toggleScorerPicker(matchKey);
        display.innerHTML = `${name} <span style="font-size:0.65rem;opacity:0.5;">✏️</span>`;
        toggle.closest('div').appendChild(display);
    } else if (!name && display) {
        display.style.display = 'none';
    }
}


// ===============================
// 2. MOBILE : TOGGLE EXTRAS
// ===============================

/**
 * Wrap les options extras (buteur, combiné, joker) dans un 
 * conteneur collapsible sur mobile
 */
function wrapExtrasForMobile() {
    // Ne s'applique que sur mobile
    if (window.innerWidth > 768) return;
    
    document.querySelectorAll('.prediction-match').forEach(card => {
        // Vérifier si déjà wrappé
        if (card.querySelector('.extras-wrapper')) return;
        
        // Collecter les extras
        const extras = card.querySelectorAll('.match-extra-option, .joker-slot, .combine-btn-wrapper');
        if (extras.length === 0) return;
        
        // Créer le wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'extras-wrapper';
        wrapper.style.cssText = 'display:none;grid-column:1/-1;order:25;padding-top:0.5rem;border-top:1px dashed #e9ecef;margin-top:0.25rem;';
        
        // Créer le toggle
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'extras-toggle-btn';
        toggleBtn.style.cssText = `
            grid-column:1/-1;order:24;display:flex;align-items:center;justify-content:center;
            gap:0.3rem;padding:0.3rem;background:none;border:1px dashed #bdc3c7;
            border-radius:6px;color:#7f8c8d;font-size:0.75rem;cursor:pointer;margin-top:0.25rem;
            width:100%;
        `;
        
        // Vérifier s'il y a des options actives
        const hasActiveScorer = card.querySelector('.scorer-toggle:checked');
        const hasActiveJoker = card.querySelector('.joker-btn.active');
        const hasActiveCombine = card.querySelector('.combine-btn.active');
        const hasActive = hasActiveScorer || hasActiveJoker || hasActiveCombine;
        
        // Résumé des options actives
        let activeLabel = '';
        if (hasActiveJoker) activeLabel += '🃏 ';
        if (hasActiveScorer) activeLabel += '⚽ ';
        if (hasActiveCombine) activeLabel += '🎲 ';
        
        toggleBtn.innerHTML = hasActive 
            ? `${activeLabel}<span style="opacity:0.6;">▼ Options</span>`
            : '⚽🃏🎲 Options bonus <span style="opacity:0.6;">▼</span>';
        
        // Toujours fermé par défaut — le résumé suffit
        
        toggleBtn.addEventListener('click', () => {
            const isOpen = wrapper.style.display !== 'none';
            wrapper.style.display = isOpen ? 'none' : 'block';
            toggleBtn.innerHTML = toggleBtn.innerHTML.replace(
                isOpen ? '▲' : '▼', 
                isOpen ? '▼' : '▲'
            );
        });
        
        // Déplacer les extras dans le wrapper
        extras.forEach(el => {
            wrapper.appendChild(el);
        });
        
        // Insérer toggle et wrapper APRÈS les suggestions IA / enhancements
        const enhancements = card.querySelector('.match-enhancements');
        const insertAfter = enhancements || card.querySelector('.actual-result') || card.lastElementChild;
        
        if (insertAfter && insertAfter.parentNode === card) {
            insertAfter.insertAdjacentElement('afterend', toggleBtn);
            toggleBtn.insertAdjacentElement('afterend', wrapper);
        } else {
            card.appendChild(toggleBtn);
            card.appendChild(wrapper);
        }
    });
}

// Observer les changements de taille d'écran
let _lastScreenWidth = window.innerWidth;
window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    if ((_lastScreenWidth <= 768 && newWidth > 768) || (_lastScreenWidth > 768 && newWidth <= 768)) {
        _lastScreenWidth = newWidth;
        // Rafraîchir si on passe mobile ↔ desktop
        if (typeof displayPredictionsForm === 'function') {
            displayPredictionsForm();
        }
    }
});


// ===============================
// 3. JOKERS : EXCLUSION MUTUELLE UI
// ===============================

/**
 * Override renderJokerButton pour masquer si Super Joker actif
 */
const _origRenderJokerButton = typeof renderJokerButton === 'function' ? renderJokerButton : null;

renderJokerButton = function(matchEl, jokers, matchDay, homeTeamId, awayTeamId, isLocked) {
    const hasJoker = isJokerOnMatch(jokers, matchDay, homeTeamId, awayTeamId);
    
    // Si Super Joker actif sur cette journée → masquer les jokers individuels
    if (typeof getSuperJoker === 'function' && currentPlayer && currentSeason) {
        // On ne peut pas await ici (sync), donc on vérifie le cache localStorage
        const storageKey = `footballEloSuperJoker_${currentPlayer.id}_${currentSeason}`;
        try {
            const sjData = JSON.parse(localStorage.getItem(storageKey) || 'null');
            if (sjData && sjData.used && sjData.matchDay === matchDay) {
                if (hasJoker) {
                    // Un joker individuel est resté actif → ne pas afficher (ne devrait pas arriver)
                    return '';
                }
                return ''; // Masquer les boutons joker individuels
            }
        } catch (e) {}
    }
    
    // Comportement normal
    if (_origRenderJokerButton) {
        return _origRenderJokerButton(matchEl, jokers, matchDay, homeTeamId, awayTeamId, isLocked);
    }
    return '';
};

/**
 * Override renderSuperJokerBanner pour masquer si joker individuel actif
 */
const _origRenderSuperJokerBanner = typeof renderSuperJokerBanner === 'function' ? renderSuperJokerBanner : null;

renderSuperJokerBanner = async function(playerId, season, matchDay) {
    const superJoker = await getSuperJoker(playerId, season);
    const isActive = isSuperJokerActive(superJoker, matchDay);
    const isAvailable = isSuperJokerAvailable(superJoker);
    
    // Si pas actif et pas disponible → afficher normalement (déjà utilisé ailleurs)
    if (!isActive && !isAvailable) {
        if (_origRenderSuperJokerBanner) return _origRenderSuperJokerBanner(playerId, season, matchDay);
        return '';
    }
    
    // Si un joker individuel est déjà actif sur cette journée → masquer le Super Joker
    if (!isActive && isAvailable) {
        if (typeof getPlayerJokers === 'function') {
            const jokers = await getPlayerJokers(playerId, season);
            const hasIndividual = jokers.used.some(j => j.matchDay === matchDay);
            if (hasIndividual) {
                // Ne pas afficher le Super Joker du tout — l'utilisateur voit ses jokers individuels
                return `
                    <div style="margin-bottom:0.5rem;padding:0.5rem 0.75rem;border-radius:8px;
                                background:#ecf0f1;font-size:0.8rem;color:#95a5a6;
                                display:flex;align-items:center;gap:0.5rem;">
                        <span>🃏✨</span>
                        <span>Super Joker non disponible (joker individuel actif sur cette journée)</span>
                    </div>
                `;
            }
        }
    }
    
    // Sinon comportement normal
    if (_origRenderSuperJokerBanner) return _origRenderSuperJokerBanner(playerId, season, matchDay);
    return '';
};

/**
 * Après activation/désactivation du Super Joker, refresh la page
 * pour masquer/afficher les jokers individuels
 */
const _origHandleToggleSuperJoker = typeof handleToggleSuperJoker === 'function' ? handleToggleSuperJoker : null;

handleToggleSuperJoker = async function(matchDay) {
    if (_origHandleToggleSuperJoker) {
        await _origHandleToggleSuperJoker(matchDay);
    }
    // Le displayPredictionsForm est déjà appelé dans l'original,
    // ce qui va re-render les jokers masqués/visibles
};


// ===============================
// 4. HOOK POST-RENDER
// ===============================

/**
 * Hook qui s'exécute après chaque displayPredictionsForm
 * pour appliquer le wrapping mobile
 */
const _origEnhanceMatchCards = typeof enhanceMatchCardsWithConsensus === 'function' 
    ? enhanceMatchCardsWithConsensus : null;

if (_origEnhanceMatchCards) {
    enhanceMatchCardsWithConsensus = async function() {
        await _origEnhanceMatchCards();
        
        // Après que les suggestions IA sont ajoutées, wrapper les extras sur mobile
        setTimeout(() => {
            wrapExtrasForMobile();
        }, 100);
    };
} else {
    // Si pas de consensus, hook sur un MutationObserver
    const _patchObserver = new MutationObserver(() => {
        const container = document.getElementById('predictionsContainer');
        if (container && container.children.length > 0) {
            setTimeout(() => wrapExtrasForMobile(), 200);
        }
    });
    
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('predictionsContainer');
        if (container) {
            _patchObserver.observe(container, { childList: true });
        }
    });
}


// ===============================
// 5. CSS INJECTION
// ===============================

(function injectPatchCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Buteur pick display - toujours visible */
        .scorer-pick-display {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 150px;
        }
        
        /* Mobile extras toggle */
        @media (max-width: 768px) {
            .extras-toggle-btn:active {
                background: #ecf0f1 !important;
            }
            
            .extras-wrapper {
                animation: fadeIn 0.2s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            /* Rendre les extras plus compacts sur mobile */
            .scorer-challenge {
                font-size: 0.85rem;
            }
            
            .scorer-btn {
                font-size: 0.7rem !important;
                padding: 0.15rem 0.4rem !important;
            }
            
            /* Marquer les options extras */
            .match-extra-option {
                grid-column: 1 / -1;
            }
            
            /* Bouton Combiné : pleine largeur en dessous sur mobile */
            .prediction-match .combine-btn {
                position: static !important;
                grid-column: 1 / -1;
                order: 22;
                width: 100%;
                display: block;
                text-align: center;
                margin-top: 0.25rem;
                padding: 0.3rem 0.5rem !important;
                font-size: 0.8rem !important;
                border-radius: 8px !important;
            }
        }
        
        /* Desktop : extras visibles normalement */
        @media (min-width: 769px) {
            .extras-toggle-btn {
                display: none !important;
            }
            
            .extras-wrapper {
                display: block !important;
            }
        }
    `;
    document.head.appendChild(style);
})();

console.log('🔧 Patch UX chargé — buteur persistant, mobile toggle, exclusion jokers');