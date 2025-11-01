// archives.js - Logique d'affichage des archives

// Initialisation de la page
document.addEventListener('DOMContentLoaded', function() {
    displayArchives();
});

// Afficher toutes les saisons archivées
function displayArchives() {
    const archivedSeasons = getArchivedSeasons();
    const seasonsList = document.getElementById('seasonsList');
    const noArchivesMessage = document.getElementById('noArchivesMessage');
    
    if (archivedSeasons.length === 0) {
        seasonsList.style.display = 'none';
        noArchivesMessage.style.display = 'block';
        return;
    }
    
    seasonsList.style.display = 'grid';
    noArchivesMessage.style.display = 'none';
    seasonsList.innerHTML = '';
    
    // Créer une carte pour chaque saison
    archivedSeasons.forEach(season => {
        const seasonCard = createSeasonCard(season);
        seasonsList.appendChild(seasonCard);
    });
}

// Créer une carte pour une saison
function createSeasonCard(season) {
    const card = document.createElement('div');
    card.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        border-radius: 15px;
        padding: 2rem;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    `;
    
    // Récupérer les statistiques de la saison
    const stats = getSeasonStats(season.name);
    const ranking = generateRanking(null, season.name);
    
    // Trouver le champion
    const champion = ranking.length > 0 ? ranking[0] : null;
    
    // Trouver le meilleur buteur
    const topScorer = findTopScorer(season.name);
    
    // Dates
    const startDate = new Date(season.startDate).toLocaleDateString('fr-FR');
    const endDate = season.endDate ? new Date(season.endDate).toLocaleDateString('fr-FR') : 'En cours';
    
    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 3px solid #3498db; padding-bottom: 1rem;">
            <h3 style="color: #2c3e50; margin: 0; font-size: 1.8rem;">
                🏆 Saison ${season.name}
            </h3>
            <span style="background: #e9ecef; padding: 0.5rem 1rem; border-radius: 20px; color: #2c3e50; font-weight: 600;">
                ${startDate} → ${endDate}
            </span>
        </div>
        
        <!-- Champion -->
        ${champion ? `
        <div style="background: linear-gradient(135deg, #f1c40f, #f39c12); color: white; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">👑</div>
            <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.25rem;">
                ${champion.name}
            </div>
            <div style="font-size: 1.1rem; opacity: 0.9;">
                Champion avec ${champion.points} points
            </div>
        </div>
        ` : ''}
        
        <!-- Statistiques -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 2rem; color: #3498db; font-weight: bold;">${stats.totalMatches}</div>
                <div style="color: #7f8c8d; font-weight: 600;">Matchs joués</div>
            </div>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 2rem; color: #e74c3c; font-weight: bold;">${stats.totalGoals}</div>
                <div style="color: #7f8c8d; font-weight: 600;">Buts marqués</div>
            </div>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 2rem; color: #27ae60; font-weight: bold;">${stats.avgGoalsPerMatch}</div>
                <div style="color: #7f8c8d; font-weight: 600;">Moy. buts/match</div>
            </div>
            ${topScorer ? `
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 1.2rem; color: #9b59b6; font-weight: bold;">${topScorer.name}</div>
                <div style="color: #7f8c8d; font-weight: 600;">${topScorer.goals} buts</div>
            </div>
            ` : ''}
        </div>
        
        <!-- Classement complet -->
        <details style="margin-top: 1.5rem;">
            <summary style="cursor: pointer; font-weight: 600; color: #2c3e50; padding: 0.5rem; background: #f8f9fa; border-radius: 5px; margin-bottom: 1rem;">
                📊 Voir le classement complet
            </summary>
            <div style="overflow-x: auto;">
                ${createRankingTable(ranking)}
            </div>
        </details>
        
        <!-- Boutons d'action -->
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: center;">
            <a href="matches.html" class="btn" style="text-decoration: none; display: inline-block;">
                📋 Voir les matchs
            </a>
            <a href="rankings.html" class="btn" style="text-decoration: none; display: inline-block;">
                📈 Classement détaillé
            </a>
        </div>
    `;
    
    return card;
}

// Créer un tableau de classement
function createRankingTable(ranking) {
    if (ranking.length === 0) {
        return '<p style="text-align: center; color: #7f8c8d;">Aucune équipe dans cette saison</p>';
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
            <thead>
                <tr style="background: linear-gradient(135deg, #2c3e50, #34495e); color: white;">
                    <th style="padding: 0.8rem; text-align: center;">Pos.</th>
                    <th style="padding: 0.8rem; text-align: left;">Équipe</th>
                    <th style="padding: 0.8rem; text-align: center;">J</th>
                    <th style="padding: 0.8rem; text-align: center;">V</th>
                    <th style="padding: 0.8rem; text-align: center;">N</th>
                    <th style="padding: 0.8rem; text-align: center;">D</th>
                    <th style="padding: 0.8rem; text-align: center;">BP</th>
                    <th style="padding: 0.8rem; text-align: center;">BC</th>
                    <th style="padding: 0.8rem; text-align: center;">Diff</th>
                    <th style="padding: 0.8rem; text-align: center; font-weight: bold;">Pts</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    ranking.forEach((team, index) => {
        const position = index + 1;
        let rowStyle = 'background: white;';
        
        // Couleurs selon la position
        if (position === 1) {
            rowStyle = 'background: linear-gradient(45deg, #f1c40f, #f39c12); color: white;';
        } else if (position <= 3) {
            rowStyle = 'background: linear-gradient(45deg, #3498db, #2980b9); color: white;';
        } else if (position >= ranking.length - 1) {
            rowStyle = 'background: linear-gradient(45deg, #e74c3c, #c0392b); color: white;';
        } else if (index % 2 === 0) {
            rowStyle = 'background: rgba(52, 152, 219, 0.05);';
        }
        
        html += `
            <tr style="${rowStyle}">
                <td style="padding: 0.8rem; text-align: center; font-weight: bold;">${position}</td>
                <td style="padding: 0.8rem; text-align: left; font-weight: 600;">${team.shortName}</td>
                <td style="padding: 0.8rem; text-align: center;">${team.played}</td>
                <td style="padding: 0.8rem; text-align: center;">${team.won}</td>
                <td style="padding: 0.8rem; text-align: center;">${team.drawn}</td>
                <td style="padding: 0.8rem; text-align: center;">${team.lost}</td>
                <td style="padding: 0.8rem; text-align: center;">${team.goalsFor}</td>
                <td style="padding: 0.8rem; text-align: center;">${team.goalsAgainst}</td>
                <td style="padding: 0.8rem; text-align: center;">${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}</td>
                <td style="padding: 0.8rem; text-align: center; font-weight: bold; font-size: 1.1rem;">${team.points}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}

// Trouver le meilleur buteur d'une saison
function findTopScorer(seasonName) {
    const matches = getMatchesBySeason(seasonName);
    const scorers = {};
    
    matches.forEach(match => {
        if (match.goals) {
            match.goals.forEach(goal => {
                if (!scorers[goal.scorer]) {
                    scorers[goal.scorer] = {
                        name: goal.scorer,
                        goals: 0
                    };
                }
                scorers[goal.scorer].goals++;
            });
        }
    });
    
    // Trouver le meilleur
    let topScorer = null;
    let maxGoals = 0;
    
    for (const scorer in scorers) {
        if (scorers[scorer].goals > maxGoals) {
            maxGoals = scorers[scorer].goals;
            topScorer = scorers[scorer];
        }
    }
    
    return topScorer;
}