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
    } else {
        // Afficher stats équipe
        generalWrapper.style.display = 'none';
        teamWrapper.style.display = 'block';
        updateTeamScorers();
        updateTimeAnalysis();
        updateScoreDistributionTeam(selectedTeamId);
        updateSeasonRecordsTeam(selectedTeamId);
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