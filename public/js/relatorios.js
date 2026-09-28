/* ==========================================================================
   SCRIPT DE INTELIGÊNCIA CONTÁBIL - PRESTAÇÃO DE CONTAS & EXCEL
   Filtros Dinâmicos Cruzados e Exportador Nativa de Relatórios Municipais
   ========================================================================== */

let relatorioAtivo = 'entradas'; // Controle de contexto: entradas, saidas, quebras
let dadosPurosNuvem = [];

document.addEventListener("DOMContentLoaded", () => {
    carregarDadosDoRelatorioContextual();
});

/**
 * Altera o escopo do relatório e redesenha a tabela com dados limpos da nuvem
 */
async function alternarTipoRelatorio(tipo, botao) {
    relatorioAtivo = tipo;
    document.querySelectorAll(".aba-item").forEach(btn => btn.classList.remove("ativa"));
    botao.classList.add("ativa");

    const titulo = document.getElementById("titulo-tabela-relatorio");
    if (tipo === 'entradas') titulo.innerText = "📋 Dados de Entradas e Notas Auditadas";
    if (tipo === 'saidas') titulo.innerText = "📋 Histórico de Saídas e Consumo Escolar";
    if (tipo === 'quebras') titulo.innerText = "📋 Relatório de Perdas e Avarias Homologadas";

    // Limpa os campos de filtragem para não travar a visualização da nova aba
    document.getElementById("filtro-busca").value = "";
    document.getElementById("filtro-data-inicio").value = "";
    document.getElementById("filtro-data-fim").value = "";

    await carregarDadosDoRelatorioContextual();
}

/**
 * Puxa a tabela correspondente direto da API do MongoDB Atlas
 */
async function carregarDadosDoRelatorioContextual() {
    try {
        const res = await fetch(`/api/${relatorioAtivo}`);
        dadosPurosNuvem = await res.json();
        executarFiltroCruzadoNaTela();
    } catch (e) {
        console.error("Erro técnico ao carregar registros fiscais:", e);
    }
}

/**
 * Algoritmo de filtragem por texto (Produto/NF) e períodos cronológicos
 */
function verificarPassagemNosFiltros(item, buscaTexto, dataInicio, dataFim) {
    // 1. Filtro de Texto Dinâmico
    let textoAlvo = "";
    if (relatorioAtivo === 'entradas') textoAlvo = (item.nome_produto_snapshot + " " + item.numero_documento).toLowerCase();
    if (relatorioAtivo === 'saidas') textoAlvo = (item.nome_produto + " " + (item.nome_cardapio || "") + " " + item.local_envio_destino).toLowerCase();
    if (relatorioAtivo === 'quebras') textoAlvo = (item.nome_produto + " " + item.motivo_justificado).toLowerCase();

    if (buscaTexto && !textoAlvo.includes(buscaTexto)) return false;

    // 2. Filtro de Intervalo de Datas
    const dataItem = new Date(item.createdAt);
    if (dataInicio) {
        const dIni = new Date(dataInicio + "T00:00:00");
        if (dataItem < dIni) return false;
    }
    if (dataFim) {
        const dFim = new Date(dataFim + "T23:59:59");
        if (dataItem > dFim) return false;
    }

    return true;
}
/**
 * Executa a filtragem em tempo real e desenha as linhas na tabela
 */
function ejecutarFiltroCruzadoNaTela() {
    const cabecalho = document.getElementById("cabecalho-tabela-relatorio");
    const corpo = document.getElementById("corpo-tabela-relatorio");
    if (!cabecalho || !corpo) return;

    const buscaTexto = document.getElementById("filtro-busca").value.toLowerCase().trim();
    const dataInicio = document.getElementById("filtro-data-inicio").value;
    const dataFim = document.getElementById("filtro-data-fim").value;

    corpo.innerHTML = "";

    // 1. Configura as colunas baseadas na aba operacional ativa
    if (relatorioAtivo === 'entradas') {
        cabecalho.innerHTML = `<tr><th>Data Lançamento</th><th>Documento / Tipo</th><th>Produto</th><th>Lote</th><th>Qtd Inicial</th><th>Saldo Atual</th><th>Vencimento</th></tr>`;
    } else if (relatorioAtivo === 'saidas') {
        cabecalho.innerHTML = `<tr><th>Data / Hora</th><th>Tipo Saída</th><th>Produto</th><th>Lote Origem</th><th>Qtd Retirada</th><th>Escola / Destino</th></tr>`;
    } else if (relatorioAtivo === 'quebras') {
        cabecalho.innerHTML = `<tr><th>Data / Hora</th><th>Item Afetado</th><th>Lote</th><th>Qtd Perdida</th><th>Justificativa / Motivo</th></tr>`;
    }

    // 2. Filtra e renderiza as linhas correspondentes
    const dadosFiltrados = dadosPurosNuvem.filter(item => verificarPassagemNosFiltros(item, buscaTexto, dataInicio, dataFim));

    if (dadosFiltrados.length === 0) {
        corpo.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--cinza-texto-secundario)">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
        return;
    }

    dadosFiltrados.forEach(item => {
        const tr = document.createElement("tr");
        const dataReg = new Date(item.createdAt).toLocaleString('pt-BR');

        if (relatorioAtivo === 'entradas') {
            const dataVenc = new Date(item.data_validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            tr.innerHTML = `<td>${dataReg}</td><td><span class="badge-mac badge-azul">${item.tipo_documento}</span><br><small>${item.numero_documento}</small></td><td><strong>${item.nome_produto_snapshot}</strong></td><td><code>${item.numero_lote}</code></td><td>${item.quantidade_inicial}</td><td>${item.quantidade_atual}</td><td>${dataVenc}</td>`;
        } else if (relatorioAtivo === 'saidas') {
            tr.innerHTML = `<td>${dataReg}</td><td><span class="badge-mac ${item.tipo_saida === 'RECEITA' ? 'badge-verde' : 'badge-laranja'}">${item.tipo_saida}</span></td><td><strong>${item.nome_produto}</strong></td><td><code>${item.numero_lote_origem}</code></td><td>-${item.quantidade_retirada}</td><td>🏙️ ${item.local_envio_destino}</td>`;
        } else if (relatorioAtivo === 'quebras') {
            tr.innerHTML = `<td>${dataReg}</td><td><strong>${item.nome_produto}</strong></td><td><code>${item.numero_lote}</code></td><td style="color:var(--vermelho-apple)">${item.quantidade_danificada}</td><td><span class="badge-mac badge-laranja">${item.motivo_justificado}</span></td>`;
        }
        corpo.appendChild(tr);
    });
}

/**
 * EXPORTADOR PREMIUM EXCEL NATIVO (Steve Jobs Engineering)
 * Converte a tabela exibida em tela em uma planilha legível para o Microsoft Excel
 */
function exportarRelatorioAtualParaExcel() {
    const tabela = document.getElementById("tabela-relatorio-fiscal");
    if (!tabela) return;

    // Cabeçalho básico XML estruturado para forçar o Excel a renderizar acentuações em UTF-8
    const templateExcel = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://w3.org">
        <head>
            <meta charset="UTF-8">
            <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
            <x:Name>Relatorio_Fiscal</x:Name>
            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        </head>
        <body>
            <table border="1">
                ${tabela.innerHTML}
            </table>
        </body>
        </html>
    `;

    // Converte o código HTML montado em um arquivo binário simulado (Blob)
    const blobExcel = new Blob([templateExcel], { type: "application/vnd.ms-excel;charset=utf-8" });
    const urlDowload = URL.createObjectURL(blobExcel);

    // Cria um link temporário invisível em tela e força o download da planilha automaticamente
    const linkGatilho = document.createElement("a");
    linkGatilho.href = urlDowload;
    
    const dataIdentificadora = new Date().toISOString().split('T')[0];
    linkGatilho.download = `PRESTACAO_CONTAS_COZINHA_${relatorioAtivo.toUpperCase()}_${dataIdentificadora}.xls`;
    
    document.body.appendChild(linkGatilho);
    linkGatilho.click();
    document.body.removeChild(linkGatilho);
}
