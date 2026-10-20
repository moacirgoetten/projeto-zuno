-- Zuno - estrutura inicial de demonstração (11 tabelas)
-- Importar no phpMyAdmin. Ajuste com o modelo oficial da disciplina quando estiver disponível.
CREATE DATABASE IF NOT EXISTS zuno CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE zuno;

CREATE TABLE universidades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  sigla VARCHAR(30),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE cursos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  universidade_id INT NOT NULL,
  nome VARCHAR(140) NOT NULL,
  FOREIGN KEY (universidade_id) REFERENCES universidades(id)
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  curso_id INT,
  bio VARCHAR(500),
  foto_url VARCHAR(255),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE interesses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE usuario_interesses (
  usuario_id INT NOT NULL,
  interesse_id INT NOT NULL,
  PRIMARY KEY (usuario_id, interesse_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (interesse_id) REFERENCES interesses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE conexoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitante_id INT NOT NULL,
  destinatario_id INT NOT NULL,
  status ENUM('pendente','aceita','recusada','bloqueada') NOT NULL DEFAULT 'pendente',
  criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conexao (solicitante_id, destinatario_id),
  FOREIGN KEY (solicitante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE mensagens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conexao_id INT NOT NULL,
  remetente_id INT NOT NULL,
  conteudo TEXT NOT NULL,
  enviada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (conexao_id) REFERENCES conexoes(id) ON DELETE CASCADE,
  FOREIGN KEY (remetente_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notificacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  mensagem VARCHAR(255) NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE denuncias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  denunciante_id INT NOT NULL,
  usuario_denunciado_id INT NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  status ENUM('aberta','em_analise','resolvida') NOT NULL DEFAULT 'aberta',
  criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (denunciante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_denunciado_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE fotos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  caminho VARCHAR(255) NOT NULL,
  principal BOOLEAN NOT NULL DEFAULT FALSE,
  enviada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE consentimentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  versao_termo VARCHAR(30) NOT NULL,
  aceito_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO universidades (nome, sigla) VALUES
('Universidade Exemplo','UE'), ('Universidade Comunitária','UC');

INSERT INTO cursos (universidade_id, nome) VALUES
(1,'Design'), (1,'Ciência da Computação'), (1,'Jornalismo'), (2,'Psicologia');

INSERT INTO interesses (nome) VALUES
('Design'),('Música'),('Leitura'),('Jogos'),('Natureza'),('Cinema'),('Tecnologia'),('Cafés');
