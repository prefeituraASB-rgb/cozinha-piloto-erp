/* ==========================================================================
   SCRIPT DE LOGÍSTICA - GESTÃO DE OPERADORES & DESTINOS MUNICIPAIS
   Controle de Credenciais e Locais de Envio no MongoDB Atlas
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    inicializarTelaAdministrativa();
});

/**
 * Orquestra a carga inicial de dados assim que a tela abre
 */
async function inicializarTelaAdministrativa() {
    await carregarUsuariosCadastrados();
    await carregarDestinosCadastrados();
}

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
            await carregarUsuariosCadastrados();
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
                <td><span class="badge-mac" style="background: rgba(52, 199, 89, 0.1); color: var(--verde-apple); font-weight:700;">ATIVO ✅</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Erro ao renderizar listagem de operadores:", e);
    }
}
/**
 * Processa a gravação de uma nova Escola, Unidade ou Setor de consumo na nuvem
 */
async function processarCadastroDeDestino(event) {
    event.preventDefault();

    const campoNome = document.getElementById("des-nome");
    const nomeLocal = campoNome.value.trim();

    if (!nomeLocal) return;

    const payloadDestino = {
        nome_local: nomeLocal
    };

    try {
        // Envia os dados para a tabela 'destinos' usando a rota universal segura do server.js
        const res = await fetch('/api/salvar/destinos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadDestino)
        });

        if (res.ok) {
            alert(`Destino [${nomeLocal}] homologado com sucesso no ecossistema ERP!`);
            campoNome.value = ""; // Limpa apenas o campo de texto
            await carregarDestinosCadastrados();
        } else {
            alert("Erro do servidor ao tentar homologar o local de destino.");
        }

    } catch (e) {
        console.error("Erro técnico no fluxo de salvamento de destino:", e);
        alert("Falha na rede! Não foi possível salvar o destino na nuvem.");
    }
}

/**
 * Puxa a tabela 'destinos' do MongoDB Atlas e renderiza na interface de auditoria
 */
async function carregarDestinosCadastrados() {
    const tbody = document.getElementById("corpo-tabela-destinos");
    if (!tbody) return;

    tbody.innerHTML = "";

    try {
        const res = await fetch('/api/destinos');
        const destinos = await res.json();

        if (destinos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhum destino de mercadoria cadastrado. Use o formulário acima.</td></tr>`;
            return;
        }

        destinos.forEach(dest => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${dest.nome_local}</strong></td>
                <td><small style="color:var(--cinza-texto-secundario)">${dest._id}</small></td>
                <td style="text-align: center;"><span class="badge-mac badge-azul" style="font-size:0.75rem;">Homologado 🏙️</span></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Erro técnico ao carregar lista de destinos contábeis:", e);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--vermelho-apple)">Erro de conexão ao carregar locais.</td></tr>`;
    }
}
