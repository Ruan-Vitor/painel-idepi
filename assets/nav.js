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
    { id: 'execucao',   icone: 'fa-chart-line',           rotulo: 'Execução Financeira',   href: 'execucao.html' },
    { id: 'ingressos',  icone: 'fa-money-bill-transfer',  rotulo: 'Ingressos de Recurso',  href: 'ingressos.html' },
    { id: 'contas',     icone: 'fa-file-invoice',         rotulo: 'Prestação de Contas',   embreve: true },
    { id: 'emendas',    icone: 'fa-landmark-dome',        rotulo: 'Emendas Parlamentares', embreve: true },
    { id: 'mapa',       icone: 'fa-map-location-dot',     rotulo: 'Mapa de Obras',         embreve: true },

    { secao: 'Desempenho IDTRU-DL' },
    { id: 'fiscalgov',  icone: 'fa-camera',               rotulo: 'FiscalGov · EX-01',     href: 'fiscalgov.html' },
    { id: 'indice',     icone: 'fa-star',                 rotulo: 'Índice Geral',          embreve: true }
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
    isMobile: isMobile
  };
  // Compatibilidade com onclick="" que já existiam nas páginas
  global.toggleSidebar = abrirFechar;
  global.toggleSidebarMobile = abrirFechar;
  global.instalarApp = instalar;

})(window);
