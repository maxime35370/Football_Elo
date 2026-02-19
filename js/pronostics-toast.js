// =====================================================
// 🔔 TOAST NOTIFICATIONS
// pronostics-toast.js
// Remplace les alert() par des toasts élégants
// Charger TÔT (avant les autres modules qui utilisent alert)
// =====================================================

// ===============================
// 1. SYSTÈME DE TOAST
// ===============================

const TOAST_CONFIG = {
    duration: 3000,        // 3 secondes par défaut
    longDuration: 5000,    // 5 secondes pour les messages importants
    maxToasts: 3,          // Max 3 toasts simultanés
    position: 'bottom'     // bottom ou top
};

const _toastQueue = [];
let _toastContainer = null;

/**
 * Affiche un toast
 * @param {string} message - Le message
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Durée en ms (optionnel)
 */
function showToast(message, type = 'info', duration) {
    if (!_toastContainer) _createToastContainer();
    
    duration = duration || (type === 'error' ? TOAST_CONFIG.longDuration : TOAST_CONFIG.duration);
    
    // Limiter le nombre de toasts
    const existing = _toastContainer.querySelectorAll('.toast-item');
    if (existing.length >= TOAST_CONFIG.maxToasts) {
        existing[0].remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const icon = icons[type] || icons.info;
    
    // Nettoyer le message (retirer les emojis en double si déjà présents)
    let cleanMessage = message;
    Object.values(icons).forEach(i => {
        if (cleanMessage.startsWith(i + ' ')) {
            cleanMessage = cleanMessage.slice(i.length + 1);
        }
    });
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${cleanMessage}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    _toastContainer.appendChild(toast);
    
    // Animation d'entrée
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });
    
    // Auto-remove
    const timer = setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, duration);
    
    // Clic pour fermer immédiatement
    toast.addEventListener('click', () => {
        clearTimeout(timer);
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    });
    
    return toast;
}

// Raccourcis
function toastSuccess(msg, duration) { return showToast(msg, 'success', duration); }
function toastError(msg, duration) { return showToast(msg, 'error', duration); }
function toastWarning(msg, duration) { return showToast(msg, 'warning', duration); }
function toastInfo(msg, duration) { return showToast(msg, 'info', duration); }

/**
 * Crée le conteneur de toasts
 */
function _createToastContainer() {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toastContainer';
    _toastContainer.className = 'toast-container';
    document.body.appendChild(_toastContainer);
}


// ===============================
// 2. OVERRIDE alert()
// ===============================

const _originalAlert = window.alert;

window.alert = function(message) {
    if (typeof message !== 'string') {
        message = String(message);
    }
    
    // Détecter le type selon le contenu
    let type = 'info';
    if (message.includes('✅') || message.includes('sauvegardé') || message.includes('success')) {
        type = 'success';
    } else if (message.includes('❌') || message.includes('Erreur') || message.includes('erreur')) {
        type = 'error';
    } else if (message.includes('⚠️') || message.includes('attention') || message.includes('Remplis')) {
        type = 'warning';
    }
    
    showToast(message, type);
};


// ===============================
// 3. CSS
// ===============================

(function injectToastCSS() {
    const style = document.createElement('style');
    style.textContent = `
        .toast-container {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            display: flex;
            flex-direction: column-reverse;
            gap: 8px;
            pointer-events: none;
            max-width: 90vw;
            width: 400px;
        }
        
        .toast-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            pointer-events: all;
            cursor: pointer;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            backdrop-filter: blur(10px);
        }
        
        .toast-item.toast-visible {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        
        .toast-item.toast-exit {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
            transition: all 0.25s ease;
        }
        
        .toast-icon {
            font-size: 1.1rem;
            flex-shrink: 0;
        }
        
        .toast-message {
            flex: 1;
            line-height: 1.3;
        }
        
        .toast-close {
            background: none;
            border: none;
            color: inherit;
            opacity: 0.5;
            font-size: 1.2rem;
            cursor: pointer;
            padding: 0 4px;
            flex-shrink: 0;
        }
        
        .toast-close:hover {
            opacity: 1;
        }
        
        /* Types */
        .toast-success {
            background: linear-gradient(135deg, #d4edda, #c3e6cb);
            color: #155724;
            border: 1px solid #b1dfbb;
        }
        
        .toast-error {
            background: linear-gradient(135deg, #f8d7da, #f5c6cb);
            color: #721c24;
            border: 1px solid #f1b0b7;
        }
        
        .toast-warning {
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            color: #856404;
            border: 1px solid #ffc107;
        }
        
        .toast-info {
            background: linear-gradient(135deg, #d1ecf1, #bee5eb);
            color: #0c5460;
            border: 1px solid #abdde5;
        }
        
        /* Mobile */
        @media (max-width: 600px) {
            .toast-container {
                bottom: 10px;
                width: calc(100vw - 20px);
            }
            
            .toast-item {
                font-size: 0.85rem;
                padding: 10px 14px;
            }
        }
    `;
    document.head.appendChild(style);
})();

console.log('🔔 Module toast chargé — alert() remplacé');