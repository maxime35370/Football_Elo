// =====================================================
// 📊 RANKING BET - VIEW (affichage)
// =====================================================
// Responsabilité : rendu HTML, drag & drop (desktop + mobile)
// Ne fait JAMAIS d'appels Firebase
// Reçoit les données du Controller
// =====================================================

// Ordre actuel dans l'UI (partagé avec Controller)
var _rankingBetOrder = [];

// ===============================
// RENDU ITEM ÉQUIPE
// ===============================

/**
 * Génère le HTML d'un item équipe dans la liste
 */
function renderRankingBetItem(teamId, pos, data) {
    const { team, cote, prob, currentPos, savedOdds, seasonFinished } = data;

    const diff = currentPos - pos;
    const diffStr = diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : '=';
    const diffColor = diff > 0 ? '#27ae60' : diff < 0 ? '#e74c3c' : '#95a5a6';
    const coteColor = cote <= 2 ? '#27ae60' : cote <= 5 ? '#f39c12' : cote <= 15 ? '#e67e22' : '#e74c3c';

    return `
        <div class="ranking-bet-item" draggable="${!seasonFinished}" data-team-id="${teamId}" 
             style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;
                    background:white;border:1px solid #e9ecef;border-radius:8px;
                    cursor:${seasonFinished ? 'default' : 'grab'};user-select:none;
                    transition:transform 0.15s,box-shadow 0.15s;">
            <span style="font-weight:bold;min-width:28px;color:#7f8c8d;">${pos}.</span>
            <span style="flex:1;font-weight:600;color:#2c3e50;">${team?.shortName || '?'}</span>
            <span style="font-size:0.75rem;color:${diffColor};min-width:30px;text-align:center;">${diffStr}</span>
            <span style="font-size:0.8rem;color:${coteColor};font-weight:bold;min-width:45px;text-align:right;" 
                  title="${Math.round(prob * 100)}% de probabilité">
                ×${cote.toFixed(1)}
            </span>
            ${savedOdds ? `<span style="font-size:0.7rem;color:#95a5a6;min-width:45px;text-align:right;" title="Côte verrouillée">(×${savedOdds.toFixed(1)})</span>` : ''}
        </div>
    `;
}

// ===============================
// RENDU PAGE COMPLÈTE
// ===============================

/**
 * Génère le HTML complet de l'interface ranking bet
 * @param {Object} data - { odds, probabilities, matchDayContext, existingBet, currentRanking, seasonFinished }
 * @returns {string} HTML
 */
function renderRankingBetHTML(data) {
    const { odds, probabilities, matchDayContext, existingBet, currentRanking, seasonFinished } = data;

    let html = `<div style="margin-bottom:1rem;">`;

    // Header
    html += `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
            <h3 style="margin:0;color:#2c3e50;">📊 Pronostic Classement Final</h3>
            <div style="font-size:0.85rem;color:#7f8c8d;">
                Journée ${matchDayContext} · ${allTeams.length} équipes
            </div>
        </div>
    `;

    // Bandeau info
    if (existingBet) {
        const modCount = existingBet.modificationCount || 0;
        html += `
            <div style="background:#f39c1210;border:1px solid #f39c1240;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.85rem;margin-bottom:0.75rem;">
                ⚠️ Prédiction existante (J${existingBet.matchDayContext || '?'})
                ${modCount > 0 ? `· ${modCount} modification(s)` : ''}
                · <strong>Modifier = nouvelles côtes (potentiellement moins avantageuses)</strong>
            </div>
        `;
    } else {
        html += `
            <div style="background:#27ae6010;border:1px solid #27ae6040;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.85rem;margin-bottom:0.75rem;">
                🆕 Glisse les équipes pour prédire le classement final.
                Les côtes actuelles seront verrouillées au moment de ta sauvegarde.
            </div>
        `;
    }

    // Légende
    html += `
        <div style="display:flex;gap:1rem;font-size:0.8rem;color:#7f8c8d;margin-bottom:0.75rem;flex-wrap:wrap;">
            <span>🟢 Côte basse = facile (peu de pts)</span>
            <span>🟡 Côte moyenne</span>
            <span>🔴 Côte haute = risqué (beaucoup de pts)</span>
        </div>
    `;

    // Liste drag & drop
    html += `<div id="rankingBetList" class="ranking-bet-list" style="display:flex;flex-direction:column;gap:2px;">`;

    _rankingBetOrder.forEach((teamId, index) => {
        const pos = index + 1;
        const team = allTeams.find(t => t.id == teamId);
        const cote = odds[teamId]?.[pos] || 1;
        const prob = probabilities[teamId]?.[pos] || 0;
        const savedOdds = existingBet?.oddsSnapshot?.[teamId]?.[pos];
        const currentPos = currentRanking.findIndex(t => t.id == teamId) + 1;

        html += renderRankingBetItem(teamId, pos, {
            team, cote, prob, currentPos, savedOdds, seasonFinished
        });
    });

    html += '</div>';

    // Boutons
    if (!seasonFinished) {
        html += `
            <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                <button onclick="saveRankingBetFromUI()" style="
                    padding:0.6rem 1.2rem;background:linear-gradient(135deg,#667eea,#764ba2);
                    color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:0.9rem;">
                    💾 ${existingBet ? 'Modifier ma prédiction' : 'Sauvegarder ma prédiction'}
                </button>
                <button onclick="resetRankingBetToDefault()" style="
                    padding:0.6rem 1.2rem;background:#ecf0f1;color:#7f8c8d;
                    border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;">
                    ↩️ Remettre le classement actuel
                </button>
                <button onclick="sortRankingBetByOdds()" style="
                    padding:0.6rem 1.2rem;background:#ecf0f1;color:#7f8c8d;
                    border:none;border-radius:8px;cursor:pointer;font-size:0.9rem;">
                    📊 Trier par probabilité
                </button>
            </div>
        `;
    }

    // Résultats si saison terminée
    if (seasonFinished && existingBet) {
        const results = calculateRankingBetResults(existingBet, currentRanking);
        html += renderRankingBetResults(results);
    }

    // Gains potentiels
    if (existingBet) {
        html += renderPotentialGains(existingBet, odds);
    }

    html += '</div>';

    return html;
}

// ===============================
// RENDU RÉSULTATS (FIN DE SAISON)
// ===============================

function renderRankingBetResults(results) {
    if (!results || results.details.length === 0) return '';

    let html = `
        <div style="margin-top:1.5rem;padding:1rem;background:linear-gradient(135deg,#667eea10,#764ba210);
                    border:2px solid #667eea;border-radius:12px;">
            <h4 style="margin:0 0 0.75rem;color:#667eea;">
                📊 Résultats — ${results.totalPoints} pts
            </h4>
            <div style="display:flex;flex-direction:column;gap:3px;font-size:0.85rem;">
    `;

    results.details.forEach(d => {
        const bgColor = d.offset === 0 ? '#27ae6015' : d.offset === 1 ? '#f39c1215' : d.offset <= 3 ? '#3498db10' : '#e74c3c10';
        html += `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.5rem;background:${bgColor};border-radius:6px;">
                <span style="min-width:28px;font-weight:bold;color:#7f8c8d;">${d.predictedPos}.</span>
                <span style="flex:1;">${d.teamName}</span>
                <span style="color:#7f8c8d;font-size:0.8rem;">Réel: ${d.finalPos}e</span>
                <span style="font-size:0.8rem;">${d.label}</span>
                <span style="font-weight:bold;min-width:50px;text-align:right;">
                    ${d.points > 0 ? `+${d.points}` : '0'}
                </span>
            </div>
        `;
    });

    const exacts = results.details.filter(d => d.offset === 0).length;
    const close = results.details.filter(d => d.offset === 1).length;
    const near = results.details.filter(d => d.offset >= 2 && d.offset <= 3).length;
    const missed = results.details.filter(d => d.offset > 3).length;

    html += `
            </div>
            <div style="display:flex;gap:1rem;margin-top:0.75rem;font-size:0.85rem;flex-wrap:wrap;
                        padding-top:0.75rem;border-top:1px solid #667eea30;">
                <span>🏆 ${exacts} exact(s)</span>
                <span>🎯 ${close} ±1</span>
                <span>📍 ${near} ±2-3</span>
                <span>❌ ${missed} raté(s)</span>
            </div>
        </div>
    `;

    return html;
}

// ===============================
// RENDU GAINS POTENTIELS
// ===============================

function renderPotentialGains(bet, currentOdds) {
    if (!bet || !bet.predictions) return '';

    let totalIfPerfect = 0;
    let totalRealistic = 0;

    bet.predictions.forEach(pred => {
        const lockedOdds = bet.oddsSnapshot?.[pred.teamId]?.[pred.predictedPosition] || 1;
        totalIfPerfect += lockedOdds * RANKING_BET_CONFIG.scoring.exact;
        totalRealistic += lockedOdds * (
            0.3 * RANKING_BET_CONFIG.scoring.exact +
            0.3 * RANKING_BET_CONFIG.scoring.off1 +
            0.2 * RANKING_BET_CONFIG.scoring.off2_3
        );
    });

    return `
        <div style="margin-top:1rem;padding:0.75rem;background:#f8f9fa;border-radius:8px;font-size:0.85rem;">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
                <span>💰 Gain si tout parfait : <strong>${Math.round(totalIfPerfect * 10) / 10} pts</strong></span>
                <span>📈 Estimation réaliste : <strong>~${Math.round(totalRealistic * 10) / 10} pts</strong></span>
                <span id="potentialGainDisplay"></span>
            </div>
        </div>
    `;
}

// ===============================
// RENDU LEADERBOARD
// ===============================

async function renderRankingBetLeaderboard(season) {
    const leaderboard = await getRankingBetLeaderboard(season);

    if (leaderboard.length === 0) {
        return '<p style="text-align:center;color:#95a5a6;">Aucune prédiction de classement</p>';
    }

    let html = '<div style="display:flex;flex-direction:column;gap:0.4rem;">';

    leaderboard.forEach((player, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const isMe = currentPlayer && player.playerId === currentPlayer.id;

        html += `
            <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;
                        background:${isMe ? '#3498db10' : '#f8f9fa'};border-radius:8px;
                        ${i === 0 ? 'border-left:4px solid #f1c40f;' : ''}">
                <span style="font-weight:bold;min-width:30px;">${medal}</span>
                <span style="flex:1;font-weight:${i < 3 ? 'bold' : 'normal'};">${player.pseudo}</span>
                <span style="font-size:0.8rem;color:#7f8c8d;">${player.exacts}🏆 ${player.close}🎯</span>
                <span style="font-weight:bold;color:#667eea;">${player.totalPoints} pts</span>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

// ===============================
// REFRESH LISTE APRÈS DRAG
// ===============================

function refreshRankingBetList() {
    const container = document.getElementById('rankingBetList');
    if (!container) return;

    const { odds, probabilities } = getCurrentOdds();
    const currentRanking = generateRankingForBet();

    container.innerHTML = '';

    _rankingBetOrder.forEach((teamId, index) => {
        const pos = index + 1;
        const team = allTeams.find(t => t.id == teamId);
        const cote = odds[teamId]?.[pos] || 1;
        const prob = probabilities[teamId]?.[pos] || 0;
        const currentPos = currentRanking.findIndex(t => t.id == teamId) + 1;
        const coteColor = cote <= 2 ? '#27ae60' : cote <= 5 ? '#f39c12' : cote <= 15 ? '#e67e22' : '#e74c3c';
        const diff = currentPos - pos;
        const diffStr = diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : '=';
        const diffColor = diff > 0 ? '#27ae60' : diff < 0 ? '#e74c3c' : '#95a5a6';

        const itemDiv = document.createElement('div');
        itemDiv.className = 'ranking-bet-item';
        itemDiv.draggable = true;
        itemDiv.dataset.teamId = teamId;
        itemDiv.style.cssText = `display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:white;border:1px solid #e9ecef;border-radius:8px;cursor:grab;user-select:none;transition:transform 0.15s,box-shadow 0.15s;`;

        itemDiv.innerHTML = `
            <span style="font-weight:bold;min-width:28px;color:#7f8c8d;">${pos}.</span>
            <span style="flex:1;font-weight:600;color:#2c3e50;">${team?.shortName || '?'}</span>
            <span style="font-size:0.75rem;color:${diffColor};min-width:30px;text-align:center;">${diffStr}</span>
            <span style="font-size:0.8rem;color:${coteColor};font-weight:bold;min-width:45px;text-align:right;" 
                  title="${Math.round(prob * 100)}% de probabilité">
                ×${cote.toFixed(1)}
            </span>
        `;

        container.appendChild(itemDiv);
    });

    initDragAndDrop();
    updatePotentialGainDisplay();
}

/**
 * Met à jour le gain potentiel en direct
 */
function updatePotentialGainDisplay() {
    const display = document.getElementById('potentialGainDisplay');
    if (!display) return;

    const { odds } = getCurrentOdds();
    let totalPotential = 0;

    _rankingBetOrder.forEach((teamId, index) => {
        const pos = index + 1;
        const cote = odds[teamId]?.[pos] || 1;
        totalPotential += cote * RANKING_BET_CONFIG.scoring.exact;
    });

    display.textContent = `${Math.round(totalPotential * 10) / 10} pts`;
}

// ===============================
// DRAG & DROP — DESKTOP
// ===============================

function initDragAndDrop() {
    const list = document.getElementById('rankingBetList');
    if (!list) return;

    let draggedItem = null;
    let draggedIndex = -1;

    list.querySelectorAll('.ranking-bet-item').forEach((item, index) => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            draggedIndex = index;
            item.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            draggedItem = null;
            list.querySelectorAll('.ranking-bet-item').forEach(el => {
                el.style.borderTop = ''; el.style.borderBottom = '';
            });
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            list.querySelectorAll('.ranking-bet-item').forEach(el => {
                el.style.borderTop = ''; el.style.borderBottom = '';
            });
            if (e.clientY < midY) item.style.borderTop = '3px solid #667eea';
            else item.style.borderBottom = '3px solid #667eea';
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!draggedItem || draggedItem === item) return;

            const dropIndex = Array.from(list.children).indexOf(item);
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const insertBefore = e.clientY < midY;

            const movedTeamId = _rankingBetOrder[draggedIndex];
            _rankingBetOrder.splice(draggedIndex, 1);

            const targetIndex = insertBefore ? dropIndex : dropIndex + 1;
            const adjustedIndex = draggedIndex < dropIndex ? targetIndex - 1 : targetIndex;
            _rankingBetOrder.splice(adjustedIndex, 0, movedTeamId);

            refreshRankingBetList();
        });
    });

    initTouchDragAndDrop(list);
}

// ===============================
// DRAG & DROP — MOBILE (TACTILE)
// ===============================

function initTouchDragAndDrop(list) {
    let touchItem = null;
    let touchStartY = 0;
    let touchClone = null;
    let touchStartIndex = -1;

    list.querySelectorAll('.ranking-bet-item').forEach((item, index) => {
        item.addEventListener('touchstart', (e) => {
            touchItem = item;
            touchStartIndex = index;
            touchStartY = e.touches[0].clientY;

            touchClone = item.cloneNode(true);
            touchClone.style.position = 'fixed';
            touchClone.style.zIndex = '9999';
            touchClone.style.opacity = '0.8';
            touchClone.style.pointerEvents = 'none';
            touchClone.style.width = item.offsetWidth + 'px';
            touchClone.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            document.body.appendChild(touchClone);

            item.style.opacity = '0.3';
        }, { passive: true });

        item.addEventListener('touchmove', (e) => {
            if (!touchClone) return;
            e.preventDefault();

            const touchY = e.touches[0].clientY;
            touchClone.style.top = (touchY - 20) + 'px';
            touchClone.style.left = item.getBoundingClientRect().left + 'px';

            const elements = list.querySelectorAll('.ranking-bet-item');
            elements.forEach(el => { el.style.borderTop = ''; el.style.borderBottom = ''; });

            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (touchY > rect.top && touchY < rect.bottom) {
                    const midY = rect.top + rect.height / 2;
                    if (touchY < midY) el.style.borderTop = '3px solid #667eea';
                    else el.style.borderBottom = '3px solid #667eea';
                }
            });
        }, { passive: false });

        item.addEventListener('touchend', (e) => {
            if (!touchClone) return;

            const touchY = e.changedTouches[0].clientY;
            let dropIndex = touchStartIndex;

            const elements = list.querySelectorAll('.ranking-bet-item');
            elements.forEach((el, i) => {
                const rect = el.getBoundingClientRect();
                if (touchY > rect.top && touchY < rect.bottom) {
                    const midY = rect.top + rect.height / 2;
                    dropIndex = touchY < midY ? i : i + 1;
                }
                el.style.borderTop = ''; el.style.borderBottom = '';
            });

            if (dropIndex !== touchStartIndex) {
                const movedTeamId = _rankingBetOrder[touchStartIndex];
                _rankingBetOrder.splice(touchStartIndex, 1);
                const adjusted = touchStartIndex < dropIndex ? dropIndex - 1 : dropIndex;
                _rankingBetOrder.splice(adjusted, 0, movedTeamId);
                refreshRankingBetList();
            }

            if (touchClone.parentNode) touchClone.parentNode.removeChild(touchClone);
            touchClone = null;
            if (touchItem) touchItem.style.opacity = '1';
            touchItem = null;
        });
    });
}

console.log('🎨 Module ranking-bet-view chargé');