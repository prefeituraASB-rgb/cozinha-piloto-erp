/* ==========================================================================
   SCRIPT DE LOGÍSTICA - GESTÃO DE CARDÁPIOS & FICHAS TÉCNICAS
   Criação Dinâmica de Ingredientes com Persistência no MongoDB Atlas
   ========================================================================== */

let cacheProdutosDisponiveis = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarTelaCardapios();
});

async function inicializarTelaCardapios() {
    await carregarCatalogoProdutos();
    await carregarFichasTecnicasCadastradas();
}

/**
 * Puxa todos os produtos do banco na nuvem para usar de opção nos ingredientes
 */
async function carregarCatalogoProdutos() {
    try {
        const res = await fetch('/api/produtos');
        cacheProdutosDisponiveis = await res.json();
    } catch (e) {
        console.error("Erro ao carregar catálogo de produtos para o cardápio:", e);
    }
}

/**
 * Injeta uma nova linha de produto + quantidade por aluno no formulário
 */
function adicionarLinhaIngredienteAoFormulario() {
    const container = document.getElementById("container-ingredientes-dinamicos");
    if (!container) return;

    if (cacheProdutosDisponiveis.length === 0) {
        alert("Atenção: Cadastre primeiro os produtos no almoxarifado antes de criar um cardápio!");
        return;
    }

    const idLinha = "linha_" + Date.now() + Math.floor(Math.random() * 100);

    // Monta as opções do select baseado no banco de dados da nuvem
    const opcoesSelect = cacheProdutosDisponiveis.map(p => 
        `<option value="${p._id}">${p.nome_produto} (${p.metrica_base})</option>`
    ).join('');

    const div = document.createElement("div");
    div.id = idLinha;
    div.className = "ingrediente-linha";
    div.innerHTML = `
        <select required class="car-item-id">
            <option value="">Selecione o Insumo / Produto...</option>
            ${opcoesSelect}
        </select>
        <input type="number" step="0.0001" min="0.0001" required class="car-item-qtd" placeholder="Qtd por Aluno (Ex: 0.050)">
        <button type="button" class="btn-apple" style="background-color: var(--vermelho-apple); height: 38px; padding: 0 12px;" onclick="document.getElementById('${idLinha}').remove()">✕</button>
    `;

    container.appendChild(div);
}
/**
 * Captura as linhas dinâmicas, valida os campos e envia a ficha para o MongoDB Atlas
 */
async function salvarCardapioMestreNaNuvem(event) {
    event.preventDefault();

    const nomeCardapio = document.getElementById("car-nome-prato").value.trim();
    const linhasIngredientes = document.querySelectorAll(".ingrediente-linha");

    if (linhasIngredientes.length === 0) {
        alert("Erro! Adicione pelo menos um insumo na composição da Ficha Técnica.");
        return;
    }

    const itensComposicao = [];
    let erroValidacao = false;

    // Varre as linhas geradas na tela para montar o array estruturado
    linhasIngredientes.forEach(linha => {
        const produtoId = linha.querySelector(".car-item-id").value;
        const quantidadePorAluno = Number(linha.querySelector(".car-item-qtd").value);
        
        const produtoReal = cacheProdutosDisponiveis.find(p => p._id === produtoId);

        if (!produtoId || quantidadePorAluno <= 0 || !produtoReal) {
            erroValidacao = true;
            return;
        }

        itensComposicao.push({
            produto_id: produtoId,
            nome_produto: produtoReal.nome_produto,
            quantidade_por_aluno: quantidadePorAluno
        });
    });

    if (erroValidacao) {
        alert("Verifique os campos preenchidos! Há ingredientes inválidos ou com quantidade zerada.");
        return;
    }

    const payloadCardapio = {
        nome_cardapio: nomeCardapio,
        itens_composicao: itensComposicao
    };

    try {
        const res = await fetch('/api/salvar/cardapios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadCardapio)
        });

        if (res.ok) {
            alert(`Ficha Técnica do cardápio [${nomeCardapio}] homologada com sucesso na nuvem!`);
            document.getElementById("form-cadastro-cardapio").reset();
            document.getElementById("container-ingredientes-dinamicos").innerHTML = "";
            inicializarTelaCardapios();
        } else {
            alert("Erro ao salvar! Verifique se já não existe um cardápio cadastrado com este mesmo nome.");
        }

    } catch (e) {
        console.error("Erro no envio da ficha técnica para o servidor:", e);
        alert("Falha de rede ao tentar conectar com a API na nuvem.");
    }
}

/**
 * Puxa todas as fichas cadastradas do banco e joga na listagem do rodapé
 */
async function carregarFichasTecnicasCadastradas() {
    const tbody = document.getElementById("corpo-tabela-cardapios");
    if (!tbody) return;

    try {
        const res = await fetch('/api/cardapios');
        const cardapios = await res.json();

        tbody.innerHTML = "";

        if (cardapios.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhum cardápio homologado pela Nutrição.</td></tr>`;
            return;
        }

        cardapios.forEach(card => {
            // Transforma o array de ingredientes em um texto limpo e legível por badge
            const resumoIngredientes = card.itens_composicao.map(i => 
                `<span class="badge-mac badge-cinza" style="margin-right:4px; margin-bottom:4px; display:inline-flex;">${i.nome_produto}: <strong>${i.quantidade_por_aluno}</strong></span>`
            ).join('');

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${card.nome_cardapio}</strong></td>
                <td style="max-width: 450px; line-height: 1.6; padding: 10px 16px;">${resumoIngredientes}</td>
                <td><span class="badge-mac badge-azul">1 Aluno Base</span></td>
                <td style="text-align:center;">
                    <span style="font-size:0.8rem; color:var(--cinza-texto-secundario); font-weight:600;">Homologado ✅</span>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Erro ao renderizar tabela de cardápios:", e);
    }
}
