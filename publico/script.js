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
  // Retorna total e detalhamento com cálculo sequencial (percentuais aplicados ao saldo restante)
  function obterDetalhesDespesas(despesas, renda) {
    const rendaInicial = Number(renda) || 0;
    let saldoCorrente = rendaInicial;

    const detalhes = [];
    const computedById = {}; // para referenciar despesas anteriores
    let total = 0;

    despesas.forEach(d => {
      const qtd = Number(d.quantidade || 1) || 0;
      if (d.tipo === 'percentual') {
        // determina base para o percentual
        let baseParaCalculo = 0;
        const bv = (d.baseValue !== undefined && d.baseValue !== null) ? Number(d.baseValue) : NaN;
        if (!Number.isNaN(bv)) {
          baseParaCalculo = bv;
        } else if (d.base === 'renda') {
          baseParaCalculo = rendaInicial;
        } else if (d.base === 'saldo') {
          baseParaCalculo = saldoCorrente;
        } else if (d.base === 'despesa' && d.referenciaId) {
          baseParaCalculo = Number(computedById[d.referenciaId]) || 0;
        } else {
          baseParaCalculo = saldoCorrente;
        }
        const pct = Number(d.valor || 0) || 0;
        const amount = baseParaCalculo * (pct / 100) * qtd;
        detalhes.push({ id: d.id, nome: d.nome, quantidade: qtd, tipo: d.tipo, valor: Number(d.valor)||0, amount, baseBefore: baseParaCalculo, baseValue: (!Number.isNaN(bv) ? bv : null), baseType: d.base || 'saldo', referenciaId: d.referenciaId || null });
        total += amount;
        saldoCorrente -= amount;
        computedById[d.id] = amount;
      } else {
        const amount = Number(d.valor || 0) * qtd;
        detalhes.push({ id: d.id, nome: d.nome, quantidade: qtd, tipo: d.tipo || 'valor', valor: Number(d.valor)||0, amount, baseBefore: saldoCorrente, baseType: 'valor' });
        total += amount;
        saldoCorrente -= amount;
        computedById[d.id] = amount;
      }
    });
    return { total, detalhes, baseFinal: saldoCorrente, computedById };
  }

  function calcularTotalDespesas(despesas, renda) {
    return obterDetalhesDespesas(despesas, renda).total;
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
        categoria: d.categoria || 'Outros',
        tipo: d.tipo || 'valor', // 'valor' ou 'percentual'
        base: d.base || 'saldo', // compatibilidade: pode vir do estado antigo
        referenciaId: d.referenciaId || null, // id da despesa usada como base (se base === 'despesa')
        baseValue: (d.baseValue !== undefined && d.baseValue !== null) ? Number(d.baseValue) : null
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
    valorInput.className = 'valor-input';
    if (despesa.tipo === 'percentual') {
      valorInput.value = String(Number(despesa.valor || 0));
    } else {
      valorInput.value = despesa.valor ? Number(despesa.valor).toFixed(2).replace('.', ',') : '';
    }

    // unidade/indicador (%) ao lado
    const unitSpan = document.createElement('span');
    unitSpan.className = 'unit';
    unitSpan.style.cssText = 'display:inline-block;min-width:20px;text-align:right;padding-right:6px;color:#6b7280;';
    unitSpan.textContent = despesa.tipo === 'percentual' ? '%' : '';

    // tipo (valor ou percentual)
    const tipoSelect = document.createElement('select');
    const optValor = document.createElement('option'); optValor.value = 'valor'; optValor.textContent = 'R$';
    const optPct = document.createElement('option'); optPct.value = 'percentual'; optPct.textContent = '%';
    tipoSelect.appendChild(optValor); tipoSelect.appendChild(optPct);
    if ((despesa.tipo || 'valor') === 'percentual') tipoSelect.value = 'percentual'; else tipoSelect.value = 'valor';

    // aplica classes visuais iniciais se for percentual
    if (tipoSelect.value === 'percentual') {
      tipoSelect.classList.add('is-percent');
      unitSpan.classList.add('unit--active');
    }

    tipoSelect.addEventListener('change', () => {
      atualizarDespesa(despesa.id, { tipo: tipoSelect.value });
      unitSpan.textContent = tipoSelect.value === 'percentual' ? '%' : '';
      // toggle classes para feedback visual
      tipoSelect.classList.toggle('is-percent', tipoSelect.value === 'percentual');
      if (valorWrap) valorWrap.classList.toggle('percent-active', tipoSelect.value === 'percentual');
      unitSpan.classList.toggle('unit--active', tipoSelect.value === 'percentual');
      // mostrar/ocultar campo de base se existir
      if (typeof baseValueInput !== 'undefined') {
        if (tipoSelect.value === 'percentual') {
          baseValueInput.style.display = '';
          baseValueInput.focus();
        } else {
          baseValueInput.style.display = 'none';
          atualizarDespesa(despesa.id, { baseValue: null });
        }
      }
      // re-render para recalcular subtotais encadeados
      renderizarLista();
      atualizarResumo();
    });

    valorInput.addEventListener('input', () => {
      const nv = parseInputNumber(valorInput.value);
      atualizarDespesa(despesa.id, { valor: nv });
      // atualizar subtotal visual imediatamente com cálculo atual
      const detalhe = obterDetalhesDespesas(estado.despesas, estado.renda).detalhes.find(dt => dt.id === despesa.id);
      subtotalDiv.textContent = formatCurrency(detalhe ? detalhe.amount : 0);
    });
    valorInput.addEventListener('blur', () => {
      const nv = parseInputNumber(valorInput.value);
      if (tipoSelect.value === 'percentual') {
        // mostrar com uma casa decimal
        valorInput.value = nv.toFixed(1).replace('.', ',');
      } else {
        valorInput.value = nv.toFixed(2).replace('.', ',');
      }
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
      const detalhe = obterDetalhesDespesas(estado.despesas, estado.renda).detalhes.find(dt => dt.id === despesa.id);
      subtotalDiv.textContent = formatCurrency(detalhe ? detalhe.amount : 0);
    });
    qtdInput.addEventListener('blur', () => {
      const q = parseInt(qtdInput.value, 10);
      qtdInput.value = String(Number.isNaN(q) ? 0 : q);
    });

    // campo para inserir valor base manualmente (aparece apenas para percentuais)
    const baseValueInput = document.createElement('input');
    baseValueInput.type = 'text';
    baseValueInput.className = 'base-value-input';
    baseValueInput.placeholder = 'Valor base (ex: 900)';
    baseValueInput.style.display = (despesa.tipo === 'percentual') ? '' : 'none';
    baseValueInput.value = ((despesa.baseValue !== undefined && despesa.baseValue !== null) ? Number(despesa.baseValue).toFixed(2).replace('.', ',') : '');

    baseValueInput.addEventListener('input', () => {
      const bv = parseInputNumber(baseValueInput.value);
      atualizarDespesa(despesa.id, { baseValue: bv });
      const detalhe = obterDetalhesDespesas(estado.despesas, estado.renda).detalhes.find(dt => dt.id === despesa.id);
      subtotalDiv.textContent = formatCurrency(detalhe ? detalhe.amount : 0);
    });
    baseValueInput.addEventListener('blur', () => {
      const nv = parseInputNumber(baseValueInput.value);
      baseValueInput.value = nv ? nv.toFixed(2).replace('.', ',') : '';
    });



    // subtotal (valor calculado, considera percentuais encadeados)
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

    // Layout em duas linhas:
    // linha superior: nome (à esquerda) e subtotal (à direita)
    const rowTop = document.createElement('div');
    rowTop.className = 'row-top';
    rowTop.style.display = 'flex';
    rowTop.style.justifyContent = 'space-between';
    rowTop.style.alignItems = 'center';
    rowTop.appendChild(nomeInput);
    rowTop.appendChild(subtotalDiv);

    // linha inferior: controles (valor, tipo, base, ref, qtd, remover)
    const rowControls = document.createElement('div');
    rowControls.className = 'row-controls';
    rowControls.style.display = 'flex';
    rowControls.style.gap = '12px';
    rowControls.style.alignItems = 'center';

    // valor + tipo + unidade
    const valorWrap = document.createElement('div');
    valorWrap.style.display = 'flex';
    valorWrap.style.alignItems = 'center';
    valorWrap.style.gap = '6px';
    valorWrap.appendChild(valorInput);
    valorWrap.appendChild(unitSpan);
    valorWrap.appendChild(tipoSelect);

    // adicionar campo de valor base (aparece somente para percentuais)
    const extraWrap = document.createElement('div');
    extraWrap.style.display = 'flex';
    extraWrap.style.gap = '6px';
    extraWrap.style.alignItems = 'center';
    extraWrap.appendChild(baseValueInput);

    rowControls.appendChild(valorWrap);
    rowControls.appendChild(extraWrap);
    rowControls.appendChild(qtdInput);
    // botão remover à direita
    const spacer = document.createElement('div');
    spacer.style.flex = '1 1 auto';
    rowControls.appendChild(spacer);
    rowControls.appendChild(btnRemover);

    wrapper.appendChild(rowTop);
    wrapper.appendChild(rowControls);

    return wrapper;
  }

  function renderizarLista() {
    el.listaDespesas.innerHTML = '';
    const detalhes = obterDetalhesDespesas(estado.despesas, estado.renda).detalhes;
    estado.despesas.forEach(d => {
      const item = montarItemDespesa(d);
      el.listaDespesas.appendChild(item);
      // Atualiza subtotal com valor calculado (com percentuais encadeados)
      const detalhe = detalhes.find(dt => dt.id === d.id);
      if (detalhe) {
        const subtotalEl = item.querySelector('.subtotal');
        if (subtotalEl) subtotalEl.textContent = formatCurrency(detalhe.amount);
      }
    });
  }

  function atualizarResumo() {
    const detalhesInfo = obterDetalhesDespesas(estado.despesas, estado.renda);
    const total = detalhesInfo.total;
    const saldo = calcularSaldo(estado.renda, total);
    const percent = calcularPercentual(total, estado.renda);

    el.totalDespesas.textContent = formatCurrency(total);
    el.percentual.textContent = formatPercent(percent);

    el.saldoRestante.textContent = formatCurrency(saldo);

    // aplicando cor ao saldo
    el.saldoRestante.classList.toggle('saldo-positivo', saldo >= 0);
    el.saldoRestante.classList.toggle('saldo-negativo', saldo < 0);

    // atualizar conteúdo do tooltip (passa detalhes para exibição mais informativa)
    montarTooltip({ renda: estado.renda, total, despesas: estado.despesas, saldo, detalhes: detalhesInfo.detalhes });
  }

  function montarTooltip({ renda, total, despesas, saldo, detalhes }) {
    // Conteúdo com fórmula e lista de despesas (detalhes inclui baseBefore e amount)
    const formula = `Saldo = Renda (${formatCurrency(renda)}) - Total Despesas (${formatCurrency(total)}) = ${formatCurrency(saldo)}`;
    const lista = (detalhes && detalhes.length) ? detalhes.map(dt => {
      const original = despesas.find(d => d.id === dt.id) || {};
      if (dt.tipo === 'percentual') {
        let baseLabel = dt.baseValue !== undefined && dt.baseValue !== null ? `valor base` : (dt.baseType === 'renda' ? 'renda' : (dt.baseType === 'despesa' ? `despesa (${dt.referenciaId || '??'})` : 'saldo restante'));
        const refName = (dt.referenciaId && (despesas.find(x => x.id === dt.referenciaId) || {}).nome) ? ` — (ref: ${escapeHtml((despesas.find(x => x.id === dt.referenciaId) || {}).nome)})` : '';
        const baseValueNote = (dt.baseValue !== undefined && dt.baseValue !== null) ? ` — base: ${formatCurrency(dt.baseValue)}` : '';
        return `<li>${escapeHtml(dt.nome || '(sem nome)')} — ${dt.valor}% de ${baseLabel} (${formatCurrency(dt.baseBefore)}) = ${formatCurrency(dt.amount)}${baseValueNote}${refName}</li>`;
      }
      return `<li>${escapeHtml(dt.nome || '(sem nome)')} — ${formatCurrency(dt.valor)} × ${dt.quantidade} = ${formatCurrency(dt.amount)}</li>`;
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
      categoria: dados.categoria || 'Outros',
      tipo: dados.tipo || 'valor',
      base: dados.base || 'saldo',
      referenciaId: dados.referenciaId || null,
      baseValue: (dados.baseValue !== undefined && dados.baseValue !== null) ? Number(dados.baseValue) : null
    };
    estado.despesas.push(nova);
    salvarEstado();
    renderizarLista();
    atualizarResumo();

    // destacar como inserir porcentagem: foca o seletor de tipo na nova linha
    setTimeout(() => {
      const row = document.querySelector(`.item-despesa[data-id="${nova.id}"]`);
      if (row) {
        const tipoSelect = row.querySelector('select');
        if (tipoSelect) {
          tipoSelect.focus();
        }
      }
    }, 0);
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
        // recalcula detalhes e encontra o valor atual dessa despesa
        const detalhe = obterDetalhesDespesas(estado.despesas, estado.renda).detalhes.find(dt => dt.id === id);
        if (detalhe) {
          subtotalEl.textContent = formatCurrency(detalhe.amount);
        } else {
          subtotalEl.textContent = formatCurrency(0);
        }
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