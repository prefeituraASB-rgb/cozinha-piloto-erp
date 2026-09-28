/* ==========================================================================
   SCRIPT DE LOGÍSTICA - GESTÃO DE SAÍDAS COM DESTINOS DINÂMICOS
   Integração de Tabelas Cruzadas e Algoritmo PEPS no MongoDB Atlas
   ========================================================================== */

let cacheLotesDisponiveis = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarTelaSaidas();
});

/**
 * Carrega todas as dependências dinâmicas da nuvem assim que a tela abre
 */
async function inicializarTelaSaidas() {
    await carregarLotesNoSeletor();
    await carregarDestinosMunicipaisNosSeletores();
    await carregarSelectCardapios();
    await carregarHistoricoSaidas();
}

/**
 * Controla a transição visual das abas operacionais estilo macOS
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
 * Puxa os destinos dinâmicos cadastrados na nuvem e alimenta os seletores das duas abas
 */
async function carregarDestinosMunicipaisNosSeletores() {
    const selectItem = document.getElementById("sai-destino");          // Seletor da aba Item a Item
    const selectCardapio = document.getElementById("sai-cardapio-destino"); // Seletor da aba de Receitas
    
    if (!selectItem || !selectCardapio) return;

    try {
        const res = await fetch('/api/destinos');
        const destinos = await res.json();

        const opcaoInicial = '<option value="">Selecione o Destino Oficial...</option>';
        selectItem.innerHTML = opcaoInicial;
        selectCardapio.innerHTML = opcaoInicial;

        // Alimenta as duas guias com os locais salvos no MongoDB
        destinos.forEach(d => {
            const linhaOpcao = `<option value="${d.nome_local}">${d.nome_local}</option>`;
            selectItem.innerHTML += linhaOpcao;
            selectCardapio.innerHTML += linhaOpcao;
        });
    } catch (e) {
        console.error("Erro ao carregar destinos dinâmicos na tela de saídas:", e);
    }
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
    
    const lote = cacheLotesDisponiveis.find(l => l._id === select.value);
    txt.innerText = lote ? `(Saldo Real em Estoque)` : "";
}

/**
 * MODALIDADE A: Processa a baixa isolada Item a Item para os destinos dinâmicos
 */
async function processarSaidaItemAItem(event) {
    event.preventDefault();

    const loteId = document.getElementById("sai-lote-id").value;
    const qtdRetirar = Number(document.getElementById("sai-quantidade").value);
    const destino = document.getElementById("sai-destino").value;
    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Sistema" };

    if (!loteId || !destino) {
        alert("Selecione o lote e o destino municipal para homologar a saída.");
        return;
    }

    const loteSelecionado = cacheLotesDisponiveis.find(l => l._id === loteId);
    if (qtdRetirar > loteSelecionado.quantidade_atual) {
        alert(`Saldo Insuficiente! O lote possui apenas ${loteSelecionado.quantidade_atual} unidades.`);
        return;
    }

    try {
        loteSelecionado.quantidade_atual = Number((loteSelecionado.quantidade_atual - qtdRetirar).toFixed(4));
        await fetch(`/api/salvar/entradas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loteSelecionado)
        });

        const payloadSaida = {
            entrada_lote_id: loteId,
            nome_produto: loteSelecionado.nome_produto_snapshot,
            quantidade_retirada: qtdRetirar,
            type_saida: "ITEM A ITEM",
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

        alert(`Baixa de ${qtdRetirar} unidades enviada para [${destino}] homologada com sucesso!`);
        document.getElementById("form-saida-item").reset();
        inicializarTelaSaidas();

    } catch (e) {
        console.error("Erro no fluxo de saída item a item:", e);
    }
}
/**
 * Alimenta o seletor de receitas homologadas pela Nutricionista
 */
async function carregarSelectCardapios() {
    const select = document.getElementById("sai-cardapio-id");
    if (!select) return;

    try {
        const res = await fetch('/api/cardapios');
        const cardapios = await res.json();

        select.innerHTML = '<option value="">Selecione o Cardápio Homologado...</option>';
        cardapios.forEach(c => {
            select.innerHTML += `<option value="${c._id}">${c.nome_cardapio}</option>`;
        });
    } catch (e) {
        console.error("Erro ao buscar fichas de cardápios:", e);
    }
}

/**
 * MODALIDADE B: Abatimento em Massa via Cardápio Escolar (Algoritmo PEPS Avançado)
 */
async function processarSaidaPorCardapio(event) {
    event.preventDefault();

    const cardapioId = document.getElementById("sai-cardapio-id").value;
    const totalAlunos = Number(document.getElementById("sai-cardapio-alunos").value);
    const destino = document.getElementById("sai-cardapio-destino").value;
    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Sistema" };

    if (!cardapioId || !destino) {
        alert("Selecione o cardápio e a unidade escolar de destino.");
        return;
    }

    try {
        const resCard = await fetch('/api/cardapios');
        const cardapios = await resCard.json();
        const cardapioSelecionado = cardapios.find(c => c._id === cardapioId);

        const resEntradas = await fetch('/api/entradas');
        let todosLotes = await resEntradas.json();

        let itensParaAtualizarNoBanco = [];
        let novasMovimentacoesSaida = [];

        // Varre ingrediente por ingrediente calculando a gramatura decimal da receita
        for (let ingrediente of cardapioSelecionado.itens_composicao) {
            let volumeTotalNecessario = Number((ingrediente.quantidade_por_aluno * totalAlunos).toFixed(4));

            let lotesDoItem = todosLotes.filter(l => l.produto_id === ingrediente.produto_id && l.quantidade_atual > 0);
            lotesDoItem.sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade)); // Ordenação PEPS Real

            let saldoTotalDisponivel = lotesDoItem.reduce((acc, l) => acc + l.quantidade_atual, 0);

            if (saldoTotalDisponivel < volumeTotalNecessario) {
                alert(`Falta de Estoque! O cardápio exige ${volumeTotalNecessario} de [${ingrediente.nome_produto}], mas o saldo total em lotes é de apenas ${saldoTotalDisponivel}.`);
                return;
            }

            let deficitParaAbater = volumeTotalNecessario;
            for (let lote of lotesDoItem) {
                if (deficitParaAbater <= 0) break;

                let quantidadeAbatidaNoLote = 0;
                if (lote.quantidade_atual >= deficitParaAbater) {
                    quantidadeAbatidaNoLote = deficitParaAbater;
                    lote.quantidade_atual = Number((lote.quantidade_atual - deficitParaAbater).toFixed(4));
                    deficitParaAbater = 0;
                } else {
                    quantidadeAbatidaNoLote = lote.quantidade_atual;
                    deficitParaAbater = Number((deficitParaAbater - lote.quantidade_atual).toFixed(4));
                    lote.quantidade_atual = 0;
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

        // Commita as alterações em massa no MongoDB se o estoque inteiro passou na validação
        for (let loteUpd of itensParaAtualizarNoBanco) {
            await fetch('/api/salvar/entradas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loteUpd)
            });
        }

        for (let novaSaida of novasMovimentacoesSaida) {
            await fetch('/api/salvar/saidas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novaSaida)
            });
        }

        alert(`Sucesso Contábil! Cardápio [${cardapioSelecionado.nome_cardapio}] abatido para os destinos dinâmicos.`);
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
                ? `<span class="badge-mac badge-verde">🍱 CARDÁPIO</span><br><small style="color:var(--cinza-texto-secundario)">${mov.nome_cardapio || 'Receita'}</small>`
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
