import { generateColor } from '../utils/colorGenerator.js';

export const stateManager = {
  data: null,
  features: [],
  selectedIds: new Set(),
  colors: new Map(),

  init(geojsonData) {
    this.data = geojsonData;
    this.features = geojsonData.features.map((f, i) => {
      const id = String(f.id !== undefined && f.id !== null ? f.id : `feat_${i}`);
      f.id = id;
      f.properties = f.properties || {};
      f.properties.id = id;
      
      const color = generateColor(id);
      
      this.selectedIds.add(id);
      this.colors.set(id, color);
      
      return {
        id,
        name: f.properties.neighborhood || f.properties.name || 'Desconhecido',
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
