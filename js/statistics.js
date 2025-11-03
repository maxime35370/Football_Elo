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
                
                if (!scorers[scorerName]) {
                    scorers[scorerName] = {
                        name: scorerName,
                        teamId: teamId,
                        goals: 0,
                        matches: new Set()
                    };
                }
                
                scorers[scorerName].goals++;
                scorers[scorerName].matches.add(match.id);
            });
        }
    });
    
    // Convertir en tableau et trier
    const scorersArray = Object.values(scorers).map(scorer => ({
        ...scorer,
        matchesPlayed: scorer.matches.size,
        goalsPerMatch: (scorer.goals / scorer.matches.size).toFixed(2)
    }));
    
    scorersArray.sort((a, b) => {
        if (b.goals !== a.goals) return b.goals - a.goals;
        return parseFloat(b.goalsPerMatch) - parseFloat(a.goalsPerMatch);
    });
    
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
                <td colspan="5" style="text-align: center; padding: 2rem; color: #7f8c8d;">
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
                <td>${scorer.goalsPerMatch}</td>
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
    
    // Collecter tous les buts avec leur minute
    let goalsFor = [];
    let goalsAgainst = [];
    
    allMatches.forEach(match => {
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                const minute = parseInt(goal.minute);
                
                // Filtrer par équipe si nécessaire
                if (selectedTeamId === 'all') {
                    goalsFor.push({ minute, scorer: goal.scorer, teamId: goal.teamId });
                } else {
                    if (goal.teamId == selectedTeamId) {
                        goalsFor.push({ minute, scorer: goal.scorer, teamId: goal.teamId });
                    } else if (match.homeTeamId == selectedTeamId || match.awayTeamId == selectedTeamId) {
                        goalsAgainst.push({ minute, scorer: goal.scorer, teamId: goal.teamId });
                    }
                }
            });
        }
    });
    
    // Si "toutes les équipes", pas de distinction pour/contre
    if (selectedTeamId === 'all') {
        goalsAgainst = [];
    }
    
    // Générer les graphiques selon la tranche de temps
    if (timeSlice === '5') {
        generateTimeSliceChart(goalsFor, goalsAgainst, 5);
    } else if (timeSlice === '15') {
        generateTimeSliceChart(goalsFor, goalsAgainst, 15);
    } else if (timeSlice === 'half') {
        generateHalfTimeChart(goalsFor, goalsAgainst);
    }
    
    // Afficher les minutes exactes
    displayMinutesByMinute(goalsFor, goalsAgainst);
    
    // Graphique comparatif
    displayComparisonChart(goalsFor, goalsAgainst);
}

function generateTimeSliceChart(goalsFor, goalsAgainst, sliceSize) {
    const container = document.getElementById('timeSliceChart');
    
    // Définir les tranches de temps
    let timeSlices = [];
    
    if (sliceSize === 5) {
        // Tranches de 5 minutes
        for (let i = 0; i < 45; i += 5) {
            timeSlices.push({ label: `${i+1}-${i+5}`, min: i+1, max: i+5 });
        }
        timeSlices.push({ label: '45+ (MT)', min: 46, max: 45.99 }); // Temps additionnel 1ère MT
        
        for (let i = 46; i <= 86; i += 5) {
            timeSlices.push({ label: `${i}-${i+4}`, min: i, max: i+4 });
        }
        timeSlices.push({ label: '90+ (2ème)', min: 91, max: 999 }); // Temps additionnel 2ème MT
        
    } else if (sliceSize === 15) {
        // Tranches de 15 minutes
        timeSlices = [
            { label: '1-15', min: 1, max: 15 },
            { label: '16-30', min: 16, max: 30 },
            { label: '31-45', min: 31, max: 45 },
            { label: '45+ (MT)', min: 46, max: 45.99 },
            { label: '46-60', min: 46, max: 60 },
            { label: '61-75', min: 61, max: 75 },
            { label: '76-90', min: 76, max: 90 },
            { label: '90+ (2ème)', min: 91, max: 999 }
        ];
    }
    
    // Compter les buts par tranche
    const countsFor = timeSlices.map(slice => ({
        label: slice.label,
        count: goalsFor.filter(g => {
            if (slice.label.includes('45+ (MT)')) {
                return g.minute > 45 && g.minute < 46;
            } else if (slice.label.includes('90+')) {
                return g.minute > 90;
            } else {
                return g.minute >= slice.min && g.minute <= slice.max;
            }
        }).length
    }));
    
    const countsAgainst = timeSlices.map(slice => ({
        label: slice.label,
        count: goalsAgainst.filter(g => {
            if (slice.label.includes('45+ (MT)')) {
                return g.minute > 45 && g.minute < 46;
            } else if (slice.label.includes('90+')) {
                return g.minute > 90;
            } else {
                return g.minute >= slice.min && g.minute <= slice.max;
            }
        }).length
    }));
    
    // Trouver le maximum pour l'échelle
    const maxCount = Math.max(
        ...countsFor.map(c => c.count),
        ...countsAgainst.map(c => c.count),
        1
    );
    
    // Générer le HTML du graphique
    let html = '<div class="chart-bar-container">';
    
    timeSlices.forEach((slice, index) => {
        const forCount = countsFor[index].count;
        const againstCount = countsAgainst[index].count;
        
        if (forCount > 0 || againstCount > 0) {
            html += `<div class="chart-bar-row">`;
            html += `<div class="chart-bar-label">${slice.label}</div>`;
            html += `<div class="chart-bar-wrapper">`;
            
            if (forCount > 0) {
                const widthFor = (forCount / maxCount) * 100;
                html += `
                    <div class="chart-bar goals-for" style="width: ${widthFor}%">
                        <span class="chart-bar-value">${forCount}</span>
                    </div>
                `;
            }
            
            if (againstCount > 0) {
                const widthAgainst = (againstCount / maxCount) * 100;
                html += `
                    <div class="chart-bar goals-against" style="width: ${widthAgainst}%; margin-top: 2px;">
                        <span class="chart-bar-value">${againstCount} contre</span>
                    </div>
                `;
            }
            
            html += `</div>`;
            html += `</div>`;
        }
    });
    
    html += '</div>';
    
    // Résumé
    const totalFor = goalsFor.length;
    const totalAgainst = goalsAgainst.length;
    
    if (totalFor > 0 || totalAgainst > 0) {
        html += `<div class="chart-summary">`;
        if (totalFor > 0) {
            html += `⚽ <strong>${totalFor}</strong> buts marqués`;
        }
        if (totalAgainst > 0) {
            if (totalFor > 0) html += ' | ';
            html += `🛡️ <strong>${totalAgainst}</strong> buts encaissés`;
        }
        html += `</div>`;
    }
    
    container.innerHTML = html || '<p style="text-align: center; color: #95a5a6;">Aucun but dans ces tranches</p>';
}

function generateHalfTimeChart(goalsFor, goalsAgainst) {
    const container = document.getElementById('timeSliceChart');
    
    // Définir les mi-temps
    const halfTimes = [
        { label: '1ère mi-temps (1-45)', min: 1, max: 45 },
        { label: 'Temps add. MT', min: 45.1, max: 45.99 },
        { label: '2ème mi-temps (46-90)', min: 46, max: 90 },
        { label: 'Temps add. 2ème', min: 90.1, max: 999 }
    ];
    
    // Compter les buts par mi-temps
    const countsFor = halfTimes.map(ht => ({
        label: ht.label,
        count: goalsFor.filter(g => g.minute >= ht.min && g.minute <= ht.max).length
    }));
    
    const countsAgainst = halfTimes.map(ht => ({
        label: ht.label,
        count: goalsAgainst.filter(g => g.minute >= ht.min && g.minute <= ht.max).length
    }));
    
    const maxCount = Math.max(
        ...countsFor.map(c => c.count),
        ...countsAgainst.map(c => c.count),
        1
    );
    
    let html = '<div class="chart-bar-container">';
    
    halfTimes.forEach((ht, index) => {
        const forCount = countsFor[index].count;
        const againstCount = countsAgainst[index].count;
        
        if (forCount > 0 || againstCount > 0) {
            html += `<div class="chart-bar-row">`;
            html += `<div class="chart-bar-label">${ht.label}</div>`;
            html += `<div class="chart-bar-wrapper">`;
            
            if (forCount > 0) {
                const widthFor = (forCount / maxCount) * 100;
                html += `
                    <div class="chart-bar goals-for" style="width: ${widthFor}%">
                        <span class="chart-bar-value">${forCount}</span>
                    </div>
                `;
            }
            
            if (againstCount > 0) {
                const widthAgainst = (againstCount / maxCount) * 100;
                html += `
                    <div class="chart-bar goals-against" style="width: ${widthAgainst}%; margin-top: 2px;">
                        <span class="chart-bar-value">${againstCount} contre</span>
                    </div>
                `;
            }
            
            html += `</div>`;
            html += `</div>`;
        }
    });
    
    html += '</div>';
    
    const totalFor = goalsFor.length;
    const totalAgainst = goalsAgainst.length;
    
    if (totalFor > 0 || totalAgainst > 0) {
        html += `<div class="chart-summary">`;
        if (totalFor > 0) {
            html += `⚽ <strong>${totalFor}</strong> buts marqués`;
        }
        if (totalAgainst > 0) {
            if (totalFor > 0) html += ' | ';
            html += `🛡️ <strong>${totalAgainst}</strong> buts encaissés`;
        }
        html += `</div>`;
    }
    
    container.innerHTML = html || '<p style="text-align: center; color: #95a5a6;">Aucun but</p>';
}

function displayMinutesByMinute(goalsFor, goalsAgainst) {
    const forList = document.getElementById('minutesForList');
    const againstList = document.getElementById('minutesAgainstList');
    
    // Trier par minute
    goalsFor.sort((a, b) => a.minute - b.minute);
    goalsAgainst.sort((a, b) => a.minute - b.minute);
    
    // Afficher buts marqués
    if (goalsFor.length > 0) {
        forList.innerHTML = goalsFor.map(goal => {
            const team = allTeams.find(t => t.id == goal.teamId);
            const teamName = team ? team.shortName : 'N/A';
            const isExtraTime = goal.minute > 90 || (goal.minute > 45 && goal.minute < 46);
            
            return `
                <div class="minute-item">
                    <span class="minute-time ${isExtraTime ? 'extra-time' : ''}">${formatMinute(goal.minute)}'</span>
                    <span>${goal.scorer} (${teamName})</span>
                </div>
            `;
        }).join('');
    } else {
        forList.innerHTML = '<p style="color: #95a5a6; text-align: center;">Aucun but marqué</p>';
    }
    
    // Afficher buts encaissés
    if (goalsAgainst.length > 0) {
        againstList.innerHTML = goalsAgainst.map(goal => {
            const team = allTeams.find(t => t.id == goal.teamId);
            const teamName = team ? team.shortName : 'N/A';
            const isExtraTime = goal.minute > 90 || (goal.minute > 45 && goal.minute < 46);
            
            return `
                <div class="minute-item">
                    <span class="minute-time ${isExtraTime ? 'extra-time' : ''}">${formatMinute(goal.minute)}'</span>
                    <span>${goal.scorer} (${teamName})</span>
                </div>
            `;
        }).join('');
    } else {
        againstList.innerHTML = '<p style="color: #95a5a6; text-align: center;">Aucun but encaissé</p>';
    }
}

function formatMinute(minute) {
    const min = Math.floor(minute);
    const decimal = minute - min;
    
    if (decimal > 0) {
        // Temps additionnel (ex: 45.3 -> 45+3)
        return `${min}+${Math.round(decimal * 10)}`;
    }
    return min.toString();
}

function displayComparisonChart(goalsFor, goalsAgainst) {
    const container = document.getElementById('comparisonChart');
    
    if (goalsFor.length === 0 && goalsAgainst.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6;">Aucune donnée à afficher</p>';
        return;
    }
    
    const totalFor = goalsFor.length;
    const totalAgainst = goalsAgainst.length;
    const max = Math.max(totalFor, totalAgainst);
    
    const widthFor = max > 0 ? (totalFor / max) * 100 : 0;
    const widthAgainst = max > 0 ? (totalAgainst / max) * 100 : 0;
    
    container.innerHTML = `
        <div class="chart-bar-container">
            <div class="chart-bar-row">
                <div class="chart-bar-label">Buts marqués</div>
                <div class="chart-bar-wrapper">
                    <div class="chart-bar goals-for" style="width: ${widthFor}%">
                        <span class="chart-bar-value">${totalFor}</span>
                    </div>
                </div>
            </div>
            
            <div class="chart-bar-row">
                <div class="chart-bar-label">Buts encaissés</div>
                <div class="chart-bar-wrapper">
                    <div class="chart-bar goals-against" style="width: ${widthAgainst}%">
                        <span class="chart-bar-value">${totalAgainst}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="chart-summary">
            Différence de buts : ${totalFor - totalAgainst > 0 ? '+' : ''}${totalFor - totalAgainst}
        </div>
    `;
}

// === STATISTIQUES GÉNÉRALES ===

function updateGeneralStats() {
    // Collecter tous les buts
    let allGoals = [];
    
    allMatches.forEach(match => {
        if (match.goals && match.goals.length > 0) {
            match.goals.forEach(goal => {
                allGoals.push(parseInt(goal.minute));
            });
        }
    });
    
    const totalGoals = allGoals.length;
    const totalMatches = allMatches.length;
    const avgGoalsPerMatch = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : 0;
    
    // Trouver la minute la plus prolifique
    const minuteCounts = {};
    allGoals.forEach(minute => {
        const roundedMinute = Math.floor(minute);
        minuteCounts[roundedMinute] = (minuteCounts[roundedMinute] || 0) + 1;
    });
    
    let mostScoringMinute = '-';
    let leastScoringMinute = '-';
    
    if (Object.keys(minuteCounts).length > 0) {
        const sortedMinutes = Object.entries(minuteCounts).sort((a, b) => b[1] - a[1]);
        mostScoringMinute = `${sortedMinutes[0][0]}' (${sortedMinutes[0][1]} buts)`;
        
        if (sortedMinutes.length > 1) {
            leastScoringMinute = `${sortedMinutes[sortedMinutes.length - 1][0]}' (${sortedMinutes[sortedMinutes.length - 1][1]} buts)`;
        }
    }
    
    // Mettre à jour l'affichage
    document.getElementById('totalGoals').textContent = totalGoals;
    document.getElementById('avgGoalsPerMatch').textContent = avgGoalsPerMatch;
    document.getElementById('mostScoringMinute').textContent = mostScoringMinute;
    document.getElementById('leastScoringMinute').textContent = leastScoringMinute;
}