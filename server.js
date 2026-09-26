import express from 'express';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(express.static('public'));

// 🚀 CORREÇÃO DE ENGENHARIA (Steve Jobs UX): Redireciona a raiz "/" automaticamente para a tela de login
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// ==========================================================================
// 🔌 CONEXÃO REAL COM O MONGO ATLAS (HD NA NUVEM)
// ==========================================================================
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin_cozinha:SantaBarbara2026@clustercozinhaerp.pdngimz.mongodb.net/cozinha_piloto_db?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("🔌 Conectado com sucesso ao MongoDB Atlas (HD na Nuvem)!"))
    .catch((err) => console.error("❌ Erro fatal de conexão no banco na nuvem:", err));

// ==========================================================================
// 🗄️ MODELAGEM DOS DADOS JSON (MOLDES DO SEU ESCOPO DO ERP)
// ==========================================================================

// 1. Tabela: Usuários e Acessos
const UsuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    cpf: { type: String, required: true, unique: true },
    perfil: { type: String, enum: ['ADMINISTRADOR', 'ADMINISTRATIVO', 'OPERADOR'], required: true },
    senha: { type: String, required: true },
    ativo: { type: Boolean, default: true }
}, { timestamps: true });

// 2. Tabela: Catálogo de Produtos Unificado (Merenda + Materiais + Utensílios)
const ProdutoSchema = new mongoose.Schema({
    nome_produto: { type: String, required: true, unique: true },
    categoria_item: { type: String, enum: ['Insumo Alimentar', 'Material de Consumo', 'Utensílio/Bem Durável'], required: true },
    metrica_base: { type: String, enum: ['KG', 'UNIDADE', 'LITROS', 'OUTRAS'], required: true }
}, { timestamps: true });

// 3. Tabela: Lotes e Entradas Avançadas (Dupla Modalidade: Nota Fiscal ou Individual)
const EntradaSchema = new mongoose.Schema({
    produto_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto', required: true },
    nome_produto_snapshot: { type: String, required: true }, 
    quantidade_inicial: { type: Number, required: true },
    quantidade_atual: { type: Number, required: true }, 
    tipo_documento: { type: String, enum: ['NOTA FISCAL', 'DOAÇÃO', 'DOCUMENTO INTERNO', 'ENTRADA INDIVIDUAL'], required: true },
    numero_documento: { type: String, required: true }, 
    estoque_minimo: { type: Number, required: true },
    data_validade: { type: Date, required: true }, 
    numero_lote: { type: String, required: true },
    usuario_responsavel: { type: String, required: true }
}, { timestamps: true });

// 4. Tabela: Saídas e Distribuição Híbrida (Item a Item ou por Cardápio)
const SaidaSchema = new mongoose.Schema({
    entrada_lote_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entrada', required: true },
    nome_produto: { type: String, required: true },
    quantidade_retirada: { type: Number, required: true },
    tipo_saida: { type: String, enum: ['RECEITA', 'ITEM A ITEM'], required: true },
    nome_cardapio: { type: String, default: "" }, 
    local_envio_destino: { type: String, required: true }, 
    numero_lote_origem: { type: String, required: true },
    usuario_responsavel: { type: String, required: true }
}, { timestamps: true });

// 5. Tabela: Fichas Técnicas e Cardápios Prévios
const CardapioSchema = new mongoose.Schema({
    nome_cardapio: { type: String, required: true, unique: true },
    itens_composicao: [{
        produto_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto' },
        nome_produto: String,
        quantidade_por_aluno: { type: Number, required: true } 
    }]
}, { timestamps: true });

// 6. Tabela: Módulo de Quebras, Avarias e Consumo de Bens
const QuebraSchema = new mongoose.Schema({
    nome_produto: { type: String, required: true },
    numero_lote: { type: String, required: true },
    quantidade_danificada: { type: Number, required: true },
    motivo_justificado: { type: String, required: true }, 
    usuario_responsavel: { type: String, required: true }
}, { timestamps: true });

// Instanciação dos Modelos Operacionais do Mongoose
const Usuario = mongoose.model('Usuario', UsuarioSchema);
const Produto = mongoose.model('Produto', ProdutoSchema);
const Entrada = mongoose.model('Entrada', EntradaSchema);
const Saida = mongoose.model('Saida', SaidaSchema);
const Cardapio = mongoose.model('Cardapio', CardapioSchema);
const Quebra = mongoose.model('Quebra', QuebraSchema);

// ==========================================================================
// 🛣️ ROTAS UNIVERSAIS DA API (ENDPOINTS SEGUROS PARA AS TELAS CONSUMIREM)
// ==========================================================================

// Rota genérica para listagem completa (GET)
app.get('/api/:tabela', async (req, res) => {
    try {
        const { tabela } = req.params;
        let colecao = [];
        
        if (tabela === 'usuarios') colecao = await Usuario.find();
        if (tabela === 'produtos') colecao = await Produto.find().sort({ nome_produto: 1 });
        if (tabela === 'entradas') colecao = await Entrada.find().sort({ data_validade: 1 }); 
        if (tabela === 'saidas') colecao = await Saida.find().sort({ createdAt: -1 });
        if (tabela === 'cardapios') colecao = await Cardapio.find();
        if (tabela === 'quebras') colecao = await Quebra.find().sort({ createdAt: -1 });
        
        res.json(colecao);
    } catch (e) {
        res.status(500).json({ erro: `Falha ao requisitar dados da tabela: ${req.params.tabela}` });
    }
});

// Rota genérica para salvamento e inserções no banco na nuvem (POST)
app.post('/api/salvar/:tabela', async (req, res) => {
    try {
        const { tabela } = req.params;
        let novoItem;
        
        if (tabela === 'usuarios') novoItem = await new Usuario(req.body).save();
        if (tabela === 'produtos') novoItem = await new Produto(req.body).save();
        if (tabela === 'entradas') novoItem = await new Entrada(req.body).save();
        if (tabela === 'saidas') novoItem = await new Saida(req.body).save();
        if (tabela === 'cardapios') novoItem = await new Cardapio(req.body).save();
        if (tabela === 'quebras') novoItem = await new Quebra(req.body).save();
        
        res.json({ sucesso: true, id: novoItem._id });
    } catch (e) {
        res.status(500).json({ erro: `Falha ao processar inserção na tabela: ${req.params.tabela}` });
    }
});

app.listen(PORT, () => console.log(`🚀 Motor ERP ativo e aguardando requisições na porta ${PORT}`));
