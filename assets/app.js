/* ══════════════════════════════════════════════════════════════════════════
   IDEPI — app.js
   Funções compartilhadas por todos os painéis.

   MOTIVO DE EXISTIR: até 26/07/2026 cada HTML tinha a sua própria cópia de
   parseDate/calcStatus/temFoto/isFinalizado. As cópias tinham divergido —
   o fiscalgov.html, por exemplo, ignorava a vigência suspensiva e mostrava
   um status diferente do vigencias.html para o MESMO convênio.
   Agora existe uma única implementação: esta.

   Expõe tudo em window.IDEPI (namespace global, sem módulos, para funcionar
   com os onclick="..." inline que as páginas já usam).
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var IDEPI = global.IDEPI || (global.IDEPI = {});

  /* ── DATAS ─────────────────────────────────────────────────────────────── */

  /** Converte "DD/MM/AAAA" ou "AAAA-MM-DD" em Date (meia-noite local). */
  function parseDateBR(s) {
    if (!s) return null;
    s = String(s).trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  }

  /** Hoje à meia-noite — recalculado a cada chamada (a aba pode ficar aberta
      virando o dia; usar uma constante daria contagem errada). */
  function hoje() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function diasAte(data) {
    if (!data) return null;
    return Math.round((data - hoje()) / 86400000);
  }

  /* ── TEXTO ─────────────────────────────────────────────────────────────── */

  /** Remove acentos e baixa a caixa — para comparar situações vindas da API. */
  function norm(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /** Escapa HTML. Use SEMPRE que jogar dado da API dentro de innerHTML. */
  function esc(s) {
    return (s === null || s === undefined ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── NÚMEROS / MOEDA ───────────────────────────────────────────────────── */

  /** "1.234.567,89" → 1234567.89 · devolve 0 quando não dá para converter. */
  function parseReais(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (!v) return 0;
    var n = parseFloat(
      String(v).replace(/R\$/g, '').replace(/\s| /g, '')
               .replace(/\./g, '').replace(',', '.')
    );
    return isNaN(n) ? 0 : n;
  }

  function fmtNum(n) {
    return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtReais(n) {
    return 'R$ ' + fmtNum(parseReais(n));
  }

  /** Resumo curto para header: 12.345.678 → "R$ 12,3M". */
  function fmtCompacto(n) {
    n = parseReais(n);
    if (!n) return '—';
    if (n >= 1e9) return 'R$ ' + (n / 1e9).toFixed(1).replace('.', ',') + 'B';
    if (n >= 1e6) return 'R$ ' + (n / 1e6).toFixed(1).replace('.', ',') + 'M';
    if (n >= 1e3) return 'R$ ' + (n / 1e3).toFixed(0) + 'k';
    return fmtReais(n);
  }

  function diasAtras(ts) {
    var d = Math.floor((Date.now() - ts) / 86400000);
    if (d <= 0) return 'hoje';
    if (d === 1) return 'ontem';
    return 'há ' + d + ' dias';
  }

  /* ══════════════════════════════════════════════════════════════════════
     REGRAS DE NEGÓCIO — fonte única da verdade
     ══════════════════════════════════════════════════════════════════════ */

  /* Situações que significam "acabou". Verificamos os três campos porque a
     API da CGU tem bug conhecido (chamado #48358198): devolve "NORMAL" para
     instrumentos que o Transferegov já mostra como encerrados. Por isso
     situacao_tgov e sit_contrat_tgov têm prioridade sobre situacao.

     Qualquer estado de prestação de contas encerra o acompanhamento — abrir
     a PCF, mesmo por antecipação, é dizer que a obra acabou. A ÚNICA exceção
     é "Aguardando Prestação de Contas", tratada logo abaixo: ali a PCF ainda
     não foi aberta. Por isso REGEX_AGUARDA_PC é consultada ANTES desta. */
  var REGEX_FIN = /prestacao\s*de\s*contas|tomada\s*de\s*contas|finalizad|concluid|encerrad|rescindid|anulad|inadimplent/;

  /* O Transferegov nunca escreve "vencido": um instrumento cuja vigência
     acabou sem prestação de contas entregue aparece assim. É o vencido mais
     grave que existe. */
  var REGEX_AGUARDA_PC = /aguardando\s*prestacao\s*de\s*contas/;

  /* Ruído conhecido das colunas T/U — valor do filtro da tela que vazou. */
  var SIT_IGNORADA = { '': 1, '—': 1, '-': 1, 'erro': 1, 'todas': 1, 'n/a': 1, 'n/d': 1 };

  /** Primeiro campo que disser algo decisivo é o que vale.
   *  @returns {'fim'|'aguarda'|null} */
  function leSituacao(c) {
    if (!c) return null;
    var campos = [c.situacao_tgov, c.sit_contrat_tgov, c.situacao];
    for (var i = 0; i < campos.length; i++) {
      var s = norm(campos[i]).trim();
      if (SIT_IGNORADA[s]) continue;
      if (REGEX_AGUARDA_PC.test(s)) return 'aguarda';
      if (REGEX_FIN.test(s)) return 'fim';
    }
    return null;
  }

  function isFinalizado(c) {
    return leSituacao(c) === 'fim';
  }

  /** Vigência encerrada com a prestação de contas ainda por entregar. */
  function aguardaPrestacao(c) {
    return leSituacao(c) === 'aguarda';
  }

  /**
   * Status de vigência de um convênio.
   * Considera a cláusula suspensiva quando ela é anterior (ou igual) à
   * vigência normal — é ela que passa a valer como prazo efetivo.
   *
   * @returns {{st:string, dias:number|null, temSusp:boolean}}
   *   st ∈ normal | alerta | atencao | critico | vencido | finalizado
   */
  function calcStatus(c) {
    var sit = leSituacao(c);
    if (sit === 'fim') return { st: 'finalizado', dias: null, temSusp: false };

    var dVig = parseDateBR(c.vigencia_fmt || c.vigencia);
    var dSus = parseDateBR(c.vigencia_suspensiva);

    var temSusp = false;
    var dataEf = dVig;
    if (dSus && (!dVig || dSus <= dVig)) { dataEf = dSus; temSusp = true; }

    var dias = dataEf ? diasAte(dataEf) : null;

    /* Aguardando PCF é vencido mesmo sem data utilizável: a própria situação
       do Transferegov já diz que a vigência acabou. */
    if (sit === 'aguarda') return { st: 'vencido', dias: dias, temSusp: temSusp };

    /* Sem data e sem situação decisiva NÃO é finalizado — é dado que falta.
       São as propostas ainda não assinadas (999001, 999050, 999010, 999021),
       que não têm início nem término de vigência em fonte nenhuma. Devolver
       'finalizado' aqui inflava o card de encerrados e, pior, fazia o KPI de
       eficiência mostrar 100% de conclusão para quem sequer começou.
       O main.py sempre chamou isso de SEM DATA — os dois agora concordam. */
    if (dias === null) return { st: 'sem_data', dias: null, temSusp: false };

    var st = dias < 0 ? 'vencido'
           : dias <= 30 ? 'critico'
           : dias <= 60 ? 'atencao'
           : dias <= 90 ? 'alerta'
           : 'normal';
    return { st: st, dias: dias, temSusp: temSusp };
  }

  /* ── Coorte: legado (até 2022) x nova gestão (a partir de 2023) ───────── */

  /* O corte é a data de INÍCIO DE VIGÊNCIA, que a CGU devolve em
     `dataInicioVigencia` e o main.py publica como `vigencia_inicio`. Em
     03/08/2026 ela foi conferida contra as abas "ATE 2022 VIGENTES" e
     "A PARTIR DE 2023.01.01" da planilha oficial Emendas Senador: 94 dos 98
     convênios, zero divergências. Os 4 restantes são propostas ainda não
     assinadas — não têm data de início em lugar nenhum, nem na CGU nem no
     Transferegov, e por isso formam uma terceira categoria em vez de serem
     empurrados para um dos lados. */
  var CORTE_GESTAO = 2023;

  /** @returns {'legado'|'nova'|'proposta'} */
  function gestaoDe(c) {
    var d = parseDateBR(c && (c.vigencia_inicio || c.vigencia_inicio_fmt));
    if (!d) return 'proposta';
    return d.getFullYear() >= CORTE_GESTAO ? 'nova' : 'legado';
  }

  /** Eficiência em CONCLUIR, por coorte.
   *
   *  A pergunta que este número responde: a nova gestão conclui mais fácil
   *  que o legado? A hipótese do IDEPI é que sim, por ter menos pendências
   *  de origem. Mas a PRIORIDADE é liquidar os antigos — então o que
   *  interessa acompanhar é o percentual do LEGADO subindo, não o da nova
   *  sendo maior. Um legado parado é o alerta, mesmo com a nova indo bem. */
  function resumoGestao(convenios) {
    var base = { total: 0, finalizados: 0, vigentes: 0, vencidos: 0, pct: 0 };
    var r = {
      legado:   Object.assign({}, base),
      nova:     Object.assign({}, base),
      proposta: Object.assign({}, base)
    };
    (convenios || []).forEach(function (c) {
      var g = r[gestaoDe(c)];
      g.total++;
      var st = calcStatus(c).st;
      if (st === 'finalizado') g.finalizados++;
      else if (st === 'vencido') g.vencidos++;
      else g.vigentes++;
    });
    ['legado', 'nova', 'proposta'].forEach(function (k) {
      r[k].pct = r[k].total ? Math.round(r[k].finalizados / r[k].total * 100) : 0;
    });
    return r;
  }

  /** Convênios travados por cláusula suspensiva, com o prazo de resolução.
   *  Ordena pelos que vencem primeiro — é o que precisa de cobrança. */
  function travadosPorSuspensiva(convenios) {
    return (convenios || []).filter(function (c) {
      return REGEX_SUSPENSIVA.test(norm(c.sit_contrat_tgov));
    }).map(function (c) {
      var d = parseDateBR(c.vigencia_suspensiva);
      return { c: c, data: d, dias: d ? diasAte(d) : null };
    }).sort(function (a, b) {
      if (a.data && b.data) return a.data - b.data;
      return a.data ? -1 : 1;
    });
  }

  var REGEX_SUSPENSIVA = /clausula\s*suspensiva|liminar\s*judicial/;

  /* ── Indicador EX-01 (FiscalGov) ──────────────────────────────────────── */

  function temMedicao(c) {
    return String(c.medicao || c.col_p || '').trim().toUpperCase().indexOf('SIM') === 0;
  }
  function temPagamento(c) {
    return String(c.pagamento || c.col_q || '').trim().toUpperCase().indexOf('SIM') === 0;
  }
  /** Apto ao EX-01 = obra iniciada (tem medição ou pagamento) e não encerrado. */
  function isApto(c) {
    return !isFinalizado(c) && (temMedicao(c) || temPagamento(c));
  }
  /** Em projeto = vigente mas ainda sem medição nem pagamento. */
  function isProjeto(c) {
    return !isFinalizado(c) && !temMedicao(c) && !temPagamento(c);
  }
  /** Normaliza NFD antes de comparar: "NÃO" chega de formas diferentes. */
  function temFoto(c) {
    var v = String(c.foto_app || c.rel_fotografico || c.col_o || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    return v.indexOf('SIM') === 0;
  }

  /** Métricas agregadas do EX-01 sobre uma lista de convênios. */
  function resumoEX01(convenios) {
    var vigentes = (convenios || []).filter(function (c) { return !isFinalizado(c); });
    var aptos = vigentes.filter(isApto).length;
    var comFoto = vigentes.filter(function (c) { return isApto(c) && temFoto(c); }).length;
    return {
      vigentes: vigentes.length,
      emProjeto: vigentes.filter(isProjeto).length,
      aptos: aptos,
      comFoto: comFoto,
      semFoto: aptos - comFoto,
      pct: aptos > 0 ? Math.round(comFoto / aptos * 100) : 0
    };
  }

  /* ── Ingressos de recurso ─────────────────────────────────────────────── */

  /**
   * Normaliza o tipo de um ingresso.
   * O campo `tipo` foi gravado com dois vocabulários diferentes ao longo do
   * projeto e os dois convivem no dados.json:
   *   • classificar_e_migrar.py (planilha, formato triplete) → "F" / "C"
   *   • monitor_repasse.py (detecção automática)            → "federal" / "planilha"
   * Esta função entende os dois e devolve sempre "F" (federal — OB do SIAFI)
   * ou "C" (contrapartida — depósito do convenente).
   */
  function tipoIngresso(ing) {
    var t = norm(ing && ing.tipo);
    if (t === 'f' || t === 'federal') return 'F';
    if (t === 'c' || t === 'contrapartida') return 'C';
    // "planilha" e vazio = importado sem classificação → tratamos como federal,
    // que é a origem da esmagadora maioria dos ingressos.
    return 'F';
  }

  function rotuloTipoIngresso(ing) {
    return tipoIngresso(ing) === 'C' ? 'Contrapartida' : 'Federal';
  }

  /* ── DOM ───────────────────────────────────────────────────────────────── */

  function $(id) { return document.getElementById(id); }

  /** Escreve texto num elemento se ele existir (evita erro em página sem o id). */
  function setTxt(id, valor) {
    var el = $(id);
    if (el) el.textContent = valor;
    return el;
  }
  function setHtml(id, valor) {
    var el = $(id);
    if (el) el.innerHTML = valor;
    return el;
  }

  function esconderOverlay() {
    var el = $('overlay') || document.querySelector('.overlay');
    if (el) el.classList.add('hide');
  }

  /* ── TELA CHEIA ────────────────────────────────────────────────────────── */

  function toggleFullscreen(elOuId) {
    var el = typeof elOuId === 'string' ? $(elOuId) : elOuId;
    if (!el) return;
    var ativo = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
    if (!ativo) {
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
      if (req) req.call(el);
    } else {
      var sai = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
      if (sai) sai.call(document);
    }
  }

  /** Mantém o rótulo do botão coerente com o estado de tela cheia. */
  function ligarBotaoFullscreen(idBotao) {
    function sync() {
      var btn = $(idBotao);
      if (!btn) return;
      var ativo = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
      var html = ativo
        ? '<i class="fa-solid fa-compress"></i> Sair'
        : '<i class="fa-solid fa-expand"></i> Tela cheia';
      if (btn.innerHTML !== html) btn.innerHTML = html;
    }
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'].forEach(function (ev) {
      document.addEventListener(ev, sync);
    });
    sync();
  }

  /* ── TOAST ─────────────────────────────────────────────────────────────── */

  function toast(msg) {
    var t = $('copyToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'copyToast';
      t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);' +
        'bottom:calc(24px + env(safe-area-inset-bottom,0px));background:#0f1f3d;color:#fff;' +
        'padding:11px 18px;border-radius:10px;font-size:12.5px;z-index:9500;' +
        'box-shadow:0 8px 26px rgba(0,0,0,.4);opacity:0;transition:opacity .2s;' +
        'pointer-events:none;max-width:90vw;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () {
      t.style.opacity = '0';
      t.classList.remove('show');
    }, 2200);
  }

  function copiar(texto) {
    if (!texto || texto === '—') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { toast(texto + ' copiado!'); });
      return;
    }
    var el = document.createElement('textarea');
    el.value = texto;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); toast(texto + ' copiado!'); } catch (e) { /* ignora */ }
    document.body.removeChild(el);
  }

  /* ── EXPORTAÇÃO ────────────────────────────────────────────────────────── */

  /** Data de hoje no formato usado nos nomes de arquivo: DD-MM-AAAA. */
  function carimboData() {
    var d = new Date();
    return String(d.getDate()).padStart(2, '0') + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
  }

  /** Envolve a geração de um .xlsx com estado de "Gerando..." no botão. */
  function comBotaoOcupado(idBotao, htmlOriginal, tarefa) {
    var btn = $(idBotao);
    if (btn) {
      btn.classList.add('loading');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
    }
    setTimeout(function () {
      try {
        tarefa();
      } catch (e) {
        alert('Erro ao gerar o arquivo: ' + e.message);
      } finally {
        if (btn) {
          btn.classList.remove('loading');
          btn.innerHTML = htmlOriginal;
        }
      }
    }, 50);
  }

  /* ══════════════════════════════════════════════════════════════════════
     LEITURA DE TEXTO LONGO E TABELAS EM CARTÃO

     Os objetos dos convênios passam de 100 caracteres. As tabelas cortavam
     tudo numa linha, e o texto completo só aparecia no `title`, com o mouse
     em cima — ou seja, era inacessível no celular, que não tem hover.

     Duas funções resolvem isso para o painel inteiro, sem que cada página
     precise se preocupar:
       • ligarTextosExpansiveis — um toque abre o texto ali mesmo;
       • rotularTabelas — copia o cabeçalho da coluna para cada célula, que é
         o que permite à tabela virar cartão legível no celular (ver app.css).
     ══════════════════════════════════════════════════════════════════════ */

  /**
   * Marca quais elementos .txt-exp realmente têm texto escondido.
   * Sem essa medição, a setinha apareceria em textos curtos também —
   * prometendo um conteúdo que não existe.
   */
  function medirTextos(raiz) {
    (raiz || document).querySelectorAll('.txt-exp').forEach(function (el) {
      if (el.classList.contains('aberto')) return;
      var cortado = el.scrollHeight > el.clientHeight + 1;
      el.setAttribute('data-cortado', cortado ? '1' : '0');
      if (cortado && !el.getAttribute('title')) {
        // Mantemos o title como reforço no desktop, mas ele deixou de ser
        // o único caminho: o toque abre o texto em qualquer aparelho.
        el.setAttribute('title', 'Toque para ler o texto completo');
      }
    });
  }

  /** Um clique/toque em .txt-exp abre ou fecha o texto completo. */
  function ligarTextosExpansiveis() {
    document.addEventListener('click', function (ev) {
      var alvo = ev.target.closest && ev.target.closest('.txt-exp');
      if (!alvo) return;

      // Medimos na hora do clique, sempre. A medida guardada pode ter ficado
      // velha — a coluna muda de largura ao recolher o menu, ao girar o
      // celular ou quando a fonte termina de carregar. Uma leitura a mais é
      // barata; um toque que não faz nada é péssimo.
      if (!alvo.classList.contains('aberto')) {
        alvo.setAttribute('data-cortado',
          alvo.scrollHeight > alvo.clientHeight + 1 ? '1' : '0');
        if (alvo.getAttribute('data-cortado') !== '1') return;
      }

      // Não deixa o clique subir para a linha da tabela: em vigencias.html e
      // ingressos.html a linha inteira abre um painel de detalhe, e as duas
      // coisas disparando juntas confundem.
      ev.stopPropagation();
      alvo.classList.toggle('aberto');
    }, true);

    // Recalcula quando a largura muda. Usamos ResizeObserver, não o evento
    // 'resize' da janela: recolher o menu lateral, girar o celular ou o
    // carregamento tardio da fonte mudam a largura da coluna SEM que a janela
    // mude de tamanho — e nesses casos a setinha ficaria mentindo.
    var alvoMedida = document.querySelector('.scroll') || document.body;
    var t;
    function remedir() {
      clearTimeout(t);
      t = setTimeout(function () { medirTextos(alvoMedida); }, 150);
    }
    if (window.ResizeObserver) {
      new ResizeObserver(remedir).observe(alvoMedida);
    } else {
      window.addEventListener('resize', remedir);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remedir);

    // Nem todo texto longo está numa tabela — a lista "Últimos ingressos" e os
    // painéis laterais também têm. Observamos a área de conteúdo inteira para
    // que qualquer bloco recém-renderizado ganhe a setinha de "abre aqui".
    var area = document.querySelector('.scroll') || document.body;
    var t2;
    new MutationObserver(function () {
      clearTimeout(t2);
      t2 = setTimeout(function () { medirTextos(area); }, 80);
    }).observe(area, { childList: true, subtree: true });
  }

  /**
   * Copia o texto de cada <th> para o data-rotulo das células da coluna.
   * É o que faz a tabela virar cartão no celular sem repetir os nomes das
   * colunas em cada página. Continua valendo depois de cada novo render,
   * porque observamos o <tbody>.
   */
  function rotularTabelas(seletor) {
    var tabelas = document.querySelectorAll(seletor || 'table.tbl-cards');

    tabelas.forEach(function (tab) {
      var corpo = tab.querySelector('tbody');
      if (!corpo) return;

      function carimbar() {
        var titulos = Array.prototype.map.call(
          tab.querySelectorAll('thead th'),
          function (th) {
            // Copiamos o cabeçalho sem os enfeites: o ícone de ajuda (.th-info)
            // e as setas de ordenação viram lixo quando o texto vira rótulo de
            // campo no cartão ("Suspensiva ℹ" em vez de "Suspensiva").
            var limpo = th.cloneNode(true);
            limpo.querySelectorAll('.th-info, .sort-ind, i').forEach(function (e) { e.remove(); });
            return limpo.textContent.replace(/\s+/g, ' ').trim();
          }
        );

        Array.prototype.forEach.call(corpo.rows, function (linha) {
          // Linhas de detalhe e mensagens de vazio usam colspan: não são
          // campos de um registro, não recebem rótulo.
          if (linha.cells.length === 1 && linha.cells[0].hasAttribute('colspan')) return;

          Array.prototype.forEach.call(linha.cells, function (celula, i) {
            if (celula.hasAttribute('data-rotulo')) return;
            celula.setAttribute('data-rotulo', titulos[i] || '');
          });
        });

        medirTextos(corpo);
      }

      carimbar();
      new MutationObserver(carimbar).observe(corpo, { childList: true });
    });
  }

  function iniciarLeitura() {
    ligarTextosExpansiveis();
    rotularTabelas();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarLeitura);
  } else {
    iniciarLeitura();
  }

  /* ── EXPORTA ───────────────────────────────────────────────────────────── */
  IDEPI.medirTextos = medirTextos;
  IDEPI.rotularTabelas = rotularTabelas;
  IDEPI.parseDateBR = parseDateBR;
  IDEPI.parseDate = parseDateBR;      // alias usado por vigencias.html
  IDEPI.hoje = hoje;
  IDEPI.diasAte = diasAte;
  IDEPI.diasAtras = diasAtras;
  IDEPI.norm = norm;
  IDEPI.esc = esc;
  IDEPI.parseReais = parseReais;
  IDEPI.fmtNum = fmtNum;
  IDEPI.fmtReais = fmtReais;
  IDEPI.fmtCompacto = fmtCompacto;
  IDEPI.REGEX_FIN = REGEX_FIN;
  IDEPI.isFinalizado = isFinalizado;
  IDEPI.aguardaPrestacao = aguardaPrestacao;
  IDEPI.calcStatus = calcStatus;
  IDEPI.gestaoDe = gestaoDe;
  IDEPI.resumoGestao = resumoGestao;
  IDEPI.travadosPorSuspensiva = travadosPorSuspensiva;
  IDEPI.temMedicao = temMedicao;
  IDEPI.temPagamento = temPagamento;
  IDEPI.isApto = isApto;
  IDEPI.isProjeto = isProjeto;
  IDEPI.temFoto = temFoto;
  IDEPI.resumoEX01 = resumoEX01;
  IDEPI.tipoIngresso = tipoIngresso;
  IDEPI.rotuloTipoIngresso = rotuloTipoIngresso;
  IDEPI.$ = $;
  IDEPI.setTxt = setTxt;
  IDEPI.setHtml = setHtml;
  IDEPI.esconderOverlay = esconderOverlay;
  IDEPI.toggleFullscreen = toggleFullscreen;
  IDEPI.ligarBotaoFullscreen = ligarBotaoFullscreen;
  IDEPI.toast = toast;
  IDEPI.copiar = copiar;
  IDEPI.carimboData = carimboData;
  IDEPI.comBotaoOcupado = comBotaoOcupado;

  /* Rótulos e cores de status — usados por mais de uma página */
  IDEPI.NOME_ST = { normal: 'Normal', alerta: 'Alerta', atencao: 'Atenção', critico: 'Crítico', vencido: 'Vencido', finalizado: 'Finalizado', sem_data: 'Sem data' };
  IDEPI.COR_ST = { normal: '#22c55e', alerta: '#3b82f6', atencao: '#eab308', critico: '#f97316', vencido: '#ef4444', finalizado: '#94a3b8', sem_data: '#a78bfa' };

})(window);
