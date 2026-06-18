/**
 * SIMAC - Reset / Criação do usuário administrador
 * 
 * USO NO SERVIDOR:
 *   node reset_admin.js
 * 
 * ou com senha customizada:
 *   node reset_admin.js minhanovaSenha123
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const NOVA_SENHA = process.argv[2] || 'admin2026';
const USUARIO    = 'admin';
const NOME       = 'Administrador';

async function resetAdmin() {
  let connection;

  const dbConfig = {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'simac',
  };

  console.log('\n====================================================');
  console.log('   SIMAC — Reset de Usuário Administrador');
  console.log('====================================================');
  console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   DB:   ${dbConfig.database}`);
  console.log(`   User: ${USUARIO}`);
  console.log('====================================================\n');

  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexão com MySQL estabelecida.\n');
  } catch (err) {
    console.error('❌ Falha ao conectar no MySQL:', err.message);
    console.error('\n💡 Verifique o arquivo .env na pasta do projeto.');
    process.exit(1);
  }

  try {
    // Garante que a tabela existe
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nome          VARCHAR(100) NOT NULL,
        usuario       VARCHAR(50)  NOT NULL UNIQUE,
        senha_hash    VARCHAR(255) NOT NULL,
        ativo         TINYINT(1)   NOT NULL DEFAULT 1,
        criado_em     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const senhaHash = await bcrypt.hash(NOVA_SENHA, 10);

    const [[{ existe }]] = await connection.query(
      'SELECT COUNT(*) AS existe FROM usuarios WHERE usuario = ?',
      [USUARIO]
    );

    if (existe > 0) {
      // Atualiza senha e garante ativo=1
      await connection.query(
        'UPDATE usuarios SET senha_hash = ?, ativo = 1, nome = ? WHERE usuario = ?',
        [senhaHash, NOME, USUARIO]
      );
      console.log(`✅ Senha do usuário "${USUARIO}" ATUALIZADA com sucesso!`);
    } else {
      // Cria do zero
      await connection.query(
        'INSERT INTO usuarios (nome, usuario, senha_hash) VALUES (?, ?, ?)',
        [NOME, USUARIO, senhaHash]
      );
      console.log(`✅ Usuário "${USUARIO}" CRIADO com sucesso!`);
    }

    console.log('\n====================================================');
    console.log('   LOGIN ATUALIZADO:');
    console.log(`   Usuário : ${USUARIO}`);
    console.log(`   Senha   : ${NOVA_SENHA}`);
    console.log('====================================================\n');

    // Verifica registro final
    const [[u]] = await connection.query(
      'SELECT id, nome, usuario, ativo FROM usuarios WHERE usuario = ?',
      [USUARIO]
    );
    console.log('📋 Registro no banco:', u);

  } catch (err) {
    console.error('\n❌ Erro ao resetar usuário:', err.message);
  } finally {
    await connection.end();
  }
}

resetAdmin();
