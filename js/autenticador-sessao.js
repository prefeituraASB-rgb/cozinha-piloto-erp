/* ==========================================================================
   BARREIRA DE SEGURANÇA GLOBAL DE NAVEGAÇÃO
   Compliance Público contra Acessos Não Autorizados nas Telas do ERP
   ========================================================================== */

// Função autoexecutável (roda no milissegundo em que a página é chamada)
(function bloquearAcessoSemLogin() {
    // 1. Captura o nome da página atual que o navegador está tentando abrir
    const caminhoCompleto = window.location.pathname;
    const paginaAtual = caminhoCompleto.split("/").pop() || "dashboard.html";

    // 2. Verifica se existe um token de sessão ativo gravado no navegador
    const sessaoAtiva = localStorage.getItem("usuarioLogado");

    // 3. Aplica a Regra de Bloqueio se o usuário estiver deslogado e tentar burlar o endereço
    if (!sessaoAtiva && paginaAtual !== "index.html" && paginaAtual !== "") {
        // Alerta o usuário sobre a violação de segurança do portal público
        alert("Acesso Negado! Esta área é restrita a servidores autorizados da Cozinha Piloto. Por favor, efetue o login.");
        
        // Redireciona imediatamente para a tela de login real
        window.location.href = "index.html";
    }
})();
