/* ==========================================================================
   SCRIPT ADMINISTRATIVO - GESTÃO DE OPERADORES & DESTINOS MUNICIPAIS
   Máscara Simplificada Direta e Motores de Edição (PUT/DELETE)
   ========================================================================== */

let cacheUsuariosLocal = [];
let cacheDestinosLocal = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarTelaAdministrativa();
});

async function inicializarTelaAdministrativa() {
    await carregarUsuariosCadastrados();
    await carregarDestinosCadastrados();
}

/**
 * MÁSCARA BLINDADA: Reconstrói a string do CPF caractere por caractere para evitar conflitos de RegEx
 */
function aplicarMascaraCpfUsuario(campo) {
    // Remove qualquer caractere que não seja número
    let v = campo.value.replace(/\D/g, ""); 
    
    // Corta a string para garantir que não passe de 11 dígitos numéricos
    if (v.length > 11) v = v.substring(0, 11);

    // Remonta a string injetando a pontuação com base no comprimento atual
    if (v.length > 9) {
        campo.value = v.substring(0, 3) + "." + v.substring(3, 6) + "." + v.substring(6, 9) + "-" + v.substring(9);
    } else if (v.length > 6) {
        campo.value = v.substring(0, 3) + "." + v.substring(3, 6) + "." + v.substring(6);
    } else if (v.length > 3) {
        campo.value = v.substring(0, 3) + "." + v.substring(3);
    } else {
        campo.value = v;
    }
}

/**
 * Processa a Inserção (POST) ou a Atualização (PUT) do colaborador municipal
 */
async function processarCadastroDeUsuario(event) {
    event.preventDefault();

    const idUsuario = document.getElementById("usr-id").value;
    const cpfFormatado = document.getElementById("usr-cpf").value.trim();
    const cpfLimpo = cpfFormatado.replace(/\D/g, ""); 

    // Bloqueia o envio se o usuário digitou menos que os 11 dígitos obrigatórios do CPF
    if (cpfLimpo.length !== 11) {
        alert("Erro! O CPF digitado está incompleto. Verifique os números.");
        return;
    }

    const payloadUsuario = {
        nome: document.getElementById("usr-nome").value.trim(),
        cpf: cpfFormatado,
        perfil: document.getElementById("usr-perfil").value,
        senha: document.getElementById("usr-senha").value,
        ativo: true
    };

    try {
        if (!idUsuario) {
            const cpfExiste = cacheUsuariosLocal.some(u => u.cpf.replace(/\D/g, "") === cpfLimpo);
            if (cpfExiste) {
                alert("Erro! Este CPF já se encontra credenciado no ERP da Cozinha Piloto.");
                return;
            }
        }

        let url = '/api/salvar/usuarios';
        let metodo = 'POST';

        if (idUsuario) {
            url = `/api/editar/usuarios/${idUsuario}`;
            metodo = 'PUT';
        }

        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadUsuario)
        });

        if (res.ok) {
            alert(idUsuario ? "Cadastro do colaborador atualizado com sucesso!" : "Novo colaborador credenciado com sucesso!");
            cancelarEdicaoUsuario();
            await carregarUsuariosCadastrados();
        } else {
            alert("Erro operacional ao tentar processar requisição no servidor.");
        }
    } catch (e) {
        console.error(e);
        alert("Falha de rede ao conectar com o banco de dados.");
    }
}

async function carregarUsuariosCadastrados() {
    const tbody = document.getElementById("corpo-tabela-usuarios");
    if (!tbody) return;

    try {
        const res = await fetch('/api/usuarios');
        cacheUsuariosLocal = await res.json();
        tbody.innerHTML = "";

        if (cacheUsuariosLocal.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhum colaborador cadastrado.</td></tr>`;
            return;
        }

        cacheUsuariosLocal.forEach(usr => {
            let corBadge = usr.perfil === 'ADMINISTRADOR' ? 'badge-azul' : (usr.perfil === 'ADMINISTRATIVO' ? 'badge-verde' : 'badge-cinza');
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${usr.nome}</strong></td>
                <td><code>${usr.cpf}</code></td>
                <td><span class="badge-mac ${corBadge}">${usr.perfil}</span></td>
                <td style="text-align: center;">
                    <button class="btn-apple" style="padding: 4px 10px; font-size: 0.75rem; background: var(--amarelo-apple);" onclick="prepararEdicaoUsuario('${usr._id}')">Editar</button>
                    <button class="btn-apple" style="padding: 4px 10px; font-size: 0.75rem; background: var(--vermelho-apple); margin-left: 4px;" onclick="excluirRegistroGeral('usuarios', '${usr._id}', '${usr.nome}')">Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

function prepararEdicaoUsuario(id) {
    const usr = cacheUsuariosLocal.find(u => u._id === id);
    if (!usr) return;

    document.getElementById("usr-id").value = usr._id;
    document.getElementById("usr-nome").value = usr.nome;
    document.getElementById("usr-cpf").value = usr.cpf;
    document.getElementById("usr-perfil").value = usr.perfil;
    document.getElementById("usr-senha").value = usr.senha;

    document.getElementById("titulo-form-usuario").innerText = `✏️ Editando Credenciais: ${usr.nome}`;
    document.getElementById("container-botoes-usuario").innerHTML = `
        <button type="submit" class="btn-apple" style="height: 38px; background-color: var(--azul-apple);">Salvar Alterações</button>
        <button type="button" class="btn-apple" style="height: 38px; background-color: var(--cinza-texto-secundario); margin-left: 5px;" onclick="cancelarEdicaoUsuario()">Cancelar</button>
    `;
}

function cancelarEdicaoUsuario() {
    document.getElementById("form-cadastro-usuario").reset();
    document.getElementById("usr-id").value = "";
    document.getElementById("titulo-form-usuario").innerText = "👤 Credenciamento de Colaborador Municipal";
    document.getElementById("container-botoes-usuario").innerHTML = `<button type="submit" class="btn-apple" style="height: 38px; background-color: var(--azul-apple);">Homologar Operador</button>`;
}
/**
 * Processa a Inserção (POST) ou a Atualização (PUT) do local de utilização dos itens
 */
async function processarCadastroDeDestino(event) {
    event.preventDefault();

    const idDestino = document.getElementById("des-id").value;
    const nomeLocal = document.getElementById("des-nome").value.trim();

    const payloadDestino = { nome_local: nomeLocal };

    try {
        let url = '/api/salvar/destinos';
        let metodo = 'POST';

        if (idDestino) {
            url = `/api/editar/destinos/${idDestino}`;
            metodo = 'PUT';
        }

        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadDestino)
        });

        if (res.ok) {
            alert(idDestino ? "Unidade de destino updated com sucesso!" : "Novo destino homologado com sucesso!");
            cancelarEdicaoDestino();
            await carregarDestinosCadastrados();
        } else {
            alert("Erro do servidor ao tentar processar o destino.");
        }
    } catch (e) {
        console.error(e);
        alert("Falha de comunicação na rede.");
    }
}

async function carregarDestinosCadastrados() {
    const tbody = document.getElementById("corpo-tabela-destinos");
    if (!tbody) return;

    try {
        const res = await fetch('/api/destinos');
        cacheDestinosLocal = await res.json();
        tbody.innerHTML = "";

        if (cacheDestinosLocal.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--cinza-texto-secundario);">Nenhum destino oficial de mercadoria registrado.</td></tr>`;
            return;
        }

        cacheDestinosLocal.forEach(dest => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${dest.nome_local}</strong></td>
                <td><small style="color:var(--cinza-texto-secundario)">${dest._id}</small></td>
                <td style="text-align: center;">
                    <button class="btn-apple" style="padding: 4px 10px; font-size: 0.75rem; background: var(--amarelo-apple);" onclick="prepararEdicaoDestino('${dest._id}')">Editar</button>
                    <button class="btn-apple" style="padding: 4px 10px; font-size: 0.75rem; background: var(--vermelho-apple); margin-left: 4px;" onclick="excluirRegistroGeral('destinos', '${dest._id}', '${dest.nome_local}')">Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

function prepararEdicaoDestino(id) {
    const dest = cacheDestinosLocal.find(d => d._id === id);
    if (!dest) return;

    document.getElementById("des-id").value = dest._id;
    document.getElementById("des-nome").value = dest.nome_local;

    document.getElementById("titulo-form-destino").innerText = `✏️ Editando Destino: ${dest.nome_local}`;
    document.getElementById("container-botoes-destino").innerHTML = `
        <button type="submit" class="btn-apple" style="height: 38px; background-color: var(--verde-apple);">Salvar Alterações</button>
        <button type="button" class="btn-apple" style="height: 38px; background-color: var(--cinza-texto-secundario); margin-left: 5px;" onclick="cancelarEdicaoDestino()">Cancelar</button>
    `;
}

function cancelarEdicaoDestino() {
    document.getElementById("form-cadastro-destino").reset();
    document.getElementById("des-id").value = "";
    document.getElementById("titulo-form-destino").innerText = "🏢 Cadastrar Nova Escola, Unidade ou Destino Consumo";
    document.getElementById("container-botoes-destino").innerHTML = `<button type="submit" class="btn-apple" style="height: 38px; background-color: var(--verde-apple);">Homologar Local</button>`;
}

async function excluirRegistroGeral(tabela, id, nomeInformativo) {
    if (!confirm(`🚨 ATENÇÃO CONTÁBIL!\n\nDeseja realmente excluir permanentemente o registro [${nomeInformativo}] da tabela de ${tabela.toUpperCase()}?\nEsta ação não poderá ser desfeita no MongoDB Atlas.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/deletar/${tabela}/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            alert("Registro removido com sucesso da infraestrutura em nuvem!");
            if (tabela === 'usuarios') await carregarUsuariosCadastrados();
            if (tabela === 'destinos') await carregarDestinosCadastrados();
        } else {
            alert("Erro! O servidor recusou o comando de exclusão.");
        }
    } catch (e) {
        console.error(e);
        alert("Erro na rede ao tentar processar a exclusão.");
    }
}
