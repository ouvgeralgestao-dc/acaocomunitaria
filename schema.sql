-- ============================================================
-- SIMAC — Schema MySQL Refatorado com Suporte Espacial Otimizado
-- Engine: InnoDB | Charset: utf8mb4 | Spatial: SRID 4326
-- Nível de Acesso: Simplificado (Perfil Único de Administrador)
-- ============================================================

CREATE DATABASE IF NOT EXISTS simac
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE simac;

-- ------------------------------------------------------------
-- TABELA: usuarios
-- Armazena os usuários do sistema com nível único de acesso (Administrador)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(100)     NOT NULL,
  usuario       VARCHAR(50)      NOT NULL,
  senha_hash    VARCHAR(255)     NOT NULL,
  ativo         TINYINT(1)       NOT NULL DEFAULT 1,
  criado_em     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_login (usuario),
  KEY idx_usuario_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- TABELA PRINCIPAL: comunidades
-- Armazena o polígono territorial de cada comunidade e seu respectivo complexo/cor
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comunidades (
  id            INT UNSIGNED     NOT NULL,
  nome          VARCHAR(255)     NOT NULL,
  total_ruas    SMALLINT         NOT NULL DEFAULT 0,
  geometria     GEOMETRY         NOT NULL SRID 4326,
  complexo      VARCHAR(100)         NULL, -- Identificação do complexo da comunidade
  cor_hex       VARCHAR(7)           NULL, -- Cor hexadecimal associada ao complexo (#RRGGBB)
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
  UNIQUE KEY uq_comunidade_rua (comunidade_id, nome_rua), -- Impedir ruas duplicadas na mesma comunidade

  CONSTRAINT fk_rua_comunidade
    FOREIGN KEY (comunidade_id)
    REFERENCES comunidades (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- TABELA: comunidade_ceps
-- CEPs vinculados a cada comunidade
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comunidade_ceps (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  comunidade_id   INT UNSIGNED     NOT NULL,
  cep             CHAR(9)          NOT NULL, -- Formato: 99999-999
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
-- TABELA: comunidade_historico_geometria
-- Versionamento de geometrias para auditoria e rollback rápido
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comunidade_historico_geometria (
  id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  comunidade_id  INT UNSIGNED     NOT NULL,
  geometria      GEOMETRY         NOT NULL SRID 4326,
  usuario_id     INT UNSIGNED         NULL,
  criado_em      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  SPATIAL INDEX sp_historico_geometria (geometria),

  CONSTRAINT fk_hist_comunidade
    FOREIGN KEY (comunidade_id)
    REFERENCES comunidades (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_hist_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- TABELA: audit_log
-- Histórico de alterações administrativas leve
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  entidade      VARCHAR(50)      NOT NULL,
  entidade_id   INT UNSIGNED     NOT NULL,
  acao          ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  usuario_id    INT UNSIGNED         NULL,
  payload       JSON                 NULL, -- Dados leves de antes/depois
  ip_origem     VARCHAR(45)          NULL,
  criado_em     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_audit_entidade (entidade, entidade_id),
  KEY idx_audit_data (criado_em),

  CONSTRAINT fk_audit_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
