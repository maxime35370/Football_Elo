// pronostics-badges.js - Système de badges et achievements

// ===============================
// DÉFINITION DES BADGES
// ===============================

const BADGES_DEFINITIONS = {
    // Badges de progression
    first_prediction: {
        id: 'first_prediction',
        name: 'Débutant',
        icon: '🌱',
        description: 'Premier pronostic enregistré',
        category: 'progression',
        check: (stats) => stats.totalPredictions >= 1
    },
    regular_10: {
        id: 'regular_10',
        name: 'Régulier',
        icon: '📊',
        description: '10 journées pronostiquées',
        category: 'progression',
        check: (stats) => stats.journeysPlayed.length >= 10
    },
    veteran_30: {
        id: 'veteran_30',
        name: 'Vétéran',
        icon: '🎖️',
        description: '30 journées pronostiquées',
        category: 'progression',
        check: (stats) => stats.journeysPlayed.length >= 30
    },
    legend: {
        id: 'legend',
        name: 'Légende',
        icon: '👑',
        description: 'Saison complète pronostiquée',
        category: 'progression',
        check: (stats, context) => {
            const totalMatchDays = (context.teamsCount - 1) * 2;
            return stats.journeysPlayed.length >= totalMatchDays;
        }
    },
    
    // Badges de précision
    sniper_1: {
        id: 'sniper_1',
        name: 'Sniper',
        icon: '🎯',
        description: '1 score exact',
        category: 'precision',
        check: (stats) => stats.exactScores >= 1
    },
    sniper_5: {
        id: 'sniper_5',
        name: 'Tireur d\'élite',
        icon: '🎯',
        description: '5 scores exacts',
        category: 'precision',
        check: (stats) => stats.exactScores >= 5
    },
    sniper_10: {
        id: 'sniper_10',
        name: 'Machine',
        icon: '🎯',
        description: '10 scores exacts',
        category: 'precision',
        check: (stats) => stats.exactScores >= 10
    },
    sniper_25: {
        id: 'sniper_25',
        name: 'Maître Sniper',
        icon: '💎',
        description: '25 scores exacts',
        category: 'precision',
        check: (stats) => stats.exactScores >= 25
    },
    diamond: {
        id: 'diamond',
        name: 'Diamant',
        icon: '💎',
        description: '50% de bons résultats sur la saison',
        category: 'precision',
        check: (stats) => {
            if (stats.totalPredictions < 20) return false;
            const successRate = (stats.totalPredictions - stats.wrongResults) / stats.totalPredictions;
            return successRate >= 0.5;
        }
    },
    perfect_day: {
        id: 'perfect_day',
        name: 'Journée Parfaite',
        icon: '⭐',
        description: '100% de réussite sur une journée complète',
        category: 'precision',
        check: (stats) => stats.perfectDays >= 1
    },
    
    // Badges de séries
    streak_3: {
        id: 'streak_3',
        name: 'En feu',
        icon: '🔥',
        description: '3 bons pronos d\'affilée',
        category: 'streak',
        check: (stats) => stats.bestStreak >= 3
    },
    streak_5: {
        id: 'streak_5',
        name: 'Inarrêtable',
        icon: '🔥',
        description: '5 bons pronos d\'affilée',
        category: 'streak',
        check: (stats) => stats.bestStreak >= 5
    },
    streak_10: {
        id: 'streak_10',
        name: 'Invincible',
        icon: '🔥',
        description: '10 bons pronos d\'affilée',
        category: 'streak',
        check: (stats) => stats.bestStreak >= 10
    },
    ice_cube: {
        id: 'ice_cube',
        name: 'Glaçon',
        icon: '❄️',
        description: '5 mauvais pronos d\'affilée',
        category: 'streak',
        check: (stats) => stats.worstStreak >= 5,
        isNegative: true
    },
    
    // Badges spéciaux
    upset_hunter: {
        id: 'upset_hunter',
        name: 'Renard',
        icon: '🦊',
        description: 'Prédire un upset (victoire du non-favori)',
        category: 'special',
        check: (stats) => stats.upsetsPredicted >= 1
    },
    nil_nil: {
        id: 'nil_nil',
        name: 'Voyant',
        icon: '🎱',
        description: 'Prédire un 0-0 correct',
        category: 'special',
        check: (stats) => stats.nilNilPredicted >= 1
    },
    goal_fest: {
        id: 'goal_fest',
        name: 'Explosif',
        icon: '💣',
        description: 'Prédire un match 4+ buts correct',
        category: 'special',
        check: (stats) => stats.highScoringPredicted >= 1
    },
    anti_ia: {
        id: 'anti_ia',
        name: 'Anti-IA',
        icon: '🤖',
        description: 'Battre l\'IA sur une journée complète',
        category: 'special',
        check: (stats) => stats.beatIA >= 1
    },
    rival_slayer: {
        id: 'rival_slayer',
        name: 'Rival',
        icon: '👊',
        description: 'Battre le 1er du classement sur une journée',
        category: 'special',
        check: (stats) => stats.beatLeader >= 1
    },
    
    // Badges de classement
    champion: {
        id: 'champion',
        name: 'Champion',
        icon: '🏆',
        description: 'Finir 1er du classement',
        category: 'ranking',
        check: (stats) => stats.finalRank === 1
    },
    podium: {
        id: 'podium',
        name: 'Podium',
        icon: '🥈',
        description: 'Finir dans le top 3',
        category: 'ranking',
        check: (stats) => stats.finalRank <= 3
    },
    comeback: {
        id: 'comeback',
        name: 'Comeback',
        icon: '📈',
        description: 'Remonter de 5+ places au classement',
        category: 'ranking',
        check: (stats) => stats.biggestClimb >= 5
    },
    
    // Badges points
    century: {
        id: 'century',
        name: 'Centurion',
        icon: '💯',
        description: 'Atteindre 100 points',
        category: 'points',
        check: (stats) => stats.totalPoints >= 100
    },
    two_century: {
        id: 'two_century',
        name: 'Double Centurion',
        icon: '2️⃣',
        description: 'Atteindre 200 points',
        category: 'points',
        check: (stats) => stats.totalPoints >= 200
    },
    high_scorer: {
        id: 'high_scorer',
        name: 'Top Scorer',
        icon: '🎰',
        description: 'Marquer 30+ pts sur une journée',
        category: 'points',
        check: (stats) => stats.bestDayPoints >= 30
    }
};

// ===============================
// CALCUL DES BADGES
// ===============================

async function calculatePlayerBadges(playerId) {
    // Récupérer les stats détaillées
    const stats = await calculatePlayerDetailedStats(playerId);
    
    // Enrichir avec des stats supplémentaires pour les badges
    const enrichedStats = await enrichStatsForBadges(playerId, stats);
    
    // Contexte pour certains badges
    const context = {
        teamsCount: allTeams.length
    };
    
    // Vérifier chaque badge
    const earnedBadges = [];
    const availableBadges = [];
    
    for (const [badgeId, badge] of Object.entries(BADGES_DEFINITIONS)) {
        try {
            if (badge.check(enrichedStats, context)) {
                earnedBadges.push({
                    ...badge,
                    earnedAt: await getBadgeEarnedDate(playerId, badgeId)
                });
            } else {
                availableBadges.push(badge);
            }
        } catch (e) {
            console.error(`Erreur check badge ${badgeId}:`, e);
        }
    }
    
    return { earnedBadges, availableBadges, stats: enrichedStats };
}

async function enrichStatsForBadges(playerId, baseStats) {
    const stats = { ...baseStats };
    
    // Initialiser les compteurs manquants
    stats.upsetsPredicted = 0;
    stats.nilNilPredicted = 0;
    stats.highScoringPredicted = 0;
    stats.beatIA = 0;
    stats.beatLeader = 0;
    stats.perfectDays = 0;
    stats.bestDayPoints = 0;
    stats.biggestClimb = 0;
    stats.finalRank = null;
    
    try {
        const history = await getPlayerHistory(playerId);
        
        for (const entry of history) {
            const matchDay = entry.matchDay;
            const matchesThisDay = allMatches.filter(m => m.matchDay === matchDay);
            
            let dayPoints = 0;
            let dayCorrect = 0;
            let dayTotal = 0;
            
            for (const pred of entry.predictions) {
                const match = matchesThisDay.find(m => 
                    m.homeTeamId == pred.homeTeamId && m.awayTeamId == pred.awayTeamId
                );
                
                if (!match || !match.finalScore) continue;
                
                dayTotal++;
                
                const result = calculatePredictionResult(
                    pred.homeScore, pred.awayScore,
                    match.finalScore.home, match.finalScore.away,
                    pred.savedAt,
                    match
                );
                
                dayPoints += result.points;
                if (result.points > 0) dayCorrect++;
                
                // Vérifier les badges spéciaux
                
                // 0-0 prédit et correct
                if (pred.homeScore === 0 && pred.awayScore === 0 &&
                    match.finalScore.home === 0 && match.finalScore.away === 0) {
                    stats.nilNilPredicted++;
                }
                
                // Match 4+ buts prédit et correct
                if (pred.homeScore + pred.awayScore >= 4 &&
                    match.finalScore.home + match.finalScore.away >= 4 &&
                    result.points > 0) {
                    stats.highScoringPredicted++;
                }
                
                // TODO: Upset detection (nécessite les Elo au moment du match)
            }
            
            // Journée parfaite
            if (dayTotal > 0 && dayCorrect === dayTotal) {
                stats.perfectDays++;
            }
            
            // Meilleure journée
            stats.bestDayPoints = Math.max(stats.bestDayPoints, dayPoints);
            
            // Comparer avec l'IA
            const iaResults = await calculateIAResults(matchDay);
            if (iaResults && dayPoints > iaResults.totalPoints) {
                stats.beatIA++;
            }
            
            // Comparer avec le leader (TODO: implémenter)
        }
        
    } catch (error) {
        console.error('Erreur enrichStatsForBadges:', error);
    }
    
    return stats;
}

async function getBadgeEarnedDate(playerId, badgeId) {
    // TODO: Stocker les dates d'obtention dans Firebase
    // Pour l'instant, retourne null
    return null;
}

// ===============================
// STOCKAGE DES BADGES
// ===============================

async function savePlayerBadges(playerId, badges) {
    try {
        const badgeIds = badges.map(b => b.id);
        await db.collection('pronostiqueurs').doc(playerId).update({
            badges: badgeIds,
            badgesUpdatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erreur savePlayerBadges:', error);
    }
}

// ===============================
// AFFICHAGE DES BADGES
// ===============================

async function displayPlayerBadges(playerId, containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Chargement des badges...</div>';
    
    try {
        const { earnedBadges, availableBadges } = await calculatePlayerBadges(playerId);
        
        let html = `
            <div class="badges-section">
                <h4>🏅 Badges obtenus (${earnedBadges.length})</h4>
                <div class="badges-grid earned">
        `;
        
        if (earnedBadges.length === 0) {
            html += '<p class="no-badges">Aucun badge pour l\'instant</p>';
        } else {
            // Grouper par catégorie
            const categories = {
                progression: '📈 Progression',
                precision: '🎯 Précision',
                streak: '🔥 Séries',
                special: '⭐ Spéciaux',
                ranking: '🏆 Classement',
                points: '💯 Points'
            };
            
            for (const [catId, catName] of Object.entries(categories)) {
                const catBadges = earnedBadges.filter(b => b.category === catId);
                if (catBadges.length === 0) continue;
                
                html += `<div class="badge-category">
                    <span class="category-name">${catName}</span>
                    <div class="category-badges">`;
                
                catBadges.forEach(badge => {
                    html += `
                        <div class="badge-item earned ${badge.isNegative ? 'negative' : ''}" title="${badge.description}">
                            <span class="badge-icon">${badge.icon}</span>
                            <span class="badge-name">${badge.name}</span>
                        </div>
                    `;
                });
                
                html += `</div></div>`;
            }
        }
        
        html += `
                </div>
            </div>
        `;
        
        // Badges à débloquer
        const unlockedCount = availableBadges.length;
        if (unlockedCount > 0) {
            html += `
                <div class="badges-section locked-section">
                    <h4>🔒 À débloquer (${unlockedCount})</h4>
                    <div class="badges-grid locked">
            `;
            
            availableBadges.slice(0, 6).forEach(badge => {
                html += `
                    <div class="badge-item locked" title="${badge.description}">
                        <span class="badge-icon">🔒</span>
                        <span class="badge-name">${badge.name}</span>
                        <span class="badge-hint">${badge.description}</span>
                    </div>
                `;
            });
            
            if (unlockedCount > 6) {
                html += `<div class="more-badges">+${unlockedCount - 6} autres</div>`;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Erreur displayPlayerBadges:', error);
        container.innerHTML = '<p style="color:#e74c3c;">Erreur de chargement</p>';
    }
}

// Afficher les badges dans la modal stats
function addBadgesToStatsModal(earnedBadges) {
    let html = `
        <div class="stats-section">
            <h4>🏅 Badges</h4>
            <div class="badges-inline">
    `;
    
    if (earnedBadges.length === 0) {
        html += '<span class="no-badges">Aucun badge</span>';
    } else {
        earnedBadges.slice(0, 8).forEach(badge => {
            html += `
                <span class="badge-mini ${badge.isNegative ? 'negative' : ''}" title="${badge.name}: ${badge.description}">
                    ${badge.icon}
                </span>
            `;
        });
        
        if (earnedBadges.length > 8) {
            html += `<span class="badge-more">+${earnedBadges.length - 8}</span>`;
        }
    }
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

// ===============================
// NOTIFICATIONS NOUVEAU BADGE
// ===============================

function showBadgeNotification(badge) {
    // Créer la notification
    const notification = document.createElement('div');
    notification.className = 'badge-notification';
    notification.innerHTML = `
        <div class="badge-notification-content">
            <span class="badge-icon">${badge.icon}</span>
            <div class="badge-info">
                <span class="badge-title">Nouveau badge !</span>
                <span class="badge-name">${badge.name}</span>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animation
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

// Vérifier les nouveaux badges après sauvegarde
async function checkNewBadges(playerId, previousBadges = []) {
    const { earnedBadges } = await calculatePlayerBadges(playerId);
    
    const newBadges = earnedBadges.filter(b => 
        !previousBadges.find(pb => pb.id === b.id)
    );
    
    // Afficher les notifications
    newBadges.forEach((badge, index) => {
        setTimeout(() => showBadgeNotification(badge), index * 1000);
    });
    
    return newBadges;
}