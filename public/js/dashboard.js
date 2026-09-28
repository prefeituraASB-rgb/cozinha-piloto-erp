/* ==========================================================================
   SCRIPT DE INTELIGÊNCIA - DASHBOARD PREDITIVO AVANÇADO
   Varredura e Algoritmos de Validade (90 Dias) e Estoque Crítico
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    configurarBoasVindasUsuario();
    carregarMetricasEDadosPreditivos();
});

/**
 * Altera dinamicamente o título do cabeçalho com os dados do operador logado
 */
function configurarBoasVindasUsuario() {
    const titulo = document.getElementById("boas-vindas-titulo");
    if (!titulo) return;

    const sessao = localStorage.getItem("usuarioLogado");
    if (sessao) {
        const usuario = JSON.parse(sessao);
        // Exemplo: Painel de Controle - Bem-vindo, João Almoxarife!
        titulo.innerText = `Painel Geral — Bem-vindo, ${usuario.nome}!`;
    }
}

/**
 * Puxa as informações da nuvem e orquestra os cálculos matemáticos dos painéis
 */
async function carregarMetricasEDadosPreditivos() {
    try {
        const res = await fetch('/api/entradas');
        const lotes = await res.json();

        // Filtra para analisar apenas lotes que ainda possuem mercadoria física em estoque
        const lotesAtivos = lotes.filter(l => l.quantidade_atual > 0);

        // 1. Alimenta o widget de contagem de lotes sob custódia
        document.getElementById("w-lotes-ativos").innerText = lotesAtivos.length;

        // Executa os algoritmos específicos da Engenharia Nutricional / Logística
        calcularWidgetEVersaoPreditivaVencimento(lotesAtivos);
        calcularWidgetERupturaEstoqueMínimo(lotesAtivos);

    } catch (e) {
        console.error("Erro técnico ao processar métricas do dashboard:", e);
    }
}
/**
 * Executa a Regra de Ouro dos 90 Dias (Antecipação Nutricional)
 */
function calcularWidgetEVersaoPreditivaVencimento(lotes) {
    const tbody = document.getElementById("lista-preditiva-vencimento");
    if (!tbody) return;

    tbody.innerHTML = "";
    let contadorProximosVencimento = 0;
    
    // Captura o milissegundo da data atual real do sistema
    const dataAtual = new Date();

    lotes.forEach(lote => {
        const dataValidadeLote = new Date(lote.data_validade);
        
        // Calcula a diferença matemática absoluta em dias entre as duas datas
        const diferencaMilissegundos = dataValidadeLote - dataAtual;
        const diferencaDias = Math.ceil(diferencaMilissegundos / (1000 * 60 * 60 * 24));

        // REGRA DO ESCOPO: Alerta se faltarem 90 dias ou menos para o item vencer
        if (diferencaDias <= 90) {
            contadorProximosVencimento++;

            const dataFormatada = dataValidadeLote.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            let corDestaqueDias = "var(--amarelo-apple)";
            
            // Se o item já estiver vencido ou vencendo na semana, joga para vermelho crítico
            if (diferencaDias <= 7) corDestaqueDias = "var(--vermelho-apple)";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${lote.nome_produto_snapshot}</strong></td>
                <td><code>${lote.numero_lote}</code></td>
                <td>${lote.quantidade_atual}</td>
                <td><strong style="color: ${corDestaqueDias}">${diferencaDias <= 0 ? 'VENCIDO 🚨' : diferencaDias + ' dias (' + dataFormatada + ')'}</strong></td>
            `;
            tbody.appendChild(tr);
        }
    });

    // Atualiza o indicador numérico do cartão central de Alerta
    document.getElementById("w-vencimento-90").innerText = contadorProximosVencimento;

    if (contadorProximosVencimento === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--verde-apple); font-weight:600; padding: 20px 0;">✅ Nenhum lote em risco de vencimento para os próximos 3 meses!</td></tr>`;
    }
}

/**
 * Analisa e bloqueia o risco de desabastecimento confrontando com o Estoque Mínimo
 */
function calcularWidgetERupturaEstoqueMínimo(lotes) {
    const tbody = document.getElementById("lista-preditiva-falta");
    if (!tbody) return;

    tbody.innerHTML = "";
    let contadorEstoqueCritico = 0;

    // Agrupa os saldos dos lotes pelo nome do produto para ter a visão unificada do estoque real
    let consolidadoPorProduto = {};
    lotes.forEach(lote => {
        const nome = lote.nome_produto_snapshot;
        if (!consolidadoPorProduto[nome]) {
            consolidadoPorProduto[nome] = {
                saldo_total: 0,
                estoque_minimo: lote.estoque_minimo // Referencial de trava
            };
        }
        consolidadoPorProduto[nome].saldo_total += lote.quantidade_atual;
    });

    // Varre os itens consolidados confrontando as regras de ruptura fiscal
    for (let produtoNome in consolidadoPorProduto) {
        const item = consolidadoPorProduto[produtoNome];

        if (item.saldo_total <= item.estoque_minimo) {
            contadorEstoqueCritico++;

            let labelStatus = "ESTOQUE BAIXO";
            let classeBadge = "badge-laranja";

            if (item.saldo_total === 0) {
                labelStatus = "ZERADO CRÍTICO";
                classeBadge = "badge-mac"; // Estilo borda forte ou padrão
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${produtoNome}</strong></td>
                <td><span style="color:var(--vermelho-apple); font-weight:700;">${item.saldo_total}</span></td>
                <td>${item.estoque_minimo}</td>
                <td><span class="badge-mac ${classeBadge}" style="${item.saldo_total === 0 ? 'background:var(--vermelho-apple); color:white;' : ''}">${labelStatus}</span></td>
            `;
            tbody.appendChild(tr);
        }
    }

    // Atualiza o indicador do widget superior de Rupturas
    document.getElementById("w-estoque-critico").innerText = contadorEstoqueCritico;

    if (contadorEstoqueCritico === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--verde-apple); font-weight:600; padding: 20px 0;">✅ Todos os níveis de suprimentos operam acima da margem mínima.</td></tr>`;
    }
}
