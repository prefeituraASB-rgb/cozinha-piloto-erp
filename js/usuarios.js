/* ==========================================================================
   SCRIPT DE LOGÍSTICA - GESTÃO DE OPERADORES & ACESSOS
   Controle de Credenciais com Persistência no MongoDB Atlas
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    carregarUsuariosCadastrados();
});

/**
 * Formata visualmente o CPF (000.000.000-00) em tempo real no cadastro
 */
function aplicarMascaraCpfUsuario(campo) {
    let valor = campo.value.replace(/\D/g, "");
    if (valor.length <= 11) {
        valor = valor.replace(/(\d{3})(\d)/, "\$1.\$2");
        valor = valor.replace(/(\d{3})(\d)/, "\$1.\$2");
        valor = valor.replace(/(\d{3})(\d{1,2})\$/, "\$1-\$2");
    }
    campo.value = valor;
}

/**
 * Processa a validação e envia o novo operador para o banco na nuvem
 */
async function processarCadastroDeUsuario(event) {
    event.preventDefault();

    const payloadUsuario = {
        nome: document.getElementById("usr-nome").value.trim(),
        cpf: document.getElementById("usr-cpf").value.trim(),
        perfil: document.getElementById("usr-perfil").value,
        senha: document.getElementById("usr-senha").value,
        ativo: true
    };

    try {
        // Verifica duplicidade local prévia antes de enviar
        const resCheck = await fetch('/api/usuarios');
        const usuariosExistentes = await resCheck.json();
        
        const cpfDuplicado = usuariosExistentes.some(u => u.cpf === payloadUsuario.cpf);
        if (cpfDuplicado) {
            alert("Erro de Cadastro! Este CPF já se encontra credenciado no sistema da Cozinha Piloto.");
            return;
        }

        const res = await fetch('/api/salvar/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadUsuario)
        });

        if (res.ok) {
            alert(`Operador [${payloadUsuario.nome}] credenciado com sucesso no banco de dados!`);
            document.getElementById("form-cadastro-usuario").reset();
            carregarUsuariosCadastrados();
        } else {
            alert("Falha operacional ao tentar salvar o usuário no servidor.");
        }

    } catch (e) {
        console.error("Erro técnico no cadastro de operador:", e);
        alert("Erro de comunicação com a API na nuvem.");
    }
}
/**
 * Busca todos os operadores na nuvem e monta a tabela de auditoria
 */
async function carregarUsuariosCadastrados() {
    const tbody = document.getElementById("corpo-tabela-usuarios");
    if (!tbody) return;

    try {
        const res = await fetch('/api/usuarios');
        const usuarios = await res.json();

        tbody.innerHTML = "";

        if (usuarios.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhum colaborador cadastrado até o momento.</td></tr>`;
            return;
        }

        usuarios.forEach(usr => {
            let corBadgePerfil = "badge-cinza";
            if (usr.perfil === 'ADMINISTRADOR') corBadgePerfil = "badge-azul";
            if (usr.perfil === 'ADMINISTRATIVO') corBadgePerfil = "badge-verde";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${usr.nome}</strong></td>
                <td><code>${usr.cpf}</code></td>
                <td><span class="badge-mac ${corBadgePerfil}">${usr.perfil}</span></td>
                <td>
                    <span class="badge-mac" style="background: rgba(52, 199, 89, 0.1); color: var(--verde-apple); font-weight:700;">
                        ATIVO ✅
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Erro ao renderizar listagem de operadores:", e);
    }
}
