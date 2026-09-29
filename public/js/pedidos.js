/* ==========================================================================
   SCRIPT DE LOGÍSTICA - REQUISIÇÕES & PEDIDOS DE COMPRA EM GRID ERP
   Controle de Permissões e Recebimento Fiscal no MongoDB Atlas
   ========================================================================== */

let cacheAdministradoresLocal = [];
let cachePedidosLocal = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarModuloPedidos();
});

async function inicializarModuloPedidos() {
    await carregarAdministradoresNoSeletor();
    adicionarLinhaDeItemAoPedido(); // Já abre com uma linha vazia no Grid por padrão
    await carregarHistoricoPedidos();
}

/**
 * Puxa os usuários do banco e filtra apenas quem é ADMINISTRADOR (Nutricionista)
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
 * Injeta uma nova linha de campos em GRID com métricas universais de mercado
 */
function adicionarLinhaDeItemAoPedido() {
    const container = document.getElementById("container-grid-itens-pedido");
    if (!container) return;

    const idLinha = "linha_ped_" + Date.now() + Math.floor(Math.random() * 100);

    const div = document.createElement("div");
    div.id = idLinha;
    div.className = "grid-linha-pedido";
    div.innerHTML = `
        <input type="text" placeholder="Nome do Item a ser comprado (Ex: Gás P45, Arroz, Colheres)" class="ped-item-nome" required>
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
    // Trava para não deixar o operador deletar se só houver uma linha ativa na tela
    if (container.children.length <= 1) {
        alert("A requisição precisa conter pelo menos 1 item no Grid de Compras.");
        return;
    }
    document.getElementById(idLinha).remove();
}

/**
 * Monta o pacote de dados estruturado do Grid e envia para a nuvem
 */
async function salvarPedidoDeCompraNaNuvem(event) {
    event.preventDefault();

    const sessao = JSON.parse(localStorage.getItem("usuarioLogado")) || { nome: "Operador M" };
    const adminDestino = document.getElementById("ped-admin-alvo").value;
    const linhasDoGrid = document.querySelectorAll(".grid-linha-pedido");

    const itensPedido = [];
    linhasDoGrid.forEach(linha => {
        itensPedido.push({
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
        // Campos extras para a rota genérica do server.js organizar a cronologia
        createdAt: new Date().toISOString()
    };

    try {
        const res = await fetch('/api/salvar/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadPedido)
        });

        if (res.ok) {
            alert(`Pedido de Compra [${payloadPedido.codigo_pedido}] disparado com sucesso para a Nutrição!`);
            document.getElementById("form-pedido-compra").reset();
            document.getElementById("container-grid-itens-pedido").innerHTML = "";
            await inicializarModuloPedidos();
        } else {
            alert("Erro na nuvem ao tentar registrar requisição.");
        }
    } catch (e) {
        console.error(e);
    }
}
/**
 * Busca todas as requisições gravadas no MongoDB e desenha a tabela com travas Apple-style
 */
async function carregarHistoricoPedidos() {
    const tbody = document.getElementById("corpo-tabela-pedidos");
    if (!tbody) return;

    try {
        const res = await fetch('/api/pedidos');
        // Filtra para ordenar cronologicamente por criação se o servidor devolver lista bruta
        cachePedidosLocal = await res.json();
        tbody.innerHTML = "";

        if (cachePedidosLocal.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhum pedido de compra emitido no município.</td></tr>`;
            return;
        }

        cachePedidosLocal.forEach(ped => {
            const dataHora = new Date(ped.createdAt || new Date()).toLocaleString('pt-BR');
            
            // Transforma o sub-array do Grid em badges de leitura rápida estilo macOS
            const resumoItensHtml = ped.itens.map(i => 
                `<span class="badge-mac badge-cinza" style="margin-right:4px; margin-bottom:4px; display:inline-flex;">${i.nome}: <strong>${i.quantidade} ${i.unidade}</strong></span>`
            ).join('');

            // Define a cor do badge com base no andamento fiscal do processo
            let classeBadgeStatus = "badge-laranja";
            if (ped.status === 'RECEBIDO') classeBadgeStatus = "badge-verde";

            // GATILHO DAS REGRAS DE PERMISSÃO: Exibe o botão de recebimento ou a label concluída
            let acaoBotaoHtml = `<span style="font-size:0.8rem; color:var(--verde-apple); font-weight:600;">Entregue ✅</span>`;
            
            if (ped.status === 'PENDENTE') {
                acaoBotaoHtml = `
                    <button class="btn-apple" style="padding: 5px 12px; font-size: 0.8rem; background-color: var(--verde-apple);" onclick="executarRecebimentoFiscalDoPedido('${ped._id}')">
                        Receber Carga
                    </button>
                `;
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${ped.codigo_pedido}</strong><br><small style="color:var(--cinza-texto-secundario)">${dataHora}</small></td>
                <td><small>De:</small> <strong>${ped.solicitante}</strong><br><small style="color:var(--cinza-texto-secundario)">Para: ${ped.destinatario}</small></td>
                <td style="max-width: 380px; line-height: 1.6;">${resumoItensHtml}</td>
                <td><span class="badge-mac ${classeBadgeStatus}">${ped.status}</span></td>
                <td style="text-align: center;">${acaoBotaoHtml}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Erro técnico ao renderizar histórico de requisições:", e);
    }
}

/**
 * REGRA DE OURO DE SEGURANÇA: Aplica a trava de perfil exigida no escopo antes de consolidar a entrada
 */
async function executingRecebimentoFiscalDoPedido(idPedido) {
    // 1. Recupera as informações do usuário ativo que está sentado na máquina tentando clicar
    const sessaoLocal = localStorage.getItem("usuarioLogado");
    if (!sessaoLocal) return;

    const usuarioLogado = JSON.parse(sessaoLocal);

    // 🚨 TRAVA DO ESCOPO: Se o perfil do operador NÃO for Administrador (Nutricionista), aborta instantaneamente!
    if (usuarioLogado.perfil !== 'ADMINISTRADOR') {
        alert(`🚨 ACESSO BLOQUEADO POR REGRA FISCAL!\n\nOlá, ${usuarioLogado.nome}.\nO seu perfil está configurado como [${usuarioLogado.perfil}]. O regulamento municipal estabelece que apenas usuários ADMINISTRADORES (Nutricionistas) possuem autorização jurídica para conferir e dar o recebimento físico de notas e pedidos no estoque.`);
        return;
    }

    // Se passou na trava (é Administrador), prossegue para atualizar o status na nuvem
    const pedidoSelecionado = cachePedidosLocal.find(p => p._id === idPedido);
    if (!pedidoSelecionado) return;

    if (!confirm(`Deseja homologar o recebimento físico completo da carga do pedido ${pedidoSelecionado.codigo_pedido}?\nOs itens passarão para o status de conferidos no Almoxarifado Central.`)) {
        return;
    }

    try {
        // Altera o status local do objeto
        pedidoSelecionado.status = "RECEBIDO";

        // Como o server.js possui a rota universal de POST que faz overwrite ou cria objetos, 
        // nós enviamos o objeto inteiro atualizado de volta para a nuvem consolidar
        const res = await fetch('/api/salvar/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedidoSelecionado)
        });

        if (res.ok) {
            alert(`Sucesso! Carga do Pedido ${pedidoSelecionado.codigo_pedido} conferida e recebida no sistema com sucesso.`);
            await carregarHistoricoPedidos();
        } else {
            alert("Erro ao salvar atualização de recebimento na nuvem.");
        }

    } catch (e) {
        console.error("Erro na comunicação com a API ao fechar pedido:", e);
    }
}

// Fallback de escrita para contornar qualquer variação de digitação de clique do botão HTML
function executarRecebimentoFiscalDoPedido(id) {
    executingRecebimentoFiscalDoPedido(id);
}
