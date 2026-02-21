// TODO: Implementar sistema de cache - Redis (inserir informações sobre cacheable)
// TODO: Atualizar os triggers e SP para o CASCADE
// TODO: Ajustar os retornos de erro pro front {status, data, err}
// TODO: Fazer mais tratamentos dos dados recebidos (existem, validos, autenticados, formatados...)
// TODO: Adicionar campos de criacao (date) e modificacao (date) nas tabelas
// TODO: Criar novas subrotas dentro do banco de dados (PUT tastk/category)
// TODO: Modificar o nome da tabela para data_realizaco
// TODO: Criar uma padronização de nomenclaturas e tipos entre backend e frontend
// TODO: Implementar estrutura HATEOAS (GET user/tasks/:id/category)

// TODO: Adicionar novos campos dentro do banco de dados
// data_final => prazo_dia DATE NULL
// prazo_hora TIME NULL
// realizada DATETIME NULL
// perdida TINYINT default 0 => 0 (corrente) | 1 (perdida)
// progresso INT default 0 => 0 (min) | 100 (max)
// tentativas INT default 1 ...

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// Security middlewares
app.use(helmet());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Many requests from this IP, please try again after 15 minutes",
});
app.use(limiter);

// CORS configuration - Allow production frontend
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:5173"];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = "The CORS policy for this site does not allow access from the specified Origin.";
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

const Usuario = require("./model/Usuario");
const PORT = process.env.PORT || 3001;

const con = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

/* MIDDLEWARE */
function validarToken(req, res, next) {
  const token = req.headers["x-access-token"] || req.headers["authorization"]?.split(" ")[1];

  if (!token) return res.status(401).json({ result: "Acesso negado! Token não fornecido." });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user info to request
    next();
  } catch (err) {
    return res.status(401).json({ result: "Token inválido ou expirado!" });
  }
}

/* CADASTRO */
app.get("/auth", validarToken, (req, res) => {
  return res.status(200).json({ result: "Usuário autenticado!", user: req.user });
});

app.post("/auth/register", async (req, res) => {
  const { nome, email, senha, senhaConfirmacao } = req.body;

  if (!nome) {
    return res.status(422).send({ result: "O nome de usuário é obrigatório" });
  }
  if (!senha) {
    return res.status(422).send({ result: "A senha é obrigatória" });
  }
  if (!email) {
    return res
      .status(422)
      .send({ result: "O endereço de e-mail é obrigatório" });
  }

  const usuarioExiste = await Usuario.findOne({ where: { email } });
  if (usuarioExiste) {
    return res.status(422).send({ result: "Endereço de e-mail já cadastrado" });
  }

  if (senha !== senhaConfirmacao) {
    return res
      .status(422)
      .send({ result: "As senhas inseridas não são compatíveis" });
  }

  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(senha, salt);

  try {
    const novoUsuario = await Usuario.create({
      nome,
      email,
      senha: hash,
    });

    const token = jwt.sign(
      { id_usuario: novoUsuario.id_usuario },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(201).send({
      result: "Cadastro realizado com sucesso",
      token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send({
      result: "Ocorreu um erro no cadastro, tente novamente mais tarde",
    });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, senha } = req.body;

  if (!senha) {
    return res.status(422).send({ result: "A senha é obrigatória" });
  }
  if (!email) {
    return res
      .status(422)
      .send({ result: "O endereço de e-mail é obrigatório" });
  }

  const usuario = await Usuario.findOne({ where: { email } });
  if (!usuario) {
    return res.status(404).send({ result: "Usuário não encontrado" });
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senha);
  if (!senhaValida) {
    return res.status(422).send({ result: "A senha não é válida" });
  }

  const token = jwt.sign(
    { id_usuario: usuario.id_usuario },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  return res.status(200).send({ result: "Usuário autenticado", token });
});

/* USUARIO */
app.get("/user", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;

    const user = await Usuario.findByPk(id_usuario, {
      attributes: ["id_usuario", "nome", "email"],
    });

    if (!user) {
      return res.status(404).send({ result: "Usuário não encontrado" });
    }

    return res.send({ usuario: user.dataValues });
  } catch (err) {
    console.error(err);
    return res.status(500).send({ result: "Erro ao buscar dados do usuário" });
  }
});

app.put("/user", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;
    const { nome, email, senhaAntiga, novaSenha, confirmacaoSenha } = req.body;

    const dadosUsuario = await Usuario.findByPk(id_usuario);
    if (!dadosUsuario) return res.status(404).send({ result: "Usuário não encontrado" });

    const nomeFinal = nome || dadosUsuario.nome;

    if (email && email !== dadosUsuario.email) {
      const usuarioExiste = await Usuario.findOne({ where: { email } });
      if (usuarioExiste) {
        return res.status(422).send({ result: "Endereço de e-mail já cadastrado" });
      }
    }
    const emailFinal = email || dadosUsuario.email;

    let senhaFinal = dadosUsuario.senha;
    if (senhaAntiga) {
      const senhaValida = await bcrypt.compare(senhaAntiga, dadosUsuario.senha);
      if (!senhaValida)
        return res.status(401).send({ result: "A senha inserida é inválida" });

      if (!novaSenha || novaSenha !== confirmacaoSenha)
        return res.status(422).send({ result: "As senhas não são compatíveis" });

      const salt = await bcrypt.genSalt(12);
      senhaFinal = await bcrypt.hash(novaSenha, salt);
    }

    const query = "UPDATE usuarios SET nome = $1, email = $2, senha = $3 WHERE id_usuario = $4";
    await con.query(query, [nomeFinal, emailFinal, senhaFinal, id_usuario]);

    res.send({ result: "Dados do usuário alterados com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao atualizar usuário" });
  }
});

app.delete("/user/:id", validarToken, async (req, res) => {
  try {
    const { id_usuario: id_token } = req.user;
    const { id } = req.params;

    if (id != id_token)
      return res.status(403).send({ result: "Um usuário não pode excluir outro" });

    await con.query("DELETE FROM usuarios WHERE id_usuario = $1", [id]);
    res.send({ result: "Usuario apagado" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao excluir usuário" });
  }
});

/* TAREFA */
app.post("/tasks", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;
    let { titulo, descricao, dataFinal, categoria, prioridade } = req.body;

    if (categoria == 0) categoria = null;

    const query = `INSERT INTO tarefas (usuario, titulo, descricao, data_final, categoria, prioridade) 
                   VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_tarefa`;
    const values = [id_usuario, titulo, descricao, dataFinal, categoria, prioridade];

    const result = await con.query(query, values);
    res.status(201).send({
      result: "Atividade adicionada com sucesso!",
      id_tarefa: result.rows[0].id_tarefa,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao criar tarefa" });
  }
});

app.get("/tasks", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;
    const query = `SELECT id_tarefa, titulo, data_final, descricao, realizada, categoria, prioridade FROM tarefas
      WHERE usuario = $1
      ORDER BY data_final`;
    const result = await con.query(query, [id_usuario]);
    res.send(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao buscar tarefas" });
  }
});

app.put("/tasks", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;
    let { id_tarefa, titulo, descricao, data_final, realizada, categoria, prioridade } = req.body;

    if (categoria == 0) categoria = null;
    const realizadaTratada = realizada ? true : false;

    // Check ownership
    const checkOwnership = await con.query("SELECT usuario FROM tarefas WHERE id_tarefa = $1", [id_tarefa]);
    if (checkOwnership.rows.length === 0) return res.status(404).send({ result: "Tarefa não encontrada" });
    if (checkOwnership.rows[0].usuario !== id_usuario) return res.status(403).send({ result: "Acesso negado" });

    const query = `UPDATE tarefas SET  
      titulo = $1, 
      descricao = $2, 
      data_final = $3, 
      realizada = $4, 
      categoria = $5,
      prioridade = $6 
      WHERE id_tarefa = $7 AND usuario = $8`;

    await con.query(query, [titulo, descricao, data_final, realizadaTratada, categoria, prioridade, id_tarefa, id_usuario]);
    res.send({ result: "Atividade atualizada com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao atualizar tarefa" });
  }
});

app.delete("/tasks/:id", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;
    const { id } = req.params;

    const result = await con.query("DELETE FROM tarefas WHERE id_tarefa = $1 AND usuario = $2", [id, id_usuario]);

    if (result.rowCount === 0) {
      return res.status(404).send({ result: "Tarefa não encontrada ou não pertence ao usuário" });
    }

    res.send({ result: "Atividade excluída!" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao excluir tarefa" });
  }
});

/* CATEGORIA */
app.post("/category", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;
    const { nome, cor } = req.body;

    if (!nome)
      return res.status(422).send({ result: "Não é permitido criar categoria sem nome" });

    const query = `INSERT INTO categorias (usuario, nome_categoria, cor) VALUES ($1, $2, $3) RETURNING id_categoria`;
    const result = await con.query(query, [id_usuario, nome, cor]);

    res.status(201).send({
      result: "Categoria adicionada com sucesso!",
      id_categoria: result.rows[0].id_categoria,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao criar categoria" });
  }
});

app.get("/category", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;
    const query = `SELECT id_categoria, nome_categoria, cor FROM categorias WHERE usuario = $1`;
    const result = await con.query(query, [id_usuario]);
    return res.status(200).send(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao buscar categorias" });
  }
});

app.put("/category", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;
    const { id_categoria, nome_categoria, cor } = req.body;

    if (!nome_categoria)
      return res.status(422).send({ result: "Não é editar criar categorias com nome vazio" });

    const query = `UPDATE categorias SET nome_categoria = $1, cor = $2 WHERE id_categoria = $3 AND usuario = $4`;
    const result = await con.query(query, [nome_categoria, cor, id_categoria, id_usuario]);

    if (result.rowCount === 0) {
      return res.status(404).send({ result: "Categoria não encontrada ou não pertence ao usuário" });
    }

    res.status(200).send({ result: "Categoria editada com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao editar categoria" });
  }
});

app.delete("/category/:id", validarToken, async (req, res) => {
  try {
    const { id_usuario } = req.user;
    const { id } = req.params;

    const result = await con.query("DELETE FROM categorias WHERE id_categoria = $1 AND usuario = $2", [id, id_usuario]);

    if (result.rowCount === 0) {
      return res.status(404).send({ result: "Categoria não encontrada ou não pertence ao usuário" });
    }

    res.send({ result: "Categoria apagada" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ result: "Erro ao excluir categoria" });
  }
});

/* ROTA */
app.listen(PORT, () => {
  console.log(`Rodando em http://localhost:${PORT}`);
});
