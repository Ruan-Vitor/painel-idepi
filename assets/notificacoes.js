/* ══════════════════════════════════════════════════════════════════════════
   IDEPI — notificacoes.js
   O SINO: o que aconteceu com os instrumentos desde a última vez que se olhou.

   DE ONDE VEM
   ───────────
   Do `eventos.py`, que roda no fim de cada rotina, compara o retrato de hoje
   com o de ontem e publica em `painel/eventos`. Aqui não se calcula evento
   nenhum: se a regra de negócio morasse no navegador, o Telegram e o e-mail
   diriam uma coisa e a tela diria outra. Mesma razão de o `app.js` ser fonte
   única para status.

   POR QUE O SINO EXISTE, se já chega Telegram
   ───────────────────────────────────────────
   O Telegram leva o urgente e some no meio das outras conversas; o e-mail é o
   registro do dia. O sino é a MEMÓRIA: guarda também o que não era urgente
   (foto que chegou, PCF que andou, fiscal que mudou) e continua lá na semana
   seguinte, para quem entrou de férias e voltou.

   O BADGE
   ───────
   Acende com o que é mais novo que a marca d'água — a hora em que esta pessoa,
   neste aparelho, abriu o sino pela última vez (localStorage). Abrir apaga, de
   propósito: badge que nunca zera vira enfeite. Quem guarda memória é a lista,
   que não apaga item nenhum. Sem localStorage (janela anônima) o badge
   simplesmente não acende — degradação aceitável, tela quebrada não é.

   Montado pelo `auth.js`, junto do nome do usuário: um lugar só para as sete
   páginas, como o menu no nav.js.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var IDEPI = global.IDEPI || (global.IDEPI = {});

  var CHAVE_VISTO = 'idepi_notif_visto';
  /* Quantos itens cabem antes do "mostrar mais". O histórico chega com até 300
     eventos; despejar tudo de uma vez trava o celular na abertura. */
  var PAGINA = 25;

  var LISTA = [];        // tudo o que veio do documento
  var FILTRO = 'todos';  // 'todos' | 'alta' | uma família
  var MOSTRANDO = PAGINA;
  var CARREGOU = false;

  /* Ícone e cor por família. O ícone diz o ASSUNTO num relance; a cor, a
     gravidade. São dois eixos diferentes de propósito — um prazo apertado e
     um prazo tranquilo têm o mesmo assunto e urgências opostas. */
  var ICONE = {
    prazo: 'fa-hourglass-half',
    vigencia: 'fa-calendar-day',
    situacao: 'fa-circle-exclamation',
    dinheiro: 'fa-money-bill-transfer',
    execucao: 'fa-chart-line',
    fiscalgov: 'fa-camera',
    pcf: 'fa-file-invoice',
    entrada: 'fa-door-open',
    cadastro: 'fa-user-pen',
    saude: 'fa-heart-pulse'
  };

  var ROTULO_FAMILIA = {
    prazo: 'Prazos',
    vigencia: 'Vigência',
    situacao: 'Situação',
    dinheiro: 'Dinheiro',
    execucao: 'Execução',
    fiscalgov: 'FiscalGov',
    pcf: 'Prest. de contas',
    entrada: 'Entrada e saída',
    cadastro: 'Cadastro',
    saude: 'Sistema'
  };

  /* ── MARCA D'ÁGUA ──────────────────────────────────────────────────────── */
  function visto() {
    try { return localStorage.getItem(CHAVE_VISTO) || ''; } catch (e) { return ''; }
  }

  function guardarVisto() {
    /* Guardado no MESMO formato do carimbo do evento ("AAAA-MM-DD HH:MM"), e
       não em ISO: comparar "2026-09-01T10:20:00Z" com "2026-09-01 10:20" por
       texto dá resultado errado, e converter os dois a cada item custaria mais
       que gravar certo uma vez. */
    try {
      var d = new Date();
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      localStorage.setItem(CHAVE_VISTO,
        d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
        ' ' + p(d.getHours()) + ':' + p(d.getMinutes()));
    } catch (e) { /* sem localStorage: o badge apenas não zera */ }
  }

  function novosDesdeVisto(lista) {
    var marca = visto();
    if (!marca) {
      /* Primeira vez neste aparelho: contar TODO o histórico daria um "9+"
         que não diz nada. Conta só o que é urgente, que é o que justifica
         abrir agora. */
      return lista.filter(function (e) { return e.severidade === 'alta'; }).length;
    }
    return lista.filter(function (e) { return (e.quando || '') > marca; }).length;
  }

  /* ── DATAS ─────────────────────────────────────────────────────────────── */
  function diaDe(quando) {
    return (quando || '').slice(0, 10);
  }

  function rotuloDia(iso) {
    if (!iso) return 'sem data';
    var hoje = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var hojeIso = hoje.getFullYear() + '-' + p(hoje.getMonth() + 1) + '-' + p(hoje.getDate());
    var ontem = new Date(hoje.getTime() - 86400000);
    var ontemIso = ontem.getFullYear() + '-' + p(ontem.getMonth() + 1) + '-' + p(ontem.getDate());
    if (iso === hojeIso) return 'Hoje';
    if (iso === ontemIso) return 'Ontem';
    return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  }

  /* ── MONTAGEM ──────────────────────────────────────────────────────────── */
  function montar() {
    var alvo = document.querySelector('.hd-right');
    if (!alvo || document.getElementById('btnSino')) return;

    var botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'hd-btn hd-sino';
    botao.id = 'btnSino';
    botao.title = 'Notificações';
    botao.setAttribute('aria-label', 'Notificações');
    botao.innerHTML = '<i class="fa-solid fa-bell"></i>' +
      '<span class="sino-badge" id="sinoBadge" hidden></span>';

    /* Antes do bloco do usuário: o sino é ferramenta, o nome é identidade.
       Como o auth.js monta o `#hdUser` primeiro, entra com insertBefore. */
    var user = document.getElementById('hdUser');
    if (user) alvo.insertBefore(botao, user); else alvo.appendChild(botao);

    var painel = document.createElement('div');
    painel.id = 'notifWrap';
    painel.innerHTML =
      '<div class="notif-fundo" id="notifFundo" hidden></div>' +
      '<aside class="notif-painel" id="notifPainel" hidden aria-label="Notificações">' +
        '<div class="notif-topo">' +
          '<strong><i class="fa-solid fa-bell"></i> Notificações</strong>' +
          '<button type="button" class="notif-x" id="notifFechar" aria-label="Fechar">' +
            '<i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="notif-chips" id="notifChips"></div>' +
        '<div class="notif-lista" id="notifLista">' +
          '<p class="notif-vazio">Carregando…</p>' +
        '</div>' +
        '<div class="notif-rodape" id="notifRodape"></div>' +
      '</aside>';
    document.body.appendChild(painel);

    botao.addEventListener('click', alternar);
    document.getElementById('notifFechar').addEventListener('click', fechar);
    document.getElementById('notifFundo').addEventListener('click', fechar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fechar();
    });

    /* O badge é a única leitura feita no carregamento, e por isso ele lê o
       documento PEQUENO. A lista inteira só desce quando alguém abre. */
    atualizarBadge();
  }

  function atualizarBadge() {
    if (!IDEPI.dados || !IDEPI.dados.eventosResumo) {
      console.warn('[IDEPI] sino sem IDEPI.dados.eventosResumo — badge desligado.');
      return;
    }
    IDEPI.dados.eventosResumo().then(function (r) {
      var badge = document.getElementById('sinoBadge');
      if (!badge) return;
      var n = novosDesdeVisto((r && r.ultimos) || []);
      badge.hidden = n === 0;
      badge.textContent = n > 9 ? '9+' : String(n || '');
      /* Vermelho só quando há coisa urgente entre as novas. Badge sempre
         vermelho ensina a ignorar vermelho. */
      var temAlta = ((r && r.ultimos) || []).some(function (e) {
        return e.severidade === 'alta' && (!visto() || (e.quando || '') > visto());
      });
      badge.classList.toggle('urgente', temAlta);
    }).catch(function () { /* sem permissão ou offline: o sino fica mudo */ });
  }

  /* ── ABRIR E FECHAR ────────────────────────────────────────────────────── */
  function alternar() {
    var p = document.getElementById('notifPainel');
    if (p.hidden) abrir(); else fechar();
  }

  function abrir() {
    document.getElementById('notifPainel').hidden = false;
    document.getElementById('notifFundo').hidden = false;
    if (!CARREGOU) carregar(); else desenhar();
    /* A marca d'água é gravada ao ABRIR, não ao fechar: fechar pela tecla Esc
       ou trocando de página não passaria por aqui. */
    guardarVisto();
    var b = document.getElementById('sinoBadge');
    if (b) { b.hidden = true; b.classList.remove('urgente'); }
  }

  function fechar() {
    var p = document.getElementById('notifPainel');
    if (!p || p.hidden) return;
    p.hidden = true;
    document.getElementById('notifFundo').hidden = true;
  }

  function carregar() {
    /* Saída cedo NÃO pode deixar o "Carregando…" na tela para sempre. Foi
       exatamente o que aconteceu em 01/09/2026: as funções existiam no
       data.js e ficaram DE FORA do objeto exportado, então `IDEPI.dados
       .eventos` era undefined, esta função voltava calada e o painel abria
       eternamente carregando. Código que sai cedo em silêncio é
       indistinguível de código que funciona — a mesma lição do
       `renderFichaBasica`. Agora ele DIZ o que faltou. */
    if (!IDEPI.dados || !IDEPI.dados.eventos) {
      document.getElementById('notifLista').innerHTML =
        '<p class="notif-vazio">O leitor de notificações não carregou nesta ' +
        'página (assets/data.js sem <code>eventos</code>). Recarregue; se ' +
        'continuar, é defeito de publicação.</p>';
      document.getElementById('notifRodape').innerHTML = '';
      return;
    }
    IDEPI.dados.eventos().then(function (d) {
      LISTA = (d && d.eventos) || [];
      CARREGOU = true;
      desenhar();
    }).catch(function () {
      document.getElementById('notifLista').innerHTML =
        '<p class="notif-vazio">Não consegui ler as notificações agora. ' +
        'Se estiver sem internet, o que já foi lido antes continua valendo.</p>';
    });
  }

  /* ── DESENHO ───────────────────────────────────────────────────────────── */
  function filtrada() {
    if (FILTRO === 'todos') return LISTA;
    if (FILTRO === 'alta') {
      return LISTA.filter(function (e) { return e.severidade === 'alta'; });
    }
    return LISTA.filter(function (e) { return e.familia === FILTRO; });
  }

  function desenharChips() {
    var conta = {};
    LISTA.forEach(function (e) {
      conta[e.familia] = (conta[e.familia] || 0) + 1;
    });
    var altas = LISTA.filter(function (e) { return e.severidade === 'alta'; }).length;

    var html = chip('todos', 'Tudo', LISTA.length);
    if (altas) html += chip('alta', 'Urgentes', altas);
    Object.keys(ROTULO_FAMILIA).forEach(function (f) {
      if (conta[f]) html += chip(f, ROTULO_FAMILIA[f], conta[f]);
    });

    var alvo = document.getElementById('notifChips');
    alvo.innerHTML = html;
    alvo.querySelectorAll('[data-chip]').forEach(function (el) {
      el.addEventListener('click', function () {
        FILTRO = el.getAttribute('data-chip');
        MOSTRANDO = PAGINA;
        desenhar();
      });
    });
  }

  function chip(id, rotulo, n) {
    return '<button type="button" class="notif-chip' +
      (FILTRO === id ? ' on' : '') + (id === 'alta' ? ' urg' : '') +
      '" data-chip="' + id + '">' + IDEPI.esc(rotulo) +
      ' <span>' + n + '</span></button>';
  }

  function itemHtml(e) {
    var linha2 = [
      e.numero ? 'Instrumento ' + IDEPI.esc(e.numero) : '',
      e.detalhe ? IDEPI.esc(e.detalhe) : ''
    ].filter(Boolean).join(' · ');
    var hora = (e.quando || '').slice(11, 16);

    return '<button type="button" class="notif-item sev-' + IDEPI.esc(e.severidade) +
        '" data-num="' + IDEPI.esc(e.numero || '') +
        '" data-pagina="' + IDEPI.esc(e.pagina || 'index') + '">' +
        '<i class="fa-solid ' + (ICONE[e.familia] || 'fa-circle-info') + ' notif-ico"></i>' +
        '<span class="notif-corpo">' +
          '<strong>' + IDEPI.esc(e.titulo || '') + '</strong>' +
          (linha2 ? '<small>' + linha2 + '</small>' : '') +
          (e.objeto ? '<em>' + IDEPI.esc(e.objeto) + '</em>' : '') +
        '</span>' +
        '<span class="notif-hora">' + IDEPI.esc(hora) + '</span>' +
      '</button>';
  }

  function desenhar() {
    desenharChips();
    var lista = filtrada();
    var alvo = document.getElementById('notifLista');

    if (!lista.length) {
      alvo.innerHTML = '<p class="notif-vazio">Nada por aqui. ' +
        'Dia sem novidade é silêncio de propósito.</p>';
      document.getElementById('notifRodape').innerHTML = '';
      return;
    }

    /* Agrupado por dia. A lista já chega do mais novo para o mais antigo (o
       eventos.py inverte antes de publicar), então basta quebrar quando o dia
       muda — sem reordenar nada aqui. */
    var html = '';
    var diaAtual = null;
    lista.slice(0, MOSTRANDO).forEach(function (e) {
      var d = diaDe(e.quando);
      if (d !== diaAtual) {
        diaAtual = d;
        html += '<div class="notif-dia">' + IDEPI.esc(rotuloDia(d)) + '</div>';
      }
      html += itemHtml(e);
    });
    alvo.innerHTML = html;
    alvo.scrollTop = 0;

    alvo.querySelectorAll('.notif-item').forEach(function (el) {
      el.addEventListener('click', function () {
        irPara(el.getAttribute('data-num'), el.getAttribute('data-pagina'));
      });
    });

    var falta = lista.length - MOSTRANDO;
    document.getElementById('notifRodape').innerHTML = falta > 0
      ? '<button type="button" class="notif-mais" id="notifMais">' +
          'Mostrar mais ' + Math.min(falta, PAGINA) + ' (de ' + falta + ' restantes)</button>'
      : '<span class="notif-fim">' + lista.length +
        (lista.length === 1 ? ' notificação' : ' notificações') + ' · o histórico não apaga</span>';
    var mais = document.getElementById('notifMais');
    if (mais) mais.addEventListener('click', function () {
      MOSTRANDO += PAGINA;
      desenhar();
    });
  }

  /* ── CLIQUE NO ITEM ────────────────────────────────────────────────────── */
  function irPara(numero, pagina) {
    /* A ficha é o melhor destino: abre sem sair da tela e mostra tudo do
       instrumento. Só que ela depende de a página já ter carregado as
       vigências, o que nem sempre aconteceu quando alguém abre o sino nos
       primeiros segundos. */
    if (numero && IDEPI.ficha && IDEPI.ficha.dados) {
      var c = null;
      try { c = IDEPI.ficha.dados(numero); } catch (e) { c = null; }
      if (c && c.numero) {
        fechar();
        IDEPI.ficha.abrir(numero, 'Aberta a partir das notificações.');
        return;
      }
    }
    /* Sem ficha, o destino é a EXECUÇÃO FINANCEIRA — que é a página principal
       do instrumento desde 17/08/2026 e o único `?num=` que o painel consome.
       Mandar para `pcf.html?num=` seria inventar um parâmetro que aquela
       página não lê: a pessoa clicaria e cairia numa lista inteira, sem
       entender por que o convênio dela não foi aberto. */
    if (!numero) { fechar(); return; }
    global.location.href = 'execucao.html?num=' + encodeURIComponent(numero);
  }

  IDEPI.notificacoes = {
    montar: montar,
    abrir: abrir,
    fechar: fechar,
    atualizarBadge: atualizarBadge
  };

})(window);
