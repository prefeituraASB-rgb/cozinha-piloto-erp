/* ==========================================================================
   SCRIPT DE LOGÍSTICA - MÓDULO DE PERDAS & AVARIAS
   Abatimento Físico e Registro de Ocorrências no MongoDB Atlas
   ========================================================================== */

let cacheLotesQuebras = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarTelaQuebras();
});

async function inicializarTelaQuebras() {
    await carregarLotesNoSeletorQuebras();
    await carregarHistoricoQuebras();
}

/**
 * Alimenta o select com os lotes ativos que possuem saldo maior que zero
 */
async function carregarLotesNoSeletorQuebras() {
    const select = document.getElementById("que-lote-id");
    if (!select) return;

    try {
        const res = await fetch('/api/entradas');
        const lotes = await res.json();
        
        // Mantém apenas os lotes com estoque físico real
        cacheLotesQuebras = lotes.filter(l => l.quantidade_atual > 0);

        select.innerHTML = '<option value="">Selecione o Lote Afetado...</option>';
        cacheLotesQuebras.forEach(lote => {
            const validade = new Date(lote.data_validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            select.innerHTML += `
                <option value="${lote._id}">
                    ${lote.nome_produto_snapshot} [Lote: ${lote.numero_lote}] - Saldo: ${lote.quantidade_atual} (Venc: ${validade})
                </option>
            `;
        });
    } catch (e) {
        console.error("Erro ao carregar lotes para o painel de quebras:", e);
    }
}
/**
 * Executa a baixa física por avaria no lote e salva o relatório na nuvem
 */
async function processarRegistroDeQuebra(event) {
    event.preventDefault();

    const loteId = document.getElementById("que-lote-id").value;
    const qtdPerdida = Number(document.getElementById("que-quantidade").value);
    const motivo = document.getElementById("que-motivo").value;
    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Sistema" };

    if (!loteId) {
        alert("Selecione um lote válido para declarar a perda.");
        return;
    }

    const loteAfetado = cacheLotesQuebras.find(l => l._id === loteId);
    
    // Bloqueia se o operador tentar descartar mais mercadoria do que existe na prateleira
    if (qtdPerdida > loteAfetado.quantidade_atual) {
        alert(`Operação cancelada! O lote selecionado possui apenas ${loteAfetado.quantidade_atual} unidades em saldo.`);
        return;
    }

    if (!confirm(`Deseja homologar a perda de ${qtdPerdida} unidades de [${loteAfetado.nome_produto_snapshot}] por motivo de: ${motivo}?`)) {
        return;
    }

    try {
        // 1. Abate o saldo físico daquele lote específico na nuvem
        loteAfetado.quantidade_atual = Number((loteAfetado.quantidade_atual - qtdPerdida).toFixed(4));
        await fetch('/api/salvar/entradas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loteAfetado)
        });

        // 2. Registra o log justificado de avaria para fins de auditoria pública
        const payloadQuebra = {
            nome_produto: loteAfetado.nome_produto_snapshot,
            numero_lote: loteAfetado.numero_lote,
            quantidade_danificada: qtdPerdida,
            motivo_justificado: motivo,
            usuario_responsavel: sessao.nome
        };

        await fetch('/api/salvar/quebras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadQuebra)
        });

        alert("Declaração de avaria registrada e integrada ao estoque fiscal!");
        document.getElementById("form-registro-quebra").reset();
        inicializarTelaQuebras();

    } catch (e) {
        console.error("Erro fatal ao processar descarte de item:", e);
        alert("Falha de comunicação com a nuvem ao salvar avaria.");
    }
}

/**
 * Puxa a coleção histórica de perdas da nuvem e renderiza no rodapé
 */
async function carregarHistoricoQuebras() {
    const tbody = document.getElementById("corpo-tabela-quebras");
    if (!tbody) return;

    try {
        const res = await fetch('/api/quebras');
        const perdas = await res.json();

        tbody.innerHTML = "";

        if (perdas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhuma quebra ou avaria registrada no sistema municipal.</td></tr>`;
            return;
        }

        perdas.forEach(p => {
            const dataHora = new Date(p.createdAt).toLocaleString('pt-BR');
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><small>${dataHora}</small></td>
                <td><strong>${p.nome_produto}</strong></td>
                <td><code>${p.numero_lote}</code></td>
                <td><strong style="color:var(--vermelho-apple)">${p.quantidade_danificada}</strong></td>
                <td><span class="badge-mac badge-laranja" style="font-size:0.75rem">${p.motivo_justificado}</span></td>
                <td><small style="color:var(--cinza-texto-secundario)">${p.usuario_responsavel}</small></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Erro técnico ao renderizar lista de avarias:", e);
    }
}
