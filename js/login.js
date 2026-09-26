/* ==========================================================================
   SCRIPT DE AUTENTICAÇÃO E MÁSCARAS - LOGÍSTICA ERP
   Validação de Credenciais Real contra o Banco de Dados MongoDB Atlas
   ========================================================================== */

/**
 * Aplica a formatação visual de CPF (000.000.000-00) em tempo real enquanto digita
 */
function aplicarMascaraDeCPF(campo) {
    let valor = campo.value;
    
    // Remove qualquer caractere que não seja número
    valor = valor.replace(/\D/g, "");
    
    // Captura os blocos numéricos aplicando os pontos e o traço
    if (valor.length <= 11) {
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
        valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    
    campo.value = valor;
}

/**
 * Intercepta o formulário, faz a requisição na nuvem e valida o acesso ao ERP
 */
async function solicitarAcessoAoERP(event) {
    event.preventDefault(); // Impede a página de recarregar

    const cpfDigitado = document.getElementById("login-cpf").value.trim();
    const senhaDigitada = document.getElementById("login-senha").value;

    try {
        // 🌐 Consulta o endpoint unificado do nosso server.js hospedado no Render
        const resposta = await fetch('/api/usuarios');
        
        if (!resposta.ok) {
            throw new Error("Falha na comunicação com o servidor de banco de dados.");
        }

        const listaUsuarios = await resposta.json();

        // Faz o cruzamento de credenciais na coleção trazida da nuvem
        const usuarioValido = listaUsuarios.find(u => u.cpf === cpfDigitado && u.senha === senhaDigitada);

        if (usuarioValido) {
            if (!usuarioValido.ativo) {
                alert("Acesso Bloqueado! Este operador foi desativado pela Nutricionista Gestora.");
                return;
            }

            // Clona o objeto do usuário e remove a senha antes de guardar no navegador por segurança
            const sessaoSegura = { ...usuarioValido };
            delete sessaoSegura.senha;

            // Grava o token de sessão local no navegador do operador
            localStorage.setItem("usuarioLogado", JSON.stringify(sessaoSegura));

            // Sucesso! Redireciona o usuário para a tela central do ERP
            window.location.href = "dashboard.html";
        } else {
            // Emite o pop-up clássico avisando o erro de digitação
            alert("Erro de Autenticação! O CPF informado ou a senha de acesso estão incorretos para a Cozinha Piloto.");
        }

    } catch (error) {
        console.error("Erro técnico no fluxo de login:", error);
        alert("Falha de Rede! Não foi possível alcançar o servidor do ERP. Verifique sua conexão com a internet.");
    }
}
