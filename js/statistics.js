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
    document.getElementById('teamSelect').addEventListener('change', updateTimeAnalysis);
    document.getElementById('timeSliceSelect').addEventListener('change', updateTimeAnalysis);
    
    // Vérifier si les checkboxes existent avant d'ajouter les événements
    const showExtraTime = document.getElementById('showExtraTime');
    if (showExtraTime) {
        showExtraTime.addEventListener('change', updateTimeAnalysis);
    }
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