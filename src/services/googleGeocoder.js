const axios = require('axios');

class GoogleGeocoder {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_KEY;
    this.apiUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
  }

  get isEnabled() {
    return !!this.apiKey;
  }

  async geocode(address) {
    if (!this.isEnabled) return null;

    try {
      console.log(`[Google Geocode] Buscando: ${address}`);
      const response = await axios.get(this.apiUrl, {
        params: {
          address: address,
          components: 'country:BR|administrative_area:Duque de Caxias',
          key: this.apiKey,
          language: 'pt-BR',
          region: 'br'
        },
        timeout: 8000
      });

      if (response.data.status === 'OK') {
        const result = response.data.results[0];
        const components = result.address_components;
        const getComp = (type) => components.find(c => c.types.includes(type))?.long_name || '';

        return {
          success: true,
          provider: 'google',
          confidence: this.calculateConfidence(result),
          isApproximated: result.geometry.location_type !== 'ROOFTOP' && result.geometry.location_type !== 'RANGE_INTERPOLATED',
          formattedAddress: result.formatted_address,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          address: {
            road: getComp('route'),
            house_number: getComp('street_number'),
            neighborhood: getComp('sublocality_level_1') || getComp('neighborhood'),
            city: getComp('administrative_area_level_2'),
            postcode: getComp('postal_code')
          },
          raw: result
        };
      }
      
      console.warn(`[Google Geocode] Status: ${response.data.status}`);
      return null;
    } catch (error) {
      console.error(`[Google Geocode Error] ${error.message}`);
      return null;
    }
  }

  calculateConfidence(result) {
    const type = result.geometry.location_type;
    const precision = result.types[0];

    if (type === 'ROOFTOP') return 1.0;
    if (type === 'RANGE_INTERPOLATED') return 0.9;
    if (precision === 'street_address') return 0.85;
    if (precision === 'route') return 0.7;
    return 0.5;
  }
}

module.exports = new GoogleGeocoder();
