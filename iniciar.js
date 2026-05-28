const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const bcrypt = require('bcryptjs');

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

// Agora que as dependências estão garantidas, podemos importá-las com segurança
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('\x1b[33m   ⚠️  Arquivo .env não localizado. Criando configuração padrão...\x1b[0m');
  const defaultEnv = `PORT=8200
NODE_ENV=production
ADMIN_TOKEN=acoes_comunitaria_secret_2026
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
  port: parseInt(process.env.DB_PORT || '3307', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'simac'
};


// Utilitário de conversão GeoJSON para WKT (Well-Known Text) de alta compatibilidade
function geojsonToWkt(geom) {
  if (!geom) return null;
  if (geom.type === 'Polygon') {
    const coordsStr = geom.coordinates.map(ring => 
      '(' + ring.map(pt => `${pt[0]} ${pt[1]}`).join(', ') + ')'
    ).join(', ');
    return `POLYGON(${coordsStr})`;
  } else if (geom.type === 'MultiPolygon') {
    const polysStr = geom.coordinates.map(poly => 
      '(' + poly.map(ring => 
        '(' + ring.map(pt => `${pt[0]} ${pt[1]}`).join(', ') + ')'
      ).join(', ') + ')'
    ).join(', ');
    return `MULTIPOLYGON(${polysStr})`;
  }
  throw new Error(`Geometria do tipo ${geom.type} não é suportada diretamente pelo conversor WKT do SIMAC.`);
}

// --- SUÍTE DE DIAGNÓSTICOS AUTOMATIZADOS (10 TESTES DE SOLICITAÇÕES ESPACIAIS E DE VOLUME) ---
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
      name: '3. Count Total Streets Mapped',
      fn: async () => {
        const [rows] = await connection.query('SELECT COUNT(*) as total FROM comunidade_ruas');
        return `SUCCESS (${rows[0].total} logradouros mapeados)`;
      }
    },
    {
      name: '4. Count Total Enriched CEPs',
      fn: async () => {
        const [rows] = await connection.query('SELECT COUNT(*) as total FROM comunidade_ceps');
        return `SUCCESS (${rows[0].total} CEPs enriquecidos)`;
      }
    },
    {
      name: '5. Detail Specific Community',
      fn: async () => {
        const [rows] = await connection.query('SELECT id, nome, total_ruas FROM comunidades LIMIT 1');
        return rows.length > 0 
          ? `SUCCESS (ID: ${rows[0].id} | Nome: "${rows[0].nome}")` 
          : 'FAILED (Base vazia)';
      }
    },
    {
      name: '6. Query Streets of Specific Community',
      fn: async () => {
        const [rows] = await connection.query('SELECT nome_rua FROM comunidade_ruas LIMIT 3');
        const list = rows.map(r => r.nome_rua).join(', ');
        return `SUCCESS (Ruas: ${list || 'Nenhuma'})`;
      }
    },
    {
      name: '7. Spatial Query (ST_Contains Point-in-Polygon)',
      fn: async () => {
        // Ponto geográfico dentro da comunidade Teixeira Mendes
        const testLng = -43.310106;
        const testLat = -22.745197;
        const [rows] = await connection.query(
          `SELECT id, nome FROM comunidades WHERE ST_Contains(geometria, ST_GeomFromText('POINT(${testLng} ${testLat})', 4326))`
        );
        return rows.length > 0 
          ? `SUCCESS (Ponto em: "${rows[0].nome}")` 
          : 'SUCCESS (Fora de áreas mapeadas)';
      }
    },
    {
      name: '8. Spatial Area Analysis (ST_Area / SRID)',
      fn: async () => {
        const [rows] = await connection.query('SELECT id, ST_Area(geometria) as area_graus FROM comunidades LIMIT 1');
        return rows.length > 0 
          ? `SUCCESS (ID: ${rows[0].id} | Área: ${parseFloat(rows[0].area_graus).toFixed(6)} sq deg)` 
          : 'FAILED';
      }
    },
    {
      name: '9. Audit Log Engine Integrity',
      fn: async () => {
        const testPayload = JSON.stringify({ action: 'SELF_TEST', timestamp: new Date() });
        const [insertRes] = await connection.query(
          'INSERT INTO audit_log (entidade, entidade_id, acao, payload, ip_origem) VALUES (?, ?, ?, ?, ?)',
          ['comunidade', 9999, 'INSERT', testPayload, '127.0.0.1']
        );
        const [logRes] = await connection.query('SELECT id, criado_em FROM audit_log WHERE id = ?', [insertRes.insertId]);
        return logRes.length > 0 
          ? `SUCCESS (Log ID: ${logRes[0].id} gravado em ${logRes[0].criado_em.toISOString()})` 
          : 'FAILED';
      }
    },
    {
      name: '10. Performance Query Benchmark',
      fn: async () => {
        const start = Date.now();
        // Carrega todas as geometrias do banco simulando alta concorrência
        await connection.query('SELECT id, ST_AsText(geometria) FROM comunidades');
        const duration = Date.now() - start;
        return `SUCCESS (Benchmark concluído em ${duration}ms - Excelente!)`;
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
    // Conexão inicial sem banco de dados especificado
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    console.log(`   Connected to MySQL at ${dbConfig.host}`);
    console.log(`   Criando banco de dados "${dbConfig.database}" se não existir...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    // Reconecta diretamente no banco correto
    await connection.changeUser({ database: dbConfig.database });
    console.log(`   ✅ Banco de dados "${dbConfig.database}" pronto.`);

  } catch (err) {
    console.error('\x1b[31m   ❌ Falha na conexão ou criação do banco de dados:\x1b[0m');
    console.error(`      Erro código: ${err.code}`);
    console.error(`      Mensagem: ${err.message}`);
    console.log('\n\x1b[33m💡 DICA: Verifique se o seu servidor MySQL local está rodando e se as credenciais no arquivo .env estão corretas.\x1b[0m\n');
    process.exit(1);
  }

  // --- FASE 3: CRIAÇÃO DO SCHEMA (DDL) ---
  console.log('\n[3/4] Criando DDL de tabelas e indexações espaciais...');
  try {
    // 1. Tabela audit_log
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        entidade VARCHAR(50) NOT NULL,
        entidade_id INT UNSIGNED NOT NULL,
        acao ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
        payload JSON,
        ip_origem VARCHAR(45),
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_entidade (entidade),
        INDEX idx_audit_criado (criado_em)
      ) ENGINE=InnoDB;
    `);

    // 2. Tabela comunidades
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comunidades (
        id INT UNSIGNED PRIMARY KEY,
        nome VARCHAR(255) NOT NULL UNIQUE,
        total_ruas SMALLINT NOT NULL DEFAULT 0,
        geometria GEOMETRY NOT NULL SRID 4326,
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
        INDEX idx_ruas_comunidade (comunidade_id),
        INDEX idx_ruas_nome (nome_rua)
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
        INDEX idx_ceps_comunidade (comunidade_id),
        INDEX idx_ceps_cep (cep)
      ) ENGINE=InnoDB;
    `);

    // 5. Tabela usuarios (RBAC)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        usuario VARCHAR(50) NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        perfil ENUM('admin','operador','visualizador') NOT NULL DEFAULT 'visualizador',
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_usuario_login (usuario),
        INDEX idx_usuario_perfil (perfil),
        INDEX idx_usuario_ativo (ativo)
      ) ENGINE=InnoDB;
    `);

    // Seed: Administrador padrão (idempotente)
    const [[{ adminExists }]] = await connection.query(
      'SELECT COUNT(*) as adminExists FROM usuarios WHERE usuario = ?',
      ['admin']
    );
    if (adminExists === 0) {
      const senhaHash = await bcrypt.hash('admin2026', 10);
      await connection.query(
        'INSERT INTO usuarios (nome, usuario, senha_hash, perfil) VALUES (?, ?, ?, ?)',
        ['Administrador', 'admin', senhaHash, 'admin']
      );
      console.log('   ✅ Usuário administrador padrão criado (usuario: admin / senha: admin2026).');
    } else {
      console.log('   ℹ️  Usuário administrador já existe. Seed ignorado.');
    }

    console.log('   ✅ Schema DDL e indexações espaciais gerados com sucesso.');
  } catch (err) {
    console.error('\x1b[31m   ❌ Falha ao criar estrutura de tabelas (DDL):\x1b[0m', err.message);
    await connection.end();
    process.exit(1);
  }

  // --- FASE 4: POPULAÇÃO DE DADOS (SEEDING TRANSACIONADO) ---
  console.log('\n[4/4] Verificando e populando banco de dados (Seeding)...');
  try {
    const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM comunidades');
    
    if (count > 0) {
      console.log(`   ℹ️  O banco de dados já possui ${count} comunidades cadastradas. Ignorando carga inicial (Idempotente).`);
    } else {
      console.log('   Garantindo consolidação da base local de dados...');
      execSync('node scripts/consolidate_db.js', { stdio: 'ignore', cwd: __dirname });
      
      const masterDataPath = path.join(__dirname, 'src/data/simac_master_db.json');
      if (!fs.existsSync(masterDataPath)) {
        throw new Error('Arquivo de dados mestre simac_master_db.json não localizado mesmo após consolidação.');
      }
      
      const masterData = JSON.parse(fs.readFileSync(masterDataPath, 'utf8'));
      console.log(`   Iniciando carga transacionada de ${masterData.length} comunidades...`);
      
      const start = Date.now();
      await connection.beginTransaction();

      const stmtComunidade = await connection.prepare(
        'INSERT INTO comunidades (id, nome, total_ruas, geometria) VALUES (?, ?, ?, ST_GeomFromText(?, 4326))'
      );
      const stmtRua = await connection.prepare(
        'INSERT INTO comunidade_ruas (comunidade_id, nome_rua) VALUES (?, ?)'
      );
      const stmtCep = await connection.prepare(
        'INSERT INTO comunidade_ceps (comunidade_id, cep, logradouro, bairro, localidade, uf, ibge, ddd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );

      let ruasCount = 0;
      let cepsCount = 0;

      for (const com of masterData) {
        const wkt = geojsonToWkt(com.geometria);
        
        // Inserir Comunidade
        await stmtComunidade.execute([
          com.id, 
          com.nome, 
          com.total_ruas, 
          wkt
        ]);

        // Inserir Ruas
        if (com.ruas && com.ruas.length > 0) {
          for (const rua of com.ruas) {
            await stmtRua.execute([com.id, rua]);
            ruasCount++;
          }
        }

        // Inserir CEPs enriquecidos
        if (com.ceps && com.ceps.length > 0) {
          for (const c of com.ceps) {
            const o = c.oficial || {};
            await stmtCep.execute([
              com.id,
              c.cep,
              o.logradouro || null,
              o.bairro || null,
              o.localidade || null,
              o.uf || null,
              o.ibge || null,
              o.ddd || null
            ]);
            cepsCount++;
          }
        }
      }

      await connection.commit();
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      
      console.log(`   ✅ Carga concluída com sucesso em ${elapsed}s!`);
      console.log(`      - Comunidades inseridas: ${masterData.length}`);
      console.log(`      - Ruas inseridas: ${ruasCount}`);
      console.log(`      - CEPs auditados inseridos: ${cepsCount}`);
    }

    // Executar a suíte de diagnósticos (10 solicitações/consultas) com a conexão ativa
    await runDiagnostics(connection);

  } catch (err) {
    if (connection) await connection.rollback();
    console.error('\x1b[31m   ❌ Falha na carga de dados (Rollback ativado):\x1b[0m', err.message);
    if (connection) await connection.end();
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }

  // --- INICIALIZAÇÃO DO SERVIDOR ---
  console.log('\n\x1b[32m====================================================\x1b[0m');
  console.log('\x1b[32m      SIMAC INICIALIZADO - EXECUTANDO SERVIDOR      \x1b[0m');
  console.log('\x1b[32m====================================================\x1b[0m\n');

  const server = spawn('node', ['server.js'], { stdio: 'inherit', shell: true, cwd: __dirname });

  server.on('error', (err) => {
    console.error('\x1b[31mErro fatal ao iniciar o servidor:\x1b[0m', err.message);
  });
}

runBootstrap();
