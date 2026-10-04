// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================

const SUPABASE_URL = "https://pahwkqvuyuapyrnlfsau.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZUCZQSBa4Crkd-bclLyhaw_BMBcqRjT";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);



const abas = document.querySelectorAll(".aba");
const abaRecebimentos = document.getElementById("abaRecebimentos");
const abaPagar = document.getElementById("abaPagar");
const formRecebimento = document.getElementById("formRecebimento");
const formConta = document.getElementById("formConta");
const listaRecebimentos = document.getElementById("listaRecebimentos");
const listaContas = document.getElementById("listaContas");
const mesRecebimentos = document.getElementById("mesRecebimentos");
const mesPagar = document.getElementById("mesPagar");

function dataHoje() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function mesHoje() {
    return dataHoje().substring(0, 7);
}

document.getElementById("dataRecebimento").value = dataHoje();
document.getElementById("dataConta").value = dataHoje();
mesRecebimentos.value = mesHoje();
mesPagar.value = mesHoje();

function dinheiro(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function dataBR(data) {
    if (!data) return "-";
    const partes = data.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function mostrarNotificacao(mensagem) {
    const elemento = document.getElementById("notificacao");
    elemento.textContent = mensagem;
    elemento.classList.add("mostrar");
    setTimeout(() => elemento.classList.remove("mostrar"), 2500);
}

function exigirSupabase() {
    if (supabaseClient) return true;
    mostrarNotificacao("Configure a URL e a anon key do Supabase em script.js.");
    return false;
}

abas.forEach(aba => {
    aba.addEventListener("click", () => {
        abas.forEach(a => a.classList.remove("ativa"));
        aba.classList.add("ativa");

        if (aba.dataset.aba === "recebimentos") {
            abaRecebimentos.classList.add("ativa");
            abaPagar.classList.remove("ativa");
            carregarRecebimentos();
        } else {
            abaPagar.classList.add("ativa");
            abaRecebimentos.classList.remove("ativa");
            carregarContas();
        }
    });
});

formRecebimento.addEventListener("submit", async event => {
    event.preventDefault();
    if (!exigirSupabase()) return;

    const data = document.getElementById("dataRecebimento").value;
    const creditoDebito = Number(document.getElementById("creditoDebito").value) || 0;
    const dinheiroValor = Number(document.getElementById("dinheiro").value) || 0;
    const pix = Number(document.getElementById("pix").value) || 0;
    const alimentacao = Number(document.getElementById("alimentacao").value) || 0;

    const { error } = await supabaseClient.from("recebimentos").upsert({
        data,
        credito_debito: creditoDebito,
        dinheiro: dinheiroValor,
        pix,
        alimentacao
    }, { onConflict: "data" });

    if (error) {
        console.error(error);
        mostrarNotificacao("Erro ao salvar recebimento.");
        return;
    }

    mostrarNotificacao("Recebimento salvo!");
    formRecebimento.reset();
    document.getElementById("dataRecebimento").value = dataHoje();
    await carregarRecebimentos();
});

async function carregarRecebimentos() {
    const mes = mesRecebimentos.value;
    if (!mes) return;
    if (!supabaseClient) {
        listaRecebimentos.innerHTML = '<div style="padding:20px">Configure o Supabase em script.js para carregar os dados.</div>';
        return;
    }

    const primeiroDia = `${mes}-01`;
    const ultimoDia = new Date(Number(mes.substring(0, 4)), Number(mes.substring(5, 7)), 0);
    const ultimoDiaFormatado = `${mes}-${String(ultimoDia.getDate()).padStart(2, "0")}`;

    const { data, error } = await supabaseClient
        .from("recebimentos")
        .select("*")
        .gte("data", primeiroDia)
        .lte("data", ultimoDiaFormatado)
        .order("data", { ascending: true });

    if (error) {
        console.error(error);
        listaRecebimentos.innerHTML = "<p>Erro ao carregar dados.</p>";
        return;
    }

    let totalMes = 0;
    if (!data || data.length === 0) {
        listaRecebimentos.innerHTML = '<div style="padding:20px">Nenhum recebimento lançado neste mês.</div>';
        document.getElementById("totalRecebimentos").textContent = dinheiro(0);
        atualizarResumo();
        return;
    }

    let html = `
        <table class="tabela">
            <thead><tr>
                <th>Data</th><th>Crédito / Débito</th><th>Dinheiro</th><th>Pix</th><th>Alimentação</th><th>Total</th><th>Ação</th>
            </tr></thead>
            <tbody>`;

    data.forEach(item => {
        const total = Number(item.credito_debito || 0) + Number(item.dinheiro || 0) + Number(item.pix || 0) + Number(item.alimentacao || 0);
        totalMes += total;
        html += `
            <tr>
                <td>${dataBR(item.data)}</td>
                <td>${dinheiro(item.credito_debito)}</td>
                <td>${dinheiro(item.dinheiro)}</td>
                <td>${dinheiro(item.pix)}</td>
                <td>${dinheiro(item.alimentacao)}</td>
                <td class="valor total-dia">${dinheiro(total)}</td>
                <td><button class="btn-acao btn-excluir" onclick="excluirRecebimento(${item.id})">Excluir</button></td>
            </tr>`;
    });

    html += `
            </tbody>
            <tfoot><tr>
                <td colspan="5"><strong>Total do mês</strong></td>
                <td class="valor total-dia"><strong>${dinheiro(totalMes)}</strong></td>
                <td></td>
            </tr></tfoot>
        </table>`;

    listaRecebimentos.innerHTML = html;
    document.getElementById("totalRecebimentos").textContent = dinheiro(totalMes);
    atualizarResumo();
}

async function excluirRecebimento(id) {
    if (!exigirSupabase()) return;
    if (!confirm("Deseja excluir este recebimento?")) return;

    const { error } = await supabaseClient.from("recebimentos").delete().eq("id", id);
    if (error) {
        mostrarNotificacao("Erro ao excluir.");
        return;
    }
    mostrarNotificacao("Recebimento excluído.");
    carregarRecebimentos();
}

formConta.addEventListener("submit", async event => {
    event.preventDefault();
    if (!exigirSupabase()) return;

    const data = document.getElementById("dataConta").value;
    const descricao = document.getElementById("descricaoConta").value.trim();
    const tipo = document.getElementById("tipoConta").value;
    const categoria = document.getElementById("categoriaConta").value;
    const valor = Number(document.getElementById("valorConta").value) || 0;

    const { error } = await supabaseClient.from("contas_pagar").insert({
        data_vencimento: data,
        descricao,
        tipo,
        categoria,
        valor,
        status: "pendente"
    });

    if (error) {
        console.error(error);
        mostrarNotificacao("Erro ao adicionar conta.");
        return;
    }

    mostrarNotificacao("Conta adicionada!");
    formConta.reset();
    document.getElementById("dataConta").value = dataHoje();
    carregarContas();
});

async function carregarContas() {
    const mes = mesPagar.value;
    if (!mes) return;
    if (!supabaseClient) {
        listaContas.innerHTML = '<div style="padding:20px">Configure o Supabase em script.js para carregar os dados.</div>';
        return;
    }

    const primeiroDia = `${mes}-01`;
    const ultimoDia = new Date(Number(mes.substring(0, 4)), Number(mes.substring(5, 7)), 0);
    const ultimoDiaFormatado = `${mes}-${String(ultimoDia.getDate()).padStart(2, "0")}`;

    const { data, error } = await supabaseClient
        .from("contas_pagar")
        .select("*")
        .gte("data_vencimento", primeiroDia)
        .lte("data_vencimento", ultimoDiaFormatado)
        .order("data_vencimento", { ascending: true });

    if (error) {
        console.error(error);
        listaContas.innerHTML = "<p>Erro ao carregar contas.</p>";
        return;
    }

    let totalPendente = 0;
    let totalMes = 0;

    if (!data || data.length === 0) {
        listaContas.innerHTML = '<div style="padding:20px">Nenhuma conta cadastrada neste mês.</div>';
        document.getElementById("totalPagar").textContent = dinheiro(0);
        atualizarResumo();
        return;
    }

    let html = `
        <table class="tabela">
            <thead><tr>
                <th>Vencimento</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th>Status</th><th>Ações</th>
            </tr></thead>
            <tbody>`;

    data.forEach(conta => {
        const valor = Number(conta.valor || 0);
        totalMes += valor;
        if (conta.status === "pendente") totalPendente += valor;
        const categoria = conta.categoria || "-";
        const tipo = conta.tipo === "fixa" ? "Fixa" : "Variável";

        html += `
            <tr>
                <td>${dataBR(conta.data_vencimento)}</td>
                <td><strong>${escaparHTML(conta.descricao)}</strong></td>
                <td>${tipo}</td>
                <td>${categoria}</td>
                <td class="valor">${dinheiro(valor)}</td>
                <td><span class="status ${conta.status}">${conta.status === "pago" ? "Pago" : "Pendente"}</span></td>
                <td><div class="acoes">
                    ${conta.status === "pendente" ? `<button class="btn-acao btn-pagar" onclick="marcarComoPaga(${conta.id})">Pagar</button>` : ""}
                    <button class="btn-acao btn-excluir" onclick="excluirConta(${conta.id})">Excluir</button>
                </div></td>
            </tr>`;
    });

    html += `
            </tbody>
            <tfoot><tr>
                <td colspan="4"><strong>Total</strong></td>
                <td class="valor"><strong>${dinheiro(totalMes)}</strong></td>
                <td colspan="2">Pendente: <strong>${dinheiro(totalPendente)}</strong></td>
            </tr></tfoot>
        </table>`;

    listaContas.innerHTML = html;
    document.getElementById("totalPagar").textContent = dinheiro(totalMes);
    atualizarResumo();
}

async function marcarComoPaga(id) {
    if (!exigirSupabase()) return;
    const { error } = await supabaseClient.from("contas_pagar").update({ status: "pago" }).eq("id", id);
    if (error) {
        console.error(error);
        mostrarNotificacao("Erro ao atualizar conta.");
        return;
    }
    mostrarNotificacao("Conta marcada como paga.");
    carregarContas();
}

async function excluirConta(id) {
    if (!exigirSupabase()) return;
    if (!confirm("Deseja excluir esta conta?")) return;

    const { error } = await supabaseClient.from("contas_pagar").delete().eq("id", id);
    if (error) {
        mostrarNotificacao("Erro ao excluir conta.");
        return;
    }
    mostrarNotificacao("Conta excluída.");
    carregarContas();
}

async function atualizarResumo() {
    if (!supabaseClient) {
        document.getElementById("totalRecebimentos").textContent = dinheiro(0);
        document.getElementById("totalPagar").textContent = dinheiro(0);
        document.getElementById("saldo").textContent = dinheiro(0);
        return;
    }

    const mes = mesRecebimentos.value;
    if (!mes) return;

    const primeiroDia = `${mes}-01`;
    const ultimoDia = new Date(Number(mes.substring(0, 4)), Number(mes.substring(5, 7)), 0);
    const ultimoDiaFormatado = `${mes}-${String(ultimoDia.getDate()).padStart(2, "0")}`;

    const { data: recebimentos, error: erroRecebimentos } = await supabaseClient
        .from("recebimentos").select("*")
        .gte("data", primeiroDia).lte("data", ultimoDiaFormatado);

    const { data: contas, error: erroContas } = await supabaseClient
        .from("contas_pagar").select("valor")
        .gte("data_vencimento", primeiroDia).lte("data_vencimento", ultimoDiaFormatado);

    if (erroRecebimentos || erroContas) {
        console.error(erroRecebimentos || erroContas);
        return;
    }

    let totalRecebido = 0;
    let totalContas = 0;

    (recebimentos || []).forEach(item => {
        totalRecebido += Number(item.credito_debito || 0) + Number(item.dinheiro || 0) + Number(item.pix || 0) + Number(item.alimentacao || 0);
    });
    (contas || []).forEach(conta => totalContas += Number(conta.valor || 0));

    document.getElementById("totalRecebimentos").textContent = dinheiro(totalRecebido);
    document.getElementById("totalPagar").textContent = dinheiro(totalContas);
    document.getElementById("saldo").textContent = dinheiro(totalRecebido - totalContas);
}

function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

mesRecebimentos.addEventListener("change", carregarRecebimentos);
mesPagar.addEventListener("change", carregarContas);

function atualizarNomeMes() {
    const data = new Date();
    const nome = data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    document.getElementById("mesAtual").textContent = nome.charAt(0).toUpperCase() + nome.slice(1);
}

async function iniciar() {
    atualizarNomeMes();
    await carregarRecebimentos();
    await carregarContas();
    await atualizarResumo();
}

iniciar();
