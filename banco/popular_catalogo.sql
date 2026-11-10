-- Zuno - catálogo inicial de universidades, cursos e interesses.
-- Importar depois de zuno.sql. Pode ser executado mais de uma vez: só insere o que ainda não existe.
-- Cada universidade recebe a mesma lista de cursos; ajuste com a oferta real de cada instituição.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
USE zuno;

INSERT INTO universidades (nome, sigla)
SELECT nova.nome, nova.sigla FROM (
  SELECT 'Universidade de São Paulo' AS nome, 'USP' AS sigla
  UNION ALL SELECT 'Universidade Estadual de Campinas', 'UNICAMP'
  UNION ALL SELECT 'Universidade Estadual Paulista', 'UNESP'
  UNION ALL SELECT 'Universidade Federal do Rio de Janeiro', 'UFRJ'
  UNION ALL SELECT 'Universidade Federal de Minas Gerais', 'UFMG'
  UNION ALL SELECT 'Universidade Federal do Paraná', 'UFPR'
  UNION ALL SELECT 'Universidade Tecnológica Federal do Paraná', 'UTFPR'
  UNION ALL SELECT 'Universidade Federal de Santa Catarina', 'UFSC'
  UNION ALL SELECT 'Universidade Federal do Rio Grande do Sul', 'UFRGS'
  UNION ALL SELECT 'Universidade de Brasília', 'UnB'
  UNION ALL SELECT 'Universidade Federal da Bahia', 'UFBA'
  UNION ALL SELECT 'Universidade Federal de Pernambuco', 'UFPE'
  UNION ALL SELECT 'Universidade Federal do Ceará', 'UFC'
  UNION ALL SELECT 'Pontifícia Universidade Católica do Paraná', 'PUCPR'
  UNION ALL SELECT 'Pontifícia Universidade Católica de São Paulo', 'PUC-SP'
  UNION ALL SELECT 'Pontifícia Universidade Católica do Rio de Janeiro', 'PUC-Rio'
  UNION ALL SELECT 'Pontifícia Universidade Católica do Rio Grande do Sul', 'PUCRS'
  UNION ALL SELECT 'Universidade Presbiteriana Mackenzie', 'Mackenzie'
) nova
WHERE NOT EXISTS (SELECT 1 FROM universidades u WHERE u.nome = nova.nome);

INSERT INTO cursos (universidade_id, nome)
SELECT u.id, curso.nome
FROM universidades u
JOIN (
  SELECT 'Administração' AS nome
  UNION ALL SELECT 'Arquitetura e Urbanismo'
  UNION ALL SELECT 'Biologia'
  UNION ALL SELECT 'Ciência da Computação'
  UNION ALL SELECT 'Ciências Contábeis'
  UNION ALL SELECT 'Direito'
  UNION ALL SELECT 'Design'
  UNION ALL SELECT 'Economia'
  UNION ALL SELECT 'Enfermagem'
  UNION ALL SELECT 'Engenharia Civil'
  UNION ALL SELECT 'Engenharia de Software'
  UNION ALL SELECT 'Engenharia Mecânica'
  UNION ALL SELECT 'Farmácia'
  UNION ALL SELECT 'História'
  UNION ALL SELECT 'Jornalismo'
  UNION ALL SELECT 'Letras'
  UNION ALL SELECT 'Medicina'
  UNION ALL SELECT 'Pedagogia'
  UNION ALL SELECT 'Psicologia'
  UNION ALL SELECT 'Publicidade e Propaganda'
  UNION ALL SELECT 'Sistemas de Informação'
) curso
WHERE u.sigla NOT IN ('UE', 'UC')
  AND NOT EXISTS (SELECT 1 FROM cursos c WHERE c.universidade_id = u.id AND c.nome = curso.nome);

INSERT IGNORE INTO interesses (nome) VALUES
('Animes'), ('Arte'), ('Ciência'), ('Culinária'), ('Dança'), ('Empreendedorismo'), ('Esportes'), ('Fotografia'),
('Idiomas'), ('Meio ambiente'), ('Moda'), ('Podcasts'), ('Séries'), ('Teatro'), ('Viagens'), ('Voluntariado');
