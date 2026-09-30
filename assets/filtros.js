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

  var DIMENSOES = [
    { id: 'orgao', rotulo: 'Órgão executor', valores: function (c) { return [IDEPI.orgaoExecutorDe(c).rotulo]; } },
    { id: 'concedente', rotulo: 'Concedente', valores: function (c) { return [IDEPI.concedenteDe(c).sigla || 'Sem concedente']; } },
    { id: 'tipo', rotulo: 'Tipo', valores: function (c) { return [c.tipo_instrumento || 'Sem tipo coletado']; } },
    { id: 'municipio', rotulo: 'Município', valores: function (c) { var m = municipios(c); return m.length ? m : ['Sem município']; } },
    { id: 'fiscal', rotulo: 'Fiscal', valores: function (c) { return [c.fiscal || 'Sem fiscal']; } },
    { id: 'gestao', rotulo: 'Gestão', valores: function (c) { return [GESTAO[IDEPI.gestaoDe(c)]]; } },
    { id: 'prazo', rotulo: 'Prazo', valores: function (c) {
        var st = IDEPI.calcStatus(c).st; return [(IDEPI.NOME_ST || {})[st] || st]; } }
  ];

  var _conv = [], _porNum = {}, _escolha = {}, _dims = [], _barra = null, _aoMudar = null;

  function valoresDe(dim, c) {
    if (!c._fv) c._fv = {};
    if (!c._fv[dim.id]) c._fv[dim.id] = dim.valores(c);
    return c._fv[dim.id];
  }

  function passaConv(c, ignorar) {
    for (var i = 0; i < _dims.length; i++) {
      var d = _dims[i];
      if (d.id === ignorar || !_escolha[d.id]) continue;
      if (valoresDe(d, c).indexOf(_escolha[d.id]) === -1) return false;
    }
    return true;
  }

  function ativos() {
    return _dims.filter(function (d) { return !!_escolha[d.id]; }).length;
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
      var v = q.get('f_' + d.id);
      if (v) _escolha[d.id] = v;
    });
  }

  function gravarNaUrl() {
    var q = new URLSearchParams(location.search);
    _dims.forEach(function (d) {
      if (_escolha[d.id]) q.set('f_' + d.id, _escolha[d.id]);
      else q.delete('f_' + d.id);
    });
    var s = q.toString();
    try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) {}
  }

  function desenhar() {
    if (!_barra) return;
    var html = '<span class="flt-rot"><i class="fa-solid fa-sliders"></i> Filtrar por instrumento</span>';
    _dims.forEach(function (d) {
      var cont = {};
      _conv.forEach(function (c) {
        if (!passaConv(c, d.id)) return;
        valoresDe(d, c).forEach(function (v) { cont[v] = (cont[v] || 0) + 1; });
      });
      var opcoes = Object.keys(cont).sort(function (a, b) {
        return cont[b] - cont[a] || a.localeCompare(b, 'pt-BR');
      });
      var sel = _escolha[d.id] || '';
      if (sel && !cont[sel]) opcoes.unshift(sel);   // escolha sem ninguém ainda aparece
      html += '<label class="flt-campo' + (sel ? ' ativo' : '') + '"><span>' + esc(d.rotulo) + '</span>' +
        '<select data-dim="' + d.id + '" aria-label="' + esc(d.rotulo) + '">' +
        '<option value="">Todos</option>' +
        opcoes.map(function (v) {
          return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' +
                 esc(v) + ' (' + (cont[v] || 0) + ')</option>';
        }).join('') + '</select></label>';
    });
    var n = ativos();
    var total = _conv.filter(function (c) { return passaConv(c); }).length;
    html += '<span class="flt-res">' + (n
      ? '<strong>' + total + '</strong> de ' + _conv.length + ' instrumentos' +
        ' <button type="button" class="flt-limpar"><i class="fa-solid fa-xmark"></i> Limpar</button>'
      : _conv.length + ' instrumentos') + '</span>';
    _barra.innerHTML = html;
    _barra.classList.toggle('com-filtro', n > 0);
  }

  function aoEscolher(e) {
    var s = e.target.closest('select[data-dim]');
    if (s) {
      _escolha[s.getAttribute('data-dim')] = s.value;
      mudou();
    }
  }

  function mudou() {
    gravarNaUrl();
    desenhar();
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

    var ref = opts.antes || opts.depois;
    var ancora = typeof ref === 'string' ? document.querySelector(ref) : ref;
    if (ancora && !_barra) {
      _barra = document.createElement('div');
      _barra.className = 'flt-barra';
      _barra.setAttribute('role', 'group');
      _barra.setAttribute('aria-label', 'Filtros por instrumento');
      ancora.parentNode.insertBefore(_barra, opts.antes ? ancora : ancora.nextSibling);
      _barra.addEventListener('change', aoEscolher);
      _barra.addEventListener('click', function (e) {
        if (e.target.closest('.flt-limpar')) { _escolha = {}; mudou(); }
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
    limpar: function () { _escolha = {}; mudou(); }
  };
})();
