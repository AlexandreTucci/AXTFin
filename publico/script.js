/* script.js - lógica da aplicação
   - Persistência em LocalStorage
   - Cálculos centralizados
   - Atualização em tempo real
*/

(function () {
  'use strict';

  // Chaves para LocalStorage (centralizadas para futura migração)
  const STORAGE_KEY = 'controle_financeiro_estado_v1';

  // Estado da aplicação
  let estado = {
    renda: 0,
    despesas: []
  };

  // Elementos DOM
  const el = {
    inputRenda: null,
    totalDespesas: null,
    saldoRestante: null,
    percentual: null,
    listaDespesas: null,
    btnNovaDespesa: null,
    tooltip: null
  };

  // --- Funções de cálculo centralizadas (fáceis de testar/migrar) ---
  /**
   * Calcula o total das despesas (considerando quantidade de repetições)
   * @param {Array} despesas
   * @returns {number}
   */
  function calcularTotalDespesas(despesas) {
    return despesas.reduce((acc, d) => {
      const valor = Number(d.valor || 0);
      const qtd = Number(d.quantidade || 1) || 0;
      return acc + (valor * qtd);
    }, 0);
  }

  /**
   * Calcula saldo: renda - despesas
   * @param {number} renda
   * @param {number} totalDespesas
   * @returns {number}
   */
  function calcularSaldo(renda, totalDespesas) {
    return Number(renda) - Number(totalDespesas);
  }

  /**
   * Calcula percentagem comprometida da renda pelas despesas
   * @param {number} totalDespesas
   * @param {number} renda
   * @returns {number} percentual entre 0 e 100 (ou >100)
   */
  function calcularPercentual(totalDespesas, renda) {
    if (!renda || Number(renda) === 0) return 0;
    return (Number(totalDespesas) / Number(renda)) * 100;
  }

  // --- Utilitários ---
  function formatCurrency(value) {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatPercent(value) {
    return `${value.toFixed(1)}%`;
  }

  // Normaliza input numérico, aceita vírgula
  function parseInputNumber(value) {
    if (typeof value === 'string') {
      const normalized = value.replace(/\s/g, '').replace(',', '.');
      const n = parseFloat(normalized);
      return isNaN(n) ? 0 : n;
    }
    return Number(value) || 0;
  }

  // Gera ID simples
  function uid() {
    return `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  // --- Persistência ---
  function salvarEstado() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch (e) {
      console.warn('Falha ao salvar estado no LocalStorage.', e);
    }
  }

  function carregarEstado() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Validação mínima
      estado.renda = Number(parsed.renda) || 0;
      estado.despesas = Array.isArray(parsed.despesas) ? parsed.despesas.map(d => ({
        id: d.id || uid(),
        nome: d.nome || '',
        valor: Number(d.valor) || 0,
        quantidade: Number(d.quantidade) || 1,
        categoria: d.categoria || 'Outros'
      })) : [];
    } catch (e) {
      console.warn('Falha ao carregar estado do LocalStorage.', e);
    }
  }

  // --- Renderização ---
  function montarItemDespesa(despesa) {
    const wrapper = document.createElement('div');
    wrapper.className = 'item-despesa';
    wrapper.dataset.id = despesa.id;

    // nome
    const nomeInput = document.createElement('input');
    nomeInput.type = 'text';
    nomeInput.value = despesa.nome || '';
    nomeInput.placeholder = 'Nome da despesa';
    nomeInput.addEventListener('input', () => {
      atualizarDespesa(despesa.id, { nome: nomeInput.value });
    });

    // valor
    const valorInput = document.createElement('input');
    valorInput.type = 'text';
    valorInput.value = String(despesa.valor || '');
    valorInput.className = 'valor-input';
    valorInput.addEventListener('input', () => {
      // permitir vírgula
      const nv = parseInputNumber(valorInput.value);
      atualizarDespesa(despesa.id, { valor: nv });
      // atualizar subtotal visual imediatamente
      const qv = Number(qtdInput.value) || 0;
      subtotalDiv.textContent = formatCurrency(nv * qv);
      // manter campo textual com entrada do usuário (não substituímos agora)
    });
    valorInput.addEventListener('blur', () => {
      const nv = parseInputNumber(valorInput.value);
      valorInput.value = nv.toFixed(2).replace('.', ',');
    });

    // quantidade (nº de vezes que a despesa se repete no período)
    const qtdInput = document.createElement('input');
    qtdInput.type = 'number';
    qtdInput.min = '0';
    qtdInput.step = '1';
    qtdInput.value = String(despesa.quantidade || 1);
    qtdInput.className = 'qtd-input';
    qtdInput.addEventListener('input', () => {
      const q = parseInt(qtdInput.value, 10);
      const finalQ = Number.isNaN(q) ? 0 : q;
      atualizarDespesa(despesa.id, { quantidade: finalQ });
      // atualizar subtotal visual
      const vv = parseInputNumber(valorInput.value) || 0;
      subtotalDiv.textContent = formatCurrency(vv * finalQ);
    });
    qtdInput.addEventListener('blur', () => {
      const q = parseInt(qtdInput.value, 10);
      qtdInput.value = String(Number.isNaN(q) ? 0 : q);
    });

    // categoria
    const categoriaSelect = document.createElement('select');
    ['Moradia','Transporte','Lazer','Alimentação','Outros'].forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (despesa.categoria === cat) opt.selected = true;
      categoriaSelect.appendChild(opt);
    });
    categoriaSelect.addEventListener('change', () => {
      atualizarDespesa(despesa.id, { categoria: categoriaSelect.value });
    });

    // subtotal (valor × quantidade)
    const subtotalDiv = document.createElement('div');
    subtotalDiv.className = 'subtotal';
    const initialSubtotal = (Number(despesa.valor || 0) * Number(despesa.quantidade || 1));
    subtotalDiv.textContent = formatCurrency(initialSubtotal);

    // botão remover
    const btnRemover = document.createElement('button');
    btnRemover.className = 'btn secondary';
    btnRemover.type = 'button';
    btnRemover.textContent = '✕';
    btnRemover.title = 'Remover despesa';
    btnRemover.addEventListener('click', () => {
      removerDespesa(despesa.id);
    });

    // Acomoda elementos (inclui subtotal)
    wrapper.appendChild(nomeInput);
    wrapper.appendChild(valorInput);
    wrapper.appendChild(qtdInput);
    wrapper.appendChild(subtotalDiv);
    wrapper.appendChild(categoriaSelect);
    wrapper.appendChild(btnRemover);

    return wrapper;
  }

  function renderizarLista() {
    el.listaDespesas.innerHTML = '';
    estado.despesas.forEach(d => {
      const item = montarItemDespesa(d);
      el.listaDespesas.appendChild(item);
    });
  }

  function atualizarResumo() {
    const total = calcularTotalDespesas(estado.despesas);
    const saldo = calcularSaldo(estado.renda, total);
    const percent = calcularPercentual(total, estado.renda);

    el.totalDespesas.textContent = formatCurrency(total);
    el.percentual.textContent = formatPercent(percent);

    el.saldoRestante.textContent = formatCurrency(saldo);

    // aplicando cor ao saldo
    el.saldoRestante.classList.toggle('saldo-positivo', saldo >= 0);
    el.saldoRestante.classList.toggle('saldo-negativo', saldo < 0);

    // atualizar conteúdo do tooltip
    montarTooltip({ renda: estado.renda, total, despesas: estado.despesas, saldo });
  }

  function montarTooltip({ renda, total, despesas, saldo }) {
    // Conteúdo com fórmula e lista de despesas
    const formula = `Saldo = Renda (${formatCurrency(renda)}) - Total Despesas (${formatCurrency(total)}) = ${formatCurrency(saldo)}`;
    const lista = despesas.length ? despesas.map(d => {
      const qtd = Number(d.quantidade || 1);
      const valor = Number(d.valor || 0);
      const subtotal = valor * qtd;
      return `<li>${escapeHtml(d.nome || '(sem nome)')} — ${formatCurrency(valor)} × ${qtd} = ${formatCurrency(subtotal)} (${escapeHtml(d.categoria || 'Outros')})</li>`;
    }).join('') : '<li>(nenhuma despesa)</li>';

    el.tooltip.innerHTML = `
      <div><strong>Fórmula</strong></div>
      <div class="tooltip-formula" style="margin:6px 0 8px;font-size:.95rem">${formula}</div>
      <div><strong>Despesas somadas</strong></div>
      <ul style="margin-top:6px;padding-left:18px">${lista}</ul>
    `;
  }

  // pequena função para evitar XSS em conteúdos inseridos
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  // --- Ações sobre despesas ---
  function adicionarDespesa(dados = {}) {
    const nova = {
      id: uid(),
      nome: dados.nome || '',
      valor: Number(dados.valor) || 0,
      quantidade: Number(dados.quantidade) || 1,
      categoria: dados.categoria || 'Outros'
    };
    estado.despesas.push(nova);
    salvarEstado();
    renderizarLista();
    atualizarResumo();
  }

  function atualizarDespesa(id, campos) {
    const idx = estado.despesas.findIndex(d => d.id === id);
    if (idx === -1) return;
    estado.despesas[idx] = Object.assign({}, estado.despesas[idx], campos);
    salvarEstado();
    atualizarResumo();

    // Atualiza subtotal na linha correspondente, se presente
    const row = document.querySelector(`.item-despesa[data-id="${id}"]`);
    if (row) {
      const subtotalEl = row.querySelector('.subtotal');
      if (subtotalEl) {
        const d = estado.despesas[idx];
        const subtotal = Number(d.valor || 0) * Number(d.quantidade || 1);
        subtotalEl.textContent = formatCurrency(subtotal);
      }
    }
  }

  function removerDespesa(id) {
    estado.despesas = estado.despesas.filter(d => d.id !== id);
    salvarEstado();
    renderizarLista();
    atualizarResumo();
  }

  // --- Inicialização e eventos ---
  function bindEventos() {
    // renda
    el.inputRenda.addEventListener('input', (e) => {
      const val = parseInputNumber(e.target.value);
      estado.renda = val;
      salvarEstado();
      atualizarResumo();
    });
    el.inputRenda.addEventListener('blur', (e) => {
      // exibe valor formatado ao perder o foco
      el.inputRenda.value = Number(estado.renda || 0).toFixed(2).replace('.', ',');
    });

    // botão adicionar despesa
    el.btnNovaDespesa.addEventListener('click', () => {
      adicionarDespesa({ nome: '', valor: 0, categoria: 'Outros' });
    });

    // tooltip mostra ao passar mouse e ao focar via teclado
    const target = el.saldoRestante;
    function showTooltip() {
      el.tooltip.classList.add('visible');
      el.tooltip.setAttribute('aria-hidden', 'false');
    }
    function hideTooltip() {
      el.tooltip.classList.remove('visible');
      el.tooltip.setAttribute('aria-hidden', 'true');
    }
    target.addEventListener('mouseenter', showTooltip);
    target.addEventListener('mouseleave', hideTooltip);
    target.addEventListener('focus', showTooltip);
    target.addEventListener('blur', hideTooltip);
  }

  function inicializarDOM() {
    el.inputRenda = document.getElementById('input-renda');
    el.totalDespesas = document.getElementById('total-despesas');
    el.saldoRestante = document.getElementById('saldo-restante');
    el.percentual = document.getElementById('percentual');
    el.listaDespesas = document.getElementById('lista-despesas');
    el.btnNovaDespesa = document.getElementById('btn-nova-despesa');
    el.tooltip = document.getElementById('tooltip');
  }

  // --- Boot ---
  function init() {
    inicializarDOM();
    carregarEstado();

    // preencher input renda com formato
    el.inputRenda.value = estado.renda ? Number(estado.renda).toFixed(2).replace('.', ',') : '';

    renderizarLista();
    atualizarResumo();
    bindEventos();
  }

  // Expor init no escopo global de forma controlada
  window.App = { init };

  // iniciar quando DOM pronto
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });

})();