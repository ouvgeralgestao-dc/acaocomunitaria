import { mapController } from './mapController.js';
import { uiController } from './uiController.js';
import { api } from '../utils/api.js';
import { stateManager } from './stateManager.js';

export const cleanerController = {
  selectedIds: new Set(),
  layersData: [],
  pendingEdits: new Map(),

  init() {
    this.searchInput = document.getElementById('cleanerSearchInput');
    this.tableBody = document.getElementById('cleanerTableBody');
    this.headerCheckbox = document.getElementById('headerCheckboxCleaner');
    this.btnSelectAll = document.getElementById('btnSelectAllCleaner');
    this.btnClearSelection = document.getElementById('btnClearSelectionCleaner');
    this.btnDeleteSelected = document.getElementById('btnDeleteSelectedCleaner');
    this.selectedCountSpan = document.getElementById('selectedCountSpan');

    // Elementos da Aba Complexos
    this.tabComunidadesBtn = document.getElementById('tabBtnComunidades');
    this.tabComplexosBtn = document.getElementById('tabBtnComplexos');
    this.tabComunidadesContent = document.getElementById('tabContentComunidades');
    this.tabComplexosContent = document.getElementById('tabContentComplexos');
    this.complexosTableBody = document.getElementById('complexosTableBody');
    this.complexosSearchInput = document.getElementById('complexosSearchInput');
    this.btnCreateComplex = document.getElementById('btnCreateComplex');

    this.bindEvents();
  },

  bindEvents() {
    if (this.initialized) return;

    this.searchInput.addEventListener('input', () => this.renderTable());

    this.headerCheckbox.addEventListener('change', (e) => {
      const filtered = this.getFilteredLayers();
      filtered.forEach(layer => {
        if (e.target.checked) {
          this.selectedIds.add(layer.feature.id);
        } else {
          this.selectedIds.delete(layer.feature.id);
        }
      });
      this.updateCheckboxes();
      this.updateDeleteButton();
    });

    this.btnSelectAll.addEventListener('click', () => {
      this.getFilteredLayers().forEach(l => this.selectedIds.add(l.feature.id));
      this.headerCheckbox.checked = true;
      this.updateCheckboxes();
      this.updateDeleteButton();
    });

    this.btnClearSelection.addEventListener('click', () => {
      this.getFilteredLayers().forEach(l => this.selectedIds.delete(l.feature.id));
      this.headerCheckbox.checked = false;
      this.updateCheckboxes();
      this.updateDeleteButton();
    });

    this.btnDeleteSelected.addEventListener('click', () => this.deleteSelected());

    // Eventos das Abas
    this.tabComunidadesBtn.addEventListener('click', () => this.switchTab('comunidades'));
    this.tabComplexosBtn.addEventListener('click', () => this.switchTab('complexos'));
    
    // Eventos de Busca e Criação de Complexos
    this.complexosSearchInput.addEventListener('input', () => this.renderComplexesTable());
    this.btnCreateComplex.addEventListener('click', () => this.handleCreateComplex());

    this.initialized = true;
  },

  activate() {
    if (!this.initialized) this.init();
    this.selectedIds.clear();
    this.pendingEdits.clear();
    this.headerCheckbox.checked = false;

    if (mapController.geoJsonLayer) {
      this.layersData = mapController.geoJsonLayer.getLayers();
    } else {
      this.layersData = [];
    }

    this.renderTable();
    this.renderComplexesTable();
    this.updateDeleteButton();
    this.switchTab('comunidades'); // Default tab
  },

  getFilteredLayers() {
    const query = this.searchInput.value.trim().toLowerCase();
    if (!query) return this.layersData;
    return this.layersData.filter(layer => {
      const name = (layer.feature.properties.COMUNIDADE || layer.feature.properties.name || '').toLowerCase();
      const neighborhood = (layer.feature.properties.neighborhood || '').toLowerCase();
      const complexo = (layer.feature.properties.COMPLEXO || layer.feature.properties.complexo || '').toLowerCase();
      return name.includes(query) || neighborhood.includes(query) || complexo.includes(query);
    });
  },

  renderTable() {
    this.tableBody.innerHTML = '';
    const filtered = this.getFilteredLayers();

    filtered.sort((a, b) => {
      const nameA = a.feature.properties.COMUNIDADE || a.feature.properties.name || '';
      const nameB = b.feature.properties.COMUNIDADE || b.feature.properties.name || '';
      return nameA.localeCompare(nameB);
    });

    if (filtered.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 30px; text-align: center; color: var(--text-secondary);">
            Nenhuma comunidade localizada.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(layer => {
      const id = layer.feature.id;
      const name = layer.feature.properties.COMUNIDADE || layer.feature.properties.name || 'Sem nome';
      const neighborhood = layer.feature.properties.neighborhood || 'Duque de Caxias';
      const complexo = layer.feature.properties.COMPLEXO || layer.feature.properties.complexo || 'Outros';
      const corHex = layer.feature.properties.COR_HEX || layer.feature.properties.cor_hex || '#ff0000';
      const geomType = layer.feature.geometry.type;
      const isChecked = this.selectedIds.has(id);
      const hasNoName = (!layer.feature.properties.COMUNIDADE && !layer.feature.properties.name) || (layer.feature.properties.COMUNIDADE || layer.feature.properties.name || '').trim() === '';

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      tr.style.transition = 'background 0.2s';
      tr.addEventListener('mouseenter', () => tr.style.background = 'var(--glass-hover)');
      tr.addEventListener('mouseleave', () => tr.style.background = 'transparent');

      tr.innerHTML = `
        <td style="padding: 12px; text-align: center;">
          <input type="checkbox" class="row-checkbox-cleaner" data-id="${id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
        </td>
        <td style="padding: 12px;" class="cell-comunidade">
          <div class="editable-cell" data-field="COMUNIDADE" data-id="${id}">
            <span class="cell-display ${hasNoName ? 'cell-empty' : ''}" title="Clique para editar">${name}</span>
            <input type="text" class="cell-edit-input" value="${this.escapeAttr(name === 'Sem nome' ? '' : name)}" placeholder="Nome" style="display:none; width: 100%;">
          </div>
        </td>
        <td style="padding: 12px;" class="cell-complexo">
          <div class="editable-cell" data-field="COMPLEXO" data-id="${id}">
            <span class="cell-display" title="Clique para editar">${complexo}</span>
            <select class="cell-edit-input" style="display:none; width: 100%; height: 28px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-sidebar); color: var(--text-primary); font-family: inherit;">
              ${Object.keys(stateManager.complexes).map(comp => `
                <option value="${comp}" ${comp === complexo ? 'selected' : ''}>${comp}</option>
              `).join('')}
              <option value="__NEW__">+ Criar Novo Complexo...</option>
            </select>
          </div>
        </td>
        <td style="padding: 12px; text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center;">
            <button class="btn-action-visibility" title="Ocultar/Mostrar" style="background: ${layer.feature.properties.oculto ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; border: none; color: ${layer.feature.properties.oculto ? 'var(--danger)' : '#10b981'}; cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
              ${layer.feature.properties.oculto ? 
                `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>` : 
                `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
              }
            </button>
            <button class="btn-action-edit-modal" title="Editar dados" style="background: rgba(59,130,246,0.1); border: none; color: var(--accent); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-action-zoom" title="Focar no mapa" style="background: rgba(59, 130, 246, 0.1); border: none; color: var(--accent); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <button class="btn-action-delete" title="Excluir" style="background: rgba(239, 68, 68, 0.1); border: none; color: var(--danger); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      `;

      // Checkbox individual
      const cb = tr.querySelector('.row-checkbox-cleaner');
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedIds.add(id);
        } else {
          this.selectedIds.delete(id);
          this.headerCheckbox.checked = false;
        }
        this.updateDeleteButton();
      });

      // Botão Ocultar/Mostrar
      tr.querySelector('.btn-action-visibility').addEventListener('click', async (e) => {
        e.stopPropagation();
        const isOculto = !layer.feature.properties.oculto;
        layer.feature.properties.oculto = isOculto;

        const feat = stateManager.getFeature(id);
        if (feat) {
          feat.properties.oculto = isOculto;
        }

        const featureCollection = mapController.geoJsonLayer.toGeoJSON();
        try {
          await api.post('api/save-geojson', { featureCollection });
          mapController.updateFilters();
          
          const btnVis = tr.querySelector('.btn-action-visibility');
          btnVis.style.background = isOculto ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)';
          btnVis.style.color = isOculto ? 'var(--danger)' : '#10b981';
          btnVis.innerHTML = isOculto ? 
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>` : 
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
            
          uiController.renderList(stateManager.features);
        } catch(err) {
          console.error(err);
          alert('Erro ao atualizar visibilidade');
        }
      });

      // Botão Editar Modal
      tr.querySelector('.btn-action-edit-modal').addEventListener('click', (e) => {
        e.stopPropagation();
        uiController.openEditModal(id);
      });

      // Botão Zoom
      tr.querySelector('.btn-action-zoom').addEventListener('click', (e) => {
        e.stopPropagation();
        const center = layer.getBounds().getCenter();
        uiController.switchView('map');
        setTimeout(() => mapController.map.flyTo(center, 15), 200);
      });

      tr.querySelector('.btn-action-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmDelete = await window.showCustomConfirm('Excluir Comunidade', `Excluir permanentemente "${name}"?`);
        if (confirmDelete) {
          await this.performDeletion([id]);
        }
      });

      // Clique duplo nas células editáveis
      tr.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.startCellEdit(cell, layer);
        });
      });

      this.tableBody.appendChild(tr);
    });
  },

  toggleEditMode(tr, layer) {
    const editBtn = tr.querySelector('.btn-action-edit');
    const cells = tr.querySelectorAll('.editable-cell');
    const isEditing = editBtn.dataset.editing === 'true';

    if (isEditing) {
      // Salvar alterações
      let changed = false;
      
      // Primeiro processa o complexo se tiver mudado para __NEW__
      const complexCell = tr.querySelector('.cell-complexo .editable-cell');
      if (complexCell) {
        const select = complexCell.querySelector('.cell-edit-input');
        if (select.value === '__NEW__') {
          const newCompName = prompt('Nome do novo complexo:');
          if (newCompName) {
            const newCompColor = prompt('Cor em Hexadecimal para o novo complexo (ex: #ff00ff):') || '#ff0000';
            stateManager.complexes[newCompName] = newCompColor;
            
            // Adiciona a nova opção a todos os selects da tabela
            this.tableBody.querySelectorAll('.cell-complexo select').forEach(s => {
              const opt = document.createElement('option');
              opt.value = newCompName;
              opt.textContent = newCompName;
              s.insertBefore(opt, s.lastElementChild);
            });
            select.value = newCompName;
          } else {
            select.value = layer.feature.properties.COMPLEXO || 'Outros';
          }
        }
      }

      cells.forEach(cell => {
        const field = cell.dataset.field;
        const input = cell.querySelector('.cell-edit-input');
        const display = cell.querySelector('.cell-display');
        let newValue = input.value.trim();

        if (newValue && newValue !== layer.feature.properties[field]) {
          layer.feature.properties[field] = newValue;
          if (field === 'COMUNIDADE') {
            layer.feature.properties.name = newValue;
            display.textContent = newValue;
          } else if (field === 'COMPLEXO') {
            display.textContent = newValue;
            // Atualiza a cor automaticamente baseado no complexo
            const matchedColor = stateManager.complexes[newValue] || '#cccccc';
            layer.feature.properties.COR_HEX = matchedColor;
            layer.feature.properties.cor_hex = matchedColor;
            
            const trColor = tr.querySelector('.cell-color');
            if (trColor) {
              const colorDisplay = trColor.querySelector('.cell-display');
              const colorInput = trColor.querySelector('.cell-edit-input');
              colorDisplay.innerHTML = `
                <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background-color: ${matchedColor}; border: 1px solid rgba(255,255,255,0.2);"></span>
                ${matchedColor}
              `;
              if (colorInput) colorInput.value = matchedColor;
            }
          } else if (field === 'COR_HEX') {
            layer.feature.properties.cor_hex = newValue;
            display.innerHTML = `
              <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background-color: ${newValue}; border: 1px solid rgba(255,255,255,0.2);"></span>
              ${newValue}
            `;
            // Propaga a nova cor para todas as outras comunidades do mesmo complexo
            const currentComplex = layer.feature.properties.COMPLEXO || 'Outros';
            stateManager.complexes[currentComplex] = newValue;
            
            mapController.geoJsonLayer.getLayers().forEach(l => {
              if ((l.feature.properties.COMPLEXO || 'Outros') === currentComplex) {
                l.feature.properties.COR_HEX = newValue;
                l.feature.properties.cor_hex = newValue;
              }
            });
            
            // Força re-render para atualizar todas as linhas
            setTimeout(() => this.renderTable(), 100);
          }
          display.classList.remove('cell-empty');
          changed = true;
        }

        input.style.display = 'none';
        display.style.display = '';
      });

      editBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar`;
      editBtn.style.background = 'rgba(59,130,246,0.1)';
      editBtn.style.color = 'var(--accent)';
      editBtn.dataset.editing = 'false';

      if (changed) this.saveToServer();
    } else {
      // Entrar em modo edição
      cells.forEach(cell => {
        const input = cell.querySelector('.cell-edit-input');
        const display = cell.querySelector('.cell-display');
        display.style.display = 'none';
        input.style.display = '';
        input.focus();
      });

      editBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Salvar`;
      editBtn.style.background = 'rgba(16,185,129,0.15)';
      editBtn.style.color = '#10b981';
      editBtn.dataset.editing = 'true';

      // Enter para confirmar
      cells.forEach(cell => {
        const input = cell.querySelector('.cell-edit-input');
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            editBtn.click();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            // Cancelar
            input.style.display = 'none';
            cell.querySelector('.cell-display').style.display = '';
            editBtn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar`;
            editBtn.style.background = 'rgba(59,130,246,0.1)';
            editBtn.style.color = 'var(--accent)';
            editBtn.dataset.editing = 'false';
          }
        });
      });
    }
  },

  startCellEdit(cell, layer) {
    const input = cell.querySelector('.cell-edit-input');
    const display = cell.querySelector('.cell-display');
    display.style.display = 'none';
    input.style.display = '';
    input.focus();
    if (input.select) input.select();

    const save = async () => {
      const field = cell.dataset.field;
      let newValue = input.value.trim();

      if (field === 'COMPLEXO' && newValue === '__NEW__') {
        const res = await window.showCreateComplexModal();
        if (res) {
          stateManager.complexes[res.name] = res.color;
          newValue = res.name;
        } else {
          newValue = layer.feature.properties.COMPLEXO || 'Outros';
        }
      }

      if (newValue && newValue !== layer.feature.properties[field]) {
        layer.feature.properties[field] = newValue;
        
        if (field === 'COMUNIDADE') {
          layer.feature.properties.name = newValue;
          display.textContent = newValue;
        } else if (field === 'COMPLEXO') {
          display.textContent = newValue;
          const matchedColor = stateManager.complexes[newValue] || '#cccccc';
          layer.feature.properties.COR_HEX = matchedColor;
          layer.feature.properties.cor_hex = matchedColor;
          
          const tr = cell.closest('tr');
          const colorCell = tr.querySelector('.cell-color');
          if (colorCell) {
            const colorDisplay = colorCell.querySelector('.cell-display');
            const colorInput = colorCell.querySelector('.cell-edit-input');
            colorDisplay.innerHTML = `
              <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background-color: ${matchedColor}; border: 1px solid rgba(255,255,255,0.2);"></span>
              ${matchedColor}
            `;
            if (colorInput) colorInput.value = matchedColor;
          }
        } else if (field === 'COR_HEX') {
          layer.feature.properties.cor_hex = newValue;
          display.innerHTML = `
            <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background-color: ${newValue}; border: 1px solid rgba(255,255,255,0.2);"></span>
            ${newValue}
          `;
          
          const currentComplex = layer.feature.properties.COMPLEXO || 'Outros';
          stateManager.complexes[currentComplex] = newValue;
          
          mapController.geoJsonLayer.getLayers().forEach(l => {
            if ((l.feature.properties.COMPLEXO || 'Outros') === currentComplex) {
              l.feature.properties.COR_HEX = newValue;
              l.feature.properties.cor_hex = newValue;
            }
          });
          
          setTimeout(() => this.renderTable(), 100);
        }
        display.classList.remove('cell-empty');
        this.saveToServer();
      }
      input.style.display = 'none';
      display.style.display = '';
    };

    // Para select, salvamos no evento 'change'
    if (input.tagName === 'SELECT') {
      input.addEventListener('change', () => {
        save();
      }, { once: true });
      input.addEventListener('blur', () => {
        setTimeout(() => {
          input.style.display = 'none';
          display.style.display = '';
        }, 150);
      }, { once: true });
    } else {
      input.addEventListener('blur', save, { once: true });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = (field === 'COR_HEX' ? layer.feature.properties.COR_HEX : display.textContent); input.blur(); }
      });
    }
  },

  escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  updateCheckboxes() {
    this.tableBody.querySelectorAll('.row-checkbox-cleaner').forEach(cb => {
      cb.checked = this.selectedIds.has(cb.dataset.id);
    });
  },

  updateDeleteButton() {
    const count = this.selectedIds.size;
    this.selectedCountSpan.textContent = count;
    this.btnDeleteSelected.disabled = count === 0;
    this.btnDeleteSelected.style.opacity = count === 0 ? '0.5' : '1';
  },

  async deleteSelected() {
    const count = this.selectedIds.size;
    if (count === 0) return;
    const confirmDelete = await window.showCustomConfirm('Excluir Selecionados', `Excluir ${count} comunidade(s) permanentemente?`);
    if (confirmDelete) {
      await this.performDeletion(Array.from(this.selectedIds));
    }
  },

  async performDeletion(idsToDelete) {
    const idSet = new Set(idsToDelete);
    mapController.geoJsonLayer.getLayers().forEach(layer => {
      if (idSet.has(layer.feature.id)) {
        mapController.geoJsonLayer.removeLayer(layer);
      }
    });
    await this.saveToServer();
    alert(`${idsToDelete.length} comunidade(s) excluída(s)!`);
    location.reload();
  },

  async saveToServer() {
    const featureCollection = mapController.geoJsonLayer.toGeoJSON();
    try {
      const response = await api.post('api/save-geojson', { featureCollection });
      const result = await response.json();
      if (!response.ok) {
        alert('Erro ao salvar: ' + result.error);
      }
    } catch (err) {
      console.error('[Cleaner] Falha ao salvar:', err);
      alert('Falha de comunicação com o servidor.');
    }
  },

  switchTab(tabId) {
    if (tabId === 'comunidades') {
      this.tabComunidadesBtn.classList.add('active');
      this.tabComplexosBtn.classList.remove('active');
      this.tabComunidadesContent.style.display = 'flex';
      this.tabComplexosContent.style.display = 'none';
    } else {
      this.tabComunidadesBtn.classList.remove('active');
      this.tabComplexosBtn.classList.add('active');
      this.tabComunidadesContent.style.display = 'none';
      this.tabComplexosContent.style.display = 'flex';
      this.renderComplexesTable();
    }
  },

  renderComplexesTable() {
    this.complexosTableBody.innerHTML = '';
    const query = this.complexosSearchInput.value.trim().toLowerCase();
    
    // Lista de complexos filtrados
    const complexesList = Object.keys(stateManager.complexes).filter(comp => {
      if (comp === 'Outros') return false; // Não editamos "Outros" como complexo
      return comp.toLowerCase().includes(query);
    }).sort((a, b) => a.localeCompare(b));

    if (complexesList.length === 0) {
      this.complexosTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: 30px; text-align: center; color: var(--text-secondary);">
            Nenhum complexo cadastrado.
          </td>
        </tr>
      `;
      return;
    }

    complexesList.forEach(complexName => {
      const color = stateManager.complexes[complexName] || '#cccccc';
      
      // Encontrar comunidades associadas
      const assocComs = this.layersData.filter(layer => {
        const cName = layer.feature.properties.COMPLEXO || 'Outros';
        return cName === complexName;
      });

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      
      // Nome do Complexo Cell
      const nameTd = document.createElement('td');
      nameTd.style.padding = '12px';
      nameTd.innerHTML = `<span style="font-weight: 600; color: var(--text-primary);">${complexName}</span>`;

      // Cor Cell
      const colorTd = document.createElement('td');
      colorTd.style.padding = '12px';
      colorTd.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background-color: ${color}; border: 1px solid rgba(255,255,255,0.2);"></span>
          <span style="font-size: 0.85rem; color: var(--text-secondary);">${color}</span>
        </div>
      `;

      // Comunidades Cell (tags de associação)
      const comsTd = document.createElement('td');
      comsTd.style.padding = '12px';
      
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'assoc-tags-container';

      assocComs.forEach(com => {
        const tag = document.createElement('span');
        tag.className = 'assoc-tag';
        tag.textContent = com.feature.properties.COMUNIDADE || com.feature.properties.name;
        tagsContainer.appendChild(tag);
      });

      if (assocComs.length === 0) {
        const spanNoComs = document.createElement('span');
        spanNoComs.style.fontSize = '0.85rem';
        spanNoComs.style.color = 'var(--text-secondary)';
        spanNoComs.style.fontStyle = 'italic';
        spanNoComs.textContent = 'Nenhuma comunidade';
        tagsContainer.appendChild(spanNoComs);
      }

      comsTd.appendChild(tagsContainer);

      // Ações Cell
      const actionsTd = document.createElement('td');
      actionsTd.style.padding = '12px';
      actionsTd.style.textAlign = 'center';
      
      const allHidden = assocComs.length > 0 && assocComs.every(com => com.feature.properties.oculto);
      
      actionsTd.innerHTML = `
        <div style="display: flex; gap: 6px; justify-content: center;">
          <button class="btn-action-visibility-complex" title="Ocultar/Mostrar todas as comunidades deste complexo" style="background: ${allHidden ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; border: none; color: ${allHidden ? 'var(--danger)' : '#10b981'}; cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
            ${allHidden ? 
              `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>` : 
              `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
            }
          </button>
          <button class="btn-action-edit-complex" title="Editar Complexo" style="background: rgba(59, 130, 246, 0.1); border: none; color: var(--accent); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-action-delete" title="Excluir Complexo" style="background: rgba(239, 68, 68, 0.1); border: none; color: var(--danger); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      // Evento Visibilidade do Complexo
      actionsTd.querySelector('.btn-action-visibility-complex').addEventListener('click', async (e) => {
        e.stopPropagation();
        const setOculto = !allHidden;
        assocComs.forEach(com => {
          com.feature.properties.oculto = setOculto;
        });
        
        try {
          const featureCollection = mapController.geoJsonLayer.toGeoJSON();
          await api.post('api/save-geojson', { featureCollection });
          mapController.updateFilters();
          uiController.renderList(stateManager.features);
          this.renderComplexesTable();
        } catch(err) {
          console.error(err);
          alert('Erro ao atualizar visibilidade');
        }
      });

      // Evento Editar Complexo
      actionsTd.querySelector('.btn-action-edit-complex').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditComplexModal(complexName);
      });

      // Evento Excluir Complexo
      actionsTd.querySelector('.btn-action-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmDelete = await window.showCustomConfirm('Excluir Complexo', `Tem certeza que deseja excluir o complexo "${complexName}"?\nTodas as comunidades associadas passarão a ser "Outros" (sem complexo).`);
        if (confirmDelete) {
          this.layersData.forEach(l => {
            if ((l.feature.properties.COMPLEXO || 'Outros') === complexName) {
              l.feature.properties.COMPLEXO = 'Outros';
              l.feature.properties.COR_HEX = '#cccccc';
              l.feature.properties.cor_hex = '#cccccc';
            }
          });
          delete stateManager.complexes[complexName];
          await this.saveToServer();
          this.activate();
        }
      });

      tr.appendChild(nameTd);
      tr.appendChild(colorTd);
      tr.appendChild(comsTd);
      tr.appendChild(actionsTd);
      this.complexosTableBody.appendChild(tr);
    });
  },

  openEditComplexModal(complexName) {
    this.currentEditingComplex = complexName;
    const color = stateManager.complexes[complexName] || '#cccccc';

    const modal = document.getElementById('editComplexModal');
    const nameInput = document.getElementById('editComplexModalName');
    const colorHexInput = document.getElementById('editComplexModalColorHex');
    const comsList = document.getElementById('editComplexModalComsList');
    const addComSelect = document.getElementById('editComplexModalAddComSelect');
    const btnSave = document.getElementById('btnSaveComplexModal');
    const btnCancel = document.getElementById('btnCancelComplexModal');
    const btnDelete = document.getElementById('btnDeleteComplexModal');

    nameInput.value = complexName;
    colorHexInput.value = color;
    // Inicializa o seletor de cor híbrido
    if (window.initColorPicker || typeof initColorPicker === 'function') {
      // initColorPicker é definida em uiController.js mas não é exportada globalmente;
      // usamos um evento para dispará-la após o modal ser exibido
    }

    const renderComsTags = () => {
      comsList.innerHTML = '';
      const assocComs = this.layersData.filter(layer => {
        const cName = layer.feature.properties.COMPLEXO || 'Outros';
        return cName === this.currentEditingComplex;
      });

      assocComs.forEach(com => {
        const tag = document.createElement('span');
        tag.className = 'assoc-tag';
        tag.innerHTML = `
          ${com.feature.properties.COMUNIDADE || com.feature.properties.name}
          <button class="remove-assoc" title="Remover do complexo" style="background:none; border:none; color:var(--danger); cursor:pointer; font-weight:bold; margin-left:5px;">&times;</button>
        `;
        
        tag.querySelector('.remove-assoc').addEventListener('click', () => {
          com.feature.properties.COMPLEXO = 'Outros';
          com.feature.properties.COR_HEX = '#cccccc';
          com.feature.properties.cor_hex = '#cccccc';
          renderComsTags();
          populateAddComSelect();
        });
        comsList.appendChild(tag);
      });

      if (assocComs.length === 0) {
        comsList.innerHTML = '<span style="font-size:0.85rem; color:var(--text-secondary); font-style:italic;">Nenhuma comunidade associada</span>';
      }
    };

    const populateAddComSelect = () => {
      addComSelect.innerHTML = '<option value="" disabled selected>Escolha uma comunidade...</option>';
      const availableComs = this.layersData.filter(layer => {
        return (layer.feature.properties.COMPLEXO || 'Outros') !== this.currentEditingComplex;
      });

      availableComs.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.feature.id;
        opt.textContent = l.feature.properties.COMUNIDADE || l.feature.properties.name;
        addComSelect.appendChild(opt);
      });
    };

    addComSelect.onchange = () => {
      const comId = addComSelect.value;
      const targetLayer = this.layersData.find(l => String(l.feature.id) === String(comId));
      if (targetLayer) {
        targetLayer.feature.properties.COMPLEXO = this.currentEditingComplex;
        const chosenColor = colorHexInput.value.trim() || '#cccccc';
        targetLayer.feature.properties.COR_HEX = chosenColor;
        targetLayer.feature.properties.cor_hex = chosenColor;
        renderComsTags();
        populateAddComSelect();
        addComSelect.value = '';
      }
    };

    renderComsTags();
    populateAddComSelect();

    btnCancel.onclick = () => {
      modal.style.display = 'none';
    };

    btnDelete.onclick = async () => {
      const confirmDelete = await window.showCustomConfirm('Excluir Complexo', `Tem certeza que deseja excluir o complexo "${complexName}"?\nTodas as comunidades associadas passarão a ser "Outros" (sem complexo).`);
      if (confirmDelete) {
        this.layersData.forEach(l => {
          if ((l.feature.properties.COMPLEXO || 'Outros') === complexName) {
            l.feature.properties.COMPLEXO = 'Outros';
            l.feature.properties.COR_HEX = '#cccccc';
            l.feature.properties.cor_hex = '#cccccc';
          }
        });
        delete stateManager.complexes[complexName];
        await this.saveToServer();
        modal.style.display = 'none';
        this.activate();
      }
    };

    btnSave.onclick = async () => {
      const newName = nameInput.value.trim();
      if (!newName) {
        alert('Nome inválido.');
        return;
      }

      const rawColor = colorHexInput.value.trim();
      const newColor = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : '#cccccc';

      if (newName !== complexName) {
        if (stateManager.complexes[newName]) {
          alert('Já existe um complexo com este nome.');
          return;
        }
        delete stateManager.complexes[complexName];
      }
      stateManager.complexes[newName] = newColor;

      this.layersData.forEach(l => {
        const cName = l.feature.properties.COMPLEXO || 'Outros';
        if (cName === complexName) {
          l.feature.properties.COMPLEXO = newName;
          l.feature.properties.COR_HEX = newColor;
          l.feature.properties.cor_hex = newColor;
        } else if (cName === newName) {
          l.feature.properties.COR_HEX = newColor;
          l.feature.properties.cor_hex = newColor;
        }
      });

      await this.saveToServer();
      modal.style.display = 'none';
      this.activate();
    };

    modal.style.display = 'flex';
    // Inicializa seletor de cor híbrido após exibir o modal
    setTimeout(() => {
      const hexIn = document.getElementById('editComplexModalColorHex');
      const picker = document.getElementById('editComplexModalColorPicker');
      const preview = document.getElementById('editComplexModalColorPreview');
      if (hexIn && picker && preview) {
        // sync inicial: set preview and picker
        picker.value = hexIn.value;
        preview.style.background = hexIn.value;
        // Swatches
        document.querySelectorAll('.color-swatch[data-target="editComplexModalColorHex"]').forEach(s => {
          s.addEventListener('click', () => {
            const bg = s.style.background;
            const hex = bg.startsWith('#') ? bg : (() => {
              const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
              return m ? '#'+[m[1],m[2],m[3]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('') : bg;
            })();
            hexIn.value = hex;
            picker.value = hex;
            preview.style.background = hex;
            document.querySelectorAll('.color-swatch[data-target="editComplexModalColorHex"]').forEach(sw => sw.classList.remove('selected'));
            s.classList.add('selected');
          });
        });
        hexIn.addEventListener('input', () => {
          if (/^#[0-9a-fA-F]{6}$/.test(hexIn.value)) {
            picker.value = hexIn.value;
            preview.style.background = hexIn.value;
          }
        });
        picker.addEventListener('input', () => {
          hexIn.value = picker.value;
          preview.style.background = picker.value;
        });
        // Highlight matching swatch
        document.querySelectorAll('.color-swatch[data-target="editComplexModalColorHex"]').forEach(s => {
          const bg = s.style.background;
          const hex = bg.startsWith('#') ? bg.toLowerCase() : (() => {
            const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            return m ? '#'+[m[1],m[2],m[3]].map(n=>parseInt(n).toString(16).padStart(2,'0')).join('') : bg;
          })();
          s.classList.toggle('selected', hex === hexIn.value.toLowerCase());
        });
      }
    }, 0);
  },

  async handleCreateComplex() {
    const res = await window.showCreateComplexModal();
    if (!res) return;

    const { name, color } = res;
    if (stateManager.complexes[name]) {
      alert('Este complexo já existe.');
      return;
    }

    stateManager.complexes[name] = color;

    // Recarregar
    this.renderComplexesTable();
  }
};
