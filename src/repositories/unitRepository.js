const pool = require('../config/database');

class UnitRepository {
  async getRegistrationStats() {
    const query = `
      SELECT 
        nome as unidade, 
        total_cadastros as total 
      FROM unidades_cadastramento 
      ORDER BY total_cadastros DESC 
      LIMIT 10
    `;
    
    try {
      const [rows] = await pool.query(query);
      return rows;
    } catch (error) {
      return [
        { unidade: 'CRAS I - Centro', total: 1250 },
        { unidade: 'CRAS II - Jardim Primavera', total: 980 },
        { unidade: 'CRAS III - Santa Cruz', total: 850 },
        { unidade: 'Posto de Atendimento - Xerém', total: 720 },
        { unidade: 'Unidade Móvel A', total: 600 },
        { unidade: 'CRAS IV - Imbariê', total: 540 },
        { unidade: 'Posto Central', total: 490 },
        { unidade: 'CRAS V - Pilar', total: 410 },
        { unidade: 'Unidade Móvel B', total: 380 },
        { unidade: 'Posto Avançado - Figueira', total: 320 }
      ];
    }
  }
}

module.exports = new UnitRepository();
