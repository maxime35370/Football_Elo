// ===============================
// PRONOSTICS MULTIJOUEUR
// ===============================

// Variables globales
let currentPlayer = null;
let currentSeason = null;
let allTeams = [];
let allMatches = [];
let futureMatches = [];
let selectedMatchDay = null;

// ===============================
// INITIALISATION
// ===============================

document.addEventListener('DOMContentLoaded', async () => {
    // Charger la saison en cours
    currentSeason = getCurrentSeason();
    
    // Charger les données
    await loadGameData();
    
    // Vérifier si un joueur est connecté
    checkLoggedInPlayer();
    
    // Initialiser les événements
    initAuthEvents();
    initGameEvents();
});

async function loadGameData() {
    try {
        // Charger les équipes
        allTeams = getTeamsBySeason(currentSeason);
        
        // Charger les matchs
        allMatches = getStoredMatches().filter(m => m.season === currentSeason);
        
        // Charger les matchs futurs
        futureMatches = loadFutureMatches(currentSeason);
        
    } catch (error) {
        console.error('Erreur chargement données:', error);
    }
}

// ===============================
// AUTHENTIFICATION
// ===============================

function initAuthEvents() {
    // Onglets connexion/inscription
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            
            tab.classList.add('active');
            const formId = tab.dataset.tab === 'login' ? 'loginForm' : 'registerForm';
            document.getElementById(formId).classList.add('active');
        });
    });
    
    // Bouton connexion
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    
    // Bouton inscription
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    
    // Bouton déconnexion
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Enter pour valider
    document.getElementById('loginPin').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    document.getElementById('registerPinConfirm').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

async function handleLogin() {
    const pseudo = document.getElementById('loginPseudo').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    const errorEl = document.getElementById('loginError');
    
    errorEl.textContent = '';
    
    if (!pseudo || !pin) {
        errorEl.textContent = 'Remplis tous les champs';
        return;
    }
    
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        errorEl.textContent = 'Le code PIN doit contenir 4 chiffres';
        return;
    }
    
    try {
        // Chercher le joueur dans Firebase
        const player = await getPlayerByPseudo(pseudo);
        
        if (!player) {
            errorEl.textContent = 'Pseudo introuvable';
            return;
        }
        
        // Vérifier le PIN
        const pinHash = await hashPin(pin);
        if (player.pinHash !== pinHash) {
            errorEl.textContent = 'Code PIN incorrect';
            return;
        }
        
        // Connexion réussie
        currentPlayer = player;
        localStorage.setItem('pronoCurrentPlayer', JSON.stringify(player));
        
        showGameSection();
        
    } catch (error) {
        console.error('Erreur connexion:', error);
        errorEl.textContent = 'Erreur de connexion';
    }
}

async function handleRegister() {
    const pseudo = document.getElementById('registerPseudo').value.trim();
    const pin = document.getElementById('registerPin').value.trim();
    const pinConfirm = document.getElementById('registerPinConfirm').value.trim();
    const errorEl = document.getElementById('registerError');
    
    errorEl.textContent = '';
    
    if (!pseudo || !pin || !pinConfirm) {
        errorEl.textContent = 'Remplis tous les champs';
        return;
    }
    
    if (pseudo.length < 3) {
        errorEl.textContent = 'Pseudo trop court (min 3 caractères)';
        return;
    }
    
    if (pseudo.length > 20) {
        errorEl.textContent = 'Pseudo trop long (max 20 caractères)';
        return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(pseudo)) {
        errorEl.textContent = 'Pseudo invalide (lettres, chiffres, _ uniquement)';
        return;
    }
    
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        errorEl.textContent = 'Le code PIN doit contenir 4 chiffres';
        return;
    }
    
    if (pin !== pinConfirm) {
        errorEl.textContent = 'Les codes PIN ne correspondent pas';
        return;
    }
    
    try {
        // Vérifier si le pseudo existe déjà
        const existing = await getPlayerByPseudo(pseudo);
        if (existing) {
            errorEl.textContent = 'Ce pseudo est déjà pris';
            return;
        }
        
        // Créer le joueur
        const pinHash = await hashPin(pin);
        const playerId = pseudo.toLowerCase() + '_' + Date.now().toString(36);
        
        const newPlayer = {
            id: playerId,
            pseudo: pseudo,
            pinHash: pinHash,
            createdAt: new Date().toISOString(),
            stats: {
                totalPoints: 0,
                exactScores: 0,
                closeScores: 0,
                goodScores: 0,
                correctResults: 0,
                wrongResults: 0,
                journeys: 0
            }
        };
        
        await savePlayer(newPlayer);
        
        // Connexion automatique
        currentPlayer = newPlayer;
        localStorage.setItem('pronoCurrentPlayer', JSON.stringify(newPlayer));
        
        showGameSection();
        
    } catch (error) {
        console.error('Erreur inscription:', error);
        errorEl.textContent = 'Erreur lors de l\'inscription';
    }
}

function handleLogout() {
    currentPlayer = null;
    localStorage.removeItem('pronoCurrentPlayer');
    showAuthSection();
}

function checkLoggedInPlayer() {
    const stored = localStorage.getItem('pronoCurrentPlayer');
    if (stored) {
        try {
            currentPlayer = JSON.parse(stored);
            showGameSection();
        } catch {
            showAuthSection();
        }
    } else {
        showAuthSection();
    }
}

function showAuthSection() {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('gameSection').style.display = 'none';
}

function showGameSection() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('gameSection').style.display = 'block';
    
    updatePlayerHeader();
    initMatchDaySelector();
    loadLeaderboard();
}

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
// FIREBASE PRONOSTIQUEURS
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
// FIREBASE PRONOSTICS
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
// LOGIQUE DU JEU
// ===============================

function initGameEvents() {
    // Onglets du jeu
    document.querySelectorAll('.game-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.game-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.game-tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
            
            // Charger les données de l'onglet
            if (tab.dataset.tab === 'leaderboard') loadLeaderboard();
            else if (tab.dataset.tab === 'history') loadHistory();
            else if (tab.dataset.tab === 'ia') displayIAComparison();
            else if (tab.dataset.tab === 'duels') renderDuelsTab();
            else if (tab.dataset.tab === 'heatmap') renderHeatmapTab();
            else if (tab.dataset.tab === 'profile') renderProfileTab();
        });
    });
    
    // Changement de journée
    document.getElementById('pronoMatchDay').addEventListener('change', (e) => {
        selectedMatchDay = parseInt(e.target.value);
        displayPredictionsForm();
    });
    
    // Sauvegarder
    document.getElementById('savePredictionsBtn').addEventListener('click', handleSavePredictions);
    
    // Effacer
    document.getElementById('clearPredictionsBtn').addEventListener('click', () => {
        document.querySelectorAll('.prediction-score input').forEach(input => {
            input.value = '';
        });
    });
}

function updatePlayerHeader() {
    if (!currentPlayer) return;
    
    document.getElementById('playerName').textContent = currentPlayer.pseudo;
    
    const stats = currentPlayer.stats || {};
    document.getElementById('playerStats').textContent = `${stats.totalPoints || 0} pts - ${stats.journeys || 0} journée(s)`;
    
    // Rang (à calculer)
    document.getElementById('playerRank').textContent = '-';
}

function initMatchDaySelector() {
    const select = document.getElementById('pronoMatchDay');
    select.innerHTML = '';
    
    // Compter les matchs joués par journée
    const playedByDay = {};
    allMatches.forEach(m => {
        const day = m.matchDay || 0;
        playedByDay[day] = (playedByDay[day] || 0) + 1;
    });
    
    // Compter les matchs prévus par journée (futurs)
    const totalByDay = {};
    futureMatches.forEach(m => {
        const day = m.matchDay || 0;
        totalByDay[day] = (totalByDay[day] || 0) + 1;
    });
    
    // Ajouter aussi les matchs joués au total
    allMatches.forEach(m => {
        const day = m.matchDay || 0;
        totalByDay[day] = (totalByDay[day] || 0) + 1;
    });
    
    // Nombre de matchs par journée (selon nombre d'équipes)
    const matchesPerDay = allTeams.length / 2;
    
    // Trouver toutes les journées
    const allDays = new Set([
        ...Object.keys(playedByDay).map(Number),
        ...Object.keys(totalByDay).map(Number)
    ]);
    const sortedDays = [...allDays].sort((a, b) => a - b);
    
    // Trouver la journée "en cours" (partiellement jouée ou prochaine à venir)
    let currentMatchDay = null;
    
    for (const day of sortedDays) {
        const played = playedByDay[day] || 0;
        const total = totalByDay[day] || matchesPerDay;
        
        // Si la journée n'est pas complète, c'est la journée en cours
        if (played < total && played < matchesPerDay) {
            currentMatchDay = day;
            break;
        }
    }
    
    // Si toutes les journées sont complètes, prendre la prochaine
    if (!currentMatchDay) {
        const lastPlayed = Math.max(0, ...Object.keys(playedByDay).map(Number));
        currentMatchDay = lastPlayed + 1;
    }
    
    // Construire les options
    const maxDay = Math.max(...sortedDays, currentMatchDay);
    
    for (let day = 1; day <= maxDay; day++) {
        const played = playedByDay[day] || 0;
        
        let label;
        if (played === 0) {
            label = `Journée ${day} (à venir)`;
        } else if (played >= matchesPerDay) {
            label = `Journée ${day} (terminée)`;
        } else {
            label = `Journée ${day} (${played}/${matchesPerDay} joués)`;
        }
        
        const option = document.createElement('option');
        option.value = day;
        option.textContent = label;
        select.appendChild(option);
    }
    
    // Sélectionner la journée en cours par défaut
    select.value = currentMatchDay;
    selectedMatchDay = currentMatchDay;
    displayPredictionsForm();
}

async function displayPredictionsForm() {
    const container = document.getElementById('predictionsList');

    let teamsWithElo = [];
    if (typeof EloSystem !== 'undefined') {
        teamsWithElo = EloSystem.recalculateAllEloRatings(allTeams, allMatches);
    }
    const statusEl = document.getElementById('predictionsStatus');
    const deadlineEl = document.getElementById('deadlineInfo');
    
    if (!selectedMatchDay) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Sélectionne une journée</p>';
        return;
    }
    
    // Déterminer si la journée est passée ou future
    const lastPlayedMatchDay = Math.max(0, ...allMatches.map(m => m.matchDay || 0));
    const isPastMatchDay = selectedMatchDay <= lastPlayedMatchDay;
    
    // Récupérer les matchs de cette journée (joués + à venir)
    const playedMatches = allMatches.filter(m => m.matchDay === selectedMatchDay);
    const upcomingMatches = futureMatches.filter(m => m.matchDay === selectedMatchDay);

    // Combiner les deux, en évitant les doublons
    const playedKeys = new Set(playedMatches.map(m => `${m.homeTeamId}-${m.awayTeamId}`));
    const uniqueUpcoming = upcomingMatches.filter(m => !playedKeys.has(`${m.homeTeamId}-${m.awayTeamId}`));

    let matchesThisDay = [...playedMatches, ...uniqueUpcoming];

    // Trier par date si disponible
    matchesThisDay.sort((a, b) => {
        const dateA = a.scheduledAt ? new Date(a.scheduledAt) : new Date(0);
        const dateB = b.scheduledAt ? new Date(b.scheduledAt) : new Date(0);
        return dateA - dateB;
    });
    
    if (matchesThisDay.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Aucun match pour cette journée</p>';
        return;
    }
    
    // Calculer combien de matchs sont encore ouverts
    const now = new Date();
    let openMatches = 0;
    let nextDeadline = null;
    
    matchesThisDay.forEach(match => {
        if (match.finalScore) {
            // Match joué → fermé
            return;
        }
        
        if (match.scheduledAt) {
            const matchTime = new Date(match.scheduledAt);
            if (now < matchTime) {
                openMatches++;
                if (!nextDeadline || matchTime < nextDeadline) {
                    nextDeadline = matchTime;
                }
            }
        } else {
            // Pas de date et pas joué → ouvert
            openMatches++;
        }
    });
    
    // Mettre à jour le badge deadline
    if (openMatches === 0) {
        deadlineEl.className = 'deadline-info locked';
        deadlineEl.innerHTML = '<span class="deadline-icon">🔒</span><span class="deadline-text">Tous les matchs commencés</span>';
    } else if (nextDeadline) {
        const diff = nextDeadline - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeText;
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            timeText = `${days}j ${hours % 24}h`;
        } else if (hours > 0) {
            timeText = `${hours}h ${minutes}min`;
        } else {
            timeText = `${minutes} min`;
        }
        
        deadlineEl.className = 'deadline-info open';
        deadlineEl.innerHTML = `<span class="deadline-icon">⏰</span><span class="deadline-text">Prochain match dans ${timeText} (${openMatches} ouvert${openMatches > 1 ? 's' : ''})</span>`;
    } else {
        deadlineEl.className = 'deadline-info open';
        deadlineEl.innerHTML = `<span class="deadline-icon">✅</span><span class="deadline-text">${openMatches} match${openMatches > 1 ? 's' : ''} ouvert${openMatches > 1 ? 's' : ''}</span>`;
    }
    
    // Récupérer les pronostics existants du joueur
    const existingPredictions = await getPlayerPredictions(currentPlayer.id, currentSeason, selectedMatchDay);
    const predictionsMap = {};
    
    if (existingPredictions && existingPredictions.predictions) {
        existingPredictions.predictions.forEach(p => {
            predictionsMap[`${p.homeTeamId}-${p.awayTeamId}`] = p;
        });
        
        // Charger les picks buteurs depuis les prédictions sauvegardées
        if (typeof loadScorerPicksFromPredictions === 'function') {
            loadScorerPicksFromPredictions(existingPredictions.predictions);
        }
    }
    
    // Mettre à jour le statut
    if (existingPredictions) {
        statusEl.className = 'predictions-status saved';
        const savedDate = existingPredictions.submittedAt ? new Date(existingPredictions.submittedAt) : null;
        const dateText = savedDate && !isNaN(savedDate) ? savedDate.toLocaleString('fr-FR') : 'date inconnue';
        statusEl.textContent = `✅ Pronostics sauvegardés le ${dateText}`;
    } else if (openMatches > 0) {
        statusEl.className = 'predictions-status unsaved';
        statusEl.textContent = '⚠️ Pronostics non sauvegardés';
    } else {
        statusEl.className = 'predictions-status';
        statusEl.textContent = '';
    }
    
    // Pré-charger toutes les cotes pour cette journée
    const oddsMap = {};
    if (typeof getMatchOdds === 'function') {
        const oddsPromises = matchesThisDay.map(async (match) => {
            const oddsKey = `${match.homeTeamId}-${match.awayTeamId}`;
            try {
                const odds = await getMatchOdds(match, teamsWithElo);
                oddsMap[oddsKey] = odds;
            } catch (e) {
                console.warn('Erreur chargement cotes pour', oddsKey);
            }
        });
        await Promise.all(oddsPromises);
    }

    // Générer le HTML des matchs
    let html = '';
    
    matchesThisDay.forEach(match => {
        const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
        const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
        const key = `${match.homeTeamId}-${match.awayTeamId}`;
        const prediction = predictionsMap[key];
        
        const homeScore = prediction ? prediction.homeScore : '';
        const awayScore = prediction ? prediction.awayScore : '';
        
        // Vérifier si CE match est bloqué
        let isMatchLocked = false;
        let matchTimeText = '';

        if (match.finalScore) {
            // Match déjà joué → verrouillé
            isMatchLocked = true;
        } else if (match.scheduledAt) {
            // Match avec date/heure prévue → vérifier si commencé
            const matchTime = new Date(match.scheduledAt);
            isMatchLocked = now >= matchTime;
            matchTimeText = matchTime.toLocaleString('fr-FR', { 
                weekday: 'short', 
                day: 'numeric', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else {
            // Match sans date précise et pas encore joué → ouvert
            isMatchLocked = false;
        }
        
        // Résultat réel si match terminé
        let resultHtml = '';
        if (match.finalScore) {
            const result = calculatePredictionResult(
                prediction?.homeScore, 
                prediction?.awayScore, 
                match.finalScore.home, 
                match.finalScore.away,
                prediction?.savedAt,
                match,
                prediction?.odds
            );
            
            let pointsDisplay = `${result.finalPoints} pts`;
            if (result.oddsMultiplier !== 1) {
                pointsDisplay = `${result.points} × ${result.oddsMultiplier} = ${result.finalPoints} pts`;
            }

            resultHtml = `
                <div class="actual-result ${result.class}">
                    Réel: ${match.finalScore.home}-${match.finalScore.away} | 
                    ${result.label}
                    <span class="points-badge">${pointsDisplay}</span>
                </div>
            `;
        }
        
        // Récupérer les cotes pré-chargées et calculer les multiplicateurs de points
        const matchOdds = oddsMap[key];
        let homeMultHtml = '';
        let awayMultHtml = '';
        let drawMultText = '-';

        if (matchOdds) {
            const homeMult = Math.max(0.5, Math.min(3.0, Math.round((matchOdds.home / 2) * 100) / 100));
            const drawMult = Math.max(0.5, Math.min(3.0, Math.round((matchOdds.draw / 2) * 100) / 100));
            const awayMult = Math.max(0.5, Math.min(3.0, Math.round((matchOdds.away / 2) * 100) / 100));
            homeMultHtml = `<span class="team-odds ${homeMult >= 1 ? 'bonus' : 'malus'}">×${homeMult.toFixed(2)}</span>`;
            awayMultHtml = `<span class="team-odds ${awayMult >= 1 ? 'bonus' : 'malus'}">×${awayMult.toFixed(2)}</span>`;
            drawMultText = `×${drawMult.toFixed(2)}`;
        }

        html += `
            <div class="prediction-match ${isMatchLocked ? 'locked' : ''} ${resultHtml ? 'has-result' : ''}" 
                 data-home="${match.homeTeamId}" 
                 data-away="${match.awayTeamId}">
                ${matchTimeText ? `<div class="match-time ${isMatchLocked ? 'locked' : ''}">${isMatchLocked ? '🔒' : '🕐'} ${matchTimeText}</div>` : ''}
                <div class="prediction-team home">
                    <span class="team-name">${homeTeam?.shortName || '?'}</span>
                    ${homeMultHtml}
                    <span class="team-badge">🏠 Domicile</span>
                </div>
                <div class="prediction-score">
                    <input type="number" min="0" max="20" class="home-score" 
                           value="${homeScore}" 
                           ${isMatchLocked ? 'disabled' : ''}
                           data-home="${match.homeTeamId}" 
                           data-away="${match.awayTeamId}">
                    <span class="separator odds-draw">${drawMultText}</span>
                    <input type="number" min="0" max="20" class="away-score" 
                           value="${awayScore}" 
                           ${isMatchLocked ? 'disabled' : ''}
                           data-home="${match.homeTeamId}" 
                           data-away="${match.awayTeamId}">
                </div>
                <div class="prediction-team away">
                    ${awayMultHtml}
                    <span class="team-name">${awayTeam?.shortName || '?'}</span>
                    <span class="team-badge">✈️ Extérieur</span>
                </div>
                ${resultHtml}
                ${!isMatchLocked ? `<div class="joker-slot" data-home="${match.homeTeamId}" data-away="${match.awayTeamId}"></div>` : ''}
                <div class="scorer-slot" data-home="${match.homeTeamId}" data-away="${match.awayTeamId}"></div>
            </div>
        `;
    });
    
    // IMPORTANT: D'abord injecter le HTML dans le DOM
    container.innerHTML = html;

    // ENSUITE ajouter les boutons joker (après que le DOM existe)
    if (currentPlayer && currentSeason && typeof getPlayerJokers === 'function') {
        const jokers = await getPlayerJokers(currentPlayer.id, currentSeason);
        document.querySelectorAll('.joker-slot').forEach(slot => {
            const homeId = parseInt(slot.dataset.home);
            const awayId = parseInt(slot.dataset.away);
            const match = matchesThisDay.find(m => m.homeTeamId == homeId && m.awayTeamId == awayId);
            const isLocked = match?.finalScore || (match?.scheduledAt && new Date() >= new Date(match.scheduledAt));
            
            if (typeof renderJokerButton === 'function') {
                slot.innerHTML = renderJokerButton(slot, jokers, selectedMatchDay, homeId, awayId, isLocked);
            }
        });
    }
    
    // Ajouter les défis buteur (après que le DOM existe)
    if (typeof renderScorerChallenge === 'function') {
        document.querySelectorAll('.scorer-slot').forEach(slot => {
            const homeId = parseInt(slot.dataset.home);
            const awayId = parseInt(slot.dataset.away);
            const matchKey = `${homeId}_${awayId}`;
            const match = matchesThisDay.find(m => m.homeTeamId == homeId && m.awayTeamId == awayId);
            const isLocked = match?.finalScore || (match?.scheduledAt && new Date() >= new Date(match.scheduledAt));
            const existingPick = window._scorerPicks ? window._scorerPicks[matchKey] : null;
            
            slot.innerHTML = renderScorerChallenge(homeId, awayId, existingPick, isLocked);
        });
    }
    
    // Afficher/masquer les boutons selon s'il y a des matchs ouverts
    const hasOpenMatches = openMatches > 0;
    document.getElementById('savePredictionsBtn').style.display = hasOpenMatches ? 'inline-flex' : 'none';
    document.getElementById('clearPredictionsBtn').style.display = hasOpenMatches ? 'inline-flex' : 'none';
    
    // Afficher le résumé si journée passée
    if (isPastMatchDay && existingPredictions) {
        displayPredictionsSummary(existingPredictions, matchesThisDay);
    } else {
        document.getElementById('predictionsSummary').innerHTML = '';
    }

    // Ajouter les suggestions IA et le consensus
    if (typeof enhanceMatchCardsWithConsensus === 'function') {
        await enhanceMatchCardsWithConsensus();
    }
}

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
        // Normaliser le multiplicateur (cote / 2 pour équilibrer)
        // Une cote de 2.0 = x1.0, cote de 4.0 = x2.0, cote de 1.5 = x0.75
        oddsMultiplier = Math.round((odds[predResult] / 2) * 100) / 100;
        // Limiter entre 0.5 et 3.0
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

async function handleSavePredictions() {
    const now = new Date().toISOString();
    
    // Récupérer les équipes avec Elo pour calculer les cotes
    let teamsWithElo = [];
    if (typeof EloSystem !== 'undefined') {
        teamsWithElo = EloSystem.recalculateAllEloRatings(allTeams, allMatches);
    }
    
    // Récupérer les matchs de cette journée pour les cotes
    const playedMatches = allMatches.filter(m => m.matchDay === selectedMatchDay);
    const upcomingMatches = futureMatches.filter(m => m.matchDay === selectedMatchDay);
    const playedKeys = new Set(playedMatches.map(m => `${m.homeTeamId}-${m.awayTeamId}`));
    const uniqueUpcoming = upcomingMatches.filter(m => !playedKeys.has(`${m.homeTeamId}-${m.awayTeamId}`));
    const matchesThisDay = [...playedMatches, ...uniqueUpcoming];
    
    // Récupérer les anciens pronostics
    const existingPredictions = await getPlayerPredictions(currentPlayer.id, currentSeason, selectedMatchDay);
    const existingMap = {};
    
    if (existingPredictions && existingPredictions.predictions) {
        existingPredictions.predictions.forEach(p => {
            const key = `${p.homeTeamId}-${p.awayTeamId}`;
            existingMap[key] = p;
        });
    }
    
    // Récupérer les jokers pour savoir si un joker est sur un match
    let jokers = { used: [] };
    if (currentPlayer && currentSeason && typeof getPlayerJokers === 'function') {
        jokers = await getPlayerJokers(currentPlayer.id, currentSeason);
    }
    
    const predictions = [];
    
    for (const matchEl of document.querySelectorAll('.prediction-match')) {
        const homeTeamId = parseInt(matchEl.dataset.home);
        const awayTeamId = parseInt(matchEl.dataset.away);
        const homeScore = matchEl.querySelector('.home-score').value;
        const awayScore = matchEl.querySelector('.away-score').value;
        
        if (homeScore !== '' && awayScore !== '') {
            const key = `${homeTeamId}-${awayTeamId}`;
            const existing = existingMap[key];
            
            const predHomeScore = parseInt(homeScore);
            const predAwayScore = parseInt(awayScore);
            
            // Déterminer le résultat prédit
            let predictedResult;
            if (predHomeScore > predAwayScore) predictedResult = 'home';
            else if (predHomeScore < predAwayScore) predictedResult = 'away';
            else predictedResult = 'draw';
            
            let savedAt = now;
            let odds = null;
            
            // Si le pronostic existait et n'a pas changé, garder l'ancienne date et les anciennes cotes
            if (existing && 
                existing.homeScore === predHomeScore && 
                existing.awayScore === predAwayScore) {
                savedAt = existing.savedAt || now;
                odds = existing.odds || null;
            }
            
            // Si pas de cotes (nouveau prono ou prono modifié), calculer les cotes actuelles
            if (!odds) {
                const match = matchesThisDay.find(m => 
                    m.homeTeamId == homeTeamId && m.awayTeamId == awayTeamId
                );
                
                if (match && typeof getMatchOdds === 'function') {
                    const matchOdds = await getMatchOdds(match, teamsWithElo);
                    odds = {
                        home: matchOdds.home,
                        draw: matchOdds.draw,
                        away: matchOdds.away,
                        distribution: matchOdds.distribution || null
                    };
                }
            }
            
            // Vérifier si un joker est sur ce match
            const hasJoker = typeof isJokerOnMatch === 'function' 
                ? isJokerOnMatch(jokers, selectedMatchDay, homeTeamId, awayTeamId)
                : false;
            
            predictions.push({
                homeTeamId,
                awayTeamId,
                homeScore: predHomeScore,
                awayScore: predAwayScore,
                savedAt: savedAt,
                predictedResult: predictedResult,
                odds: odds,
                joker: hasJoker
            });
        }
    }
    
    if (predictions.length === 0) {
        alert('Remplis au moins un pronostic !');
        return;
    }
    
    // Ajouter les picks buteurs aux prédictions
    if (typeof addScorerPicksToPredictions === 'function') {
        addScorerPicksToPredictions(predictions);
    }
    
    const success = await savePredictions(
        currentPlayer.id,
        currentPlayer.pseudo,
        currentSeason,
        selectedMatchDay,
        predictions
    );
    
    if (success) {
        alert(`✅ ${predictions.length} pronostic(s) sauvegardé(s) !`);
        displayPredictionsForm();
    } else {
        alert('❌ Erreur lors de la sauvegarde');
    }
}

async function displayPredictionsSummary(predictionsData, matches) {
    const container = document.getElementById('predictionsSummary');
    
    let totalPoints = 0;
    let exact = 0, close = 0, good = 0, correct = 0, wrong = 0;
    
    predictionsData.predictions.forEach(pred => {
        const match = matches.find(m => 
            m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
        );
        
        if (match && match.finalScore) {
            const result = calculatePredictionResult(
                pred.homeScore, pred.awayScore,
                match.finalScore.home, match.finalScore.away,
                pred.savedAt,
                match,
                pred.odds,
                pred.joker || false
            );
            
            totalPoints += result.finalPoints || result.points;
            
            if (result.points === 9) exact++;
            else if (result.points === 6) close++;
            else if (result.points === 5) good++;
            else if (result.points === 3) correct++;
            else wrong++;
        }
    });
    
    // Arrondir pour l'affichage
    const displayPoints = Math.round(totalPoints * 10) / 10;

    container.innerHTML = `
        <div class="summary-title">📊 Résumé de la journée ${selectedMatchDay}</div>
        <div class="summary-stats">
            <div class="summary-stat">
                <span class="value">${displayPoints}</span>
                <span class="label">Points</span>
            </div>
            <div class="summary-stat">
                <span class="value">${exact}</span>
                <span class="label">🏆 Exact</span>
            </div>
            <div class="summary-stat">
                <span class="value">${close}</span>
                <span class="label">🎯 Proche</span>
            </div>
            <div class="summary-stat">
                <span class="value">${good + correct}</span>
                <span class="label">✅ Bon</span>
            </div>
            <div class="summary-stat">
                <span class="value">${wrong}</span>
                <span class="label">❌ Raté</span>
            </div>
        </div>
    `;
    if (currentPlayer && typeof calculateIAComparison === 'function') {
        const iaComparison = await calculateIAComparison(currentPlayer.id, selectedMatchDay);
        if (iaComparison) {
            const summaryDiv = document.getElementById('predictionsSummary');
            summaryDiv.innerHTML += renderIAComparisonSummary(iaComparison);
        }
    }
}

// ===============================
// CLASSEMENT
// ===============================

async function loadLeaderboard() {
    const tbody = document.querySelector('#leaderboardTable tbody');
    tbody.innerHTML = '<tr><td colspan="9">Chargement...</td></tr>';
    
    try {
        const players = await getAllPlayers();
        
        // Recalculer les stats de chaque joueur dynamiquement
        const playersWithStats = [];
        
        for (const player of players) {
            // Utiliser calculatePlayerDetailedStats si disponible
            if (typeof calculatePlayerDetailedStats === 'function') {
                const stats = await calculatePlayerDetailedStats(player.id);
                playersWithStats.push({
                    ...player,
                    calculatedStats: stats
                });
            } else {
                playersWithStats.push({
                    ...player,
                    calculatedStats: player.stats || {}
                });
            }
        }
        
        // Trier par points calculés
        playersWithStats.sort((a, b) => 
            (b.calculatedStats?.totalPoints || 0) - (a.calculatedStats?.totalPoints || 0)
        );
        
        if (playersWithStats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9">Aucun joueur inscrit</td></tr>';
            return;
        }
        
        let html = '';
        
        playersWithStats.forEach((player, index) => {
            const rank = index + 1;
            const stats = player.calculatedStats || {};
            
            const totalMatches = (stats.exactScores || 0) + (stats.closeScores || 0) + 
                                 (stats.goodScores || 0) + (stats.correctResults || 0) + (stats.wrongResults || 0);
            const successRate = totalMatches > 0 
                ? Math.round(((stats.exactScores || 0) + (stats.closeScores || 0) + (stats.goodScores || 0) + (stats.correctResults || 0)) / totalMatches * 100)
                : 0;
            const journeys = stats.journeysPlayed?.length || stats.journeys || 0;
            const avg = journeys > 0 
                ? ((stats.totalPoints || 0) / journeys).toFixed(1)
                : '0.0';
            
            let rankClass = '';
            if (rank === 1) rankClass = 'rank-1';
            else if (rank === 2) rankClass = 'rank-2';
            else if (rank === 3) rankClass = 'rank-3';
            
            if (currentPlayer && player.id === currentPlayer.id) {
                rankClass += ' current-player';
            }
            
            let rankIcon = rank;
            if (rank === 1) rankIcon = '🥇';
            else if (rank === 2) rankIcon = '🥈';
            else if (rank === 3) rankIcon = '🥉';
            
            // Arrondir les points pour l'affichage
            const displayPoints = Math.round((stats.totalPoints || 0) * 10) / 10;
            
            // Badge de niveau si disponible
            const levelBadge = typeof renderPlayerLevelBadge === 'function' 
                ? renderPlayerLevelBadge(stats.totalPoints || 0, 'small') 
                : '';
            
            html += `
                <tr class="${rankClass}" 
                    onclick="showPlayerStatsModal('${player.id}', '${player.pseudo}')" 
                    style="cursor:pointer;" 
                    title="Cliquer pour voir les statistiques">
                    <td><span class="rank-icon">${rankIcon}</span></td>
                    <td>${levelBadge} ${player.pseudo}</td>
                    <td><strong>${displayPoints}</strong></td>
                    <td>${avg}</td>
                    <td>${stats.exactScores || 0}</td>
                    <td>${stats.closeScores || 0}</td>
                    <td>${(stats.goodScores || 0) + (stats.correctResults || 0)}</td>
                    <td>${stats.wrongResults || 0}</td>
                    <td>${successRate}%</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Mettre à jour le rang du joueur actuel
        if (currentPlayer) {
            const playerRank = playersWithStats.findIndex(p => p.id === currentPlayer.id) + 1;
            if (playerRank > 0) {
                let rankText = `${playerRank}${playerRank === 1 ? 'er' : 'e'}`;
                if (playerRank <= 3) {
                    rankText = ['🥇', '🥈', '🥉'][playerRank - 1];
                }
                document.getElementById('playerRank').textContent = rankText;
                
                // Mettre à jour aussi le header
                const playerStats = playersWithStats[playerRank - 1]?.calculatedStats || {};
                const journeys = playerStats.journeysPlayed?.length || 0;
                document.getElementById('playerStats').textContent = 
                    `${Math.round((playerStats.totalPoints || 0) * 10) / 10} pts - ${journeys} journée(s)`;
            }
        }

        // Afficher le graphique d'évolution
        if (typeof renderEvolutionChart === 'function') {
            renderEvolutionChart();
        }

        // Afficher le classement par journée
        if (typeof renderMatchDayRankingWidget === 'function') {
            renderMatchDayRankingWidget();
        }
        
    } catch (error) {
        console.error('Erreur loadLeaderboard:', error);
        tbody.innerHTML = '<tr><td colspan="9">Erreur de chargement</td></tr>';
    }
}

// ===============================
// HISTORIQUE
// ===============================

async function loadHistory() {
    const container = document.getElementById('historyList');
    container.innerHTML = '<p style="text-align:center;">Chargement...</p>';
    
    if (!currentPlayer) return;
    
    try {
        const history = await getPlayerHistory(currentPlayer.id);
        
        if (history.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Aucun historique disponible</p>';
            return;
        }
        
        let html = '';
        
        for (const entry of history) {
            // Récupérer les matchs réels pour calculer les points
            const matchesThisDay = allMatches.filter(m => m.matchDay === entry.matchDay);
            
            let totalPoints = 0;
            let matchesHtml = '';
            
            entry.predictions.forEach(pred => {
                const match = matchesThisDay.find(m => 
                    m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
                );
                
                const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
                const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
                
                let result = { points: 0, finalPoints: 0, class: 'wrong', label: '-' };
                let realScore = '-';

                if (match && match.finalScore) {
                    result = calculatePredictionResult(
                        pred.homeScore, pred.awayScore,
                        match.finalScore.home, match.finalScore.away,
                        pred.savedAt,
                        match,
                        pred.odds,
                        pred.joker || false
                    );
                    totalPoints += result.finalPoints;
                    realScore = `${match.finalScore.home}-${match.finalScore.away}`;
                }
                
                const jokerBadge = pred.joker ? '<span class="joker-badge">🃏</span>' : '';
                
                matchesHtml += `
                    <div class="history-match">
                        <span class="history-match-teams">${jokerBadge}${homeTeam?.shortName || '?'} - ${awayTeam?.shortName || '?'}</span>
                        <div class="history-match-scores">
                            <span class="history-prono">${pred.homeScore}-${pred.awayScore}</span>
                            <span class="history-real">${realScore}</span>
                            <span class="history-points-match ${result.class}">${Math.round((result.finalPoints || result.points) * 10) / 10}</span>
                        </div>
                    </div>
                `;
            });
            
            html += `
                <div class="history-card">
                    <div class="history-card-header">
                        <span class="history-matchday">Journée ${entry.matchDay}</span>
                        <span class="history-points">${Math.round(totalPoints * 10) / 10} pts</span>
                    </div>
                    <div class="history-card-body">
                        ${matchesHtml}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Erreur loadHistory:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur de chargement</p>';
    }
}

// ===============================
// ONGLET PROFIL
// ===============================

async function renderProfileTab() {
    const container = document.getElementById('profileContent');
    if (!container || !currentPlayer) return;
    
    container.innerHTML = '<div class="loading">Chargement...</div>';
    
    try {
        const stats = await calculatePlayerDetailedStats(currentPlayer.id);
        
        let html = '';
        
        // Niveau et progression
        if (typeof addGamificationToStatsModal === 'function') {
            html += `
                <div class="profile-section">
                    <h4>🎮 Niveau & Progression</h4>
                    ${addGamificationToStatsModal(stats)}
                </div>
            `;
        }
        
        // Missions hebdo
        if (typeof renderWeeklyMissions === 'function') {
            html += await renderWeeklyMissions(currentPlayer.id);
        }
        
        // Sélecteur d'avatar
        if (typeof renderAvatarSelector === 'function') {
            html += await renderAvatarSelector(currentPlayer.id, stats);
        }
        
        // Équipe favorite
        if (typeof renderFavoriteTeamStats === 'function') {
            html += `
                <div class="profile-section">
                    <h4>💙 Équipe Favorite</h4>
                    ${await renderFavoriteTeamStats(currentPlayer.id)}
                </div>
            `;
        }
        
        // Jokers restants
        if (typeof getPlayerJokers === 'function' && typeof JOKER_CONFIG !== 'undefined') {
            const jokers = await getPlayerJokers(currentPlayer.id, currentSeason);
            html += `
                <div class="profile-section">
                    <h4>🃏 Jokers</h4>
                    <div class="jokers-info">
                        <div class="jokers-remaining">
                            <span class="jokers-count">${jokers.remaining}</span>
                            <span class="jokers-label">/ ${JOKER_CONFIG.maxPerSeason} restants</span>
                        </div>
                        <p class="jokers-desc">
                            Utilisez un joker sur un match pour <strong>doubler</strong> vos points !
                            Sélectionnable dans l'onglet Pronostiquer.
                        </p>
                    </div>
                </div>
            `;
        }
        
        // Si aucune fonctionnalité gamification n'est disponible
        if (!html) {
            html = `
                <div class="profile-section">
                    <h4>📊 Mes statistiques</h4>
                    <div class="stats-overview">
                        <div class="stats-card">
                            <div class="stats-value">${Math.round(stats.totalPoints * 10) / 10}</div>
                            <div class="stats-label">Points totaux</div>
                        </div>
                        <div class="stats-card">
                            <div class="stats-value">${stats.journeysPlayed?.length || 0}</div>
                            <div class="stats-label">Journées jouées</div>
                        </div>
                        <div class="stats-card">
                            <div class="stats-value">${stats.exactScores || 0}</div>
                            <div class="stats-label">Scores exacts</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Erreur renderProfileTab:', error);
        container.innerHTML = '<p style="color:#e74c3c;">Erreur de chargement</p>';
    }
}