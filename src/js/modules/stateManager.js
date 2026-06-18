import { generateColor } from '../utils/colorGenerator.js';

export const stateManager = {
  data: null,
  features: [],
  selectedIds: new Set(),
  colors: new Map(),
  complexes: {},

  init(geojsonData) {
    this.data = geojsonData;
    
    // Lista padrão de complexos com cores institucionais
    this.complexes = {
      'COMPLEXO DO LIXÃO': '#ff0000',
      'COMPLEXO DO BEIRA MAR': '#ff8c00',
      'COMPLEXO DO JARDIM GRAMACHO': '#ffff00',
      'COMPLEXO DO BARRO VERMELHO': '#0000ff',
      'COMPLEXO DO CANGULO': '#aa0000',
      'COMPLEXO DO SÃO BENTO': '#00007f',
      'COMPLEXO DA MANGUEIRINHA': '#ff5500',
      'COMPLEXO DO VAI QUEM QUER': '#00aa00',
      'COMPLEXO DE PARADA ANGÉLICA': '#aa007f',
      'COMPLEXO DE IMBARIÊ': '#aa00ff',
      'Outros': '#cccccc'
    };

    // Escaneia feições para capturar novos complexos inseridos
    geojsonData.features.forEach(f => {
      const props = f.properties || {};
      const comp = props.COMPLEXO || props.complexo || props.Complexo;
      const cor = props.COR_HEX || props.cor_hex || props.color || props.cor;
      if (comp && cor && !this.complexes[comp]) {
        this.complexes[comp] = cor;
      }
    });

    this.features = geojsonData.features.map((f, i) => {
      const id = String(f.id !== undefined && f.id !== null ? f.id : `feat_${i}`);
      f.id = id;
      f.properties = f.properties || {};
      f.properties.id = id;
      
      // Problema 3 corrigido: prioriza a cor_hex cadastrada para o complexo
      const color = f.properties.COR_HEX || f.properties.cor_hex || f.properties.color || f.properties.cor || generateColor(id);
      
      this.selectedIds.add(id);
      this.colors.set(id, color);
      
      // Problema 1 corrigido: prioriza o rótulo da comunidade sobre o bairro
      const communityName = f.properties.COMUNIDADE || f.properties.name || f.properties.neighborhood || 'Desconhecido';
      
      return {
        id,
        name: communityName,
        color,
        properties: f.properties,
        originalFeature: f
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  },

  toggleSelection(id) {
    const strId = String(id);
    if (this.selectedIds.has(strId)) {
      this.selectedIds.delete(strId);
    } else {
      this.selectedIds.add(strId);
    }
  },

  selectAll() {
    this.features.forEach(f => this.selectedIds.add(String(f.id)));
  },

  clearSelection() {
    this.selectedIds.clear();
  },

  isSelected(id) {
    return this.selectedIds.has(String(id));
  },

  getFeature(id) {
    const strId = String(id);
    return this.features.find(f => String(f.id) === strId);
  }
};
