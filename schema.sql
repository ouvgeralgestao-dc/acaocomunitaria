-- ============================================================
-- ASA v3 — Schema MySQL com Suporte Espacial
-- Engine: InnoDB | Charset: utf8mb4 | Spatial: SRID 4326
-- ============================================================

CREATE DATABASE IF NOT EXISTS simac
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE simac;

-- ------------------------------------------------------------
-- TABELA PRINCIPAL: comunidades
-- Armazena o polígono territorial de cada comunidade
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comunidades (
  id            INT UNSIGNED     NOT NULL,
  nome          VARCHAR(255)     NOT NULL,
  total_ruas    SMALLINT         NOT NULL DEFAULT 0,
  geometria     GEOMETRY         NOT NULL SRID 4326,
  criado_em     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_comunidade_nome (nome),

  -- Índice espacial obrigatório para ST_Contains / ST_Intersects
  SPATIAL INDEX sp_comunidade_geometria (geometria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- TABELA: comunidade_ruas
-- Lista de ruas associadas a cada comunidade (N:1)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comunidade_ruas (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  comunidade_id   INT UNSIGNED     NOT NULL,
  nome_rua        VARCHAR(255)     NOT NULL,

  PRIMARY KEY (id),
  KEY idx_rua_comunidade (comunidade_id),
  KEY idx_rua_nome (nome_rua),

  CONSTRAINT fk_rua_comunidade
    FOREIGN KEY (comunidade_id)
    REFERENCES comunidades (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- TABELA: comunidade_ceps
-- CEPs vinculados a cada comunidade, com dados oficiais dos Correios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comunidade_ceps (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  comunidade_id   INT UNSIGNED     NOT NULL,
  cep             CHAR(9)          NOT NULL,          -- formato: 99999-999
  logradouro      VARCHAR(255)         NULL,
  bairro          VARCHAR(255)         NULL,
  localidade      VARCHAR(255)         NULL,
  uf              CHAR(2)              NULL,
  ibge            VARCHAR(10)          NULL,
  ddd             CHAR(3)              NULL,

  PRIMARY KEY (id),
  KEY idx_cep_comunidade (comunidade_id),
  KEY idx_cep_codigo (cep),

  CONSTRAINT fk_cep_comunidade
    FOREIGN KEY (comunidade_id)
    REFERENCES comunidades (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- TABELA: usuarios
-- Controle de acesso ao sistema (RBAC)
-- senha_hash: bcrypt rounds=10
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(100)     NOT NULL,
  usuario       VARCHAR(50)      NOT NULL,
  senha_hash    VARCHAR(255)     NOT NULL,
  perfil        ENUM('admin','operador','visualizador') NOT NULL DEFAULT 'visualizador',
  ativo         TINYINT(1)       NOT NULL DEFAULT 1,
  criado_em     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_login (usuario),
  KEY idx_usuario_perfil (perfil),
  KEY idx_usuario_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- TABELA: audit_log
-- Rastreamento de todas as alterações territoriais
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  entidade      VARCHAR(50)      NOT NULL,   -- ex: 'comunidade'
  entidade_id   INT UNSIGNED     NOT NULL,
  acao          ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  payload       JSON                 NULL,
  ip_origem     VARCHAR(45)          NULL,
  criado_em     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_audit_entidade (entidade, entidade_id),
  KEY idx_audit_data (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
