CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS categorias (
    id_categoria SERIAL PRIMARY KEY,
    usuario INT NOT NULL,
    nome_categoria VARCHAR(100) NOT NULL,
    cor CHAR(7),
    FOREIGN KEY (usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tarefas (
    id_tarefa SERIAL PRIMARY KEY,
    usuario INT NOT NULL,
    categoria INT NULL,
    titulo VARCHAR(100) NOT NULL,
    descricao TEXT NULL,
    data_final DATE NOT NULL,
    realizada BOOLEAN DEFAULT FALSE,
    excluida BOOLEAN DEFAULT FALSE,
    prioridade INT DEFAULT 0, 
    FOREIGN KEY (usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (categoria) REFERENCES categorias(id_categoria) ON DELETE SET NULL
);

