CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO usuarios (nome, email)
SELECT 'Anderson Siebre', 'andersonsiebre@bcs.com'
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE nome = 'Anderson Siebre' OR email = 'andersonsiebre@bcs.com'
);
