```sql
CREATE DATABASE doitask;

USE doitask;

CREATE TABLE usuarios (
	id_usuario INT NOT NULL AUTO_INCREMENT,
	nome VARCHAR(200) NOT NULL,
	email VARCHAR(100) UNIQUE NOT NULL,
	senha VARCHAR(200) NOT NULL,
    PRIMARY KEY (id_usuario)
);

CREATE TABLE tarefas (
	id_tarefa INT NOT NULL AUTO_INCREMENT,
	usuario INT NOT NULL,
    categoria INT NULL,
	titulo VARCHAR(100) NOT NULL,
	descricao LONGTEXT NULL,
	data_final DATE NOT NULL,
	realizada BIT(1) DEFAULT 0,
    excluida BIT(1) DEFAULT 0,
    PRIMARY KEY (id_tarefa)
);

ALTER TABLE tarefas
ADD CONSTRAINT FK_usuario
FOREIGN KEY (usuario) REFERENCES usuarios(id_usuario);
ALTER TABLE tarefas
ADD CONSTRAINT FK_categoria
FOREIGN KEY (categoria) REFERENCES categorias(id_categoria);

CREATE TABLE categorias (
	id_categoria INT NOT NULL AUTO_INCREMENT,
	usuario INT NOT NULL,
	nome VARCHAR(100) NOT NULL,
	cor CHAR(6),
    PRIMARY KEY (id_categoria)
);

ALTER TABLE categorias
ADD CONSTRAINT FK_usuario_categoria
FOREIGN KEY (usuario) REFERENCES usuarios(id_usuario);
```