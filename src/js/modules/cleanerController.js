import { mapController } from './mapController.js';
import { uiController } from './uiController.js';
import { api } from '../utils/api.js';

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
    this.updateDeleteButton();
  },

  getFilteredLayers() {
    const query = this.searchInput.value.trim().toLowerCase();
    if (!query) return this.layersData;
    return this.layersData.filter(layer => {
      const name = (layer.feature.properties.name || '').toLowerCase();
      const neighborhood = (layer.feature.properties.neighborhood || '').toLowerCase();
      return name.includes(query) || neighborhood.includes(query);
    });
  },

  renderTable() {
    this.tableBody.innerHTML = '';
    const filtered = this.getFilteredLayers();

    filtered.sort((a, b) => {
      const nameA = a.feature.properties.name || '';
      const nameB = b.feature.properties.name || '';
      return nameA.localeCompare(nameB);
    });

    if (filtered.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 30px; text-align: center; color: var(--text-secondary);">
            Nenhuma comunidade localizada.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(layer => {
      const id = layer.feature.id;
      const name = layer.feature.properties.name || 'Sem nome';
      const neighborhood = layer.feature.properties.neighborhood || 'Duque de Caxias';
      const geomType = layer.feature.geometry.type;
      const isChecked = this.selectedIds.has(id);
      const hasNoName = !layer.feature.properties.name || layer.feature.properties.name.trim() === '';

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      tr.style.transition = 'background 0.2s';
      tr.addEventListener('mouseenter', () => tr.style.background = 'var(--glass-hover)');
      tr.addEventListener('mouseleave', () => tr.style.background = 'transparent');

      tr.innerHTML = `
        <td style="padding: 12px; text-align: center;">
          <input type="checkbox" class="row-checkbox-cleaner" data-id="${id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
        </td>
        <td style="padding: 12px;" class="cell-name">
          <div class="editable-cell" data-field="name" data-id="${id}">
            <span class="cell-display ${hasNoName ? 'cell-empty' : ''}" title="Clique para editar">${name}</span>
            <input type="text" class="cell-edit-input" value="${this.escapeAttr(name === 'Sem nome' ? '' : name)}" placeholder="Nome da comunidade" style="display:none;">
          </div>
        </td>
        <td style="padding: 12px;" class="cell-neighborhood">
          <div class="editable-cell" data-field="neighborhood" data-id="${id}">
            <span class="cell-display" title="Clique para editar">${neighborhood}</span>
            <input type="text" class="cell-edit-input" value="${this.escapeAttr(neighborhood)}" placeholder="Bairro" style="display:none;">
          </div>
        </td>
        <td style="padding: 12px; color: var(--text-secondary);">
          <span style="background: var(--glass-bg-dense); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; text-transform: uppercase;">
            ${geomType}
          </span>
        </td>
        <td style="padding: 12px; text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center;">
            <button class="btn-action-edit" title="Editar nome/bairro" style="background: rgba(59,130,246,0.1); border: none; color: var(--accent); cursor: pointer; padding: 6px 8px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; gap: 4px; font-size: 0.75rem; font-weight: 600;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
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

      // Botão Editar — ativa inputs inline
      tr.querySelector('.btn-action-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleEditMode(tr, layer);
      });

      // Botão Zoom
      tr.querySelector('.btn-action-zoom').addEventListener('click', (e) => {
        e.stopPropagation();
        const center = layer.getBounds().getCenter();
        uiController.switchView('map');
        setTimeout(() => mapController.map.flyTo(center, 15), 200);
      });

      // Botão Deletar individual
      tr.querySelector('.btn-action-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Excluir permanentemente "${name}"?`)) {
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
      cells.forEach(cell => {
        const field = cell.dataset.field;
        const input = cell.querySelector('.cell-edit-input');
        const display = cell.querySelector('.cell-display');
        const newValue = input.value.trim();

        if (newValue && newValue !== layer.feature.properties[field]) {
          layer.feature.properties[field] = newValue;
          display.textContent = newValue;
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
    input.select();

    const save = () => {
      const field = cell.dataset.field;
      const newValue = input.value.trim();
      if (newValue && newValue !== layer.feature.properties[field]) {
        layer.feature.properties[field] = newValue;
        display.textContent = newValue;
        display.classList.remove('cell-empty');
        this.saveToServer();
      }
      input.style.display = 'none';
      display.style.display = '';
    };

    input.addEventListener('blur', save, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = display.textContent; input.blur(); }
    });
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
    if (confirm(`Excluir ${count} comunidade(s) permanentemente?`)) {
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
  }
};
