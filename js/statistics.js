// statistics.js - Gestion des statistiques détaillées

// Variables globales
let currentSeason = '';
let allMatches = [];
let allTeams = [];

// Initialisation
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📊 Initialisation de la page Statistiques');
    
    // Charger les équipes
    allTeams = await getStoredTeamsAsync();
    populateTeamSelector();
    
    // Charger les saisons
    await loadSeasons();
    
    // Événements
    document.getElementById('seasonSelect').addEventListener('change', onSeasonChange);
    document.getElementById('teamSelect').addEventListener('change', function() {
        toggleStatsView();
    });
    document.getElementById('timeSliceSelect').addEventListener('change', updateTimeAnalysis);
    
    // Vérifier si les checkboxes existent avant d'ajouter les événements
    const showExtraTime = document.getElementById('showExtraTime');
    if (showExtraTime) {
        showExtraTime.addEventListener('change', updateTimeAnalysis);
    }
    // Initialiser le graphique de performance (ajouter cette ligne)
    initPerformanceChart();
    // Après le chargement des données
    displayConfrontations();
    initConfrontationsListeners();
    initVulnerabilityAnalysis();
});

// === GESTION DES SAISONS ===

async function loadSeasons() {
    const seasonSelect = document.getElementById('seasonSelect');
    
    // Vérifier que les fonctions nécessaires existent
    if (typeof getStoredSeasons !== 'function') {
        console.error('❌ getStoredSeasons n\'est pas définie');
        seasonSelect.innerHTML = '<option value="">Erreur: fonctions manquantes</option>';
        return;
    }
    
    if (typeof getSeasonsOrderedByDate !== 'function') {
        console.error('❌ getSeasonsOrderedByDate n\'est pas définie');
        seasonSelect.innerHTML = '<option value="">Erreur: fonctions manquantes</option>';
        return;
    }
    
    // Récupérer toutes les saisons
    let seasons = getSeasonsOrderedByDate();
    
    console.log('📊 Saisons récupérées:', seasons);
    
    // Si aucune saison n'existe, initialiser
    if (!seasons || seasons.length === 0) {
        console.log('⚠️ Aucune saison trouvée, initialisation...');
        
        if (typeof initializeSeasons === 'function') {
            initializeSeasons();
            seasons = getSeasonsOrderedByDate();
        }
    }
    
    if (!seasons || seasons.length === 0) {
        console.error('❌ Aucune saison disponible après initialisation');
        seasonSelect.innerHTML = '<option value="">Aucune saison disponible</option>';
        showEmptyState();
        return;
    }
    
    console.log('✅ Saisons chargées:', seasons.length);
    
    // Remplir le sélecteur
    seasonSelect.innerHTML = seasons.map(season => 
        `<option value="${season.name}">${season.name}</option>`
    ).join('');
    
    // Sélectionner la saison active par défaut
    const activeSeason = seasons.find(s => s.isActive);
    if (activeSeason) {
        seasonSelect.value = activeSeason.name;
        currentSeason = activeSeason.name;
        console.log('✅ Saison active sélectionnée:', currentSeason);
    } else if (seasons.length > 0) {
        seasonSelect.value = seasons[0].name;
        currentSeason = seasons[0].name;
        console.log('✅ Première saison sélectionnée:', currentSeason);
    }
    
    // Charger les données de la saison
    await loadSeasonData();
}

async function onSeasonChange(event) {
    currentSeason = event.target.value;
    await loadSeasonData();
}

async function loadSeasonData() {
    if (!currentSeason) {
        showEmptyState();
        return;
    }
    
    // Charger tous les matchs de la saison
    allMatches = await getStoredMatchesAsync();
    allMatches = allMatches.filter(match => match.season === currentSeason);
    
    if (allMatches.length === 0) {
        showEmptyState();
        return;
    }
    
    // Mettre à jour toutes les sections
    updateTopScorers();
    updateTimeAnalysis();
    updateGeneralStats();
    toggleStatsView();
    initNewStats();
    initMatchdaySummary();
    initFranceMap();
    initTitleRace();
}

function showEmptyState() {
    document.querySelector('.stats-container').innerHTML = `
        <div class="empty-stats">
            <h3>📭 Aucune donnée disponible</h3>
            <p>Il n'y a pas encore de matchs pour cette saison.</p>
            <a href="add-match.html" class="btn">➕ Ajouter un match</a>
        </div>
    `;
}

// === TOP 10 BUTEURS ===

function updateTopScorers() {
    const scorers = {};
    
    // Parcourir tous les matchs pour collecter les buteurs
    allMatches.forEach(match => {
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                const scorerName = goal.scorer;
                const teamId = goal.teamId;
                
                // Créer une clé unique combinant le nom ET l'équipe
                const uniqueKey = `${scorerName}_${teamId}`;
                
                if (!scorers[uniqueKey]) {
                    scorers[uniqueKey] = {
                        name: scorerName,
                        teamId: teamId,
                        goals: 0
                    };
                }
                
                scorers[uniqueKey].goals++;
            });
        }
    });
    
    // Convertir en tableau et trier par nombre de buts
    const scorersArray = Object.values(scorers);
    scorersArray.sort((a, b) => b.goals - a.goals);
    
    // Limiter au top 10
    const top10 = scorersArray.slice(0, 10);
    
    // Afficher le tableau
    displayTopScorersTable(top10);
}

function displayTopScorersTable(scorers) {
    const tbody = document.querySelector('#topScorersTable tbody');
    
    if (scorers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    Aucun buteur pour cette saison
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = scorers.map((scorer, index) => {
        const team = allTeams.find(t => t.id == scorer.teamId);
        const teamName = team ? team.shortName : 'N/A';
        
        // Classes spéciales pour le podium
        let rankClass = 'rank';
        if (index === 0) rankClass += ' rank-1';
        else if (index === 1) rankClass += ' rank-2';
        else if (index === 2) rankClass += ' rank-3';
        
        return `
            <tr>
                <td class="${rankClass}">${index + 1}</td>
                <td class="player-name">${scorer.name}</td>
                <td><span class="team-badge">${teamName}</span></td>
                <td class="goals-count">${scorer.goals}</td>
            </tr>
        `;
    }).join('');
}

// === SÉLECTEUR D'ÉQUIPES ===

function populateTeamSelector() {
    const teamSelect = document.getElementById('teamSelect');
    
    teamSelect.innerHTML = '<option value="all">Toutes les équipes</option>' +
        allTeams.map(team => 
            `<option value="${team.id}">${team.shortName}</option>`
        ).join('');
}

// Afficher les buteurs de l'équipe sélectionnée
function updateTeamScorers() {
    const selectedTeamId = document.getElementById('teamSelect').value;
    const section = document.getElementById('teamScorersSection');
    
    if (!section) return;
    
    if (selectedTeamId === 'all') {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    const team = allTeams.find(t => t.id == selectedTeamId);
    document.getElementById('selectedTeamName').textContent = team ? team.shortName : '';
    
    // Collecter les buteurs de cette équipe
    const scorers = {};
    
    allMatches.forEach(match => {
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                if (goal.teamId == selectedTeamId) {
                    // Normaliser le nom (tirets → espaces, trim, majuscules uniformes)
                    const name = goal.scorer.replace(/-/g, ' ').trim().toLowerCase()
                        .split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    if (!scorers[name]) {
                        scorers[name] = { name, goals: 0, matches: new Set() };
                    }
                    scorers[name].goals++;
                    scorers[name].matches.add(match.id);
                }
            });
        }
    });
    
    // Convertir et trier
    const scorersArray = Object.values(scorers)
        .map(s => ({
            ...s,
            matchesPlayed: s.matches.size,
            goalsPerMatch: (s.goals / s.matches.size).toFixed(2)
        }))
        .sort((a, b) => b.goals - a.goals);
    
    // Afficher
    const tbody = document.querySelector('#teamScorersTable tbody');
    
    if (scorersArray.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    Aucun buteur enregistré pour cette équipe
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = scorersArray.map((scorer, index) => {
        let rankClass = 'rank';
        if (index === 0) rankClass += ' rank-1';
        else if (index === 1) rankClass += ' rank-2';
        else if (index === 2) rankClass += ' rank-3';
        
        return `
            <tr>
                <td class="${rankClass}">${index + 1}</td>
                <td class="player-name">${scorer.name}</td>
                <td class="goals-count">${scorer.goals}</td>
            </tr>
        `;
}).join('');
}

// Basculer entre stats générales et stats par équipe
function toggleStatsView() {
    const selectedTeamId = document.getElementById('teamSelect').value;
    const generalWrapper = document.getElementById('generalStatsWrapper');
    const teamWrapper = document.getElementById('teamStatsWrapper');
    
    if (selectedTeamId === 'all') {
        // Afficher stats générales
        generalWrapper.style.display = 'block';
        teamWrapper.style.display = 'none';
        updateScoreDistributionGeneral();
        updateSeasonRecordsGeneral();
        updateGoalsHeatmapGeneral();
        updateResultsCardGlobal();
    } else {
        // Afficher stats équipe
        generalWrapper.style.display = 'none';
        teamWrapper.style.display = 'block';
        displayTeamRadar(selectedTeamId);
        updateTeamScorers();
        updateTimeAnalysis();
        updateScoreDistributionTeam(selectedTeamId);
        updateSeasonRecordsTeam(selectedTeamId);
        updateGoalsHeatmapTeam(selectedTeamId);
        updateResultsCardTeam(selectedTeamId);
    }
}

// Distribution des scores - Stats générales
function updateScoreDistributionGeneral() {
    const container = document.getElementById('scoreDistributionGeneral');
    if (!container) return;
    
    // Compter les scores
    const scoreCounts = {};
    
    allMatches.forEach(match => {
        const home = match.finalScore.home;
        const away = match.finalScore.away;
        const scoreKey = `${home}-${away}`;
        
        scoreCounts[scoreKey] = (scoreCounts[scoreKey] || 0) + 1;
    });
    
    // Trier par fréquence
    const sortedScores = Object.entries(scoreCounts)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedScores.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Aucun match joué</p>';
        return;
    }
    
    // Générer le HTML
    container.innerHTML = sortedScores.map(([score, count]) => {
    const percentage = ((count / allMatches.length) * 100).toFixed(1);
    
    // Couleur selon résultat domicile/extérieur
    const [home, away] = score.split('-').map(Number);
    let resultClass = 'draw';
    if (home > away) resultClass = 'win';
    else if (home < away) resultClass = 'loss';
    
    return `
        <div class="score-item ${resultClass}">
                <span class="score-label">${score}</span>
                <span class="score-count">${count} match${count > 1 ? 's' : ''}</span>
                <span class="score-percentage">${percentage}%</span>
            </div>
        `;
    }).join('');
}

// Distribution des scores - Stats équipe
function updateScoreDistributionTeam(teamId) {
    const container = document.getElementById('scoreDistributionTeam');
    if (!container) return;
    
    // Filtrer les matchs de l'équipe
    const teamMatches = allMatches.filter(m => 
        m.homeTeamId == teamId || m.awayTeamId == teamId
    );
    
    // Compter les scores (du point de vue de l'équipe)
    const scoreCounts = {};
    
    teamMatches.forEach(match => {
        const isHome = match.homeTeamId == teamId;
        const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
        const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
        const scoreKey = `${goalsFor}-${goalsAgainst}`;
        
        scoreCounts[scoreKey] = (scoreCounts[scoreKey] || 0) + 1;
    });
    
    // Trier par fréquence
    const sortedScores = Object.entries(scoreCounts)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedScores.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Aucun match joué</p>';
        return;
    }
    
    // Générer le HTML
    container.innerHTML = sortedScores.map(([score, count]) => {
        const percentage = ((count / teamMatches.length) * 100).toFixed(1);
        const [goalsFor, goalsAgainst] = score.split('-').map(Number);
        
        // Couleur selon résultat
        let resultClass = 'draw';
        if (goalsFor > goalsAgainst) resultClass = 'win';
        else if (goalsFor < goalsAgainst) resultClass = 'loss';
        
        return `
            <div class="score-item ${resultClass}">
                <span class="score-label">${score}</span>
                <span class="score-count">${count} match${count > 1 ? 's' : ''}</span>
                <span class="score-percentage">${percentage}%</span>
            </div>
        `;
    }).join('');
}

// === ANALYSE TEMPORELLE DES BUTS ===

function updateTimeAnalysis() {
    const selectedTeamId = document.getElementById('teamSelect').value;
    const timeSlice = document.getElementById('timeSliceSelect').value;
    
    // Collecter tous les buts avec leur minute (incluant extraTime)
    let goalsFor = [];
    let goalsAgainst = [];
    
    allMatches.forEach(match => {
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                // Calculer la minute réelle en incluant le temps additionnel
                const baseMinute = parseInt(goal.minute);
                const extraTime = parseInt(goal.extraTime) || 0;
                const realMinute = extraTime > 0 ? baseMinute + (extraTime / 10) : baseMinute;
                
                const goalData = {
                    minute: realMinute,
                    baseMinute: baseMinute,
                    extraTime: extraTime,
                    scorer: goal.scorer,
                    teamId: goal.teamId
                };
                
                // Filtrer par équipe si nécessaire
                if (selectedTeamId === 'all') {
                    goalsFor.push(goalData);
                } else {
                    if (goal.teamId == selectedTeamId) {
                        goalsFor.push(goalData);
                    } else if (match.homeTeamId == selectedTeamId || match.awayTeamId == selectedTeamId) {
                        goalsAgainst.push(goalData);
                    }
                }
            });
        }
    });
    
    // Si "toutes les équipes", pas de distinction pour/contre
    if (selectedTeamId === 'all') {
        goalsAgainst = [];
    }
    
    // Déterminer la taille des tranches pour le graphique comparatif
    let sliceSize;
    if (timeSlice === '5') {
        sliceSize = 5;
        generateTimeSliceChart(goalsFor, goalsAgainst, 5);
    } else if (timeSlice === '15') {
        sliceSize = 15;
        generateTimeSliceChart(goalsFor, goalsAgainst, 15);
    } else if (timeSlice === 'half') {
        sliceSize = 'half';
        generateHalfTimeChart(goalsFor, goalsAgainst);
    }
    
    // Afficher les minutes exactes
    displayMinutesByMinute(goalsFor, goalsAgainst);
    
    // Graphique comparatif avec les mêmes tranches
    displayComparisonChart(goalsFor, goalsAgainst, sliceSize);
}

function generateTimeSliceChart(goalsFor, goalsAgainst, sliceSize) {
    let timeSlices = [];
    
    if (sliceSize === 5) {
        // Première mi-temps (1-45)
        timeSlices.push({ label: `1-5`, min: 1, max: 5 });
        timeSlices.push({ label: `6-10`, min: 6, max: 10 });
        timeSlices.push({ label: `11-15`, min: 11, max: 15 });
        timeSlices.push({ label: `16-20`, min: 16, max: 20 });
        timeSlices.push({ label: `21-25`, min: 21, max: 25 });
        timeSlices.push({ label: `26-30`, min: 26, max: 30 });
        timeSlices.push({ label: `31-35`, min: 31, max: 35 });
        timeSlices.push({ label: `36-40`, min: 36, max: 40 });
        timeSlices.push({ label: `41-45`, min: 41, max: 45 });
        timeSlices.push({ label: '45+ (Temps add.)', min: 45.01, max: 45.99 });
        
        // Deuxième mi-temps (46-90)
        timeSlices.push({ label: `46-50`, min: 46, max: 50 });
        timeSlices.push({ label: `51-55`, min: 51, max: 55 });
        timeSlices.push({ label: `56-60`, min: 56, max: 60 });
        timeSlices.push({ label: `61-65`, min: 61, max: 65 });
        timeSlices.push({ label: `66-70`, min: 66, max: 70 });
        timeSlices.push({ label: `71-75`, min: 71, max: 75 });
        timeSlices.push({ label: `76-80`, min: 76, max: 80 });
        timeSlices.push({ label: `81-85`, min: 81, max: 85 });
        timeSlices.push({ label: `86-90`, min: 86, max: 90 });
        timeSlices.push({ label: '90+ (Temps add.)', min: 90.01, max: 999 });
        
    } else if (sliceSize === 15) {
        timeSlices = [
            { label: '1-15', min: 1, max: 15 },
            { label: '16-30', min: 16, max: 30 },
            { label: '31-45', min: 31, max: 45 },
            { label: '45+ (Temps add.)', min: 45.01, max: 45.99 },
            { label: '46-60', min: 46, max: 60 },
            { label: '61-75', min: 61, max: 75 },
            { label: '76-90', min: 76, max: 90 },
            { label: '90+ (Temps add.)', min: 90.01, max: 999 }
        ];
    }
    
    const countsFor = timeSlices.map(slice => ({
        label: slice.label,
        count: goalsFor.filter(g => g.minute >= slice.min && g.minute <= slice.max).length
    }));
    
    const countsAgainst = timeSlices.map(slice => ({
        label: slice.label,
        count: goalsAgainst.filter(g => g.minute >= slice.min && g.minute <= slice.max).length
    }));
    
    const maxCount = Math.max(...countsFor.map(c => c.count), ...countsAgainst.map(c => c.count), 1);
    
    let htmlFor = '<div class="chart-bar-container">';
    let htmlAgainst = '<div class="chart-bar-container">';
    
    // AFFICHER TOUTES LES TRANCHES, même celles à 0
    timeSlices.forEach((slice, index) => {
        const forCount = countsFor[index].count;
        const width = forCount > 0 ? (forCount / maxCount) * 100 : 0;
        
        htmlFor += `
            <div class="chart-bar-row">
                <div class="chart-bar-label">${slice.label}</div>
                <div class="chart-bar-wrapper">
                    ${forCount > 0 ? `
                        <div class="chart-bar goals-for" style="width: ${width}%">
                            <span class="chart-bar-value">${forCount}</span>
                        </div>
                    ` : '<span style="color: #bdc3c7; font-size: 0.9rem;">0</span>'}
                </div>
            </div>
        `;
        
        if (goalsAgainst.length > 0) {
            const againstCount = countsAgainst[index].count;
            const widthAgainst = againstCount > 0 ? (againstCount / maxCount) * 100 : 0;
            
            htmlAgainst += `
                <div class="chart-bar-row">
                    <div class="chart-bar-label">${slice.label}</div>
                    <div class="chart-bar-wrapper">
                        ${againstCount > 0 ? `
                            <div class="chart-bar goals-against" style="width: ${widthAgainst}%">
                                <span class="chart-bar-value">${againstCount}</span>
                            </div>
                        ` : '<span style="color: #bdc3c7; font-size: 0.9rem;">0</span>'}
                    </div>
                </div>
            `;
        }
    });
    
    htmlFor += '</div>';
    htmlAgainst += '</div>';
    
    const containerFor = document.getElementById('goalsForChart');
    const containerAgainst = document.getElementById('goalsAgainstChart');
    
    if (containerFor) containerFor.innerHTML = htmlFor;
    if (containerAgainst) containerAgainst.innerHTML = goalsAgainst.length > 0 ? htmlAgainst : '<p style="text-align: center; color: #95a5a6;">Aucun but encaissé</p>';
}

function generateHalfTimeChart(goalsFor, goalsAgainst) {
    const halfTimes = [
        { label: '1ère mi-temps (1-45)', min: 1, max: 45 },
        { label: 'Temps add. MT', min: 45.1, max: 45.99 },
        { label: '2ème mi-temps (46-90)', min: 46, max: 90 },
        { label: 'Temps add. 2ème', min: 90.1, max: 999 }
    ];
    
    const countsFor = halfTimes.map(ht => ({
        label: ht.label,
        count: goalsFor.filter(g => g.minute >= ht.min && g.minute <= ht.max).length
    }));
    
    const countsAgainst = halfTimes.map(ht => ({
        label: ht.label,
        count: goalsAgainst.filter(g => g.minute >= ht.min && g.minute <= ht.max).length
    }));
    
    const maxCount = Math.max(...countsFor.map(c => c.count), ...countsAgainst.map(c => c.count), 1);
    
    let htmlFor = '<div class="chart-bar-container">';
    let htmlAgainst = '<div class="chart-bar-container">';
    
    // AFFICHER TOUTES LES MI-TEMPS, même celles à 0
    halfTimes.forEach((ht, index) => {
        const forCount = countsFor[index].count;
        const width = forCount > 0 ? (forCount / maxCount) * 100 : 0;
        
        htmlFor += `
            <div class="chart-bar-row">
                <div class="chart-bar-label">${ht.label}</div>
                <div class="chart-bar-wrapper">
                    ${forCount > 0 ? `
                        <div class="chart-bar goals-for" style="width: ${width}%">
                            <span class="chart-bar-value">${forCount}</span>
                        </div>
                    ` : '<span style="color: #bdc3c7; font-size: 0.9rem;">0</span>'}
                </div>
            </div>
        `;
        
        if (goalsAgainst.length > 0) {
            const againstCount = countsAgainst[index].count;
            const widthAgainst = againstCount > 0 ? (againstCount / maxCount) * 100 : 0;
            
            htmlAgainst += `
                <div class="chart-bar-row">
                    <div class="chart-bar-label">${ht.label}</div>
                    <div class="chart-bar-wrapper">
                        ${againstCount > 0 ? `
                            <div class="chart-bar goals-against" style="width: ${widthAgainst}%">
                                <span class="chart-bar-value">${againstCount}</span>
                            </div>
                        ` : '<span style="color: #bdc3c7; font-size: 0.9rem;">0</span>'}
                    </div>
                </div>
            `;
        }
    });
    
    htmlFor += '</div>';
    htmlAgainst += '</div>';
    
    const containerFor = document.getElementById('goalsForChart');
    const containerAgainst = document.getElementById('goalsAgainstChart');
    
    if (containerFor) containerFor.innerHTML = htmlFor;
    if (containerAgainst) containerAgainst.innerHTML = goalsAgainst.length > 0 ? htmlAgainst : '<p style="text-align: center; color: #95a5a6;">Aucun but encaissé</p>';
}

function displayMinutesByMinute(goalsFor, goalsAgainst) {
    const forList = document.getElementById('minutesForList');
    const againstList = document.getElementById('minutesAgainstList');
    
    goalsFor.sort((a, b) => a.minute - b.minute);
    goalsAgainst.sort((a, b) => a.minute - b.minute);
    
    if (goalsFor.length > 0) {
        forList.innerHTML = goalsFor.map(goal => {
            const team = allTeams.find(t => t.id == goal.teamId);
            const teamName = team ? team.shortName : 'N/A';
            const isExtraTime = goal.extraTime > 0;
            
            return `
                <div class="minute-item">
                    <span class="minute-time ${isExtraTime ? 'extra-time' : ''}">${formatMinute(goal)}'</span>
                    <span>${goal.scorer} (${teamName})</span>
                </div>
            `;
        }).join('');
    } else {
        forList.innerHTML = '<p style="color: #95a5a6; text-align: center;">Aucun but marqué</p>';
    }
    
    if (goalsAgainst.length > 0) {
        againstList.innerHTML = goalsAgainst.map(goal => {
            const team = allTeams.find(t => t.id == goal.teamId);
            const teamName = team ? team.shortName : 'N/A';
            const isExtraTime = goal.extraTime > 0;
            
            return `
                <div class="minute-item">
                    <span class="minute-time ${isExtraTime ? 'extra-time' : ''}">${formatMinute(goal)}'</span>
                    <span>${goal.scorer} (${teamName})</span>
                </div>
            `;
        }).join('');
    } else {
        againstList.innerHTML = '<p style="color: #95a5a6; text-align: center;">Aucun but encaissé</p>';
    }
}

function formatMinute(goalData) {
    const baseMinute = goalData.baseMinute || Math.floor(goalData.minute);
    const extraTime = goalData.extraTime || 0;
    
    if (extraTime > 0) {
        return `${baseMinute}+${extraTime}`;
    }
    return baseMinute.toString();
}

function displayComparisonChart(goalsFor, goalsAgainst, sliceSize) {
    const container = document.getElementById('comparisonChart');
    
    if (goalsFor.length === 0 && goalsAgainst.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6;">Aucune donnée à afficher</p>';
        return;
    }
    
    // Utiliser les mêmes tranches que le sélecteur
    let timeSlices = [];
    
    if (sliceSize === 5) {
        // Tranches de 5 minutes
        timeSlices.push({ label: `1-5`, min: 1, max: 5 });
        timeSlices.push({ label: `6-10`, min: 6, max: 10 });
        timeSlices.push({ label: `11-15`, min: 11, max: 15 });
        timeSlices.push({ label: `16-20`, min: 16, max: 20 });
        timeSlices.push({ label: `21-25`, min: 21, max: 25 });
        timeSlices.push({ label: `26-30`, min: 26, max: 30 });
        timeSlices.push({ label: `31-35`, min: 31, max: 35 });
        timeSlices.push({ label: `36-40`, min: 36, max: 40 });
        timeSlices.push({ label: `41-45`, min: 41, max: 45 });
        timeSlices.push({ label: '45+', min: 45.01, max: 45.99 });
        timeSlices.push({ label: `46-50`, min: 46, max: 50 });
        timeSlices.push({ label: `51-55`, min: 51, max: 55 });
        timeSlices.push({ label: `56-60`, min: 56, max: 60 });
        timeSlices.push({ label: `61-65`, min: 61, max: 65 });
        timeSlices.push({ label: `66-70`, min: 66, max: 70 });
        timeSlices.push({ label: `71-75`, min: 71, max: 75 });
        timeSlices.push({ label: `76-80`, min: 76, max: 80 });
        timeSlices.push({ label: `81-85`, min: 81, max: 85 });
        timeSlices.push({ label: `86-90`, min: 86, max: 90 });
        timeSlices.push({ label: '90+', min: 90.01, max: 999 });
    } else if (sliceSize === 15) {
        // Tranches de 15 minutes
        timeSlices = [
            { label: '1-15', min: 1, max: 15 },
            { label: '16-30', min: 16, max: 30 },
            { label: '31-45', min: 31, max: 45 },
            { label: '45+', min: 45.01, max: 45.99 },
            { label: '46-60', min: 46, max: 60 },
            { label: '61-75', min: 61, max: 75 },
            { label: '76-90', min: 76, max: 90 },
            { label: '90+', min: 90.01, max: 999 }
        ];
    } else {
        // Par mi-temps
        timeSlices = [
            { label: '1ère MT', min: 1, max: 45 },
            { label: '45+', min: 45.01, max: 45.99 },
            { label: '2ème MT', min: 46, max: 90 },
            { label: '90+', min: 90.01, max: 999 }
        ];
    }
    
    // Compter les buts par tranche
    const countsFor = timeSlices.map(slice => 
        goalsFor.filter(g => g.minute >= slice.min && g.minute <= slice.max).length
    );
    
    const countsAgainst = timeSlices.map(slice => 
        goalsAgainst.filter(g => g.minute >= slice.min && g.minute <= slice.max).length
    );
    
    const maxCount = Math.max(...countsFor, ...countsAgainst, 1);
    
    let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
    
    // AFFICHER TOUTES LES TRANCHES, même celles à 0
    timeSlices.forEach((slice, index) => {
        const forCount = countsFor[index];
        const againstCount = countsAgainst[index];
        
        const widthFor = forCount > 0 ? (forCount / maxCount) * 100 : 0;
        const widthAgainst = againstCount > 0 ? (againstCount / maxCount) * 100 : 0;
        
        html += `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <!-- Buts marqués (à gauche) -->
                <div style="flex: 1; display: flex; justify-content: flex-end; align-items: center;">
                    ${forCount > 0 ? `
                        <div style="display: flex; align-items: center; justify-content: flex-end; width: 100%;">
                            <span style="margin-right: 0.5rem; font-weight: bold; color: #27ae60; min-width: 25px; text-align: right;">${forCount}</span>
                            <div style="background: linear-gradient(90deg, #27ae60, #2ecc71); height: 30px; width: ${widthFor}%; border-radius: 5px 0 0 5px; display: flex; align-items: center; justify-content: flex-start; padding-left: 0.5rem;">
                                <span style="color: white; font-size: 0.85rem; font-weight: 600;">⚽</span>
                            </div>
                        </div>
                    ` : `<div style="width: 100%; text-align: right; padding-right: 0.5rem;"><span style="color: #bdc3c7; font-size: 0.85rem;">0</span></div>`}
                </div>
                
                <!-- Label central -->
                <div style="min-width: 70px; text-align: center; font-weight: 600; color: #2c3e50; font-size: 0.9rem; background: #f8f9fa; padding: 0.4rem 0.6rem; border-radius: 5px;">
                    ${slice.label}
                </div>
                
                <!-- Buts encaissés (à droite) -->
                <div style="flex: 1; display: flex; justify-content: flex-start; align-items: center;">
                    ${againstCount > 0 ? `
                        <div style="display: flex; align-items: center; justify-content: flex-start; width: 100%;">
                            <div style="background: linear-gradient(90deg, #e74c3c, #c0392b); height: 30px; width: ${widthAgainst}%; border-radius: 0 5px 5px 0; display: flex; align-items: center; justify-content: flex-end; padding-right: 0.5rem;">
                                <span style="color: white; font-size: 0.85rem; font-weight: 600;">🛡️</span>
                            </div>
                            <span style="margin-left: 0.5rem; font-weight: bold; color: #e74c3c; min-width: 25px; text-align: left;">${againstCount}</span>
                        </div>
                    ` : `<div style="width: 100%; text-align: left; padding-left: 0.5rem;"><span style="color: #bdc3c7; font-size: 0.85rem;">0</span></div>`}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Résumé
    const totalFor = goalsFor.length;
    const totalAgainst = goalsAgainst.length;
    const diff = totalFor - totalAgainst;
    
    html += `
        <div style="margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; text-align: center;">
            <div style="display: flex; justify-content: space-around; align-items: center;">
                <div>
                    <span style="font-size: 1.5rem; font-weight: bold; color: #27ae60;">⚽ ${totalFor}</span>
                    <div style="color: #7f8c8d; font-size: 0.9rem;">Buts marqués</div>
                </div>
                <div style="font-size: 1.2rem; font-weight: bold; color: ${diff > 0 ? '#27ae60' : diff < 0 ? '#e74c3c' : '#7f8c8d'};">
                    ${diff > 0 ? '+' : ''}${diff}
                </div>
                <div>
                    <span style="font-size: 1.5rem; font-weight: bold; color: #e74c3c;">🛡️ ${totalAgainst}</span>
                    <div style="color: #7f8c8d; font-size: 0.9rem;">Buts encaissés</div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// === STATISTIQUES GÉNÉRALES ===

function updateGeneralStats() {
    // Collecter tous les buts avec leurs informations complètes
    let allGoals = [];

    allMatches.forEach(match => {
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                const minute = parseFloat(goal.minute);
                const extraTime = goal.extraTime || 0;
                
                allGoals.push({
                    minute: minute,
                    extraTime: extraTime
                });
            });
        }
    });

    const totalGoals = allGoals.length;
    const totalMatches = allMatches.length;
    const avgGoalsPerMatch = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : 0;

    // Trouver la minute la plus prolifique avec gestion des temps additionnels
    const minuteCounts = {};

    allGoals.forEach(goal => {
        let key;
        
        // Gestion spéciale pour les temps additionnels
        if (goal.extraTime > 0) {
            // Pour 45+1, 45+2, etc. on crée des clés séparées
            if (goal.minute === 45) {
                key = `45+${goal.extraTime}`;
            } 
            // Pour 90+1, 90+2, etc. on crée des clés séparées
            else if (goal.minute === 90) {
                key = `90+${goal.extraTime}`;
            }
            // Autres cas (peu probable mais au cas où)
            else {
                key = `${goal.minute}+${goal.extraTime}`;
            }
        } else {
            // Minute normale sans temps additionnel
            key = `${Math.floor(goal.minute)}`;
        }
        
        minuteCounts[key] = (minuteCounts[key] || 0) + 1;
    });
    
    let mostScoringMinute = '-';
    
    if (Object.keys(minuteCounts).length > 0) {
        const sortedMinutes = Object.entries(minuteCounts).sort((a, b) => b[1] - a[1]);
        mostScoringMinute = `${sortedMinutes[0][0]}' (${sortedMinutes[0][1]} buts)`;
    }
    
    document.getElementById('totalGoals').textContent = totalGoals;
    document.getElementById('avgGoalsPerMatch').textContent = avgGoalsPerMatch;
    document.getElementById('mostScoringMinute').textContent = mostScoringMinute;
}


// === GRAPHIQUE PERFORMANCE OFFENSIVE VS DÉFENSIVE ===

let performanceChart = null;
let selectedTeams = []; // Équipes sélectionnées

// Initialiser le graphique de performance
function initPerformanceChart() {
    const matchdaySelect = document.getElementById('performanceMatchday');
    const teamFilter = document.getElementById('performanceTeamFilter');
    const selectAllBtn = document.getElementById('selectAllTeams');
    const clearAllBtn = document.getElementById('clearAllTeams');
    const showAverageLineCheckbox = document.getElementById('showAverageLine');
    
    if (!matchdaySelect || !teamFilter) return;
    
    // Remplir le sélecteur de journées
    const maxMatchday = Math.max(...allMatches.map(m => m.matchDay || 0));
    matchdaySelect.innerHTML = '<option value="all">Toute la saison</option>';
    for (let i = 1; i <= maxMatchday; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Journée ${i}`;
        matchdaySelect.appendChild(option);
    }
    
    // Remplir le sélecteur d'équipes
    teamFilter.innerHTML = '';
    allTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        option.selected = true; // Toutes sélectionnées par défaut
        teamFilter.appendChild(option);
    });
    
    // Initialiser la liste des équipes sélectionnées
    updateSelectedTeams();
    
    // Événements
    matchdaySelect.addEventListener('change', updatePerformanceChart);
    teamFilter.addEventListener('change', () => {
        updateSelectedTeams();
        updatePerformanceChart();
    });
    
    selectAllBtn.addEventListener('click', () => {
        Array.from(teamFilter.options).forEach(option => option.selected = true);
        updateSelectedTeams();
        updatePerformanceChart();
    });
    
    clearAllBtn.addEventListener('click', () => {
        Array.from(teamFilter.options).forEach(option => option.selected = false);
        updateSelectedTeams();
        updatePerformanceChart();
    });
    
    showAverageLineCheckbox.addEventListener('change', updatePerformanceChart);
    
    // Afficher le graphique initial
    updatePerformanceChart();
}

// Mettre à jour la liste des équipes sélectionnées
function updateSelectedTeams() {
    const teamFilter = document.getElementById('performanceTeamFilter');
    selectedTeams = Array.from(teamFilter.selectedOptions).map(option => parseInt(option.value));
}

// Mettre à jour le graphique de performance
function updatePerformanceChart() {
    const matchdaySelect = document.getElementById('performanceMatchday');
    const showAverageLine = document.getElementById('showAverageLine').checked;
    const selectedMatchday = matchdaySelect.value;
    
    if (selectedTeams.length === 0) {
        // Afficher un message si aucune équipe n'est sélectionnée
        if (performanceChart) {
            performanceChart.destroy();
            performanceChart = null;
        }
        return;
    }
    
    // Filtrer les matchs
    let filteredMatches = allMatches;
    if (selectedMatchday !== 'all') {
        const matchday = parseInt(selectedMatchday);
        filteredMatches = allMatches.filter(m => m.matchDay <= matchday);
    }
    
    // Calculer les données pour chaque équipe
    const teamData = calculateTeamPerformanceData(filteredMatches);
    
    // Créer le graphique
    renderPerformanceChart(teamData, selectedMatchday, showAverageLine);
}

// Calculer les données de performance pour chaque équipe
function calculateTeamPerformanceData(matches) {
    const teamStats = {};
    
    // Initialiser les stats pour chaque équipe
    allTeams.forEach(team => {
        teamStats[team.id] = {
            id: team.id,
            name: team.shortName,
            matchesPlayed: 0,
            goalsScored: 0,
            goalsConceded: 0,
            byMatchday: {}, // Stats par journée
            cumulativeAvg: [] // Moyennes cumulatives par journée
        };
    });
    
    // Calculer les stats par journée
    matches.forEach(match => {
        const matchDay = match.matchDay;
        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;
        const homeScore = match.finalScore.home;
        const awayScore = match.finalScore.away;
        
        if (!teamStats[homeId] || !teamStats[awayId]) return;
        
        // Stats globales
        teamStats[homeId].matchesPlayed++;
        teamStats[homeId].goalsScored += homeScore;
        teamStats[homeId].goalsConceded += awayScore;
        
        teamStats[awayId].matchesPlayed++;
        teamStats[awayId].goalsScored += awayScore;
        teamStats[awayId].goalsConceded += homeScore;
        
        // Stats par journée
        if (!teamStats[homeId].byMatchday[matchDay]) {
            teamStats[homeId].byMatchday[matchDay] = { scored: 0, conceded: 0, matches: 0 };
        }
        if (!teamStats[awayId].byMatchday[matchDay]) {
            teamStats[awayId].byMatchday[matchDay] = { scored: 0, conceded: 0, matches: 0 };
        }
        
        teamStats[homeId].byMatchday[matchDay].scored += homeScore;
        teamStats[homeId].byMatchday[matchDay].conceded += awayScore;
        teamStats[homeId].byMatchday[matchDay].matches++;
        
        teamStats[awayId].byMatchday[matchDay].scored += awayScore;
        teamStats[awayId].byMatchday[matchDay].conceded += homeScore;
        teamStats[awayId].byMatchday[matchDay].matches++;
    });
    
    // Calculer les moyennes par match et les moyennes cumulatives
    Object.keys(teamStats).forEach(teamId => {
        const stats = teamStats[teamId];
        
        if (stats.matchesPlayed > 0) {
            stats.avgScored = stats.goalsScored / stats.matchesPlayed;
            stats.avgConceded = stats.goalsConceded / stats.matchesPlayed;
        } else {
            stats.avgScored = 0;
            stats.avgConceded = 0;
        }
        
        // Calculer les moyennes cumulatives par journée
        let cumulativeScored = 0;
        let cumulativeConceded = 0;
        let cumulativeMatches = 0;
        
        const matchdays = Object.keys(stats.byMatchday).map(Number).sort((a, b) => a - b);
        
        matchdays.forEach(day => {
            const dayStats = stats.byMatchday[day];
            cumulativeScored += dayStats.scored;
            cumulativeConceded += dayStats.conceded;
            cumulativeMatches += dayStats.matches;
            
            stats.cumulativeAvg.push({
                matchday: day,
                avgScored: cumulativeScored / cumulativeMatches,
                avgConceded: cumulativeConceded / cumulativeMatches
            });
        });
    });
    
    return teamStats;
}

// Générer des couleurs distinctes pour chaque équipe
function getTeamColor(teamId) {
    const colors = {
        1: '#e74c3c',   2: '#3498db',   3: '#2ecc71',   4: '#f39c12',
        5: '#9b59b6',   6: '#1abc9c',   7: '#e67e22',   8: '#34495e',
        9: '#16a085',   10: '#c0392b',  11: '#27ae60',  12: '#2980b9',
        13: '#8e44ad',  14: '#f1c40f',  15: '#d35400',  16: '#2c3e50',
        17: '#7f8c8d',  18: '#95a5a6'
    };
    return colors[teamId] || '#95a5a6';
}

// Afficher le graphique
function renderPerformanceChart(teamData, selectedMatchday, showAverageLine) {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    
    // Détruire le graphique existant
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    // Calculer la moyenne globale
    const filteredTeamData = Object.values(teamData).filter(t => selectedTeams.includes(t.id) && t.matchesPlayed > 0);
    
    const allAvgScored = filteredTeamData.map(t => t.avgScored);
    const allAvgConceded = filteredTeamData.map(t => t.avgConceded);
    
    const globalAvgScored = allAvgScored.reduce((a, b) => a + b, 0) / allAvgScored.length;
    const globalAvgConceded = allAvgConceded.reduce((a, b) => a + b, 0) / allAvgConceded.length;
    
    // Préparer les datasets
    const datasets = [];
    
    filteredTeamData.forEach((team) => {
        const color = getTeamColor(team.id);
        
        if (selectedMatchday === 'all') {
            // Mode "Toute la saison"
            
            // Dataset 1 : Ligne d'évolution de la moyenne cumulative
            if (showAverageLine && team.cumulativeAvg.length > 0) {
                datasets.push({
                    label: `${team.name} - Évolution`,
                    data: team.cumulativeAvg.map(avg => ({
                        x: avg.avgScored,
                        y: avg.avgConceded,
                        label: `${team.name} (J${avg.matchday})`
                    })),
                    backgroundColor: 'transparent',
                    borderColor: color,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    showLine: true,
                    tension: 0.3,
                    order: 2
                });
            }
            
            // Dataset 2 : Gros point final (moyenne de la saison)
            datasets.push({
                label: team.name,
                data: [{
                    x: team.avgScored,
                    y: team.avgConceded,
                    label: team.name
                }],
                backgroundColor: color,
                borderColor: color,
                borderWidth: 3,
                pointRadius: 10,
                pointHoverRadius: 12,
                showLine: false,
                order: 1
            });
            
        } else {
            // Mode "Jusqu'à la journée X"
            const matchday = parseInt(selectedMatchday);
            const pointsByMatchday = [];
            
            // Petits points par journée
            for (let day = 1; day <= matchday; day++) {
                const dayStats = team.byMatchday[day];
                if (dayStats && dayStats.matches > 0) {
                    pointsByMatchday.push({
                        x: dayStats.scored / dayStats.matches,
                        y: dayStats.conceded / dayStats.matches,
                        label: `${team.name} (J${day})`,
                        isAverage: false
                    });
                }
            }
            
            // Ligne d'évolution de la moyenne cumulative
            if (showAverageLine && team.cumulativeAvg.length > 0) {
                const cumulativeData = team.cumulativeAvg
                    .filter(avg => avg.matchday <= matchday)
                    .map(avg => ({
                        x: avg.avgScored,
                        y: avg.avgConceded,
                        label: `${team.name} Moy (J${avg.matchday})`
                    }));
                
                datasets.push({
                    label: `${team.name} - Évolution moyenne`,
                    data: cumulativeData,
                    backgroundColor: 'transparent',
                    borderColor: color,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    showLine: true,
                    tension: 0.3,
                    order: 3
                });
            }
            
            // Points par journée
            datasets.push({
                label: `${team.name} - Par journée`,
                data: pointsByMatchday,
                backgroundColor: color,
                borderColor: color,
                borderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                showLine: false,
                order: 2
            });
            
            // Gros point moyen final
            datasets.push({
                label: `${team.name} - Moyenne`,
                data: [{
                    x: team.avgScored,
                    y: team.avgConceded,
                    label: `${team.name} (Moy)`,
                    isAverage: true
                }],
                backgroundColor: color,
                borderColor: color,
                borderWidth: 3,
                pointRadius: 10,
                pointHoverRadius: 12,
                showLine: false,
                order: 1
            });
        }
    });
    
    // Créer le graphique
    performanceChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            if (!point.label) return '';
                            return [
                                point.label,
                                `Buts marqués: ${point.x.toFixed(2)}/match`,
                                `Buts encaissés: ${point.y.toFixed(2)}/match`
                            ];
                        }
                    }
                },
                datalabels: {
                    display: function(context) {
                        // Afficher les labels seulement pour les gros points
                        const dataset = context.dataset;
                        return dataset.label && !dataset.label.includes('Évolution') && !dataset.label.includes('Par journée');
                    },
                    formatter: function(value, context) {
                        if (!value.label) return '';
                        return value.label.split(' ')[0]; // Nom court
                    },
                    anchor: 'end',
                    align: 'top',
                    offset: 4,
                    font: {
                        size: 11,
                        weight: 'bold'
                    },
                    color: function(context) {
                        return context.dataset.borderColor;
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Buts marqués par match →',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: function(context) {
                            if (Math.abs(context.tick.value - globalAvgScored) < 0.01) {
                                return 'rgba(0, 0, 0, 0.3)';
                            }
                            return 'rgba(0, 0, 0, 0.05)';
                        },
                        lineWidth: function(context) {
                            if (Math.abs(context.tick.value - globalAvgScored) < 0.01) {
                                return 2;
                            }
                            return 1;
                        }
                    }
                },
                y: {
                    type: 'linear',
                    reverse: true,
                    title: {
                        display: true,
                        text: '← Buts encaissés par match (inversé : haut = moins)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: function(context) {
                            if (Math.abs(context.tick.value - globalAvgConceded) < 0.01) {
                                return 'rgba(0, 0, 0, 0.3)';
                            }
                            return 'rgba(0, 0, 0, 0.05)';
                        },
                        lineWidth: function(context) {
                            if (Math.abs(context.tick.value - globalAvgConceded) < 0.01) {
                                return 2;
                            }
                            return 1;
                        }
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// ===============================
// RECORDS DE LA SAISON
// ===============================

// Calculer tous les records de la saison (global)
function calculateSeasonRecords() {
    const records = {
        largestVictory: null,      // Plus large victoire
        highestScoring: null,      // Plus gros score
        longestWinStreak: null,    // Plus longue série de victoires
        longestUnbeatenStreak: null, // Plus longue série sans défaite
        longestScoringStreak: null,  // Plus longue série avec but marqué
        longestCleanSheetStreak: null // Plus longue série sans encaisser
    };
    
    if (allMatches.length === 0) return records;
    
    // Plus large victoire et plus gros score
    allMatches.forEach(match => {
        const homeScore = match.finalScore.home;
        const awayScore = match.finalScore.away;
        const totalGoals = homeScore + awayScore;
        const diff = Math.abs(homeScore - awayScore);
        
        // Plus gros score
        if (!records.highestScoring || totalGoals > records.highestScoring.totalGoals) {
            const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
            const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
            records.highestScoring = {
                match: match,
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                score: `${homeScore} - ${awayScore}`,
                totalGoals: totalGoals
            };
        }
        
        // Plus large victoire
        if (diff > 0 && (!records.largestVictory || diff > records.largestVictory.diff)) {
            const homeTeam = allTeams.find(t => t.id == match.homeTeamId);
            const awayTeam = allTeams.find(t => t.id == match.awayTeamId);
            const winner = homeScore > awayScore ? homeTeam : awayTeam;
            records.largestVictory = {
                match: match,
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                winner: winner,
                score: `${homeScore} - ${awayScore}`,
                diff: diff
            };
        }
    });
    
    // Calculer les séries pour chaque équipe
    const streakRecords = {
        winStreak: { team: null, count: 0, isActive: false },
        unbeatenStreak: { team: null, count: 0, isActive: false },
        scoringStreak: { team: null, count: 0, isActive: false },
        cleanSheetStreak: { team: null, count: 0, isActive: false }
    };
    
    allTeams.forEach(team => {
        const teamStreaks = calculateTeamStreaks(team.id);
        
        if (teamStreaks.winStreak.best > streakRecords.winStreak.count) {
            streakRecords.winStreak = { 
                team: team, 
                count: teamStreaks.winStreak.best, 
                isActive: teamStreaks.winStreak.isActive 
            };
        }
        
        if (teamStreaks.unbeatenStreak.best > streakRecords.unbeatenStreak.count) {
            streakRecords.unbeatenStreak = { 
                team: team, 
                count: teamStreaks.unbeatenStreak.best, 
                isActive: teamStreaks.unbeatenStreak.isActive 
            };
        }
        
        if (teamStreaks.scoringStreak.best > streakRecords.scoringStreak.count) {
            streakRecords.scoringStreak = { 
                team: team, 
                count: teamStreaks.scoringStreak.best, 
                isActive: teamStreaks.scoringStreak.isActive 
            };
        }
        
        if (teamStreaks.cleanSheetStreak.best > streakRecords.cleanSheetStreak.count) {
            streakRecords.cleanSheetStreak = { 
                team: team, 
                count: teamStreaks.cleanSheetStreak.best, 
                isActive: teamStreaks.cleanSheetStreak.isActive 
            };
        }
    });
    
    records.longestWinStreak = streakRecords.winStreak;
    records.longestUnbeatenStreak = streakRecords.unbeatenStreak;
    records.longestScoringStreak = streakRecords.scoringStreak;
    records.longestCleanSheetStreak = streakRecords.cleanSheetStreak;
    
    return records;
}

// Calculer les séries d'une équipe spécifique
function calculateTeamStreaks(teamId) {
    const teamMatches = allMatches
        .filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId)
        .sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
    
    const streaks = {
        winStreak: { current: 0, best: 0, isActive: false },
        unbeatenStreak: { current: 0, best: 0, isActive: false },
        scoringStreak: { current: 0, best: 0, isActive: false },
        cleanSheetStreak: { current: 0, best: 0, isActive: false }
    };
    
    teamMatches.forEach((match, index) => {
        const isHome = match.homeTeamId == teamId;
        const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
        const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
        
        const isWin = goalsFor > goalsAgainst;
        const isDraw = goalsFor === goalsAgainst;
        const isUnbeaten = isWin || isDraw;
        const hasScored = goalsFor > 0;
        const isCleanSheet = goalsAgainst === 0;
        
        // Série de victoires
        if (isWin) {
            streaks.winStreak.current++;
            if (streaks.winStreak.current > streaks.winStreak.best) {
                streaks.winStreak.best = streaks.winStreak.current;
            }
        } else {
            streaks.winStreak.current = 0;
        }
        
        // Série sans défaite
        if (isUnbeaten) {
            streaks.unbeatenStreak.current++;
            if (streaks.unbeatenStreak.current > streaks.unbeatenStreak.best) {
                streaks.unbeatenStreak.best = streaks.unbeatenStreak.current;
            }
        } else {
            streaks.unbeatenStreak.current = 0;
        }
        
        // Série avec but marqué
        if (hasScored) {
            streaks.scoringStreak.current++;
            if (streaks.scoringStreak.current > streaks.scoringStreak.best) {
                streaks.scoringStreak.best = streaks.scoringStreak.current;
            }
        } else {
            streaks.scoringStreak.current = 0;
        }
        
        // Série clean sheet
        if (isCleanSheet) {
            streaks.cleanSheetStreak.current++;
            if (streaks.cleanSheetStreak.current > streaks.cleanSheetStreak.best) {
                streaks.cleanSheetStreak.best = streaks.cleanSheetStreak.current;
            }
        } else {
            streaks.cleanSheetStreak.current = 0;
        }
    });
    
    // Vérifier si les séries sont toujours actives (= série actuelle == meilleure série)
    streaks.winStreak.isActive = streaks.winStreak.current === streaks.winStreak.best && streaks.winStreak.current > 0;
    streaks.unbeatenStreak.isActive = streaks.unbeatenStreak.current === streaks.unbeatenStreak.best && streaks.unbeatenStreak.current > 0;
    streaks.scoringStreak.isActive = streaks.scoringStreak.current === streaks.scoringStreak.best && streaks.scoringStreak.current > 0;
    streaks.cleanSheetStreak.isActive = streaks.cleanSheetStreak.current === streaks.cleanSheetStreak.best && streaks.cleanSheetStreak.current > 0;
    
    return streaks;
}

// Afficher les records globaux
function updateSeasonRecordsGeneral() {
    const container = document.getElementById('seasonRecordsGeneral');
    if (!container) return;
    
    const records = calculateSeasonRecords();
    
    let html = '';
    
    // Plus large victoire
    if (records.largestVictory) {
        const r = records.largestVictory;
        html += `
            <div class="record-card victory">
                <div class="record-title">🎯 Plus large victoire</div>
                <div class="record-value">${r.score}</div>
                <div class="record-details">
                    ${r.homeTeam.shortName} vs ${r.awayTeam.shortName}
                    <br>Journée ${r.match.matchDay || '?'}
                </div>
                <span class="record-holder">${r.winner.shortName} (+${r.diff})</span>
            </div>
        `;
    }
    
    // Plus gros score
    if (records.highestScoring) {
        const r = records.highestScoring;
        html += `
            <div class="record-card goals">
                <div class="record-title">⚽ Plus gros score</div>
                <div class="record-value">${r.score}</div>
                <div class="record-details">
                    ${r.homeTeam.shortName} vs ${r.awayTeam.shortName}
                    <br>Journée ${r.match.matchDay || '?'} • ${r.totalGoals} buts
                </div>
            </div>
        `;
    }
    
    // Série de victoires
    if (records.longestWinStreak && records.longestWinStreak.count > 0) {
        const r = records.longestWinStreak;
        html += `
            <div class="record-card streak-win">
                <div class="record-title">🔥 Victoires consécutives</div>
                <div class="record-value">${r.count} matchs</div>
                <span class="record-holder ${r.isActive ? 'active' : ''}">${r.team.shortName}</span>
                ${r.isActive ? '<div class="record-details" style="margin-top:0.5rem;color:#27ae60;">Série en cours !</div>' : ''}
            </div>
        `;
    }
    
    // Série sans défaite
    if (records.longestUnbeatenStreak && records.longestUnbeatenStreak.count > 0) {
        const r = records.longestUnbeatenStreak;
        html += `
            <div class="record-card streak-unbeaten">
                <div class="record-title">🛡️ Matchs sans défaite</div>
                <div class="record-value">${r.count} matchs</div>
                <span class="record-holder ${r.isActive ? 'active' : ''}">${r.team.shortName}</span>
                ${r.isActive ? '<div class="record-details" style="margin-top:0.5rem;color:#27ae60;">Série en cours !</div>' : ''}
            </div>
        `;
    }
    
    // Série avec but marqué
    if (records.longestScoringStreak && records.longestScoringStreak.count > 0) {
        const r = records.longestScoringStreak;
        html += `
            <div class="record-card streak-scoring">
                <div class="record-title">⚡ Matchs avec but marqué</div>
                <div class="record-value">${r.count} matchs</div>
                <span class="record-holder ${r.isActive ? 'active' : ''}">${r.team.shortName}</span>
                ${r.isActive ? '<div class="record-details" style="margin-top:0.5rem;color:#27ae60;">Série en cours !</div>' : ''}
            </div>
        `;
    }
    
    // Série clean sheet
    if (records.longestCleanSheetStreak && records.longestCleanSheetStreak.count > 0) {
        const r = records.longestCleanSheetStreak;
        html += `
            <div class="record-card clean-sheet">
                <div class="record-title">🧤 Clean sheets consécutifs</div>
                <div class="record-value">${r.count} matchs</div>
                <span class="record-holder ${r.isActive ? 'active' : ''}">${r.team.shortName}</span>
                ${r.isActive ? '<div class="record-details" style="margin-top:0.5rem;color:#27ae60;">Série en cours !</div>' : ''}
            </div>
        `;
    }
    
    container.innerHTML = html || '<p style="text-align:center;color:#7f8c8d;">Aucun record disponible</p>';
}

// Afficher les records d'une équipe spécifique
function updateSeasonRecordsTeam(teamId) {
    const container = document.getElementById('seasonRecordsTeam');
    if (!container) return;
    
    const team = allTeams.find(t => t.id == teamId);
    if (!team) return;
    
    // Mettre à jour le nom de l'équipe dans le titre
    document.querySelectorAll('.selected-team-name-record').forEach(el => {
        el.textContent = team.shortName;
    });
    
    const globalRecords = calculateSeasonRecords();
    const teamStreaks = calculateTeamStreaks(teamId);
    
    // Trouver les matchs records de l'équipe
    const teamMatches = allMatches.filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId);
    
    let teamLargestVictory = null;
    let teamHighestScoring = null;
    
    teamMatches.forEach(match => {
        const isHome = match.homeTeamId == teamId;
        const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
        const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
        const totalGoals = goalsFor + goalsAgainst;
        const diff = goalsFor - goalsAgainst;
        
        // Plus large victoire de l'équipe
        if (diff > 0 && (!teamLargestVictory || diff > teamLargestVictory.diff)) {
            const opponent = allTeams.find(t => t.id == (isHome ? match.awayTeamId : match.homeTeamId));
            teamLargestVictory = {
                match: match,
                opponent: opponent,
                score: isHome ? `${goalsFor} - ${goalsAgainst}` : `${goalsAgainst} - ${goalsFor}`,
                displayScore: `${goalsFor} - ${goalsAgainst}`,
                diff: diff,
                isHome: isHome
            };
        }
        
        // Plus gros score de l'équipe
        if (!teamHighestScoring || totalGoals > teamHighestScoring.totalGoals) {
            const opponent = allTeams.find(t => t.id == (isHome ? match.awayTeamId : match.homeTeamId));
            teamHighestScoring = {
                match: match,
                opponent: opponent,
                score: isHome ? `${goalsFor} - ${goalsAgainst}` : `${goalsAgainst} - ${goalsFor}`,
                totalGoals: totalGoals,
                isHome: isHome
            };
        }
    });
    
    let html = '';
    
    // Plus large victoire de l'équipe
    if (teamLargestVictory) {
        const r = teamLargestVictory;
        const globalBest = globalRecords.largestVictory ? globalRecords.largestVictory.diff : 0;
        const isGlobalRecord = r.diff >= globalBest;
        html += `
            <div class="record-card victory">
                <div class="record-title">🎯 Plus large victoire</div>
                <div class="record-value">${r.displayScore}</div>
                <div class="record-details">
                    ${r.isHome ? 'vs' : '@'} ${r.opponent.shortName}
                    <br>Journée ${r.match.matchDay || '?'}
                </div>
                ${isGlobalRecord ? '<span class="record-holder active">Record de la saison !</span>' : `
                <div class="record-comparison">
                    Record saison : <span class="record-best">${globalRecords.largestVictory.winner.shortName} (+${globalBest})</span>
                </div>`}
            </div>
        `;
    }
    
    // Plus gros score de l'équipe
    if (teamHighestScoring) {
        const r = teamHighestScoring;
        const globalBest = globalRecords.highestScoring ? globalRecords.highestScoring.totalGoals : 0;
        const isGlobalRecord = r.totalGoals >= globalBest;
        html += `
            <div class="record-card goals">
                <div class="record-title">⚽ Plus gros score</div>
                <div class="record-value">${r.score}</div>
                <div class="record-details">
                    ${r.isHome ? 'vs' : '@'} ${r.opponent.shortName}
                    <br>Journée ${r.match.matchDay || '?'} • ${r.totalGoals} buts
                </div>
                ${isGlobalRecord ? '<span class="record-holder active">Record de la saison !</span>' : `
                <div class="record-comparison">
                    Record saison : <span class="record-best">${globalRecords.highestScoring.totalGoals} buts</span>
                </div>`}
            </div>
        `;
    }
    
    // Série de victoires
    const winRecord = globalRecords.longestWinStreak;
    html += `
        <div class="record-card streak-win">
            <div class="record-title">🔥 Victoires consécutives</div>
            <div class="record-value">${teamStreaks.winStreak.best} matchs</div>
            ${teamStreaks.winStreak.isActive ? '<div class="record-details" style="color:#27ae60;">Série en cours !</div>' : ''}
            ${winRecord && winRecord.team && winRecord.team.id == teamId ? 
                '<span class="record-holder active">Record de la saison !</span>' : 
                `<div class="record-comparison">Record saison : <span class="record-best">${winRecord.team ? winRecord.team.shortName : '-'} (${winRecord.count})</span></div>`}
        </div>
    `;
    
    // Série sans défaite
    const unbeatenRecord = globalRecords.longestUnbeatenStreak;
    html += `
        <div class="record-card streak-unbeaten">
            <div class="record-title">🛡️ Matchs sans défaite</div>
            <div class="record-value">${teamStreaks.unbeatenStreak.best} matchs</div>
            ${teamStreaks.unbeatenStreak.isActive ? '<div class="record-details" style="color:#27ae60;">Série en cours !</div>' : ''}
            ${unbeatenRecord && unbeatenRecord.team && unbeatenRecord.team.id == teamId ? 
                '<span class="record-holder active">Record de la saison !</span>' : 
                `<div class="record-comparison">Record saison : <span class="record-best">${unbeatenRecord.team ? unbeatenRecord.team.shortName : '-'} (${unbeatenRecord.count})</span></div>`}
        </div>
    `;
    
    // Série avec but marqué
    const scoringRecord = globalRecords.longestScoringStreak;
    html += `
        <div class="record-card streak-scoring">
            <div class="record-title">⚡ Matchs avec but marqué</div>
            <div class="record-value">${teamStreaks.scoringStreak.best} matchs</div>
            ${teamStreaks.scoringStreak.isActive ? '<div class="record-details" style="color:#27ae60;">Série en cours !</div>' : ''}
            ${scoringRecord && scoringRecord.team && scoringRecord.team.id == teamId ? 
                '<span class="record-holder active">Record de la saison !</span>' : 
                `<div class="record-comparison">Record saison : <span class="record-best">${scoringRecord.team ? scoringRecord.team.shortName : '-'} (${scoringRecord.count})</span></div>`}
        </div>
    `;
    
    // Série clean sheet
    const cleanSheetRecord = globalRecords.longestCleanSheetStreak;
    html += `
        <div class="record-card clean-sheet">
            <div class="record-title">🧤 Clean sheets consécutifs</div>
            <div class="record-value">${teamStreaks.cleanSheetStreak.best} matchs</div>
            ${teamStreaks.cleanSheetStreak.isActive ? '<div class="record-details" style="color:#27ae60;">Série en cours !</div>' : ''}
            ${cleanSheetRecord && cleanSheetRecord.team && cleanSheetRecord.team.id == teamId ? 
                '<span class="record-holder active">Record de la saison !</span>' : 
                `<div class="record-comparison">Record saison : <span class="record-best">${cleanSheetRecord.team ? cleanSheetRecord.team.shortName : '-'} (${cleanSheetRecord.count})</span></div>`}
        </div>
    `;
    
    container.innerHTML = html;
}

// ===============================
// HEATMAP DES BUTS PAR MINUTE
// ===============================

// Définir les tranches de temps pour la heatmap
function getTimeSlices() {
    return [
        { label: '1-15', min: 1, max: 15 },
        { label: '16-30', min: 16, max: 30 },
        { label: '31-45', min: 31, max: 45 },
        { label: '45+', min: 45.01, max: 45.99 },
        { label: '46-60', min: 46, max: 60 },
        { label: '61-75', min: 61, max: 75 },
        { label: '76-90', min: 76, max: 90 },
        { label: '90+', min: 90.01, max: 999 }
    ];
}

// Obtenir la couleur selon l'intensité (0 à 1)
function getHeatmapColor(intensity) {
    if (intensity === 0) return '#e9ecef';
    if (intensity < 0.2) return '#fff3cd';
    if (intensity < 0.4) return '#ffc107';
    if (intensity < 0.6) return '#fd7e14';
    if (intensity < 0.8) return '#dc3545';
    return '#721c24';
}

// Générer la heatmap générale
function updateGoalsHeatmapGeneral() {
    const container = document.getElementById('goalsHeatmapGeneral');
    if (!container) return;
    
    const timeSlices = getTimeSlices();
    const goalCounts = timeSlices.map(() => 0);
    
    // Compter les buts par tranche
    allMatches.forEach(match => {
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                const minute = parseFloat(goal.minute);
                const extraTime = parseFloat(goal.extraTime) || 0;
                
                // Déterminer la tranche
                let realMinute = minute;
                if (extraTime > 0 && minute === 45) {
                    realMinute = 45.5; // Mi-temps additionnelle
                } else if (extraTime > 0 && minute === 90) {
                    realMinute = 90.5; // Fin de match additionnelle
                }
                
                timeSlices.forEach((slice, index) => {
                    if (realMinute >= slice.min && realMinute <= slice.max) {
                        goalCounts[index]++;
                    }
                });
            });
        }
    });
    
    const maxGoals = Math.max(...goalCounts, 1);
    
    // Générer le HTML
    container.innerHTML = timeSlices.map((slice, index) => {
        const count = goalCounts[index];
        const intensity = count / maxGoals;
        const color = getHeatmapColor(intensity);
        const percentage = allMatches.length > 0 ? ((count / goalCounts.reduce((a, b) => a + b, 0)) * 100).toFixed(1) : 0;
        
        return `
            <div class="heatmap-segment" style="background-color: ${color}">
                ${count}
                <span class="tooltip">${slice.label}' : ${count} buts (${percentage}%)</span>
            </div>
        `;
    }).join('');
}

// Générer la heatmap pour une équipe
function updateGoalsHeatmapTeam(teamId) {
    const containerFor = document.getElementById('goalsHeatmapTeamFor');
    const containerAgainst = document.getElementById('goalsHeatmapTeamAgainst');
    if (!containerFor || !containerAgainst) return;
    
    const team = allTeams.find(t => t.id == teamId);
    document.querySelectorAll('.selected-team-name-heatmap').forEach(el => {
        el.textContent = team ? team.shortName : '';
    });
    
    const timeSlices = getTimeSlices();
    const goalCountsFor = timeSlices.map(() => 0);
    const goalCountsAgainst = timeSlices.map(() => 0);
    
    // Filtrer les matchs de l'équipe
    const teamMatches = allMatches.filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId);
    
    // Compter les buts par tranche
    teamMatches.forEach(match => {
        const isHome = match.homeTeamId == teamId;
        
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                const minute = parseFloat(goal.minute);
                const extraTime = parseFloat(goal.extraTime) || 0;
                const isTeamGoal = goal.teamId == teamId;
                
                let realMinute = minute;
                if (extraTime > 0 && minute === 45) {
                    realMinute = 45.5;
                } else if (extraTime > 0 && minute === 90) {
                    realMinute = 90.5;
                }
                
                timeSlices.forEach((slice, index) => {
                    if (realMinute >= slice.min && realMinute <= slice.max) {
                        if (isTeamGoal) {
                            goalCountsFor[index]++;
                        } else {
                            goalCountsAgainst[index]++;
                        }
                    }
                });
            });
        }
    });
    
    const maxGoalsFor = Math.max(...goalCountsFor, 1);
    const maxGoalsAgainst = Math.max(...goalCountsAgainst, 1);
    
    // Générer le HTML pour les buts marqués
    containerFor.innerHTML = timeSlices.map((slice, index) => {
        const count = goalCountsFor[index];
        const intensity = count / maxGoalsFor;
        const color = getHeatmapColor(intensity);
        const total = goalCountsFor.reduce((a, b) => a + b, 0);
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        
        return `
            <div class="heatmap-segment" style="background-color: ${color}">
                ${count}
                <span class="tooltip">${slice.label}' : ${count} buts (${percentage}%)</span>
            </div>
        `;
    }).join('');
    
    // Générer le HTML pour les buts encaissés
    containerAgainst.innerHTML = timeSlices.map((slice, index) => {
        const count = goalCountsAgainst[index];
        const intensity = count / maxGoalsAgainst;
        const color = getHeatmapColor(intensity);
        const total = goalCountsAgainst.reduce((a, b) => a + b, 0);
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        
        return `
            <div class="heatmap-segment" style="background-color: ${color}">
                ${count}
                <span class="tooltip">${slice.label}' : ${count} buts (${percentage}%)</span>
            </div>
        `;
    }).join('');
}

// ===============================
// CARTE DES RÉSULTATS GLOBALE
// ===============================

function updateResultsCardGlobal() {
    const table = document.getElementById('resultsCardGlobal');
    if (!table) return;
    
    // Trouver le nombre max de journées
    const maxMatchDay = Math.max(...allMatches.map(m => m.matchDay || 0), 0);
    
    if (maxMatchDay === 0) {
        table.innerHTML = '<tr><td colspan="100%" style="text-align:center;padding:2rem;color:#7f8c8d;">Aucun match joué</td></tr>';
        return;
    }
    
    // Générer l'en-tête
    let headerHTML = '<tr><th>Équipe</th>';
    for (let i = 1; i <= maxMatchDay; i++) {
        headerHTML += `<th>J${i}</th>`;
    }
    headerHTML += '</tr>';
    
    // Générer les lignes pour chaque équipe
    let bodyHTML = '';
    
    // Trier les équipes par points (classement actuel)
    const ranking = allTeams.map(team => {
        const teamMatches = allMatches.filter(m => m.homeTeamId == team.id || m.awayTeamId == team.id);
        let points = 0;
        teamMatches.forEach(match => {
            const isHome = match.homeTeamId == team.id;
            const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
            const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
            if (goalsFor > goalsAgainst) points += 3;
            else if (goalsFor === goalsAgainst) points += 1;
        });
        return { ...team, points, matchCount: teamMatches.length };
    }).filter(t => t.matchCount > 0).sort((a, b) => b.points - a.points);
    
    ranking.forEach(team => {
        bodyHTML += `<tr><td>${team.shortName}</td>`;
        
        for (let day = 1; day <= maxMatchDay; day++) {
            const match = allMatches.find(m => 
                m.matchDay === day && (m.homeTeamId == team.id || m.awayTeamId == team.id)
            );
            
            if (match) {
                const isHome = match.homeTeamId == team.id;
                const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
                const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
                
                let resultClass = 'draw';
                let resultText = 'N';
                if (goalsFor > goalsAgainst) {
                    resultClass = 'win';
                    resultText = 'V';
                } else if (goalsFor < goalsAgainst) {
                    resultClass = 'loss';
                    resultText = 'D';
                }
                
                const opponent = allTeams.find(t => t.id == (isHome ? match.awayTeamId : match.homeTeamId));
                const tooltip = `${isHome ? 'vs' : '@'} ${opponent ? opponent.shortName : '?'} (${goalsFor}-${goalsAgainst})`;
                
                bodyHTML += `<td><span class="result-cell ${resultClass}" title="${tooltip}">${resultText}</span></td>`;
            } else {
                bodyHTML += `<td><span class="result-cell empty">-</span></td>`;
            }
        }
        
        bodyHTML += '</tr>';
    });
    
    table.querySelector('thead').innerHTML = headerHTML;
    table.querySelector('tbody').innerHTML = bodyHTML;
}

// ===============================
// CARTE DES RÉSULTATS ÉQUIPE
// ===============================

function updateResultsCardTeam(teamId) {
    const container = document.getElementById('resultsCardTeam');
    if (!container) return;
    
    const team = allTeams.find(t => t.id == teamId);
    document.querySelectorAll('.selected-team-name-results').forEach(el => {
        el.textContent = team ? team.shortName : '';
    });
    
    // Récupérer les matchs de l'équipe triés par journée
    const teamMatches = allMatches
        .filter(m => m.homeTeamId == teamId || m.awayTeamId == teamId)
        .sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
    
    if (teamMatches.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;">Aucun match joué</p>';
        return;
    }
    
    // Générer le HTML
    container.innerHTML = teamMatches.map(match => {
        const isHome = match.homeTeamId == teamId;
        const goalsFor = isHome ? match.finalScore.home : match.finalScore.away;
        const goalsAgainst = isHome ? match.finalScore.away : match.finalScore.home;
        const opponent = allTeams.find(t => t.id == (isHome ? match.awayTeamId : match.homeTeamId));
        
        let resultClass = 'draw';
        let resultText = 'N';
        if (goalsFor > goalsAgainst) {
            resultClass = 'win';
            resultText = 'V';
        } else if (goalsFor < goalsAgainst) {
            resultClass = 'loss';
            resultText = 'D';
        }
        
        const location = isHome ? '🏠 Domicile' : '✈️ Extérieur';
        
        return `
            <div class="result-match-card ${resultClass}">
                <div class="result-matchday">J${match.matchDay || '?'}</div>
                <div class="result-badge ${resultClass}">${resultText}</div>
                <div class="result-info">
                    <div class="result-opponent">${isHome ? 'vs' : '@'} ${opponent ? opponent.shortName : '?'}</div>
                    <div class="result-score">${goalsFor} - ${goalsAgainst}</div>
                    <div class="result-location">${location}</div>
                </div>
            </div>
        `;
    }).join('');
}


// ===============================
// CARTE DES CONFRONTATIONS
// ===============================

let confrontationSimulation = null;

function displayConfrontations() {
    const container = document.getElementById('confrontationsGraph');
    const detailsContainer = document.getElementById('confrontationDetails');
    
    if (!container) return;
    
    // Vérifier si D3 est chargé
    if (typeof d3 === 'undefined') {
        container.innerHTML = '<p style="text-align:center;color:#e74c3c;padding:2rem;">Erreur: D3.js non chargé</p>';
        return;
    }
    
    // Nettoyer
    container.innerHTML = '';
    if (detailsContainer) {
        detailsContainer.innerHTML = '<p>Cliquez sur un lien ou une équipe pour voir les détails</p>';
        detailsContainer.classList.add('empty');
    }
    
    // Récupérer les options
    const showDraws = document.getElementById('showDraws')?.checked ?? true;
    const showLabels = document.getElementById('showLabels')?.checked ?? true;
    const filter = document.getElementById('confrontationFilter')?.value || 'all';
    
    // Récupérer les équipes et matchs
    const teams = getTeamsBySeason(currentSeason);
    const matches = allMatches.filter(m => m.season === currentSeason && m.finalScore);
    
    if (teams.length === 0 || matches.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#7f8c8d;padding:2rem;">Pas assez de données pour afficher le graphe</p>';
        return;
    }
    
    // Préparer les nœuds
    const nodes = teams.map(team => ({
        id: team.id,
        name: team.shortName,
        fullName: team.name,
        elo: team.eloRating || 1500
    }));
    
    // Préparer les liens
    const matchesBetween = {};
    
    matches.forEach(match => {
        const pairKey = [match.homeTeamId, match.awayTeamId].sort((a, b) => a - b).join('-');
        
        if (!matchesBetween[pairKey]) {
            matchesBetween[pairKey] = [];
        }
        
        const homeScore = match.finalScore.home;
        const awayScore = match.finalScore.away;
        
        matchesBetween[pairKey].push({
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            homeScore,
            awayScore,
            matchDay: match.matchDay,
            isDraw: homeScore === awayScore,
            winnerId: homeScore > awayScore ? match.homeTeamId : (awayScore > homeScore ? match.awayTeamId : null)
        });
    });
    
    // Créer les liens
    const links = [];
    
    Object.entries(matchesBetween).forEach(([pairKey, pairMatches]) => {
        const [team1, team2] = pairKey.split('-').map(Number);
        
        let team1Wins = 0, team2Wins = 0, draws = 0;
        
        pairMatches.forEach(m => {
            if (m.isDraw) draws++;
            else if (m.winnerId == team1) team1Wins++;
            else team2Wins++;
        });
        
        // Filtrer selon l'option
        let filteredMatches = [...pairMatches];
        if (filter === 'home') {
            filteredMatches = pairMatches.filter(m => 
                (m.homeTeamId == m.winnerId)
            );
        } else if (filter === 'away') {
            filteredMatches = pairMatches.filter(m => 
                (m.awayTeamId == m.winnerId)
            );
        }
        
        if (filteredMatches.length === 0) return;
        
        // Créer le lien de victoire
        if (team1Wins > 0 || team2Wins > 0) {
            const dominant = team1Wins >= team2Wins ? team1 : team2;
            const subordinate = dominant == team1 ? team2 : team1;
            
            links.push({
                source: dominant,
                target: subordinate,
                type: 'win',
                matches: pairMatches,
                team1, team2,
                team1Wins, team2Wins, draws
            });
        } else if (showDraws && draws > 0) {
            // Seulement des nuls
            links.push({
                source: team1,
                target: team2,
                type: 'draw',
                matches: pairMatches,
                team1, team2,
                team1Wins: 0, team2Wins: 0, draws
            });
        }
    });
    
    // Dimensions
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;
    
    // Créer le SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Marqueur de flèche
    svg.append('defs').append('marker')
        .attr('id', 'arrowhead')
        .attr('viewBox', '-0 -5 10 10')
        .attr('refX', 28)
        .attr('refY', 0)
        .attr('orient', 'auto')
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .append('path')
        .attr('d', 'M 0,-5 L 10,0 L 0,5')
        .attr('class', 'arrow-head');
    
    // Groupe principal
    const g = svg.append('g');
    
    // Zoom
    svg.call(d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => g.attr('transform', event.transform)));
    
    // Simulation de force
    confrontationSimulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(120))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(35));
    
    // Dessiner les liens
    const link = g.append('g')
        .selectAll('path')
        .data(links)
        .enter()
        .append('path')
        .attr('class', d => `link ${d.type}`)
        .attr('marker-end', d => d.type === 'win' ? 'url(#arrowhead)' : null)
        .on('click', (event, d) => showLinkDetails(d, teams))
        .on('mouseover', function() { d3.select(this).style('stroke-opacity', 1); })
        .on('mouseout', function() { d3.select(this).style('stroke-opacity', 0.5); });
    
    // Labels des liens
    const linkLabels = g.append('g')
        .selectAll('text')
        .data(links)
        .enter()
        .append('text')
        .attr('class', 'link-label')
        .style('display', showLabels ? 'block' : 'none')
        .text(d => `${d.team1Wins}-${d.draws}-${d.team2Wins}`);
    
    // Dessiner les nœuds
    const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', (event, d) => {
                if (!event.active) confrontationSimulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
            .on('end', (event, d) => {
                if (!event.active) confrontationSimulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            }))
        .on('click', (event, d) => showNodeDetails(d, teams, matches));
    
    // Cercles
    node.append('circle')
        .attr('class', 'node-circle')
        .attr('r', d => 18 + (d.elo - 1400) / 60)
        .style('fill', d => getEloColor(d.elo));
    
    // Labels
    node.append('text')
        .attr('class', 'node-label')
        .attr('dy', 3)
        .text(d => d.name);
    
    // Elo
    node.append('text')
        .attr('class', 'node-elo')
        .attr('dy', 16)
        .text(d => d.elo);
    
    // Update positions
    confrontationSimulation.on('tick', () => {
        link.attr('d', d => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
            return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
        });
        
        linkLabels
            .attr('x', d => (d.source.x + d.target.x) / 2)
            .attr('y', d => (d.source.y + d.target.y) / 2 - 5);
        
        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // Événements des contrôles
    document.getElementById('showDraws')?.addEventListener('change', displayConfrontations);
    document.getElementById('showLabels')?.addEventListener('change', () => {
        const show = document.getElementById('showLabels').checked;
        d3.selectAll('.link-label').style('display', show ? 'block' : 'none');
    });
    document.getElementById('confrontationFilter')?.addEventListener('change', displayConfrontations);
}

function getEloColor(elo) {
    const min = 1350, max = 1650;
    const norm = Math.max(0, Math.min(1, (elo - min) / (max - min)));
    const r = Math.round(220 * (1 - norm) + 50);
    const g = Math.round(80 + 140 * norm);
    const b = Math.round(80);
    return `rgb(${r}, ${g}, ${b})`;
}

function showLinkDetails(linkData, teams) {
    const container = document.getElementById('confrontationDetails');
    if (!container) return;
    
    container.classList.remove('empty');
    
    const team1 = teams.find(t => t.id == linkData.team1);
    const team2 = teams.find(t => t.id == linkData.team2);
    
    let html = `
        <h4>⚔️ ${team1?.shortName || '?'} vs ${team2?.shortName || '?'}</h4>
        <p><strong>Bilan :</strong> ${linkData.team1Wins}V ${team1?.shortName} - ${linkData.draws}N - ${linkData.team2Wins}V ${team2?.shortName}</p>
        <div class="detail-matches">
    `;
    
    linkData.matches.forEach(m => {
        const home = teams.find(t => t.id == m.homeTeamId);
        const away = teams.find(t => t.id == m.awayTeamId);
        html += `
            <div class="detail-match ${m.isDraw ? 'draw' : ''}">
                <span class="matchday">J${m.matchDay}</span>
                <span>${home?.shortName}</span>
                <span class="score">${m.homeScore}-${m.awayScore}</span>
                <span>${away?.shortName}</span>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function showNodeDetails(nodeData, teams, matches) {
    const container = document.getElementById('confrontationDetails');
    if (!container) return;
    
    container.classList.remove('empty');
    
    const teamMatches = matches.filter(m => 
        (m.homeTeamId == nodeData.id || m.awayTeamId == nodeData.id) && m.finalScore
    );
    
    let wins = 0, draws = 0, losses = 0;
    const dominated = [], dominatedBy = [];
    const opponents = {};
    
    teamMatches.forEach(m => {
        const isHome = m.homeTeamId == nodeData.id;
        const gf = isHome ? m.finalScore.home : m.finalScore.away;
        const ga = isHome ? m.finalScore.away : m.finalScore.home;
        const oppId = isHome ? m.awayTeamId : m.homeTeamId;
        
        if (gf > ga) wins++;
        else if (gf < ga) losses++;
        else draws++;
        
        if (!opponents[oppId]) opponents[oppId] = { w: 0, d: 0, l: 0 };
        if (gf > ga) opponents[oppId].w++;
        else if (gf < ga) opponents[oppId].l++;
        else opponents[oppId].d++;
    });
    
    Object.entries(opponents).forEach(([oppId, o]) => {
        const opp = teams.find(t => t.id == oppId);
        if (o.w > o.l) dominated.push(opp?.shortName);
        else if (o.l > o.w) dominatedBy.push(opp?.shortName);
    });
    
    container.innerHTML = `
        <h4>📊 ${nodeData.name} (Elo: ${nodeData.elo})</h4>
        <div class="team-bilan">
            <div class="bilan-item"><strong>Bilan :</strong> ${wins}V - ${draws}N - ${losses}D</div>
            <div class="bilan-item"><strong>Domine :</strong> ${dominated.length > 0 ? dominated.join(', ') : 'Aucune'}</div>
            <div class="bilan-item"><strong>Dominé par :</strong> ${dominatedBy.length > 0 ? dominatedBy.join(', ') : 'Aucune'}</div>
        </div>
    `;
}

// Appeler la fonction quand les données sont chargées
function initConfrontationsListeners() {
    // Retirer les anciens listeners pour éviter les doublons
    const showDraws = document.getElementById('showDraws');
    const showLabels = document.getElementById('showLabels');
    const confrontationFilter = document.getElementById('confrontationFilter');
    
    if (showDraws) {
        showDraws.replaceWith(showDraws.cloneNode(true));
        document.getElementById('showDraws').addEventListener('change', displayConfrontations);
    }
    if (showLabels) {
        const newLabels = showLabels.cloneNode(true);
        showLabels.replaceWith(newLabels);
        newLabels.addEventListener('change', () => {
            d3.selectAll('.link-label').style('display', newLabels.checked ? 'block' : 'none');
        });
    }
    if (confrontationFilter) {
        confrontationFilter.replaceWith(confrontationFilter.cloneNode(true));
        document.getElementById('confrontationFilter').addEventListener('change', displayConfrontations);
    }
}

/**
 * Analyse la vulnérabilité post-but : combien de fois une équipe encaisse
 * dans les X minutes après avoir marqué
 * @param {number} windowMinutes - Fenêtre en minutes (par défaut 3)
 * @returns {Array} Stats par équipe triées par vulnérabilité
 */
function analyzePostGoalVulnerability(windowMinutes = 3, season) {
    season = season || getCurrentSeason();
    const matches = getStoredMatches().filter(m => m.season === season);
    const allTeamsList = getTeamsBySeason(season);
    
    // Structure par équipe
    const teamStats = {};
    allTeamsList.forEach(team => {
        teamStats[team.id] = {
            teamId: team.id,
            name: team.name,
            shortName: team.shortName,
            goalsScored: 0,          // Total buts marqués
            timesConcededAfter: 0,    // Fois où on encaisse dans la fenêtre après avoir marqué
            timesScored: 0,           // Fois où on marque (= occasions d'être vulnérable)
            concededDetails: [],      // Détails des buts encaissés après avoir marqué
            // Inverse : combien de fois on marque juste après avoir encaissé
            timesRespondedAfter: 0,   // Fois où on répond dans la fenêtre après avoir encaissé
            respondedDetails: [],     // Détails des réponses après avoir encaissé
            timesConceded: 0          // Fois où on encaisse (= occasions de répondre)
        };
    });
    
    matches.forEach(match => {
        if (!match.goals || match.goals.length < 2) return; // Au moins 2 buts pour analyser
        
        // Trier les buts par minute réelle
        const sortedGoals = [...match.goals].sort((a, b) => {
            const minuteA = parseInt(a.minute) + (parseInt(a.extraTime) || 0) / 100;
            const minuteB = parseInt(b.minute) + (parseInt(b.extraTime) || 0) / 100;
            return minuteA - minuteB;
        });
        
        // Pour chaque but, vérifier si l'équipe adverse marque dans les X minutes suivantes
        for (let i = 0; i < sortedGoals.length; i++) {
            const scoringGoal = sortedGoals[i];
            const scoringTeamId = scoringGoal.teamId;
            const scoringMinute = parseInt(scoringGoal.minute) + (parseInt(scoringGoal.extraTime) || 0) / 100;
            
            // L'équipe qui a marqué
            const opponentTeamId = scoringTeamId == match.homeTeamId ? match.awayTeamId : match.homeTeamId;
            
            if (!teamStats[scoringTeamId]) continue;
            
            teamStats[scoringTeamId].timesScored++;
            teamStats[opponentTeamId].timesConceded++;
            
            // Vérifier les buts suivants dans la fenêtre
            for (let j = i + 1; j < sortedGoals.length; j++) {
                const nextGoal = sortedGoals[j];
                const nextMinute = parseInt(nextGoal.minute) + (parseInt(nextGoal.extraTime) || 0) / 100;
                const timeDiff = nextMinute - scoringMinute;
                
                if (timeDiff > windowMinutes) break; // Plus dans la fenêtre
                
                // But de l'adversaire dans la fenêtre → vulnérabilité
                if (nextGoal.teamId != scoringTeamId) {
                    teamStats[scoringTeamId].timesConcededAfter++;
                    teamStats[scoringTeamId].concededDetails.push({
                        matchDay: match.matchDay,
                        opponent: opponentTeamId,
                        goalMinute: parseInt(scoringGoal.minute),
                        concededMinute: parseInt(nextGoal.minute),
                        timeDiff: Math.round(timeDiff * 100) / 100
                    });
                    break; // Compter qu'une seule fois par but marqué
                }
                
                // But de la même équipe dans la fenêtre après avoir encaissé
                if (nextGoal.teamId == scoringTeamId) {
                    // C'est plutôt "l'adversaire a encaissé puis s'est fait marquer dessus"
                    // On track l'inverse aussi
                }
            }
            
            // Vérifier si l'adversaire "répond" : l'adversaire a encaissé, puis marque dans la fenêtre
            // (c'est le même calcul vu du côté adverse)
            for (let j = i + 1; j < sortedGoals.length; j++) {
                const nextGoal = sortedGoals[j];
                const nextMinute = parseInt(nextGoal.minute) + (parseInt(nextGoal.extraTime) || 0) / 100;
                const timeDiff = nextMinute - scoringMinute;
                
                if (timeDiff > windowMinutes) break;
                
                if (nextGoal.teamId == opponentTeamId) {
                    teamStats[opponentTeamId].timesRespondedAfter++;
                    teamStats[opponentTeamId].respondedDetails.push({
                        matchDay: match.matchDay,
                        opponent: scoringTeamId,
                        concededMinute: parseInt(scoringGoal.minute),
                        respondedMinute: parseInt(nextGoal.minute),
                        timeDiff: Math.round(timeDiff * 100) / 100
                    });
                    break;
                }
            }
        }
    });
    
    // Calculer les pourcentages et trier
    const results = Object.values(teamStats).map(team => {
        const vulnerabilityPct = team.timesScored > 0 
            ? Math.round((team.timesConcededAfter / team.timesScored) * 1000) / 10 
            : 0;
        const responsePct = team.timesConceded > 0 
            ? Math.round((team.timesRespondedAfter / team.timesConceded) * 1000) / 10 
            : 0;
            
        return {
            ...team,
            vulnerabilityPct,  // % de fois où on encaisse après avoir marqué
            responsePct        // % de fois où on marque après avoir encaissé
        };
    });
    
    return results;
}

function initVulnerabilityAnalysis() {
    const select = document.getElementById('vulnerabilityWindow');
    if (!select) return;
    
    select.addEventListener('change', () => displayVulnerability());
    displayVulnerability();
}

function displayVulnerability() {
    const container = document.getElementById('vulnerabilityContainer');
    if (!container) return;
    
    const windowMinutes = parseInt(document.getElementById('vulnerabilityWindow')?.value || 3);
    const results = analyzePostGoalVulnerability(windowMinutes);
    
    if (!results || results.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#95a5a6;">Pas assez de données</p>';
        return;
    }
    
    // Trier par vulnérabilité décroissante
    const sortedByVuln = [...results]
        .filter(t => t.timesScored >= 3) // Au moins 3 buts marqués pour être significatif
        .sort((a, b) => b.vulnerabilityPct - a.vulnerabilityPct);
    
    let html = `
        <table class="stats-table" style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="background: linear-gradient(135deg, #2c3e50, #34495e); color: white;">
                    <th style="padding: 0.75rem 0.5rem;">Équipe</th>
                    <th style="padding: 0.75rem 0.5rem;" title="Buts marqués">⚽ Marqués</th>
                    <th style="padding: 0.75rem 0.5rem;" title="Fois encaissé dans les ${windowMinutes} min après avoir marqué">😵 Encaissé après</th>
                    <th style="padding: 0.75rem 0.5rem;" title="% vulnérabilité">% Vulnérable</th>
                    <th style="padding: 0.75rem 0.5rem;" title="Buts encaissés total">🛡️ Encaissés</th>
                    <th style="padding: 0.75rem 0.5rem;" title="Fois répondu dans les ${windowMinutes} min après avoir encaissé">💪 Répondu après</th>
                    <th style="padding: 0.75rem 0.5rem;" title="% réponse">% Réponse</th>
                    <th style="padding: 0.75rem 0.5rem;">Bilan</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedByVuln.forEach(team => {
        const vulnColor = team.vulnerabilityPct >= 15 ? '#e74c3c' 
                        : team.vulnerabilityPct >= 10 ? '#f39c12' 
                        : '#27ae60';
        const respColor = team.responsePct >= 15 ? '#27ae60' 
                        : team.responsePct >= 10 ? '#f39c12' 
                        : '#e74c3c';
        
        // Barre visuelle de vulnérabilité
        const vulnBar = `<div style="display:flex;align-items:center;gap:0.5rem;">
            <div style="flex:1;height:8px;background:#ecf0f1;border-radius:4px;overflow:hidden;">
                <div style="width:${Math.min(team.vulnerabilityPct * 2, 100)}%;height:100%;background:${vulnColor};border-radius:4px;"></div>
            </div>
            <span style="font-weight:bold;color:${vulnColor};">${team.vulnerabilityPct}%</span>
        </div>`;
        
        const respBar = `<div style="display:flex;align-items:center;gap:0.5rem;">
            <div style="flex:1;height:8px;background:#ecf0f1;border-radius:4px;overflow:hidden;">
                <div style="width:${Math.min(team.responsePct * 2, 100)}%;height:100%;background:${respColor};border-radius:4px;"></div>
            </div>
            <span style="font-weight:bold;color:${respColor};">${team.responsePct}%</span>
        </div>`;
        
        // Bilan : lucide ou relâchement ?
        let bilan = '';
        if (team.vulnerabilityPct >= 15) {
            bilan = '<span style="color:#e74c3c;">😴 Relâchement</span>';
        } else if (team.vulnerabilityPct >= 10) {
            bilan = '<span style="color:#f39c12;">⚠️ Attention</span>';
        } else {
            bilan = '<span style="color:#27ae60;">🧠 Lucide</span>';
        }
        
        html += `
            <tr>
                <td style="padding:0.6rem 0.5rem;font-weight:600;">${team.shortName || team.name}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;">${team.timesScored}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;font-weight:bold;color:${vulnColor};cursor:help;" 
                    title="${team.concededDetails.map(d => {
                        const opp = allTeams.find(t => t.id == d.opponent);
                        return 'J' + d.matchDay + ' vs ' + (opp ? opp.shortName : '?') + ' (but à ' + d.goalMinute + '\\\' → encaissé à ' + d.concededMinute + '\\\')';
                    }).join('\n')}">
                    ${team.timesConcededAfter}
                </td>
                <td style="padding:0.6rem 0.5rem;">${vulnBar}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;">${team.timesConceded}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;font-weight:bold;color:${respColor};cursor:help;" 
                    title="${team.respondedDetails.map(d => {
                        const opp = allTeams.find(t => t.id == d.opponent);
                        return 'J' + d.matchDay + ' vs ' + (opp ? opp.shortName : '?') + ' (encaissé à ' + d.concededMinute + '\\\' → répondu à ' + d.respondedMinute + '\\\')';
                    }).join('\n')}">
                    ${team.timesRespondedAfter}
                </td>
                <td style="padding:0.6rem 0.5rem;">${respBar}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;">${bilan}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    
    // Ajouter une légende
    html += `
        <div style="margin-top:1rem;padding:1rem;background:#f8f9fa;border-radius:8px;font-size:0.85rem;color:#7f8c8d;">
            <strong>📖 Lecture :</strong> 
            <strong style="color:#e74c3c;">😵 Vulnérabilité</strong> = % de fois où l'équipe encaisse dans les ${windowMinutes} min après avoir marqué (relâchement).
            <strong style="color:#27ae60;">💪 Réponse</strong> = % de fois où l'équipe marque dans les ${windowMinutes} min après avoir encaissé (réaction).
        </div>
    `;
    
    container.innerHTML = html;
}

// ===============================
// 1. RETOURNEMENTS DE SITUATION
// ===============================

function analyzeRetournements() {
    const teamStats = {};
    
    allTeams.forEach(team => {
        teamStats[team.id] = {
            teamId: team.id,
            name: team.name,
            shortName: team.shortName,
            // Menait puis a perdu
            leadThenLost: 0,
            leadThenLostDetails: [],
            // Menait puis nul
            leadThenDraw: 0,
            leadThenDrawDetails: [],
            // Était mené puis a gagné (remontada)
            trailingThenWon: 0,
            trailingThenWonDetails: [],
            // Était mené puis nul
            trailingThenDraw: 0,
            trailingThenDrawDetails: [],
            // Total matchs
            totalMatches: 0
        };
    });
    
    allMatches.forEach(match => {
        if (!match.goals || match.goals.length === 0) return;
        
        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;
        
        if (!teamStats[homeId] || !teamStats[awayId]) return;
        
        teamStats[homeId].totalMatches++;
        teamStats[awayId].totalMatches++;
        
        // Trier les buts chronologiquement
        const sortedGoals = [...match.goals].sort((a, b) => {
            const minA = parseInt(a.minute) + (parseInt(a.extraTime) || 0) / 100;
            const minB = parseInt(b.minute) + (parseInt(b.extraTime) || 0) / 100;
            return minA - minB;
        });
        
        // Simuler le score au fil du match
        let homeScore = 0, awayScore = 0;
        let homeEverLed = false, awayEverLed = false;
        
        sortedGoals.forEach(goal => {
            if (goal.teamId == homeId) homeScore++;
            else awayScore++;
            
            if (homeScore > awayScore) homeEverLed = true;
            if (awayScore > homeScore) awayEverLed = true;
        });
        
        const finalHome = match.finalScore.home;
        const finalAway = match.finalScore.away;
        const homeTeam = allTeams.find(t => t.id == homeId);
        const awayTeam = allTeams.find(t => t.id == awayId);
        
        const matchInfo = {
            matchDay: match.matchDay,
            home: homeTeam?.shortName || '?',
            away: awayTeam?.shortName || '?',
            score: `${finalHome}-${finalAway}`
        };
        
        // Dom a mené puis perdu
        if (homeEverLed && finalHome < finalAway) {
            teamStats[homeId].leadThenLost++;
            teamStats[homeId].leadThenLostDetails.push(matchInfo);
            teamStats[awayId].trailingThenWon++;
            teamStats[awayId].trailingThenWonDetails.push(matchInfo);
        }
        // Dom a mené puis nul
        if (homeEverLed && finalHome === finalAway) {
            teamStats[homeId].leadThenDraw++;
            teamStats[homeId].leadThenDrawDetails.push(matchInfo);
            teamStats[awayId].trailingThenDraw++;
            teamStats[awayId].trailingThenDrawDetails.push(matchInfo);
        }
        // Ext a mené puis perdu
        if (awayEverLed && finalAway < finalHome) {
            teamStats[awayId].leadThenLost++;
            teamStats[awayId].leadThenLostDetails.push(matchInfo);
            teamStats[homeId].trailingThenWon++;
            teamStats[homeId].trailingThenWonDetails.push(matchInfo);
        }
        // Ext a mené puis nul
        if (awayEverLed && finalAway === finalHome) {
            teamStats[awayId].leadThenDraw++;
            teamStats[awayId].leadThenDrawDetails.push(matchInfo);
            teamStats[homeId].trailingThenDraw++;
            teamStats[homeId].trailingThenDrawDetails.push(matchInfo);
        }
    });
    
    return Object.values(teamStats);
}

function displayRetournements() {
    const container = document.getElementById('retournementsContainer');
    if (!container) return;
    
    const results = analyzeRetournements();
    
    // Trier par total de retournements subis (leadThenLost + leadThenDraw)
    const sorted = results
        .filter(t => t.totalMatches > 0)
        .sort((a, b) => (b.leadThenLost + b.leadThenDraw + b.trailingThenWon + b.trailingThenDraw) 
                      - (a.leadThenLost + a.leadThenDraw + a.trailingThenWon + a.trailingThenDraw));
    
    if (sorted.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#95a5a6;">Pas assez de données</p>';
        return;
    }
    
    let html = `
        <table class="stats-table" style="width:100%; border-collapse:collapse;">
            <thead>
                <tr>
                    <th>Équipe</th>
                    <th title="Menait puis a perdu">😱 Menait → Perdu</th>
                    <th title="Menait puis match nul">😤 Menait → Nul</th>
                    <th title="Était mené puis a gagné">🔥 Mené → Gagné</th>
                    <th title="Était mené puis match nul">💪 Mené → Nul</th>
                    <th>Bilan mental</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sorted.forEach(team => {
        const lost = team.leadThenLost;
        const drawAfterLead = team.leadThenDraw;
        const remontada = team.trailingThenWon;
        const drawAfterTrail = team.trailingThenDraw;
        
        // Tooltip pour chaque cellule
        const lostTitle = team.leadThenLostDetails.map(d => `J${d.matchDay}: ${d.home}-${d.away} (${d.score})`).join('\n');
        const drawLeadTitle = team.leadThenDrawDetails.map(d => `J${d.matchDay}: ${d.home}-${d.away} (${d.score})`).join('\n');
        const remontadaTitle = team.trailingThenWonDetails.map(d => `J${d.matchDay}: ${d.home}-${d.away} (${d.score})`).join('\n');
        const drawTrailTitle = team.trailingThenDrawDetails.map(d => `J${d.matchDay}: ${d.home}-${d.away} (${d.score})`).join('\n');
        
        // Bilan : remontadas - effondrements
        const bilanScore = (remontada + drawAfterTrail) - (lost + drawAfterLead);
        let bilan;
        if (bilanScore > 1) bilan = '<span style="color:#27ae60;">🦁 Mental d\'acier</span>';
        else if (bilanScore > 0) bilan = '<span style="color:#27ae60;">💪 Solide</span>';
        else if (bilanScore === 0) bilan = '<span style="color:#f39c12;">😐 Neutre</span>';
        else if (bilanScore > -2) bilan = '<span style="color:#e67e22;">😰 Fragile</span>';
        else bilan = '<span style="color:#e74c3c;">💔 Craque sous pression</span>';
        
        html += `
            <tr>
                <td style="padding:0.6rem 0.5rem;font-weight:600;">${team.shortName}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;cursor:help;${lost > 0 ? 'font-weight:bold;color:#e74c3c;' : 'color:#95a5a6;'}" 
                    title="${lostTitle || 'Aucun'}">${lost}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;cursor:help;${drawAfterLead > 0 ? 'font-weight:bold;color:#e67e22;' : 'color:#95a5a6;'}" 
                    title="${drawLeadTitle || 'Aucun'}">${drawAfterLead}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;cursor:help;${remontada > 0 ? 'font-weight:bold;color:#27ae60;' : 'color:#95a5a6;'}" 
                    title="${remontadaTitle || 'Aucun'}">${remontada}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;cursor:help;${drawAfterTrail > 0 ? 'font-weight:bold;color:#3498db;' : 'color:#95a5a6;'}" 
                    title="${drawTrailTitle || 'Aucun'}">${drawAfterTrail}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;">${bilan}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    
    html += `
        <div style="margin-top:1rem;padding:1rem;background:#f8f9fa;border-radius:8px;font-size:0.85rem;color:#7f8c8d;">
            <strong>📖 Lecture :</strong> 
            <strong style="color:#e74c3c;">😱 Menait → Perdu</strong> = l'équipe a mené au score puis a perdu le match.
            <strong style="color:#27ae60;">🔥 Mené → Gagné</strong> = remontada, l'équipe était menée puis a retourné le match.
            <em>Survolez les chiffres pour voir les détails.</em>
        </div>
    `;
    
    container.innerHTML = html;
}


// ===============================
// 2. ÉQUIPES CLUTCH (10 dernières min)
// ===============================

function analyzeClutchTeams(windowStart = 80) {
    const teamStats = {};
    
    allTeams.forEach(team => {
        teamStats[team.id] = {
            teamId: team.id,
            name: team.name,
            shortName: team.shortName,
            goalsScored: 0,       // Buts marqués après windowStart'
            goalsConceded: 0,     // Buts encaissés après windowStart'
            totalGoalsScored: 0,  // Total buts marqués dans la saison
            totalGoalsConceded: 0,
            clutchDetails: [],    // Détails des buts clutch
            concededDetails: [],  // Détails des buts encaissés clutch
            pointsGained: 0,      // Points gagnés grâce aux buts clutch
            pointsLost: 0         // Points perdus à cause de buts encaissés clutch
        };
    });
    
    allMatches.forEach(match => {
        if (!match.goals || match.goals.length === 0) return;
        
        const homeId = match.homeTeamId;
        const awayId = match.awayTeamId;
        
        if (!teamStats[homeId] || !teamStats[awayId]) return;
        
        // Total des buts
        teamStats[homeId].totalGoalsScored += match.finalScore.home;
        teamStats[homeId].totalGoalsConceded += match.finalScore.away;
        teamStats[awayId].totalGoalsScored += match.finalScore.away;
        teamStats[awayId].totalGoalsConceded += match.finalScore.home;
        
        // Simuler le score à la minute windowStart
        let homeAtCutoff = 0, awayAtCutoff = 0;
        let homeGoalsAfter = 0, awayGoalsAfter = 0;
        
        match.goals.forEach(goal => {
            const minute = parseInt(goal.minute);
            if (minute < windowStart) {
                if (goal.teamId == homeId) homeAtCutoff++;
                else awayAtCutoff++;
            } else {
                if (goal.teamId == homeId) homeGoalsAfter++;
                else awayGoalsAfter++;
            }
        });
        
        const homeTeam = allTeams.find(t => t.id == homeId);
        const awayTeam = allTeams.find(t => t.id == awayId);
        
        // Buts clutch marqués/encaissés
        match.goals.forEach(goal => {
            const minute = parseInt(goal.minute);
            if (minute >= windowStart) {
                const extraTime = parseInt(goal.extraTime) || 0;
                const minuteStr = extraTime > 0 ? `${minute}+${extraTime}` : `${minute}`;
                
                if (goal.teamId == homeId) {
                    teamStats[homeId].goalsScored++;
                    teamStats[homeId].clutchDetails.push({
                        matchDay: match.matchDay,
                        opponent: awayTeam?.shortName || '?',
                        minute: minuteStr,
                        scorer: goal.scorer
                    });
                    teamStats[awayId].goalsConceded++;
                    teamStats[awayId].concededDetails.push({
                        matchDay: match.matchDay,
                        opponent: homeTeam?.shortName || '?',
                        minute: minuteStr,
                        scorer: goal.scorer
                    });
                } else {
                    teamStats[awayId].goalsScored++;
                    teamStats[awayId].clutchDetails.push({
                        matchDay: match.matchDay,
                        opponent: homeTeam?.shortName || '?',
                        minute: minuteStr,
                        scorer: goal.scorer
                    });
                    teamStats[homeId].goalsConceded++;
                    teamStats[homeId].concededDetails.push({
                        matchDay: match.matchDay,
                        opponent: awayTeam?.shortName || '?',
                        minute: minuteStr,
                        scorer: goal.scorer
                    });
                }
            }
        });
        
        // Calculer l'impact sur les points
        // Score à la minute windowStart vs score final
        const resultBefore = homeAtCutoff > awayAtCutoff ? 'H' : homeAtCutoff < awayAtCutoff ? 'A' : 'D';
        const resultAfter = match.finalScore.home > match.finalScore.away ? 'H' : match.finalScore.home < match.finalScore.away ? 'A' : 'D';
        
        if (resultBefore !== resultAfter) {
            // Les points ont changé grâce aux buts clutch
            const pointsBefore = { H: { home: 3, away: 0 }, A: { home: 0, away: 3 }, D: { home: 1, away: 1 } };
            const pointsAfter = { H: { home: 3, away: 0 }, A: { home: 0, away: 3 }, D: { home: 1, away: 1 } };
            
            const homeDiff = pointsAfter[resultAfter].home - pointsBefore[resultBefore].home;
            const awayDiff = pointsAfter[resultAfter].away - pointsBefore[resultBefore].away;
            
            if (homeDiff > 0) teamStats[homeId].pointsGained += homeDiff;
            if (homeDiff < 0) teamStats[homeId].pointsLost += Math.abs(homeDiff);
            if (awayDiff > 0) teamStats[awayId].pointsGained += awayDiff;
            if (awayDiff < 0) teamStats[awayId].pointsLost += Math.abs(awayDiff);
        }
    });
    
    return Object.values(teamStats);
}

function displayClutchTeams() {
    const container = document.getElementById('clutchContainer');
    if (!container) return;
    
    const windowStart = parseInt(document.getElementById('clutchWindow')?.value || 80);
    const results = analyzeClutchTeams(windowStart);
    
    // Trier par buts clutch marqués
    const sorted = results
        .filter(t => t.totalGoalsScored > 0)
        .sort((a, b) => b.goalsScored - a.goalsScored);
    
    if (sorted.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#95a5a6;">Pas assez de données</p>';
        return;
    }
    
    let html = `
        <table class="stats-table" style="width:100%; border-collapse:collapse;">
            <thead>
                <tr>
                    <th>Équipe</th>
                    <th title="Buts marqués après la ${windowStart}e minute">⚽ Buts marqués (${windowStart}'+)</th>
                    <th title="% des buts totaux marqués après ${windowStart}'">% du total</th>
                    <th title="Buts encaissés après la ${windowStart}e minute">🛡️ Buts encaissés (${windowStart}'+)</th>
                    <th title="Points gagnés grâce aux buts tardifs">📈 Pts gagnés</th>
                    <th title="Points perdus à cause de buts tardifs encaissés">📉 Pts perdus</th>
                    <th>Profil</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sorted.forEach(team => {
        const pctScored = team.totalGoalsScored > 0 
            ? Math.round((team.goalsScored / team.totalGoalsScored) * 100) 
            : 0;
        
        // Tooltip détails
        const scoredTitle = team.clutchDetails.map(d => 
            `J${d.matchDay} vs ${d.opponent}: ${d.scorer} (${d.minute}')`
        ).join('\n');
        
        const concededTitle = team.concededDetails.map(d => 
            `J${d.matchDay} vs ${d.opponent}: ${d.scorer} (${d.minute}')`
        ).join('\n');
        
        // Profil
        let profil;
        if (team.goalsScored >= 5 && team.pointsGained >= 3) {
            profil = '<span style="color:#27ae60;">⏰ Clutch player</span>';
        } else if (team.goalsConceded >= 5 && team.pointsLost >= 3) {
            profil = '<span style="color:#e74c3c;">😴 S\'endort en fin de match</span>';
        } else if (team.goalsScored > team.goalsConceded) {
            profil = '<span style="color:#3498db;">💪 Finisseur</span>';
        } else if (team.goalsConceded > team.goalsScored) {
            profil = '<span style="color:#e67e22;">⚠️ Vulnérable</span>';
        } else {
            profil = '<span style="color:#95a5a6;">😐 Neutre</span>';
        }
        
        // Barre visuelle
        const barWidth = Math.min(pctScored * 2.5, 100);
        const barColor = pctScored >= 20 ? '#27ae60' : pctScored >= 12 ? '#f39c12' : '#e74c3c';
        
        html += `
            <tr>
                <td style="padding:0.6rem 0.5rem;font-weight:600;">${team.shortName}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;font-weight:bold;color:#27ae60;cursor:help;" 
                    title="${scoredTitle || 'Aucun'}">${team.goalsScored}</td>
                <td style="padding:0.6rem 0.5rem;">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <div style="flex:1;height:8px;background:#ecf0f1;border-radius:4px;overflow:hidden;">
                            <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:4px;"></div>
                        </div>
                        <span style="font-weight:bold;font-size:0.85rem;">${pctScored}%</span>
                    </div>
                </td>
                <td style="padding:0.6rem 0.5rem;text-align:center;font-weight:bold;color:#e74c3c;cursor:help;" 
                    title="${concededTitle || 'Aucun'}">${team.goalsConceded}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;font-weight:bold;color:#27ae60;">${team.pointsGained > 0 ? '+' + team.pointsGained : '0'}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;font-weight:bold;color:#e74c3c;">${team.pointsLost > 0 ? '-' + team.pointsLost : '0'}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;">${profil}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    
    html += `
        <div style="margin-top:1rem;padding:1rem;background:#f8f9fa;border-radius:8px;font-size:0.85rem;color:#7f8c8d;">
            <strong>📖 Lecture :</strong> 
            <strong style="color:#27ae60;">📈 Pts gagnés</strong> = points obtenus grâce aux buts après la ${windowStart}'.
            <strong style="color:#e74c3c;">📉 Pts perdus</strong> = points perdus à cause de buts encaissés après la ${windowStart}'.
            <em>Survolez les chiffres pour voir le détail des buts.</em>
        </div>
    `;
    
    container.innerHTML = html;
}


// ===============================
// 3. ÉCART ELO vs POINTS
// ===============================

function analyzeEloVsPoints() {
    const season = currentSeason || (typeof getCurrentSeason === 'function' ? getCurrentSeason() : '');
    
    // Calculer le classement traditionnel directement
    const teams = typeof getTeamsBySeason === 'function' ? getTeamsBySeason(season) : allTeams;
    
    const ranking = teams.map(team => {
        let played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0;
        
        allMatches.forEach(match => {
            const isHome = match.homeTeamId == team.id;
            const isAway = match.awayTeamId == team.id;
            if (!isHome && !isAway) return;
            
            played++;
            const gf = isHome ? match.finalScore.home : match.finalScore.away;
            const ga = isHome ? match.finalScore.away : match.finalScore.home;
            goalsFor += gf;
            goalsAgainst += ga;
            
            if (gf > ga) won++;
            else if (gf === ga) drawn++;
            else lost++;
        });
        
        return {
            id: team.id, name: team.name, shortName: team.shortName,
            played, won, drawn, lost, goalsFor, goalsAgainst,
            goalDifference: goalsFor - goalsAgainst,
            points: won * 3 + drawn
        };
    }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
    
    if (ranking.length === 0) return [];
    
    // Calculer l'Elo directement ici (pas dépendre de rankings.js)
    if (typeof EloSystem === 'undefined') return [];
    
    const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
    
    const localTeamsWithElo = EloSystem.initializeTeamsElo(teams);
    sortedMatches.forEach(match => {
        EloSystem.processMatch(match, localTeamsWithElo);
    });
    
    const eloRanking = EloSystem.generateEloRanking(localTeamsWithElo);
    
    if (eloRanking.length === 0) return [];
    
    // Construire la comparaison
    const results = ranking.map((team, index) => {
        const traditionalRank = index + 1;
        
        // Trouver le rang Elo
        const eloTeam = eloRanking.find(e => e.id === team.id);
        const eloIndex = eloRanking.findIndex(e => e.id === team.id);
        const eloRank = eloIndex >= 0 ? eloIndex + 1 : null;
        const eloRating = eloTeam ? (eloTeam.eloRating || 1500) : 1500;
        
        const rankDiff = eloRank !== null ? traditionalRank - eloRank : 0;
        
        return {
            teamId: team.id,
            name: team.name,
            shortName: team.shortName || team.name,
            points: team.points,
            traditionalRank,
            eloRank,
            eloRating,
            rankDiff
        };
    });
    
    return results;
}

function displayEloVsPoints() {
    const container = document.getElementById('eloVsPointsContainer');
    if (!container) return;
    
    const results = analyzeEloVsPoints();
    
    if (results.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#95a5a6;">Données Elo non disponibles. Vérifiez que le système Elo est activé.</p>';
        return;
    }
    
    // Trier par écart absolu décroissant
    const sorted = [...results].sort((a, b) => Math.abs(b.rankDiff) - Math.abs(a.rankDiff));
    
    let html = `
        <table class="stats-table" style="width:100%; border-collapse:collapse;">
            <thead>
                <tr>
                    <th>Équipe</th>
                    <th title="Position au classement traditionnel (points)">📊 Rang Points</th>
                    <th>Points</th>
                    <th title="Position au classement Elo">⚡ Rang Elo</th>
                    <th>Rating Elo</th>
                    <th title="Différence entre rang Points et rang Elo">Écart</th>
                    <th>Verdict</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sorted.forEach(team => {
        let ecartHtml, verdict;
        
        if (team.rankDiff > 2) {
            // Bien mieux en Elo qu'en points → sous-coté / malchanceux
            ecartHtml = `<span style="font-weight:bold;color:#e74c3c;">↓ ${team.rankDiff} places</span>`;
            verdict = '<span style="color:#e74c3c;">🍀 Malchanceux</span>';
        } else if (team.rankDiff > 0) {
            ecartHtml = `<span style="font-weight:bold;color:#e67e22;">↓ ${team.rankDiff}</span>`;
            verdict = '<span style="color:#e67e22;">😕 Sous-coté</span>';
        } else if (team.rankDiff < -2) {
            // Bien mieux en points qu'en Elo → surcoté / chanceux
            ecartHtml = `<span style="font-weight:bold;color:#27ae60;">↑ ${Math.abs(team.rankDiff)} places</span>`;
            verdict = '<span style="color:#27ae60;">🎰 Chanceux</span>';
        } else if (team.rankDiff < 0) {
            ecartHtml = `<span style="font-weight:bold;color:#3498db;">↑ ${Math.abs(team.rankDiff)}</span>`;
            verdict = '<span style="color:#3498db;">😎 Surcoté</span>';
        } else {
            ecartHtml = '<span style="color:#95a5a6;">= 0</span>';
            verdict = '<span style="color:#95a5a6;">✅ Juste valeur</span>';
        }
        
        html += `
            <tr>
                <td style="padding:0.6rem 0.5rem;font-weight:600;">${team.shortName}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;font-weight:bold;">${team.traditionalRank}${team.traditionalRank === 1 ? 'er' : 'e'}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;">${team.points} pts</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;font-weight:bold;">${team.eloRank !== null ? team.eloRank + (team.eloRank === 1 ? 'er' : 'e') : '-'}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;">${team.eloRating}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;">${ecartHtml}</td>
                <td style="padding:0.6rem 0.5rem;text-align:center;">${verdict}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    
    html += `
        <div style="margin-top:1rem;padding:1rem;background:#f8f9fa;border-radius:8px;font-size:0.85rem;color:#7f8c8d;">
            <strong>📖 Lecture :</strong> 
            <strong style="color:#27ae60;">🎰 Chanceux</strong> = mieux classé en points qu'en Elo (résultats supérieurs au niveau de jeu).
            <strong style="color:#e74c3c;">🍀 Malchanceux</strong> = mieux classé en Elo qu'en points (niveau de jeu supérieur aux résultats).
            <strong style="color:#95a5a6;">✅ Juste valeur</strong> = classement cohérent entre points et Elo.
        </div>
    `;
    
    container.innerHTML = html;
}

// ===============================
// INITIALISATION DES 3 STATS
// ===============================

function initNewStats() {
    // Retournements
    displayRetournements();
    
    // Clutch
    const clutchSelect = document.getElementById('clutchWindow');
    if (clutchSelect) {
        clutchSelect.addEventListener('change', displayClutchTeams);
    }
    displayClutchTeams();
    
    // Elo vs Points
    displayEloVsPoints();
}

// =====================================================
// RADAR PAR ÉQUIPE (Spider Chart)
// Ajouter ce code à la fin de statistics.js
// =====================================================

let radarChart = null;

function calculateTeamRadarData(teamId) {
    const teamMatches = allMatches.filter(m => 
        m.homeTeamId == teamId || m.awayTeamId == teamId
    ).sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
    
    if (teamMatches.length === 0) return null;
    
    const team = allTeams.find(t => t.id == teamId);
    
    // --- Calculer les stats brutes de TOUTES les équipes pour normaliser ---
    const allTeamStats = allTeams.map(t => {
        const matches = allMatches.filter(m => m.homeTeamId == t.id || m.awayTeamId == t.id);
        if (matches.length === 0) return null;
        
        let goalsFor = 0, goalsAgainst = 0, points = 0, results = [];
        let clutchGoals = 0, totalGoals = 0;
        
        matches.forEach(match => {
            const isHome = match.homeTeamId == t.id;
            const gf = isHome ? match.finalScore.home : match.finalScore.away;
            const ga = isHome ? match.finalScore.away : match.finalScore.home;
            goalsFor += gf;
            goalsAgainst += ga;
            
            const pts = gf > ga ? 3 : gf === ga ? 1 : 0;
            points += pts;
            results.push(pts);
            
            // Clutch : buts après 80'
            if (match.goals) {
                match.goals.forEach(goal => {
                    if (goal.teamId == t.id) {
                        totalGoals++;
                        if (parseInt(goal.minute) >= 80) clutchGoals++;
                    }
                });
            }
        });
        
        // Forme : moyenne pondérée des 5 derniers matchs
        const last5 = results.slice(-5);
        const formScore = last5.reduce((sum, pts, i) => sum + pts * (i + 1), 0) / 
                         (last5.length > 0 ? last5.reduce((sum, _, i) => sum + (i + 1), 0) : 1);
        
        // Régularité : inverse de l'écart-type des résultats
        const mean = results.reduce((a, b) => a + b, 0) / results.length;
        const variance = results.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / results.length;
        const stdDev = Math.sqrt(variance);
        
        return {
            id: t.id,
            attack: goalsFor / matches.length,           // Buts marqués/match
            defense: goalsAgainst / matches.length,       // Buts encaissés/match (inverse pour le radar)
            form: formScore,                              // 0 à 3
            consistency: 3 - stdDev,                      // Plus c'est haut, plus c'est régulier
            clutch: totalGoals > 0 ? (clutchGoals / totalGoals) * 100 : 0, // % buts après 80'
            points: points
        };
    }).filter(s => s !== null);
    
    if (allTeamStats.length === 0) return null;
    
    // --- Calculer Elo ---
    let eloRating = 1500;
    if (typeof EloSystem !== 'undefined') {
        const teamsElo = EloSystem.initializeTeamsElo(allTeams);
        const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
        sortedMatches.forEach(m => EloSystem.processMatch(m, teamsElo));
        const eloTeam = teamsElo.find(t => t.id == teamId);
        if (eloTeam) eloRating = eloTeam.eloRating;
    }
    
    // --- Normaliser sur 0-100 par rapport à toutes les équipes ---
    const normalize = (value, allValues, inverse = false) => {
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        if (max === min) return 50;
        const norm = ((value - min) / (max - min)) * 100;
        return inverse ? 100 - norm : norm;
    };
    
    const currentTeam = allTeamStats.find(s => s.id == teamId);
    if (!currentTeam) return null;
    
    // Elo : normaliser entre min et max Elo de la saison
    let allEloRatings = [1500];
    if (typeof EloSystem !== 'undefined') {
        const teamsElo = EloSystem.initializeTeamsElo(allTeams);
        const sortedMatches = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
        sortedMatches.forEach(m => EloSystem.processMatch(m, teamsElo));
        allEloRatings = teamsElo.map(t => t.eloRating || 1500);
    }
    
    return {
        teamName: team?.shortName || '?',
        labels: ['⚔️ Attaque', '🛡️ Défense', '⚡ Elo', '📈 Forme', '🎯 Régularité', '⏰ Clutch'],
        values: [
            Math.round(normalize(currentTeam.attack, allTeamStats.map(s => s.attack))),
            Math.round(normalize(currentTeam.defense, allTeamStats.map(s => s.defense), true)), // inverse : moins = mieux
            Math.round(normalize(eloRating, allEloRatings)),
            Math.round(normalize(currentTeam.form, allTeamStats.map(s => s.form))),
            Math.round(normalize(currentTeam.consistency, allTeamStats.map(s => s.consistency))),
            Math.round(normalize(currentTeam.clutch, allTeamStats.map(s => s.clutch)))
        ],
        raw: {
            attack: currentTeam.attack.toFixed(2) + ' buts/match',
            defense: currentTeam.defense.toFixed(2) + ' enc./match',
            elo: eloRating,
            form: currentTeam.form.toFixed(2) + '/3',
            consistency: currentTeam.consistency.toFixed(2) + '/3',
            clutch: currentTeam.clutch.toFixed(1) + '% buts après 80\''
        }
    };
}

function displayTeamRadar(teamId) {
    const container = document.getElementById('radarContainer');
    if (!container) return;
    
    const data = calculateTeamRadarData(teamId);
    
    if (!data) {
        container.innerHTML = '<p style="text-align:center;color:#95a5a6;">Pas assez de données</p>';
        return;
    }
    
    // Mettre à jour le titre
    document.querySelectorAll('.selected-team-name-radar').forEach(el => {
        el.textContent = data.teamName;
    });
    
    // Créer/mettre à jour le canvas
    container.innerHTML = `
        <div style="display:flex;gap:2rem;align-items:center;flex-wrap:wrap;justify-content:center;">
            <div style="width:400px;max-width:100%;height:350px;">
                <canvas id="teamRadarChart"></canvas>
            </div>
            <div id="radarDetails" style="flex:1;min-width:200px;"></div>
        </div>
    `;
    
    // Détruire l'ancien graphique
    if (radarChart) {
        radarChart.destroy();
        radarChart = null;
    }
    
    const ctx = document.getElementById('teamRadarChart').getContext('2d');
    
    // Couleur de l'équipe
    const color = getTeamColor(teamId);
    const colorRgb = hexToRgb(color);
    
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: data.labels,
            datasets: [{
                label: data.teamName,
                data: data.values,
                backgroundColor: `rgba(${colorRgb.r}, ${colorRgb.g}, ${colorRgb.b}, 0.2)`,
                borderColor: color,
                borderWidth: 3,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const rawKeys = ['attack', 'defense', 'elo', 'form', 'consistency', 'clutch'];
                            const rawVal = data.raw[rawKeys[context.dataIndex]];
                            return `${context.label}: ${context.raw}/100 (${rawVal})`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    min: 0,
                    ticks: {
                        stepSize: 20,
                        font: { size: 10 },
                        backdropColor: 'transparent',
                        color: '#95a5a6'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.08)'
                    },
                    pointLabels: {
                        font: { size: 13, weight: 'bold' },
                        color: '#2c3e50'
                    },
                    angleLines: {
                        color: 'rgba(0,0,0,0.08)'
                    }
                }
            }
        }
    });
    
    // Détails à droite
    const rawKeys = ['attack', 'defense', 'elo', 'form', 'consistency', 'clutch'];
    const emojis = ['⚔️', '🛡️', '⚡', '📈', '🎯', '⏰'];
    const descriptions = [
        'Buts marqués par match',
        'Buts encaissés par match',
        'Rating Elo actuel',
        'Forme récente (5 derniers matchs)',
        'Régularité des résultats',
        'Buts en fin de match (80\'+)'
    ];
    
    let detailsHtml = '';
    data.labels.forEach((label, i) => {
        const val = data.values[i];
        const barColor = val >= 70 ? '#27ae60' : val >= 40 ? '#f39c12' : '#e74c3c';
        
        detailsHtml += `
            <div style="margin-bottom:0.75rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem;">
                    <span style="font-weight:600;font-size:0.9rem;">${emojis[i]} ${descriptions[i]}</span>
                    <span style="font-weight:bold;color:${barColor};">${val}/100</span>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <div style="flex:1;height:6px;background:#ecf0f1;border-radius:3px;overflow:hidden;">
                        <div style="width:${val}%;height:100%;background:${barColor};border-radius:3px;transition:width 0.5s;"></div>
                    </div>
                    <span style="font-size:0.8rem;color:#7f8c8d;min-width:90px;">${data.raw[rawKeys[i]]}</span>
                </div>
            </div>
        `;
    });
    
    // Score global
    const avgScore = Math.round(data.values.reduce((a, b) => a + b, 0) / data.values.length);
    const globalColor = avgScore >= 65 ? '#27ae60' : avgScore >= 45 ? '#f39c12' : '#e74c3c';
    const globalLabel = avgScore >= 75 ? '🏆 Élite' : avgScore >= 60 ? '⭐ Solide' : avgScore >= 45 ? '😐 Moyen' : avgScore >= 30 ? '⚠️ En difficulté' : '💀 Critique';
    
    detailsHtml += `
        <div style="margin-top:1rem;padding:0.75rem;background:linear-gradient(135deg,${globalColor}15,${globalColor}08);border-left:4px solid ${globalColor};border-radius:5px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:bold;font-size:1rem;">Score global</span>
                <span style="font-weight:bold;font-size:1.3rem;color:${globalColor};">${avgScore}/100 ${globalLabel}</span>
            </div>
        </div>
    `;
    
    document.getElementById('radarDetails').innerHTML = detailsHtml;
}

// Helper : convertir hex en rgb
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 52, g: 152, b: 219 }; // fallback bleu
}

// =====================================================
// RÉSUMÉ DE JOURNÉE - Auto-généré
// Ajouter ce code à la fin de statistics.js
// =====================================================

function generateMatchdaySummary(matchDay) {
    const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay);
    
    if (matchesThisDay.length === 0) return null;
    
    const season = currentSeason;
    const teams = typeof getTeamsBySeason === 'function' ? getTeamsBySeason(season) : allTeams;
    
    // --- 1. Résultats ---
    const results = matchesThisDay.map(match => {
        const home = allTeams.find(t => t.id == match.homeTeamId);
        const away = allTeams.find(t => t.id == match.awayTeamId);
        const hs = match.finalScore.home;
        const as_ = match.finalScore.away;
        const result = hs > as_ ? 'home' : hs < as_ ? 'away' : 'draw';
        
        return {
            homeTeam: home?.shortName || '?',
            awayTeam: away?.shortName || '?',
            homeScore: hs,
            awayScore: as_,
            result,
            totalGoals: hs + as_,
            homeId: match.homeTeamId,
            awayId: match.awayTeamId,
            goals: match.goals || []
        };
    });
    
    // --- 2. Stats de la journée ---
    const totalGoals = results.reduce((s, r) => s + r.totalGoals, 0);
    const avgGoals = (totalGoals / results.length).toFixed(1);
    const homeWins = results.filter(r => r.result === 'home').length;
    const awayWins = results.filter(r => r.result === 'away').length;
    const draws = results.filter(r => r.result === 'draw').length;
    const biggestWin = results.reduce((best, r) => {
        const diff = Math.abs(r.homeScore - r.awayScore);
        return diff > best.diff ? { ...r, diff } : best;
    }, { diff: 0 });
    const highestScoring = results.reduce((best, r) => r.totalGoals > best.totalGoals ? r : best, results[0]);
    
    // --- 3. Surprises (basées sur l'Elo) ---
    let surprises = [];
    if (typeof EloSystem !== 'undefined') {
        // Calculer l'Elo AVANT cette journée
        const matchesBefore = allMatches
            .filter(m => m.matchDay < matchDay)
            .sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
        
        const teamsElo = EloSystem.initializeTeamsElo(teams);
        matchesBefore.forEach(m => EloSystem.processMatch(m, teamsElo));
        
        matchesThisDay.forEach(match => {
            const homeElo = teamsElo.find(t => t.id == match.homeTeamId);
            const awayElo = teamsElo.find(t => t.id == match.awayTeamId);
            if (!homeElo || !awayElo) return;
            
            const homeRating = homeElo.eloRating || 1500;
            const awayRating = awayElo.eloRating || 1500;
            
            // Probabilité victoire domicile (avec avantage terrain)
            const expected = EloSystem.calculateExpectedScore(homeRating + (EloSystem.ELO_CONFIG?.HOME_ADVANTAGE || 50), awayRating);
            
            const hs = match.finalScore.home;
            const as_ = match.finalScore.away;
            const home = allTeams.find(t => t.id == match.homeTeamId);
            const away = allTeams.find(t => t.id == match.awayTeamId);
            
            // Surprise si le perdant avait > 55% de chances de gagner
            if (hs < as_ && expected > 0.55) {
                surprises.push({
                    type: 'upset',
                    text: `${away?.shortName} s'impose chez ${home?.shortName} (${as_}-${hs})`,
                    detail: `${home?.shortName} avait ${Math.round(expected * 100)}% de chances de gagner`,
                    surpriseLevel: expected
                });
            } else if (hs > as_ && (1 - expected) > 0.55) {
                surprises.push({
                    type: 'upset',
                    text: `${home?.shortName} bat ${away?.shortName} à domicile (${hs}-${as_})`,
                    detail: `${away?.shortName} avait ${Math.round((1 - expected) * 100)}% de chances de gagner`,
                    surpriseLevel: 1 - expected
                });
            }
            
            // Gros score inattendu
            if (Math.abs(hs - as_) >= 3) {
                const winner = hs > as_ ? home?.shortName : away?.shortName;
                const loser = hs > as_ ? away?.shortName : home?.shortName;
                surprises.push({
                    type: 'thrashing',
                    text: `${winner} écrase ${loser} (${hs}-${as_})`,
                    detail: `Écart de ${Math.abs(hs - as_)} buts`,
                    surpriseLevel: 0.5
                });
            }
        });
        
        // Trier par niveau de surprise
        surprises.sort((a, b) => b.surpriseLevel - a.surpriseLevel);
    }
    
    // --- 4. Mouvements au classement ---
    const rankingBefore = calculateRankingAtMatchday(matchDay - 1);
    const rankingAfter = calculateRankingAtMatchday(matchDay);
    
    const movements = rankingAfter.map((team, newIndex) => {
        const oldIndex = rankingBefore.findIndex(t => t.id === team.id);
        const movement = oldIndex >= 0 ? oldIndex - newIndex : 0; // positif = montée
        return {
            id: team.id,
            name: team.shortName || team.name,
            newRank: newIndex + 1,
            oldRank: oldIndex >= 0 ? oldIndex + 1 : '?',
            movement,
            points: team.points
        };
    });
    
    const biggestRisers = movements.filter(m => m.movement > 0).sort((a, b) => b.movement - a.movement);
    const biggestFallers = movements.filter(m => m.movement < 0).sort((a, b) => a.movement - b.movement);
    
    // --- 5. Buteurs de la journée ---
    const scorers = [];
    matchesThisDay.forEach(match => {
        if (match.goals) {
            match.goals.forEach(goal => {
                const team = allTeams.find(t => t.id == goal.teamId);
                scorers.push({
                    name: goal.scorer,
                    team: team?.shortName || '?',
                    minute: goal.minute,
                    extraTime: goal.extraTime
                });
            });
        }
    });
    
    // Doublés/triplés
    const scorerCounts = {};
    scorers.forEach(s => {
        const key = `${s.name}_${s.team}`;
        scorerCounts[key] = (scorerCounts[key] || 0) + 1;
    });
    const multiScorers = Object.entries(scorerCounts)
        .filter(([_, count]) => count >= 2)
        .map(([key, count]) => {
            const [name, team] = key.split('_');
            return { name, team, goals: count, label: count >= 3 ? 'triplé' : 'doublé' };
        });
    
    return {
        matchDay,
        results,
        stats: { totalGoals, avgGoals, homeWins, awayWins, draws, biggestWin, highestScoring },
        surprises,
        movements,
        biggestRisers,
        biggestFallers,
        scorers,
        multiScorers,
        matchCount: results.length
    };
}

function calculateRankingAtMatchday(upToMatchDay) {
    const teams = typeof getTeamsBySeason === 'function' ? getTeamsBySeason(currentSeason) : allTeams;
    const matchesUpTo = allMatches.filter(m => m.matchDay <= upToMatchDay);
    
    return teams.map(team => {
        let points = 0, goalsFor = 0, goalsAgainst = 0;
        matchesUpTo.forEach(match => {
            const isHome = match.homeTeamId == team.id;
            const isAway = match.awayTeamId == team.id;
            if (!isHome && !isAway) return;
            const gf = isHome ? match.finalScore.home : match.finalScore.away;
            const ga = isHome ? match.finalScore.away : match.finalScore.home;
            goalsFor += gf;
            goalsAgainst += ga;
            if (gf > ga) points += 3;
            else if (gf === ga) points += 1;
        });
        return {
            id: team.id,
            name: team.name,
            shortName: team.shortName,
            points,
            goalDifference: goalsFor - goalsAgainst,
            goalsFor
        };
    }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
}

function displayMatchdaySummary() {
    const container = document.getElementById('summaryContainer');
    if (!container) return;
    
    const matchDay = parseInt(document.getElementById('summaryMatchday')?.value);
    if (!matchDay) {
        container.innerHTML = '<p style="text-align:center;color:#95a5a6;">Sélectionnez une journée</p>';
        return;
    }
    
    const summary = generateMatchdaySummary(matchDay);
    
    if (!summary) {
        container.innerHTML = '<p style="text-align:center;color:#95a5a6;">Aucun match joué cette journée</p>';
        return;
    }
    
    let html = '';
    
    // === TITRE ===
    html += `
        <div style="text-align:center;margin-bottom:1.5rem;">
            <div style="font-size:1.3rem;font-weight:bold;color:#2c3e50;">
                📰 Journée ${summary.matchDay}
            </div>
            <div style="color:#7f8c8d;font-size:0.9rem;">
                ${summary.matchCount} matchs · ${summary.stats.totalGoals} buts · ${summary.stats.avgGoals} buts/match
            </div>
        </div>
    `;
    
    // === RÉSULTATS ===
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0.75rem;margin-bottom:1.5rem;">`;
    
    summary.results.forEach(r => {
        const homeBold = r.result === 'home' ? 'font-weight:bold;' : '';
        const awayBold = r.result === 'away' ? 'font-weight:bold;' : '';
        const borderColor = r.result === 'home' ? '#3498db' : r.result === 'away' ? '#e74c3c' : '#f39c12';
        
        // Buteurs de ce match
        const matchGoals = r.goals;
        const homeGoals = matchGoals.filter(g => g.teamId == r.homeId);
        const awayGoals = matchGoals.filter(g => g.teamId == r.awayId);
        
        const formatGoals = (goals) => goals.map(g => {
            const extra = parseInt(g.extraTime) || 0;
            const min = extra > 0 ? `${g.minute}+${extra}'` : `${g.minute}'`;
            return `${g.scorer} ${min}`;
        }).join(', ');
        
        html += `
            <div style="background:white;border-radius:10px;padding:0.75rem 1rem;border-left:4px solid ${borderColor};box-shadow:0 2px 6px rgba(0,0,0,0.08);">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="${homeBold}color:#2c3e50;flex:1;">${r.homeTeam}</span>
                    <span style="font-size:1.3rem;font-weight:bold;color:#2c3e50;margin:0 0.75rem;min-width:50px;text-align:center;">
                        ${r.homeScore} - ${r.awayScore}
                    </span>
                    <span style="${awayBold}color:#2c3e50;flex:1;text-align:right;">${r.awayTeam}</span>
                </div>
                ${matchGoals.length > 0 ? `
                    <div style="font-size:0.75rem;color:#95a5a6;margin-top:0.4rem;line-height:1.4;">
                        ${homeGoals.length > 0 ? `<div>⚽ ${formatGoals(homeGoals)}</div>` : ''}
                        ${awayGoals.length > 0 ? `<div style="text-align:right;">⚽ ${formatGoals(awayGoals)}</div>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    });
    html += '</div>';
    
    // === STATS FLASH ===
    html += `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.75rem;margin-bottom:1.5rem;">
            <div style="background:#27ae6015;border-radius:10px;padding:0.75rem;text-align:center;">
                <div style="font-size:1.5rem;font-weight:bold;color:#27ae60;">${summary.stats.homeWins}</div>
                <div style="font-size:0.8rem;color:#7f8c8d;">Victoires dom.</div>
            </div>
            <div style="background:#f39c1215;border-radius:10px;padding:0.75rem;text-align:center;">
                <div style="font-size:1.5rem;font-weight:bold;color:#f39c12;">${summary.stats.draws}</div>
                <div style="font-size:0.8rem;color:#7f8c8d;">Nuls</div>
            </div>
            <div style="background:#e74c3c15;border-radius:10px;padding:0.75rem;text-align:center;">
                <div style="font-size:1.5rem;font-weight:bold;color:#e74c3c;">${summary.stats.awayWins}</div>
                <div style="font-size:0.8rem;color:#7f8c8d;">Victoires ext.</div>
            </div>
            <div style="background:#3498db15;border-radius:10px;padding:0.75rem;text-align:center;">
                <div style="font-size:1.5rem;font-weight:bold;color:#3498db;">${summary.stats.totalGoals}</div>
                <div style="font-size:0.8rem;color:#7f8c8d;">Buts</div>
            </div>
        </div>
    `;
    
    // === DOUBLÉS / TRIPLÉS ===
    if (summary.multiScorers.length > 0) {
        html += `<div style="margin-bottom:1.5rem;padding:1rem;background:linear-gradient(135deg,#f1c40f15,#f39c1210);border-radius:10px;border-left:4px solid #f1c40f;">`;
        html += `<div style="font-weight:bold;margin-bottom:0.5rem;color:#2c3e50;">⭐ Performances individuelles</div>`;
        summary.multiScorers.forEach(s => {
            html += `<div style="font-size:0.95rem;color:#2c3e50;">
                <strong>${s.name}</strong> (${s.team}) — ${s.label} (${s.goals} buts)
            </div>`;
        });
        html += '</div>';
    }
    
    // === SURPRISES ===
    if (summary.surprises.length > 0) {
        html += `<div style="margin-bottom:1.5rem;">`;
        html += `<div style="font-weight:bold;margin-bottom:0.75rem;font-size:1.05rem;color:#2c3e50;">😲 Faits marquants</div>`;
        
        summary.surprises.slice(0, 3).forEach(s => {
            const icon = s.type === 'upset' ? '🔄' : '💥';
            const bgColor = s.type === 'upset' ? '#e74c3c10' : '#9b59b610';
            const borderColor = s.type === 'upset' ? '#e74c3c' : '#9b59b6';
            
            html += `
                <div style="padding:0.75rem 1rem;background:${bgColor};border-left:4px solid ${borderColor};border-radius:8px;margin-bottom:0.5rem;">
                    <div style="font-weight:600;color:#2c3e50;">${icon} ${s.text}</div>
                    <div style="font-size:0.85rem;color:#7f8c8d;">${s.detail}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // === MOUVEMENTS AU CLASSEMENT ===
    html += `<div style="margin-bottom:1.5rem;">`;
    html += `<div style="font-weight:bold;margin-bottom:0.75rem;font-size:1.05rem;color:#2c3e50;">📊 Mouvements au classement</div>`;
    
    // Top 5 du classement après cette journée
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:0.5rem;">`;
    
    summary.movements.slice(0, 5).forEach(m => {
        let moveHtml;
        if (m.movement > 0) {
            moveHtml = `<span style="color:#27ae60;font-weight:bold;">▲ +${m.movement}</span>`;
        } else if (m.movement < 0) {
            moveHtml = `<span style="color:#e74c3c;font-weight:bold;">▼ ${m.movement}</span>`;
        } else {
            moveHtml = `<span style="color:#95a5a6;">=</span>`;
        }
        
        const medal = m.newRank === 1 ? '🥇' : m.newRank === 2 ? '🥈' : m.newRank === 3 ? '🥉' : `${m.newRank}.`;
        
        html += `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:#f8f9fa;border-radius:8px;">
                <span style="font-weight:bold;min-width:30px;">${medal}</span>
                <span style="flex:1;font-weight:600;">${m.name}</span>
                <span style="color:#7f8c8d;font-size:0.9rem;">${m.points} pts</span>
                ${moveHtml}
            </div>
        `;
    });
    html += '</div>';
    
    // Montées / descentes notables
    if (summary.biggestRisers.length > 0 || summary.biggestFallers.length > 0) {
        html += `<div style="display:flex;gap:1rem;margin-top:0.75rem;flex-wrap:wrap;">`;
        
        if (summary.biggestRisers.length > 0) {
            const riser = summary.biggestRisers[0];
            html += `
                <div style="flex:1;min-width:200px;padding:0.75rem;background:#27ae6010;border-radius:8px;border-left:4px solid #27ae60;">
                    <div style="font-size:0.85rem;color:#27ae60;font-weight:bold;">🚀 Plus grosse montée</div>
                    <div style="font-weight:bold;">${riser.name} : ${riser.oldRank}e → ${riser.newRank}e (+${riser.movement})</div>
                </div>
            `;
        }
        
        if (summary.biggestFallers.length > 0) {
            const faller = summary.biggestFallers[0];
            html += `
                <div style="flex:1;min-width:200px;padding:0.75rem;background:#e74c3c10;border-radius:8px;border-left:4px solid #e74c3c;">
                    <div style="font-size:0.85rem;color:#e74c3c;font-weight:bold;">📉 Plus grosse chute</div>
                    <div style="font-weight:bold;">${faller.name} : ${faller.oldRank}e → ${faller.newRank}e (${faller.movement})</div>
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    
    container.innerHTML = html;
}

function initMatchdaySummary() {
    const select = document.getElementById('summaryMatchday');
    if (!select) return;
    
    // Remplir le sélecteur avec les journées jouées
    const playedMatchDays = [...new Set(allMatches.map(m => m.matchDay))].sort((a, b) => b - a);
    
    if (playedMatchDays.length === 0) {
        select.innerHTML = '<option value="">Aucune journée jouée</option>';
        return;
    }
    
    select.innerHTML = playedMatchDays.map(day => 
        `<option value="${day}">Journée ${day}</option>`
    ).join('');
    
    // Sélectionner la dernière journée par défaut
    select.value = playedMatchDays[0];
    
    // Événement
    select.addEventListener('change', displayMatchdaySummary);
    
    // Afficher directement
    displayMatchdaySummary();
}

// =====================================================
// CARTE DE FRANCE - Positionnement géographique des équipes
// Ajouter ce code à la fin de statistics.js
// =====================================================

// Coordonnées GPS des villes françaises (et Monaco)
const CITY_COORDINATES = {
    'paris': { lat: 48.8566, lng: 2.3522 },
    'marseille': { lat: 43.2965, lng: 5.3698 },
    'lyon': { lat: 45.7640, lng: 4.8357 },
    'monaco': { lat: 43.7384, lng: 7.4246 },
    'lille': { lat: 50.6292, lng: 3.0573 },
    'rennes': { lat: 48.1173, lng: -1.6778 },
    'nice': { lat: 43.7102, lng: 7.2620 },
    'strasbourg': { lat: 48.5734, lng: 7.7521 },
    'nantes': { lat: 47.2184, lng: -1.5536 },
    'bordeaux': { lat: 44.8378, lng: -0.5792 },
    'montpellier': { lat: 43.6108, lng: 3.8767 },
    'toulouse': { lat: 43.6047, lng: 1.4442 },
    'lens': { lat: 50.4289, lng: 2.8319 },
    'brest': { lat: 48.3904, lng: -4.4861 },
    'reims': { lat: 49.2583, lng: 3.5714 },
    'le havre': { lat: 49.4944, lng: 0.1079 },
    'clermont-ferrand': { lat: 45.7772, lng: 3.0870 },
    'clermont': { lat: 45.7772, lng: 3.0870 },
    'metz': { lat: 49.1193, lng: 6.1757 },
    'angers': { lat: 47.4784, lng: -0.5632 },
    'saint-étienne': { lat: 45.4397, lng: 4.3872 },
    'saint-etienne': { lat: 45.4397, lng: 4.3872 },
    'dijon': { lat: 47.3220, lng: 5.0415 },
    'lorient': { lat: 47.7483, lng: -3.3660 },
    'auxerre': { lat: 47.7979, lng: 3.5714 },
    'troyes': { lat: 48.2973, lng: 4.0744 },
    'ajaccio': { lat: 41.9192, lng: 8.7386 },
    'bastia': { lat: 42.6970, lng: 9.4503 },
    'caen': { lat: 49.1829, lng: -0.3707 },
    'guingamp': { lat: 48.5608, lng: -3.1509 },
    'nancy': { lat: 48.6921, lng: 6.1844 },
    'amiens': { lat: 49.8941, lng: 2.2958 },
    'nîmes': { lat: 43.8367, lng: 4.3601 },
    'annecy': { lat: 45.8992, lng: 6.1294 },
    'pau': { lat: 43.2951, lng: -0.3708 },
    'grenoble': { lat: 45.1885, lng: 5.7245 },
    'sedan': { lat: 49.7019, lng: 4.9427 },
    'sochaux': { lat: 47.5072, lng: 6.8284 },
    'montbéliard': { lat: 47.5072, lng: 6.8284 },
    'valenciennes': { lat: 50.3490, lng: 3.5235 },
    'laval': { lat: 48.0735, lng: -0.7714 },
    'rodez': { lat: 44.3496, lng: 2.5728 },
    'dunkerque': { lat: 51.0343, lng: 2.3768 },
    'niort': { lat: 46.3234, lng: -0.4593 },
    'orléans': { lat: 47.9029, lng: 1.9093 },
    'orleans': { lat: 47.9029, lng: 1.9093 },
    'chambéry': { lat: 45.5646, lng: 5.9178 },
    'quevilly': { lat: 49.4107, lng: 1.0557 },
    'rouen': { lat: 49.4432, lng: 1.0999 },
    'red star': { lat: 48.9209, lng: 2.3573 },
    'créteil': { lat: 48.7900, lng: 2.4551 },
    'villefranche': { lat: 45.9900, lng: 4.7186 },
    'concarneau': { lat: 47.8736, lng: -3.9176 },
    'châteauroux': { lat: 46.8103, lng: 1.6912 },
    'chateauroux': { lat: 46.8103, lng: 1.6912 },
    'boulogne': { lat: 48.8607, lng: 2.2399 },
    'boulogne-sur-mer': { lat: 50.7264, lng: 1.6147 },
    'versailles': { lat: 48.8049, lng: 2.1204 },
    'martigues': { lat: 43.4053, lng: 5.0476 }
};

function getTeamCoordinates(team) {
    const city = (team.city || '').toLowerCase().trim();
    
    // Recherche directe
    if (CITY_COORDINATES[city]) return CITY_COORDINATES[city];
    
    // Recherche partielle
    for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
        if (city.includes(key) || key.includes(city)) return coords;
    }
    
    // Recherche dans le nom de l'équipe
    const name = (team.name || '').toLowerCase();
    for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
        if (name.includes(key)) return coords;
    }
    
    return null;
}

// Convertir GPS → coordonnées SVG sur la carte de France
function gpsToSvg(lat, lng, viewBox) {
    // Bornes approximatives de la France métropolitaine
    const minLat = 41.3, maxLat = 51.1;
    const minLng = -5.2, maxLng = 9.6;
    
    const x = viewBox.padding + ((lng - minLng) / (maxLng - minLng)) * viewBox.mapWidth;
    const y = viewBox.padding + ((maxLat - lat) / (maxLat - minLat)) * viewBox.mapHeight;
    
    return { x, y };
}

function initFranceMap() {
    const container = document.getElementById('franceMapContainer');
    if (!container) return;
    
    const season = currentSeason;
    const teams = typeof getTeamsBySeason === 'function' ? getTeamsBySeason(season) : allTeams;
    
    // Vérifier que les équipes ont des coordonnées
    const teamsWithCoords = teams.map(team => {
        const coords = getTeamCoordinates(team);
        return coords ? { ...team, coords } : null;
    }).filter(Boolean);
    
    if (teamsWithCoords.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#95a5a6;">Aucune équipe localisée</p>';
        return;
    }
    
    // Mode d'affichage
    const mode = document.getElementById('mapMode')?.value || 'ranking';
    
    // Calculer classement ou Elo
    const ranking = calculateRankingForMap(teams);
    
    // Elo
    let eloMap = {};
    if (typeof EloSystem !== 'undefined') {
        const teamsElo = EloSystem.initializeTeamsElo(teams);
        const sorted = [...allMatches].sort((a, b) => (a.matchDay || 0) - (b.matchDay || 0));
        sorted.forEach(m => EloSystem.processMatch(m, teamsElo));
        teamsElo.forEach(t => { eloMap[t.id] = t.eloRating || 1500; });
    }
    
    // Dimensions SVG
    const svgWidth = 500;
    const svgHeight = 520;
    const padding = 40;
    const viewBox = {
        padding,
        mapWidth: svgWidth - padding * 2,
        mapHeight: svgHeight - padding * 2
    };
    
    // Contour simplifié de la France (polygone)
    const francePath = generateFranceOutline(viewBox);
    
    // Générer le SVG
    let svg = `<svg width="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" style="max-width:${svgWidth}px;margin:0 auto;display:block;">`;
    
    // Fond
    svg += `<rect width="${svgWidth}" height="${svgHeight}" fill="#f0f4f8" rx="12"/>`;
    
    // Contour France
    svg += `<path d="${francePath}" fill="#e8eef5" stroke="#bdc3c7" stroke-width="1.5"/>`;
    
    // Corse (petit rectangle symbolique)
    const corse1 = gpsToSvg(42.5, 9.0, viewBox);
    const corse2 = gpsToSvg(41.4, 9.5, viewBox);
    svg += `<ellipse cx="${(corse1.x + corse2.x) / 2}" cy="${(corse1.y + corse2.y) / 2}" rx="8" ry="16" fill="#e8eef5" stroke="#bdc3c7" stroke-width="1"/>`;
    
    // Placer les équipes
    teamsWithCoords.forEach(team => {
        const pos = gpsToSvg(team.coords.lat, team.coords.lng, viewBox);
        const rankData = ranking.find(r => r.id == team.id);
        const rank = rankData ? rankData.rank : teams.length;
        const points = rankData ? rankData.points : 0;
        const elo = eloMap[team.id] || 1500;
        
        let color, value, radius;
        
        if (mode === 'elo') {
            const minElo = Math.min(...Object.values(eloMap), 1400);
            const maxElo = Math.max(...Object.values(eloMap), 1600);
            const ratio = (elo - minElo) / (maxElo - minElo || 1);
            color = getGradientColor(ratio);
            value = Math.round(elo);
            radius = 14 + ratio * 8;
        } else {
            // Mode classement
            const ratio = 1 - (rank - 1) / (teams.length - 1 || 1);
            color = getGradientColor(ratio);
            value = `${rank}e`;
            radius = 14 + ratio * 8;
        }
        
        // Ombre
        svg += `<circle cx="${pos.x + 1}" cy="${pos.y + 1}" r="${radius}" fill="rgba(0,0,0,0.15)"/>`;
        
        // Cercle principal
        svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${radius}" fill="${color}" stroke="white" stroke-width="2.5" 
                    style="cursor:pointer;" class="team-dot" data-team-id="${team.id}"/>`;
        
        // Valeur dans le cercle
        svg += `<text x="${pos.x}" y="${pos.y + 1}" text-anchor="middle" dominant-baseline="central" 
                    fill="white" font-size="${mode === 'elo' ? 8 : 10}" font-weight="bold" 
                    style="pointer-events:none;">${value}</text>`;
        
        // Nom de l'équipe (label)
        const labelY = pos.y - radius - 6;
        svg += `<text x="${pos.x}" y="${labelY}" text-anchor="middle" fill="#2c3e50" 
                    font-size="10" font-weight="600" style="pointer-events:none;">${team.shortName}</text>`;
    });
    
    svg += '</svg>';
    
    // Légende
    let legendHtml = `<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;margin-top:1rem;">`;
    legendHtml += `<span style="font-size:0.8rem;color:#27ae60;font-weight:bold;">🏆 ${mode === 'elo' ? 'Elo élevé' : '1er'}</span>`;
    legendHtml += `<div style="width:120px;height:8px;border-radius:4px;background:linear-gradient(to right,#27ae60,#f39c12,#e74c3c);"></div>`;
    legendHtml += `<span style="font-size:0.8rem;color:#e74c3c;font-weight:bold;">${mode === 'elo' ? 'Elo bas' : 'Dernier'}</span>`;
    legendHtml += `</div>`;
    
    // Tooltip
    legendHtml += `<div id="mapTooltip" style="display:none;position:fixed;background:#2c3e50;color:white;padding:0.5rem 0.75rem;border-radius:8px;font-size:0.85rem;z-index:1000;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>`;
    
    container.innerHTML = svg + legendHtml;
    
    // Événements hover
    container.querySelectorAll('.team-dot').forEach(dot => {
        dot.addEventListener('mouseenter', (e) => {
            const teamId = dot.dataset.teamId;
            const team = teams.find(t => t.id == teamId);
            const rankData = ranking.find(r => r.id == teamId);
            const elo = eloMap[teamId] || 1500;
            
            const tooltip = document.getElementById('mapTooltip');
            tooltip.innerHTML = `
                <strong>${team?.name || '?'}</strong><br>
                📍 ${team?.city || '?'}<br>
                🏆 ${rankData?.rank || '?'}e — ${rankData?.points || 0} pts<br>
                ⚡ Elo: ${Math.round(elo)}
            `;
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY - 15) + 'px';
        });
        
        dot.addEventListener('mousemove', (e) => {
            const tooltip = document.getElementById('mapTooltip');
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY - 15) + 'px';
        });
        
        dot.addEventListener('mouseleave', () => {
            document.getElementById('mapTooltip').style.display = 'none';
        });
    });
}

function calculateRankingForMap(teams) {
    return teams.map(team => {
        let points = 0, goalsFor = 0, goalsAgainst = 0;
        allMatches.forEach(match => {
            const isHome = match.homeTeamId == team.id;
            const isAway = match.awayTeamId == team.id;
            if (!isHome && !isAway) return;
            const gf = isHome ? match.finalScore.home : match.finalScore.away;
            const ga = isHome ? match.finalScore.away : match.finalScore.home;
            goalsFor += gf; goalsAgainst += ga;
            if (gf > ga) points += 3;
            else if (gf === ga) points += 1;
        });
        return { id: team.id, points, goalDifference: goalsFor - goalsAgainst, goalsFor };
    }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
      .map((t, i) => ({ ...t, rank: i + 1 }));
}

function getGradientColor(ratio) {
    // 1 = vert (bon), 0 = rouge (mauvais)
    if (ratio > 0.66) {
        const t = (ratio - 0.66) / 0.34;
        return interpolateColor('#f39c12', '#27ae60', t);
    } else if (ratio > 0.33) {
        const t = (ratio - 0.33) / 0.33;
        return interpolateColor('#e74c3c', '#f39c12', t);
    } else {
        return interpolateColor('#c0392b', '#e74c3c', ratio / 0.33);
    }
}

function interpolateColor(color1, color2, t) {
    const c1 = hexToRgbMap(color1);
    const c2 = hexToRgbMap(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r},${g},${b})`;
}

function hexToRgbMap(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function generateFranceOutline(viewBox) {
    // Points du contour simplifié de la France métropolitaine (lat/lng)
    const outline = [
        [51.05, 2.55],   // Dunkerque
        [50.95, 1.85],   // Calais
        [49.5, 0.1],     // Le Havre
        [48.65, -1.6],   // St-Malo
        [48.45, -4.5],   // Brest
        [47.75, -3.4],   // Lorient
        [47.3, -2.5],    // St-Nazaire
        [47.0, -1.2],    // Pornic
        [46.15, -1.15],  // La Rochelle
        [45.6, -1.2],    // Royan
        [44.65, -1.2],   // Arcachon
        [43.5, -1.55],   // Bayonne
        [42.7, 0.3],     // Luchon
        [42.45, 1.9],    // Andorre
        [42.5, 3.05],    // Perpignan
        [43.1, 3.4],     // Narbonne
        [43.4, 4.8],     // Camargue
        [43.2, 5.4],     // Marseille
        [43.1, 6.1],     // Toulon
        [43.55, 7.0],    // Cannes
        [43.7, 7.4],     // Monaco
        [44.35, 6.6],    // Gap
        [45.2, 6.8],     // Savoie
        [46.2, 6.2],     // Genève
        [47.35, 7.0],    // Bâle
        [48.0, 7.6],     // Colmar
        [49.0, 8.2],     // Wissembourg
        [49.5, 6.4],     // Luxembourg
        [49.6, 5.8],     // Longwy
        [50.1, 4.2],     // Charleroi
        [50.5, 3.1],     // Tournai
        [51.05, 2.55]    // Dunkerque (fermer)
    ];
    
    const points = outline.map(([lat, lng]) => gpsToSvg(lat, lng, viewBox));
    return 'M ' + points.map(p => `${p.x},${p.y}`).join(' L ') + ' Z';
}

// =====================================================
// 🏎️ COURSE AU TITRE ANIMÉE (Bar Chart Race)
// Ajouter ce code à la fin de statistics.js
// =====================================================

let titleRaceInterval = null;
let titleRaceCurrentDay = 0;
let titleRaceSpeed = 800; // ms par journée
let titleRacePlaying = false;

function initTitleRace() {
    const container = document.getElementById('titleRaceContainer');
    if (!container) return;
    
    const playedMatchDays = [...new Set(allMatches.map(m => m.matchDay))].sort((a, b) => a - b);
    
    if (playedMatchDays.length < 2) {
        container.innerHTML = '<p style="text-align:center;color:#95a5a6;">Il faut au moins 2 journées jouées</p>';
        return;
    }
    
    titleRaceCurrentDay = 0;
    
    // Pré-calculer tous les classements
    const teams = typeof getTeamsBySeason === 'function' ? getTeamsBySeason(currentSeason) : allTeams;
    const snapshots = [];
    
    // Snapshot initial (J0 = tout à 0)
    snapshots.push({
        matchDay: 0,
        ranking: teams.map(t => ({
            id: t.id,
            name: t.shortName || t.name,
            points: 0,
            goalsFor: 0,
            goalDifference: 0,
            played: 0,
            lastResult: null
        })).sort((a, b) => a.name.localeCompare(b.name))
    });
    
    // Snapshot pour chaque journée
    playedMatchDays.forEach(day => {
        const matchesUpTo = allMatches.filter(m => m.matchDay <= day);
        
        const ranking = teams.map(team => {
            let points = 0, goalsFor = 0, goalsAgainst = 0, played = 0, lastResult = null;
            
            matchesUpTo.forEach(match => {
                const isHome = match.homeTeamId == team.id;
                const isAway = match.awayTeamId == team.id;
                if (!isHome && !isAway) return;
                
                played++;
                const gf = isHome ? match.finalScore.home : match.finalScore.away;
                const ga = isHome ? match.finalScore.away : match.finalScore.home;
                goalsFor += gf;
                goalsAgainst += ga;
                
                if (gf > ga) points += 3;
                else if (gf === ga) points += 1;
                
                // Dernier résultat de cette journée
                if (match.matchDay === day) {
                    lastResult = gf > ga ? 'V' : gf === ga ? 'N' : 'D';
                }
            });
            
            return {
                id: team.id,
                name: team.shortName || team.name,
                points,
                goalsFor,
                goalDifference: goalsFor - goalsAgainst,
                played,
                lastResult
            };
        }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
        
        snapshots.push({ matchDay: day, ranking });
    });
    
    window.titleRaceSnapshots = snapshots;
    window.titleRaceMaxDay = snapshots.length - 1;
    
    // Render controls + area
    container.innerHTML = `
        <div class="title-race-controls" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap;justify-content:center;">
            <button id="racePlayBtn" onclick="toggleTitleRace()" 
                    style="padding:0.5rem 1.2rem;background:linear-gradient(135deg,#27ae60,#2ecc71);color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem;font-weight:bold;min-width:90px;">
                ▶️ Play
            </button>
            <button onclick="stepTitleRace(-1)" style="padding:0.5rem 0.75rem;background:#ecf0f1;border:none;border-radius:6px;cursor:pointer;font-size:1rem;">⏪</button>
            <button onclick="stepTitleRace(1)" style="padding:0.5rem 0.75rem;background:#ecf0f1;border:none;border-radius:6px;cursor:pointer;font-size:1rem;">⏩</button>
            <div style="display:flex;align-items:center;gap:0.5rem;">
                <label style="font-size:0.85rem;color:#7f8c8d;">Vitesse :</label>
                <select id="raceSpeed" onchange="changeRaceSpeed(this.value)" style="padding:0.3rem;border:1px solid #ddd;border-radius:4px;">
                    <option value="1200">🐢 Lent</option>
                    <option value="800" selected>🏃 Normal</option>
                    <option value="400">🏎️ Rapide</option>
                    <option value="200">⚡ Turbo</option>
                </select>
            </div>
            <input type="range" id="raceSlider" min="0" max="${snapshots.length - 1}" value="0" 
                   oninput="jumpToDay(this.value)"
                   style="flex:1;min-width:150px;accent-color:#3498db;">
            <span id="raceLabel" style="font-weight:bold;font-size:1.1rem;color:#2c3e50;min-width:80px;text-align:center;">Début</span>
        </div>
        <div id="titleRaceBars" style="position:relative;overflow:hidden;">
            <!-- Barres animées -->
        </div>
    `;
    
    // Afficher le premier frame
    renderTitleRaceFrame(0);
}

function renderTitleRaceFrame(index) {
    const snapshots = window.titleRaceSnapshots;
    if (!snapshots || index < 0 || index >= snapshots.length) return;
    
    titleRaceCurrentDay = index;
    
    const snapshot = snapshots[index];
    const ranking = snapshot.ranking;
    const maxPoints = Math.max(...ranking.map(r => r.points), 1);
    const teams = typeof getTeamsBySeason === 'function' ? getTeamsBySeason(currentSeason) : allTeams;
    const totalTeams = teams.length;
    
    // Mettre à jour le slider et le label
    const slider = document.getElementById('raceSlider');
    const label = document.getElementById('raceLabel');
    if (slider) slider.value = index;
    if (label) label.textContent = index === 0 ? 'Début' : `Journée ${snapshot.matchDay}`;
    
    const barsContainer = document.getElementById('titleRaceBars');
    if (!barsContainer) return;
    
    // Nombre d'équipes à afficher (top 10 ou toutes si <= 12)
    const showCount = totalTeams <= 12 ? totalTeams : 10;
    const barHeight = 32;
    const barGap = 4;
    const containerHeight = showCount * (barHeight + barGap) + 10;
    
    barsContainer.style.height = containerHeight + 'px';
    
    // Vérifier si les éléments existent déjà
    const existingBars = barsContainer.querySelectorAll('.race-bar-item');
    
    if (existingBars.length === 0) {
        // Première construction
        barsContainer.innerHTML = '';
        
        ranking.slice(0, showCount).forEach((team, i) => {
            const color = getTeamColor(team.id);
            const barWidth = maxPoints > 0 ? (team.points / maxPoints) * 70 : 0;
            const top = i * (barHeight + barGap) + 5;
            
            const el = document.createElement('div');
            el.className = 'race-bar-item';
            el.dataset.teamId = team.id;
            el.style.cssText = `
                position:absolute;left:0;right:0;height:${barHeight}px;
                top:${top}px;
                display:flex;align-items:center;
                transition: top 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            `;
            
            el.innerHTML = `
                <div class="race-rank" style="width:30px;text-align:center;font-weight:bold;font-size:0.85rem;color:#7f8c8d;">${i + 1}</div>
                <div class="race-name" style="width:55px;font-size:0.8rem;font-weight:600;color:#2c3e50;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${team.name}</div>
                <div style="flex:1;position:relative;height:100%;display:flex;align-items:center;">
                    <div class="race-bar" style="
                        height:${barHeight - 4}px;
                        width:${barWidth}%;
                        background:linear-gradient(90deg,${color},${color}dd);
                        border-radius:0 6px 6px 0;
                        transition: width 0.6s ease-out;
                        min-width:4px;
                        display:flex;align-items:center;justify-content:flex-end;padding-right:6px;
                    ">
                        <span style="color:white;font-size:0.75rem;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.3);">${team.points > 0 ? team.points : ''}</span>
                    </div>
                    <span class="race-points-label" style="margin-left:6px;font-weight:bold;font-size:0.85rem;color:${color};">${team.points} pts</span>
                    ${team.lastResult ? `<span class="race-result" style="margin-left:4px;font-size:0.7rem;padding:1px 5px;border-radius:3px;font-weight:bold;color:white;background:${team.lastResult === 'V' ? '#27ae60' : team.lastResult === 'N' ? '#f39c12' : '#e74c3c'};">${team.lastResult}</span>` : ''}
                </div>
            `;
            
            barsContainer.appendChild(el);
        });
    } else {
        // Mise à jour animée
        const visibleTeams = ranking.slice(0, showCount);
        
        visibleTeams.forEach((team, newIndex) => {
            let el = barsContainer.querySelector(`.race-bar-item[data-team-id="${team.id}"]`);
            
            if (!el) {
                // Nouvelle équipe dans le top — créer l'élément
                el = document.createElement('div');
                el.className = 'race-bar-item';
                el.dataset.teamId = team.id;
                el.style.cssText = `
                    position:absolute;left:0;right:0;height:${barHeight}px;
                    top:${newIndex * (barHeight + barGap) + 5}px;
                    display:flex;align-items:center;
                    transition: top 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    opacity:0;
                `;
                el.innerHTML = `
                    <div class="race-rank" style="width:30px;text-align:center;font-weight:bold;font-size:0.85rem;color:#7f8c8d;"></div>
                    <div class="race-name" style="width:55px;font-size:0.8rem;font-weight:600;color:#2c3e50;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${team.name}</div>
                    <div style="flex:1;position:relative;height:100%;display:flex;align-items:center;">
                        <div class="race-bar" style="height:${barHeight - 4}px;width:0%;border-radius:0 6px 6px 0;transition:width 0.6s ease-out;min-width:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;">
                            <span style="color:white;font-size:0.75rem;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.3);"></span>
                        </div>
                        <span class="race-points-label" style="margin-left:6px;font-weight:bold;font-size:0.85rem;"></span>
                    </div>
                `;
                barsContainer.appendChild(el);
                requestAnimationFrame(() => { el.style.opacity = '1'; });
            }
            
            const color = getTeamColor(team.id);
            const barWidth = maxPoints > 0 ? (team.points / maxPoints) * 70 : 0;
            const top = newIndex * (barHeight + barGap) + 5;
            
            // Animer la position
            el.style.top = top + 'px';
            
            // Mettre à jour le rang
            el.querySelector('.race-rank').textContent = newIndex + 1;
            
            // Mettre à jour la barre
            const bar = el.querySelector('.race-bar');
            bar.style.width = barWidth + '%';
            bar.style.background = `linear-gradient(90deg,${color},${color}dd)`;
            bar.querySelector('span').textContent = team.points > 0 ? team.points : '';
            
            // Mettre à jour les points
            const ptsLabel = el.querySelector('.race-points-label');
            ptsLabel.textContent = `${team.points} pts`;
            ptsLabel.style.color = color;
            
            // Mettre à jour le résultat
            let resultEl = el.querySelector('.race-result');
            if (team.lastResult) {
                if (!resultEl) {
                    resultEl = document.createElement('span');
                    resultEl.className = 'race-result';
                    resultEl.style.cssText = 'margin-left:4px;font-size:0.7rem;padding:1px 5px;border-radius:3px;font-weight:bold;color:white;';
                    el.querySelector('div[style*="flex:1"]').appendChild(resultEl);
                }
                resultEl.textContent = team.lastResult;
                resultEl.style.background = team.lastResult === 'V' ? '#27ae60' : team.lastResult === 'N' ? '#f39c12' : '#e74c3c';
                resultEl.style.display = '';
            } else if (resultEl) {
                resultEl.style.display = 'none';
            }
        });
        
        // Cacher les équipes qui sortent du top
        barsContainer.querySelectorAll('.race-bar-item').forEach(el => {
            const teamId = el.dataset.teamId;
            const isVisible = visibleTeams.some(t => t.id == teamId);
            if (!isVisible) {
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 600);
            }
        });
    }
}

function toggleTitleRace() {
    if (titleRacePlaying) {
        pauseTitleRace();
    } else {
        playTitleRace();
    }
}

function playTitleRace() {
    const maxDay = window.titleRaceMaxDay || 0;
    
    // Si à la fin, recommencer
    if (titleRaceCurrentDay >= maxDay) {
        titleRaceCurrentDay = 0;
        // Reset les barres
        const barsContainer = document.getElementById('titleRaceBars');
        if (barsContainer) barsContainer.innerHTML = '';
        renderTitleRaceFrame(0);
    }
    
    titleRacePlaying = true;
    document.getElementById('racePlayBtn').innerHTML = '⏸️ Pause';
    document.getElementById('racePlayBtn').style.background = 'linear-gradient(135deg,#e74c3c,#c0392b)';
    
    titleRaceInterval = setInterval(() => {
        titleRaceCurrentDay++;
        if (titleRaceCurrentDay > maxDay) {
            pauseTitleRace();
            return;
        }
        renderTitleRaceFrame(titleRaceCurrentDay);
    }, titleRaceSpeed);
}

function pauseTitleRace() {
    titleRacePlaying = false;
    clearInterval(titleRaceInterval);
    document.getElementById('racePlayBtn').innerHTML = '▶️ Play';
    document.getElementById('racePlayBtn').style.background = 'linear-gradient(135deg,#27ae60,#2ecc71)';
}

function stepTitleRace(direction) {
    pauseTitleRace();
    const maxDay = window.titleRaceMaxDay || 0;
    const newDay = Math.max(0, Math.min(maxDay, titleRaceCurrentDay + direction));
    
    if (newDay !== titleRaceCurrentDay) {
        // Reset bars si on recule
        if (direction < 0) {
            const barsContainer = document.getElementById('titleRaceBars');
            if (barsContainer) barsContainer.innerHTML = '';
        }
        renderTitleRaceFrame(newDay);
    }
}

function jumpToDay(index) {
    pauseTitleRace();
    const barsContainer = document.getElementById('titleRaceBars');
    if (barsContainer) barsContainer.innerHTML = '';
    renderTitleRaceFrame(parseInt(index));
}

function changeRaceSpeed(speed) {
    titleRaceSpeed = parseInt(speed);
    if (titleRacePlaying) {
        clearInterval(titleRaceInterval);
        titleRaceInterval = setInterval(() => {
            titleRaceCurrentDay++;
            if (titleRaceCurrentDay > (window.titleRaceMaxDay || 0)) {
                pauseTitleRace();
                return;
            }
            renderTitleRaceFrame(titleRaceCurrentDay);
        }, titleRaceSpeed);
    }
}