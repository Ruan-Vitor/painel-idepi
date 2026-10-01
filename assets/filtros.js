/* ═══════════════════════════════════════════════════════════════════════════
   IDEPI · filtros.js — os filtros por instrumento, iguais em todas as páginas

   Pedido do Ruan (passagem de 30/09/2026, item 12): filtrar por FUNASA,
   CODEVASF, Caixa, MIDR, MAPA, e por contrato de repasse, em todas as
   páginas que já existem. A base é o `orgao_executor` (item 11).

   UM componente, ligado por cada página com uma linha:

       IDEPI.filtros.ligar({ depois: '.srch', aoMudar: renderizar, sem: ['fiscal'] });
       ...
       lista.filter(function (x) { return IDEPI.filtros.passa(x.numero); })

   Regras que não se negociam:
   1. Cada dimensão usa a FUNÇÃO do app.js que a tela já usa (orgaoExecutorDe,
      concedenteDe, gestaoDe, calcStatus). Filtro com regra própria é como o
      mesmo convênio aparece em dois cards (26/07/2026).
   2. As contagens de cada opção levam em conta os OUTROS filtros escolhidos.
      Contar sobre a carteira inteira mostraria "FUNASA (18)" e entregaria 3
      depois de escolher o município, e a pessoa acharia que sumiu dado.
   3. A escolha vai para o endereço (?f_orgao=FUNASA). É o que faz o link
      compartilhado abrir já filtrado, pela mesma razão das páginas separadas
      (decisão de 26/07/2026). Não mexe no ?num= nem no ?status= das páginas.
   4. Instrumento que não está na lista de vigências passa quando não há
      filtro ligado, e não passa quando há: não se sabe o órgão dele, e
      "não sei" não é "sim".
   5. ESCOLHA MÚLTIPLA (01/10/2026, pedido do Ruan: "normal, atenção e
      alerta" de uma vez). Dentro de um filtro vale QUALQUER um dos marcados;
      entre filtros diferentes vale TODOS. No endereço, um parâmetro por
      valor (?f_prazo=Normal&f_prazo=Alerta): o link antigo, com um valor
      só, continua abrindo igual.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IDEPI = window.IDEPI = window.IDEPI || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  var GESTAO = { legado: 'Legado (até 2022)', nova: 'Nova gestão (2023 em diante)', proposta: 'Proposta' };

  /* Município do controle do setor: "BELÉM-PI", "Teresina", "OEIRAS/PI",
     "X/ Y/ Z" (obra em várias cidades). Vira lista de nomes limpos. */
  function municipios(c) {
    var bruto = String(c.municipio_emendas || '').trim();
    if (!bruto) return [];
    bruto = bruto.replace(/[-\/]\s*PI\s*$/i, '');
    /* "Altos, Curimatá, ... e Morro Cabeça no Tempo": lista escrita por
       extenso. O " e " só separa quando há vírgula, para não partir nome de
       cidade que o tenha. */
    if (bruto.indexOf(',') !== -1) bruto = bruto.replace(/\s+e\s+(?=[^,]*$)/i, ',');
    return bruto.split(/[\/,]/).map(function (m) {
      // Célula com texto livre depois da lista ("Varzea Grande. 2 Construção
      // de Ponte em ..."): vale o nome antes do ponto; o resto não é cidade.
      m = m.split(/\.\s/)[0].replace(/[-\s]+PI$/i, '').trim();
      if (!m || /\d|constru/i.test(m)) return '';
      return m.toLowerCase().replace(/(^|\s)(\S)/g, function (_, a, b) { return a + b.toUpperCase(); })
              .replace(/\s(D[aeo]s?|E)\s/g, function (x) { return x.toLowerCase(); });
    }).filter(Boolean);
  }

  /* O ESTILO MORA AQUI, e não no app.css (30/09/2026). Na primeira versão
     ele estava no app.css, e o app instalado mostrou a barra CRUA: o service
     worker ainda servia o app.css antigo da cache e já buscava o filtros.js
     novo na rede. Componente que traz o próprio estilo não depende de os dois
     arquivos chegarem juntos.
     Desenho: pílulas compactas numa linha ("Órgão: Todos ▾"), preenchidas com
     a cor da marca quando ligadas; no celular a linha rola de lado, que é o
     padrão das ferramentas atuais e não empurra a lista para baixo. */
  var CSS = [
    '.flt-barra{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 14px;flex-shrink:0}',
    '.flt-tit{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#64748b;margin-right:2px;white-space:nowrap}',
    '.flt-tit i{color:#1a3a6e}',
    '.flt-pill{position:relative;display:inline-flex;align-items:center;height:32px;border:1px solid #d6dfeb;border-radius:999px;background:#fff;padding:0 28px 0 12px;font-size:12.5px;color:#1a2640;cursor:pointer;white-space:nowrap;transition:border-color .15s,background .15s,box-shadow .15s}',
    '.flt-pill:hover{border-color:#9fb3cc;background:#f8fafc}',
    '.flt-pill:focus-within{border-color:#1a3a6e;box-shadow:0 0 0 3px rgba(26,58,110,.14)}',
    '.flt-pill-rot{color:#7a8ba0;margin-right:5px}',
    'button.flt-pill{font:inherit;font-size:12.5px;line-height:1;margin:0}',
    '.flt-pill:focus-visible{outline:none;border-color:#1a3a6e;box-shadow:0 0 0 3px rgba(26,58,110,.14)}',
    '.flt-pill-val{font-weight:600;max-width:170px;overflow:hidden;text-overflow:ellipsis}',
    '.flt-menu{position:fixed;z-index:3000;min-width:220px;max-width:min(320px,calc(100vw - 16px));background:#fff;border:1px solid #d6dfeb;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.18);padding:6px;overflow:auto;font-size:13px;color:#1a2640}',
    '.flt-menu-topo{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px 8px;border-bottom:1px solid #eef2f7;margin-bottom:4px}',
    '.flt-menu-topo strong{font-size:12px;color:#64748b;font-weight:600}',
    '.flt-menu-todos{border:0;background:none;color:#1a3a6e;font:inherit;font-size:12px;font-weight:600;cursor:pointer;padding:2px 4px;text-decoration:underline;text-underline-offset:3px}',
    '.flt-op{display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;cursor:pointer;user-select:none}',
    '.flt-op:hover{background:#f1f5f9}',
    '.flt-op input{width:16px;height:16px;margin:0;accent-color:#1a3a6e;flex-shrink:0;cursor:pointer}',
    '.flt-op span{flex:1;min-width:0}',
    '.flt-op small{color:#94a3b8;font-variant-numeric:tabular-nums}',
    '.flt-op.zero{opacity:.55}',
    '.flt-pill::after{content:"";position:absolute;right:12px;top:50%;width:5px;height:5px;border-right:1.6px solid currentColor;border-bottom:1.6px solid currentColor;transform:translateY(-70%) rotate(45deg);opacity:.5;pointer-events:none}',
    '.flt-pill.ativo{background:#1a3a6e;border-color:#1a3a6e;color:#fff}',
    '.flt-pill.ativo:hover{background:#224a8a}',
    '.flt-pill.ativo .flt-pill-rot{color:rgba(255,255,255,.72)}',
    '.flt-pill.ativo::after{opacity:.85}',
    '.flt-res{margin-left:auto;display:inline-flex;align-items:center;gap:10px;font-size:12px;color:#64748b;white-space:nowrap}',
    '.flt-res strong{color:#1a2640;font-weight:700}',
    '.flt-limpar{border:0;background:none;color:#1a3a6e;font:inherit;font-size:12px;font-weight:600;cursor:pointer;padding:4px 2px;text-decoration:underline;text-underline-offset:3px}',
    '@media (max-width:640px){.flt-barra{flex-wrap:nowrap;overflow-x:auto;min-width:0;max-width:100%;padding-bottom:4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.flt-barra::-webkit-scrollbar{display:none}.flt-tit span{display:none}.flt-res{margin-left:6px}}',
    '@media print{.flt-barra{display:none!important}}'
  ].join('\n');
  function injetarEstilo() {
    if (document.getElementById('flt-estilo')) return;
    var st = document.createElement('style');
    st.id = 'flt-estilo';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var DIMENSOES = [
    { id: 'orgao', rotulo: 'Órgão executor', curto: 'Órgão', valores: function (c) { return [IDEPI.orgaoExecutorDe(c).rotulo]; } },
    { id: 'concedente', rotulo: 'Concedente', valores: function (c) { return [IDEPI.concedenteDe(c).sigla || 'Sem concedente']; } },
    { id: 'tipo', rotulo: 'Tipo', valores: function (c) { return [c.tipo_instrumento || 'Sem tipo coletado']; } },
    { id: 'municipio', rotulo: 'Município', valores: function (c) { var m = municipios(c); return m.length ? m : ['Sem município']; } },
    { id: 'fiscal', rotulo: 'Fiscal', valores: function (c) { return [c.fiscal || 'Sem fiscal']; } },
    { id: 'gestao', rotulo: 'Gestão', valores: function (c) { return [GESTAO[IDEPI.gestaoDe(c)]]; } },
    { id: 'prazo', rotulo: 'Prazo', valores: function (c) {
        var st = IDEPI.calcStatus(c).st; return [(IDEPI.NOME_ST || {})[st] || st]; } }
  ];

  var _conv = [], _porNum = {}, _escolha = {}, _dims = [], _barra = null, _aoMudar = null;
  var _opcoes = {}, _menu = null, _menuDim = null;

  function valoresDe(dim, c) {
    if (!c._fv) c._fv = {};
    if (!c._fv[dim.id]) c._fv[dim.id] = dim.valores(c);
    return c._fv[dim.id];
  }

  function marcados(id) { return _escolha[id] || []; }

  function passaConv(c, ignorar) {
    for (var i = 0; i < _dims.length; i++) {
      var d = _dims[i], quer = marcados(d.id);
      if (d.id === ignorar || !quer.length) continue;
      var vs = valoresDe(d, c), bate = false;
      for (var j = 0; j < vs.length && !bate; j++) bate = quer.indexOf(vs[j]) !== -1;
      if (!bate) return false;
    }
    return true;
  }

  function ativos() {
    return _dims.filter(function (d) { return marcados(d.id).length > 0; }).length;
  }

  /** Aceita o convênio ou o número dele. */
  function passa(x) {
    if (!ativos()) return true;
    var c = (x && typeof x === 'object') ? (_porNum[String(x.numero || '').trim()] || x)
                                          : _porNum[String(x || '').trim()];
    return c ? passaConv(c) : false;
  }

  function lerDaUrl() {
    var q = new URLSearchParams(location.search);
    _dims.forEach(function (d) {
      var v = q.getAll('f_' + d.id).filter(Boolean);
      if (v.length) _escolha[d.id] = v;
    });
  }

  function gravarNaUrl() {
    var q = new URLSearchParams(location.search);
    _dims.forEach(function (d) {
      q.delete('f_' + d.id);
      marcados(d.id).forEach(function (v) { q.append('f_' + d.id, v); });
    });
    var s = q.toString();
    try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) {}
  }

  function desenhar() {
    if (!_barra) return;
    var html = '<span class="flt-tit"><i class="fa-solid fa-sliders"></i><span>Filtros</span></span>';
    _opcoes = {};
    _dims.forEach(function (d) {
      var cont = {};
      _conv.forEach(function (c) {
        if (!passaConv(c, d.id)) return;
        valoresDe(d, c).forEach(function (v) { cont[v] = (cont[v] || 0) + 1; });
      });
      var opcoes = Object.keys(cont).sort(function (a, b) {
        return cont[b] - cont[a] || a.localeCompare(b, 'pt-BR');
      });
      var sel = marcados(d.id);
      // escolha sem ninguém ainda aparece, para poder ser desmarcada
      sel.forEach(function (v) { if (!cont[v]) opcoes.unshift(v); });
      _opcoes[d.id] = { lista: opcoes, cont: cont };
      /* Na pílula, a escolha sem contagem ("FUNASA", não "FUNASA (18)"):
         número colado no nome parece parte dele. Várias: a primeira e "+N". */
      var rot = !sel.length ? 'Todos' : (sel[0] + (sel.length > 1 ? ' +' + (sel.length - 1) : ''));
      html += '<button type="button" class="flt-pill' + (sel.length ? ' ativo' : '') + '" data-dim="' + d.id +
        '" title="' + esc(d.rotulo + (sel.length ? ': ' + sel.join(', ') : '')) + '" aria-haspopup="true"' +
        ' aria-expanded="' + (_menu && _menuDim === d.id ? 'true' : 'false') + '">' +
        '<span class="flt-pill-rot">' + esc(d.curto || d.rotulo) + ':</span>' +
        '<span class="flt-pill-val">' + esc(rot) + '</span></button>';
    });
    var n = ativos();
    var total = _conv.filter(function (c) { return passaConv(c); }).length;
    html += '<span class="flt-res">' + (n
      ? '<span><strong>' + total + '</strong> de ' + _conv.length + '</span>' +
        '<button type="button" class="flt-limpar">Limpar filtros</button>'
      : '<span>' + _conv.length + ' instrumentos</span>') + '</span>';
    _barra.innerHTML = html;
    _barra.classList.toggle('com-filtro', n > 0);
  }

  /* ── O MENU DE CAIXAS ────────────────────────────────────────────────────
     Fica FORA da barra: no celular a barra rola de lado (overflow), e um
     menu dentro dela seria cortado. Pendura em fullscreenElement || body
     (CLAUDE.md, seção 9) e fica aberto enquanto se marca, para escolher
     várias de uma vez; fecha no clique fora, no Esc e na rolagem de fora. */
  function desenharMenu() {
    if (!_menu) return;
    var d = _dims.filter(function (x) { return x.id === _menuDim; })[0];
    var o = _opcoes[_menuDim] || { lista: [], cont: {} }, sel = marcados(_menuDim);
    var rolagem = _menu.scrollTop;
    _menu.innerHTML = '<div class="flt-menu-topo"><strong>' + esc(d ? d.rotulo : '') + '</strong>' +
      (sel.length ? '<button type="button" class="flt-menu-todos" data-todos>Todos</button>' : '') + '</div>' +
      o.lista.map(function (v) {
        var n = o.cont[v] || 0;
        return '<label class="flt-op' + (n ? '' : ' zero') + '"><input type="checkbox" value="' + esc(v) + '"' +
          (sel.indexOf(v) !== -1 ? ' checked' : '') + '><span>' + esc(v) + '</span><small>' + n + '</small></label>';
      }).join('');
    _menu.scrollTop = rolagem;
    posicionarMenu();
  }

  function posicionarMenu() {
    if (!_menu || !_barra) return;
    var pill = _barra.querySelector('.flt-pill[data-dim="' + _menuDim + '"]');
    if (!pill) { fecharMenu(); return; }
    var r = pill.getBoundingClientRect(), larg = _menu.offsetWidth;
    var esq = Math.max(8, Math.min(r.left, window.innerWidth - larg - 8));
    var abaixo = window.innerHeight - r.bottom - 12, acima = r.top - 12;
    _menu.style.left = esq + 'px';
    if (abaixo >= 220 || abaixo >= acima) {
      _menu.style.top = (r.bottom + 6) + 'px'; _menu.style.bottom = 'auto';
      _menu.style.maxHeight = Math.max(160, abaixo) + 'px';
    } else {
      _menu.style.top = 'auto'; _menu.style.bottom = (window.innerHeight - r.top + 6) + 'px';
      _menu.style.maxHeight = Math.max(160, acima) + 'px';
    }
  }

  function abrirMenu(dim) {
    if (_menu && _menuDim === dim) { fecharMenu(); return; }
    fecharMenu();
    _menuDim = dim;
    _menu = document.createElement('div');
    _menu.className = 'flt-menu';
    _menu.setAttribute('role', 'dialog');
    _menu.addEventListener('change', function (e) {
      var cb = e.target.closest('input[type=checkbox]');
      if (!cb) return;
      var lista = marcados(_menuDim).slice(), i = lista.indexOf(cb.value);
      if (cb.checked && i === -1) lista.push(cb.value);
      if (!cb.checked && i !== -1) lista.splice(i, 1);
      if (lista.length) _escolha[_menuDim] = lista; else delete _escolha[_menuDim];
      mudou();
    });
    _menu.addEventListener('click', function (e) {
      if (e.target.closest('[data-todos]')) { delete _escolha[_menuDim]; mudou(); }
    });
    (document.fullscreenElement || document.body).appendChild(_menu);
    desenharMenu();
    var pill = _barra && _barra.querySelector('.flt-pill[data-dim="' + dim + '"]');
    if (pill) pill.setAttribute('aria-expanded', 'true');
    var primeiro = _menu.querySelector('input');
    if (primeiro) primeiro.focus({ preventScroll: true });
  }

  function fecharMenu(devolverFoco) {
    if (!_menu) return;
    var dim = _menuDim;
    _menu.remove();
    _menu = null; _menuDim = null;
    var pill = _barra && _barra.querySelector('.flt-pill[data-dim="' + dim + '"]');
    if (pill) { pill.setAttribute('aria-expanded', 'false'); if (devolverFoco) pill.focus(); }
  }

  document.addEventListener('click', function (e) {
    if (!_menu) return;
    if (_menu.contains(e.target) || (e.target.closest && e.target.closest('.flt-pill'))) return;
    fecharMenu();
  });
  document.addEventListener('keydown', function (e) { if (_menu && e.key === 'Escape') fecharMenu(true); });
  document.addEventListener('scroll', function (e) {
    if (_menu && !_menu.contains(e.target)) fecharMenu();
  }, true);
  window.addEventListener('resize', function () { posicionarMenu(); });
  document.addEventListener('fullscreenchange', function () { fecharMenu(); });

  function mudou() {
    gravarNaUrl();
    desenhar();
    desenharMenu();
    if (_aoMudar) _aoMudar();
  }

  /** opts: { depois|antes: seletor|Element, aoMudar: fn, sem: ['fiscal', ...] }
   *  Devolve uma Promise que resolve quando os convênios chegaram. */
  function ligar(opts) {
    opts = opts || {};
    _aoMudar = opts.aoMudar || null;
    var sem = opts.sem || [];
    _dims = DIMENSOES.filter(function (d) { return sem.indexOf(d.id) === -1; });
    lerDaUrl();
    injetarEstilo();

    var ref = opts.antes || opts.depois;
    var ancora = typeof ref === 'string' ? document.querySelector(ref) : ref;
    if (ancora && !_barra) {
      _barra = document.createElement('div');
      _barra.className = 'flt-barra';
      _barra.setAttribute('role', 'group');
      _barra.setAttribute('aria-label', 'Filtros por instrumento');
      ancora.parentNode.insertBefore(_barra, opts.antes ? ancora : ancora.nextSibling);
      _barra.addEventListener('click', function (e) {
        if (e.target.closest('.flt-limpar')) { _escolha = {}; fecharMenu(); mudou(); return; }
        var pill = e.target.closest('.flt-pill[data-dim]');
        if (pill) abrirMenu(pill.getAttribute('data-dim'));
      });
    }

    return IDEPI.dados.carregar().then(function (j) {
      var conv = (j && j.convenios) || [];
      if (j && j.historico_repasses && IDEPI.usarHistorico) IDEPI.usarHistorico(j.historico_repasses);
      return (IDEPI.juntarExecucao ? IDEPI.juntarExecucao(conv) : Promise.resolve(conv))
        .then(function () { return conv; });
    }).then(function (conv) {
      _conv = conv;
      _porNum = {};
      conv.forEach(function (c) { _porNum[String(c.numero || '').trim()] = c; });
      desenhar();
      if (ativos() && _aoMudar) _aoMudar();   // filtro vindo do endereço
      return conv;
    }).catch(function () {
      if (_barra) _barra.innerHTML = '<span class="flt-rot">Filtros indisponíveis: a lista de instrumentos não carregou.</span>';
    });
  }

  IDEPI.filtros = {
    ligar: ligar,
    passa: passa,
    ativos: ativos,
    municipios: municipios,
    limpar: function () { _escolha = {}; fecharMenu(); mudou(); },
    /** O que está marcado, por rótulo: { 'Prazo': ['Normal', 'Alerta'] }. */
    escolhas: function () {
      var r = {};
      _dims.forEach(function (d) { if (marcados(d.id).length) r[d.rotulo] = marcados(d.id).slice(); });
      return r;
    }
  };
})();
