import { mapController } from './mapController.js';
import { stateManager } from './stateManager.js';
import { api } from '../utils/api.js';

export const editorController = {
    isEditing: false,
    editedLayer: null,
    editorMap: null,
    geoJsonData: null,

    init() {
        this.btnNew = document.getElementById('btnNewPolygon');
        this.btnSave = document.getElementById('btnSaveGeoJson');
        this.btnCancel = document.getElementById('btnCancelEdit');
        this.btnDelete = document.getElementById('btnDeletePolygon');
        this.btnFinish = document.getElementById('btnFinishDrawing');
        this.statusText = document.getElementById('editorStatus');
        this.statusCard = document.querySelector('.editor-status-card');

        // Importação de GeoJSON
        this.btnImport      = document.getElementById('btnImportGeoJson');
        this.fileInput      = document.getElementById('geojsonFileInput');
        this.replaceCheck   = document.getElementById('replaceExistingCheck');
        this.importResult   = document.getElementById('importResult');

        this.bindEvents();
    },

    bindEvents() {
        this.btnNew.addEventListener('click', () => this.startNewPolygon());
        this.btnSave.addEventListener('click', () => this.saveChanges());
        this.btnCancel.addEventListener('click', () => this.cancelEdit());
        this.btnDelete.addEventListener('click', () => this.deleteSelected());
        this.btnFinish.addEventListener('click', () => this.editorMap.editTools.stopDrawing());

        // Escuta eventos de clique em camadas vindo do mapController
        document.addEventListener('asa:layer:edit', (e) => {
            this.editedLayer = e.detail.layer;
            const comName = this.editedLayer.feature.properties.COMUNIDADE || this.editedLayer.feature.properties.name || this.editedLayer.feature.properties.neighborhood || 'Desconhecido';
            this.setEditState(true, `Editando: ${comName}`);
        });

        this.btnImport.addEventListener('click', () => this.fileInput.click());

        // Quando um arquivo é selecionado, processa automaticamente
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.processImportFile(file);
            // Reset para permitir selecionar o mesmo arquivo novamente
            this.fileInput.value = '';
        });
    },

    activate() {
        console.log('Editor Territorial Ativado');
        // Usar o mapa principal para edição
        this.editorMap = mapController.map;
        this.showInstructions(true);
    },

    startNewPolygon() {
        this.setEditState(true, 'Desenhe no mapa clicando nos pontos');
        this.btnFinish.style.display = 'flex';
        this.btnNew.style.display = 'none';

        const polygon = this.editorMap.editTools.startPolygon();
        
        polygon.on('editable:drawing:end', (e) => {
            this.btnFinish.style.display = 'none';
            // Timeout curto para garantir que o prompt não bloqueie o fim do evento de desenho
            setTimeout(async () => {
                const res = await window.showCreateCommunityModal(stateManager.complexes);
                if (res) {
                    const { name, neighborhood, complex, newComplexName, newComplexColor } = res;
                    
                    let complexo = complex;
                    let corHex = '#cccccc';
                    
                    if (newComplexName) {
                        corHex = newComplexColor || '#ff0000';
                        stateManager.complexes[newComplexName] = corHex;
                    } else if (complexo && complexo !== 'Outros') {
                        corHex = stateManager.complexes[complexo] || '#cccccc';
                    }
                    
                    const newId = Math.floor(1000 + Math.random() * 9000);
                    e.layer.feature = {
                        type: 'Feature',
                        id: newId,
                        properties: { 
                            id: newId,
                            COMUNIDADE: name,
                            name: name,
                            NEIGHBORHOOD: neighborhood,
                            neighborhood: neighborhood,
                            COMPLEXO: complexo,
                            COR_HEX: corHex,
                            cor_hex: corHex,
                            oculto: false
                        }
                    };
                    
                    // Adicionar ao mapa principal
                    mapController.geoJsonLayer.addData(e.layer.feature);
                    
                    // Remover o layer temporário de desenho
                    e.layer.remove();
                    
                    this.editedLayer = null;
                    this.setEditState(true, `Comunidade "${name}" criada (Clique em Salvar)`);
                } else {
                    e.layer.remove();
                    this.setEditState(false);
                }
            }, 50);
        });
    },

    deleteSelected() {
        if (!this.editedLayer) {
            alert('Nenhuma comunidade selecionada para exclusão.');
            return;
        }

        const name = this.editedLayer.feature.properties.COMUNIDADE || this.editedLayer.feature.properties.name || this.editedLayer.feature.properties.neighborhood;
        
        // Uso de modal customizado
        window.showCustomConfirm('Excluir Comunidade', `Tem certeza que deseja REMOVER COMPLETAMENTE a comunidade "${name}"?`)
            .then((confirmDelete) => {
                if (confirmDelete) {
                    mapController.geoJsonLayer.removeLayer(this.editedLayer);
                    this.setEditState(true, 'Comunidade removida (Clique em Salvar)');
                }
            });
    },

    setEditState(active, text = 'Modo Visualização') {
        this.isEditing = active;
        this.statusText.textContent = text;
        this.btnSave.style.display = active ? 'flex' : 'none';
        this.btnCancel.style.display = active ? 'flex' : 'none';
        this.btnDelete.style.display = (active && this.editedLayer) ? 'flex' : 'none';
        this.btnNew.style.display = active ? 'none' : 'flex';
        this.btnFinish.style.display = 'none';
        
        if (active) {
            this.statusCard.classList.add('editor-active');
        } else {
            this.statusCard.classList.remove('editor-active');
        }
    },

    async saveChanges() {
        // Coleta o GeoJSON atualizado do layer principal
        const featureCollection = mapController.geoJsonLayer.toGeoJSON();
        
        // Se houver um novo layer sendo editado que não está no geoJsonLayer ainda
        if (this.editedLayer && !featureCollection.features.find(f => f.id === this.editedLayer.feature.id)) {
            featureCollection.features.push(this.editedLayer.toGeoJSON());
        }

        // Token de segurança para ambiente de produção
        // Token de segurança removido; operação de salvamento sem autenticação.
// Não solicitamos token ao usuário.
// Continuação da lógica de salvamento permanece igual.

        try {
            const response = await api.post('api/save-geojson', { featureCollection });

            const result = await response.json();
            if (response.ok) {
                alert('Alterações salvas e sincronizadas com sucesso no banco de dados e arquivos!');
                this.setEditState(false);
                location.reload(); 
            } else if (response.status === 403) {
                alert('Token Inválido. Acesso negado.');
                sessionStorage.removeItem('ac_admin_token'); // Limpar para pedir de novo
            } else {
                alert('Erro ao salvar: ' + result.error);
            }
        } catch (error) {
            console.error('Erro na requisição:', error);
            alert('Falha crítica ao salvar GeoJSON.');
        }
    },

    async cancelEdit() {
        const discard = await window.showCustomConfirm('Descartar Alterações', 'Descartar alterações não salvas?');
        if (discard) {
            location.reload();
        }
    },

    showInstructions(show) {
        // Implementação de UI se necessário
    },

    /**
     * Lê o arquivo GeoJSON selecionado, valida localmente e envia ao backend.
     * Exibe feedback visual de progresso e resultado no painel lateral.
     */
    processImportFile(file) {
        // Validação básica de extensão no cliente
        const allowedTypes = ['application/json', 'application/geo+json', ''];
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.geojson') && !fileName.endsWith('.json')) {
            this.showImportResult('error', `Arquivo inválido: "${file.name}". Use .geojson ou .json.`);
            return;
        }

        // Estado de loading
        this.btnImport.disabled = true;
        this.btnImport.classList.add('loading');
        this.btnImport.textContent = 'Processando...';
        this.importResult.style.display = 'none';

        const reader = new FileReader();

        reader.onload = async (e) => {
            let featureCollection;

            // Parse e validação local antes de enviar
            try {
                featureCollection = JSON.parse(e.target.result);
            } catch (parseErr) {
                this.showImportResult('error', `Erro ao ler o arquivo: JSON inválido ou corrompido.`);
                this.resetImportButton();
                return;
            }

            if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
                this.showImportResult('error', 'O arquivo não é um GeoJSON válido (deve ser FeatureCollection).');
                this.resetImportButton();
                return;
            }

            const featureCount = Array.isArray(featureCollection.features) 
                ? featureCollection.features.length : 0;
            
            if (featureCount === 0) {
                this.showImportResult('error', 'O arquivo GeoJSON não contém nenhuma feature.');
                this.resetImportButton();
                return;
            }

            // Token de segurança removido; operação de importação sem autenticação.
            // Nenhum token será enviado ao backend.

            const replaceExisting = this.replaceCheck ? this.replaceCheck.checked : false;

            try {
                const response = await api.post('api/import-geojson', { featureCollection, replaceExisting });

                const result = await response.json();

                if (response.ok) {
                    const s = result.summary;
                    this.showImportResult('success', result.message, s);

                    // Recarregar o mapa após 2s para refletir os novos dados
                    setTimeout(() => location.reload(), 2500);
                } else if (response.status === 403) {
                    sessionStorage.removeItem('ac_admin_token');
                    this.showImportResult('error', 'Token inválido. Acesso negado.');
                } else {
                    this.showImportResult('error', result.error || 'Erro desconhecido no servidor.');
                }
            } catch (networkErr) {
                console.error('[Import] Falha de rede:', networkErr);
                this.showImportResult('error', 'Falha de conexão com o servidor. Verifique se o servidor está rodando.');
            }

            this.resetImportButton();
        };

        reader.onerror = () => {
            this.showImportResult('error', 'Não foi possível ler o arquivo selecionado.');
            this.resetImportButton();
        };

        reader.readAsText(file, 'UTF-8');
    },

    resetImportButton() {
        this.btnImport.disabled = false;
        this.btnImport.classList.remove('loading');
        this.btnImport.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Selecionar Arquivo`;
    },

    showImportResult(type, message, summary = null) {
        this.importResult.className = `import-result ${type}`;
        this.importResult.style.display = 'block';

        const icon = type === 'success' ? '✅' : '❌';
        let html = `<div class="result-title">${icon} ${message}</div>`;

        if (summary) {
            html += `
                <div class="result-stats">
                    <div class="result-stat"><span>Importadas</span><strong>${summary.imported}</strong></div>
                    <div class="result-stat"><span>Puladas</span><strong>${summary.skipped}</strong></div>
                    <div class="result-stat"><span>Substituídas</span><strong>${summary.replaced}</strong></div>
                    <div class="result-stat"><span>Total na base</span><strong>${summary.totalFeatures}</strong></div>
                </div>
            `;
        }

        if (type === 'success') {
            html += `<div style="margin-top:8px; font-size:0.78rem; opacity:0.7;">Recarregando o mapa...</div>`;
        }

        this.importResult.innerHTML = html;
    }
};
