/* ==========================================================================
   SCRIPT DE LOGÍSTICA - GESTÃO DE ENTRADAS AVANÇADAS
   Controle Dinâmico de Abas e Gravação Unificada no MongoDB Atlas
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    carregarHistoricoLotesPEPS();
});

/**
 * Controla a transição visual das abas premium estilo macOS
 */
function alternarModalidadeEntrada(modalidade, botao) {
    // Esconde todos os painéis e remove ativação dos botões
    document.getElementById("painel-entrada-individual").style.display = "none";
    document.getElementById("painel-entrada-documento").style.display = "none";
    document.querySelectorAll(".aba-item").forEach(btn => btn.classList.remove("ativa"));

    // Mostra o painel correto e ativa o botão correspondente
    if (modalidade === 'individual') {
        document.getElementById("painel-entrada-individual").style.display = "block";
    } else {
        document.getElementById("painel-entrada-documento").style.display = "block";
    }
    botao.classList.add("ativa");
}

/**
 * MODALIDADE A: Processa a entrada individual rápida
 */
async function processarEntradaIndividual(event) {
    event.preventDefault();

    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Sistema" };

    const dadosForm = {
        nome_produto: document.getElementById("ind-nome").value.trim(),
        categoria_item: document.getElementById("ind-categoria").value,
        metrica_base: document.getElementById("ind-metrica").value,
        quantidade: Number(document.getElementById("ind-quantidade").value),
        estoque_minimo: Number(document.getElementById("ind-minimo").value),
        numero_lote: document.getElementById("ind-lote").value.trim(),
        data_validade: document.getElementById("ind-validade").value,
        tipo_documento: "ENTRADA INDIVIDUAL",
        numero_documento: "AVULSO_" + Date.now(),
        usuario: sessao.nome
    };

    const sucesso = await salvarItemNoFluxoERP(dadosForm);
    if (sucesso) {
        alert("Entrada individual homologada e salva na nuvem!");
        document.getElementById("form-entrada-individual").reset();
        carregarHistoricoLotesPEPS();
    }
}
/**
 * MODALIDADE B: Processa o lançamento por Nota Fiscal / Lote
 */
async function processarEntradaDocumento(event) {
    event.preventDefault();

    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Sistema" };

    const dadosForm = {
        nome_produto: document.getElementById("doc-item-nome").value.trim(),
        categoria_item: document.getElementById("doc-item-categoria").value,
        metrica_base: document.getElementById("doc-item-metrica").value,
        quantidade: Number(document.getElementById("doc-item-quantidade").value),
        estoque_minimo: Number(document.getElementById("doc-item-minimo").value),
        numero_lote: document.getElementById("doc-item-lote").value.trim(),
        data_validade: document.getElementById("doc-item-validade").value,
        tipo_documento: document.getElementById("doc-tipo").value,
        numero_documento: document.getElementById("doc-numero").value.trim(),
        usuario: sessao.nome
    };

    const sucesso = await salvarItemNoFluxoERP(dadosForm);
    if (sucesso) {
        alert(`Item adicionado à ${dadosForm.tipo_documento} com sucesso!`);
        // Reseta apenas os campos do produto, preservando o cabeçalho da Nota
        document.getElementById("doc-item-nome").value = "";
        document.getElementById("doc-item-quantidade").value = "";
        document.getElementById("doc-item-minimo").value = "";
        document.getElementById("doc-item-lote").value = "";
        document.getElementById("doc-item-validade").value = "";
        carregarHistoricoLotesPEPS();
    }
}

/**
 * Orquestrador Central: Garante a criação do produto e insere o lote na nuvem
 */
async function salvarItemNoFluxoERP(dados) {
    try {
        // 1. Busca os produtos cadastrados para verificar se já existe no catálogo
        const resProd = await fetch('/api/produtos');
        const produtos = await resProd.json();
        
        let produtoExistente = produtos.find(p => p.nome_produto.toLowerCase() === dados.nome_produto.toLowerCase());
        let produtoId;

        // Se não existir o produto no catálogo principal, cria um novo registro automático
        if (!produtoExistente) {
            const novoProdRes = await fetch('/api/salvar/produtos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome_produto: dados.nome_produto,
                    categoria_item: dados.categoria_item,
                    metrica_base: dados.metrica_base
                })
            });
            const resultadoNovoProd = await novoProdRes.json();
            produtoId = resultadoNovoProd.id;
        } else {
            produtoId = produtoExistente._id;
        }

        // 2. Cria o lote de suprimento (Entrada) atrelado ao ID do produto
        const payloadLote = {
            produto_id: produtoId,
            nome_produto_snapshot: dados.nome_produto,
            quantidade_inicial: dados.quantidade,
            quantidade_atual: dados.quantidade, // Saldo inicial cheio
            tipo_documento: dados.tipo_documento,
            numero_documento: dados.numero_documento,
            estoque_minimo: dados.estoque_minimo,
            data_validade: new Date(dados.data_validade).toISOString(),
            numero_lote: dados.numero_lote,
            usuario_responsavel: dados.usuario
        };

        const resLote = await fetch('/api/salvar/entradas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadLote)
        });

        return resLote.ok;

    } catch (e) {
        console.error("Erro ao salvar entrada no MongoDB Atlas:", e);
        alert("Erro de comunicação! O servidor não conseguiu gravar o lote na nuvem.");
        return false;
    }
}

/**
 * Busca todas as entradas ativas e renderiza a tabela em ordem de vencimento (PEPS)
 */
async function carregarHistoricoLotesPEPS() {
    const tbody = document.getElementById("corpo-tabela-entradas");
    if (!tbody) return;

    try {
        const res = await fetch('/api/entradas');
        const lotes = await res.json();

        tbody.innerHTML = "";

        if (lotes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhum lote registrado no almoxarifado central.</td></tr>`;
            return;
        }

        lotes.forEach(lote => {
            const dataValidadeFormated = new Date(lote.data_validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="badge-mac badge-azul">${lote.tipo_documento}</span><br><small style="color:var(--cinza-texto-secundario)">${lote.numero_documento}</small></td>
                <td><strong>${lote.nome_produto_snapshot}</strong></td>
                <td><small>${lote.usuario_responsavel || 'Almoxarife'}</small></td>
                <td><code>${lote.numero_lote}</code></td>
                <td>${lote.quantidade_inicial}</td>
                <td><strong style="color: ${lote.quantidade_atual <= lote.estoque_minimo ? 'var(--vermelho-apple)' : 'var(--cinza-texto-principal)'}">${lote.quantidade_atual}</strong></td>
                <td><small>${lote.quantidade_inicial > 1 ? lote.metrica_base : lote.metrica_base}</small></td>
                <td><span style="color:var(--cinza-texto-secundario)">${lote.estoque_minimo}</span></td>
                <td><small>${dataValidadeFormated}</small></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Erro ao carregar tabela de entradas:", e);
    }
}
