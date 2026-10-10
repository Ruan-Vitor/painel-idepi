/* ══════════════════════════════════════════════════════════════════════════
   IDEPI — nav.js
   Menu lateral + botão de menu no celular + instalação do app (PWA).

   O menu é MONTADO POR AQUI, não escrito à mão em cada HTML. Antes cada
   página tinha a sua cópia da <nav>, e elas foram ficando diferentes entre si
   (o obs/index.html ainda mostra "Execução Financeira — em breve", por exemplo).
   Para adicionar um painel novo, mexa só no array MENU abaixo.

   Cada página se identifica com <body data-page="vigencias"> etc.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var IDEPI = global.IDEPI || (global.IDEPI = {});

  /* ── ESTRUTURA DO MENU ─────────────────────────────────────────────────── */
  var MENU = [
    { secao: 'Convênios Federais' },
    { id: 'index',      icone: 'fa-gauge-high',           rotulo: 'Painel Geral',          href: 'index.html' },
    { id: 'vigencias',  icone: 'fa-table-list',           rotulo: 'Vigências',             href: 'vigencias.html' },
    /* Lê o mesmo documento de Vigências, então segue a liberação dela (painel). */
    { id: 'instrumentos', painel: 'vigencias', icone: 'fa-layer-group', rotulo: 'Todos os Instrumentos', href: 'instrumentos.html' },
    { id: 'execucao',   icone: 'fa-chart-line',           rotulo: 'Execução Financeira',   href: 'execucao.html' },
    { id: 'ingressos',  icone: 'fa-money-bill-transfer',  rotulo: 'Ingressos de Recurso',  href: 'ingressos.html' },
    { id: 'pcf',        icone: 'fa-file-invoice',         rotulo: 'Prestação de Contas',   href: 'pcf.html' },
    { id: 'pagamentos', icone: 'fa-receipt',              rotulo: 'Relação de Pagamentos', href: 'pagamentos.html' },
    { id: 'emendas',    icone: 'fa-landmark-dome',        rotulo: 'Emendas Parlamentares', embreve: true },
    { id: 'mapa',       icone: 'fa-map-location-dot',     rotulo: 'Mapa de Obras',         embreve: true },

    { secao: 'Desempenho IDTRU-DL' },
    { id: 'fiscalgov',  icone: 'fa-camera',               rotulo: 'FiscalGov · EX-01',     href: 'fiscalgov.html' },
    { id: 'indice',     icone: 'fa-star',                 rotulo: 'Índice Geral',          embreve: true }
  ];

  /* Itens que só aparecem para quem tem papel "admin". Ficam fora do MENU
     acima porque são acrescentados depois, quando o login resolve o perfil. */
  var MENU_ADMIN = [
    { secao: 'Administração' },
    { id: 'admin', icone: 'fa-users-gear', rotulo: 'Usuários e Acessos', href: 'admin.html' }
  ];

  var RODAPE =
    '<div class="sb-footer">' +
      '<div class="sb-card">' +
        '<strong>Instituto de Desenvolvimento do Piauí</strong>' +
        '<p>R. Altos, 277 — Primavera<br>Teresina-PI · idepi@idepi.pi.gov.br</p>' +
      '</div>' +
    '</div>';

  var MOBILE_MAX = 900;   // precisa bater com o @media do app.css
  function isMobile() { return global.matchMedia('(max-width:' + MOBILE_MAX + 'px)').matches; }

  /* ── MONTAGEM DO MENU ──────────────────────────────────────────────────── */
  function montarSidebar(paginaAtual) {
    var nav = document.getElementById('mainSidebar') || document.querySelector('.sidebar');
    if (!nav) return null;

    // Se a página já traz o menu escrito à mão, respeitamos (transição gradual).
    if (nav.getAttribute('data-manual') === '1') return nav;

    var html = '';
    MENU.forEach(function (it) {
      if (it.secao) { html += '<div class="sb-sec">' + it.secao + '</div>'; return; }
      var ativo = it.id === paginaAtual ? ' active' : '';
      var icone = '<i class="fa-solid ' + it.icone + '"></i> ';
      if (it.embreve) {
        html += '<div class="sb-item">' + icone + it.rotulo + '<span class="soon">em breve</span></div>';
      } else {
        html += '<a class="sb-item' + ativo + '" href="' + it.href + '">' + icone + it.rotulo + '</a>';
      }
    });
    html += RODAPE;

    nav.id = 'mainSidebar';
    nav.className = 'sidebar';
    nav.innerHTML = html;
    return nav;
  }

  /**
   * Acrescenta a seção de Administração ao menu, com o número de solicitações
   * pendentes ao lado. Só roda depois que o login confirma que a pessoa é
   * admin — antes disso o item nem existe no HTML.
   */
  function adicionarMenuAdmin(paginaAtual) {
    if (!sidebar || document.getElementById('sbAdmin')) return;

    var rodape = sidebar.querySelector('.sb-footer');
    var html = '';
    MENU_ADMIN.forEach(function (it) {
      if (it.secao) { html += '<div class="sb-sec">' + it.secao + '</div>'; return; }
      var ativo = it.id === paginaAtual ? ' active' : '';
      html += '<a class="sb-item' + ativo + '" id="sbAdmin" href="' + it.href + '">' +
              '<i class="fa-solid ' + it.icone + '"></i> ' + it.rotulo +
              '<span class="sb-badge" id="sbBadgePend" hidden>0</span></a>';
    });

    var bloco = document.createElement('div');
    bloco.innerHTML = html;
    while (bloco.firstChild) {
      // Entra antes do rodapé para não empurrar o cartão de contato.
      if (rodape) sidebar.insertBefore(bloco.firstChild, rodape);
      else sidebar.appendChild(bloco.firstChild);
    }

    atualizarBadgePendentes();
  }

  /**
   * Esconde do menu os painéis que o usuário não tem liberados.
   *
   * ⚠️  Isto é conveniência, não segurança — quem digitar a URL direto chega
   *     na página, e lá o IDEPI.auth.exigirPainel() é que barra. E a trava que
   *     realmente conta são as Security Rules do Firestore. Ver o comentário
   *     em auth.js sobre o alcance de cada camada.
   */
  function aplicarPermissoes() {
    if (!sidebar || !IDEPI.auth || !IDEPI.auth.podeVer) return;

    MENU.forEach(function (it) {
      if (it.secao || it.embreve || !it.href) return;
      if (it.id === 'index') return;                 // Painel Geral é de todos
      if (IDEPI.auth.podeVer(it.painel || it.id)) return;

      var link = sidebar.querySelector('.sb-item[href="' + it.href + '"]');
      if (link) link.remove();
    });

    // Se uma seção ficou sem nenhum item, o título dela vira ruído.
    sidebar.querySelectorAll('.sb-sec').forEach(function (sec) {
      var prox = sec.nextElementSibling;
      var temItem = false;
      while (prox && !prox.classList.contains('sb-sec')) {
        if (prox.classList.contains('sb-item')) { temItem = true; break; }
        prox = prox.nextElementSibling;
      }
      if (!temItem) sec.remove();
    });
  }

  /** Mostra quantos pedidos de acesso estão esperando decisão. */
  function atualizarBadgePendentes() {
    var badge = document.getElementById('sbBadgePend');
    if (!badge || !IDEPI.auth || !IDEPI.auth.admin) return;
    IDEPI.auth.admin.contarPendentes().then(function (n) {
      badge.textContent = n;
      badge.hidden = !n;
    });
  }

  /* ── ABRIR / FECHAR ────────────────────────────────────────────────────── */
  var sidebar = null;

  function abrirFechar() {
    if (!sidebar) return;
    var aberto = sidebar.classList.toggle('sb-open');
    var ico = document.getElementById('navMobIcon');
    if (ico) ico.className = aberto ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
  }

  function fechar() {
    if (sidebar && sidebar.classList.contains('sb-open')) abrirFechar();
  }

  /** Botão "Menu" no header — SEMPRE presente no celular. */
  function criarBotaoMobile() {
    if (document.getElementById('navMobBtn')) return;
    var alvo = document.querySelector('.hd-right');
    if (!alvo) return;
    var btn = document.createElement('button');
    btn.id = 'navMobBtn';
    btn.className = 'hd-btn nav-mob-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Abrir menu de navegação');
    btn.innerHTML = '<i class="fa-solid fa-bars" id="navMobIcon"></i>';
    btn.addEventListener('click', abrirFechar);
    alvo.insertBefore(btn, alvo.firstChild);
  }

  /** Aba lateral de recolher — só no desktop. */
  function criarBotaoDesktop() {
    if (document.querySelector('.sb-toggle')) return;
    var btn = document.createElement('button');
    btn.className = 'sb-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Recolher ou expandir o menu lateral');
    document.body.appendChild(btn);

    var recolhido = sessionStorage.getItem('idepi_sb_collapsed') === '1';

    function aplicar(v) {
      recolhido = v;
      sidebar.classList.toggle('collapsed', recolhido);
      btn.innerHTML = recolhido
        ? '<i class="fa-solid fa-chevron-right"></i>'
        : '<i class="fa-solid fa-chevron-left"></i>';
      btn.title = recolhido ? 'Expandir menu' : 'Recolher menu';
      btn.style.left = recolhido ? '0px' : 'var(--sb-w)';
    }
    aplicar(recolhido);

    btn.addEventListener('click', function () {
      aplicar(!recolhido);
      sessionStorage.setItem('idepi_sb_collapsed', recolhido ? '1' : '0');
    });
  }

  function ajustarPorLargura() {
    if (isMobile()) {
      criarBotaoMobile();
      // .collapsed é estado de desktop. Se ficou salvo e a pessoa abriu no
      // celular, o menu sumia sem botão para trazer de volta — este era o bug
      // que deixava vigencias.html e ingressos.html sem navegação no telefone.
      if (sidebar) sidebar.classList.remove('collapsed');
      var abaDesk = document.querySelector('.sb-toggle');
      if (abaDesk) abaDesk.remove();
    } else {
      fechar();
      var btnMob = document.getElementById('navMobBtn');
      if (btnMob) btnMob.remove();
      criarBotaoDesktop();
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     PWA — instalação e service worker
     ══════════════════════════════════════════════════════════════════════ */
  var promptInstalacao = null;

  function jaInstalado() {
    return global.matchMedia('(display-mode: standalone)').matches ||
           global.navigator.standalone === true;
  }

  function ehIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           // iPad com iPadOS 13+ se identifica como Mac com toque
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function criarBanner() {
    if (document.getElementById('pwaBar')) return;
    var bar = document.createElement('div');
    bar.className = 'pwa-bar';
    bar.id = 'pwaBar';
    bar.innerHTML =
      '<div class="pwa-bar-icon"><i class="fa-solid fa-mobile-screen-button"></i></div>' +
      '<div class="pwa-bar-txt">' +
        '<strong>Instalar o painel IDEPI</strong>' +
        '<span>Acesso direto pela tela inicial, sem abrir o navegador</span>' +
      '</div>' +
      '<button class="pwa-bar-btn" id="pwaInstallBtn" type="button">Instalar</button>' +
      '<button class="pwa-bar-close" id="pwaCloseBtn" type="button" aria-label="Dispensar">&times;</button>';
    document.body.appendChild(bar);

    document.getElementById('pwaInstallBtn').addEventListener('click', instalar);
    document.getElementById('pwaCloseBtn').addEventListener('click', function () {
      bar.classList.remove('show');
      // Não insiste por 30 dias.
      localStorage.setItem('idepi_pwa_dispensado', String(Date.now()));
    });
  }

  function dispensadoRecentemente() {
    var t = parseInt(localStorage.getItem('idepi_pwa_dispensado') || '0', 10);
    return t > 0 && (Date.now() - t) < 30 * 24 * 60 * 60 * 1000;
  }

  function mostrarBanner() {
    if (jaInstalado() || dispensadoRecentemente()) return;
    criarBanner();
    var bar = document.getElementById('pwaBar');
    if (bar) bar.classList.add('show');
  }

  /** Passo a passo do "Adicionar à Tela de Início" — iPhone/iPad. */
  function criarModalIOS() {
    if (document.getElementById('pwaModal')) return;
    var m = document.createElement('div');
    m.className = 'pwa-modal';
    m.id = 'pwaModal';
    m.innerHTML =
      '<div class="pwa-modal-card">' +
        '<h3><i class="fa-brands fa-apple"></i> Instalar no iPhone / iPad</h3>' +
        '<p>O Safari não instala sozinho — são três toques:</p>' +
        '<div class="pwa-step"><div class="pwa-step-n">1</div><div class="pwa-step-t">' +
          'Toque em <i class="fa-solid fa-arrow-up-from-bracket"></i> <strong>Compartilhar</strong>, na barra de baixo do Safari.' +
        '</div></div>' +
        '<div class="pwa-step"><div class="pwa-step-n">2</div><div class="pwa-step-t">' +
          'Role a lista e escolha <i class="fa-solid fa-square-plus"></i> <strong>Adicionar à Tela de Início</strong>.' +
        '</div></div>' +
        '<div class="pwa-step"><div class="pwa-step-n">3</div><div class="pwa-step-t">' +
          'Confirme em <strong>Adicionar</strong>. O ícone do IDEPI aparece junto com os outros aplicativos.' +
        '</div></div>' +
        '<p style="margin:16px 0 0;font-size:11px">Precisa ser pelo <strong>Safari</strong>. Chrome ou Firefox no iPhone não têm essa opção.</p>' +
        '<button class="lk-btn" style="margin-top:16px" id="pwaModalClose" type="button">Entendi</button>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) fecharModalIOS(); });
    document.getElementById('pwaModalClose').addEventListener('click', fecharModalIOS);
  }

  function fecharModalIOS() {
    var m = document.getElementById('pwaModal');
    if (m) m.classList.remove('show');
  }

  /** Abre a instalação: nativo no Android/Chrome, instruções no iOS. */
  function instalar() {
    if (jaInstalado()) { IDEPI.toast && IDEPI.toast('O app já está instalado.'); return; }

    if (promptInstalacao) {
      promptInstalacao.prompt();
      promptInstalacao.userChoice.then(function (r) {
        if (r && r.outcome === 'accepted') {
          var bar = document.getElementById('pwaBar');
          if (bar) bar.classList.remove('show');
        }
        promptInstalacao = null;
      });
      return;
    }

    // Safari (iOS) e navegadores sem beforeinstallprompt: mostramos o passo a passo.
    criarModalIOS();
    document.getElementById('pwaModal').classList.add('show');
  }

  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // file:// não aceita service worker — evita erro no console ao abrir local.
    if (location.protocol === 'file:') return;
    global.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.warn('[IDEPI] Service worker não registrado:', e && e.message);
      });
    });
  }

  /* ── AVISO DE CONEXÃO ──────────────────────────────────────────────────── */
  function ligarAvisoDeRede() {
    var bar = document.createElement('div');
    bar.className = 'net-bar';
    bar.id = 'netBar';
    bar.innerHTML = '<i class="fa-solid fa-wifi"></i> Sem conexão — exibindo os últimos dados salvos no aparelho';
    document.body.appendChild(bar);

    function sync() { bar.classList.toggle('show', !navigator.onLine); }
    global.addEventListener('online', sync);
    global.addEventListener('offline', sync);
    sync();
  }

  /* ── INICIALIZAÇÃO ─────────────────────────────────────────────────────── */
  function iniciar() {
    var pagina = document.body.getAttribute('data-page') ||
                 (location.pathname.split('/').pop() || 'index.html').replace('.html', '');

    sidebar = montarSidebar(pagina);
    if (sidebar) {
      // Fecha o drawer ao navegar (no celular o clique some com o menu junto).
      sidebar.addEventListener('click', function (e) {
        if (e.target.closest('.sb-item') && isMobile()) fechar();
      });
    }

    ajustarPorLargura();
    var t;
    global.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(ajustarPorLargura, 150);
    });

    // O auth.js avisa quando o login resolve. É aí que sabemos se a pessoa é
    // admin e se o menu ganha a seção de Administração.
    document.addEventListener('idepi-auth', function (e) {
      if (e.detail && e.detail.admin) adicionarMenuAdmin(pagina);
      aplicarPermissoes();
    });

    // Instalação
    global.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      promptInstalacao = e;
      mostrarBanner();
    });
    global.addEventListener('appinstalled', function () {
      var bar = document.getElementById('pwaBar');
      if (bar) bar.classList.remove('show');
      promptInstalacao = null;
      IDEPI.toast && IDEPI.toast('App instalado.');
    });
    // iOS nunca dispara beforeinstallprompt — o convite aparece depois de um
    // tempinho de uso, para não atrapalhar quem só quer consultar rápido.
    if (ehIOS() && !jaInstalado() && !dispensadoRecentemente()) {
      setTimeout(mostrarBanner, 4000);
    }

    registrarServiceWorker();
    ligarAvisoDeRede();
    ligarMarcaAoInicio(pagina);
    ligarVoltar(pagina);
  }

  /* ── VOLTAR QUE NÃO SAI SEM QUERER (10/10/2026) ───────────────────────────
     Pedido do Ruan: no app, o voltar do celular fechava o app "do nada". Agora
     é como nos apps grandes:
       1. Há algo aberto por cima (ficha, sino, filtro, balão, menu)? Fecha.
       2. Numa página aberta a partir de outra, volta para ela.
       3. Numa página sem nada atrás (aberta por link), vai ao Painel Geral.
       4. No Painel Geral, sobe ao topo e avisa "toque em voltar de novo para
          sair". O voltar seguinte sai de verdade.
     Trocar de página pelo MENU não empilha (como as abas do Instagram): o
     voltar de qualquer página do menu leva ao Painel Geral, que recarrega.

     COMO: uma entrada "guarda" no histórico, empilhada sobre a página. O
     voltar consome a guarda (popstate) e quem decide o que fazer somos nós.

     ⚠️ UMA GUARDA POR TOQUE. O Chrome pula, no botão voltar, entrada criada
     sem interação: é a defesa dele contra site que prende o usuário. Testado
     em 10/10/2026: guarda rearmada dentro do popstate (ou por timer) é pulada,
     e o voltar seguinte SAI do app sem aviso. Por isso ela só é armada no
     toque (pointerdown/keydown), nunca pelo código. Depois de um voltar, se a
     pessoa não tocar em nada, o próximo voltar sai, e o aviso diz isso.
     ⚠️ Nunca prender: o 4 tem de deixar sair no segundo voltar. Prender a
     pessoa é o que o Chrome pune, e é o que faria ela desinstalar.
     Só vale no app instalado ou no celular; no navegador do computador o
     voltar continua sendo o do navegador. */
  var GUARDA = 'idepiGuarda';
  var _destinoMenu = null;
  var AVISO_SAIR = 'Toque em voltar de novo para sair';

  function naGuarda() { return !!(history.state && history.state[GUARDA]); }

  function armar() {
    if (naGuarda()) return;
    var st = {};
    if (history.state && typeof history.state === 'object') {
      for (var k in history.state) st[k] = history.state[k];
    }
    st[GUARDA] = 1;
    try { history.pushState(st, '', location.href); } catch (e) {}
  }

  /* Há alguma camada aberta? Fecha a de cima e diz que fechou. */
  function fecharSobreposto() {
    if (document.querySelector('.mdl-fundo') && IDEPI.fecharModal) {
      IDEPI.fecharModal(); return true;
    }
    var notif = document.getElementById('notifPainel');
    if ((notif && !notif.hidden) || document.querySelector('[aria-expanded="true"]')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return true;
    }
    if (sidebar && sidebar.classList.contains('sb-open')) { fechar(); return true; }
    return false;
  }

  /* Há página do próprio app atrás desta? */
  function temAnteriorNoApp() {
    var nav = global.navigation;
    if (nav && nav.currentEntry && typeof nav.currentEntry.index === 'number') {
      return nav.currentEntry.index > 0;
    }
    try { return !!document.referrer && new URL(document.referrer).origin === location.origin; }
    catch (e) { return false; }
  }

  function ehInicio(url) {
    try { var p = new URL(url, location.href).pathname; return /(\/|index\.html)$/.test(p); }
    catch (e) { return false; }
  }

  /* Ir ao Painel Geral reaproveitando a entrada dele, se houver: assim o
     histórico não ganha um segundo Painel Geral para o voltar atravessar. */
  function irAoInicio() {
    var nav = global.navigation;
    if (nav && nav.entries) {
      var ents = nav.entries(), idx = nav.currentEntry ? nav.currentEntry.index : -1;
      for (var i = idx - 1; i >= 0; i--) {
        if (ents[i] && ehInicio(ents[i].url)) { nav.traverseTo(ents[i].key); return; }
      }
    }
    location.replace('index.html');
  }

  function ligarVoltar(pagina) {
    var modoApp = jaInstalado() || isMobile();
    if (!modoApp || !global.history || !history.pushState) return;
    var inicio = pagina === 'index';

    // Toque ou tecla: arma a guarda (o Chrome só respeita a que vem depois de
    // interação). Barato: não faz nada se ela já está armada.
    ['pointerdown', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, armar, true);
    });

    // Menu: trocar de página SUBSTITUI a atual em vez de empilhar.
    if (!inicio) {
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a.sb-item[href]');
        if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        var href = a.getAttribute('href');
        if (ehInicio(href)) { irAoInicio(); return; }
        // Se a guarda está por cima, o replace trocaria a GUARDA e deixaria
        // esta página para trás. Primeiro desce da guarda; o popstate segue.
        if (naGuarda()) { _destinoMenu = href; history.back(); }
        else location.replace(href);
      });
    }

    global.addEventListener('popstate', function () {
      if (naGuarda()) return;                 // chegou na guarda indo para a frente
      if (_destinoMenu) { var d = _destinoMenu; _destinoMenu = null; location.replace(d); return; }
      // Nada de armar() aqui: guarda sem toque é pulada pelo Chrome (ver acima).
      if (fecharSobreposto()) return;
      if (!inicio) {
        if (temAnteriorNoApp()) { history.back(); return; }
        // Nada atrás: o Painel Geral entra no lugar desta página, sem guarda
        // ainda. Ele mostra o aviso ao abrir (marca na sessão).
        try { sessionStorage.setItem('idepiAvisoSair', '1'); } catch (e) {}
        location.replace('index.html');
        return;
      }
      global.scrollTo(0, 0);
      document.querySelectorAll('.scroll').forEach(function (s) { s.scrollTop = 0; });
      IDEPI.toast && IDEPI.toast(AVISO_SAIR);
    });

    // Voltar ao Painel Geral é voltar para dados frescos. Se o navegador o
    // trouxe da memória (bfcache), recarrega.
    if (inicio) {
      global.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });
      var avisar = false;
      try { avisar = sessionStorage.getItem('idepiAvisoSair') === '1'; sessionStorage.removeItem('idepiAvisoSair'); } catch (e) {}
      if (avisar) setTimeout(function () { IDEPI.toast && IDEPI.toast(AVISO_SAIR); }, 600);
    }
  }

  /* A marca no topo leva ao Painel Geral, como em quase todo site: é o
     primeiro lugar onde se clica para "voltar ao começo". A imagem vem do
     app.css (.hd-logo-icon), para as 8 páginas mudarem juntas. 30/09/2026. */
  function ligarMarcaAoInicio(pagina) {
    var logo = document.querySelector('.hd-logo');
    if (!logo || pagina === 'index') return;
    logo.setAttribute('role', 'link');
    logo.setAttribute('tabindex', '0');
    logo.setAttribute('title', 'Ir para o Painel Geral');
    logo.classList.add('hd-logo-link');
    function ir() {
      if (jaInstalado() || isMobile()) irAoInicio();   // ver ligarVoltar
      else location.href = 'index.html';
    }
    logo.addEventListener('click', ir);
    logo.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  /* ── EXPORTA ───────────────────────────────────────────────────────────── */
  IDEPI.nav = {
    abrirFechar: abrirFechar,
    fechar: fechar,
    instalar: instalar,
    jaInstalado: jaInstalado,
    ehIOS: ehIOS,
    isMobile: isMobile,
    atualizarBadgePendentes: atualizarBadgePendentes
  };
  // Compatibilidade com onclick="" que já existiam nas páginas
  global.toggleSidebar = abrirFechar;
  global.toggleSidebarMobile = abrirFechar;
  global.instalarApp = instalar;

})(window);
