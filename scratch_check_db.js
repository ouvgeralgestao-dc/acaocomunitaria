require('dotenv').config({ override: true });
const mysql = require('mysql2/promise');

async function test() {
  console.log('Tentando conectar ao banco de dados...');
  console.log('Config:');
  console.log('Host:', process.env.DB_HOST || 'localhost');
  console.log('Port:', process.env.DB_PORT || '3307');
  console.log('User:', process.env.DB_USER || 'root');
  console.log('Database:', process.env.DB_NAME || 'simac');

  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'simac'
    });

    console.log('Conectado com sucesso!');
    const [rows] = await conn.query('SELECT id, nome, usuario, senha_hash, perfil, ativo FROM usuarios');
    console.log('Usuários cadastrados no banco:');
    for (const r of rows) {
      const is2026 = await require('bcryptjs').compare('admin2026', r.senha_hash);
      const is123 = await require('bcryptjs').compare('admin123', r.senha_hash);
      console.log(`User: ${r.usuario}, is admin2026? ${is2026}, is admin123? ${is123}`);
    }
    await conn.end();
  } catch (e) {
    console.error('Erro na conexão:', e);
  }
}

test();
