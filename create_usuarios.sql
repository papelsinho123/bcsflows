CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NULL,
  name VARCHAR(255) NOT NULL,
  usuario VARCHAR(100) NOT NULL,
  username VARCHAR(100) NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('master', 'admin', 'user') NOT NULL DEFAULT 'user',
  phone VARCHAR(50) NULL,
  leaveTaken INT NOT NULL DEFAULT 0,
  leaveRuleDays INT NOT NULL DEFAULT 7,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_usuarios_usuario (usuario),
  UNIQUE KEY uk_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS name VARCHAR(255) AFTER nome,
  ADD COLUMN IF NOT EXISTS usuario VARCHAR(100) AFTER name,
  ADD COLUMN IF NOT EXISTS username VARCHAR(100) AFTER usuario,
  ADD COLUMN IF NOT EXISTS password VARCHAR(255) AFTER email,
  ADD COLUMN IF NOT EXISTS role ENUM('master','admin','user') NOT NULL DEFAULT 'user' AFTER password,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50) AFTER role,
  ADD COLUMN IF NOT EXISTS leaveTaken INT NOT NULL DEFAULT 0 AFTER phone,
  ADD COLUMN IF NOT EXISTS leaveRuleDays INT NOT NULL DEFAULT 7 AFTER leaveTaken,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

UPDATE usuarios
SET
  name = COALESCE(NULLIF(name, ''), NULLIF(nome, ''), 'Usuário'),
  usuario = COALESCE(NULLIF(usuario, ''), LOWER(REPLACE(COALESCE(NULLIF(name, ''), NULLIF(nome, ''), 'usuario'), ' ', ''))),
  username = COALESCE(NULLIF(username, ''), COALESCE(NULLIF(usuario, ''), LOWER(REPLACE(COALESCE(NULLIF(name, ''), NULLIF(nome, ''), 'usuario'), ' ', '')))),
  password = COALESCE(password, 'changeme123'),
  role = COALESCE(role, 'user')
WHERE name IS NULL OR usuario IS NULL OR password IS NULL OR role IS NULL;

INSERT INTO usuarios (nome, name, usuario, username, email, password, role, phone, leaveTaken, leaveRuleDays)
SELECT 'Anderson Siebre', 'Anderson Siebre', 'andersonsiebre', 'andersonsiebre', 'andersonsiebre@bcs.com', 'anderson1', 'master', '', 0, 7
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE usuario = 'andersonsiebre' OR email = 'andersonsiebre@bcs.com'
);

INSERT INTO usuarios (nome, name, usuario, username, email, password, role, phone, leaveTaken, leaveRuleDays)
SELECT 'Administrador BCS', 'Administrador BCS', 'admin', 'admin', 'admin@bcs.com', 'admin', 'admin', '', 0, 7
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE usuario = 'admin' OR email = 'admin@bcs.com'
);

INSERT INTO usuarios (nome, name, usuario, username, email, password, role, phone, leaveTaken, leaveRuleDays)
SELECT 'Usuário Padrão', 'Usuário Padrão', 'user', 'user', 'user@bcs.com', 'user', 'user', '', 0, 7
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE usuario = 'user' OR email = 'user@bcs.com'
);
