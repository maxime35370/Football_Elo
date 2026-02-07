// calendar-predictions.js - Onglet Pronostics IA et classement final

// ===============================
// INITIALISATION PRONOSTICS
// ===============================

function initPredictions() {
    loadStoredPredictions();
    
    const expectedMatchesPerDayCalc = Math.floor(allTeams.length / 2);
    let lastPlayedMatchDay = 0;
    const maxMatchDayInAll = Math.max(...allMatches.map(m => m.matchDay || 0), 0);
    for (let day = 1; day <= maxMatchDayInAll; day++) {
        const playedInDay = allMatches.filter(m => m.matchDay === day && m.finalScore).length;
        if (playedInDay >= expectedMatchesPerDayCalc) {
            lastPlayedMatchDay = day;
        } else {
            break;
        }
    }
    const maxFutureMatchDay = futureMatches.length > 0 
        ? Math.max(...futureMatches.map(m => m.matchDay || 0)) 
        : lastPlayedMatchDay;
    
    const matchesInLastDay = allMatches.filter(m => m.matchDay === lastPlayedMatchDay).length;
    const expectedMatchesPerDay = Math.floor(allTeams.length / 2);
    
    if (matchesInLastDay < expectedMatchesPerDay && lastPlayedMatchDay > 0) {
        currentPredictionMatchDay = lastPlayedMatchDay;
    } else {
        currentPredictionMatchDay = lastPlayedMatchDay + 1;
    }
    
    const matchesAtDay = futureMatches.filter(m => m.matchDay === currentPredictionMatchDay);
    if (matchesAtDay.length === 0 && currentPredictionMatchDay <= maxFutureMatchDay) {
        for (let day = currentPredictionMatchDay; day <= maxFutureMatchDay; day++) {
            if (futureMatches.filter(m => m.matchDay === day).length > 0) {
                currentPredictionMatchDay = day;
                break;
            }
        }
    }
    
    // Événements de navigation
    document.getElementById('prevMatchdayBtn')?.addEventListener('click', () => {
        navigatePredictionMatchDay(-1);
    });
    document.getElementById('nextMatchdayBtn')?.addEventListener('click', () => {
        navigatePredictionMatchDay(1);
    });
    
    // Événements des boutons
    document.getElementById('generateAllPredictionsBtn')?.addEventListener('click', generateAllPredictions);
    document.getElementById('recalculatePredictionsBtn')?.addEventListener('click', recalculatePredictions);
}

function loadStoredPredictions() {
    try {
        const stored = localStorage.getItem(`footballEloPredictions_${currentSeason}`);
        storedPredictions = stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error('Erreur chargement pronostics:', e);
        storedPredictions = null;
    }
}

function saveStoredPredictions() {
    try {
        localStorage.setItem(`footballEloPredictions_${currentSeason}`, JSON.stringify(storedPredictions));
    } catch (e) {
        console.error('Erreur sauvegarde pronostics:', e);
    }
}

function navigatePredictionMatchDay(direction) {
    const maxMatchDay = Math.max(
        ...allMatches.map(m => m.matchDay || 0),
        ...futureMatches.map(m => m.matchDay || 0)
    );
    
    const newDay = currentPredictionMatchDay + direction;
    
    if (newDay >= 1 && newDay <= maxMatchDay) {
        currentPredictionMatchDay = newDay;
        displayPredictions();
    }
}

// ===============================
// AFFICHAGE DES PRONOSTICS
// ===============================

function displayPredictions() {
    const container = document.getElementById('predictionsContent');
    const title = document.getElementById('predictionsTitle');
    
    if (!container) return;
    
    if (currentPredictionMatchDay === null) {
        initPredictions();
    }
    
    if (title) {
        title.textContent = `🎰 Pronostics - Journée ${currentPredictionMatchDay}`;
    }
    
    updatePredictionNavButtons();
    
    // Vérifier si des pronostics existent pour cette journée
    let predictions = null;
    
    if (storedPredictions && storedPredictions.matchDays && storedPredictions.matchDays[currentPredictionMatchDay]) {
        const dayData = storedPredictions.matchDays[currentPredictionMatchDay];
        
        // Mettre à jour avec les résultats réels
        dayData.matches = dayData.matches.map(pred => {
            const playedMatch = allMatches.find(m => 
                m.matchDay === currentPredictionMatchDay &&
                m.homeTeamId == pred.homeTeamId && 
                m.awayTeamId == pred.awayTeamId
            );
            
            if (playedMatch && playedMatch.finalScore) {
                pred.actualScore = {
                    home: playedMatch.finalScore.home,
                    away: playedMatch.finalScore.away
                };
            }
            
            return pred;
        });
        
        predictions = dayData.matches;
    }
    
    // Si pas de pronostics stockés
    if (!predictions || predictions.length === 0) {
        const upcomingMatches = futureMatches.filter(m => m.matchDay === currentPredictionMatchDay);
        
        if (upcomingMatches.length === 0) {
            const playedMatches = allMatches.filter(m => m.matchDay === currentPredictionMatchDay);
            
            if (playedMatches.length > 0) {
                container.innerHTML = `
                    <div class="predictions-end">
                        <div class="icon">✅</div>
                        <h3>Journée ${currentPredictionMatchDay} terminée</h3>
                        <p>Tous les matchs ont été joués.</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="predictions-end">
                        <div class="icon">📅</div>
                        <h3>Pas de matchs pour cette journée</h3>
                        <p>Utilisez les boutons de navigation pour voir d'autres journées.</p>
                    </div>
                `;
            }
            return;
        }
        
        container.innerHTML = `
            <div class="predictions-end">
                <div class="icon">🔮</div>
                <h3>Pronostics non générés</h3>
                <p>Cliquez sur "Générer tous les pronostics" pour calculer les prédictions de la saison.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = predictions.map(pred => createPredictionCard(pred)).join('');
    displayFinalRanking();
}

function updatePredictionNavButtons() {
    const prevBtn = document.getElementById('prevMatchdayBtn');
    const nextBtn = document.getElementById('nextMatchdayBtn');
    
    const maxMatchDay = Math.max(
        ...allMatches.map(m => m.matchDay || 0),
        ...futureMatches.map(m => m.matchDay || 0),
        0
    );
    
    if (prevBtn) {
        prevBtn.disabled = currentPredictionMatchDay <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPredictionMatchDay >= maxMatchDay;
    }
}

// ===============================
// GÉNÉRATION DES PRONOSTICS
// ===============================

function generateAllPredictions() {
    const expectedMatchesPerDayCalc = Math.floor(allTeams.length / 2);
    let lastPlayedMatchDay = 0;
    const maxMatchDayInAll = Math.max(...allMatches.map(m => m.matchDay || 0), 0);
    for (let day = 1; day <= maxMatchDayInAll; day++) {
        const playedInDay = allMatches.filter(m => m.matchDay === day && m.finalScore).length;
        if (playedInDay >= expectedMatchesPerDayCalc) {
            lastPlayedMatchDay = day;
        } else {
            break;
        }
    }
    const maxFutureMatchDay = futureMatches.length > 0 
        ? Math.max(...futureMatches.map(m => m.matchDay || 0)) 
        : lastPlayedMatchDay;
    
    if (futureMatches.length === 0) {
        alert('Aucun match à venir. Générez d\'abord le calendrier.');
        return;
    }
    
    // Initialiser l'Elo simulé
    let simulatedElo = {};
    teamsWithElo.forEach(t => {
        simulatedElo[t.id] = t.eloRating || 1500;
    });
    
    // Initialiser les stats simulées
    const currentRanking = generateRanking(null, currentSeason, null, false, 'all');
    let simulatedStats = {};
    allTeams.forEach(team => {
        const teamData = currentRanking.find(t => t.id == team.id);
        simulatedStats[team.id] = {
            played: teamData ? teamData.played : 0,
            won: teamData ? teamData.won : 0,
            drawn: teamData ? teamData.drawn : 0,
            lost: teamData ? teamData.lost : 0,
            goalsFor: teamData ? teamData.goalsFor : 0,
            goalsAgainst: teamData ? teamData.goalsAgainst : 0,
            points: teamData ? teamData.points : 0
        };
    });
    
    storedPredictions = {
        generatedAt: new Date().toISOString(),
        season: currentSeason,
        matchDays: {}
    };
    
    // Parcourir chaque journée
    for (let day = lastPlayedMatchDay + 1; day <= maxFutureMatchDay; day++) {
        const matchesThisDay = futureMatches.filter(m => m.matchDay === day);
        
        if (matchesThisDay.length === 0) continue;
        
        const playedMatchesThisDay = allMatches.filter(m => m.matchDay === day);
        const simulatedRanking = calculateSimulatedRanking(simulatedStats);
        
        const dayPredictions = {
            matches: [],
            simulatedEloAfter: {},
            simulatedRankingBefore: simulatedRanking.map(t => ({ id: t.id, rank: t.rank }))
        };
        
        matchesThisDay.forEach(match => {
            const playedMatch = playedMatchesThisDay.find(m => 
                m.homeTeamId == match.homeTeamId && m.awayTeamId == match.awayTeamId
            );
            
            const homeRankData = simulatedRanking.find(t => t.id == match.homeTeamId);
            const awayRankData = simulatedRanking.find(t => t.id == match.awayTeamId);
            const homeRank = homeRankData ? homeRankData.rank : 0;
            const awayRank = awayRankData ? awayRankData.rank : 0;
            
            const prediction = generateSinglePredictionWithSimulated(match, simulatedElo, homeRank, awayRank, simulatedStats);
            
            if (playedMatch && playedMatch.finalScore) {
                prediction.actualScore = {
                    home: playedMatch.finalScore.home,
                    away: playedMatch.finalScore.away
                };
            }
            
            dayPredictions.matches.push(prediction);
        });
        
        // Mettre à jour l'Elo et les stats simulés
        dayPredictions.matches.forEach(pred => {
            const homeScore = pred.actualScore ? pred.actualScore.home : pred.predictedScore.home;
            const awayScore = pred.actualScore ? pred.actualScore.away : pred.predictedScore.away;
            
            const eloChange = calculateEloChange(
                simulatedElo[pred.homeTeamId],
                simulatedElo[pred.awayTeamId],
                homeScore,
                awayScore
            );
            
            simulatedElo[pred.homeTeamId] += eloChange.home;
            simulatedElo[pred.awayTeamId] += eloChange.away;
            
            simulatedStats[pred.homeTeamId].played++;
            simulatedStats[pred.awayTeamId].played++;
            simulatedStats[pred.homeTeamId].goalsFor += homeScore;
            simulatedStats[pred.homeTeamId].goalsAgainst += awayScore;
            simulatedStats[pred.awayTeamId].goalsFor += awayScore;
            simulatedStats[pred.awayTeamId].goalsAgainst += homeScore;
            
            if (homeScore > awayScore) {
                simulatedStats[pred.homeTeamId].won++;
                simulatedStats[pred.homeTeamId].points += 3;
                simulatedStats[pred.awayTeamId].lost++;
            } else if (homeScore < awayScore) {
                simulatedStats[pred.awayTeamId].won++;
                simulatedStats[pred.awayTeamId].points += 3;
                simulatedStats[pred.homeTeamId].lost++;
            } else {
                simulatedStats[pred.homeTeamId].drawn++;
                simulatedStats[pred.awayTeamId].drawn++;
                simulatedStats[pred.homeTeamId].points += 1;
                simulatedStats[pred.awayTeamId].points += 1;
            }
        });
        
        dayPredictions.simulatedEloAfter = { ...simulatedElo };
        storedPredictions.matchDays[day] = dayPredictions;
    }
    
    saveStoredPredictions();
    displayPredictions();
    
    const numDays = Object.keys(storedPredictions.matchDays).length;
    const numMatches = Object.values(storedPredictions.matchDays).reduce((sum, day) => sum + day.matches.length, 0);
    
    alert(`✅ Pronostics générés !\n\n📊 ${numMatches} matchs sur ${numDays} journées\n\nLes pronostics prennent en compte l'évolution de l'Elo ET du classement simulé après chaque journée.`);
    
    displayFinalRanking();
}

function recalculatePredictions() {
    if (!confirm('Recalculer tous les pronostics avec les derniers résultats réels ?')) {
        return;
    }
    
    storedPredictions = null;
    localStorage.removeItem(`footballEloPredictions_${currentSeason}`);
    
    generateAllPredictions();
}

// ===============================
// GÉNÉRATION D'UN PRONOSTIC
// ===============================

function generateSinglePredictionWithSimulated(match, eloMap, homeRank, awayRank, simulatedStats) {
    const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
    
    const homeElo = eloMap[match.homeTeamId] || 1500;
    const awayElo = eloMap[match.awayTeamId] || 1500;
    
    const config = getSeasonConfig();
    const totalTeams = allTeams.length;
    const relegationPosition = totalTeams - config.relegationPlaces;
    
    const factors = [];
    let homeBonus = 0;
    let awayBonus = 0;
    
    // 1. Avantage domicile
    const homeAdvantage = 50;
    homeBonus += homeAdvantage;
    
    // 2. Forme récente
    const homeForm = getTeamRecentForm(match.homeTeamId);
    const awayForm = getTeamRecentForm(match.awayTeamId);
    
    if (homeForm.streak >= 3 && homeForm.type === 'W') {
        homeBonus += 30;
        factors.push({ text: `🔥 ${homeTeam.shortName}: ${homeForm.streak}V`, team: 'home', type: 'positive' });
    } else if (homeForm.streak >= 3 && homeForm.type === 'L') {
        homeBonus -= 20;
        factors.push({ text: `📉 ${homeTeam.shortName}: ${homeForm.streak}D`, team: 'home', type: 'negative' });
    }
    
    if (awayForm.streak >= 3 && awayForm.type === 'W') {
        awayBonus += 30;
        factors.push({ text: `🔥 ${awayTeam.shortName}: ${awayForm.streak}V`, team: 'away', type: 'positive' });
    } else if (awayForm.streak >= 3 && awayForm.type === 'L') {
        awayBonus -= 20;
        factors.push({ text: `📉 ${awayTeam.shortName}: ${awayForm.streak}D`, team: 'away', type: 'negative' });
    }
    
    // 3. Enjeux - Course au titre
    const homeInTitle = homeRank <= config.championPlaces + 2;
    const awayInTitle = awayRank <= config.championPlaces + 2;
    
    if (homeInTitle) {
        homeBonus += 25;
        factors.push({ text: `🏆 ${homeTeam.shortName}: Titre`, team: 'home', type: 'neutral' });
    }
    if (awayInTitle) {
        awayBonus += 25;
        factors.push({ text: `🏆 ${awayTeam.shortName}: Titre`, team: 'away', type: 'neutral' });
    }
    
    // 4. Enjeux - Course à l'Europe
    const homeInEurope = homeRank > config.championPlaces && homeRank <= config.europeanPlaces + 2;
    const awayInEurope = awayRank > config.championPlaces && awayRank <= config.europeanPlaces + 2;
    
    if (homeInEurope) {
        homeBonus += 15;
        factors.push({ text: `⭐ ${homeTeam.shortName}: Europe`, team: 'home', type: 'neutral' });
    }
    if (awayInEurope) {
        awayBonus += 15;
        factors.push({ text: `⭐ ${awayTeam.shortName}: Europe`, team: 'away', type: 'neutral' });
    }
    
    // 5. Enjeux - Lutte pour le maintien
    const homeInRelegation = homeRank > relegationPosition - 3;
    const awayInRelegation = awayRank > relegationPosition - 3;
    
    if (homeInRelegation) {
        homeBonus += 20;
        factors.push({ text: `🛡️ ${homeTeam.shortName}: Maintien`, team: 'home', type: 'neutral' });
    }
    if (awayInRelegation) {
        awayBonus += 20;
        factors.push({ text: `🛡️ ${awayTeam.shortName}: Maintien`, team: 'away', type: 'neutral' });
    }
    
    // 6. Adversaire direct
    const isDirectRival = Math.abs(homeRank - awayRank) <= 3;
    if (isDirectRival) {
        factors.push({ text: '⚔️ Duel direct', team: 'both', type: 'neutral' });
    }
    
    // Calculer les probabilités
    const adjustedHomeElo = homeElo + homeBonus;
    const adjustedAwayElo = awayElo + awayBonus;
    
    const homeExpectancy = 1 / (1 + Math.pow(10, (adjustedAwayElo - adjustedHomeElo) / 400));
    
    const eloDiff = Math.abs(adjustedHomeElo - adjustedAwayElo);
    let drawProb = Math.max(0.18, 0.32 - (eloDiff / 800));
    
    if (isDirectRival) {
        drawProb = Math.min(0.35, drawProb + 0.05);
    }
    
    let homeWinProb = homeExpectancy * (1 - drawProb);
    let awayWinProb = (1 - homeExpectancy) * (1 - drawProb);
    
    // Normaliser
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb = homeWinProb / total;
    drawProb = drawProb / total;
    awayWinProb = awayWinProb / total;
    
    // Générer le score prédit
    const predictedScore = generatePredictedScore(homeWinProb, drawProb, awayWinProb, adjustedHomeElo, adjustedAwayElo);
    
    // Déterminer le favori
    let favorite = 'draw';
    let favoriteProb = drawProb;
    if (homeWinProb > drawProb && homeWinProb > awayWinProb) {
        favorite = 'home';
        favoriteProb = homeWinProb;
    } else if (awayWinProb > drawProb && awayWinProb > homeWinProb) {
        favorite = 'away';
        favoriteProb = awayWinProb;
    }
    
    // Déterminer les enjeux
    const stakes = [];
    if (homeInTitle || awayInTitle) stakes.push('title');
    if (homeInEurope || awayInEurope) stakes.push('europe');
    if (homeInRelegation || awayInRelegation) stakes.push('relegation');
    if (isDirectRival) stakes.push('direct');
    if ((homeForm.streak >= 3) || (awayForm.streak >= 3)) stakes.push('streak');
    
    return {
        matchId: match.id,
        matchDay: match.matchDay,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeTeamName: homeTeam ? homeTeam.shortName : '?',
        awayTeamName: awayTeam ? awayTeam.shortName : '?',
        homeElo,
        awayElo,
        homeRank,
        awayRank,
        homeForm,
        awayForm,
        homeWinProb: Math.round(homeWinProb * 100),
        drawProb: Math.round(drawProb * 100),
        awayWinProb: Math.round(awayWinProb * 100),
        predictedScore,
        actualScore: null,
        favorite,
        favoriteProb: Math.round(favoriteProb * 100),
        factors,
        stakes
    };
}

function calculateEloChange(homeElo, awayElo, homeScore, awayScore) {
    const K = 32;
    const homeAdvantage = 50;
    
    const adjustedHomeElo = homeElo + homeAdvantage;
    
    const expectedHome = 1 / (1 + Math.pow(10, (awayElo - adjustedHomeElo) / 400));
    const expectedAway = 1 - expectedHome;
    
    let actualHome, actualAway;
    if (homeScore > awayScore) {
        actualHome = 1;
        actualAway = 0;
    } else if (homeScore < awayScore) {
        actualHome = 0;
        actualAway = 1;
    } else {
        actualHome = 0.5;
        actualAway = 0.5;
    }
    
    return {
        home: Math.round(K * (actualHome - expectedHome)),
        away: Math.round(K * (actualAway - expectedAway))
    };
}

function getTeamRecentForm(teamId) {
    const teamMatches = allMatches
        .filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId)
        .sort((a, b) => (b.matchDay || 0) - (a.matchDay || 0))
        .slice(0, 5);
    
    if (teamMatches.length === 0) {
        return { form: [], streak: 0, type: null };
    }
    
    const form = teamMatches.map(match => {
        const isHome = match.homeTeamId == teamId;
        const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
        const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
        
        if (goalsFor > goalsAgainst) return 'W';
        if (goalsFor < goalsAgainst) return 'L';
        return 'D';
    });
    
    let streak = 1;
    const currentType = form[0];
    for (let i = 1; i < form.length; i++) {
        if (form[i] === currentType) streak++;
        else break;
    }
    
    return { form, streak, type: currentType };
}

function generatePredictedScore(homeWinProb, drawProb, awayWinProb, homeElo, awayElo) {
    const results = [
        { type: 'home', prob: homeWinProb },
        { type: 'draw', prob: drawProb },
        { type: 'away', prob: awayWinProb }
    ].sort((a, b) => b.prob - a.prob);
    
    const best = results[0];
    const second = results[1];
    const third = results[2];
    
    const gapFirstSecond = best.prob - second.prob;
    
    let result;
    const random = Math.random();
    
    const thirdChance = Math.max(0.03, third.prob * 0.3);
    
    if (random < thirdChance && third.prob >= 0.10) {
        result = third.type;
    } else if (gapFirstSecond > 0.15) {
        result = best.type;
    } else if (gapFirstSecond > 0.10) {
        result = Math.random() < 0.10 ? second.type : best.type;
    } else if (gapFirstSecond > 0.05) {
        result = Math.random() < 0.20 ? second.type : best.type;
    } else {
        result = Math.random() < 0.35 ? second.type : best.type;
    }
    
    let homeGoals, awayGoals;
    
    const avgElo = 1500;
    const homeOffense = 1.3 + (homeElo - avgElo) / 500;
    const awayOffense = 1.0 + (awayElo - avgElo) / 500;
    
    if (result === 'home') {
        const dominance = homeWinProb - awayWinProb;
        let scoreDiff;
        if (dominance > 0.4) {
            scoreDiff = 3;
        } else if (dominance > 0.25) {
            scoreDiff = 2;
        } else {
            scoreDiff = 1;
        }
        
        homeGoals = Math.max(1, Math.round(homeOffense));
        awayGoals = Math.max(0, homeGoals - scoreDiff);
    } else if (result === 'away') {
        const dominance = awayWinProb - homeWinProb;
        let scoreDiff;
        if (dominance > 0.4) {
            scoreDiff = 3;
        } else if (dominance > 0.25) {
            scoreDiff = 2;
        } else {
            scoreDiff = 1;
        }
        
        awayGoals = Math.max(1, Math.round(awayOffense));
        homeGoals = Math.max(0, awayGoals - scoreDiff);
    } else {
        const avgOffense = (homeOffense + awayOffense) / 2;
        if (avgOffense < 1.1) {
            homeGoals = 0;
            awayGoals = 0;
        } else if (avgOffense < 1.4) {
            homeGoals = 1;
            awayGoals = 1;
        } else {
            homeGoals = 2;
            awayGoals = 2;
        }
    }
    
    return { home: homeGoals, away: awayGoals };
}

// ===============================
// CARTE DE PRONOSTIC
// ===============================

function createPredictionCard(pred) {
    const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
    const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
    
    // Badges d'enjeux
    const stakeBadges = pred.stakes.map(stake => {
        const labels = {
            'title': '🏆 Titre',
            'europe': '⭐ Europe',
            'relegation': '🛡️ Maintien',
            'direct': '⚔️ Duel direct',
            'streak': '🔥 Série'
        };
        return `<span class="stake-badge ${stake}">${labels[stake]}</span>`;
    }).join('');
    
    // Forme récente
    const homeFormDots = pred.homeForm.form.map(f => `<span class="form-dot ${f}"></span>`).join('');
    const awayFormDots = pred.awayForm.form.map(f => `<span class="form-dot ${f}"></span>`).join('');
    
    // Facteurs
    const factorTags = pred.factors.map(f => {
        let tagClass = f.type;
        return `<span class="factor-tag ${tagClass}">${f.text}</span>`;
    }).join('');
    
    // Texte du favori
    let favoriteText = '';
    let favoriteClass = '';
    if (pred.favorite === 'home') {
        favoriteText = `🏠 ${pred.homeTeamName} (${pred.favoriteProb}%)`;
        favoriteClass = 'home';
    } else if (pred.favorite === 'away') {
        favoriteText = `✈️ ${pred.awayTeamName} (${pred.favoriteProb}%)`;
        favoriteClass = 'away';
    } else {
        favoriteText = `🤝 Match nul (${pred.favoriteProb}%)`;
        favoriteClass = 'draw';
    }
    
    // Section résultat réel
    let actualResultSection = '';
    if (pred.actualScore) {
        const predResult = getPredictionResult(pred.predictedScore);
        const actualResult = getPredictionResult(pred.actualScore);
        const isCorrect = predResult === actualResult;
        const isExact = pred.predictedScore.home === pred.actualScore.home && 
                        pred.predictedScore.away === pred.actualScore.away;
        
        let resultClass = 'wrong';
        let resultIcon = '❌';
        if (isExact) {
            resultClass = 'exact';
            resultIcon = '🎯';
        } else if (isCorrect) {
            resultClass = 'correct';
            resultIcon = '✅';
        }
        
        actualResultSection = `
            <div class="actual-result ${resultClass}">
                <div class="actual-result-header">
                    ${resultIcon} Résultat réel
                </div>
                <div class="actual-score">
                    ${pred.actualScore.home} - ${pred.actualScore.away}
                </div>
                <div class="prediction-comparison">
                    Pronostic: ${pred.predictedScore.home} - ${pred.predictedScore.away}
                    ${isExact ? '<span class="badge-exact">Score exact !</span>' : 
                      isCorrect ? '<span class="badge-correct">Bon résultat</span>' : 
                      '<span class="badge-wrong">Raté</span>'}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="prediction-card ${pred.actualScore ? 'has-result' : ''}">
            <div class="prediction-card-header">
                <span class="match-info">Match ${pred.homeRank > 0 ? pred.homeRank : '?'}e vs ${pred.awayRank > 0 ? pred.awayRank : '?'}e</span>
                <div class="match-stakes">${stakeBadges}</div>
            </div>
            <div class="prediction-card-body">
                <div class="prediction-teams">
                    <div class="prediction-team home">
                        <div class="team-name-pred">${pred.homeTeamName}</div>
                        <div class="team-details">
                            <span class="team-elo">Elo: ${pred.homeElo}</span>
                            <span class="team-form">${homeFormDots}</span>
                            <span class="team-location">🏠 Domicile</span>
                        </div>
                    </div>
                    <div class="prediction-score">
                        <div class="score-display">${pred.predictedScore.home} - ${pred.predictedScore.away}</div>
                        <div class="score-label">Pronostic</div>
                    </div>
                    <div class="prediction-team away">
                        <div class="team-name-pred">${pred.awayTeamName}</div>
                        <div class="team-details">
                            <span class="team-elo">Elo: ${pred.awayElo}</span>
                            <span class="team-form">${awayFormDots}</span>
                            <span class="team-location">✈️ Extérieur</span>
                        </div>
                    </div>
                </div>
                
                ${actualResultSection}
                
                <div class="prediction-probabilities">
                    <div class="prob-bar-container">
                        <div class="prob-segment home-win" style="flex: ${pred.homeWinProb}">${pred.homeWinProb}%</div>
                        <div class="prob-segment draw" style="flex: ${pred.drawProb}">${pred.drawProb}%</div>
                        <div class="prob-segment away-win" style="flex: ${pred.awayWinProb}">${pred.awayWinProb}%</div>
                    </div>
                    <div class="prob-labels">
                        <span>Victoire ${pred.homeTeamName}</span>
                        <span>Nul</span>
                        <span>Victoire ${pred.awayTeamName}</span>
                    </div>
                </div>
                
                <div class="prediction-favorite">
                    <div class="favorite-label">⭐ Favori</div>
                    <div class="favorite-team ${favoriteClass}">${favoriteText}</div>
                </div>
                
                <div class="prediction-factors">
                    ${factorTags}
                </div>
            </div>
        </div>
    `;
}

function getPredictionResult(score) {
    if (score.home > score.away) return 'home';
    if (score.home < score.away) return 'away';
    return 'draw';
}

// ===============================
// CLASSEMENT FINAL PROJETÉ
// ===============================

function displayFinalRanking() {
    const section = document.getElementById('finalRankingSection');
    const container = document.getElementById('finalRankingContent');
    
    if (!section || !container) return;
    
    if (!storedPredictions || !storedPredictions.matchDays) {
        section.style.display = 'none';
        return;
    }
    
    const matchDays = Object.keys(storedPredictions.matchDays).map(Number).sort((a, b) => a - b);
    
    if (matchDays.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    // Calculer le classement final
    const currentRanking = generateRanking(null, currentSeason, null, false, 'all');
    let finalStats = {};
    
    allTeams.forEach(team => {
        const teamData = currentRanking.find(t => t.id == team.id);
        finalStats[team.id] = {
            played: teamData ? teamData.played : 0,
            won: teamData ? teamData.won : 0,
            drawn: teamData ? teamData.drawn : 0,
            lost: teamData ? teamData.lost : 0,
            goalsFor: teamData ? teamData.goalsFor : 0,
            goalsAgainst: teamData ? teamData.goalsAgainst : 0,
            points: teamData ? teamData.points : 0
        };
    });
    
    // Appliquer tous les pronostics
    matchDays.forEach(day => {
        const dayData = storedPredictions.matchDays[day];
        if (!dayData || !dayData.matches) return;
        
        dayData.matches.forEach(pred => {
            const homeScore = pred.actualScore ? pred.actualScore.home : pred.predictedScore.home;
            const awayScore = pred.actualScore ? pred.actualScore.away : pred.predictedScore.away;
            
            finalStats[pred.homeTeamId].played++;
            finalStats[pred.awayTeamId].played++;
            finalStats[pred.homeTeamId].goalsFor += homeScore;
            finalStats[pred.homeTeamId].goalsAgainst += awayScore;
            finalStats[pred.awayTeamId].goalsFor += awayScore;
            finalStats[pred.awayTeamId].goalsAgainst += homeScore;
            
            if (homeScore > awayScore) {
                finalStats[pred.homeTeamId].won++;
                finalStats[pred.homeTeamId].points += 3;
                finalStats[pred.awayTeamId].lost++;
            } else if (homeScore < awayScore) {
                finalStats[pred.awayTeamId].won++;
                finalStats[pred.awayTeamId].points += 3;
                finalStats[pred.homeTeamId].lost++;
            } else {
                finalStats[pred.homeTeamId].drawn++;
                finalStats[pred.awayTeamId].drawn++;
                finalStats[pred.homeTeamId].points += 1;
                finalStats[pred.awayTeamId].points += 1;
            }
        });
    });
    
    // Créer le classement final
    const finalRanking = allTeams.map(team => {
        const stats = finalStats[team.id];
        const currentTeamData = currentRanking.find(t => t.id == team.id);
        const currentPosition = currentTeamData ? currentRanking.indexOf(currentTeamData) + 1 : 0;
        
        return {
            id: team.id,
            shortName: team.shortName,
            played: stats.played,
            won: stats.won,
            drawn: stats.drawn,
            lost: stats.lost,
            goalsFor: stats.goalsFor,
            goalsAgainst: stats.goalsAgainst,
            goalDifference: stats.goalsFor - stats.goalsAgainst,
            points: stats.points,
            currentPosition: currentPosition
        };
    });
    
    // Trier
    finalRanking.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
    
    // Ajouter les positions finales
    finalRanking.forEach((team, index) => {
        team.finalPosition = index + 1;
        team.positionChange = team.currentPosition - team.finalPosition;
    });
    
    const config = getSeasonConfig();
    const totalTeams = finalRanking.length;
    const relegationPosition = totalTeams - config.relegationPlaces;
    
    // Générer le HTML
    let html = `
        <table class="final-ranking-table">
            <thead>
                <tr>
                    <th>Pos.</th>
                    <th>Équipe</th>
                    <th>MJ</th>
                    <th>V</th>
                    <th>N</th>
                    <th>D</th>
                    <th>BP</th>
                    <th>BC</th>
                    <th>Diff</th>
                    <th>Pts</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    finalRanking.forEach((team, index) => {
        const position = index + 1;
        
        let rowClass = '';
        let zoneBadge = '';
        
        if (position <= config.championPlaces) {
            rowClass = 'champion-row';
            zoneBadge = '<span class="zone-badge champion">🏆</span>';
        } else if (position <= config.europeanPlaces) {
            rowClass = 'europe-row';
            zoneBadge = '<span class="zone-badge europe">⭐</span>';
        } else if (position > relegationPosition) {
            rowClass = 'relegation-row';
            zoneBadge = '<span class="zone-badge relegation">⬇️</span>';
        }
        
        let changeIcon = '';
        let changeClass = 'same';
        if (team.positionChange > 0) {
            changeIcon = `▲${team.positionChange}`;
            changeClass = 'up';
        } else if (team.positionChange < 0) {
            changeIcon = `▼${Math.abs(team.positionChange)}`;
            changeClass = 'down';
        } else {
            changeIcon = '=';
        }
        
        html += `
            <tr class="${rowClass}">
                <td class="position">
                    ${position}
                    <span class="position-change ${changeClass}">${changeIcon}</span>
                </td>
                <td>
                    <div class="team-name">
                        ${team.shortName}
                        ${zoneBadge}
                    </div>
                </td>
                <td>${team.played}</td>
                <td>${team.won}</td>
                <td>${team.drawn}</td>
                <td>${team.lost}</td>
                <td>${team.goalsFor}</td>
                <td>${team.goalsAgainst}</td>
                <td>${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</td>
                <td><strong>${team.points}</strong></td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    // Statistiques récapitulatives
    const champion = finalRanking[0];
    const relegated = finalRanking.slice(-config.relegationPlaces);
    const biggestClimber = finalRanking.reduce((max, t) => t.positionChange > max.positionChange ? t : max, finalRanking[0]);
    const biggestFaller = finalRanking.reduce((min, t) => t.positionChange < min.positionChange ? t : min, finalRanking[0]);
    
    html += `
        <div class="final-stats">
            <div class="final-stat-card">
                <div class="stat-icon">🏆</div>
                <div class="stat-value">${champion.shortName}</div>
                <div class="stat-label">Champion (${champion.points} pts)</div>
            </div>
            <div class="final-stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-value">${biggestClimber.shortName}</div>
                <div class="stat-label">+${biggestClimber.positionChange} places</div>
            </div>
            <div class="final-stat-card">
                <div class="stat-icon">📉</div>
                <div class="stat-value">${biggestFaller.shortName}</div>
                <div class="stat-label">${biggestFaller.positionChange} places</div>
            </div>
            <div class="final-stat-card">
                <div class="stat-icon">⬇️</div>
                <div class="stat-value">${relegated.map(t => t.shortName).join(', ')}</div>
                <div class="stat-label">Relégués</div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    section.style.display = 'block';
}