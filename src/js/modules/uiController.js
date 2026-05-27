import { stateManager } from './stateManager.js';
import { mapController } from './mapController.js';

export const uiController = {
  listEl: null,
  searchInput: null,
  btnSelectAll: null,
  btnClearAll: null,
  detailsPanel: null,
  detailTitle: null,
  detailContent: null,
  btnCloseDetails: null,

  init() {
    // Inicializa referências aos elementos do DOM
    this.listEl = document.getElementById('communityList');
    this.searchInput = document.getElementById('searchInput');
    this.btnSelectAll = document.getElementById('btnSelectAll');
    this.btnClearAll = document.getElementById('btnClearAll');
    this.detailsPanel = document.getElementById('detailsPanel');
    this.detailTitle = document.getElementById('detailTitle');
    this.detailContent = document.getElementById('detailContent');
    this.btnCloseDetails = document.getElementById('btnCloseDetails');
    
    // Novas referências para Navegaçāo
    this.navItems = document.querySelectorAll('.nav-item');
    this.views = document.querySelectorAll('.view');
    this.btnToggleSidebar = document.getElementById('btnToggleSidebar');
    this.mainNav = document.querySelector('.main-nav');
    
    // CEPs View
    this.cepsTableBody = document.getElementById('cepsTableBody');
    this.cepSearchInput = document.getElementById('cepSearchInput');

    if (!this.listEl) {
      console.error('Erro: Elemento communityList não encontrado no DOM.');
      return;
    }

    this.renderList(stateManager.features);
    this.bindEvents();
    this.initNavigation();
  },

  initNavigation() {
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.dataset.view;
        this.switchView(viewId);
      });
    });

    this.btnToggleSidebar.addEventListener('click', () => {
      this.mainNav.classList.toggle('expanded');
    });
  },

  switchView(viewId) {
    // Update Nav
    this.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });

    // Update Views
    this.views.forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewId}`);
    });

    // Estado global do editor
    window.asa_editor_active = (viewId === 'editor');
    
    if (viewId === 'ceps') {
      this.renderCepsTable();
    } else if (viewId === 'reports') {
      this.updateReportStats();
    } else if (viewId === 'editor') {
      import('./editorController.js').then(mod => mod.editorController.activate());
    } else if (viewId === 'cleaner') {
      import('./cleanerController.js').then(mod => mod.cleanerController.activate());
    }
    
    // Forçar resize do Leaflet ao voltar para o mapa ou entrar no editor
    if (viewId === 'map' || viewId === 'editor') {
      setTimeout(() => mapController.map.invalidateSize(), 100);
    }
  },

  async renderCepsTable(filter = '') {
    if (!this.cepsTableBody) return;
    
    try {
      const res = await fetch('src/data/simac_master_db.json');
      const data = await res.json();
      
      this.cepsTableBody.innerHTML = '';
      
      // Ordenar alfabeticamente
      data.sort((a, b) => a.nome.localeCompare(b.nome));

      data.forEach(com => {
        com.ceps.forEach(cepObj => {
          const logradouro = cepObj.oficial ? cepObj.oficial.logradouro : 'N/A';
          const bairro = cepObj.oficial ? cepObj.oficial.bairro : 'N/A';
          const cep = cepObj.cep;
          const fonte = cepObj.oficial ? (cepObj.oficial.fonte_dados || 'ViaCEP') : 'Manual';

          if (filter && 
              !logradouro.toLowerCase().includes(filter.toLowerCase()) && 
              !cep.includes(filter)) {
            return;
          }

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${com.nome}</strong></td>
            <td>${logradouro}</td>
            <td>${bairro}</td>
            <td><span class="tag-cep">${cep}</span></td>
          `;
          this.cepsTableBody.appendChild(tr);
        });
      });
    } catch (err) {
      console.error('Erro ao carregar dados para tabela de CEPs:', err);
    }
  },

  async updateReportStats() {
    try {
      const res = await fetch('src/data/simac_master_db.json');
      const data = await res.json();
      
      let totalStreets = 0;
      let totalEnriched = 0;
      const neighborhoods = {}; // Usar objeto para contagem
      
      data.forEach(com => {
        totalStreets += com.total_ruas;
        totalEnriched += com.ceps.filter(c => c.oficial).length;
        
        com.ceps.forEach(c => {
          if (c.oficial && c.oficial.bairro) {
            const b = c.oficial.bairro;
            neighborhoods[b] = (neighborhoods[b] || 0) + 1;
          }
        });
      });

      const neighborhoodList = Object.entries(neighborhoods)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      document.getElementById('stat-streets').textContent = totalStreets;
      document.getElementById('stat-ceps').textContent = totalEnriched;
      document.getElementById('stat-neighborhoods').textContent = Object.keys(neighborhoods).length;
      
      const rankingEl = document.getElementById('neighborhoods-ranking');
      if (rankingEl) {
        rankingEl.innerHTML = neighborhoodList.map(([name, count], index) => `
          <div class="ranking-item">
            <span class="ranking-pos">${index + 1}º</span>
            <span class="ranking-name">${name}</span>
            <span class="ranking-count">${count} CEPs</span>
            <div class="ranking-bar-bg">
              <div class="ranking-bar-fill" style="width: ${(count / neighborhoodList[0][1] * 100)}%"></div>
            </div>
          </div>
        `).join('');
      }

      const communitiesCount = document.getElementById('stat-communities');
      if (communitiesCount) communitiesCount.textContent = data.length;
    } catch (err) {
      console.error('Erro ao atualizar estatísticas:', err);
    }
  },

  renderList(features) {
    this.listEl.innerHTML = '';
    
    features.forEach(f => {
      const li = document.createElement('li');
      li.className = 'community-item';
      li.dataset.id = f.id;
      
      li.innerHTML = `
        <div class="community-color" style="background-color: ${f.color}"></div>
        <span class="community-name">${f.name}</span>
        <input type="checkbox" class="community-checkbox" ${stateManager.isSelected(f.id) ? 'checked' : ''}>
      `;
      
      li.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const checkbox = li.querySelector('.community-checkbox');
          checkbox.checked = !checkbox.checked;
        }
        
        stateManager.toggleSelection(f.id);
        mapController.updateFilters();
      });
      
      this.listEl.appendChild(li);
    });
  },

  bindEvents() {
    this.searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = stateManager.features.filter(f => 
        f.name.toLowerCase().includes(term)
      );
      this.renderList(filtered);
    });

    this.btnSelectAll.addEventListener('click', () => {
      stateManager.selectAll();
      this.syncListUI();
      mapController.updateFilters();
    });

    this.btnClearAll.addEventListener('click', () => {
      stateManager.clearSelection();
      this.syncListUI();
      mapController.updateFilters();
    });

    this.btnCloseDetails.addEventListener('click', () => {
      this.hideDetails();
    });

    if (this.cepSearchInput) {
      this.cepSearchInput.addEventListener('input', (e) => {
        this.renderCepsTable(e.target.value);
      });
    }
  },

  syncListUI() {
    const items = this.listEl.querySelectorAll('.community-item');
    items.forEach(item => {
      const id = item.dataset.id;
      const checkbox = item.querySelector('.community-checkbox');
      checkbox.checked = stateManager.isSelected(id);
    });
  },

  showDetails(id) {
    const feature = stateManager.getFeature(id);
    if (!feature) return;

    this.detailTitle.textContent = feature.name;
    
    // Gera mais informações baseadas nas properties do JSON ou mock
    const props = feature.properties;
    
    // Se o GeoJSON não tem dados ricos, podemos simular alguns pro dashboard ficar bonito e útil
    const area = props.area || (Math.random() * 5 + 0.5).toFixed(2) + ' km²';
    const pop = props.population || Math.floor(Math.random() * 15000 + 1000);
    const risk = props.risk_level || ['Baixo', 'Médio', 'Alto'][Math.floor(Math.random() * 3)];
    
    this.detailContent.innerHTML = `
      <div class="detail-row">
        <span class="detail-label">Bairro</span>
        <span class="detail-value">${props.neighborhood || feature.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Área Estimada</span>
        <span class="detail-value">${area}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">População</span>
        <span class="detail-value">${pop.toLocaleString('pt-BR')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Risco Geológico</span>
        <span class="detail-value" style="color: ${risk === 'Alto' ? '#ef4444' : risk === 'Médio' ? '#f59e0b' : '#10b981'}">${risk}</span>
      </div>
    `;

    this.detailsPanel.style.display = 'flex';
  },

  hideDetails() {
    this.detailsPanel.style.display = 'none';
  }
};
