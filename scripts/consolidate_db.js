const fs = require('fs');
const path = require('path');

/**
 * ASA v3 - Consolidador de Base Mestre
 * Combina GeoJSON, Auditoria de Logradouros e Detalhes de CEP em um único Banco de Dados.
 */

function consolidate() {
    const geojsonPath = path.join(__dirname, '../src/data/comunidades.geojson');
    const fullCepsPath = path.join(__dirname, '../src/data/comunidades_full_ceps.json');
    const manualCepsPath = path.join(__dirname, '../src/data/comunidades_ceps.json');
    const detailedCepsPath = path.join(__dirname, '../src/data/comunidades_detalhado.json');
    const lookupPath = path.join(__dirname, '../src/data/cep_lookup.json');
    const outputPath = path.join(__dirname, '../src/data/simac_master_db.json');

    console.log('--- SIMAC: Consolidando Banco de Dados Mestre ---');

    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    const auditDataFull = fs.existsSync(fullCepsPath) ? JSON.parse(fs.readFileSync(fullCepsPath, 'utf8')) : [];
    const auditDataManual = fs.existsSync(manualCepsPath) ? JSON.parse(fs.readFileSync(manualCepsPath, 'utf8')) : [];
    const auditDataDetailed = fs.existsSync(detailedCepsPath) ? JSON.parse(fs.readFileSync(detailedCepsPath, 'utf8')) : [];
    const cepLookup = fs.existsSync(lookupPath) ? JSON.parse(fs.readFileSync(lookupPath, 'utf8')) : {};

    const seenNames = {};
    const master = geojson.features.map(feature => {
        const id = feature.id.toString();
        let rawNome = feature.properties.neighborhood || `Comunidade ${id}`;
        let nome = rawNome;
        
        if (seenNames[rawNome]) {
            seenNames[rawNome]++;
            nome = `${rawNome} (Parte ${seenNames[rawNome]})`;
        } else {
            seenNames[rawNome] = 1;
        }
        
        // Coletar CEPs de todas as fontes
        const cepsSet = new Set();
        const ruasSet = new Set();

        // 1. Do Deep Scan (Full)
        if (auditDataFull[id]) {
            (auditDataFull[id].ceps || []).forEach(c => cepsSet.add(c));
            (auditDataFull[id].ruas || []).forEach(r => ruasSet.add(r));
        }

        // 2. Do Manual Mapping
        if (auditDataManual[id] && auditDataManual[id].ceps) {
            auditDataManual[id].ceps.forEach(c => cepsSet.add(c));
        }

        // 3. Do Detalhado
        if (auditDataDetailed[id] && auditDataDetailed[id].ceps) {
            auditDataDetailed[id].ceps.forEach(c => cepsSet.add(c));
        }

        // Enriquecer CEPs únicos com dados oficiais
        const cepsEnriquecidos = Array.from(cepsSet).map(cep => {
            const cleanCep = cep.replace(/\D/g, '');
            return {
                cep: cep,
                oficial: cepLookup[cleanCep] || null
            };
        });

        return {
            id: feature.id,
            nome: nome,
            geometria: feature.geometry,
            ruas: Array.from(ruasSet),
            ceps: cepsEnriquecidos,
            total_ruas: ruasSet.size
        };
    });

    fs.writeFileSync(outputPath, JSON.stringify(master, null, 2));
    console.log(`Banco de Dados Mestre gerado com sucesso: ${outputPath}`);
}

consolidate();
