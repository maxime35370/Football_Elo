// pronostics-stats.js - Statistiques détaillées des joueurs et graphique d'évolution

// ===============================
// CALCUL DES STATISTIQUES
// ===============================

async function calculatePlayerDetailedStats(playerId) {
    const stats = {
        playerId: playerId,
        totalPoints: 0,
        totalPredictions: 0,
        
        // Par résultat
        exactScores: 0,      // 🎯 9 pts
        closeScores: 0,      // 🎯 6 pts
        goodScores: 0,       // ✅ 4 pts
        correctResults: 0,   // ✅ 3 pts
        wrongResults: 0,     // ❌ 0 pts
        latePredictions: 0,  // ⏰ 0 pts
        
        // Par type de résultat (1/N/2)
        homeWins: { predicted: 0, correct: 0 },
        draws: { predicted: 0, correct: 0 },
        awayWins: { predicted: 0, correct: 0 },
        
        // Par équipe
        teamAccuracy: {},
        
        // Séries
        currentStreak: 0,
        currentStreakType: null, // 'good' ou 'bad'
        bestStreak: 0,
        worstStreak: 0,
        
        // Évolution par journée
        pointsByMatchDay: {},
        cumulativePoints: {},
        
        // Journées jouées
        journeysPlayed: []
    };
    
    try {
        // Récupérer l'historique du joueur
        const history = await getPlayerHistory(playerId);
        
        if (!history || history.length === 0) {
            return stats;
        }
        
        // Variables pour calculer les séries
        let currentStreakCount = 0;
        let currentStreakGood = null;
        let tempBestStreak = 0;
        let tempWorstStreak = 0;
        
        // Trier par journée croissante
        history.sort((a, b) => a.matchDay - b.matchDay);
        
        let cumulativeTotal = 0;
        
        for (const entry of history) {
            const matchDay = entry.matchDay;
            
            // Récupérer les matchs réels de cette journée QUI ONT UN RÉSULTAT
            const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
            
            // Ne pas compter cette journée si aucun match n'a de résultat
            if (matchesThisDay.length === 0) continue;
            
            let dayPoints = 0;
            let hasPlayedMatch = false; // Au moins un prono correspond à un match joué
            
            for (const pred of entry.predictions) {
                const match = matchesThisDay.find(m => 
                    m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
                );
                
                if (!match || !match.finalScore) continue;
                
                hasPlayedMatch = true;
                stats.totalPredictions++;
                
                // Calculer le résultat
                const result = calculatePredictionResult(
                    pred.homeScore, pred.awayScore,
                    match.finalScore.home, match.finalScore.away,
                    pred.savedAt,
                    match,
                    pred.odds
                );
                
                dayPoints += result.finalPoints;
                stats.totalPoints += result.finalPoints;
                
                // Compter par type
                if (result.points === 9) stats.exactScores++;
                else if (result.points === 6) stats.closeScores++;
                else if (result.points === 4) stats.goodScores++;
                else if (result.points === 3) stats.correctResults++;
                else if (result.class === 'late') stats.latePredictions++;
                else stats.wrongResults++;
                
                // Type de résultat prédit
                const predResult = pred.homeScore > pred.awayScore ? 'home' : 
                                   (pred.homeScore < pred.awayScore ? 'away' : 'draw');
                const realResult = match.finalScore.home > match.finalScore.away ? 'home' : 
                                   (match.finalScore.home < match.finalScore.away ? 'away' : 'draw');
                
                if (predResult === 'home') {
                    stats.homeWins.predicted++;
                    if (realResult === 'home') stats.homeWins.correct++;
                } else if (predResult === 'draw') {
                    stats.draws.predicted++;
                    if (realResult === 'draw') stats.draws.correct++;
                } else {
                    stats.awayWins.predicted++;
                    if (realResult === 'away') stats.awayWins.correct++;
                }
                
                // Précision par équipe
                const homeTeam = allTeams.find(t => t.id == pred.homeTeamId);
                const awayTeam = allTeams.find(t => t.id == pred.awayTeamId);
                
                [homeTeam, awayTeam].forEach(team => {
                    if (!team) return;
                    if (!stats.teamAccuracy[team.id]) {
                        stats.teamAccuracy[team.id] = { 
                            name: team.shortName, 
                            total: 0, 
                            correct: 0 
                        };
                    }
                    stats.teamAccuracy[team.id].total++;
                    if (result.points > 0) {
                        stats.teamAccuracy[team.id].correct++;
                    }
                });
                
                // Séries
                const isGood = result.points > 0;
                
                if (currentStreakGood === null) {
                    currentStreakGood = isGood;
                    currentStreakCount = 1;
                } else if (isGood === currentStreakGood) {
                    currentStreakCount++;
                } else {
                    // Série terminée
                    if (currentStreakGood) {
                        tempBestStreak = Math.max(tempBestStreak, currentStreakCount);
                    } else {
                        tempWorstStreak = Math.max(tempWorstStreak, currentStreakCount);
                    }
                    currentStreakGood = isGood;
                    currentStreakCount = 1;
                }
            }
            
            // Ajouter la journée SEULEMENT si au moins un match a été joué
            if (hasPlayedMatch) {
                stats.journeysPlayed.push(matchDay);
                stats.pointsByMatchDay[matchDay] = Math.round(dayPoints * 10) / 10;
                cumulativeTotal += dayPoints;
                stats.cumulativePoints[matchDay] = Math.round(cumulativeTotal * 10) / 10;
            }
        }
        
        // Finaliser les séries
        if (currentStreakGood !== null) {
            if (currentStreakGood) {
                tempBestStreak = Math.max(tempBestStreak, currentStreakCount);
            } else {
                tempWorstStreak = Math.max(tempWorstStreak, currentStreakCount);
            }
            stats.currentStreak = currentStreakCount;
            stats.currentStreakType = currentStreakGood ? 'good' : 'bad';
        }
        
        stats.bestStreak = tempBestStreak;
        stats.worstStreak = tempWorstStreak;
        
    } catch (error) {
        console.error('Erreur calculatePlayerDetailedStats:', error);
    }
    
    return stats;
}

// ===============================
// MODAL STATS JOUEUR
// ===============================

async function showPlayerStatsModal(playerId, playerPseudo) {
    // Créer la modal si elle n'existe pas
    let modal = document.getElementById('playerStatsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'playerStatsModal';
        modal.className = 'stats-modal';
        modal.innerHTML = `
            <div class="stats-modal-content">
                <div class="stats-modal-header">
                    <h3 id="statsModalTitle">📊 Statistiques</h3>
                    <div style="display:flex;gap:0.5rem;align-items:center;">
                        <select id="shareMatchdaySelect" style="padding:0.3rem;border:none;border-radius:4px;font-size:0.8rem;"></select>
                        <button id="shareStatsBtn" style="padding:0.4rem 0.8rem;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;">
                            📸 Partager
                        </button>
                        <button class="btn-close" onclick="closePlayerStatsModal()">✕</button>
                    </div>
                </div>
                <div class="stats-modal-body" id="statsModalBody">
                    <div class="loading">Chargement...</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Afficher la modal
    modal.style.display = 'flex';
    document.getElementById('statsModalTitle').textContent = `📊 Statistiques de ${playerPseudo}`;
    // Remplir le sélecteur de journées pour le partage
    const playedDays = [...new Set(allMatches.map(m => m.matchDay))].sort((a, b) => b - a);
    const shareSelect = document.getElementById('shareMatchdaySelect');
    shareSelect.innerHTML = playedDays.map(d => `<option value="${d}">J${d}</option>`).join('');
    
    document.getElementById('shareStatsBtn').onclick = () => {
        const day = parseInt(shareSelect.value);
        sharePronosticsCard(playerId, playerPseudo, day);
    };
    document.getElementById('statsModalBody').innerHTML = '<div class="loading">Chargement...</div>';
    
    // Calculer les stats
    const stats = await calculatePlayerDetailedStats(playerId);
    
    // Générer le HTML
    const successRate = stats.totalPredictions > 0 
        ? Math.round((stats.totalPredictions - stats.wrongResults - stats.latePredictions) / stats.totalPredictions * 100) 
        : 0;
    
    const homeWinRate = stats.homeWins.predicted > 0 
        ? Math.round(stats.homeWins.correct / stats.homeWins.predicted * 100) 
        : 0;
    const drawRate = stats.draws.predicted > 0 
        ? Math.round(stats.draws.correct / stats.draws.predicted * 100) 
        : 0;
    const awayWinRate = stats.awayWins.predicted > 0 
        ? Math.round(stats.awayWins.correct / stats.awayWins.predicted * 100) 
        : 0;
    
    // Équipes les mieux et moins bien prédites
    const teamsArray = Object.values(stats.teamAccuracy)
        .filter(t => t.total >= 3) // Minimum 3 matchs
        .map(t => ({
            ...t,
            rate: Math.round(t.correct / t.total * 100)
        }))
        .sort((a, b) => b.rate - a.rate);
    
    const bestTeams = teamsArray.slice(0, 3);
    const worstTeams = teamsArray.slice(-3).reverse();
    
    let html = `
        <div class="stats-overview">
            <div class="stats-card highlight">
                <div class="stats-value">${Math.round(stats.totalPoints * 10) / 10}</div>
                <div class="stats-label">Points totaux</div>
            </div>
            <div class="stats-card">
                <div class="stats-value">${stats.journeysPlayed.length}</div>
                <div class="stats-label">Journées jouées</div>
            </div>
            <div class="stats-card">
                <div class="stats-value">${successRate}%</div>
                <div class="stats-label">Taux de réussite</div>
            </div>
        </div>
        
        <div class="stats-section">
            <h4>🎯 Répartition des résultats</h4>
            <div class="stats-results-grid">
                <div class="result-stat exact">
                    <span class="result-icon">🏆</span>
                    <span class="result-value">${stats.exactScores}</span>
                    <span class="result-label">Exacts (9pts)</span>
                </div>
                <div class="result-stat close">
                    <span class="result-icon">🎯</span>
                    <span class="result-value">${stats.closeScores}</span>
                    <span class="result-label">Proches (6pts)</span>
                </div>
                <div class="result-stat good">
                    <span class="result-icon">✅</span>
                    <span class="result-value">${stats.goodScores + stats.correctResults}</span>
                    <span class="result-label">Bons (3-4pts)</span>
                </div>
                <div class="result-stat wrong">
                    <span class="result-icon">❌</span>
                    <span class="result-value">${stats.wrongResults}</span>
                    <span class="result-label">Ratés</span>
                </div>
            </div>
        </div>
        
        <div class="stats-section">
            <h4>📊 Par type de résultat</h4>
            <div class="stats-type-bars">
                <div class="type-bar-row">
                    <span class="type-label">Victoire dom</span>
                    <div class="type-bar-container">
                        <div class="type-bar" style="width: ${homeWinRate}%"></div>
                    </div>
                    <span class="type-rate">${homeWinRate}% (${stats.homeWins.correct}/${stats.homeWins.predicted})</span>
                </div>
                <div class="type-bar-row">
                    <span class="type-label">Match nul</span>
                    <div class="type-bar-container">
                        <div class="type-bar draw" style="width: ${drawRate}%"></div>
                    </div>
                    <span class="type-rate">${drawRate}% (${stats.draws.correct}/${stats.draws.predicted})</span>
                </div>
                <div class="type-bar-row">
                    <span class="type-label">Victoire ext</span>
                    <div class="type-bar-container">
                        <div class="type-bar away" style="width: ${awayWinRate}%"></div>
                    </div>
                    <span class="type-rate">${awayWinRate}% (${stats.awayWins.correct}/${stats.awayWins.predicted})</span>
                </div>
            </div>
        </div>
        
        <div class="stats-section">
            <h4>🔥 Séries</h4>
            <div class="stats-streaks">
                <div class="streak-stat">
                    <span class="streak-icon">${stats.currentStreakType === 'good' ? '🔥' : '❄️'}</span>
                    <span class="streak-value">${stats.currentStreak}</span>
                    <span class="streak-label">Série actuelle</span>
                </div>
                <div class="streak-stat best">
                    <span class="streak-icon">🔥</span>
                    <span class="streak-value">${stats.bestStreak}</span>
                    <span class="streak-label">Meilleure série</span>
                </div>
                <div class="streak-stat worst">
                    <span class="streak-icon">❄️</span>
                    <span class="streak-value">${stats.worstStreak}</span>
                    <span class="streak-label">Pire série</span>
                </div>
            </div>
        </div>
    `;
    
    if (bestTeams.length > 0) {
        html += `
            <div class="stats-section">
                <h4>⚽ Équipes les mieux prédites</h4>
                <div class="stats-teams-list">
                    ${bestTeams.map((t, i) => `
                        <div class="team-stat good">
                            <span class="team-rank">${i + 1}.</span>
                            <span class="team-name">${t.name}</span>
                            <span class="team-rate">${t.rate}% (${t.correct}/${t.total})</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (worstTeams.length > 0 && worstTeams[0].rate < 50) {
        html += `
            <div class="stats-section">
                <h4>💀 Équipes les moins bien prédites</h4>
                <div class="stats-teams-list">
                    ${worstTeams.map((t, i) => `
                        <div class="team-stat bad">
                            <span class="team-rank">${i + 1}.</span>
                            <span class="team-name">${t.name}</span>
                            <span class="team-rate">${t.rate}% (${t.correct}/${t.total})</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Ajouter les badges si disponible
    if (typeof calculatePlayerBadges === 'function') {
        const { earnedBadges } = await calculatePlayerBadges(playerId);
        html += addBadgesToStatsModal(earnedBadges);
    }

    document.getElementById('statsModalBody').innerHTML = html;
}

function closePlayerStatsModal() {
    const modal = document.getElementById('playerStatsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fermer la modal en cliquant à l'extérieur
document.addEventListener('click', (e) => {
    const modal = document.getElementById('playerStatsModal');
    if (modal && e.target === modal) {
        closePlayerStatsModal();
    }
});

// ===============================
// GRAPHIQUE D'ÉVOLUTION
// ===============================

async function renderEvolutionChart() {
    const container = document.getElementById('evolutionChartContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Chargement du graphique...</div>';
    
    try {
        // Récupérer tous les joueurs
        const players = await getAllPlayers();
        
        if (players.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Aucun joueur</p>';
            return;
        }
        
        // Calculer les stats de chaque joueur
        const playersStats = [];
        
        for (const player of players) {
            const stats = await calculatePlayerDetailedStats(player.id);
            playersStats.push({
                id: player.id,
                pseudo: player.pseudo,
                stats: stats
            });
        }
        
        // Trier par points totaux
        playersStats.sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);
        
        // Trouver toutes les journées
        const allMatchDays = new Set();
        playersStats.forEach(p => {
            Object.keys(p.stats.cumulativePoints).forEach(d => allMatchDays.add(parseInt(d)));
        });
        const sortedDays = [...allMatchDays].sort((a, b) => a - b);
        
        if (sortedDays.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Pas encore de données</p>';
            return;
        }
        
        // Préparer les données pour Chart.js
        const datasets = playersStats.slice(0, 8).map((player, index) => {
            const colors = [
                '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
                '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
            ];
            
            const data = sortedDays.map(day => {
                return player.stats.cumulativePoints[day] || null;
            });
            
            // Remplir les trous (si un joueur n'a pas joué une journée, garder le cumul précédent)
            let lastValue = 0;
            for (let i = 0; i < data.length; i++) {
                if (data[i] === null) {
                    data[i] = lastValue;
                } else {
                    lastValue = data[i];
                }
            }
            
            const isCurrentPlayer = currentPlayer && player.id === currentPlayer.id;
            
            return {
                label: player.pseudo,
                data: data,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                borderWidth: isCurrentPlayer ? 3 : 2,
                pointRadius: isCurrentPlayer ? 5 : 3,
                tension: 0.3,
                fill: false
            };
        });
        
        // Créer le HTML du graphique
        container.innerHTML = `
            <div class="chart-header">
                <h4>📈 Évolution des points</h4>
                <div class="chart-filters">
                    <button class="chart-filter-btn active" data-filter="all">Tous</button>
                    <button class="chart-filter-btn" data-filter="top3">Top 3</button>
                    <button class="chart-filter-btn" data-filter="me">Mon profil</button>
                </div>
            </div>
            <div class="chart-wrapper">
                <canvas id="evolutionChart"></canvas>
            </div>
        `;
        
        // Créer le graphique
        const ctx = document.getElementById('evolutionChart').getContext('2d');
        
        window.evolutionChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedDays.map(d => `J${d}`),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${Math.round(context.parsed.y * 10) / 10} pts`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Journées'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Points cumulés'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
        
        // Stocker les données pour les filtres
        window.evolutionChartData = {
            allDatasets: datasets,
            playersStats: playersStats,
            labels: sortedDays.map(d => `J${d}`)
        };
        
        // Événements des filtres
        container.querySelectorAll('.chart-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.chart-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterEvolutionChart(btn.dataset.filter);
            });
        });
        
    } catch (error) {
        console.error('Erreur renderEvolutionChart:', error);
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;">Erreur de chargement</p>';
    }
}

function filterEvolutionChart(filter) {
    if (!window.evolutionChartInstance || !window.evolutionChartData) return;
    
    const { allDatasets, playersStats, labels } = window.evolutionChartData;
    
    let filteredDatasets;
    
    switch (filter) {
        case 'top3':
            filteredDatasets = allDatasets.slice(0, 3);
            break;
        case 'me':
            if (currentPlayer) {
                filteredDatasets = allDatasets.filter(ds => {
                    const player = playersStats.find(p => p.pseudo === ds.label);
                    return player && player.id === currentPlayer.id;
                });
            } else {
                filteredDatasets = [];
            }
            break;
        default:
            filteredDatasets = allDatasets;
    }
    
    window.evolutionChartInstance.data.datasets = filteredDatasets;
    window.evolutionChartInstance.update();
}

// ===============================
// CLASSEMENT PAR JOURNÉE
// ===============================

async function getMatchDayLeaderboard(matchDay) {
    try {
        const predictions = await getAllPredictionsForMatchDay(currentSeason, matchDay);
        const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay && m.finalScore);
        
        // Si aucun match joué, retourner vide
        if (matchesThisDay.length === 0) {
            return [];
        }
        
        const leaderboard = [];
        
        for (const pred of predictions) {
            let dayPoints = 0;
            let exactScores = 0;
            let correctResults = 0;
            
            for (const p of pred.predictions) {
                const match = matchesThisDay.find(m => 
                    m.homeTeamId == p.homeTeamId && m.awayTeamId == p.awayTeamId
                );
                
                if (match && match.finalScore) {
                    const result = calculatePredictionResult(
                        p.homeScore, p.awayScore,
                        match.finalScore.home, match.finalScore.away,
                        p.savedAt,
                        match,
                        p.odds
                    );
                    
                    dayPoints += result.finalPoints || result.points;
                    if (result.points === 9) exactScores++;
                    else if (result.points > 0) correctResults++;
                }
            }
            
            leaderboard.push({
                playerId: pred.playerId,
                pseudo: pred.pseudo,
                points: Math.round(dayPoints * 10) / 10,
                exactScores: exactScores,
                correctResults: correctResults
            });
        }
        
        // Trier par points
        leaderboard.sort((a, b) => b.points - a.points);
        
        return leaderboard;
        
    } catch (error) {
        console.error('Erreur getMatchDayLeaderboard:', error);
        return [];
    }
}