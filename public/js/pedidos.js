/* ==========================================================================
   SCRIPT DE LOGÍSTICA - REQUISIÇÕES & BALANÇA LADO A LADO COM MOTOR DE RECUSA
   Controle Comparativo e Entrada Automatizada de Estoque no Mongo Atlas
   ========================================================================== */

let cacheAdministradoresLocal = [];
let cachePedidosLocal = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarModuloPedidos();
});

async function inicializarModuloPedidos() {
    await carregarAdministradoresNoSeletor();
    adicionarLinhaDeItemAoPedido(); // Abre uma linha limpa no Grid por padrão
    await carregarHistoricoPedidos();
}

/**
 * Alimenta o seletor com as Nutricionistas (Administradoras) ativas no banco
 */
async function carregarAdministradoresNoSeletor() {
    const select = document.getElementById("ped-admin-alvo");
    if (!select) return;

    try {
        const res = await fetch('/api/usuarios');
        const usuarios = await res.json();
        
        cacheAdministradoresLocal = usuarios.filter(u => u.perfil === 'ADMINISTRADOR');

        select.innerHTML = '<option value="">Selecione a Nutricionista Destinatária...</option>';
        cacheAdministradoresLocal.forEach(admin => {
            select.innerHTML += `<option value="${admin.nome}">${admin.nome} (${admin.perfil})</option>`;
        });
    } catch (e) {
        console.error("Erro ao carregar administradores para o pedido:", e);
    }
}

/**
 * Cria uma nova linha no Grid de compras com as métricas industriais standard
 */
function adicionarLinhaDeItemAoPedido() {
    const container = document.getElementById("container-grid-itens-pedido");
    if (!container) return;

    const idLinha = "linha_ped_" + Date.now() + Math.floor(Math.random() * 100);

    const div = document.createElement("div");
    div.id = idLinha;
    div.className = "grid-linha-pedido";
    div.innerHTML = `
        <input type="text" placeholder="Nome do Item a ser comprado (Ex: Arroz Tipo 1, Gás P45)" class="ped-item-nome" required>
        <input type="number" placeholder="Qtd" min="0.01" step="0.01" class="ped-item-qtd" required>
        <select class="ped-item-medida" required>
            <option value="KG">Quilo (KG)</option>
            <option value="UNIDADE">Unidade (UN)</option>
            <option value="LITROS">Litros (L)</option>
            <option value="LATAS">Latas (LT)</option>
            <option value="GALÕES">Galões (GL)</option>
            <option value="FARDO">Fardo (FD)</option>
            <option value="CAIXA">Caixa (CX)</option>
            <option value="PACOTE">Pacote (PCT)</option>
        </select>
        <button type="button" class="btn-apple" style="background-color: var(--vermelho-apple); height: 38px; padding: 0 12px;" onclick="removerLinhaDoGridPedido('${idLinha}')">✕</button>
    `;

    container.appendChild(div);
}

function removerLinhaDoGridPedido(idLinha) {
    const container = document.getElementById("container-grid-itens-pedido");
    if (container.children.length <= 1) {
        alert("O pedido precisa conter no mínimo 1 item ativo no Grid.");
        return;
    }
    document.getElementById(idLinha).remove();
}
/**
 * Salva a requisição estruturada na nuvem
 */
async function salvarPedidoDeCompraNaNuvem(event) {
    event.preventDefault();

    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Operador M" };
    const adminDestino = document.getElementById("ped-admin-alvo").value;
    const linhasDoGrid = document.querySelectorAll(".grid-linha-pedido");

    const itensPedido = [];
    linhasDoGrid.forEach(linha => {
        itensPedido.push({
            nome: inline.querySelector(".ped-item-nome").value.trim(),
            nome: linha.querySelector(".ped-item-nome").value.trim(),
            quantidade: Number(linha.querySelector(".ped-item-qtd").value),
            unidade: linha.querySelector(".ped-item-medida").value
        });
    });

    const payloadPedido = {
        codigo_pedido: "REQ-" + Math.floor(1000 + Math.random() * 9000),
        solicitante: sessao.nome,
        destinatario: adminDestino,
        itens: itensPedido,
        status: "PENDENTE",
        justificativa_recusa: "", // Nasce limpo esperando auditoria
        createdAt: new Date().toISOString()
    };

    try {
        const res = await fetch('/api/salvar/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadPedido)
        });

        if (res.ok) {
            alert(`Pedido de Compra [${payloadPedido.codigo_pedido}] enviado com sucesso!`);
            document.getElementById("form-pedido-compra").reset();
            document.getElementById("container-grid-itens-pedido").innerHTML = "";
            await inicializarModuloPedidos();
        } else {
            alert("Erro na nuvem ao registrar requisição.");
        }
    } catch (e) { console.error(e); }
}

async function carregarHistoricoPedidos() {
    const tbody = document.getElementById("corpo-tabela-pedidos");
    if (!tbody) return;

    try {
        const res = await fetch('/api/pedidos');
        cachePedidosLocal = await res.json();
        tbody.innerHTML = "";

        if (cachePedidosLocal.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhum pedido registrado.</td></tr>`;
            return;
        }

        cachePedidosLocal.forEach(ped => {
            const dataHora = new Date(ped.createdAt).toLocaleString('pt-BR');
            const resumoItensHtml = ped.itens.map(i => `<span class="badge-mac badge-cinza" style="margin-right:4px; margin-bottom:4px; display:inline-flex;">${i.nome}: <strong>${i.quantidade} ${i.unidade}</strong></span>`).join('');
            
            let classeStatus = 'badge-laranja';
            let detalheRecusaHtml = "";
            let acaoBotaoHtml = `<span style="color:var(--verde-apple); font-weight:600;">Homologado ✅</span>`;
            
            if (ped.status === 'RECEBIDO') {
                classeStatus = 'badge-verde';
            } else if (ped.status === 'RECUSADO') {
                classeStatus = 'badge-vermelho';
                acaoBotaoHtml = `<span style="color:var(--vermelho-apple); font-weight:600;">Negado ❌</span>`;
                detalheRecusaHtml = `<br><small style="color:var(--vermelho-apple); font-weight:500;">💬 Motivo: ${ped.justificativa_recusa || 'Não informada'}</small>`;
            } else if (ped.status === 'PENDENTE') {
                acaoBotaoHtml = `<button class="btn-apple" style="padding: 5px 12px; font-size: 0.8rem; background-color: var(--azul-apple);" onclick="abrirJanelaConferenciaLadoALado('${ped._id}')">Conferir & Receber</button>`;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${ped.codigo_pedido}</strong><br><small>${dataHora}</small></td>
                <td><small>Por:</small> <strong>${ped.solicitante}</strong><br><small>Para: ${ped.destinatario}</small></td>
                <td>${resumoItensHtml}${detalheRecusaHtml}</td>
                <td><span class="badge-mac ${classeStatus}">${ped.status}</span></td>
                <td style="text-align: center;">${acaoBotaoHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}
function abrirJanelaConferenciaLadoALado(idPedido) {
    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { perfil: "OPERADOR" };

    if (sessao.perfil !== 'ADMINISTRADOR') {
        alert(`🚨 ACESSO BLOQUEADO!\n\nA conferência e o recebimento de pedidos de compra são de competência exclusiva de usuários ADMINISTRADORES.`);
        return;
    }

    const ped = cachePedidosLocal.find(p => p._id === idPedido);
    if (!ped) return;

    document.getElementById("conf-pedido-id-oculto").value = ped._id;
    document.getElementById("conf-codigo-titulo").innerText = ped.codigo_pedido;

    const colSolicitado = document.getElementById("coluna-itens-solicitados");
    const colAtendido = document.getElementById("coluna-itens-atendidos");
    
    colSolicitado.innerHTML = "";
    colAtendido.innerHTML = "";

    ped.itens.forEach((item) => {
        colSolicitado.innerHTML += `
            <div style="height: 38px; display:flex; align-items:center; font-size:0.9rem;">
                📌 <strong>${item.nome}</strong>: &nbsp;<span style="color:var(--azul-apple); font-weight:700;">${item.quantidade} ${item.unidade}</span>
            </div>
        `;

        colAtendido.innerHTML += `
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; align-items: center;" class="linha-atendimento-controle">
                <input type="text" class="conf-item-nome-f" value="${item.nome}" readonly style="background: rgba(0,0,0,0.02); height: 38px;">
                <input type="number" step="0.01" min="0" class="conf-item-qtd-f" value="${item.quantidade}" data-medida="${item.unidade}" style="border-color: var(--verde-apple); height: 38px;">
            </div>
        `;
    });

    document.getElementById("conf-validade-data").value = new Date().toISOString().split('T')[0];
    document.getElementById("painel-conferencia-pedido").style.display = "block";
    document.getElementById("painel-conferencia-pedido").scrollIntoView({ behavior: 'smooth' });
}

function fecharJanelaConferenciaLadoAlado() {
    document.getElementById("painel-conferencia-pedido").style.display = "none";
}

async function negarPedidoDeCompraComJustificativa() {
    const idPedido = document.getElementById("conf-pedido-id-oculto").value;
    const pedidoReal = cachePedidosLocal.find(p => p._id === idPedido);

    if (!pedidoReal) return;

    const motivo = prompt(`🛑 RECUSA DO PEDIDO ${pedidoReal.codigo_pedido}\n\nPor favor, digite uma justificativa clara sobre o motivo da recusa para o solicitante:`);

    if (motivo === null) return; 
    if (motivo.trim() === "") {
        alert("Erro! É obrigatório informar uma justificativa legal para negar o pedido de compras.");
        return;
    }

    try {
        pedidoReal.status = "RECUSADO";
        pedidoReal.justificativa_recusa = motivo.trim();

        const res = await fetch('/api/salvar/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedidoReal)
        });

        if (res.ok) {
            alert(`Sucesso! O Pedido ${pedidoReal.codigo_pedido} foi rejeitado e a justificativa foi fixada no relatório.`);
            fecharJanelaConferenciaLadoAlado();
            await inicializarModuloPedidos();
        } else {
            alert("Erro ao salvar atualização de recusa na nuvem.");
        }
    } catch (e) { console.error(e); }
}

async function salvarHomologacaoLadoALadoNaNuvem() {
    const idPedido = document.getElementById("conf-pedido-id-oculto").value;
    const nfNumero = document.getElementById("conf-nf-numero").value.trim();
    const loteNumero = document.getElementById("conf-lote-numero").value.trim();
    const dataValid = document.getElementById("conf-validade-data").value;
    const estoqueMin = Number(document.getElementById("conf-minimo-qtd").value);

    if (!nfNumero || !loteNumero || !dataValid || !estoqueMin) {
        alert("Preencha todos os metadados fiscais da carga (Nota, Lote, Validade e Estoque Mínimo).");
        return;
    }

    const pedidoReal = cachePedidosLocal.find(p => p._id === idPedido);
    const linhasAtendidas = document.querySelectorAll(".linha-atendimento-controle");
    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Nutricionista" };

    if (!confirm("Confirmar a homologação contábil? Todos os itens listados serão injetados como lotes operacionais no estoque.")) {
        return;
    }

    try {
        for (let linha of linhasAtendidas) {
            const nomeInsumo = linha.querySelector(".conf-item-nome-f").value;
            const qtdEntregue = Number(linha.querySelector(".conf-item-qtd-f").value);
            const metricaInsumo = linha.querySelector(".conf-item-qtd-f").getAttribute("data-medida");

            if (qtdEntregue <= 0) continue;

            const resProd = await fetch('/api/produtos');
            const produtos = await resProd.json();
            
            let prodExistente = produtos.find(p => p.nome_produto.toLowerCase() === nomeInsumo.toLowerCase());
            let produtoId = prodExistente ? prodExistente._id : null;

            if (!prodExistente) {
                const novoProdRes = await fetch('/api/salvar/produtos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome_produto: nomeInsumo,
                        categoria_item: "Insumo Alimentar",
                        metrica_base: metricaInsumo === "LATAS" || metricaInsumo === "GALÕES" || metricaInsumo === "FARDO" || metricaInsumo === "CAIXA" || metricaInsumo === "PACOTE" ? "OUTRAS" : metricaInsumo
                    })
                });
                const resultadoNovoProd = await novoProdRes.json();
                produtoId = resultadoNovoProd.id;
            }

            const payloadLoteAutomático = {
                produto_id: produtoId,
                nome_produto_snapshot: nomeInsumo,
                quantidade_inicial: qtdEntregue,
                quantidade_atual: qtdEntregue, 
                tipo_documento: "NOTA FISCAL",
                numero_documento: nfNumero,
                estoque_minimo: estoqueMin,
                data_validade: new Date(dataValid).toISOString(),
                numero_lote: loteNumero,
                usuario_responsavel: sessao.nome
            };

            await fetch('/api/salvar/entradas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadLoteAutomático)
            });
        }

        pedidoReal.status = "RECEBIDO";
        await fetch('/api/salvar/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedidoReal)
        });

        alert("Homologação concluída com sucesso! Os lotes de mercadoria já estão ativos nas prateleiras.");
        fecharJanelaConferenciaLadoAlado();
        await inicializarModuloPedidos();

    } catch (e) {
        console.error(e);
        alert("Falha de rede ao tentar injetar a carga no estoque.");
    }
}
