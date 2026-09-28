/* ==========================================================================
   SCRIPT DE LOGÍSTICA - GESTÃO DE SAÍDAS E DISTRIBUIÇÃO PEPS
   Controle Híbrido Avançado com Persistência no MongoDB Atlas
   ========================================================================== */

let cacheLotesDisponiveis = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarTelaSaidas();
});

async function inicializarTelaSaidas() {
    await carregarLotesNoSeletor();
    await carregarSelectCardapios();
    await carregarHistoricoSaidas();
}

/**
 * Controla a transição visual das abas estilo macOS
 */
function alternarModalidadeSaida(modalidade, botao) {
    document.getElementById("painel-saida-item").style.display = "none";
    document.getElementById("painel-saida-cardapio").style.display = "none";
    document.querySelectorAll(".aba-item").forEach(btn => btn.classList.remove("ativa"));

    if (modalidade === 'item') {
        document.getElementById("painel-saida-item").style.display = "block";
    } else {
        document.getElementById("painel-saida-cardapio").style.display = "block";
    }
    botao.classList.add("ativa");
}

/**
 * Puxa os lotes com saldo ativo do MongoDB e joga no select da tela
 */
async function carregarLotesNoSeletor() {
    const select = document.getElementById("sai-lote-id");
    if (!select) return;

    try {
        const res = await fetch('/api/entradas');
        const lotes = await res.json();
        
        // Filtra para exibir apenas lotes que ainda possuem mercadoria em estoque
        cacheLotesDisponiveis = lotes.filter(l => l.quantidade_atual > 0);

        select.innerHTML = '<option value="">Selecione o Lote Disponível...</option>';
        cacheLotesDisponiveis.forEach(lote => {
            const dataValidade = new Date(lote.data_validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            select.innerHTML += `
                <option value="${lote._id}">
                    ${lote.nome_produto_snapshot} [Lote: ${lote.numero_lote}] - Saldo: ${lote.quantidade_atual} (Venc: ${dataValidade})
                </option>
            `;
        });
    } catch (e) {
        console.error("Erro ao alimentar seletor de lotes:", e);
    }
}

function atualizarInformativoMetricaItem(select) {
    const txt = document.getElementById("txt-metrica-item");
    if (!txt || !select.value) return;
    
    // Procura o lote selecionado para exibir a métrica correta ao operador (Ex: KG, Litros)
    const lote = cacheLotesDisponiveis.find(l => l._id === select.value);
    txt.innerText = lote ? `(Métrica Base: ${lote.tipo_documento ? 'Unidades/Medida' : 'Insumo'})` : "";
}

/**
 * MODALIDADE A: Processa a baixa isolada Item a Item
 */
async function processarSaidaItemAItem(event) {
    event.preventDefault();

    const loteId = document.getElementById("sai-lote-id").value;
    const qtdRetirar = Number(document.getElementById("sai-quantidade").value);
    const destino = document.getElementById("sai-destino").value;
    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Sistema" };

    if (!loteId) {
        alert("Selecione um lote válido para realizar a retirada.");
        return;
    }

    // Busca o lote real no cache para validar o saldo antes de mandar para a nuvem
    const loteSelecionado = cacheLotesDisponiveis.find(l => l._id === loteId);
    if (qtdRetirar > loteSelecionado.quantidade_atual) {
        alert(`Saldo Insuficiente! O lote selecionado possui apenas ${loteSelecionado.quantidade_atual} unidades disponíveis.`);
        return;
    }

    try {
        // 1. Atualiza o saldo atualizado do lote no banco
        loteSelecionado.quantidade_atual -= qtdRetirar;
        await fetch(`/api/salvar/entradas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loteSelecionado)
        });

        // 2. Registra a linha histórica de movimentação na tabela de saídas
        const payloadSaida = {
            entrada_lote_id: loteId,
            nome_produto: loteSelecionado.nome_produto_snapshot,
            quantidade_retirada: qtdRetirar,
            tipo_saida: "ITEM A ITEM",
            local_envio_destino: destino,
            numero_lote_origem: loteSelecionado.numero_lote,
            usuario_responsavel: sessao.nome
        };

        await fetch('/api/salvar/saidas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadSaida)
        });

        alert("Baixa física homologada com sucesso no MongoDB Atlas!");
        document.getElementById("form-saida-item").reset();
        inicializarTelaSaidas();

    } catch (e) {
        console.error("Erro no fluxo de saída item a item:", e);
    }
}
/**
 * Alimenta o seletor de receitas homologadas
 */
async function carregarSelectCardapios() {
    const select = document.getElementById("sai-cardapio-id");
    if (!select) return;

    try {
        const res = await fetch('/api/cardapios');
        const cardapios = await res.json();

        select.innerHTML = '<option value="">Selecione o Cardápio...</option>';
        cardapios.forEach(c => {
            select.innerHTML += `<option value="${c._id}">${c.nome_cardapio}</option>`;
        });
    } catch (e) {
        console.error("Erro ao buscar fichas de cardápios:", e);
    }
}

/**
 * MODALIDADE B: Processa o abatimento em massa via Cardápio (Algoritmo PEPS)
 */
async function processarSaidaPorCardapio(event) {
    event.preventDefault();

    const cardapioId = document.getElementById("sai-cardapio-id").value;
    const totalAlunos = Number(document.getElementById("sai-cardapio-alunos").value);
    const destino = document.getElementById("sai-cardapio-destino").value;
    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Sistema" };

    try {
        // Busca a ficha do cardápio selecionado na nuvem
        const resCard = await fetch('/api/cardapios');
        const cardapios = await resCard.json();
        const cardapioSelecionado = cardapios.find(c => c._id === cardapioId);

        if (!cardapioSelecionado) return;

        // Puxa todos os lotes atualizados para realizar a varredura PEPS limpa
        const resEntradas = await fetch('/api/entradas');
        let todosLotes = await resEntradas.json();

        let itensParaAtualizarNoBanco = [];
        let novasMovimentacoesSaida = [];

        // Varre ingrediente por ingrediente da receita calculando o rombo proporcional
        for (let ingrediente of cardapioSelecionado.itens_composicao) {
            let volumeTotalNecessario = ingrediente.quantidade_por_aluno * totalAlunos;

            // Filtra e ordena os lotes ativos daquele produto específico por data de vencimento (PEPS)
            let lotesDoItem = todosLotes.filter(l => l.produto_id === ingrediente.produto_id && l.quantidade_atual > 0);
            lotesDoItem.sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));

            let saldoTotalDisponivel = lotesDoItem.reduce((acc, l) => acc + l.quantidade_atual, 0);

            // Trava de segurança preventiva
            if (saldoTotalDisponivel < volumeTotalNecessario) {
                alert(`Erro Crítico! Estoque insuficiente para processar o cardápio inteiro. O item [${ingrediente.nome_produto}] precisa de ${volumeTotalNecessario} unidades, mas o almoxarifado possui apenas ${saldoTotalDisponivel}.`);
                return;
            }

            // Executa o abatimento em cascata nos lotes ordenados
            let deficitParaAbater = volumeTotalNecessario;
            for (let lote of lotesDoItem) {
                if (deficitParaAbater <= 0) break;

                let quantidadeAbatidaNoLote = 0;
                if (lote.quantidade_atual >= deficitParaAbater) {
                    quantidadeAbatidaNoLote = deficitParaAbater;
                    lote.quantidade_atual -= deficitParaAbater;
                    deficitParaAbater = 0;
                } else {
                    quantidadeAbatidaNoLote = lote.quantidade_atual;
                    deficitParaAbater -= lote.quantidade_atual;
                    lote.quantidade_atual = 0; // Zera o lote mais antigo e pula pro próximo
                }

                itensParaAtualizarNoBanco.push(lote);
                novasMovimentacoesSaida.push({
                    entrada_lote_id: lote._id,
                    nome_produto: lote.nome_produto_snapshot,
                    quantidade_retirada: quantidadeAbatidaNoLote,
                    tipo_saida: "RECEITA",
                    nome_cardapio: cardapioSelecionado.nome_cardapio,
                    local_envio_destino: destino,
                    numero_lote_origem: lote.numero_lote,
                    usuario_responsavel: sessao.nome
                });
            }
        }

        // Se toda a cadeia de ingredientes passou no teste de saldo, grava tudo em massa na nuvem
        for (let loteAtualizado of itensParaAtualizarNoBanco) {
            await fetch('/api/salvar/entradas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loteAtualizado)
            });
        }

        for (let novaSaida of novasMovimentacoesSaida) {
            await fetch('/api/salvar/saidas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novaSaida)
            });
        }

        alert(`Sucesso! O cardápio [${cardapioSelecionado.nome_cardapio}] foi processado. Foram abatidos os insumos para as ${totalAlunos} crianças.`);
        document.getElementById("form-saida-cardapio").reset();
        inicializarTelaSaidas();

    } catch (e) {
        console.error("Erro no algoritmo de baixa por cardápio:", e);
    }
}

/**
 * Renderiza o histórico geral das baixas na tabela do rodapé
 */
async function carregarHistoricoSaidas() {
    const tbody = document.getElementById("corpo-tabela-saidas");
    if (!tbody) return;

    try {
        const res = await fetch('/api/saidas');
        const baixas = await res.json();

        tbody.innerHTML = "";

        if (baixas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhuma baixa registrada nas últimas 24h.</td></tr>`;
            return;
        }

        baixas.forEach(mov => {
            const dataHora = new Date(mov.createdAt).toLocaleString('pt-BR');
            const identificadorBaixa = mov.tipo_saida === "RECEITA" 
                ? `<span class="badge-mac badge-verde">🍱 CARDÁPIO</span><br><small style="color:var(--cinza-texto-secundario)">${mov.nome_cardapio}</small>`
                : `<span class="badge-mac badge-laranja">📦 AVULSA</span>`;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><small>${dataHora}</small></td>
                <td>${identificadorBaixa}</td>
                <td><strong>${mov.nome_produto}</strong></td>
                <td><code>${mov.numero_lote_origem}</code></td>
                <td><strong style="color:var(--vermelho-apple)">-${mov.quantidade_retirada}</strong></td>
                <td>🏙️ ${mov.local_envio_destino}</td>
                <td><small style="color:var(--cinza-texto-secundario)">${mov.usuario_responsavel}</small></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Erro ao carregar histórico de saídas:", e);
    }
}
