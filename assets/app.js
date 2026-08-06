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

    /* A vigência da Emendas Senador entra como RESERVA, nunca por cima da
       CGU. Proposta ainda não celebrada não existe para a CGU, então o
       main.py grava vazio — mas o setor já definiu o prazo (os cinco
       pré-instrumentos terminam em 31/12/2029). Sem isso eles apareciam como
       "sem data" tendo prazo, SEI e fiscal (04/08/2026). */
    var dVig = parseDateBR(c.vigencia_fmt || c.vigencia) ||
               parseDateBR(c.vigencia_emendas);
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

  /* ── Fase pela planilha Emendas Senador (coluna V) ────────────────────────
     O setor pinta a linha da Emendas para marcar em que pé está a obra. A cor
     vira texto na coluna V e chega aqui como `fase_emendas`.

     É PROPOSITALMENTE independente do Transferegov: a Emendas reflete o
     acompanhamento interno, que anda em ritmo próprio. Onde as duas
     divergirem, é informação, não erro.

     A cor NUNCA é o único sinal: cada fase tem também rótulo e sigla. Tela de
     toque não tem hover (lição de 27/07/2026), e verde/vermelho é o par que
     mais exclui quem não distingue cor. */
  var FASES = {
    recurso: { rotulo: 'Recurso recebido', sigla: 'R', cor: '#16a34a',
               desc: 'Já entrou repasse federal na conta do instrumento' },
    projeto: { rotulo: 'Projeto aprovado', sigla: 'P', cor: '#eab308',
               desc: 'Contratado e sem cláusula suspensiva — o projeto passou, ' +
                     'mas ainda não entrou recurso' },
    suspensiva: { rotulo: 'Em cláusula suspensiva', sigla: 'S', cor: '#f97316',
               desc: 'Contratado, mas travado por cláusula suspensiva e ainda ' +
                     'sem recurso' },
    proposta: { rotulo: 'Proposta não assinada', sigla: 'N', cor: '#a78bfa',
               desc: 'Ainda não virou instrumento: não há prazo correndo' },
    arquivado: { rotulo: 'Arquivado', sigla: 'X', cor: '#ef4444',
               desc: 'Não segue adiante (linha vermelha na Emendas Senador)' }
  };

  var ORDEM_FASE = ['proposta', 'suspensiva', 'projeto', 'recurso'];

  /** Fase DERIVADA do que o próprio painel já sabe.
   *
   *  Antes vinha da cor que o setor pinta na Emendas (coluna V). Trocamos em
   *  04/08/2026 por dois motivos: a aba de 2022 não usa o amarelo, então os
   *  40 do legado ficavam todos como "em andamento" mesmo tendo projeto
   *  aprovado; e o que de fato comprova a aprovação do projeto é a SAÍDA da
   *  cláusula suspensiva, que o sistema já lê do Transferegov.
   *
   *  ⚠️  Não é uma escada rígida. Recurso pode entrar ANTES de a suspensiva
   *  sair — acontece hoje no 992850 (Belém) e no 992940 (Curral Novo). Por
   *  isso o dinheiro é verificado primeiro: é o fato mais forte, e quem quer
   *  saber da cláusula tem a tag e o card próprios no Painel Geral.
   *
   *  @returns {{chave,sigla,cor,desc,rotulo}|null} */
  function faseDe(c) {
    if (!c) return null;
    var chave;

    if (norm(c.fase_emendas).indexOf('arquivad') !== -1) {
      chave = 'arquivado';
    } else if (!parseDateBR(c.vigencia_inicio)) {
      chave = 'proposta';                       // sem início: nem assinado
    } else if (liberadoDe(c) > 0) {
      chave = 'recurso';                        // dinheiro em conta vence tudo
    } else if (REGEX_SUSPENSIVA.test(norm(c.sit_contrat_tgov))) {
      chave = 'suspensiva';
    } else {
      chave = 'projeto';
    }

    var f = FASES[chave];
    return { chave: chave, sigla: f.sigla, cor: f.cor,
             desc: f.desc, rotulo: f.rotulo };
  }

  /** Faixa lateral fina + rótulo acessível. Fundo pintado brigaria com o
   *  texto e com as cores de status que os cards já usam. */
  function faixaFase(c) {
    var f = faseDe(c);
    if (!f) return '';
    return '<span class="fase-faixa fase-' + f.chave + '" title="' +
           esc(f.rotulo + ' — ' + f.desc) + '" aria-label="' + esc(f.rotulo) +
           '"><span class="sr-only">' + esc(f.rotulo) + '</span></span>';
  }

  /** Município entre parênteses, quando o objeto não o nomeia.
   *
   *  Parte dos objetos da CGU não diz a cidade — o 988901 é só "PAVIMENTAÇÃO
   *  DE ESTRADAS VICINAIS" e fica em Paulistana. O nome vem do controle do
   *  setor (planilha Emendas), NÃO da CGU nem do Transferegov: por isso sai
   *  entre parênteses e em estilo próprio, separado do objeto, em vez de ser
   *  emendado ao texto como se fosse oficial.
   *
   *  Se o objeto já cita a cidade, não repete. */
  function municipioExtra(c) {
    var m = String((c && c.municipio_emendas) || '').trim();
    if (!m) return '';

    /* Obra multimunicípio traz a lista inteira: o 894024 tem 24 cidades e,
       inteiro, arrebentava a largura da coluna (04/08/2026). Mostra as duas
       primeiras e conta o resto; a lista completa fica no balão. */
    var partes = m.split(/\s*,\s*/).filter(Boolean);
    var curto = m;
    if (partes.length > 2) {
      curto = partes.slice(0, 2).join(', ') + ' +' + (partes.length - 2);
    }

    /* Se o objeto já cita a (primeira) cidade, não repete. */
    var obj = norm(c.objeto);
    var alvo = norm(partes[0] || '')
      .replace(/[-–/]\s*pi\.?$/, '').trim();
    if (alvo && partes.length === 1 && obj.indexOf(alvo) !== -1) return '';

    var titulo = (partes.length > 2 ? partes.length + ' municípios: ' + m : m) +
      ' — conforme o controle do setor (planilha Emendas Senador); não consta ' +
      'do objeto oficial';
    return ' <span class="muni-extra" title="' + esc(titulo) + '">(' +
           esc(curto) + ')</span>';
  }

  /** Legenda — obrigatória, porque no celular o balão de hover não existe.
   *  Segue ORDEM_FASE (do mais atrasado ao mais adiantado); "arquivado" fica
   *  de fora porque instrumento arquivado nem entra na coluna A. */
  function legendaFases() {
    return ORDEM_FASE.map(function (k) {
      var f = FASES[k];
      return '<span class="fase-leg" title="' + esc(f.desc) + '">' +
             '<i class="fase-faixa fase-' + k + '"></i>' + esc(f.rotulo) + '</span>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════════════════
     QUANTO JÁ ENTROU — fonte única

     REGRA DO PROJETO: o TRANSFEREGOV é a fonte de verdade; a CGU é a cômoda.
     A CGU atrasa semanas e às vezes não publica (em 04/08/2026 dava R$ 2,375
     mi ao 969555 contra R$ 2,625 mi reais). Vale para TUDO que envolva
     dinheiro recebido, não só para um card.

     Ordem de preferência:
       1. ingressos tipo "F" do `historico_repasses` — vêm do Transferegov e
          a varredura das 08:30 atualiza todo dia útil;
       2. `v_liberado` da CGU — só quando não há histórico do convênio.

     O histórico é guardado aqui uma vez (IDEPI.usarHistorico) para que
     nenhuma tela precise passá-lo em cada chamada — passar à mão foi como o
     mesmo convênio já apareceu com dois números em telas diferentes.
     ══════════════════════════════════════════════════════════════════════ */

  var _historico = {};

  /** Chame uma vez, ao carregar os dados. */
  function usarHistorico(h) { _historico = h || {}; }

  /** Soma dos ingressos de um tipo ('F' federal, 'C' contrapartida). */
  function somaIngressos(numero, tipo) {
    var h = _historico[numero];
    if (!h || !Array.isArray(h.ingressos) || !h.ingressos.length) return null;
    var t = String(tipo).toUpperCase(), s = 0;
    h.ingressos.forEach(function (i) {
      if (String(i && i.tipo || '').toUpperCase() === t) s += parseReais(i.valor);
    });
    return s;
  }

  /** Repasse FEDERAL já recebido. Transferegov primeiro, CGU como reserva. */
  function liberadoDe(c) {
    if (!c) return 0;
    var doTgov = somaIngressos(c.numero, 'F');
    return doTgov === null ? parseReais(c.v_liberado) : doTgov;
  }

  /** Contrapartida já depositada. Só existe no histórico. */
  function contrapartidaRecebidaDe(c) {
    return c ? (somaIngressos(c.numero, 'C') || 0) : 0;
  }

  /* ── Processos SEI ────────────────────────────────────────────────────── */

  /** Todos os processos SEI do convênio, do mais antigo ao mais recente.
   *
   *  O setor acumula processos na mesma célula da Emendas Senador (19 casos
   *  hoje), separados por quebra de linha, barra ou só espaços. O ÚLTIMO é o
   *  vigente; os anteriores continuam servindo para consulta, então são
   *  guardados em vez de descartados. */
  var RE_SEI = /\d{5}\.\d{6}\/\d{4}-\d{2}/g;

  function seisDe(c) {
    if (!c) return [];
    var achados = String(c.sei_todos || '').match(RE_SEI) || [];
    var manual = String(c.sei || '').trim();
    /* O que está na coluna N (manual) vale como o vigente: quem digitou ali
       pode saber de algo que a Emendas não registrou. Por isso ele vai para o
       fim da lista, mesmo que a Emendas tenha outro. */
    if (manual && achados.indexOf(manual) === -1) achados = achados.concat(manual);
    else if (manual && achados[achados.length - 1] !== manual) {
      achados = achados.filter(function (x) { return x !== manual; }).concat(manual);
    }
    return achados;
  }

  /** O processo vigente — o último da lista. */
  function seiVigenteDe(c) {
    var l = seisDe(c);
    return l.length ? l[l.length - 1] : '';
  }

  /* ── Contrapartida ────────────────────────────────────────────────────── */

  /** Situação da contrapartida de UM convênio.
   *
   *  Dois números que vêm de fontes diferentes:
   *    • previsto   — `valorContrapartida` da CGU, no documento de vigências
   *    • depositado — soma dos ingressos tipo "C" no histórico de repasses
   *
   *  Nem todo convênio tem contrapartida (23 dos 99 não têm). Para esses a
   *  função devolve `previsto: 0` e `situacao: 'sem'` — não é pendência, é
   *  ausência de obrigação, e tratar como pendência encheria o painel de
   *  alarme falso.
   *
   *  @param historico  o `historico_repasses` inteiro (mapa por número)
   *  @returns {{previsto,depositado,falta,pct,situacao}}
   *           situacao ∈ sem | quitada | parcial | nada
   */
  function contrapartidaDe(c) {
    var previsto = parseReais(c && c.v_contrapartida);
    var depositado = contrapartidaRecebidaDe(c);

    if (previsto <= 0) {
      return { previsto: 0, depositado: depositado, falta: 0, pct: 100,
               situacao: 'sem' };
    }
    /* Um centavo de folga: previsto e depositado vêm de fontes distintas e
       divergem no arredondamento — sem isso, convênio quitado aparecia
       devendo R$ 0,004. */
    var falta = Math.max(0, previsto - depositado);
    var situacao = falta <= 0.01 ? 'quitada' : (depositado > 0 ? 'parcial' : 'nada');
    return {
      previsto: previsto, depositado: depositado, falta: falta,
      pct: Math.min(100, Math.round(depositado / previsto * 100)),
      situacao: situacao
    };
  }

  /** Repasse FEDERAL que a União ainda não liberou.
   *
   *  previsto = `v_total`, que é o `valorTotalConvenio` da CGU. NÃO subtraia a
   *  contrapartida dele: conferido em 04/08/2026 contra o `valor_repasse` que
   *  o exec_financeiro coleta do Transferegov, os dois batem ao centavo em
   *  953168 (240.000.000,00), 973618 (156.180.000,00) e 992850
   *  (4.880.521,26) — ou seja, esse campo da CGU já é só a parte federal.
   *  Quem inclui a contrapartida é o `valor_global` do Transferegov, que o
   *  painel não usa.
   *
   *  liberado = soma dos ingressos tipo "F" do `historico_repasses`. Esta é a
   *  fonte mais atual que existe: vem do TRANSFEREGOV e a varredura das 08:30
   *  a atualiza todo dia útil. A CGU é a cômoda, não a correta — em
   *  04/08/2026 ela dava R$ 2,375 mi ao 969555 contra R$ 2,625 mi reais, e o
   *  `repasse_desembolsado` da execução financeira estava de 15/07, dizendo
   *  R$ 100,65 mi ao 953168 contra R$ 116,65 mi. Sem histórico para o
   *  convênio, cai no `v_liberado` da CGU.
   *
   *  Convênio FINALIZADO fica de fora: o que não veio até o fim não vem mais,
   *  e listá-lo como pendência transformaria histórico em cobrança.
   */
  function repasseDe(c) {
    var previsto = parseReais(c && c.v_total);
    var liberado = liberadoDe(c);

    if (previsto <= 0) {
      return { previsto: 0, liberado: liberado, falta: 0, pct: 100,
               situacao: 'sem' };
    }
    var falta = Math.max(0, previsto - liberado);
    /* Um real de folga: total e liberado vêm de campos distintos da CGU e
       divergem em centavos por arredondamento. */
    var situacao = falta <= 1 ? 'quitado' : (liberado > 0 ? 'parcial' : 'nada');
    return {
      previsto: previsto, liberado: liberado, falta: falta,
      pct: Math.min(100, Math.round(liberado / previsto * 100)),
      situacao: situacao
    };
  }

  /** Quem ainda tem repasse federal a receber, do maior saldo para o menor. */
  function repassesPendentes(convenios) {
    return (convenios || []).map(function (c) {
      return { c: c, rp: repasseDe(c) };
    }).filter(function (x) {
      if (calcStatus(x.c).st === 'finalizado') return false;
      return x.rp.situacao === 'parcial' || x.rp.situacao === 'nada';
    }).sort(function (a, b) { return b.rp.falta - a.rp.falta; });
  }

  function resumoRepasse(convenios) {
    var r = { sem: 0, quitado: 0, parcial: 0, nada: 0, falta: 0, previsto: 0,
              liberado: 0 };
    (convenios || []).forEach(function (c) {
      var rp = repasseDe(c);
      r[rp.situacao]++;
      r.previsto += rp.previsto;
      r.liberado += rp.liberado;
      if (calcStatus(c).st !== 'finalizado') r.falta += rp.falta;
    });
    return r;
  }

  /** Quem ainda deve contrapartida, do maior débito para o menor. */
  function contrapartidasPendentes(convenios) {
    return (convenios || []).map(function (c) {
      return { c: c, cp: contrapartidaDe(c) };
    }).filter(function (x) {
      return x.cp.situacao === 'parcial' || x.cp.situacao === 'nada';
    }).sort(function (a, b) { return b.cp.falta - a.cp.falta; });
  }

  /** Contagem por situação, para os cartões de resumo. */
  function resumoContrapartida(convenios) {
    var r = { sem: 0, quitada: 0, parcial: 0, nada: 0, falta: 0, previsto: 0 };
    (convenios || []).forEach(function (c) {
      var cp = contrapartidaDe(c);
      r[cp.situacao]++;
      r.falta += cp.falta;
      r.previsto += cp.previsto;
    });
    r.comObrigacao = r.quitada + r.parcial + r.nada;
    return r;
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
  /** Movimentação CANCELADA não é dinheiro que saiu — fica fora de toda soma.
   *  Ela continua aparecendo na LISTA, com a situação à vista; o que não pode
   *  é entrar em total. Descoberto em 05/08/2026: no 838065 a soma das linhas
   *  de tributo passava R$ 2.851,20 do (bruto − líquido) dos pagamentos, e
   *  esses R$ 2.851,20 eram exatamente a única linha cancelada da tela. */
  function movCancelada(m) {
    return /cancel/i.test(String((m && m.situacao) || ''));
  }
  /* ── PARADA: quanto tempo sem execução financeira ───────────────────────
   *  Os prazos não são estéticos, são exigência do concedente/mandatária:
   *    90 dias  → justificativa obrigatória
   *    180 dias → nova justificativa
   *    360 dias → risco de perda do convênio (nunca aconteceu até 2026)
   *  A data vem de `ultima_mov` no painel/exec_index, que é o último
   *  PAGAMENTO — ingresso e aplicação não são execução. */
  var FAIXAS_PARADA = [
    { id: 'risco',    dias: 360, rotulo: 'Risco de perda',   cor: '#ef4444' },
    { id: 'grave',    dias: 180, rotulo: '2ª justificativa', cor: '#f97316' },
    { id: 'justifica',dias:  90, rotulo: 'Justificativa',    cor: '#eab308' },
    { id: 'ok',       dias:   0, rotulo: 'Em dia',           cor: '#22c55e' }
  ];

  /** {dias, faixa, data} do instrumento, ou null quando não se aplica.
   *  Instrumento encerrado ou que nunca movimentou não entra: parada
   *  pressupõe execução em curso que parou. */
  function paradaDe(c) {
    if (!c || isFinalizado(c)) return null;
    var data = c.ultima_mov || '';
    if (!data) return null;
    var d = parseDateBR(data);
    if (!d) return null;
    /* NÃO usar diasAtras(): ela devolve TEXTO ("há 1476 dias"), para legenda.
       Comparar esse texto com 90 dá sempre falso e todo mundo aparece "em dia"
       — foi o que aconteceu na primeira versão deste card. */
    var dias = -diasAte(d);
    if (dias === null || isNaN(dias) || dias < 0) return null;
    var faixa = FAIXAS_PARADA[FAIXAS_PARADA.length - 1];
    for (var i = 0; i < FAIXAS_PARADA.length; i++) {
      if (dias >= FAIXAS_PARADA[i].dias) { faixa = FAIXAS_PARADA[i]; break; }
    }
    return { dias: dias, faixa: faixa, data: data };
  }

  /** Os parados há 90 dias ou mais, do mais antigo para o mais recente. */
  function paradosSemExecucao(lista) {
    return (lista || []).map(function (c) {
      var p = paradaDe(c);
      return p ? { c: c, dias: p.dias, faixa: p.faixa, data: p.data } : null;
    }).filter(function (x) {
      return x && x.faixa.id !== 'ok';
    }).sort(function (a, b) { return b.dias - a.dias; });
  }

  /** Contagem por faixa, para os cartões do topo. */
  function resumoParada(lista) {
    var r = { ok: 0, justifica: 0, grave: 0, risco: 0, sem_dado: 0 };
    (lista || []).forEach(function (c) {
      var p = paradaDe(c);
      if (!p) { r.sem_dado++; return; }
      r[p.faixa.id]++;
    });
    return r;
  }
  /* ── EX-01: de quem SE COBRA relatório fotográfico ──────────────────────
   *  Em 06/08/2026 a SEPLAN cobrou 29 instrumentos e o setor devolveu dois
   *  que não cabiam: o 907038 ainda não tem AIO (obra não começou) e o
   *  907033 não tem AIO nem recurso federal. Cobrar foto de obra que não
   *  começou gasta o crédito do indicador — e o painel tem como saber.
   *
   *  Dois filtros, nesta ordem:
   *    1. sem recurso federal recebido → não se aplica;
   *    2. recurso recebido mas obra não iniciada → ainda não se aplica.
   *
   *  "Obra iniciada" sai da execução coletada (pagamento, nota fiscal ou
   *  execução física > 0) e, na falta dela, das colunas manuais da planilha.
   *  A coleta é mais confiável: coluna manual não se atualiza sozinha. */
  function obraIniciada(c) {
    if (!c) return false;
    if ((c.qtd_mov || 0) > 0 || (c.qtd_nf || 0) > 0) return true;
    if (parseFloat(c.exec_fisica_pct || 0) > 0) return true;
    /* Sem dado de execução no índice, cai no que a planilha diz. */
    if (c.qtd_mov === undefined && c.qtd_nf === undefined) {
      return temMedicao(c) || temPagamento(c);
    }
    return false;
  }

  /** Por que o EX-01 não se aplica a este instrumento — ou null se se aplica.
   *
   *  ATENÇÃO — só o filtro de RECURSO está ativo. O de "obra não iniciada"
   *  ficou desligado em 06/08/2026: usá-lo como proxy da AIO estava errado.
   *  O 907035 e o 907015 já têm AIO e recurso, logo já devem ter foto, mas
   *  como ainda não pagaram nada o proxy os excluía — o painel deixaria de
   *  cobrar quem tem obrigação. Errar para o lado de cobrar a mais é menos
   *  grave do que dispensar quem deve.
   *
   *  A AIO de verdade está no Transferegov em Instrumentos Contratuais >
   *  Detalhar > Checklist, e a coleta ainda não a lê. Quando ler, este filtro
   *  volta usando o dado, não a inferência. */
  function motivoNaoAplica(c) {
    if (!c || isFinalizado(c)) return null;
    if (!(liberadoDe(c) > 0)) return 'sem_recurso';
    if (c.tem_aio === false)  return 'sem_aio';   // só quando a coleta souber
    return null;
  }
  var ROTULO_NAO_APLICA = {
    sem_recurso: 'Sem recurso federal recebido',
    sem_aio:     'Sem AIO emitida'
  };

  /** Apto ao EX-01 = vigente, com recurso recebido e obra iniciada. */
  function isApto(c) {
    return !isFinalizado(c) && motivoNaoAplica(c) === null;
  }
  /** Em projeto = vigente e ainda não apto (sem recurso ou sem início). */
  function isProjeto(c) {
    return !isFinalizado(c) && motivoNaoAplica(c) !== null;
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
    var semRecurso = 0, semInicio = 0;
    vigentes.forEach(function (c) {
      var m = motivoNaoAplica(c);
      if (m === 'sem_recurso') semRecurso++;
      else if (m === 'sem_aio') semInicio++;
    });
    return {
      vigentes: vigentes.length,
      emProjeto: vigentes.filter(isProjeto).length,
      semRecurso: semRecurso,
      semInicio: semInicio,
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
  IDEPI.faseDe = faseDe;
  IDEPI.municipioExtra = municipioExtra;
  IDEPI.seisDe = seisDe;
  IDEPI.seiVigenteDe = seiVigenteDe;
  IDEPI.usarHistorico = usarHistorico;
  IDEPI.liberadoDe = liberadoDe;
  IDEPI.contrapartidaRecebidaDe = contrapartidaRecebidaDe;
  IDEPI.repasseDe = repasseDe;
  IDEPI.repassesPendentes = repassesPendentes;
  IDEPI.resumoRepasse = resumoRepasse;
  IDEPI.contrapartidaDe = contrapartidaDe;
  IDEPI.contrapartidasPendentes = contrapartidasPendentes;
  IDEPI.resumoContrapartida = resumoContrapartida;
  IDEPI.faixaFase = faixaFase;
  IDEPI.legendaFases = legendaFases;
  IDEPI.FASES = FASES;
  IDEPI.gestaoDe = gestaoDe;
  IDEPI.resumoGestao = resumoGestao;
  IDEPI.travadosPorSuspensiva = travadosPorSuspensiva;
  IDEPI.temMedicao = temMedicao;
  IDEPI.temPagamento = temPagamento;
  IDEPI.movCancelada = movCancelada;
  IDEPI.FAIXAS_PARADA = FAIXAS_PARADA;
  IDEPI.paradaDe = paradaDe;
  IDEPI.paradosSemExecucao = paradosSemExecucao;
  IDEPI.resumoParada = resumoParada;
  IDEPI.obraIniciada = obraIniciada;
  IDEPI.motivoNaoAplica = motivoNaoAplica;
  IDEPI.ROTULO_NAO_APLICA = ROTULO_NAO_APLICA;
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
