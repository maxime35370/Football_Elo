// ===============================
// PRONOSTICS - CONTROLLER (orchestration)
// ===============================
// Responsabilité : init, événements, flux de données
// Appelle le Model pour récupérer les données
// Passe les résultats à la View pour afficher
// ===============================

// Variables globales (partagées avec tous les modules)
// var au lieu de let : permet la redéclaration si un autre script les définit aussi
var currentPlayer = null;
var currentSeason = null;
var allTeams = [];
var allMatches = [];
var futureMatches = [];
var selectedMatchDay = null;

// ===============================
// INITIALISATION
// ===============================

async function initPronosticsApp() {
    currentSeason = getCurrentSeason();
    await loadGameData();
    checkLoggedInPlayer();
    initAuthEvents();
    initGameEvents();
}

// Compatible avec chargement direct (<script>) ET dynamique (loader)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPronosticsApp);
} else {
    document.addEventListener('pronostics:ready', initPronosticsApp);
    if (!document.querySelector('script[src*="pronostics-loader"]')) {
        initPronosticsApp();
    }
}

async function loadGameData() {
    try {
        allTeams = getTeamsBySeason(currentSeason);
        allMatches = getStoredMatches().filter(m => m.season === currentSeason);
        futureMatches = loadFutureMatches(currentSeason);
    } catch (error) {
        console.error('Erreur chargement données:', error);
    }
}

// ===============================
// ÉVÉNEMENTS - AUTH
// ===============================

function initAuthEvents() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            tab.classList.add('active');
            const formId = tab.dataset.tab === 'login' ? 'loginForm' : 'registerForm';
            document.getElementById(formId).classList.add('active');
        });
    });
    
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
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
    
    if (!pseudo || !pin) { errorEl.textContent = 'Remplis tous les champs'; return; }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { errorEl.textContent = 'Le code PIN doit contenir 4 chiffres'; return; }
    
    try {
        const player = await getPlayerByPseudo(pseudo);
        if (!player) { errorEl.textContent = 'Pseudo introuvable'; return; }
        
        const pinHash = await hashPin(pin);
        if (player.pinHash !== pinHash) { errorEl.textContent = 'Code PIN incorrect'; return; }
        
        currentPlayer = player;
        localStorage.setItem('pronoCurrentPlayer', JSON.stringify(player));
        onLoginSuccess();
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
    
    // Validations
    if (!pseudo || !pin || !pinConfirm) { errorEl.textContent = 'Remplis tous les champs'; return; }
    if (pseudo.length < 3) { errorEl.textContent = 'Pseudo trop court (min 3 caractères)'; return; }
    if (pseudo.length > 20) { errorEl.textContent = 'Pseudo trop long (max 20 caractères)'; return; }
    if (!/^[a-zA-Z0-9_]+$/.test(pseudo)) { errorEl.textContent = 'Pseudo invalide (lettres, chiffres, _ uniquement)'; return; }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { errorEl.textContent = 'Le code PIN doit contenir 4 chiffres'; return; }
    if (pin !== pinConfirm) { errorEl.textContent = 'Les codes PIN ne correspondent pas'; return; }
    
    try {
        const existing = await getPlayerByPseudo(pseudo);
        if (existing) { errorEl.textContent = 'Ce pseudo est déjà pris'; return; }
        
        const pinHash = await hashPin(pin);
        const playerId = pseudo.toLowerCase() + '_' + Date.now().toString(36);
        
        const newPlayer = {
            id: playerId,
            pseudo: pseudo,
            pinHash: pinHash,
            createdAt: new Date().toISOString(),
            stats: { totalPoints: 0, exactScores: 0, closeScores: 0, goodScores: 0, correctResults: 0, wrongResults: 0, journeys: 0 }
        };
        
        await savePlayer(newPlayer);
        currentPlayer = newPlayer;
        localStorage.setItem('pronoCurrentPlayer', JSON.stringify(newPlayer));
        onLoginSuccess();
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
            onLoginSuccess();
        } catch {
            showAuthSection();
        }
    } else {
        showAuthSection();
    }
}

/**
 * Appelé après connexion/inscription réussie
 */
function onLoginSuccess() {
    showGameSection();
    updatePlayerHeader(currentPlayer);
    initMatchDaySelector();
    loadLeaderboard();
}

// ===============================
// ÉVÉNEMENTS - JEU
// ===============================

function initGameEvents() {
    // Onglets du jeu
    document.querySelectorAll('.game-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.game-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.game-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
            
            if (tab.dataset.tab === 'leaderboard') loadLeaderboard();
            else if (tab.dataset.tab === 'history') loadHistory();
            else if (tab.dataset.tab === 'ia') displayIAComparison();
            else if (tab.dataset.tab === 'duels') renderDuelsTab();
            else if (tab.dataset.tab === 'heatmap') renderHeatmapTab();
            else if (tab.dataset.tab === 'profile') renderProfileTab();
            else if (tab.dataset.tab === 'rankingBet') {
                if (typeof initRankingBetUI === 'function') initRankingBetUI('rankingBetContainer');
            }
        });
    });
    
    document.getElementById('pronoMatchDay').addEventListener('change', (e) => {
        selectedMatchDay = parseInt(e.target.value);
        displayPredictionsForm();
    });
    
    document.getElementById('savePredictionsBtn').addEventListener('click', handleSavePredictions);
    
    document.getElementById('clearPredictionsBtn').addEventListener('click', () => {
        document.querySelectorAll('.prediction-score input').forEach(input => { input.value = ''; });
    });
}

// ===============================
// ORCHESTRATEUR : SÉLECTEUR JOURNÉE
// ===============================

function initMatchDaySelector() {
    const select = document.getElementById('pronoMatchDay');
    const currentDay = buildMatchDayOptions(select, allMatches, futureMatches, allTeams);
    select.value = currentDay;
    selectedMatchDay = currentDay;
    displayPredictionsForm();
}

// ===============================
// ORCHESTRATEUR : FORMULAIRE PRONOSTICS
// ===============================

async function displayPredictionsForm() {
    const container = document.getElementById('predictionsList');
    const statusEl = document.getElementById('predictionsStatus');
    const deadlineEl = document.getElementById('deadlineInfo');
    
    if (!selectedMatchDay) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Sélectionne une journée</p>';
        return;
    }
    
    // --- MODEL : récupérer les données ---
    const lastPlayedMatchDay = Math.max(0, ...allMatches.map(m => m.matchDay || 0));
    const isPastMatchDay = selectedMatchDay <= lastPlayedMatchDay;
    
    const matchesThisDay = getMatchDayMatches(selectedMatchDay, allMatches, futureMatches);
    
    if (matchesThisDay.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Aucun match pour cette journée</p>';
        return;
    }
    
    const { openMatches, nextDeadline } = computeOpenMatches(matchesThisDay);
    
    const existingPredictions = await getPlayerPredictions(currentPlayer.id, currentSeason, selectedMatchDay);
    const predictionsMap = buildPredictionsMap(existingPredictions);
    
    // Charger les picks buteurs
    if (existingPredictions?.predictions && typeof loadScorerPicksFromPredictions === 'function') {
        loadScorerPicksFromPredictions(existingPredictions.predictions);
    }
    
    // Charger le combiné sauvegardé
    if (currentPlayer && typeof getPlayerCombine === 'function') {
        const savedCombine = await getPlayerCombine(currentPlayer.id, currentSeason, selectedMatchDay);
        if (typeof loadCombineFromSaved === 'function') {
            loadCombineFromSaved(savedCombine, selectedMatchDay);
        }
    }
    
    // Calculer les cotes Elo
    let teamsWithElo = [];
    if (typeof EloSystem !== 'undefined') {
        teamsWithElo = EloSystem.recalculateAllEloRatings(allTeams, allMatches);
    }
    const oddsMap = await preloadMatchOdds(matchesThisDay, teamsWithElo);
    
    // Super Joker HTML
    let superJokerHtml = '';
    if (typeof renderSuperJokerBanner === 'function' && currentPlayer) {
        superJokerHtml = await renderSuperJokerBanner(currentPlayer.id, currentSeason, selectedMatchDay);
    }
    
    // --- VIEW : afficher ---
    const deadlineBadge = renderDeadlineBadge(openMatches, nextDeadline);
    deadlineEl.className = deadlineBadge.className;
    deadlineEl.innerHTML = deadlineBadge.innerHTML;
    
    renderPredictionsStatus(statusEl, existingPredictions, openMatches);
    
    container.innerHTML = renderPredictionsFormHTML({
        matchesThisDay, predictionsMap, oddsMap, allTeams,
        selectedMatchDay, isMatchDayLocked: openMatches === 0,
        superJokerHtml
    });
    
    // Post-render : jokers
    if (currentPlayer && currentSeason && typeof getPlayerJokers === 'function') {
        const jokers = await getPlayerJokers(currentPlayer.id, currentSeason);
        renderJokerSlots(jokers, matchesThisDay, selectedMatchDay);
    }
    
    // Post-render : buteurs
    renderScorerSlots(matchesThisDay);
    
    // Boutons action
    toggleActionButtons(openMatches > 0);
    
    // Résumé si journée passée
    if (isPastMatchDay && existingPredictions) {
        displayPredictionsSummary(existingPredictions, matchesThisDay);
    } else {
        document.getElementById('predictionsSummary').innerHTML = '';
    }
    
    // Suggestions IA et consensus
    if (typeof enhanceMatchCardsWithConsensus === 'function') {
        await enhanceMatchCardsWithConsensus();
    }
}

// ===============================
// ORCHESTRATEUR : SAUVEGARDE
// ===============================

async function handleSavePredictions() {
    const now = new Date().toISOString();
    
    let teamsWithElo = [];
    if (typeof EloSystem !== 'undefined') {
        teamsWithElo = EloSystem.recalculateAllEloRatings(allTeams, allMatches);
    }
    
    const matchesThisDay = getMatchDayMatches(selectedMatchDay, allMatches, futureMatches);
    
    // Récupérer les anciens pronostics
    const existingPredictions = await getPlayerPredictions(currentPlayer.id, currentSeason, selectedMatchDay);
    const existingMap = {};
    if (existingPredictions?.predictions) {
        existingPredictions.predictions.forEach(p => {
            existingMap[`${p.homeTeamId}-${p.awayTeamId}`] = p;
        });
    }
    
    // Récupérer les jokers
    let jokers = { used: [] };
    if (currentPlayer && currentSeason && typeof getPlayerJokers === 'function') {
        jokers = await getPlayerJokers(currentPlayer.id, currentSeason);
    }
    
    // Construire les prédictions depuis le DOM
    const predictions = [];
    
    for (const matchEl of document.querySelectorAll('.prediction-match')) {
        const homeTeamId = parseInt(matchEl.dataset.home);
        const awayTeamId = parseInt(matchEl.dataset.away);
        const homeScore = matchEl.querySelector('.home-score').value;
        const awayScore = matchEl.querySelector('.away-score').value;
        
        if (homeScore === '' || awayScore === '') continue;
        
        const key = `${homeTeamId}-${awayTeamId}`;
        const existing = existingMap[key];
        const predHomeScore = parseInt(homeScore);
        const predAwayScore = parseInt(awayScore);
        
        let predictedResult;
        if (predHomeScore > predAwayScore) predictedResult = 'home';
        else if (predHomeScore < predAwayScore) predictedResult = 'away';
        else predictedResult = 'draw';
        
        let savedAt = now;
        let odds = null;
        
        // Garder l'ancienne date/cotes si pronostic inchangé
        if (existing && existing.homeScore === predHomeScore && existing.awayScore === predAwayScore) {
            savedAt = existing.savedAt || now;
            odds = existing.odds || null;
        }
        
        // Calculer les cotes si nécessaire
        if (!odds) {
            const match = matchesThisDay.find(m => m.homeTeamId == homeTeamId && m.awayTeamId == awayTeamId);
            if (match && typeof getMatchOdds === 'function') {
                const matchOdds = await getMatchOdds(match, teamsWithElo);
                odds = { home: matchOdds.home, draw: matchOdds.draw, away: matchOdds.away, distribution: matchOdds.distribution || null };
            }
        }
        
        const hasJoker = typeof isJokerOnMatch === 'function' 
            ? isJokerOnMatch(jokers, selectedMatchDay, homeTeamId, awayTeamId)
            : false;
        
        predictions.push({
            homeTeamId, awayTeamId,
            homeScore: predHomeScore, awayScore: predAwayScore,
            savedAt, predictedResult, odds, joker: hasJoker
        });
    }
    
    if (predictions.length === 0) {
        alert('Remplis au moins un pronostic !');
        return;
    }
    
    // Ajouter les picks buteurs
    if (typeof addScorerPicksToPredictions === 'function') {
        addScorerPicksToPredictions(predictions);
    }
    
    // Sauvegarder via Model
    const success = await savePredictions(currentPlayer.id, currentPlayer.pseudo, currentSeason, selectedMatchDay, predictions);
    
    // Sauvegarder le combiné
    if (success && typeof saveCombineWithPredictions === 'function') {
        await saveCombineWithPredictions(currentPlayer.id, currentSeason, selectedMatchDay);
    }
    
    if (success) {
        alert(`✅ ${predictions.length} pronostic(s) sauvegardé(s) !`);
        displayPredictionsForm();
    } else {
        alert('❌ Erreur lors de la sauvegarde');
    }
}

// ===============================
// ORCHESTRATEUR : RÉSUMÉ
// ===============================

async function displayPredictionsSummary(predictionsData, matches) {
    const container = document.getElementById('predictionsSummary');
    
    // Récap consolidé (avec tous les bonus)
    if (typeof getMatchDayRecap === 'function' && typeof renderMatchDayRecap === 'function' && currentPlayer) {
        try {
            const recap = await getMatchDayRecap(currentPlayer.id, selectedMatchDay);
            if (recap) {
                container.innerHTML = renderMatchDayRecap(recap);
                
                if (typeof calculateIAComparison === 'function') {
                    const iaComparison = await calculateIAComparison(currentPlayer.id, selectedMatchDay);
                    if (iaComparison) container.innerHTML += renderIAComparisonSummary(iaComparison);
                }
                return;
            }
        } catch (e) {
            console.error('Erreur récap consolidé:', e);
        }
    }
    
    // Fallback : calcul simple
    let totalPoints = 0, exact = 0, close = 0, good = 0, correct = 0, wrong = 0;
    
    predictionsData.predictions.forEach(pred => {
        const match = matches.find(m => m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId);
        if (match?.finalScore) {
            const result = calculatePredictionResult(
                pred.homeScore, pred.awayScore,
                match.finalScore.home, match.finalScore.away,
                pred.savedAt, match, pred.odds, pred.joker || false
            );
            totalPoints += result.finalPoints || result.points;
            if (result.points === 9) exact++;
            else if (result.points === 6) close++;
            else if (result.points === 5) good++;
            else if (result.points === 3) correct++;
            else wrong++;
        }
    });
    
    container.innerHTML = renderSummaryFallbackHTML({ totalPoints, exact, close, good, correct, wrong }, selectedMatchDay);
    
    if (currentPlayer && typeof calculateIAComparison === 'function') {
        const iaComparison = await calculateIAComparison(currentPlayer.id, selectedMatchDay);
        if (iaComparison) container.innerHTML += renderIAComparisonSummary(iaComparison);
    }
}

// ===============================
// ORCHESTRATEUR : CLASSEMENT
// ===============================

async function loadLeaderboard() {
    const tbody = document.querySelector('#leaderboardTable tbody');
    tbody.innerHTML = '<tr><td colspan="9">Chargement...</td></tr>';
    
    try {
        // Model : récupérer les joueurs et leurs stats
        const players = await getAllPlayers();
        const playersWithStats = [];
        
        for (const player of players) {
            if (typeof calculatePlayerDetailedStats === 'function') {
                const stats = await calculatePlayerDetailedStats(player.id);
                playersWithStats.push({ ...player, calculatedStats: stats });
            } else {
                playersWithStats.push({ ...player, calculatedStats: player.stats || {} });
            }
        }
        
        playersWithStats.sort((a, b) => 
            (b.calculatedStats?.totalPoints || 0) - (a.calculatedStats?.totalPoints || 0)
        );
        
        // View : afficher
        tbody.innerHTML = renderLeaderboardHTML(playersWithStats, currentPlayer);
        updatePlayerRankDisplay(playersWithStats, currentPlayer);
        
        // Widgets complémentaires
        if (typeof renderEvolutionChart === 'function') renderEvolutionChart();
        if (typeof renderMatchDayRankingWidget === 'function') renderMatchDayRankingWidget();
        
    } catch (error) {
        console.error('Erreur loadLeaderboard:', error);
        tbody.innerHTML = '<tr><td colspan="9">Erreur de chargement</td></tr>';
    }
}

// ===============================
// ORCHESTRATEUR : HISTORIQUE
// ===============================

async function loadHistory() {
    const container = document.getElementById('historyList');
    container.innerHTML = '<p style="text-align:center;">Chargement...</p>';
    if (!currentPlayer) return;
    
    try {
        const history = await getPlayerHistory(currentPlayer.id);
        container.innerHTML = renderHistoryHTML(history, allMatches, allTeams);
    } catch (error) {
        console.error('Erreur loadHistory:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur de chargement</p>';
    }
}

// ===============================
// ORCHESTRATEUR : PROFIL
// ===============================

async function renderProfileTab() {
    const container = document.getElementById('profileContent');
    if (!container || !currentPlayer) return;
    container.innerHTML = '<div class="loading">Chargement...</div>';
    
    try {
        // Model : récupérer les stats
        const stats = await calculatePlayerDetailedStats(currentPlayer.id);
        
        // Missions hebdo (async, ajoutées après le rendu principal)
        let missionsHtml = '';
        if (typeof renderWeeklyMissions === 'function') {
            missionsHtml = await renderWeeklyMissions(currentPlayer.id);
        }
        
        // Avatar (async)
        let avatarHtml = '';
        if (typeof renderAvatarSelector === 'function') {
            avatarHtml = await renderAvatarSelector(currentPlayer.id, stats);
        }
        
        // Équipe favorite (async)
        let favoriteHtml = '';
        if (typeof renderFavoriteTeamStats === 'function') {
            favoriteHtml = `
                <div class="profile-section">
                    <h4>💙 Équipe Favorite</h4>
                    ${await renderFavoriteTeamStats(currentPlayer.id)}
                </div>
            `;
        }
        
        // Jokers
        let jokers = null;
        if (typeof getPlayerJokers === 'function') {
            jokers = await getPlayerJokers(currentPlayer.id, currentSeason);
        }
        
        // View : assembler le HTML
        let html = renderProfileHTML(stats, currentPlayer, currentSeason, jokers);
        html = missionsHtml + avatarHtml + html + favoriteHtml;
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erreur renderProfileTab:', error);
        container.innerHTML = '<p style="color:#e74c3c;">Erreur de chargement</p>';
    }
}

console.log('🎮 Module pronostics-controller chargé');