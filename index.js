// TODO: Implementar sistema de cache - Redis (inserir informações sobre cacheable)
// TODO: Ajustar os retornos de erro pro front {status, data, err}
// TODO: Fazer mais tratamentos dos dados recebidos (existem, validos, autenticados, formatados...)
// TODO: Adicionar campos de criacao (date) e modificacao (date) nas tabelas
// TODO: Criar novas subrotas dentro do banco de dados (PUT tastk/category)
// TODO: Modificar o nome da tabela para data_realizaco
// TODO: Criar uma padronização de nomenclaturas e tipos entre backend e frontend
// TODO: Implementar estrutura HATEOAS (GET user/tasks/1/category)
// TODO: Adicionar novos campos dentro do banco de dados
// prioridade TINYINT default 0 => 0 (normal) | 1 (proritária)
// excluida TINYINT defualt 0 => 0 (ativa) | 1 (exluida)
// perdida TINYINT default 0 => 0 (corrente) | 1 (perdida)
// horario CHAR(5) NULL
// tentativas INT default 1 ...

const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

const Usuario = require("./model/Usuario");
const PORT = process.env.PORT || 3001;

var con = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});

/* MIDDLEWARE */
function validarToken(req, res, next) {
  const token = req.headers["x-access-token"];
  if (!token) return res.status(401).json({ result: "Acesso negado!" });

  try {
    jwt.verify(token, process.env.SECRET);
    next();
  } catch (err) {
    return res.status(400).json({ result: "Token inválido!" });
  }
}

/* CADASTRO */
app.get("/auth", validarToken, (req, res) => {
  return res.status(400).json({ result: "Usuário autenticado!" });
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
      process.env.SECRET
    );

    return res.status(201).send({
      result: "Cadastro realizado com sucesso",
      token,
    });
  } catch (err) {
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
    process.env.SECRET
  );

  return res.status(200).send({ result: "Usuário autenticado", token });
});

/* USUARIO */
app.get("/user", validarToken, async (req, res) => {
  const token = req.headers["x-access-token"];
  const { id_usuario } = jwt.verify(
    token,
    process.env.SECRET,
    (err, decoded) => decoded
  );

  const user = await Usuario.findByPk(id_usuario, {
    attributes: ["id_usuario", "nome", "email"],
  });

  const usuario = { usuario: user.dataValues };
  return res.send(usuario);
});

app.put("/user", validarToken, async (req, res) => {
  const { id_usuario, nome, email, senhaAntiga, novaSenha, confirmacaoSenha } =
    req.body;

  const dadosUsuario = await Usuario.findByPk(id_usuario, {
    attributes: ["nome", "email", "senha"],
  });

  const nomeFinal = nome ? nome : dadosUsuario.nome;

  const usuarioExiste = await Usuario.findOne({ where: { email } });
  if (usuarioExiste) {
    return res.status(422).send({ result: "Endereço de e-mail já cadastrado" });
  }
  const emailFinal = email ? email : dadosUsuario.email;

  let senhaFinal;
  if (senhaAntiga == "") {
    senhaFinal = dadosUsuario.senha;
  } else {
    const senhaValida = await bcrypt.compare(senhaAntiga, dadosUsuario.senha);
    if (!senhaValida)
      return res.status(401).send({ result: "A senha inserida é inválida" });

    if (
      novaSenha == "" ||
      confirmacaoSenha == "" ||
      novaSenha !== confirmacaoSenha
    )
      return res.status(422).send({ result: "As senhas não são compatíveis" });

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(novaSenha, salt);
    senhaFinal = hash;
  }

  const query = `UPDATE usuarios SET nome = "${nomeFinal}", email = "${emailFinal}", senha = "${senhaFinal}" WHERE id_usuario = ${id_usuario}`;
  con.query(query, (err, result) => {
    if (err) throw err;
    res.send({ result: "Dados do usuário alterados com sucesso!" });
  });
});

app.delete("/user", validarToken, (req, res) => {
  const token = req.headers["x-access-token"];
  const { id_usuario: id_token } = jwt.verify(
    token,
    process.env.SECRET,
    (err, decoded) => decoded
  );

  const { id_usuario } = req.body;

  if (id_usuario !== id_token)
    return res
      .status(401)
      .send({ result: "Um usuário não pode excluir outro" });

  const queryUsuario = `DELETE FROM usuarios WHERE id_usuario = ${id_usuario}`;
  con.query(queryUsuario, (err, result) => {
    if (err) throw err;
    res.send({ result: "Usuario apagado" });
  });
});

/* TAREFA */
app.post("/tasks", validarToken, (req, res) => {
  // TODO: Fazer a validacao dos dados de entrada - nome e data
  const { usuario, titulo, descricao, dataFinal, categoria } = req.body;

  // if (categoria == 0) categoria = null;

  const query = `INSERT INTO tarefas (usuario, titulo, descricao, data_final, categoria) VALUES (${usuario}, "${titulo}", "${descricao}", "${dataFinal}", ${categoria})`;
  con.query(query, (err, result) => {
    if (err) throw err;
    res.status(201).send({
      result: "Atividade adicionada com sucesso!",
      id_tarefa: result.insertId,
    });
  });
});

app.get("/tasks", validarToken, (req, res) => {
  const token = req.headers["x-access-token"];
  const { id_usuario } = jwt.verify(token, process.env.SECRET, (_, d) => d);
  const query = `SELECT id_tarefa, titulo, data_final, descricao, realizada, categoria FROM tarefas
    WHERE usuario = ${id_usuario}
    ORDER BY data_final`;
  con.query(query, (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});

app.put("/tasks", validarToken, (req, res) => {
  // TODO: Fazer a validacao dos dados de entrada - nome e data
  const { id_tarefa, titulo, descricao, data_final, realizada, categoria } =
    req.body;
  const realizadaTratada = realizada ? 1 : 0;
  const query = `UPDATE tarefas SET  
    titulo = "${titulo}", 
    descricao = "${descricao}", 
    data_final = "${data_final}", 
    realizada = ${realizadaTratada}, 
    categoria = ${categoria} 
    WHERE id_tarefa = ${id_tarefa}`;
  con.query(query, (err, result) => {
    if (err) throw err;
    res.send({ result: "Atividade atualizada com sucesso!" });
  });
});

app.delete("/tasks", validarToken, (req, res) => {
  const { id_tarefa } = req.body;
  const query = `DELETE FROM tarefas WHERE id_tarefa = ${id_tarefa}`;
  con.query(query, (err, result) => {
    if (err) throw err;
    res.send({ result: "Atividade excluída!" });
  });
});

/* CATEGORIA */
app.post("/category", validarToken, (req, res) => {
  const token = req.headers["x-access-token"];
  const { id_usuario } = jwt.verify(
    token,
    process.env.SECRET,
    (err, decoded) => decoded
  );

  const { nome, cor } = req.body;

  if (!nome)
    return res
      .status(422)
      .send({ result: "Não é permitido criar categoria sem nome" });

  const query = `INSERT INTO categorias (usuario, nome_categoria, cor) VALUES (${id_usuario}, "${nome}", "${cor}")`;
  con.query(query, (err, result) => {
    if (err) throw err;
    res.status(201).send({
      result: "Categoria adicionada com sucesso!",
      id_categoria: result.insertId,
    });
  });
});

app.get("/category", validarToken, (req, res) => {
  const token = req.headers["x-access-token"];
  const { id_usuario } = jwt.verify(
    token,
    process.env.SECRET,
    (err, decoded) => decoded
  );

  const query = `SELECT id_categoria, nome_categoria, cor FROM categorias WHERE usuario = ${id_usuario}`;
  con.query(query, (err, result) => {
    if (err) throw err;
    return res.status(200).send(result);
  });
});

app.put("/category", validarToken, (req, res) => {
  const { id_categoria, nome_categoria, cor } = req.body;

  if (!nome_categoria)
    return res
      .status(422)
      .send({ result: "Não é editar criar categorias com nome vazio" });

  const query = `UPDATE categorias SET nome_categoria = "${nome_categoria}", cor = "${cor}" WHERE id_categoria = ${id_categoria}`;
  con.query(query, (err, result) => {
    if (err) throw err;
    res.status(201).send({
      result: "Categoria editada com sucesso!",
    });
  });
});

app.delete("/category", validarToken, (req, res) => {
  const { id_categoria } = req.body;
  const query = `DELETE FROM categorias WHERE id_categoria = ${id_categoria}`;
  con.query(query, (err, result) => {
    if (err) throw err;
    res.send({ result: "Categoria apagada" });
  });
});

/* ROTA */
app.listen(PORT, () => {
  console.log(`Rodando em http://localhost:${PORT}`);
});
