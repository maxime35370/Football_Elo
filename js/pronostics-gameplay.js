// pronostics-gameplay.js - Joker, Équipe favorite, Avatar

// ===============================
// SYSTÈME DE JOKER
// ===============================

const JOKER_CONFIG = {
    multiplier: 2,           // x2 sur le match choisi
    maxPerSeason: 5,         // 5 jokers par saison
    maxPerMatchDay: 1,       // 1 joker par journée max
    unlockAtPoints: 20       // Débloqué après 20 pts
};

async function getPlayerJokers(playerId, season) {
    const storageKey = `footballEloJokers_${playerId}_${season}`;
    
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {}
    
    // Initialiser
    return {
        remaining: JOKER_CONFIG.maxPerSeason,
        used: [],
        history: []
    };
}

async function savePlayerJokers(playerId, season, jokerData) {
    const storageKey = `footballEloJokers_${playerId}_${season}`;
    localStorage.setItem(storageKey, JSON.stringify(jokerData));
    
    // Sync Firebase si disponible
    if (typeof db !== 'undefined') {
        try {
            await db.collection('pronostiqueurs').doc(playerId).update({
                [`jokers_${season}`]: jokerData
            });
        } catch (e) {
            console.warn('Erreur sync jokers Firebase:', e);
        }
    }
}

async function useJoker(playerId, season, matchDay, homeTeamId, awayTeamId) {
    const jokers = await getPlayerJokers(playerId, season);
    
    // Vérifications
    if (jokers.remaining <= 0) {
        return { success: false, error: 'Plus de jokers disponibles cette saison' };
    }
    
    const usedThisDay = jokers.used.filter(j => j.matchDay === matchDay);
    if (usedThisDay.length >= JOKER_CONFIG.maxPerMatchDay) {
        return { success: false, error: 'Joker déjà utilisé sur cette journée' };
    }
    
    // Utiliser le joker
    jokers.remaining--;
    jokers.used.push({
        matchDay: matchDay,
        homeTeamId: homeTeamId,
        awayTeamId: awayTeamId,
        usedAt: new Date().toISOString()
    });
    
    await savePlayerJokers(playerId, season, jokers);
    
    return { success: true, remaining: jokers.remaining };
}

async function removeJoker(playerId, season, matchDay, homeTeamId, awayTeamId) {
    const jokers = await getPlayerJokers(playerId, season);
    
    const index = jokers.used.findIndex(j => 
        j.matchDay === matchDay && 
        j.homeTeamId === homeTeamId && 
        j.awayTeamId === awayTeamId
    );
    
    if (index === -1) {
        return { success: false, error: 'Joker non trouvé' };
    }
    
    jokers.used.splice(index, 1);
    jokers.remaining++;
    
    await savePlayerJokers(playerId, season, jokers);
    
    return { success: true, remaining: jokers.remaining };
}

function isJokerOnMatch(jokers, matchDay, homeTeamId, awayTeamId) {
    return jokers.used.some(j => 
        j.matchDay === matchDay && 
        j.homeTeamId === homeTeamId && 
        j.awayTeamId === awayTeamId
    );
}

function renderJokerButton(matchEl, jokers, matchDay, homeTeamId, awayTeamId, isLocked) {
    const hasJoker = isJokerOnMatch(jokers, matchDay, homeTeamId, awayTeamId);
    const canUseJoker = jokers.remaining > 0 && !isLocked;
    const usedThisDay = jokers.used.filter(j => j.matchDay === matchDay).length;
    const canAddMore = usedThisDay < JOKER_CONFIG.maxPerMatchDay;
    
    if (isLocked && !hasJoker) return '';
    
    if (hasJoker) {
        return `
            <button class="joker-btn active" 
                    onclick="toggleJoker(${matchDay}, ${homeTeamId}, ${awayTeamId})"
                    ${isLocked ? 'disabled' : ''}>
                🃏 x${JOKER_CONFIG.multiplier} ${isLocked ? '(verrouillé)' : '(retirer)'}
            </button>
        `;
    }
    
    if (!canUseJoker || !canAddMore) return '';
    
    return `
        <button class="joker-btn" 
                onclick="toggleJoker(${matchDay}, ${homeTeamId}, ${awayTeamId})"
                title="Doubler les points sur ce match">
            🃏 Joker
        </button>
    `;
}

async function toggleJoker(matchDay, homeTeamId, awayTeamId) {
    if (!currentPlayer || !currentSeason) return;
    
    // Vérifier si le Super Joker bloque les jokers individuels
    if (typeof canUseIndividualJoker === 'function') {
        const check = await canUseIndividualJoker(currentPlayer.id, currentSeason, matchDay);
        if (!check.allowed) {
            alert(check.reason);
            return;
        }
    }
    
    const jokers = await getPlayerJokers(currentPlayer.id, currentSeason);
    const hasJoker = isJokerOnMatch(jokers, matchDay, homeTeamId, awayTeamId);
    
    let result;
    if (hasJoker) {
        result = await removeJoker(currentPlayer.id, currentSeason, matchDay, homeTeamId, awayTeamId);
    } else {
        result = await useJoker(currentPlayer.id, currentSeason, matchDay, homeTeamId, awayTeamId);
    }
    
    if (result.success) {
        // Rafraîchir l'affichage
        displayPredictionsForm();
        updateJokerCounter();
    } else {
        alert(result.error);
    }
}

function updateJokerCounter() {
    const counter = document.getElementById('jokerCounter');
    if (!counter || !currentPlayer || !currentSeason) return;
    
    getPlayerJokers(currentPlayer.id, currentSeason).then(jokers => {
        counter.textContent = `🃏 ${jokers.remaining}/${JOKER_CONFIG.maxPerSeason}`;
        counter.title = `${jokers.remaining} joker(s) restant(s) cette saison`;
    });
}

function renderJokerCounter() {
    return `<span id="jokerCounter" class="joker-counter">🃏 -/-</span>`;
}

// ===============================
// ÉQUIPE FAVORITE
// ===============================

async function getPlayerFavoriteTeam(playerId) {
    try {
        // Essayer Firebase
        if (typeof db !== 'undefined') {
            const doc = await db.collection('pronostiqueurs').doc(playerId).get();
            if (doc.exists && doc.data().favoriteTeam) {
                return doc.data().favoriteTeam;
            }
        }
        
        // Fallback localStorage
        const stored = localStorage.getItem(`footballEloFavoriteTeam_${playerId}`);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

async function setPlayerFavoriteTeam(playerId, teamId) {
    // Sauvegarder en local
    localStorage.setItem(`footballEloFavoriteTeam_${playerId}`, JSON.stringify(teamId));
    
    // Sync Firebase
    if (typeof db !== 'undefined') {
        try {
            await db.collection('pronostiqueurs').doc(playerId).update({
                favoriteTeam: teamId
            });
        } catch (e) {
            console.warn('Erreur sync favoriteTeam Firebase:', e);
        }
    }
}

async function calculateFavoriteTeamStats(playerId, teamId) {
    const stats = {
        teamId: teamId,
        predictions: 0,
        correct: 0,
        exactScores: 0,
        points: 0
    };
    
    try {
        const history = await getPlayerHistory(playerId);
        
        for (const entry of history) {
            const matchesThisDay = allMatches.filter(m => m.matchDay === entry.matchDay && m.finalScore);
            
            for (const pred of entry.predictions) {
                // Vérifier si le match concerne l'équipe favorite
                if (pred.homeTeamId != teamId && pred.awayTeamId != teamId) continue;
                
                const match = matchesThisDay.find(m => 
                    m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
                );
                
                if (!match) continue;
                
                stats.predictions++;
                
                const result = calculatePredictionResult(
                    pred.homeScore, pred.awayScore,
                    match.finalScore.home, match.finalScore.away,
                    pred.savedAt, match, pred.odds
                );
                
                stats.points += result.finalPoints || result.points;
                
                if (result.points > 0) stats.correct++;
                if (result.points === 9) stats.exactScores++;
            }
        }
    } catch (e) {
        console.error('Erreur calcul stats équipe favorite:', e);
    }
    
    stats.accuracy = stats.predictions > 0 
        ? Math.round((stats.correct / stats.predictions) * 100) 
        : 0;
    
    return stats;
}

function renderFavoriteTeamSelector(currentFavorite) {
    const teams = allTeams || [];
    
    return `
        <div class="favorite-team-selector">
            <label>💙 Équipe favorite :</label>
            <select id="favoriteTeamSelect" onchange="changeFavoriteTeam(this.value)">
                <option value="">-- Aucune --</option>
                ${teams.map(t => `
                    <option value="${t.id}" ${currentFavorite == t.id ? 'selected' : ''}>
                        ${t.shortName || t.name}
                    </option>
                `).join('')}
            </select>
        </div>
    `;
}

async function changeFavoriteTeam(teamId) {
    if (!currentPlayer) return;
    
    await setPlayerFavoriteTeam(currentPlayer.id, teamId || null);
    
    // Rafraîchir l'affichage si nécessaire
    if (typeof renderPlayerProfile === 'function') {
        renderPlayerProfile();
    }
}

async function renderFavoriteTeamStats(playerId) {
    const favoriteTeamId = await getPlayerFavoriteTeam(playerId);
    
    if (!favoriteTeamId) {
        return `
            <div class="favorite-team-empty">
                <p>Aucune équipe favorite sélectionnée</p>
                ${renderFavoriteTeamSelector(null)}
            </div>
        `;
    }
    
    const team = allTeams.find(t => t.id == favoriteTeamId);
    const stats = await calculateFavoriteTeamStats(playerId, favoriteTeamId);
    
    return `
        <div class="favorite-team-card">
            <div class="favorite-team-header">
                <span class="favorite-team-icon">💙</span>
                <span class="favorite-team-name">${team?.shortName || team?.name || '?'}</span>
            </div>
            <div class="favorite-team-stats">
                <div class="stat">
                    <span class="value">${stats.predictions}</span>
                    <span class="label">Pronos</span>
                </div>
                <div class="stat">
                    <span class="value">${stats.accuracy}%</span>
                    <span class="label">Réussite</span>
                </div>
                <div class="stat">
                    <span class="value">${stats.exactScores}</span>
                    <span class="label">Exacts</span>
                </div>
                <div class="stat">
                    <span class="value">${Math.round(stats.points * 10) / 10}</span>
                    <span class="label">Points</span>
                </div>
            </div>
            ${renderFavoriteTeamSelector(favoriteTeamId)}
        </div>
    `;
}

// ===============================
// PERSONNALISATION AVATAR
// ===============================

const AVATARS = [
    { id: 'default', icon: '👤', name: 'Par défaut', unlocked: true },
    { id: 'soccer', icon: '⚽', name: 'Ballon', unlocked: true },
    { id: 'trophy', icon: '🏆', name: 'Trophée', requiredPoints: 100 },
    { id: 'star', icon: '⭐', name: 'Étoile', requiredPoints: 200 },
    { id: 'crown', icon: '👑', name: 'Couronne', requiredPoints: 500 },
    { id: 'fire', icon: '🔥', name: 'Flamme', requiredStreak: 5 },
    { id: 'diamond', icon: '💎', name: 'Diamant', requiredPoints: 1000 },
    { id: 'robot', icon: '🤖', name: 'Robot', requiredExacts: 10 },
    { id: 'wizard', icon: '🧙', name: 'Magicien', requiredExacts: 25 },
    { id: 'alien', icon: '👽', name: 'Alien', requiredPoints: 2000 },
    { id: 'ninja', icon: '🥷', name: 'Ninja', requiredStreak: 10 },
    { id: 'goat', icon: '🐐', name: 'GOAT', requiredPoints: 5000 }
];

async function getPlayerAvatar(playerId) {
    try {
        if (typeof db !== 'undefined') {
            const doc = await db.collection('pronostiqueurs').doc(playerId).get();
            if (doc.exists && doc.data().avatar) {
                return doc.data().avatar;
            }
        }
        
        const stored = localStorage.getItem(`footballEloAvatar_${playerId}`);
        return stored || 'default';
    } catch (e) {
        return 'default';
    }
}

async function setPlayerAvatar(playerId, avatarId) {
    localStorage.setItem(`footballEloAvatar_${playerId}`, avatarId);
    
    if (typeof db !== 'undefined') {
        try {
            await db.collection('pronostiqueurs').doc(playerId).update({
                avatar: avatarId
            });
        } catch (e) {
            console.warn('Erreur sync avatar Firebase:', e);
        }
    }
}

function getUnlockedAvatars(stats) {
    return AVATARS.map(avatar => {
        let unlocked = avatar.unlocked || false;
        let progress = 100;
        let requirement = '';
        
        if (avatar.requiredPoints) {
            unlocked = stats.totalPoints >= avatar.requiredPoints;
            progress = Math.min(100, Math.round((stats.totalPoints / avatar.requiredPoints) * 100));
            requirement = `${stats.totalPoints}/${avatar.requiredPoints} pts`;
        }
        
        if (avatar.requiredStreak) {
            unlocked = stats.bestStreak >= avatar.requiredStreak;
            progress = Math.min(100, Math.round((stats.bestStreak / avatar.requiredStreak) * 100));
            requirement = `${stats.bestStreak}/${avatar.requiredStreak} série`;
        }
        
        if (avatar.requiredExacts) {
            unlocked = stats.exactScores >= avatar.requiredExacts;
            progress = Math.min(100, Math.round((stats.exactScores / avatar.requiredExacts) * 100));
            requirement = `${stats.exactScores}/${avatar.requiredExacts} exacts`;
        }
        
        return {
            ...avatar,
            unlocked,
            progress,
            requirement
        };
    });
}

async function renderAvatarSelector(playerId, stats) {
    const currentAvatar = await getPlayerAvatar(playerId);
    const avatars = getUnlockedAvatars(stats);
    
    return `
        <div class="avatar-selector">
            <h4>🎭 Choisir son avatar</h4>
            <div class="avatar-grid">
                ${avatars.map(avatar => `
                    <div class="avatar-option ${avatar.unlocked ? '' : 'locked'} ${currentAvatar === avatar.id ? 'selected' : ''}"
                         onclick="${avatar.unlocked ? `selectAvatar('${avatar.id}')` : ''}"
                         title="${avatar.unlocked ? avatar.name : avatar.requirement}">
                        <span class="avatar-icon">${avatar.icon}</span>
                        ${!avatar.unlocked ? `
                            <div class="avatar-lock">🔒</div>
                            <div class="avatar-progress" style="width: ${avatar.progress}%"></div>
                        ` : ''}
                        <span class="avatar-name">${avatar.name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function selectAvatar(avatarId) {
    if (!currentPlayer) return;
    
    await setPlayerAvatar(currentPlayer.id, avatarId);
    
    // Mettre à jour l'affichage
    const avatarEl = document.querySelector('.player-avatar');
    if (avatarEl) {
        const avatar = AVATARS.find(a => a.id === avatarId);
        avatarEl.textContent = avatar?.icon || '👤';
    }
    
    // Fermer le sélecteur si dans une modal
    const selector = document.querySelector('.avatar-selector');
    if (selector) {
        selector.querySelectorAll('.avatar-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.querySelector('.avatar-icon')?.textContent === AVATARS.find(a => a.id === avatarId)?.icon) {
                opt.classList.add('selected');
            }
        });
    }
}

function getAvatarIcon(avatarId) {
    const avatar = AVATARS.find(a => a.id === avatarId);
    return avatar?.icon || '👤';
}

// ===============================
// INTÉGRATION DANS LE HEADER JOUEUR
// ===============================

async function enhancePlayerHeader() {
    if (!currentPlayer) return;
    
    // Avatar
    const avatarId = await getPlayerAvatar(currentPlayer.id);
    const avatarEl = document.querySelector('.player-avatar');
    if (avatarEl) {
        avatarEl.textContent = getAvatarIcon(avatarId);
        avatarEl.style.cursor = 'pointer';
        avatarEl.onclick = () => showAvatarModal();
    }
    
    // Joker counter
    const headerEl = document.querySelector('.player-header');
    if (headerEl && !document.getElementById('jokerCounter')) {
        const jokerEl = document.createElement('div');
        jokerEl.innerHTML = renderJokerCounter();
        headerEl.insertBefore(jokerEl.firstChild, headerEl.querySelector('#logoutBtn'));
        updateJokerCounter();
    }
}

async function showAvatarModal() {
    if (!currentPlayer) return;
    
    const stats = await calculatePlayerDetailedStats(currentPlayer.id);
    
    let modal = document.getElementById('avatarModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'avatarModal';
        modal.className = 'avatar-modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="avatar-modal-content">
            <div class="avatar-modal-header">
                <h3>🎭 Personnalisation</h3>
                <button class="btn-close" onclick="closeAvatarModal()">✕</button>
            </div>
            <div class="avatar-modal-body">
                ${await renderAvatarSelector(currentPlayer.id, stats)}
                ${await renderFavoriteTeamStats(currentPlayer.id)}
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeAvatarModal() {
    const modal = document.getElementById('avatarModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fermer en cliquant à l'extérieur
document.addEventListener('click', (e) => {
    const modal = document.getElementById('avatarModal');
    if (modal && e.target === modal) {
        closeAvatarModal();
    }
});

// Auto-enhance au chargement
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(enhancePlayerHeader, 500);
});

console.log('🃏 Module pronostics-gameplay chargé');