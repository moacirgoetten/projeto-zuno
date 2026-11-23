-- Zuno - banco de dados (11 tabelas). Importar uma única vez no phpMyAdmin.
-- Relações com ON DELETE CASCADE: ao excluir um usuário, os dados ligados a ele também são apagados.
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

-- Catálogo inicial: universidades reais e interesses.
INSERT INTO universidades (nome, sigla) VALUES
('Universidade de São Paulo', 'USP'),
('Universidade Estadual de Campinas', 'UNICAMP'),
('Universidade Estadual Paulista', 'UNESP'),
('Universidade Federal do Rio de Janeiro', 'UFRJ'),
('Universidade Federal de Minas Gerais', 'UFMG'),
('Universidade Federal do Paraná', 'UFPR'),
('Universidade Tecnológica Federal do Paraná', 'UTFPR'),
('Universidade Federal de Santa Catarina', 'UFSC'),
('Universidade Federal do Rio Grande do Sul', 'UFRGS'),
('Universidade de Brasília', 'UnB'),
('Universidade Federal da Bahia', 'UFBA'),
('Universidade Federal de Pernambuco', 'UFPE'),
('Universidade Federal do Ceará', 'UFC'),
('Pontifícia Universidade Católica do Paraná', 'PUCPR'),
('Pontifícia Universidade Católica de São Paulo', 'PUC-SP'),
('Pontifícia Universidade Católica do Rio de Janeiro', 'PUC-Rio'),
('Pontifícia Universidade Católica do Rio Grande do Sul', 'PUCRS'),
('Universidade Presbiteriana Mackenzie', 'Mackenzie');

-- Cursos: a mesma lista para cada universidade (CROSS JOIN = todas as combinações).
CREATE TEMPORARY TABLE lista_cursos (nome VARCHAR(140));
INSERT INTO lista_cursos VALUES
('Administração'),
('Arquitetura e Urbanismo'),
('Biologia'),
('Ciência da Computação'),
('Ciências Contábeis'),
('Design'),
('Direito'),
('Economia'),
('Enfermagem'),
('Engenharia Civil'),
('Engenharia de Software'),
('Engenharia Mecânica'),
('Farmácia'),
('História'),
('Jornalismo'),
('Letras'),
('Medicina'),
('Pedagogia'),
('Psicologia'),
('Publicidade e Propaganda'),
('Sistemas de Informação');
INSERT INTO cursos (universidade_id, nome) SELECT u.id, l.nome FROM universidades u CROSS JOIN lista_cursos l;

INSERT INTO interesses (nome) VALUES
('Cafés'), ('Cinema'), ('Design'), ('Jogos'), ('Leitura'), ('Música'), ('Natureza'), ('Tecnologia'),
('Animes'), ('Arte'), ('Ciência'), ('Culinária'), ('Dança'), ('Empreendedorismo'), ('Esportes'), ('Fotografia'),
('Idiomas'), ('Meio ambiente'), ('Moda'), ('Podcasts'), ('Séries'), ('Teatro'), ('Viagens'), ('Voluntariado');
