# SIMAC - Sistema de Inteligência e Monitoramento de Ação Comunitária

O SIMAC é um sistema web moderno e de alto desempenho projetado para mapear, auditar e monitorar áreas territoriais e comunitárias de Duque de Caxias, integrando polígonos geoespaciais, logradouros oficiais e bases de CEPs dos Correios.

---

## 🛠️ Requisitos Prévios

Antes de iniciar, certifique-se de ter instalado em sua máquina:
1. **Node.js** (versão 16 ou superior)
2. **MySQL Server** (versão 8.0 ou superior com suporte a funções espaciais)

---

## 📦 Guia de Instalação e Configuração

### Passo 1: Configuração do Ambiente (.env)
O sistema necessita de variáveis de ambiente para conexão com o banco de dados. Um arquivo `.env` padrão é gerado automaticamente na primeira execução do script de inicialização, mas você pode criá-lo manualmente na raiz do projeto com o seguinte conteúdo:

```env
PORT=8200
NODE_ENV=production
ADMIN_TOKEN=acoes_comunitaria_secret_2026
JWT_SECRET=simac_jwt_super_secret_2026_change_me

# Conexão com o MySQL local
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=simac
```

> [!IMPORTANT]
> **Uso de barras nos caminhos (`/`):**
> Sempre utilize a barra normal inclinada para a direita (`/`) em qualquer definição de caminhos e URLs, tanto no arquivo de configuração, nos caminhos relativos de scripts (ex: `node scripts/consolidate_db.js`), quanto nos endpoints do navegador (ex: acessar `http://localhost:8200/`), inclusive em sistemas Windows. Isso previne problemas com caracteres de escape de strings e garante compatibilidade multiplataforma.

---

## 🗄️ Script de Criação do Banco de Dados (schema.sql)

O arquivo [schema.sql](file:///c:/Users/501379.PMDC/Desktop/PROJETOSOGM/acoescomuniatrias/schema.sql) contém a modelagem física do banco de dados MySQL otimizada com índices e suporte geoespacial (SRID 4326).

### Como criar manualmente no MySQL:
Você pode executar o script diretamente no terminal do MySQL ou usar seu cliente de banco preferido (DBeaver, MySQL Workbench, etc.):

```bash
# Acesso ao MySQL e importação direta
mysql -u root -p < schema.sql
```

### Estrutura de Tabelas Criadas:
* `comunidades`: Tabela principal com suporte a coluna geométrica `GEOMETRY` indexada por `SPATIAL INDEX` para consultas rápidas de geolocalização.
* `comunidade_ruas`: Relação (N:1) contendo os nomes de logradouros mapeados por comunidade.
* `comunidade_ceps`: Base oficial com CEPs dos Correios vinculados e dados complementares (Bairro, Localidade, DDD, IBGE).
* `usuarios`: Controle de acesso RBAC com senhas criptografadas em bcrypt.
* `audit_log`: Logs de auditoria estruturados em formato JSON para todas as alterações na base de dados.

---

## 🚀 Como Executar o Sistema

O SIMAC conta com um script automatizado inteligente de implantação de ponta a ponta (`iniciar.js`).

Para instalar as dependências e iniciar o servidor, execute no terminal do projeto:

```bash
node iniciar.js
```

### O que o script de inicialização faz de forma automatizada?
1. **Instalação**: Verifica se as dependências NPM estão presentes; se não estiverem, executa o `npm install` de forma transparente.
2. **Variáveis de Ambiente**: Gera um arquivo `.env` de configuração padrão se ele estiver ausente.
3. **Banco de Dados**: Conecta ao MySQL, cria o banco de dados `simac` e gera toda a estrutura de tabelas geoespaciais e relacionais.
4. **Seed do Administrador**: Cria o primeiro usuário administrador padrão de forma segura e idempotente:
   * **Usuário**: `admin`
   * **Senha**: `admin2026`
5. **Carga Inicial e Consolidação**: Executa o processo de consolidação de arquivos geográficos locais (`node scripts/consolidate_db.js`) e realiza o upload transacionado de alta performance para o banco de dados.
6. **Autodiagnóstico (Self-Diagnostic Suite)**: Realiza 10 testes críticos de saúde no banco de dados, incluindo testes de queries espaciais reais (`ST_Contains` e `ST_Area`) e contagem de registros para certificar que o sistema está 100% operacional.
7. **Servidor Web**: Inicia o servidor web do painel.

---

## 🖥️ Acesso ao Sistema

Após a execução bem-sucedida do script, abra seu navegador de internet e insira a URL contendo a barra de fechamento (`/`):

* **Painel Principal**: [http://localhost:8200/](http://localhost:8200/)
* **Tela de Login**: [http://localhost:8200/login.html](http://localhost:8200/login.html)
* **Credenciais Iniciais**:
  * **Usuário**: `admin`
  * **Senha**: `admin2026`
