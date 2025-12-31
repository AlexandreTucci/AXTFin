// Adiciona uma nova despesa extra
function adicionarDespesa() {
    const extras = document.getElementById("extras");

    const div = document.createElement("div");
    div.className = "extra";

    div.innerHTML = `
        <input class="nome" placeholder="Nome">
        <input class="valor" type="number" placeholder="Valor">
        <input class="qtd" type="number" placeholder="Qtd">
    `;

    extras.appendChild(div);
}

// Função principal de cálculo
function calcular() {
    const salario = parseFloat(document.getElementById("salario").value) || 0;
    const diasFacul = parseInt(document.getElementById("diasFacul").value) || 0;
    const findes = parseInt(document.getElementById("findes").value) || 0;

    // Fórmulas fixas
    const dizimo = salario / 10;
    const vintePorCento = (salario - dizimo) / 5;
    const emergencia = (salario - dizimo) / 20;

    // Despesas fixas com explicação do cálculo
    const despesas = [
        {
            nome: "Dízimo",
            valor: dizimo,
            qtd: 1,
            calculo: `Dízimo = Salário ÷ 10\n${salario} ÷ 10 = ${dizimo.toFixed(2)}\nobs: 10% = 1/10`
        },
        {
            nome: "Guardar 20%",
            valor: vintePorCento,
            qtd: 1,
            calculo: `Guardar 20% = (Salário - Dízimo) ÷ 5\n(${salario} - ${dizimo.toFixed(2)}) ÷ 5 = ${vintePorCento.toFixed(2)}\nobs: 20% = 1/5`
        },
        {
            nome: "Apartamento Ale",
            valor: get("apto"),
            qtd: 1,
            calculo: `Valor fixo informado`
        },
        {
            nome: "Alianças",
            valor: get("alianca"),
            qtd: 1,
            calculo: `Valor fixo informado`
        },
        {
            nome: "Praia fda",
            valor: get("praia"),
            qtd: 1,
            calculo: `Valor fixo informado`
        },
        {
            nome: "1y",
            valor: get("oneY"),
            qtd: 1,
            calculo: `Valor fixo informado`
        },
        {
            nome: "Role",
            valor: get("role"),
            qtd: findes,
            calculo: `Role = Valor × Fins de Semana\n${get("role")} × ${findes}`
        },
        {
            nome: "Oferta",
            valor: get("oferta"),
            qtd: findes,
            calculo: `Oferta = Valor × Fins de Semana\n${get("oferta")} × ${findes}`
        },
        {
            nome: "Emergência 5%",
            valor: emergencia,
            qtd: 1,
            calculo: `Emergência = (Salário - Dízimo) ÷ 20\n(${salario} - ${dizimo.toFixed(2)}) ÷ 20 = ${emergencia.toFixed(2)}\nobs: 5% = 1/20`
        },
        {
            nome: "Internet",
            valor: get("internet"),
            qtd: 1,
            calculo: `Valor fixo informado`
        },
        {
            nome: "Gasolina",
            valor: get("gasolina"),
            qtd: 1,
            calculo: `Valor fixo informado`
        },
        {
            nome: "Estac PUC",
            valor: get("estac"),
            qtd: diasFacul,
            calculo: `Estacionamento = Valor × Dias Faculdade\n${get("estac")} × ${diasFacul}`
        },
        {
            nome: "Spotify",
            valor: get("spotify"),
            qtd: 1,
            calculo: `Valor fixo informado`
        }
    ];

        // Despesas extras
        document.querySelectorAll(".extra").forEach(e => {
        const nome = e.querySelector(".nome").value || "Extra";
        const valor = parseFloat(e.querySelector(".valor").value) || 0;
        const qtd = parseInt(e.querySelector(".qtd").value) || 1;

        despesas.push({
            nome,
            valor,
            qtd,
            calculo: `${nome} = ${valor} × ${qtd}`
        });
    });

        // Atualiza tabela
        const tabela = document.getElementById("tabela");
    tabela.innerHTML = "";

    let total = 0;

    despesas.forEach(d => {
        const valorFinal = d.valor * d.qtd;
        total += valorFinal;

        const tr = document.createElement("tr");
        tr.title = d.calculo; // 🔹 tooltip com o cálculo

        tr.innerHTML = `
            <td>${d.nome}</td>
            <td>${d.valor.toFixed(2)}</td>
            <td>${d.qtd}</td>
            <td>${valorFinal.toFixed(2)}</td>
        `;

        tabela.appendChild(tr);
    });

    document.getElementById("total").innerText =
        `Total: R$ ${total.toFixed(2)}`;

    document.getElementById("restante").innerText =
        `Restante: R$ ${(salario - total).toFixed(2)}`;
}

// Função utilitária
function get(id) {
    return parseFloat(document.getElementById(id).value) || 0;
}
