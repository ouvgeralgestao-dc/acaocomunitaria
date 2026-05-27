/**
 * ASA v3 - Geocoding UI Module
 * Gerencia a interface de busca, autocomplete e badges de precisão.
 */
export const geocodingUI = {
    elements: {},
    
    init() {
        this.elements = {
            input: document.getElementById('addressSearchInput'),
            btn: document.getElementById('btnAddressSearch'),
            suggestions: document.getElementById('addressSuggestions'),
            resultsList: document.getElementById('searchResultsList'),
            notification: document.getElementById('searchNotification')
        };
    },

    setLoading(isLoading) {
        if (isLoading) {
            this.elements.btn.innerHTML = '<span class="loader-small"></span>';
            this.elements.btn.disabled = true;
        } else {
            this.elements.btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
            this.elements.btn.disabled = false;
        }
    },

    renderBadge(provider, confidence) {
        // Removido conforme solicitado para uma interface mais direta e "limpa"
        return '';
    },

    showError(message) {
        const text = document.getElementById('notificationText');
        text.innerHTML = `⚠️ ${message}`;
        this.elements.notification.className = 'search-notification error';
        this.elements.notification.style.display = 'flex';
        setTimeout(() => this.elements.notification.style.display = 'none', 5000);
    }
};
