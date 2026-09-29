/* ==========================================================================
   SCRIPT DE INTELIGÊNCIA - DASHBOARD PREDITIVO AVANÇADO (ALERTA COMPRAS DUPLO)
   Varredura e Algoritmos de Validade (90 Dias) e Estoque Crítico
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    configurarBoasVindasUsuario();
    carregarMetricasEDadosPreditivos();
    verificarPedidosPendentesParaAdmin(); // 🛒 Alerta duplo instalado
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
        titulo.innerText = `Painel Geral — Bem-vindo, ${usuario.nome}!`;
    }
}

/**
 * DETALHE COMPLETO: Varre a nuvem e emite aviso de pendência ou sucesso de compras para o Administrador
 */
async function verificarPedidosPendentesParaAdmin() {
    const sessaoLocal = localStorage.getItem("usuarioLogado");
    if (!sessaoLocal) return;

    const usuarioLogado = JSON.parse(sessaoLocal);

    // 🔒 TRAVA DE PERFIL: Se NÃO for administrador, ignora a função em background silenciosamente
    if (usuarioLogado.perfil !== 'ADMINISTRADOR') return;

    try {
        // Busca a coleção de pedidos ativa no MongoDB Atlas
        const res = await fetch('/api/pedidos');
        const pedidos = await res.json();

        // Filtra para contar quantas requisições ainda estão aguardando recebimento
        const pedidosPendentes = pedidos.filter(p => p.status === 'PENDENTE');

        // Dispara o pop-up contextual baseado no saldo real de requisições da prefeitura
        setTimeout(() => {
            if (pedidosPendentes.length > 0) {
                // Cenário A: Existem pendências de compras
                alert(`🛒 ATENÇÃO GESTÃO!\n\nIdentificamos que existem [ ${pedidosPendentes.length} ] Pedidos de Compra com status PENDENTE no sistema.\n\nPor favor, acesse o módulo "Pedidos de Compra" no menu lateral para auditar as requisições em lote e realizar a homologação da carga.`);
            } else {
                // Cenário B: Todos os pedidos estão auditados e fechados
                alert(`🛒 AUDITORIA DE COMPRAS DE SUPRIMENTOS\n\nOlá, ${usuarioLogado.nome}.\nO sistema realizou a varredura e confirmou: não há nenhum Pedido de Compra pendente de recebimento na Cozinha Piloto.\n\nO fluxo de requisições municipais encontra-se 100% atualizado! ✅`);
            }
        }, 800); // Aguarda menos de 1 segundo após o boot da tela para disparar o aviso limpo
    } catch (e) {
        console.error("Erro silencioso ao checar pendências de compras:", e);
    }
}

/**
 * Puxa as informações da nuvem e orquestra os cálculos matemáticos dos painéis
 */
async function carregarMetricasEDadosPreditivos() {
    try {
        const res = await fetch('/api/entradas');
        const lotes = await res.json();

        const lotesAtivos = lotes.filter(l => l.quantidade_atual > 0);

        document.getElementById("w-lotes-ativos").innerText = lotesAtivos.length;

        calcularWidgetEVersaoPreditivaVencimento(lotesAtivos);
        calcularWidgetERupturaEstoqueMínimo(lotesAtivos);

    } catch (e) {
        console.error("Erro técnico ao processar métricas do dashboard:", e);
    }
}
