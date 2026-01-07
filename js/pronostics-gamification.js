// pronostics-gamification.js - Niveaux, Streaks, Missions

// ===============================
// SYSTÈME DE NIVEAUX
// ===============================

const PLAYER_LEVELS = [
    { name: 'Bronze', minPoints: 0, icon: '🥉', color: '#cd7f32', nextAt: 50 },
    { name: 'Argent', minPoints: 50, icon: '🥈', color: '#c0c0c0', nextAt: 150 },
    { name: 'Or', minPoints: 150, icon: '🥇', color: '#ffd700', nextAt: 300 },
    { name: 'Platine', minPoints: 300, icon: '💎', color: '#e5e4e2', nextAt: 500 },
    { name: 'Diamant', minPoints: 500, icon: '💠', color: '#b9f2ff', nextAt: 800 },
    { name: 'Maître', minPoints: 800, icon: '👑', color: '#ff6b6b', nextAt: 1200 },
    { name: 'Grand Maître', minPoints: 1200, icon: '🏆', color: '#9b59b6', nextAt: 2000 },
    { name: 'Légende', minPoints: 2000, icon: '⭐', color: '#f39c12', nextAt: null }
];

function getPlayerLevel(totalPoints) {
    let currentLevel = PLAYER_LEVELS[0];
    
    for (const level of PLAYER_LEVELS) {
        if (totalPoints >= level.minPoints) {
            currentLevel = level;
        } else {
            break;
        }
    }
    
    // Calculer la progression vers le niveau suivant
    const nextLevel = PLAYER_LEVELS[PLAYER_LEVELS.indexOf(currentLevel) + 1];
    let progress = 100;
    let pointsToNext = 0;
    
    if (nextLevel) {
        const pointsInLevel = totalPoints - currentLevel.minPoints;
        const pointsNeeded = nextLevel.minPoints - currentLevel.minPoints;
        progress = Math.min(100, Math.round((pointsInLevel / pointsNeeded) * 100));
        pointsToNext = nextLevel.minPoints - totalPoints;
    }
    
    return {
        ...currentLevel,
        progress: progress,
        pointsToNext: Math.round(pointsToNext * 10) / 10,
        nextLevel: nextLevel
    };
}

function renderPlayerLevelBadge(totalPoints, size = 'normal') {
    const level = getPlayerLevel(totalPoints);
    const sizeClass = size === 'small' ? 'level-badge-small' : '';
    
    return `
        <div class="level-badge ${sizeClass}" style="--level-color: ${level.color}">
            <span class="level-icon">${level.icon}</span>
            <span class="level-name">${level.name}</span>
        </div>
    `;
}

function renderPlayerLevelProgress(totalPoints) {
    const level = getPlayerLevel(totalPoints);
    
    if (!level.nextLevel) {
        return `
            <div class="level-progress-container">
                <div class="level-current">
                    ${level.icon} <strong>${level.name}</strong> - Niveau maximum atteint !
                </div>
            </div>
        `;
    }
    
    return `
        <div class="level-progress-container">
            <div class="level-header">
                <span class="level-current">${level.icon} ${level.name}</span>
                <span class="level-next">${level.nextLevel.icon} ${level.nextLevel.name}</span>
            </div>
            <div class="level-progress-bar">
                <div class="level-progress-fill" style="width: ${level.progress}%; background: ${level.color}"></div>
            </div>
            <div class="level-progress-text">
                ${level.pointsToNext} pts pour le prochain niveau
            </div>
        </div>
    `;
}

// ===============================
// STREAK REWARDS
// ===============================

const STREAK_BONUSES = [
    { streak: 3, bonus: 0.1, name: 'En forme', icon: '🔥' },
    { streak: 5, bonus: 0.15, name: 'En feu', icon: '🔥🔥' },
    { streak: 7, bonus: 0.2, name: 'Inarrêtable', icon: '🔥🔥🔥' },
    { streak: 10, bonus: 0.25, name: 'Légendaire', icon: '⚡' },
    { streak: 15, bonus: 0.3, name: 'Divin', icon: '👑' }
];

function getStreakBonus(currentStreak) {
    let bonus = { streak: 0, bonus: 0, name: null, icon: null };
    
    for (const b of STREAK_BONUSES) {
        if (currentStreak >= b.streak) {
            bonus = b;
        } else {
            break;
        }
    }
    
    return bonus;
}

function calculateStreakFromHistory(predictions, matches) {
    let streak = 0;
    let streakType = null; // 'good' ou 'bad'
    
    // Trier les prédictions par date (plus récent d'abord)
    const sortedPreds = [...predictions].sort((a, b) => {
        const dateA = a.savedAt ? new Date(a.savedAt) : new Date(0);
        const dateB = b.savedAt ? new Date(b.savedAt) : new Date(0);
        return dateB - dateA;
    });
    
    for (const pred of sortedPreds) {
        const match = matches.find(m => 
            m.homeTeamId == pred.homeTeamId && 
            m.awayTeamId == pred.awayTeamId &&
            m.finalScore
        );
        
        if (!match) continue;
        
        const result = calculatePredictionResult(
            pred.homeScore, pred.awayScore,
            match.finalScore.home, match.finalScore.away,
            pred.savedAt, match, pred.odds
        );
        
        const isGood = result.points > 0;
        
        if (streakType === null) {
            streakType = isGood ? 'good' : 'bad';
            streak = 1;
        } else if ((isGood && streakType === 'good') || (!isGood && streakType === 'bad')) {
            streak++;
        } else {
            break;
        }
    }
    
    return { streak, type: streakType };
}

function renderStreakBadge(currentStreak, streakType) {
    if (streakType !== 'good' || currentStreak < 3) {
        return '';
    }
    
    const bonus = getStreakBonus(currentStreak);
    
    if (!bonus.name) return '';
    
    return `
        <div class="streak-badge">
            <span class="streak-icon">${bonus.icon}</span>
            <span class="streak-text">${bonus.name}</span>
            <span class="streak-count">${currentStreak} de suite</span>
            <span class="streak-bonus">+${Math.round(bonus.bonus * 100)}% pts</span>
        </div>
    `;
}

// ===============================
// MISSIONS HEBDO
// ===============================

const WEEKLY_MISSIONS = [
    {
        id: 'exact_score',
        name: 'Sniper',
        description: 'Trouve 2 scores exacts cette semaine',
        icon: '🎯',
        target: 2,
        type: 'exactScores',
        reward: 10
    },
    {
        id: 'no_miss',
        name: 'Sans faute',
        description: 'Aucun mauvais résultat sur une journée',
        icon: '✨',
        target: 1,
        type: 'perfectDay',
        reward: 15
    },
    {
        id: 'streak_3',
        name: 'En série',
        description: 'Atteins une série de 3 bons pronos',
        icon: '🔥',
        target: 3,
        type: 'streak',
        reward: 8
    },
    {
        id: 'predict_all',
        name: 'Complet',
        description: 'Pronostique tous les matchs d\'une journée',
        icon: '📋',
        target: 1,
        type: 'fullDay',
        reward: 5
    },
    {
        id: 'upset',
        name: 'Visionnaire',
        description: 'Prédis correctement un upset (victoire extérieure)',
        icon: '🔮',
        target: 1,
        type: 'upset',
        reward: 12
    },
    {
        id: 'high_score',
        name: 'Jackpot',
        description: 'Marque 40+ points sur une journée',
        icon: '💰',
        target: 40,
        type: 'dayPoints',
        reward: 20
    }
];

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeeklyMissions(weekNumber) {
    // Sélectionner 3 missions pour cette semaine (pseudo-aléatoire basé sur la semaine)
    const shuffled = [...WEEKLY_MISSIONS].sort((a, b) => {
        const hashA = (weekNumber * 31 + a.id.charCodeAt(0)) % 100;
        const hashB = (weekNumber * 31 + b.id.charCodeAt(0)) % 100;
        return hashA - hashB;
    });
    
    return shuffled.slice(0, 3);
}

async function getPlayerMissionProgress(playerId) {
    const currentWeek = getWeekNumber(new Date());
    const missions = getWeeklyMissions(currentWeek);
    
    // Charger les données de progression
    const storageKey = `footballEloMissions_${playerId}_${currentWeek}`;
    let savedProgress = {};
    
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            savedProgress = JSON.parse(stored);
        }
    } catch (e) {}
    
    // Calculer la progression actuelle
    const stats = await calculatePlayerDetailedStats(playerId);
    
    const progress = missions.map(mission => {
        let current = 0;
        let completed = savedProgress[mission.id]?.completed || false;
        
        switch (mission.type) {
            case 'exactScores':
                // Compter les scores exacts de la semaine
                current = stats.exactScores || 0;
                break;
            case 'streak':
                current = stats.currentStreakType === 'good' ? stats.currentStreak : 0;
                break;
            case 'dayPoints':
                // Meilleure journée
                const maxDay = Math.max(...Object.values(stats.pointsByMatchDay || {}), 0);
                current = maxDay;
                break;
            case 'perfectDay':
            case 'fullDay':
            case 'upset':
                // Ces missions nécessitent un suivi spécifique
                current = savedProgress[mission.id]?.current || 0;
                break;
        }
        
        if (current >= mission.target && !completed) {
            completed = true;
            // Sauvegarder la complétion
            savedProgress[mission.id] = { current, completed, completedAt: new Date().toISOString() };
            localStorage.setItem(storageKey, JSON.stringify(savedProgress));
        }
        
        return {
            ...mission,
            current: Math.min(current, mission.target),
            completed: completed,
            progress: Math.min(100, Math.round((current / mission.target) * 100))
        };
    });
    
    return progress;
}

async function renderWeeklyMissions(playerId) {
    const missions = await getPlayerMissionProgress(playerId);
    const completedCount = missions.filter(m => m.completed).length;
    const totalReward = missions.reduce((sum, m) => sum + (m.completed ? m.reward : 0), 0);
    
    return `
        <div class="weekly-missions">
            <div class="missions-header">
                <h4>🎯 Missions de la semaine</h4>
                <div class="missions-summary">
                    <span class="missions-count">${completedCount}/${missions.length}</span>
                    <span class="missions-reward">+${totalReward} pts bonus</span>
                </div>
            </div>
            <div class="missions-list">
                ${missions.map(mission => `
                    <div class="mission-card ${mission.completed ? 'completed' : ''}">
                        <div class="mission-icon">${mission.icon}</div>
                        <div class="mission-info">
                            <div class="mission-name">${mission.name}</div>
                            <div class="mission-desc">${mission.description}</div>
                            <div class="mission-progress-bar">
                                <div class="mission-progress-fill" style="width: ${mission.progress}%"></div>
                            </div>
                            <div class="mission-progress-text">${mission.current}/${mission.target}</div>
                        </div>
                        <div class="mission-reward">
                            ${mission.completed ? '✅' : `+${mission.reward}`}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ===============================
// WIDGET GAMIFICATION (pour le header joueur)
// ===============================

async function renderGamificationWidget(playerId, totalPoints, streakInfo) {
    const level = getPlayerLevel(totalPoints);
    const missions = await getPlayerMissionProgress(playerId);
    const completedMissions = missions.filter(m => m.completed).length;
    
    return `
        <div class="gamification-widget">
            <div class="widget-level" title="${level.name} - ${level.progress}% vers ${level.nextLevel?.name || 'Max'}">
                ${level.icon}
            </div>
            ${streakInfo.type === 'good' && streakInfo.streak >= 3 ? `
                <div class="widget-streak" title="Série de ${streakInfo.streak}">
                    🔥${streakInfo.streak}
                </div>
            ` : ''}
            <div class="widget-missions" title="${completedMissions}/3 missions">
                🎯${completedMissions}/3
            </div>
        </div>
    `;
}

// ===============================
// INTÉGRATION DANS LA MODAL STATS
// ===============================

function addGamificationToStatsModal(stats) {
    const level = getPlayerLevel(stats.totalPoints);
    const streakBonus = getStreakBonus(stats.currentStreak);
    
    let html = `
        <div class="stats-section gamification-section">
            <h4>🎮 Progression</h4>
            
            <div class="level-display">
                <div class="level-badge-large" style="--level-color: ${level.color}">
                    <span class="level-icon">${level.icon}</span>
                    <span class="level-name">${level.name}</span>
                </div>
                ${renderPlayerLevelProgress(stats.totalPoints)}
            </div>
    `;
    
    if (stats.currentStreakType === 'good' && stats.currentStreak >= 3) {
        html += `
            <div class="streak-display">
                <div class="streak-badge-large">
                    <span class="streak-flames">${streakBonus.icon || '🔥'}</span>
                    <span class="streak-info">
                        <strong>${streakBonus.name || 'En forme'}</strong>
                        <span>${stats.currentStreak} bons pronos de suite</span>
                    </span>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    
    return html;
}

console.log('🎮 Module pronostics-gamification chargé');