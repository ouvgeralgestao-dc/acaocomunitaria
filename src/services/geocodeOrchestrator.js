const axios = require('axios');
const googleGeocoder = require('./googleGeocoder');
const cacheService = require('./cacheService');
const addressParser = require('../utils/addressParser');

class GeocodeOrchestrator {
  async autocomplete(query, limit = 5) {
    const cacheKey = `auto_${query.toLowerCase().trim()}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const results = await this.tryNominatim(query, limit, true);
    return this.finish(cacheKey, results || []);
  }

  async search(query, limit = 1) {
    const cacheKey = `search_${query.toLowerCase().trim()}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const parsed = addressParser.parse(query);
    console.log(`[Orchestrator] Query: "${query}" | Estruturado: ${parsed.isStructured}`);

    let result = null;

    if (googleGeocoder.isEnabled) {
      result = await googleGeocoder.geocode(query);
      if (result && result.confidence >= 0.9) {
        return this.finish(cacheKey, [result]);
      }
    }

    const hasNumber = !!parsed.number;

    if (hasNumber) {
      const arcgisResult = await this.tryArcGIS(query);
      if (arcgisResult && arcgisResult.confidence >= 0.85) {
        return this.finish(cacheKey, [arcgisResult]);
      }
    }

    let nominatimResults = [];
    try {
      console.log(`[Orchestrator] Tentando Nominatim Estruturado...`);
      nominatimResults = await this.tryNominatim(query, limit, false);
      
      if (!nominatimResults || nominatimResults.length === 0) {
        console.log(`[Orchestrator] Nominatim Estruturado falhou. Tentando Busca Livre...`);
        nominatimResults = await this.tryNominatim(query, limit, true);
      }
    } catch (e) {
      console.error('[Orchestrator] Nominatim critical failure:', e.message);
    }
    
    if (nominatimResults && nominatimResults.length > 0) {
      if (parsed.street && parsed.street.length > 3) {
        const streetTerm = parsed.street.split(' ').pop().toLowerCase(); 
        const filtered = nominatimResults.filter(r => 
          r.formattedAddress.toLowerCase().includes(streetTerm)
        );
        if (filtered.length > 0) nominatimResults = filtered;
      }

      const finalResults = result ? [result, ...nominatimResults] : nominatimResults;
      const uniqueResults = this.deduplicate(finalResults);
      console.log(`[Orchestrator] Busca concluída. ${uniqueResults.length} resultados.`);
      return this.finish(cacheKey, uniqueResults.slice(0, limit));
    }

    const photonResults = await this.tryPhoton(query, limit);
    return this.finish(cacheKey, photonResults || []);
  }

  deduplicate(results) {
    const seen = [];
    return results.filter(item => {
      const isDuplicate = seen.some(s => 
        Math.abs(s.lat - item.lat) < 0.0001 && 
        Math.abs(s.lng - item.lng) < 0.0001
      );
      if (isDuplicate) return false;
      seen.push(item);
      return true;
    });
  }

  finish(key, data) {
    if (data && data.length > 0) {
      cacheService.set(key, data);
    }
    return data;
  }

  async tryNominatim(q, limit, isAutocomplete = false) {
    try {
      const parsed = addressParser.parse(q);
      const params = {
        format: 'json',
        limit: limit,
        addressdetails: 1,
        countrycodes: 'br',
        viewbox: '-43.45,-22.85,-43.10,-22.45',
        bounded: 1
      };

      if (parsed.isStructured && !isAutocomplete) {
        params.street = parsed.number ? `${parsed.number} ${parsed.street}` : parsed.street;
        params.city = 'Duque de Caxias';
      } else {
        params.q = q.includes('Duque de Caxias') ? q : `${q}, Duque de Caxias, RJ`;
      }

      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params,
        headers: { 'User-Agent': 'SIMAC-Evolved' },
        timeout: 8000
      });

      return res.data
        .filter(item => {
          if (isAutocomplete) return true;
          const isPoi = ['shop', 'tourism', 'leisure', 'amenity'].includes(item.class);
          return !isPoi; 
        })
        .map(item => {
          const hasHouseNumber = !!(item.address && item.address.house_number);
          const isApproximated = !!(parsed.number && !hasHouseNumber);

          return {
            success: true,
            provider: 'nominatim',
            confidence: hasHouseNumber ? 0.9 : 0.7,
            isApproximated: isApproximated,
            formattedAddress: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            address: item.address
          };
        });
    } catch (e) {
      return null;
    }
  }

  async tryArcGIS(q) {
    try {
      const res = await axios.get('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates', {
        params: {
          f: 'json',
          singleLine: q,
          countryCode: 'BRA',
          maxLocations: 1,
          outFields: 'Addr_type,Address,City,Postal'
        },
        timeout: 8000
      });

      if (res.data.candidates && res.data.candidates.length > 0) {
        const c = res.data.candidates[0];
        const parsed = addressParser.parse(q);
        const hasNumber = c.attributes.Addr_type === 'PointAddress' || c.attributes.Addr_type === 'StreetAddress';
        
        return {
          success: true,
          provider: 'arcgis',
          confidence: hasNumber ? 0.95 : 0.7,
          isApproximated: !!(parsed.number && !hasNumber),
          formattedAddress: c.address,
          lat: c.location.y,
          lng: c.location.x,
          address: { road: c.address.split(',')[0] }
        };
      }
    } catch (e) {
      return null;
    }
  }

  async tryPhoton(q, limit) {
    try {
      const res = await axios.get('https://photon.komoot.io/api/', {
        params: { q, limit, bbox: '-43.45,-22.85,-43.10,-22.45' },
        timeout: 8000
      });

      return res.data.features.map(f => ({
        success: true,
        provider: 'photon',
        confidence: 0.6,
        formattedAddress: f.properties.name + (f.properties.street ? `, ${f.properties.street}` : ''),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        address: { postcode: f.properties.postcode || '' }
      }));
    } catch (e) {
      return null;
    }
  }
}

module.exports = new GeocodeOrchestrator();
