/* ==========================================================================
   SCRIPT GLOBAL - CONTROLE DO MENU LATERAL DINÂMICO
   Garante a consistência visual estilo macOS em todas as telas
   ========================================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return; // Se a página não tiver a tag <aside id="sidebar">, interrompe

    // 1. Detecta o nome do arquivo HTML atual para aplicar a classe .active no link correto
    const caminhoCompleto = window.location.pathname;
    const paginaAtual = caminhoCompleto.split("/").pop() || "dashboard.html";

    // 2. Recupera com segurança as informações do operador logado na sessão do navegador
    const sessaoUsuario = localStorage.getItem("usuarioLogado");
    
    // Se por acaso não houver sessão (prevenção secundária), define um perfil visitante provisório
    const usuarioLogado = sessaoUsuario ? JSON.parse(sessaoUsuario) : { nome: "Operador", perfil: "VISITANTE" };

    // 3. Monta e injeta a estrutura de navegação com os links oficiais do ecossistema do estoque
    sidebar.innerHTML = `
        <div class="sidebar-topo">
            <h2>Cozinha Piloto</h2>
            <p>Águas de Santa Bárbara</p>
        </div>
        
        <ul class="sidebar-menu">
            <li>
                <a href="dashboard.html" class="${paginaAtual === 'dashboard.html' ? 'active' : ''}">📊 Painel Geral</a>
            </li>
            <li>
                <a href="entradas.html" class="${paginaAtual === 'entradas.html' ? 'active' : ''}">🍎 Cadastrar Itens / NF</a>
            </li>
            <li>
                <a href="saidas.html" class="${paginaAtual === 'saidas.html' ? 'active' : ''}">📤 Saídas / Destinos</a>
            </li>
            <li>
                <a href="quebras.html" class="${paginaAtual === 'quebras.html' ? 'active' : ''}">⚠️ Perdas / Quebras</a>
            </li>
            <li>
                <a href="cardapios.html" class="${paginaAtual === 'cardapios.html' ? 'active' : ''}">📋 Gestão Cardápios</a>
            </li>
            <li>
                <a href="relatorios.html" class="${paginaAtual === 'relatorios.html' ? 'active' : ''}">🗒️ Relatórios Fiscais</a>
            </li>
            <li>
                <a href="usuarios.html" class="${paginaAtual === 'usuarios.html' ? 'active' : ''}">👤 Usuários</a>
            </li>
        </ul>
        
        <div class="sidebar-usuario">
            <div class="usuario-info">
                <p id="nome-usuario-menu">${usuarioLogado.nome}</p>
                <span>${usuarioLogado.perfil}</span>
            </div>
            <a href="#" onclick="encerrarSessaoGlobal(event)" style="color: var(--vermelho-apple); font-size: 0.8rem; text-decoration: none; font-weight: 600;">Sair</a>
        </div>
    `;
});

/**
 * Encerra a sessão de trabalho e limpa as credenciais locais de forma segura
 */
function encerrarSessaoGlobal(event) {
    event.preventDefault();
    
    if (confirm("Deseja encerrar o seu expediente e sair do sistema com segurança?")) {
        localStorage.removeItem("usuarioLogado"); // Limpa o token de sessão do front-end
        window.location.href = "index.html";       // Redireciona imediatamente para o login real
    }
}
