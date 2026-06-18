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

    // Modal de Edição na Barra Lateral
    this.editModal = document.getElementById('editCommunityModal');
    this.editModalName = document.getElementById('editModalName');
    this.editModalComplex = document.getElementById('editModalComplex');
    this.editModalNewComplexGroup = document.getElementById('editModalNewComplexGroup');
    this.editModalNewComplexName = document.getElementById('editModalNewComplexName');
    this.editModalColorGroup = document.getElementById('editModalColorGroup');
    this.editModalColorHex = document.getElementById('editModalColorHex');
    this.editModalColorPicker = document.getElementById('editModalColorPicker');
    this.editModalColorPreview = document.getElementById('editModalColorPreview');
    this.btnDeleteEditModal = document.getElementById('btnDeleteEditModal');
    this.btnSaveEditModal = document.getElementById('btnSaveEditModal');
    this.btnCancelEditModal = document.getElementById('btnCancelEditModal');
    this.currentEditingId = null;

    if (!this.listEl) {
      console.error('Erro: Elemento communityList não encontrado no DOM.');
      return;
    }

    this.renderList(stateManager.features);
    this.bindEvents();
    this.bindModalEvents();
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
    
    // Agrupa por complexo
    const groups = {};
    features.forEach(f => {
      const complexo = f.properties.COMPLEXO || f.properties.complexo || f.properties.Complexo || 'Outros';
      if (!groups[complexo]) {
        groups[complexo] = [];
      }
      groups[complexo].push(f);
    });

    const isSearchActive = this.searchInput && this.searchInput.value.trim().length > 0;

    // Ordena os complexos
    const sortedComplexes = Object.keys(groups).sort((a, b) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      return a.localeCompare(b);
    });

    sortedComplexes.forEach(complexName => {
      const coms = groups[complexName];
      
      const groupDiv = document.createElement('div');
      groupDiv.className = 'complex-group';
      groupDiv.dataset.complex = complexName;

      // Header do complexo
      const headerDiv = document.createElement('div');
      headerDiv.className = 'complex-header';

      // Botão collapse
      const toggleBtn = document.createElement('button');
      toggleBtn.className = `complex-toggle-btn${isSearchActive ? '' : ' collapsed'}`;
      toggleBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      `;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'complex-title';
      titleSpan.textContent = complexName;

      const complexCheckbox = document.createElement('input');
      complexCheckbox.type = 'checkbox';
      complexCheckbox.className = 'complex-checkbox';

      headerDiv.appendChild(toggleBtn);
      headerDiv.appendChild(titleSpan);
      headerDiv.appendChild(complexCheckbox);
      groupDiv.appendChild(headerDiv);

      // Sublista
      const sublistUl = document.createElement('ul');
      sublistUl.className = `complex-sublist community-list${isSearchActive ? '' : ' collapsed'}`;

      const visibleComs = coms.filter(f => !f.properties.oculto);
      if (visibleComs.length === 0) return; // Skip empty groups

      visibleComs.forEach(f => {
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
            if (checkbox) checkbox.checked = !checkbox.checked;
          }
          
          stateManager.toggleSelection(f.id);
          this.updateComplexCheckboxState(groupDiv, visibleComs);
          mapController.updateFilters();
        });
        
        sublistUl.appendChild(li);
      });

      groupDiv.appendChild(sublistUl);

      // Eventos do Header
      toggleBtn.addEventListener('click', () => {
        toggleBtn.classList.toggle('collapsed');
        sublistUl.classList.toggle('collapsed');
      });

      titleSpan.addEventListener('click', () => {
        toggleBtn.classList.toggle('collapsed');
        sublistUl.classList.toggle('collapsed');
      });

      complexCheckbox.addEventListener('click', (e) => {
        const checked = complexCheckbox.checked;
        visibleComs.forEach(f => {
          const currentlySelected = stateManager.isSelected(f.id);
          if (checked !== currentlySelected) {
            stateManager.toggleSelection(f.id);
          }
        });
        
        sublistUl.querySelectorAll('.community-checkbox').forEach(cb => {
          cb.checked = checked;
        });
        mapController.updateFilters();
      });

      // Define estado inicial do checkbox do complexo
      this.updateComplexCheckboxState(groupDiv, visibleComs);

      this.listEl.appendChild(groupDiv);
    });
  },

  updateComplexCheckboxState(groupDiv, coms) {
    const complexCheckbox = groupDiv.querySelector('.complex-checkbox');
    if (!complexCheckbox) return;

    const selectedCount = coms.filter(f => stateManager.isSelected(f.id)).length;

    if (selectedCount === 0) {
      complexCheckbox.checked = false;
      complexCheckbox.indeterminate = false;
    } else if (selectedCount === coms.length) {
      complexCheckbox.checked = true;
      complexCheckbox.indeterminate = false;
    } else {
      complexCheckbox.checked = false;
      complexCheckbox.indeterminate = true;
    }
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

    const chkToggleBoundary = document.getElementById('chkToggleBoundary');
    const btnFloatingBoundary = document.getElementById('btnFloatingBoundary');

    const updateBoundaryState = (show) => {
      mapController.toggleBoundary(show);
      if (chkToggleBoundary) chkToggleBoundary.checked = show;
      if (btnFloatingBoundary) {
        btnFloatingBoundary.classList.toggle('active', show);
      }
    };

    if (chkToggleBoundary) {
      chkToggleBoundary.addEventListener('change', (e) => {
        updateBoundaryState(e.target.checked);
      });
    }

    if (btnFloatingBoundary) {
      btnFloatingBoundary.addEventListener('click', () => {
        const isCurrentlyActive = btnFloatingBoundary.classList.contains('active');
        updateBoundaryState(!isCurrentlyActive);
      });
    }
  },

  bindModalEvents() {
    if (!this.editModal) return;

    this.editModalComplex.addEventListener('change', () => {
      const val = this.editModalComplex.value;
      if (val === '__NEW__') {
        this.editModalNewComplexGroup.style.display = 'flex';
        this.editModalColorGroup.style.display = 'flex';
        this.editModalColorHex.value = '#ff0000';
        initColorPicker('editModalColorHex', 'editModalColorPicker', 'editModalColorPreview');
      } else if (val === 'Outros') {
        this.editModalNewComplexGroup.style.display = 'none';
        this.editModalColorGroup.style.display = 'none';
      } else {
        this.editModalNewComplexGroup.style.display = 'none';
        this.editModalColorGroup.style.display = 'flex';
        const currentCor = stateManager.complexes[val] || '#cccccc';
        this.editModalColorHex.value = currentCor;
        initColorPicker('editModalColorHex', 'editModalColorPicker', 'editModalColorPreview');
      }
    });

    this.btnCancelEditModal.addEventListener('click', () => {
      this.closeEditModal();
    });

    this.btnDeleteEditModal.addEventListener('click', async () => {
      if (!this.currentEditingId) return;
      const feat = stateManager.getFeature(this.currentEditingId);
      if (!feat) return;

      const confirmDelete = await window.showCustomConfirm('Excluir Comunidade', `Tem certeza que deseja excluir a comunidade "${feat.name}"?`);
      if (confirmDelete) {
        this.deleteCommunity(this.currentEditingId);
      }
    });

    this.btnSaveEditModal.addEventListener('click', () => {
      if (!this.currentEditingId) return;
      this.saveCommunityEdits();
    });
  },

  openEditModal(id) {
    const feat = stateManager.getFeature(id);
    if (!feat) return;

    this.currentEditingId = id;
    this.editModalName.value = feat.name;

    this.editModalComplex.innerHTML = '';
    
    const optOutros = document.createElement('option');
    optOutros.value = 'Outros';
    optOutros.textContent = 'Sem Complexo';
    this.editModalComplex.appendChild(optOutros);

    Object.keys(stateManager.complexes).forEach(comp => {
      if (comp !== 'Outros') {
        const opt = document.createElement('option');
        opt.value = comp;
        opt.textContent = comp;
        this.editModalComplex.appendChild(opt);
      }
    });

    const optNew = document.createElement('option');
    optNew.value = '__NEW__';
    optNew.textContent = '[ Criar Novo Complexo... ]';
    this.editModalComplex.appendChild(optNew);

    const currentComplex = feat.properties.COMPLEXO || feat.properties.complexo || feat.properties.Complexo || 'Outros';
    this.editModalComplex.value = currentComplex;

    this.editModalNewComplexName.value = '';

    if (currentComplex === 'Outros') {
      this.editModalNewComplexGroup.style.display = 'none';
      this.editModalColorGroup.style.display = 'none';
    } else {
      this.editModalNewComplexGroup.style.display = 'none';
      this.editModalColorGroup.style.display = 'flex';
      const compColor = stateManager.complexes[currentComplex] || '#cccccc';
      this.editModalColorHex.value = compColor;
      // Inicializa picker após exibir o grupo
      setTimeout(() => initColorPicker('editModalColorHex', 'editModalColorPicker', 'editModalColorPreview'), 0);
    }

    this.editModal.style.display = 'flex';
  },

  closeEditModal() {
    this.editModal.style.display = 'none';
    this.currentEditingId = null;
  },

  deleteCommunity(id) {
    let targetLayer = null;
    mapController.geoJsonLayer.eachLayer(layer => {
      if (String(layer.feature.id) === String(id)) {
        targetLayer = layer;
      }
    });

    if (targetLayer) {
      mapController.geoJsonLayer.removeLayer(targetLayer);
    }

    stateManager.features = stateManager.features.filter(f => String(f.id) !== String(id));
    if (stateManager.data && stateManager.data.features) {
      stateManager.data.features = stateManager.data.features.filter(f => String(f.id) !== String(id));
    }

    this.saveGeoJsonToServer();
  },

  async saveCommunityEdits() {
    const id = this.currentEditingId;
    const feat = stateManager.getFeature(id);
    if (!feat) return;

    const newName = this.editModalName.value.trim();
    if (!newName) {
      alert('Por favor, informe o nome da comunidade.');
      return;
    }

    let complexVal = this.editModalComplex.value;
    let colorVal = '#cccccc';

    if (complexVal === '__NEW__') {
      const newComplexName = this.editModalNewComplexName.value.trim();
      if (!newComplexName) {
        alert('Por favor, informe o nome do novo complexo.');
        return;
      }
      complexVal = newComplexName;
      const rawColor = this.editModalColorHex ? this.editModalColorHex.value.trim() : '#ff0000';
      colorVal = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : '#ff0000';
      stateManager.complexes[complexVal] = colorVal;
    } else if (complexVal !== 'Outros') {
      const rawColor2 = this.editModalColorHex ? this.editModalColorHex.value.trim() : '#cccccc';
      colorVal = /^#[0-9a-fA-F]{6}$/.test(rawColor2) ? rawColor2 : '#cccccc';
      stateManager.complexes[complexVal] = colorVal;
    }

    feat.name = newName;
    feat.properties.COMUNIDADE = newName;
    feat.properties.name = newName;
    feat.properties.COMPLEXO = complexVal;
    
    stateManager.features.forEach(f => {
      const comp = f.properties.COMPLEXO || f.properties.complexo || f.properties.Complexo || 'Outros';
      if (comp === complexVal && complexVal !== 'Outros') {
        f.color = colorVal;
        f.properties.COR_HEX = colorVal;
        f.properties.cor_hex = colorVal;
        f.properties.color = colorVal;
        f.properties.cor = colorVal;
        stateManager.colors.set(f.id, colorVal);
      }
    });

    if (complexVal === 'Outros') {
      feat.color = '#cccccc';
      feat.properties.COR_HEX = '#cccccc';
      feat.properties.cor_hex = '#cccccc';
      feat.properties.color = '#cccccc';
      feat.properties.cor = '#cccccc';
      stateManager.colors.set(id, '#cccccc');
    }

    mapController.geoJsonLayer.eachLayer(layer => {
      if (String(layer.feature.id) === String(id)) {
        layer.feature.properties.COMUNIDADE = newName;
        layer.feature.properties.name = newName;
        layer.feature.properties.COMPLEXO = complexVal;
        
        layer.unbindTooltip();
        layer.bindTooltip(`<strong>${newName}</strong>`, {
          sticky: true,
          className: 'custom-tooltip'
        });
      }
      
      const layerId = layer.feature.id;
      const f = stateManager.getFeature(layerId);
      if (f) {
        layer.feature.properties.COR_HEX = f.properties.COR_HEX;
        layer.feature.properties.COMPLEXO = f.properties.COMPLEXO;
      }
    });

    mapController.updateFilters();
    await this.saveGeoJsonToServer();
  },

  async saveGeoJsonToServer() {
    const featureCollection = mapController.geoJsonLayer.toGeoJSON();
    
    try {
      const { api } = await import('../utils/api.js');
      const response = await api.post('api/save-geojson', { featureCollection });
      if (response.ok) {
        alert('Alterações salvas com sucesso!');
        this.closeEditModal();
        location.reload();
      } else {
        const result = await response.json();
        alert('Erro ao salvar no servidor: ' + (result.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao conectar com o servidor.');
    }
  },

  syncListUI() {
    const groupDivs = this.listEl.querySelectorAll('.complex-group');
    groupDivs.forEach(groupDiv => {
      const items = groupDiv.querySelectorAll('.community-item');
      
      const comsIds = [];
      items.forEach(item => {
        const id = item.dataset.id;
        comsIds.push(id);
        
        const checkbox = item.querySelector('.community-checkbox');
        if (checkbox) {
          checkbox.checked = stateManager.isSelected(id);
        }
      });

      const complexCheckbox = groupDiv.querySelector('.complex-checkbox');
      if (complexCheckbox) {
        const selectedCount = comsIds.filter(id => stateManager.isSelected(id)).length;
        if (selectedCount === 0) {
          complexCheckbox.checked = false;
          complexCheckbox.indeterminate = false;
        } else if (selectedCount === comsIds.length) {
          complexCheckbox.checked = true;
          complexCheckbox.indeterminate = false;
        } else {
          complexCheckbox.checked = false;
          complexCheckbox.indeterminate = true;
        }
      }
    });
  },

  showDetails(id) {
    const feature = stateManager.getFeature(id);
    if (!feature) return;

    this.detailTitle.textContent = feature.name;
    const props = feature.properties;
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

// Helpers globais de Diálogos Customizados (Substitutos de prompt/confirm)
window.showCustomConfirm = function(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customConfirmModal');
    const titleEl = document.getElementById('customConfirmTitle');
    const msgEl = document.getElementById('customConfirmMessage');
    const btnCancel = document.getElementById('btnCancelConfirmModal');
    const btnCancelX = document.getElementById('btnCancelConfirmModalX');
    const btnConfirm = document.getElementById('btnConfirmConfirmModal');
    
    titleEl.textContent = title || 'Confirmação';
    msgEl.textContent = message || '';
    
    modal.style.display = 'flex';
    
    const cleanup = (value) => {
      modal.style.display = 'none';
      btnCancel.onclick = null;
      btnCancelX.onclick = null;
      btnConfirm.onclick = null;
      resolve(value);
    };
    
    btnCancel.onclick = () => cleanup(false);
    btnCancelX.onclick = () => cleanup(false);
    btnConfirm.onclick = () => cleanup(true);
  });
};

window.showCustomPrompt = function(title, label, defaultValue = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('customPromptModal');
    const titleEl = document.getElementById('customPromptTitle');
    const labelEl = document.getElementById('customPromptLabel');
    const inputEl = document.getElementById('customPromptInput');
    const btnCancel = document.getElementById('btnCancelPromptModal');
    const btnConfirm = document.getElementById('btnConfirmPromptModal');
    
    titleEl.textContent = title || 'Novo Item';
    labelEl.textContent = label || 'Nome';
    inputEl.value = defaultValue;
    
    modal.style.display = 'flex';
    inputEl.focus();
    if (inputEl.select) inputEl.select();
    
    const cleanup = (value) => {
      modal.style.display = 'none';
      btnCancel.onclick = null;
      btnConfirm.onclick = null;
      inputEl.onkeydown = null;
      resolve(value);
    };
    
    btnCancel.onclick = () => cleanup(null);
    btnConfirm.onclick = () => cleanup(inputEl.value.trim());
    
    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        cleanup(inputEl.value.trim());
      }
    };
  });
};

// Helper: inicializa o seletor de cor híbrido (swatches + picker + hex input)
function initColorPicker(hexInputId, pickerId, previewId) {
  const hexInput = document.getElementById(hexInputId);
  const picker = document.getElementById(pickerId);
  const preview = document.getElementById(previewId);
  if (!hexInput || !picker || !preview) return;

  // Atualiza preview e picker a partir do hexInput
  const syncFromHex = (hex) => {
    const isValid = /^#[0-9a-fA-F]{6}$/.test(hex);
    if (isValid) {
      preview.style.background = hex;
      picker.value = hex;
      // Atualiza swatch selecionada
      document.querySelectorAll(`.color-swatch[data-target="${hexInputId}"]`).forEach(s => {
        const swatchColor = s.style.background.replace(/\s/g,'').toLowerCase();
        const normHex = hex.toLowerCase();
        // converte rgb() para hex se necessário (browsers às vezes retornam rgb)
        s.classList.toggle('selected', swatchColor === normHex || rgbToHex(swatchColor) === normHex);
      });
    }
  };

  hexInput.addEventListener('input', () => syncFromHex(hexInput.value.trim()));
  picker.addEventListener('input', () => {
    hexInput.value = picker.value;
    syncFromHex(picker.value);
  });

  // Clique nas swatches
  document.querySelectorAll(`.color-swatch[data-target="${hexInputId}"]`).forEach(swatch => {
    swatch.addEventListener('click', () => {
      const bg = swatch.style.background;
      const hex = bgToHex(bg);
      hexInput.value = hex;
      syncFromHex(hex);
    });
  });

  // Sync inicial
  syncFromHex(hexInput.value);
}

function bgToHex(bg) {
  // bg pode ser '#xxxxxx' ou 'rgb(r, g, b)'
  if (bg.startsWith('#')) return bg;
  const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) {
    return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  }
  return bg;
}

function rgbToHex(rgb) {
  const m = rgb.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (m) return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  return rgb;
}

window.showCreateComplexModal = function() {
  return new Promise((resolve) => {
    const modal = document.getElementById('createComplexModal');
    const nameInput = document.getElementById('createComplexModalName');
    const colorHexInput = document.getElementById('createComplexModalColorHex');
    const btnCancel = document.getElementById('btnCancelCreateComplexModal');
    const btnCancel2 = document.getElementById('btnCancelCreateComplexModal2');
    const btnSubmit = document.getElementById('btnSubmitCreateComplexModal');

    nameInput.value = '';
    colorHexInput.value = '#ff0000';

    // Inicializa o seletor de cor
    initColorPicker('createComplexModalColorHex', 'createComplexModalColorPicker', 'createComplexModalColorPreview');

    modal.style.display = 'flex';
    nameInput.focus();

    const cleanup = (value) => {
      modal.style.display = 'none';
      btnCancel.onclick = null;
      btnCancel2.onclick = null;
      btnSubmit.onclick = null;
      resolve(value);
    };

    btnCancel.onclick = () => cleanup(null);
    btnCancel2.onclick = () => cleanup(null);
    btnSubmit.onclick = () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert('Por favor, digite o nome do complexo.');
        return;
      }
      const color = /^#[0-9a-fA-F]{6}$/.test(colorHexInput.value.trim())
        ? colorHexInput.value.trim()
        : '#ff0000';
      cleanup({ name, color });
    };
  });
};

window.showCreateCommunityModal = function(complexes) {
  return new Promise((resolve) => {
    const modal = document.getElementById('createCommunityModal');
    const nameInput = document.getElementById('createCommunityModalName');
    const neighborhoodInput = document.getElementById('createCommunityModalNeighborhood');
    const complexSelect = document.getElementById('createCommunityModalComplex');
    const newComplexGroup = document.getElementById('createCommunityModalNewComplexGroup');
    const newComplexNameInput = document.getElementById('createCommunityModalNewComplexName');
    const newComplexColorHex = document.getElementById('comNewComplexColorHex');

    const btnCancel = document.getElementById('btnCancelCreateCommunityModal');
    const btnCancel2 = document.getElementById('btnCancelCreateCommunityModal2');
    const btnSubmit = document.getElementById('btnSubmitCreateCommunityModal');

    nameInput.value = '';
    neighborhoodInput.value = 'Duque de Caxias';
    newComplexNameInput.value = '';
    if (newComplexColorHex) newComplexColorHex.value = '#ff0000';
    newComplexGroup.style.display = 'none';

    complexSelect.innerHTML = '';

    const optOutros = document.createElement('option');
    optOutros.value = 'Outros';
    optOutros.textContent = 'Sem Complexo';
    complexSelect.appendChild(optOutros);

    Object.keys(complexes).forEach(comp => {
      if (comp !== 'Outros') {
        const opt = document.createElement('option');
        opt.value = comp;
        opt.textContent = comp;
        complexSelect.appendChild(opt);
      }
    });

    const optNew = document.createElement('option');
    optNew.value = '__NEW__';
    optNew.textContent = '[ Criar Novo Complexo... ]';
    complexSelect.appendChild(optNew);

    complexSelect.onchange = () => {
      if (complexSelect.value === '__NEW__') {
        newComplexGroup.style.display = 'flex';
        initColorPicker('comNewComplexColorHex', 'comNewComplexColorPicker', 'comNewComplexColorPreview');
      } else {
        newComplexGroup.style.display = 'none';
      }
    };

    modal.style.display = 'flex';
    nameInput.focus();

    const cleanup = (value) => {
      modal.style.display = 'none';
      btnCancel.onclick = null;
      btnCancel2.onclick = null;
      btnSubmit.onclick = null;
      complexSelect.onchange = null;
      resolve(value);
    };

    btnCancel.onclick = () => cleanup(null);
    btnCancel2.onclick = () => cleanup(null);
    btnSubmit.onclick = () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert('Por favor, digite o nome da comunidade.');
        return;
      }
      const neighborhood = neighborhoodInput.value.trim();
      if (!neighborhood) {
        alert('Por favor, digite o bairro de referência.');
        return;
      }

      const compVal = complexSelect.value;
      if (compVal === '__NEW__') {
        const newCompName = newComplexNameInput.value.trim();
        if (!newCompName) {
          alert('Por favor, digite o nome do novo complexo.');
          return;
        }
        const rawColor = newComplexColorHex ? newComplexColorHex.value.trim() : '#ff0000';
        const newComplexColor = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : '#ff0000';
        cleanup({
          name,
          neighborhood,
          complex: newCompName,
          newComplexName: newCompName,
          newComplexColor
        });
      } else {
        cleanup({
          name,
          neighborhood,
          complex: compVal
        });
      }
    };
  });
};


