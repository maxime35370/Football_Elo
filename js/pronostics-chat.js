// pronostics-chat.js - Système de discussions entre pronostiqueurs
// Canaux par journée + canaux par match
// Réponses en thread, réactions emoji, suppression de ses propres messages

// ===============================
// VARIABLES
// ===============================
let chatCurrentChannel = null;      // Canal actif (ex: "matchDay_21" ou "match_RCL-SRFC_21")
let chatMessages = [];              // Messages du canal actif
let chatChannelType = 'matchDay';   // 'matchDay' ou 'match'
let chatSelectedMatchDay = null;    // Journée sélectionnée pour le chat
let chatReplyingTo = null;          // Message auquel on répond (thread)

// Emojis disponibles pour les réactions
const CHAT_REACTIONS = ['👍', '🔥', '😂', '😮', '💪', '🤡'];

// ===============================
// INITIALISATION
// ===============================

function initChatTab() {
    chatSelectedMatchDay = selectedMatchDay || 1;
    renderChatTab();
}

// ===============================
// RENDU PRINCIPAL
// ===============================

function renderChatTab() {
    const container = document.getElementById('chatTab');
    if (!container) return;

    // Déterminer les journées disponibles
    const maxMatchDay = Math.max(
        ...allMatches.map(m => m.matchDay || 0),
        ...(typeof futureMatches !== 'undefined' && futureMatches.length > 0 
            ? futureMatches.map(m => m.matchDay || 0) 
            : [0])
    );

    let matchDayOptions = '';
    for (let i = 1; i <= maxMatchDay; i++) {
        matchDayOptions += `<option value="${i}" ${i === chatSelectedMatchDay ? 'selected' : ''}>Journée ${i}</option>`;
    }

    // Récupérer les matchs de la journée sélectionnée
    const matchesForDay = getMatchesForChatDay(chatSelectedMatchDay);

    let matchButtons = matchesForDay.map(m => {
        const homeTeam = allTeams.find(t => t.id == m.homeTeamId);
        const awayTeam = allTeams.find(t => t.id == m.awayTeamId);
        const channelId = `match_${m.homeTeamId}-${m.awayTeamId}_${m.matchDay}`;
        const isActive = chatCurrentChannel === channelId;
        
        let scoreText = '';
        if (m.finalScore) {
            scoreText = `<span class="chat-match-score">${m.finalScore.home}-${m.finalScore.away}</span>`;
        }

        return `
            <button class="chat-channel-btn chat-match-btn ${isActive ? 'active' : ''}" 
                    onclick="switchChatChannel('match', '${channelId}')">
                <span class="chat-match-teams">${homeTeam?.shortName || '?'} - ${awayTeam?.shortName || '?'}</span>
                ${scoreText}
            </button>
        `;
    }).join('');

    const dayChannelId = `matchDay_${chatSelectedMatchDay}`;
    const isDayActive = chatCurrentChannel === dayChannelId;

    container.innerHTML = `
        <div class="chat-container">
            <!-- Header du chat -->
            <div class="chat-header">
                <div class="chat-header-left">
                    <h3>💬 Discussions</h3>
                    <select id="chatMatchDaySelect" onchange="onChatMatchDayChange(this.value)">
                        ${matchDayOptions}
                    </select>
                </div>
                <button class="btn btn-small btn-secondary" onclick="refreshChat()">🔄 Rafraîchir</button>
            </div>

            <!-- Sélecteur de canaux -->
            <div class="chat-channels">
                <button class="chat-channel-btn chat-day-btn ${isDayActive ? 'active' : ''}" 
                        onclick="switchChatChannel('matchDay', '${dayChannelId}')">
                    💬 Fil de la Journée ${chatSelectedMatchDay}
                </button>
                <div class="chat-channels-matches">
                    ${matchButtons || '<span class="chat-no-matches">Aucun match pour cette journée</span>'}
                </div>
            </div>

            <!-- Zone de messages -->
            <div class="chat-messages-container">
                ${chatCurrentChannel 
                    ? '<div class="chat-messages" id="chatMessages"><div class="chat-loading">Sélectionnez un canal ci-dessus</div></div>'
                    : '<div class="chat-messages" id="chatMessages"><div class="chat-placeholder">👆 Choisissez un canal pour voir les discussions</div></div>'
                }
            </div>

            <!-- Zone de réponse (thread) -->
            <div class="chat-reply-banner" id="chatReplyBanner" style="display: none;">
                <span class="chat-reply-text" id="chatReplyText"></span>
                <button class="chat-reply-cancel" onclick="cancelReply()">✕</button>
            </div>

            <!-- Zone de saisie -->
            <div class="chat-input-area">
                <div class="chat-input-wrapper">
                    <textarea id="chatInput" 
                              placeholder="${chatCurrentChannel ? 'Écris ton message...' : 'Sélectionne un canal d\'abord'}"
                              rows="1" 
                              maxlength="500"
                              ${!chatCurrentChannel ? 'disabled' : ''}
                              onkeydown="handleChatKeydown(event)"
                              oninput="autoResizeChatInput(this)"></textarea>
                    <button class="chat-send-btn" onclick="sendChatMessage()" ${!chatCurrentChannel ? 'disabled' : ''}>
                        ➤
                    </button>
                </div>
                <div class="chat-input-info">
                    <span id="chatCharCount">0/500</span>
                </div>
            </div>
        </div>
    `;

    // Charger les messages si un canal est actif
    if (chatCurrentChannel) {
        loadChatMessages(chatCurrentChannel);
    }

    // Compteur de caractères
    const input = document.getElementById('chatInput');
    if (input) {
        input.addEventListener('input', () => {
            const count = input.value.length;
            document.getElementById('chatCharCount').textContent = `${count}/500`;
        });
    }
}

// ===============================
// GESTION DES CANAUX
// ===============================

function onChatMatchDayChange(value) {
    chatSelectedMatchDay = parseInt(value);
    chatCurrentChannel = null;
    chatMessages = [];
    chatReplyingTo = null;
    renderChatTab();
}

function switchChatChannel(type, channelId) {
    chatChannelType = type;
    chatCurrentChannel = channelId;
    chatReplyingTo = null;
    
    // Mettre à jour visuellement les boutons
    document.querySelectorAll('.chat-channel-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Activer la zone de saisie
    const input = document.getElementById('chatInput');
    const sendBtn = document.querySelector('.chat-send-btn');
    if (input) {
        input.disabled = false;
        input.placeholder = 'Écris ton message...';
    }
    if (sendBtn) sendBtn.disabled = false;
    
    // Charger les messages
    loadChatMessages(channelId);
}

function getMatchesForChatDay(matchDay) {
    // Chercher dans les matchs joués ET les futurs matchs
    const played = allMatches.filter(m => m.matchDay == matchDay);
    const future = (typeof futureMatches !== 'undefined' ? futureMatches : [])
        .filter(m => m.matchDay == matchDay);
    
    // Fusionner en évitant les doublons
    const all = [...played];
    future.forEach(fm => {
        const exists = played.some(pm => 
            pm.homeTeamId == fm.homeTeamId && pm.awayTeamId == fm.awayTeamId
        );
        if (!exists) all.push(fm);
    });
    
    return all;
}

// ===============================
// CHARGEMENT DES MESSAGES (Firebase)
// ===============================

async function loadChatMessages(channelId) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    container.innerHTML = '<div class="chat-loading">⏳ Chargement...</div>';
    
    try {
        const snapshot = await db.collection('chat_messages')
            .where('channelId', '==', channelId)
            .orderBy('timestamp', 'asc')
            .get();
        
        chatMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderChatMessages();
    } catch (error) {
        console.error('Erreur chargement chat:', error);
        
        // Si l'index n'existe pas encore
        if (error.code === 'failed-precondition') {
            container.innerHTML = `
                <div class="chat-error">
                    ⚠️ Index Firebase requis.<br>
                    <small>Créez un index composite sur <code>chat_messages</code> : 
                    <strong>channelId (asc) + timestamp (asc)</strong></small>
                </div>
            `;
        } else {
            container.innerHTML = '<div class="chat-error">❌ Erreur de chargement</div>';
        }
    }
}

function refreshChat() {
    if (chatCurrentChannel) {
        loadChatMessages(chatCurrentChannel);
    }
}

// ===============================
// RENDU DES MESSAGES
// ===============================

function renderChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (chatMessages.length === 0) {
        container.innerHTML = `
            <div class="chat-placeholder">
                🏟️ Aucun message pour l'instant.<br>
                <small>Sois le premier à lancer la discussion !</small>
            </div>
        `;
        return;
    }
    
    // Séparer les messages principaux des réponses (threads)
    const mainMessages = chatMessages.filter(m => !m.replyTo);
    const replies = chatMessages.filter(m => m.replyTo);
    
    // Grouper les réponses par message parent
    const repliesByParent = {};
    replies.forEach(r => {
        if (!repliesByParent[r.replyTo]) repliesByParent[r.replyTo] = [];
        repliesByParent[r.replyTo].push(r);
    });
    
    let html = mainMessages.map(msg => {
        const msgReplies = repliesByParent[msg.id] || [];
        return renderSingleMessage(msg, msgReplies);
    }).join('');
    
    container.innerHTML = html;
    
    // Scroll en bas
    container.scrollTop = container.scrollHeight;
}

function renderSingleMessage(msg, replies = []) {
    const isOwnMessage = currentPlayer && msg.playerId === currentPlayer.id;
    const timeStr = formatChatTime(msg.timestamp);
    
    // Réactions
    const reactions = msg.reactions || {};
    let reactionsHtml = '';
    
    // Compter les réactions par emoji
    const reactionCounts = {};
    Object.entries(reactions).forEach(([userId, emoji]) => {
        if (!reactionCounts[emoji]) reactionCounts[emoji] = { count: 0, users: [] };
        reactionCounts[emoji].count++;
        reactionCounts[emoji].users.push(userId);
    });
    
    if (Object.keys(reactionCounts).length > 0) {
        reactionsHtml = '<div class="chat-reactions">';
        Object.entries(reactionCounts).forEach(([emoji, data]) => {
            const hasReacted = currentPlayer && data.users.includes(currentPlayer.id);
            reactionsHtml += `
                <span class="chat-reaction ${hasReacted ? 'own-reaction' : ''}" 
                      onclick="toggleReaction('${msg.id}', '${emoji}')"
                      title="${data.users.join(', ')}">
                    ${emoji} ${data.count}
                </span>
            `;
        });
        reactionsHtml += '</div>';
    }
    
    // Réponses (thread)
    let repliesHtml = '';
    if (replies.length > 0) {
        repliesHtml = `
            <div class="chat-thread">
                <div class="chat-thread-line"></div>
                <div class="chat-thread-messages">
                    ${replies.map(r => renderReplyMessage(r)).join('')}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="chat-message ${isOwnMessage ? 'own-message' : ''}" id="msg-${msg.id}">
            <div class="chat-message-header">
                <span class="chat-message-avatar">${msg.avatar || '👤'}</span>
                <span class="chat-message-author">${msg.username}</span>
                <span class="chat-message-time">${timeStr}</span>
                <div class="chat-message-actions">
                    <button class="chat-action-btn" onclick="showReactionPicker('${msg.id}')" title="Réagir">😀</button>
                    <button class="chat-action-btn" onclick="replyToMessage('${msg.id}', '${escapeHtml(msg.username)}')" title="Répondre">↩️</button>
                    ${isOwnMessage ? `<button class="chat-action-btn chat-delete-btn" onclick="deleteChatMessage('${msg.id}')" title="Supprimer">🗑️</button>` : ''}
                </div>
            </div>
            <div class="chat-message-body">${escapeHtml(msg.text)}</div>
            ${reactionsHtml}
            
            <!-- Picker de réactions (caché par défaut) -->
            <div class="chat-reaction-picker" id="picker-${msg.id}" style="display: none;">
                ${CHAT_REACTIONS.map(emoji => `
                    <button class="chat-reaction-option" onclick="toggleReaction('${msg.id}', '${emoji}')">${emoji}</button>
                `).join('')}
            </div>
            
            ${repliesHtml}
        </div>
    `;
}

function renderReplyMessage(msg) {
    const isOwnMessage = currentPlayer && msg.playerId === currentPlayer.id;
    const timeStr = formatChatTime(msg.timestamp);
    
    return `
        <div class="chat-reply-message ${isOwnMessage ? 'own-message' : ''}" id="msg-${msg.id}">
            <div class="chat-message-header">
                <span class="chat-message-avatar small">${msg.avatar || '👤'}</span>
                <span class="chat-message-author">${msg.username}</span>
                <span class="chat-message-time">${timeStr}</span>
                ${isOwnMessage ? `<button class="chat-action-btn chat-delete-btn" onclick="deleteChatMessage('${msg.id}')" title="Supprimer">🗑️</button>` : ''}
            </div>
            <div class="chat-message-body">${escapeHtml(msg.text)}</div>
        </div>
    `;
}

// ===============================
// ENVOI DE MESSAGE
// ===============================

async function sendChatMessage() {
    if (!currentPlayer || !chatCurrentChannel) return;
    
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    
    if (!text || text.length === 0) return;
    if (text.length > 500) {
        alert('Message trop long (500 caractères max)');
        return;
    }
    
    // Désactiver le bouton pendant l'envoi
    const sendBtn = document.querySelector('.chat-send-btn');
    sendBtn.disabled = true;
    sendBtn.textContent = '⏳';
    
    try {
        const messageData = {
            channelId: chatCurrentChannel,
            playerId: currentPlayer.id,
            username: currentPlayer.pseudo,
            avatar: currentPlayer.avatar || '👤',
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            reactions: {},
            replyTo: chatReplyingTo || null
        };
        
        await db.collection('chat_messages').add(messageData);
        
        // Vider le champ et le reply
        input.value = '';
        input.style.height = 'auto';
        document.getElementById('chatCharCount').textContent = '0/500';
        cancelReply();
        
        // Recharger les messages
        await loadChatMessages(chatCurrentChannel);
        
    } catch (error) {
        console.error('Erreur envoi message:', error);
        alert('Erreur lors de l\'envoi du message');
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = '➤';
    }
}

// ===============================
// RÉPONSES (THREADS)
// ===============================

function replyToMessage(messageId, username) {
    chatReplyingTo = messageId;
    
    const banner = document.getElementById('chatReplyBanner');
    const replyText = document.getElementById('chatReplyText');
    
    if (banner && replyText) {
        replyText.textContent = `↩️ En réponse à ${username}`;
        banner.style.display = 'flex';
    }
    
    // Focus sur l'input
    const input = document.getElementById('chatInput');
    if (input) input.focus();
}

function cancelReply() {
    chatReplyingTo = null;
    const banner = document.getElementById('chatReplyBanner');
    if (banner) banner.style.display = 'none';
}

// ===============================
// RÉACTIONS EMOJI
// ===============================

function showReactionPicker(messageId) {
    // Fermer tous les pickers
    document.querySelectorAll('.chat-reaction-picker').forEach(p => p.style.display = 'none');
    
    // Ouvrir celui-ci
    const picker = document.getElementById(`picker-${messageId}`);
    if (picker) {
        picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
    }
}

async function toggleReaction(messageId, emoji) {
    if (!currentPlayer) return;
    
    const userId = currentPlayer.id;
    
    try {
        const docRef = db.collection('chat_messages').doc(messageId);
        const doc = await docRef.get();
        
        if (!doc.exists) return;
        
        const reactions = doc.data().reactions || {};
        
        // Si l'utilisateur a déjà cette réaction → retirer
        if (reactions[userId] === emoji) {
            delete reactions[userId];
        } else {
            // Ajouter/changer la réaction
            reactions[userId] = emoji;
        }
        
        await docRef.update({ reactions });
        
        // Fermer le picker
        const picker = document.getElementById(`picker-${messageId}`);
        if (picker) picker.style.display = 'none';
        
        // Recharger les messages
        await loadChatMessages(chatCurrentChannel);
        
    } catch (error) {
        console.error('Erreur réaction:', error);
    }
}

// ===============================
// SUPPRESSION DE MESSAGE
// ===============================

async function deleteChatMessage(messageId) {
    if (!currentPlayer) return;
    
    if (!confirm('Supprimer ce message ?')) return;
    
    try {
        const docRef = db.collection('chat_messages').doc(messageId);
        const doc = await docRef.get();
        
        if (!doc.exists) return;
        
        // Vérifier que c'est bien le message de l'utilisateur
        if (doc.data().playerId !== currentPlayer.id) {
            alert('Tu ne peux supprimer que tes propres messages');
            return;
        }
        
        // Supprimer aussi les réponses à ce message
        const repliesSnapshot = await db.collection('chat_messages')
            .where('replyTo', '==', messageId)
            .get();
        
        const batch = db.batch();
        batch.delete(docRef);
        repliesSnapshot.docs.forEach(replyDoc => {
            batch.delete(replyDoc.ref);
        });
        
        await batch.commit();
        
        // Recharger
        await loadChatMessages(chatCurrentChannel);
        
    } catch (error) {
        console.error('Erreur suppression:', error);
        alert('Erreur lors de la suppression');
    }
}

// ===============================
// UTILITAIRES
// ===============================

function handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

function autoResizeChatInput(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function formatChatTime(timestamp) {
    if (!timestamp) return '';
    
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "à l'instant";
    if (diffMins < 60) return `il y a ${diffMins}min`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fermer les pickers en cliquant ailleurs
document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-reaction-picker') && !e.target.closest('.chat-action-btn')) {
        document.querySelectorAll('.chat-reaction-picker').forEach(p => p.style.display = 'none');
    }
});

console.log('💬 Module Chat pronostics chargé');