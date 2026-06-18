import { stateManager } from './stateManager.js';

export const mapController = {
  map: null,
  geoJsonLayer: null,
  markersLayer: null,
  searchMarker: null,
  currentBaseLayer: 'Mapa Claro',

  init(containerId, geojsonData) {
    // Definindo os mapas base
    const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    });

    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    });

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    // Limites de Duque de Caxias (Expandidos para evitar erros na busca)
    const bounds = [
      [-22.95, -43.60], // Sudoeste
      [-22.35, -43.00]  // Nordeste
    ];

    this.map = L.map(containerId, {
      center: [-22.75, -43.3],
      zoom: 12,
      minZoom: 10,
      maxBounds: bounds,
      maxBoundsViscosity: 0.8,
      layers: [light],
      editable: true,
      editOptions: {
        // Estilo dos pontos principais (quadradinhos)
        vertexMarkerOptions: {
          icon: L.divIcon({
            className: 'leaflet-div-icon leaflet-editing-icon vertex-marker',
            iconSize: [12, 12]
          })
        },
        // Estilo das bolinhas do meio (para adicionar pontos)
        middleMarkerOptions: {
          icon: L.divIcon({
            className: 'leaflet-div-icon leaflet-editing-icon middle-marker',
            iconSize: [10, 10]
          }),
          opacity: 0.6
        }
      }
    });

    // Camada de labels (nomes de ruas) sempre no topo
    this.labelLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      pane: 'shadowPane',
      zIndex: 1000,
      opacity: 1.0 // Máximo destaque
    }).addTo(this.map);

    const baseMaps = {
      "Mapa Claro": light,
      "Mapa Escuro": dark,
      "Satélite": satellite
    };

    // Adiciona o botão de controle de camadas no canto INFERIOR DIREITO
    L.control.layers(baseMaps, null, { position: 'bottomright' }).addTo(this.map);

    this.map.on('baselayerchange', (e) => {
      this.currentBaseLayer = e.name;
      
      // Ajusta a cor dos nomes das ruas conforme o mapa
      const labelUrl = e.name === 'Mapa Escuro' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
      
      this.labelLayer.setUrl(labelUrl);
      this.updateFilters();
    });

    this.markersLayer = L.layerGroup().addTo(this.map);
    this.addSourcesAndLayers(geojsonData);
  },

  getLayerStyle(feature) {
    const id = feature.id;
    const color = stateManager.colors.get(id) || '#cccccc';
    const isVisible = stateManager.isSelected(id);
    const isOculto = feature.properties.oculto || feature.properties.OCULTO;
    
    if (isOculto || !isVisible) return { fillOpacity: 0, weight: 0, opacity: 0, interactive: false };

    switch(this.currentBaseLayer) {
      case 'Mapa Escuro':
        return {
          fillColor: color,
          weight: 2,
          opacity: 0.8,
          color: '#ffffff', // Borda branca para efeito neon no escuro
          fillOpacity: 0.25,
          className: 'neon-layer'
        };
      case 'Satélite':
        return {
          fillColor: color,
          weight: 2.5,
          opacity: 0.9,
          color: color,
          fillOpacity: 0.35 // Mais vívido no satélite
        };
      default: // Mapa Claro
        return {
          fillColor: color,
          weight: 1.5,
          opacity: 0.3,
          color: '#333333',
          fillOpacity: 0.12
        };
    }
  },

  addSourcesAndLayers(geojsonData) {
    this.geoJsonLayer = L.geoJSON(geojsonData, {
      style: (feature) => this.getLayerStyle(feature),
      onEachFeature: (feature, layer) => {
        // Problema 1 corrigido: prioriza 'COMUNIDADE' sobre 'neighborhood' (Bairro/Referência)
        const name = feature.properties.COMUNIDADE || feature.properties.name || feature.properties.neighborhood || 'Desconhecido';
        const id = feature.id;
        
        layer.bindTooltip(`<strong>${name}</strong>`, {
          sticky: true,
          className: 'custom-tooltip'
        });
        
        layer.on('mouseover', function () {
          if (stateManager.isSelected(id)) {
            this.setStyle({ 
              fillOpacity: mapController.currentBaseLayer === 'Mapa Claro' ? 0.3 : 0.5, 
              weight: 3 
            });
          }
        });
        
        layer.on('mouseout', function () {
          if (stateManager.isSelected(id)) {
            this.setStyle(mapController.getLayerStyle(feature));
          }
        });

        // Evento para permitir edição no modo editor
        layer.on('click', (e) => {
          if (window.asa_editor_active) {
            L.DomEvent.stop(e);
            
            // Fallback: garantir que o plugin está ativo
            if (!layer.enableEdit) {
              console.error('Erro: Leaflet.Editable não carregado corretamente.');
              return;
            }

            if (layer.editEnabled && layer.editEnabled()) {
              layer.disableEdit();
            } else {
              layer.enableEdit();
              document.dispatchEvent(new CustomEvent('asa:layer:edit', { detail: { layer } }));
            }
          }
        });
      }
    }).addTo(this.map);
  },

  boundaryLayer: null,

  updateFilters() {
    this.geoJsonLayer.setStyle((feature) => this.getLayerStyle(feature));
  },

  async toggleBoundary(show) {
    if (show) {
      if (this.boundaryLayer) {
        this.boundaryLayer.addTo(this.map);
      } else {
        try {
          const res = await fetch('src/data/Duque_de_Caxias.geojson');
          const geojson = await res.json();
          this.boundaryLayer = L.geoJSON(geojson, {
            style: {
              color: '#3b82f6', // elegante azul escuro
              weight: 3,
              dashArray: '6, 8',
              fillColor: '#3b82f6',
              fillOpacity: 0.03, // preenchimento extremamente sutil
              interactive: false // não intercepta cliques
            }
          }).addTo(this.map);
          
          // Opcional: Ajustar zoom para caber o limite de Caxias
          this.map.fitBounds(this.boundaryLayer.getBounds(), { padding: [20, 20] });
        } catch (err) {
          console.error('Erro ao carregar limite municipal:', err);
        }
      }
    } else {
      if (this.boundaryLayer) {
        this.map.removeLayer(this.boundaryLayer);
      }
    }
  },

  jumpTo(lat, lng, zoom = 18) {
    if (this.searchMarker) this.map.removeLayer(this.searchMarker);

    this.map.flyTo([lat, lng], zoom, {
        duration: 1.5,
        easeLinearity: 0.25
    });

    const icon = L.divIcon({
        className: 'search-marker-animated',
        html: '<div class="marker-pulse"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    this.searchMarker = L.marker([lat, lng], { icon }).addTo(this.map);
  }
};
