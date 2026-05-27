import { stateManager } from './modules/stateManager.js';
import { mapController } from './modules/mapController.js';
import { uiController } from './modules/uiController.js';
import { editorController } from './modules/editorController.js';
import { geocodingUI } from './modules/geocodingUI.js';
import { api } from './utils/api.js';

/**
 * ASA v3 - Main Orchestrator
 * Inicializa os módulos e gerencia a integração de geocodificação.
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Carregamento de dados base
    const response = await fetch('./src/data/comunidades.geojson');
    const geojsonData = await response.json();
    
    // 2. Inicialização de módulos core
    stateManager.init(geojsonData);
    mapController.init('map', geojsonData);
    uiController.init();
    editorController.init();
    geocodingUI.init();

    // 3. Gerenciamento de Geocoding (Google + Fallbacks)
    const addressInput = document.getElementById('addressSearchInput');
    const searchBtn = document.getElementById('btnAddressSearch');
    const container = document.getElementById('searchResultsList');
    let debounceTimer;

    // Autocomplete em tempo real (Sugestões rápidas no painel customizado)
    addressInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = addressInput.value.trim();
      
      if (query.length < 3) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const url = `api/autocomplete?q=${encodeURIComponent(query)}`;
          const res = await api.get(url);
          const data = await res.json();
          
          container.innerHTML = '';
          
          if (data && data.length > 0) {
            container.style.display = 'block';
            
            data.forEach(item => {
              const div = document.createElement('div');
              div.className = 'search-result-item';
              
              const mainName = item.formattedAddress.split(',')[0];
              const secondary = item.formattedAddress.split(',').slice(1, 3).join(', ');
              
              div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                  <strong>${mainName}</strong>
                  <span class="provider-badge" style="font-size: 0.7em; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-weight: bold; color: var(--text-secondary); text-transform: uppercase;">${item.provider}</span>
                </div>
                <span style="font-size: 0.85em; opacity: 0.7;">${secondary}</span>
              `;
              
              div.onclick = () => {
                addressInput.value = item.formattedAddress;
                handleSearchResult(item);
                container.style.display = 'none';
              };
              
              container.appendChild(div);
            });

            // Adicionar evento para fechar a lista ao clicar fora
            const outsideClick = (e) => {
              if (!container.contains(e.target) && e.target !== addressInput) {
                container.style.display = 'none';
                document.removeEventListener('click', outsideClick);
              }
            };
            setTimeout(() => document.addEventListener('click', outsideClick), 100);

          } else {
            container.style.display = 'none';
          }
        } catch (err) {
          console.error('[Autocomplete Error]', err);
        }
      }, 250); // Delay curto e responsivo para feedback imediato
    });

    const performSearch = async () => {
      const query = addressInput.value.trim();
      if (!query) return;

      geocodingUI.setLoading(true);
      container.style.display = 'none';

      try {
        const res = await api.get(`api/geocode?q=${encodeURIComponent(query)}&limit=10`);
        const data = await res.json();

        if (data && data.length > 0) {
          // Se o primeiro resultado for de alta confiança (ex: Google Rooftop), vai direto
          if (data.length === 1 || data[0].confidence >= 0.95) {
            handleSearchResult(data[0]);
          } else {
            renderSearchResultsList(data);
          }
        } else {
          geocodingUI.showError('Endereço não localizado em Duque de Caxias.');
        }
      } catch (err) {
        geocodingUI.showError('Falha na comunicação com o serviço de mapas.');
      } finally {
        geocodingUI.setLoading(false);
      }
    };

    const renderSearchResultsList = (results) => {
      container.innerHTML = '';
      container.style.display = 'block';
      
      results.forEach(res => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const mainName = res.formattedAddress.split(',')[0];
        const secondary = res.formattedAddress.split(',').slice(1, 3).join(', ');
        
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <strong>${mainName}</strong>
            ${geocodingUI.renderBadge(res.provider, res.confidence)}
          </div>
          <span style="font-size: 0.85em; opacity: 0.7;">${secondary}</span>
        `;
        
        item.onclick = () => {
          handleSearchResult(res);
          container.style.display = 'none';
        };
        
        container.appendChild(item);
      });

      // Fechar lista ao clicar fora
      const outsideClick = (e) => {
        if (!container.contains(e.target) && e.target !== addressInput) {
          container.style.display = 'none';
          document.removeEventListener('click', outsideClick);
        }
      };
      setTimeout(() => document.addEventListener('click', outsideClick), 100);
    };

    const handleSearchResult = async (result) => {
      const lat = parseFloat(result.lat || result.y || result.latitude);
      const lng = parseFloat(result.lng || result.lon || result.x || result.longitude);
      const formattedAddress = result.formattedAddress || result.display_name || 'Endereço não identificado';

      if (isNaN(lat) || isNaN(lng)) {
        geocodingUI.showError('Erro ao processar localização geográfica.');
        return;
      }

      // Voa até o local imediatamente
      mapController.jumpTo(lat, lng);

      try {
        const masterResponse = await fetch('src/data/simac_master_db.json');
        const masterDb = await masterResponse.json();

        const turfPoint = turf.point([lng, lat]);

        // 1️⃣ Verifica se está DENTRO de uma comunidade
        const insideCommunity = masterDb.find(com => {
          try { return turf.booleanPointInPolygon(turfPoint, com.geometria); }
          catch (e) { return false; }
        });

        // 2️⃣ Verifica se está PERTO (buffer de 300m) — apenas se não estiver dentro
        let nearCommunity = null;
        if (!insideCommunity) {
          nearCommunity = masterDb.find(com => {
            try {
              const buffered = turf.buffer(com.geometria, 0.3, { units: 'kilometers' });
              return turf.booleanPointInPolygon(turfPoint, buffered);
            } catch (e) { return false; }
          });
        }

        // Barra de notificação
        const notificationBar = document.getElementById('searchNotification');
        const notificationText = document.getElementById('notificationText');
        const mainLabel = formattedAddress.split(',')[0] || formattedAddress;
        const approximatedBadge = result.isApproximated
          ? '<span class="badge-approx">APROXIMADO</span> '
          : '';

        let barClass, statusHtml, popupTag;

        if (insideCommunity) {
          // 🔴 DENTRO — vermelho
          barClass = 'inside';
          statusHtml = `${approximatedBadge}🔴 <strong>${mainLabel}</strong>
            <span class="notif-divider">|</span>
            Dentro de: <b>${insideCommunity.nome}</b>`;
          popupTag = `
            <div class="popup-status inside-status">
              <span class="popup-status-dot"></span>
              Área Comunitária: <strong>${insideCommunity.nome}</strong>
            </div>`;
        } else if (nearCommunity) {
          // 🟡 PERTO — amarelo
          barClass = 'near';
          statusHtml = `${approximatedBadge}🟡 <strong>${mainLabel}</strong>
            <span class="notif-divider">|</span>
            Próximo a: <b>${nearCommunity.nome}</b> <em>(~300m)</em>`;
          popupTag = `
            <div class="popup-status near-status">
              <span class="popup-status-dot"></span>
              Próximo a: <strong>${nearCommunity.nome}</strong>
            </div>`;
        } else {
          // 🟢 FORA — verde
          barClass = 'outside';
          statusHtml = `${approximatedBadge}🟢 <strong>${mainLabel}</strong>
            <span class="notif-divider">|</span>
            Fora das áreas mapeadas`;
          popupTag = `
            <div class="popup-status outside-status">
              <span class="popup-status-dot"></span>
              Sem área comunitária neste local
            </div>`;
        }

        notificationBar.className = `search-notification ${barClass}`;
        notificationText.innerHTML = statusHtml;
        notificationBar.style.display = 'flex';

        // Popup no mapa
        const secondaryLabel = formattedAddress.split(',').slice(1, 3).join(', ');
        L.popup({ className: 'enterprise-popup', maxWidth: 280 })
          .setLatLng([lat, lng])
          .setContent(`
            <div class="popup-content">
              ${result.isApproximated ? '<div class="badge-approx" style="margin-bottom:8px;">ENDEREÇO APROXIMADO</div>' : ''}
              <h3 style="margin:0 0 4px; font-size:0.95rem; color:var(--text-primary);">${mainLabel}</h3>
              ${secondaryLabel ? `<p style="margin:0 0 10px; font-size:0.8rem; color:var(--text-secondary);">${secondaryLabel}</p>` : ''}
              ${popupTag}
            </div>
          `)
          .openOn(mapController.map);

      } catch (err) {
        console.error('Erro ao verificar inteligência territorial:', err);
      }
    };

    // Eventos Globais
    searchBtn.addEventListener('click', performSearch);
    addressInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') performSearch();
    });


    // Fechar notificação de busca
    const btnCloseNotif = document.getElementById('btnCloseNotification');
    if (btnCloseNotif) {
      btnCloseNotif.addEventListener('click', () => {
        document.getElementById('searchNotification').style.display = 'none';
      });
    }

  } catch (error) {
    console.error('Falha crítica na inicialização:', error);
  }
});
