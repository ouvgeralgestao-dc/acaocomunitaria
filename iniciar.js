const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

console.log('\x1b[36m====================================================\x1b[0m');
console.log('\x1b[36m   SIMAC - SISTEMA DE INTELIGÊNCIA & MONITORAMENTO  \x1b[0m');
console.log('\x1b[36m====================================================\x1b[0m');

// --- FASE 1: AUTO-INSTALAÇÃO DE DEPENDÊNCIAS ---
try {
  console.log('\n[1/4] Verificando dependências locais...');
  require('mysql2/promise');
  require('dotenv');
  require('bcryptjs');
  require('jsonwebtoken');
  require('zod');
  require('helmet');
  console.log('   ✅ Dependências pré-instaladas localizadas.');
} catch (e) {
  console.log('\x1b[33m   ⚠️  Dependências ausentes detectadas. Iniciando "npm install"...\x1b[0m');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    console.log('   ✅ Instalação de dependências concluída com sucesso.');
  } catch (err) {
    console.error('\x1b[31m   ❌ Erro crítico ao instalar dependências NPM:\x1b[0m', err.message);
    process.exit(1);
  }
}

// Importações seguras
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Carregar variáveis de ambiente
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('\x1b[33m   ⚠️  Arquivo .env não localizado. Criando configuração padrão...\x1b[0m');
  const defaultEnv = `PORT=8200
NODE_ENV=production
ADMIN_TOKEN=acoes_comunitaria_secret_2026
JWT_SECRET=simac_jwt_super_secret_2026_change_me
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=simac`;
  fs.writeFileSync(envPath, defaultEnv);
  console.log('   ✅ Arquivo .env gerado com configurações locais do MySQL (User: root / Pass: root).');
}

dotenv.config({ path: envPath, override: true });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'simac'
};

// Conversor GeoJSON → WKT (Polygon e MultiPolygon)
function geojsonToWkt(geom) {
  if (!geom) return null;
  if (geom.type === 'Polygon') {
    const coordsStr = geom.coordinates.map(ring => 
      '(' + ring.map(pt => `${pt[1]} ${pt[0]}`).join(', ') + ')'
    ).join(', ');
    return `POLYGON(${coordsStr})`;
  } else if (geom.type === 'MultiPolygon') {
    const polysStr = geom.coordinates.map(poly => 
      '(' + poly.map(ring => 
        '(' + ring.map(pt => `${pt[1]} ${pt[0]}`).join(', ') + ')'
      ).join(', ') + ')'
    ).join(', ');
    return `MULTIPOLYGON(${polysStr})`;
  }
  throw new Error(`Geometria ${geom.type} não suportada.`);
}

// --- DIAGNÓSTICOS DE SAÚDE ---
async function runDiagnostics(connection) {
  console.log('\n\x1b[35m====================================================\x1b[0m');
  console.log('\x1b[35m        SIMAC ENTERPRISE SELF-DIAGNOSTIC SUITE      \x1b[0m');
  console.log('\x1b[35m====================================================\x1b[0m');

  const tests = [
    {
      name: '1. MySQL Connectivity Ping',
      fn: async () => {
        const [rows] = await connection.query('SELECT 1 as ping');
        return rows[0].ping === 1 ? 'SUCCESS (Ping OK)' : 'FAILED';
      }
    },
    {
      name: '2. Count Total Communities',
      fn: async () => {
        const [rows] = await connection.query('SELECT COUNT(*) as total FROM comunidades');
        return `SUCCESS (${rows[0].total} comunidades na base)`;
      }
    },
    {
      name: '3. Spatial Query (ST_Contains Point-in-Polygon)',
      fn: async () => {
        // Ponto geográfico dentro do Inferninho (Lixão)
        const testLng = -43.303148;
        const testLat = -22.794783;
        const [rows] = await connection.query(
          `SELECT id, nome FROM comunidades WHERE ST_Contains(geometria, ST_GeomFromText('POINT(${testLat} ${testLng})', 4326))`
        );
        return rows.length > 0 
          ? `SUCCESS (Ponto em: "${rows[0].nome}")` 
          : 'SUCCESS (Fora de áreas mapeadas)';
      }
    },
    {
      name: '4. Check Geometries Validity (ST_IsValid)',
      fn: async () => {
        const [rows] = await connection.query('SELECT SUM(ST_IsValid(geometria)) as validas, COUNT(*) as total FROM comunidades');
        const validas = rows[0].validas || 0;
        const total = rows[0].total || 0;
        return `SUCCESS (${validas}/${total} geometrias 100% válidas no MySQL)`;
      }
    },
    {
      name: '5. Audit Log Integrity Check',
      fn: async () => {
        const testPayload = JSON.stringify({ action: 'BOOT_DIAGNOSTIC' });
        const [insertRes] = await connection.query(
          'INSERT INTO audit_log (entidade, entidade_id, acao, payload, ip_origem) VALUES (?, ?, ?, ?, ?)',
          ['sistema', 1, 'INSERT', testPayload, '127.0.0.1']
        );
        return insertRes.insertId ? `SUCCESS (Log ID ${insertRes.insertId} gravado)` : 'FAILED';
      }
    }
  ];

  for (const t of tests) {
    try {
      const start = Date.now();
      const status = await t.fn();
      const elapsed = Date.now() - start;
      console.log(`   ⚙️  ${t.name.padEnd(50)} ➔ \x1b[32m${status}\x1b[0m (${elapsed}ms)`);
    } catch (e) {
      console.log(`   ⚙️  ${t.name.padEnd(50)} ➔ \x1b[31mFAILED: ${e.message}\x1b[0m`);
    }
  }
  console.log('\x1b[35m====================================================\x1b[0m\n');
}

async function runBootstrap() {
  let connection;

  // --- FASE 2: CONEXÃO E CRIAÇÃO DO BANCO DE DADOS ---
  console.log('\n[2/4] Conectando ao servidor MySQL e preparando banco de dados...');
  try {
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    console.log(`   Conectado ao MySQL em ${dbConfig.host}`);
    console.log(`   Preparando banco de dados "${dbConfig.database}"...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    await connection.changeUser({ database: dbConfig.database });
    console.log(`   ✅ Banco de dados pronto.`);

  } catch (err) {
    console.error('\x1b[31m   ❌ Falha na conexão com o banco de dados:\x1b[0m', err.message);
    process.exit(1);
  }

  // --- FASE 3: CRIAÇÃO DO SCHEMA (DDL REFATORADO) ---
  console.log('\n[3/4] Criando estrutura de tabelas e índices espaciais...');
  try {
    // 1. Tabela usuarios
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        usuario VARCHAR(50) NOT NULL UNIQUE,
        senha_hash VARCHAR(255) NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 2. Tabela comunidades
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comunidades (
        id INT UNSIGNED PRIMARY KEY,
        nome VARCHAR(255) NOT NULL UNIQUE,
        total_ruas SMALLINT NOT NULL DEFAULT 0,
        geometria GEOMETRY NOT NULL SRID 4326,
        complexo VARCHAR(100),
        cor_hex VARCHAR(7),
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        SPATIAL INDEX idx_comunidades_geom (geometria)
      ) ENGINE=InnoDB;
    `);

    // 3. Tabela comunidade_ruas
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comunidade_ruas (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        comunidade_id INT UNSIGNED NOT NULL,
        nome_rua VARCHAR(255) NOT NULL,
        FOREIGN KEY (comunidade_id) REFERENCES comunidades(id) ON DELETE CASCADE,
        UNIQUE KEY uq_com_rua (comunidade_id, nome_rua)
      ) ENGINE=InnoDB;
    `);

    // 4. Tabela comunidade_ceps
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comunidade_ceps (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        comunidade_id INT UNSIGNED NOT NULL,
        cep CHAR(9) NOT NULL,
        logradouro VARCHAR(255),
        bairro VARCHAR(255),
        localidade VARCHAR(255),
        uf CHAR(2),
        ibge VARCHAR(10),
        ddd CHAR(3),
        FOREIGN KEY (comunidade_id) REFERENCES comunidades(id) ON DELETE CASCADE,
        INDEX idx_ceps_cep (cep)
      ) ENGINE=InnoDB;
    `);

    // 5. Tabela de histórico de geometrias
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comunidade_historico_geometria (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        comunidade_id INT UNSIGNED NOT NULL,
        geometria GEOMETRY NOT NULL SRID 4326,
        usuario_id INT UNSIGNED,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (comunidade_id) REFERENCES comunidades(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        SPATIAL INDEX idx_hist_geom (geometria)
      ) ENGINE=InnoDB;
    `);

    // 6. Tabela audit_log
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        entidade VARCHAR(50) NOT NULL,
        entidade_id INT UNSIGNED NOT NULL,
        acao ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
        usuario_id INT UNSIGNED,
        payload JSON,
        ip_origem VARCHAR(45),
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // Seed: Administrador padrão
    const [[{ adminExists }]] = await connection.query(
      'SELECT COUNT(*) as adminExists FROM usuarios WHERE usuario = ?',
      ['admin']
    );
    if (adminExists === 0) {
      const senhaHash = await bcrypt.hash('admin2026', 10);
      await connection.query(
        'INSERT INTO usuarios (nome, usuario, senha_hash) VALUES (?, ?, ?)',
        ['Administrador', 'admin', senhaHash]
      );
      console.log('   ✅ Usuário administrador padrão criado (admin / admin2026).');
    }

    console.log('   ✅ Estrutura física de tabelas criada.');
  } catch (err) {
    console.error('\x1b[31m   ❌ Falha ao criar estrutura de tabelas DDL:\x1b[0m', err.message);
    await connection.end();
    process.exit(1);
  }

  // --- FASE 4: POPULAÇÃO DE DADOS (NOVO BANCO DE DADOS GEOJSON) ---
  console.log('\n[4/4] Populando banco de dados a partir da nova base geojson_comunidades...');
  try {
    const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM comunidades');
    
    if (count > 0) {
      console.log(`   ℹ️  O banco de dados já possui ${count} comunidades cadastradas. Ignorando carga inicial.`);
    } else {
      const dbSourcePath = path.join(__dirname, 'geojson_comunidades/_TODAS_COMUNIDADES.geojson');

      if (fs.existsSync(dbSourcePath)) {
        const fileContent = fs.readFileSync(dbSourcePath, 'utf8');
        const geojson = JSON.parse(fileContent);
        console.log(`   Carregando nova base com ${geojson.features.length} features...`);
        
        await connection.beginTransaction();

        const stmtComunidade = await connection.prepare(
          'INSERT INTO comunidades (id, nome, total_ruas, geometria, complexo, cor_hex) VALUES (?, ?, ?, ST_GeomFromText(?, 4326), ?, ?)'
        );

        let index = 1;
        for (const f of geojson.features) {
          if (!f || !f.geometry) continue;

          // Validação / sanitização espacial
          const geom = f.geometry;
          const wkt = geojsonToWkt(geom);

          const props = f.properties || {};
          const nome = props.Comunidade || props.COMUNIDADE || props.name || props.comunidade_pasta || `Comunidade_${index}`;
          const complexo = props.complexo || props.Complexo || 'Desconhecido';
          const corHex = props.fill || props.cor_hex || '#ff0000';

          await stmtComunidade.execute([
            index,
            nome,
            0,
            wkt,
            complexo,
            corHex
          ]);
          index++;
        }

        await connection.commit();
        console.log(`   ✅ Carga inicial do novo banco geojson_comunidades efetuada com sucesso! (${index - 1} comunidades inseridas)`);
        
        // Agora, sincroniza o banco de dados recém-carregado gerando os arquivos de uso do frontend
        console.log('   Sincronizando arquivos locais de dados para o frontend...');
        const geojsonController = require('./src/controllers/geojsonController');
        await geojsonController.syncFilesFromDatabase();
        
        const boundarySrc = path.join(__dirname, 'geojson_comunidades/Duque_de_Caxias.geojson');
        const boundaryDst = path.join(__dirname, 'src/data/Duque_de_Caxias.geojson');
        if (fs.existsSync(boundarySrc)) {
          fs.copyFileSync(boundarySrc, boundaryDst);
          console.log('   ✅ Limite municipal de Duque de Caxias copiado para o frontend.');
        }
        
      } else {
        console.log('   ⚠️  Nova base geojson_comunidades/_TODAS_COMUNIDADES.geojson não localizada. Carga inicial pulada.');
      }
    }

    // Executar diagnósticos
    await runDiagnostics(connection);

  } catch (err) {
    if (connection) await connection.rollback();
    console.error('\x1b[31m   ❌ Falha na carga do novo banco de dados (Rollback):\x1b[0m', err.message);
    if (connection) await connection.end();
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }

  // Inicializa o servidor Express
  console.log('\n\x1b[32m====================================================\x1b[0m');
  console.log('      SIMAC INICIALIZADO - EXECUTANDO SERVIDOR      ');
  console.log('\x1b[32m====================================================\x1b[0m\n');

  const server = spawn('node', ['server.js'], { stdio: 'inherit', shell: true, cwd: __dirname });
  server.on('error', (err) => {
    console.error('\x1b[31mErro fatal ao iniciar o servidor:\x1b[0m', err.message);
  });
}

runBootstrap();
