/* ═══════════════════════════════════════════════════════════════════════════
   IDEPI · sobre.js — o balão "o que é esta página"

   Pedido do Ruan em 30/09/2026, olhando a página de Ingressos: ele não
   lembrava por que ela mostrava menos que 107, e a página não dizia. A
   resposta existia (ela não filtra; o número grande é quem tem ao menos um
   ingresso), só não estava escrita em lugar nenhum.

   Um botão ⓘ ao lado do título abre um balão preso a ele. Sempre na mesma
   ordem: o que a página mostra, quem entra (com NÚMERO), de onde vêm os
   dados e o que significa cada card.

   Três regras que não se negociam:
   1. Os números saem dos MESMOS dados e das MESMAS funções do app.js que a
      tela usa, calculados na hora em que o balão abre. Número escrito à mão
      aqui envelhece na primeira segunda-feira.
   2. Um componente só, para todas as páginas. A página não escreve HTML de
      balão; ela só existe na tabela PAGINAS abaixo.
   3. Pendura em `document.fullscreenElement || document.body`, fecha no X,
      no clique fora e no Esc, e só fecha na rolagem que for FORA dele
      (CLAUDE.md, seção 9: as duas armadilhas já foram pagas no balão de
      empresa).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var IDEPI = window.IDEPI = window.IDEPI || {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function n(x) { return Number(x || 0).toLocaleString('pt-BR'); }

  /* ── Fontes de dados: as mesmas promessas que a página já usou ─────────── */
  function dados()  { return IDEPI.dados.carregar(); }
  function convs()  { return dados().then(function (j) { return j.convenios || []; }); }
  function contarStatus(cv) {
    var r = {};
    cv.forEach(function (c) { var s = IDEPI.calcStatus(c).st; r[s] = (r[s] || 0) + 1; });
    return r;
  }
  function contarOrgao(cv) {
    var r = {};
    cv.forEach(function (c) { var o = IDEPI.orgaoExecutorDe(c).rotulo; r[o] = (r[o] || 0) + 1; });
    return Object.keys(r).sort(function (a, b) { return r[b] - r[a]; })
      .map(function (k) { return k + ' ' + r[k]; }).join(' · ');
  }
  function linhaStatus(st) {
    var nomes = IDEPI.NOME_ST || {};
    return ['normal', 'alerta', 'atencao', 'critico', 'vencido', 'finalizado', 'sem_data']
      .filter(function (k) { return st[k]; })
      .map(function (k) { return (nomes[k] || k) + ' ' + st[k]; }).join(' · ');
  }

  var FONTE_VIGENCIAS =
    'Planilha de vigências (coluna A decide quem entra), completada pela CGU, ' +
    'pelo Transferegov e pela planilha Emendas Senador. Atualiza toda segunda na ' +
    'rotina semanal e, nos dias úteis, na varredura das 08:30.';

  /* ── O conteúdo de cada página ───────────────────────────────────────────
     numeros(): Promise de uma lista de frases (texto puro, será escapado). */
  var PAGINAS = {
    index: {
      oque: 'A visão de conjunto da carteira: prazos, legado e nova gestão, o que ' +
            'está travado, o que está parado, o dinheiro a receber e o EX-01. Cada ' +
            'bloco leva ao painel que detalha aquele assunto.',
      fonte: FONTE_VIGENCIAS,
      cards: [
        ['Normal, Alerta, Atenção, Crítico', 'dias até o fim da vigência: mais de 90, 60 a 90, 30 a 60, menos de 30. Com cláusula suspensiva, vale a data dela se for antes.'],
        ['Vencido', 'a vigência acabou e a prestação de contas não foi entregue.'],
        ['Finalizado', 'prestação de contas entregue, ou instrumento encerrado, rescindido ou anulado.'],
        ['Sem data', 'proposta ainda não assinada, sem vigência em fonte nenhuma.'],
        ['Legado e nova gestão', 'pela data de início da vigência: até 31/12/2022 é legado, de 01/01/2023 em diante é nova gestão.'],
        ['Sem execução financeira', 'dias sem movimentação: 90 pede justificativa ao concedente, 180 nova justificativa, 360 é risco de perder o convênio.']
      ],
      numeros: function () {
        return convs().then(function (cv) {
          var g = IDEPI.resumoGestao(cv);
          return [
            n(cv.length) + ' instrumentos: todos os da coluna A da planilha de vigências. Não há filtro nesta página.',
            'Por prazo: ' + linhaStatus(contarStatus(cv)) + '.',
            'Legado ' + g.legado.total + ' · nova gestão ' + g.nova.total +
              (g.proposta.total ? ' · propostas ' + g.proposta.total : '') + '.',
            'Por órgão executor: ' + contarOrgao(cv) + '.'
          ];
        });
      }
    },

    vigencias: {
      oque: 'A tabela completa dos instrumentos, com prazo, valores, SEI e fiscal. ' +
            'Os cards do topo filtram a tabela pelo prazo; os filtros e a busca ' +
            'combinam entre si, e o Excel exporta o que está filtrado.',
      fonte: FONTE_VIGENCIAS,
      cards: [
        ['Normal', 'mais de 90 dias até o fim da vigência.'],
        ['Alerta', 'de 60 a 90 dias.'],
        ['Atenção', 'de 30 a 60 dias.'],
        ['Crítico', 'menos de 30 dias. É o que pede aditivo de prazo com urgência.'],
        ['Vencido', 'a vigência acabou e a prestação de contas não foi entregue.'],
        ['Finalizado', 'prestação de contas entregue, ou encerrado, rescindido ou anulado.'],
        ['Suspensiva', 'quando há cláusula suspensiva com data antes da vigência, o prazo contado é o dela.']
      ],
      numeros: function () {
        return convs().then(function (cv) {
          return [
            n(cv.length) + ' instrumentos: todos os da coluna A da planilha de vigências.',
            'Por prazo: ' + linhaStatus(contarStatus(cv)) + '.',
            n(IDEPI.travadosPorSuspensiva(cv).length) + ' com cláusula suspensiva ativa.'
          ];
        });
      }
    },

    instrumentos: {
      oque: 'Todos os instrumentos numa lista só, em ordem de número e sem ' +
            'separar por prazo. Os filtros e a busca combinam entre si; o número ' +
            'abre a página do instrumento. O Excel sai com o que está na tela, na ' +
            'mesma ordem, e traz uma aba dizendo quais filtros estavam ligados.',
      fonte: FONTE_VIGENCIAS,
      cards: [
        ['Filtros', 'dá para marcar várias opções no mesmo filtro (Normal, Atenção e Alerta, por exemplo). Cada opção mostra quantos sobram somando os outros filtros. O link copiado abre com os mesmos filtros.'],
        ['Colunas', 'o botão Colunas põe e tira colunas; arrastar a borda do título muda a largura. A escolha fica guardada neste aparelho.'],
        ['Excel', 'pergunta se vêm todas as colunas ou só as da tela. As linhas são sempre as da tela, na mesma ordem.'],
        ['Nº SEI', 'abre o processo no SEI (é preciso estar logado nele); o botão ao lado copia o número. Sem processo próprio, aparece o da prestação de contas, marcado PCF.'],
        ['Busca', 'procura no número, no número original, no objeto, no município e nos processos SEI, sem ligar para acento.'],
        ['Ordem', 'clique no título de uma coluna para ordenar por ela; outro clique inverte.'],
        ['Liberado', 'o que a União já mandou, pelo Transferegov.']
      ],
      numeros: function () {
        return convs().then(function (cv) {
          return [
            n(cv.length) + ' instrumentos: todos os da coluna A da planilha de vigências, finalizados inclusive.',
            'Por prazo: ' + linhaStatus(contarStatus(cv)) + '.',
            'Por órgão executor: ' + contarOrgao(cv) + '.'
          ];
        });
      }
    },

    execucao: {
      oque: 'Tudo de UM instrumento: dinheiro que entrou e saiu, notas fiscais, ' +
            'contratos, medições e atestes. É a página principal do instrumento: o ' +
            'número clicável de qualquer painel abre aqui. O botão da ficha traz os ' +
            'dados de cadastro (órgão, fiscal, SEI, prazos).',
      fonte: 'Transferegov, lido pela rotina de segunda (execução financeira ' +
             'completa) e pela varredura diária (repasses). Os dados de cadastro ' +
             'vêm da planilha de vigências.',
      cards: [
        ['Valor do contrato', 'teto de pagamento aprovado, somando os contratos do instrumento.'],
        ['Repasse federal', 'o que a União mandou e quanto disso já foi pago.'],
        ['Contrapartida', 'o que o Estado depositou e quanto disso já foi pago.'],
        ['Saldo real', 'recebido menos pago. Movimentação cancelada fica fora de toda soma.'],
        ['Rendimentos', 'rendimento da aplicação e quanto dele foi liberado para uso.']
      ],
      numeros: function () {
        return Promise.all([convs(), IDEPI.dados.execIndice()]).then(function (r) {
          var cv = r[0], ex = (r[1] && r[1].instrumentos) || [];
          var nums = {};
          ex.forEach(function (i) { nums[i.numero] = 1; });
          var sem = cv.filter(function (c) { return !nums[c.numero]; }).length;
          return [
            n(ex.length) + ' instrumentos com execução coletada, de ' + n(cv.length) + ' acompanhados.',
            sem ? n(sem) + ' ainda sem execução coletada: ao abri-los, a página avisa em vez de mostrar outro.'
                : 'Todos os instrumentos acompanhados têm execução coletada.'
          ];
        });
      }
    },

    ingressos: {
      oque: 'Todo dinheiro que entrou nas contas dos convênios: repasse federal e ' +
            'contrapartida, com banco, conta e data de cada liberação. A página NÃO ' +
            'filtra instrumentos: acompanha todos.',
      fonte: 'Planilha de ingressos, conferida contra o Transferegov. A varredura das ' +
             '08:30 lança sozinha o repasse federal novo; contrapartida só é avisada, ' +
             'porque a data da tela é a do registro e não a do depósito.',
      cards: [
        ['Total recebido', 'soma de todos os ingressos, separada em federal e contrapartida.'],
        ['Recebido no ano', 'só os ingressos com data no ano corrente.'],
        ['Último ingresso', 'o mais recente, com o instrumento e há quantos dias foi.'],
        ['Instrumentos monitorados', 'o número grande é quem já tem PELO MENOS UM ingresso; embaixo, o total acompanhado.']
      ],
      numeros: function () {
        return dados().then(function (j) {
          var h = j.historico_repasses || {}, cv = j.convenios || [];
          var nums = Object.keys(h);
          var com = nums.filter(function (k) { return (h[k].ingressos || []).length; }).length;
          var naLista = {};
          cv.forEach(function (c) { naLista[c.numero] = 1; });
          var sem = nums.filter(function (k) { return !(h[k].ingressos || []).length; });
          var semLib = 0, semConta = 0, fora = 0;
          sem.forEach(function (k) {
            var c = cv.filter(function (x) { return x.numero === k; })[0];
            if (!c) fora++;
            else if (IDEPI.gestaoDe(c) === 'proposta' || c.dados_origem === 'Emendas') semConta++;
            else semLib++;
          });
          var out = [
            n(nums.length) + ' instrumentos acompanhados, ' + n(com) + ' com pelo menos um ingresso.',
            n(sem.length) + ' ainda sem ingresso:'
          ];
          if (semLib) out.push('  ' + n(semLib) + ' em execução, com repasse ainda não liberado;');
          if (semConta) out.push('  ' + n(semConta) + ' propostas ou pré-instrumentos, que ainda não têm conta;');
          if (fora) out.push('  ' + n(fora) + ' fora da lista de vigências (anulado ou dispensado), mantido no histórico.');
          return out;
        });
      }
    },

    fiscalgov: {
      oque: 'De quem cobrar fiscalização pelo app FiscalGov (indicador EX-01 do IDTRU-DL). ' +
            'A página abre nas pendências: instrumentos em execução, com obra, que não ' +
            'têm foto no app ou cuja última foto passou de 80 dias.',
      fonte: 'Transferegov, lido pelo tgov_monitor na rotina de segunda (foto e data da ' +
             'foto mais recente, medição e pagamento), mais a execução financeira para ' +
             'saber se a obra começou.',
      cards: [
        ['Pendências', 'sem foto no app, ou com a foto mais recente há mais de 80 dias. É a lista de cobrança.'],
        ['Em dia', 'foto enviada pelo app nos últimos 80 dias.'],
        ['Ainda não se cobra', 'obra que não pode ter começado: sem recurso federal, em cláusula suspensiva, sem AIO, ou proposta que ainda não é instrumento.'],
        ['Quem entra', 'só instrumento com a vigência correndo. Vencido ou encerrado não tem como receber foto.'],
        ['80 dias', 'calibrado na lista da SEPLAN de 30/09/2026: ela cobrou quem estava parado de 88 dias para cima.'],
        ['EX-01 oficial', 'a SURPI mede de outro jeito: usam o app ÷ todos os vigentes no Transferegov, obra ou não. O número está abaixo, em "Quem entra, agora".']
      ],
      numeros: function () {
        return convs().then(function (cv) {
          var vig = IDEPI.vigentesEX01(cv);
          var nok = 0, desat = 0, dia = 0, proj = 0;
          vig.forEach(function (c) {
            if (!IDEPI.isApto(c)) proj++;
            else if (!IDEPI.temFoto(c)) nok++;
            else if (IDEPI.fotoDesatualizada(c)) desat++;
            else dia++;
          });
          var o = IDEPI.resumoEX01Oficial(cv);
          return [
            n(vig.length) + ' instrumentos em execução, de ' + n(cv.length) + ' acompanhados.',
            n(nok + desat) + ' pendências: ' + n(nok) + ' sem foto e ' + n(desat) + ' com foto desatualizada.',
            n(dia) + ' em dia e ' + n(proj) + ' que ainda não se cobra.',
            'EX-01 oficial (SURPI): ' + o.pct + '%, ' + n(o.comApp) + ' de ' + n(o.vigentes) +
              ' vigentes no Transferegov usam o app.'
          ];
        });
      }
    },
    pcf: {
      oque: 'As prestações de contas finais em andamento: etapa, conta, período e ' +
            'processo SEI de cada uma. A Observação é a única coluna que o sistema ' +
            'não preenche: vem do SEI, escrita pelo setor.',
      fonte: 'Planilha de PCF do setor, publicada todo dia útil às 08:45. A etapa é ' +
             'conferida contra o Transferegov, e a divergência aparece na página.',
      cards: [
        ['Não iniciada', 'prazo correndo e prestação ainda não enviada.'],
        ['Em análise', 'enviada e aguardando o concedente.'],
        ['Aprovada', 'aprovada pelo concedente, com ou sem ressalvas.'],
        ['Concluída', 'encerrada no Transferegov.']
      ],
      numeros: function () {
        return Promise.all([IDEPI.dados.pcf(), convs()]).then(function (r) {
          var p = (r[0] && r[0].pcfs) || [], na = {};
          r[1].forEach(function (c) { na[c.numero] = 1; });
          var fora = p.filter(function (x) { return !na[String(x.numero || '').trim()]; }).length;
          var out = [n(p.length) + ' prestações de contas na planilha do setor.'];
          if (fora) out.push(fora === 1
            ? '1 delas é de instrumento fora da lista de vigências, marcado "fora do painel".'
            : n(fora) + ' delas são de instrumentos fora da lista de vigências, marcados "fora do painel".');
          return out;
        });
      }
    },

    pagamentos: {
      oque: 'Qual medição foi paga, em que processo SEI ela tramitou e quanto saiu, ' +
            'mês a mês e por empresa. A previsão do mês é o que já está na fila, não ' +
            'uma projeção.',
      fonte: 'Relação de pagamentos do setor, publicada todo dia útil às 08:45, com o ' +
             'valor líquido conferido contra as movimentações do Transferegov.',
      cards: [
        ['Pago', 'medição com data de pagamento.'],
        ['Aguardando', 'medição com valor e sem data: está na fila e entra na previsão do mês.'],
        ['Empresa', 'grafias diferentes da mesma empresa são juntadas; o balão da empresa mostra quais.']
      ],
      numeros: function () {
        return IDEPI.dados.pagamentos().then(function (d) {
          var p = (d && d.pagamentos) || [];
          var pago = p.filter(function (x) { return x.situacao === 'pago'; }).length;
          var ag = p.filter(function (x) { return x.situacao === 'aguardando'; }).length;
          var inst = {};
          p.forEach(function (x) { if (x.numero) inst[x.numero] = 1; });
          return [
            n(p.length) + ' linhas na relação do setor, de ' + n(Object.keys(inst).length) + ' instrumentos.',
            n(pago) + ' pagas e ' + n(ag) + ' aguardando pagamento.'
          ];
        });
      }
    },

    admin: {
      oque: 'Quem pode entrar no painel e em quais páginas. Quem cria conta não ' +
            'entra sozinho: fica aguardando até um administrador aprovar aqui.',
      fonte: 'Cadastro de usuários do Firebase. Só administrador lê e altera.',
      cards: [
        ['Pedidos', 'contas criadas que ainda esperam aprovação.'],
        ['Usuários', 'quem já entra, com a lista de painéis que cada um vê. Sem lista, vê todos.']
      ],
      numeros: null
    }
  };

  /* ── O balão ─────────────────────────────────────────────────────────── */
  var _balao = null, _botao = null;

  function fechar(devolverFoco) {
    if (_balao && _balao.parentNode) _balao.parentNode.removeChild(_balao);
    _balao = null;
    if (_botao) {
      _botao.setAttribute('aria-expanded', 'false');
      if (devolverFoco) _botao.focus();
    }
  }

  function posicionar() {
    if (!_balao || !_botao) return;
    var r = _botao.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight, m = 16;
    var larg = Math.min(420, vw - 2 * m);
    _balao.style.width = larg + 'px';
    var esq = Math.max(m, Math.min(r.left - 12, vw - larg - m));
    var topo = r.bottom + 8;
    _balao.style.left = esq + 'px';
    _balao.style.top = topo + 'px';
    _balao.style.maxHeight = Math.max(200, vh - topo - m) + 'px';
    var seta = Math.max(14, Math.min(r.left + r.width / 2 - esq, larg - 14));
    _balao.style.setProperty('--seta-x', seta + 'px');
  }

  function montar(def, titulo) {
    var h = '<div class="sobre-hd"><span><i class="fa-solid fa-circle-info"></i> ' +
            'Sobre esta página</span><button type="button" class="sobre-x" ' +
            'aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="sobre-corpo">' +
            '<h4>O que mostra</h4><p>' + esc(def.oque) + '</p>';
    if (def.numeros) {
      h += '<h4>Quem entra, agora</h4><ul class="sobre-num" data-sobre-num>' +
           '<li class="sobre-carregando">calculando com os dados desta tela…</li></ul>';
    }
    h += '<h4>De onde vêm os dados</h4><p>' + esc(def.fonte) + '</p>';
    if (def.cards && def.cards.length) {
      h += '<h4>O que significa cada número</h4><dl class="sobre-dl">' +
        def.cards.map(function (c) {
          return '<dt>' + esc(c[0]) + '</dt><dd>' + esc(c[1]) + '</dd>';
        }).join('') + '</dl>';
    }
    h += '</div>';
    var el = document.createElement('div');
    el.className = 'sobre-balao';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Sobre a página ' + titulo);
    el.tabIndex = -1;
    el.innerHTML = h;
    el.querySelector('.sobre-x').addEventListener('click', function () { fechar(true); });
    return el;
  }

  function abrir(def, titulo) {
    if (_balao) { fechar(false); return; }
    _balao = montar(def, titulo);
    (document.fullscreenElement || document.body).appendChild(_balao);
    _botao.setAttribute('aria-expanded', 'true');
    posicionar();
    _balao.focus();
    if (!def.numeros) return;
    var alvo = _balao.querySelector('[data-sobre-num]'), meu = _balao;
    Promise.resolve().then(def.numeros).then(function (linhas) {
      if (_balao !== meu) return;          /* fechou e abriu outro nesse meio-tempo */
      alvo.innerHTML = (linhas || []).map(function (l) {
        var sub = /^\s{2}/.test(l);
        return '<li' + (sub ? ' class="sobre-sub"' : '') + '>' + esc(l.trim()) + '</li>';
      }).join('');
      posicionar();
    }).catch(function () {
      if (_balao !== meu) return;
      alvo.innerHTML = '<li class="sobre-carregando">Os dados desta página ainda não ' +
                       'carregaram. Feche e abra de novo em alguns segundos.</li>';
    });
  }

  function instalar() {
    var def = PAGINAS[paginaAtual()];
    if (!def) return;
    var tit = document.querySelector('.pg-title, .ptitle');
    if (!tit || tit.querySelector('.sobre-btn')) return;
    var titulo = (tit.textContent || '').replace(/\s+/g, ' ').trim();
    _botao = document.createElement('button');
    _botao.type = 'button';
    _botao.className = 'sobre-btn';
    _botao.setAttribute('aria-haspopup', 'dialog');
    _botao.setAttribute('aria-expanded', 'false');
    _botao.setAttribute('aria-label', 'O que é esta página');
    _botao.title = 'O que é esta página';
    _botao.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
    _botao.addEventListener('click', function (e) { e.stopPropagation(); abrir(def, titulo); });
    tit.appendChild(_botao);
  }

  function paginaAtual() {
    var f = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
    return f || 'index';
  }

  document.addEventListener('click', function (e) {
    if (_balao && !_balao.contains(e.target) && e.target !== _botao) fechar(false);
  });
  document.addEventListener('keydown', function (e) {
    if (_balao && e.key === 'Escape') fechar(true);
  });
  document.addEventListener('scroll', function (e) {
    if (_balao && !_balao.contains(e.target)) fechar(false);
  }, true);
  window.addEventListener('resize', posicionar);
  document.addEventListener('fullscreenchange', function () { fechar(false); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalar);
  else instalar();

  IDEPI.sobre = { PAGINAS: PAGINAS, abrir: function () { if (_botao) _botao.click(); } };
})();
