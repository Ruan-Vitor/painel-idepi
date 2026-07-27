/* ══════════════════════════════════════════════════════════════════════════
   IDEPI — auth.js
   Login real com Firebase Authentication.

   O QUE ISTO SUBSTITUI
   ────────────────────
   Até 26/07/2026 cada HTML tinha:

       var SENHA = "idepi2026";
       if (v === SENHA) { sessionStorage.setItem("idepi_auth","1"); ... }

   Isso não protegia nada: a senha estava escrita no código-fonte da página
   (Ctrl+U mostra), e dava para pular a tela inteira digitando
   `sessionStorage.idepi_auth=1` no console — ou simplesmente abrindo o
   dados.json direto no GitHub, que era público.

   COMO FUNCIONA AGORA
   ───────────────────
   • O usuário entra com e-mail e senha cadastrados no Firebase.
   • Só passa quem tiver um documento em `usuarios/{email}` no Firestore.
     (Sem essa lista, qualquer pessoa poderia se auto-cadastrar no projeto.)
   • Os dados moram no Firestore com Security Rules que exigem o login —
     não existe mais URL pública com os convênios.
   • A sessão é persistida pelo próprio Firebase (LOCAL): quem instalou o app
     no celular não precisa digitar a senha toda vez.

   Depende de: firebase-config.js e do SDK compat do Firebase (ver os <script>
   no <head> das páginas).
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var IDEPI = global.IDEPI || (global.IDEPI = {});

  var cfg = global.IDEPI_FIREBASE || {};
  var opc = global.IDEPI_OPCOES || {};

  /* Enquanto o firebase-config.js não for preenchido, seguimos no modo antigo
     (dados públicos do GitHub) para o painel não sair do ar durante a migração. */
  var CONFIGURADO = !!(cfg.apiKey && cfg.apiKey.indexOf('COLE_') !== 0 &&
                       cfg.projectId && cfg.projectId.indexOf('COLE_') !== 0);

  var app = null, auth = null, db = null;
  var usuarioAtual = null;
  var prontos = [];        // callbacks aguardando o login concluir

  /* ══════════════════════════════════════════════════════════════════════
     TELA DE LOGIN
     ══════════════════════════════════════════════════════════════════════ */
  function montarTela() {
    var lk = document.getElementById('lockscreen');
    if (!lk) {
      lk = document.createElement('div');
      lk.id = 'lockscreen';
      document.body.appendChild(lk);
    }
    lk.innerHTML =
      '<div class="lk-card">' +
        '<div class="lk-icon"><i class="fa-solid fa-lock"></i></div>' +
        '<div class="lk-title">IDEPI — Convênios Federais</div>' +
        '<div class="lk-sub" id="lkSub">Acesso restrito a servidores autorizados.</div>' +
        '<form id="lkForm" autocomplete="on">' +
          '<input class="lk-input" id="lkEmail" type="email" inputmode="email" ' +
                 'autocomplete="username" placeholder="E-mail institucional" required>' +
          '<input class="lk-input" id="lkSenha" type="password" ' +
                 'autocomplete="current-password" placeholder="Senha" required>' +
          '<div class="lk-msg" id="lkMsg"></div>' +
          '<button class="lk-btn" id="lkBtn" type="submit">Entrar</button>' +
        '</form>' +
        '<button class="lk-link" id="lkReset" type="button">Esqueci minha senha</button>' +
        '<div class="lk-foot">Instituto de Desenvolvimento do Piauí<br>Teresina-PI</div>' +
      '</div>';

    document.getElementById('lkForm').addEventListener('submit', function (e) {
      e.preventDefault();
      entrar();
    });
    document.getElementById('lkReset').addEventListener('click', recuperarSenha);
    return lk;
  }

  function mostrarTela()  { var l = document.getElementById('lockscreen'); if (l) { l.hidden = false; l.style.display = ''; } }
  function esconderTela() { var l = document.getElementById('lockscreen'); if (l) { l.hidden = true;  l.style.display = 'none'; } }

  function msg(texto, tipo) {
    var el = document.getElementById('lkMsg');
    if (!el) return;
    el.textContent = texto || '';
    el.className = 'lk-msg' + (tipo ? ' ' + tipo : '');
  }

  function ocupado(v) {
    var b = document.getElementById('lkBtn');
    if (!b) return;
    b.disabled = v;
    b.textContent = v ? 'Entrando...' : 'Entrar';
  }

  /* Mensagens do Firebase são em inglês e técnicas demais para o usuário final. */
  function traduzirErro(e) {
    var c = (e && e.code) || '';
    if (c === 'auth/invalid-email')          return 'E-mail inválido.';
    if (c === 'auth/user-disabled')          return 'Este usuário está desativado. Procure o administrador.';
    if (c === 'auth/user-not-found' ||
        c === 'auth/wrong-password' ||
        c === 'auth/invalid-credential')     return 'E-mail ou senha incorretos.';
    if (c === 'auth/too-many-requests')      return 'Muitas tentativas seguidas. Aguarde alguns minutos.';
    if (c === 'auth/network-request-failed') return 'Sem conexão com a internet.';
    if (c === 'auth/missing-password')       return 'Digite a senha.';
    return 'Não foi possível entrar (' + (c || 'erro desconhecido') + ').';
  }

  /* ══════════════════════════════════════════════════════════════════════
     AÇÕES
     ══════════════════════════════════════════════════════════════════════ */
  function entrar() {
    var email = (document.getElementById('lkEmail').value || '').trim().toLowerCase();
    var senha = document.getElementById('lkSenha').value || '';

    if (!email || !senha) { msg('Preencha e-mail e senha.', 'err'); return; }

    if (opc.dominioPermitido && email.slice(-(opc.dominioPermitido.length + 1)) !== '@' + opc.dominioPermitido) {
      msg('Use o e-mail institucional (@' + opc.dominioPermitido + ').', 'err');
      return;
    }

    ocupado(true);
    msg('');
    auth.signInWithEmailAndPassword(email, senha)
      .catch(function (e) {
        ocupado(false);
        msg(traduzirErro(e), 'err');
      });
    // O sucesso é tratado em onAuthStateChanged (que também checa a allowlist).
  }

  function recuperarSenha() {
    var email = (document.getElementById('lkEmail').value || '').trim().toLowerCase();
    if (!email) { msg('Digite seu e-mail acima e toque de novo.', 'err'); return; }
    auth.sendPasswordResetEmail(email)
      .then(function () { msg('Enviamos um link de redefinição para ' + email + '.', 'ok'); })
      .catch(function (e) { msg(traduzirErro(e), 'err'); });
  }

  function sair() {
    if (!auth) return;
    if (!confirm('Sair do painel?')) return;
    auth.signOut().then(function () { location.reload(); });
  }

  /**
   * Confere se o e-mail está na lista de autorizados (`usuarios/{email}`).
   * Sem esta checagem, bastaria a apiKey — que é pública — para alguém criar
   * uma conta pelo endpoint REST do Firebase e cair dentro das regras.
   */
  function verificarAutorizacao(user) {
    return db.collection('usuarios').doc(user.email.toLowerCase()).get()
      .then(function (doc) {
        if (!doc.exists) return { ok: false, motivo: 'nao_cadastrado' };
        var d = doc.data() || {};
        if (d.ativo === false) return { ok: false, motivo: 'inativo' };
        return { ok: true, perfil: d };
      })
      .catch(function (e) {
        // Erro de permissão aqui = as regras do Firestore não foram publicadas.
        console.error('[IDEPI] Falha ao verificar autorização:', e);
        return { ok: false, motivo: 'regras' };
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
     IDENTIFICAÇÃO NO HEADER
     ══════════════════════════════════════════════════════════════════════ */
  function montarHeaderUsuario(user, perfil) {
    var alvo = document.querySelector('.hd-right');
    if (!alvo || document.getElementById('hdUser')) return;

    var nome = (perfil && perfil.nome) || user.displayName || user.email.split('@')[0];
    var iniciais = nome.trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p[0]; }).join('');

    var box = document.createElement('div');
    box.className = 'hd-user';
    box.id = 'hdUser';
    box.innerHTML =
      '<div class="hd-user-av" title="' + IDEPI.esc(user.email) + '">' + IDEPI.esc(iniciais) + '</div>' +
      '<span class="hd-user-nome">' + IDEPI.esc(nome) + '</span>' +
      '<button class="hd-btn" id="btnSair" type="button" title="Sair do painel" aria-label="Sair">' +
        '<i class="fa-solid fa-right-from-bracket"></i></button>';
    alvo.appendChild(box);
    document.getElementById('btnSair').addEventListener('click', sair);
  }

  /* ══════════════════════════════════════════════════════════════════════
     INICIALIZAÇÃO
     ══════════════════════════════════════════════════════════════════════ */
  function liberar(user, perfil) {
    usuarioAtual = user;
    IDEPI.auth.usuario = user;
    IDEPI.auth.perfil = perfil || null;
    esconderTela();
    if (user) montarHeaderUsuario(user, perfil);
    prontos.forEach(function (fn) { try { fn(user); } catch (e) { console.error(e); } });
    prontos = [];
    document.dispatchEvent(new CustomEvent('idepi-auth', { detail: { usuario: user } }));
  }

  function iniciar() {
    if (!CONFIGURADO) {
      // Modo transição: Firebase ainda não configurado.
      console.warn('[IDEPI] Firebase não configurado — preencha assets/firebase-config.js. ' +
                   'O painel está SEM proteção de acesso.');
      esconderTela();
      liberar(null, null);
      return;
    }

    if (typeof firebase === 'undefined') {
      montarTela(); mostrarTela();
      msg('Não foi possível carregar o Firebase. Verifique a conexão.', 'err');
      return;
    }

    app  = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    auth = firebase.auth();
    db   = firebase.firestore();
    IDEPI.auth.db = db;

    // LOCAL = a sessão sobrevive a fechar o app. Essencial no celular:
    // com a persistência de sessão, o PWA pedia senha a cada abertura.
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});

    montarTela();

    auth.onAuthStateChanged(function (user) {
      if (!user) { ocupado(false); mostrarTela(); return; }

      verificarAutorizacao(user).then(function (r) {
        if (r.ok) { liberar(user, r.perfil); return; }

        ocupado(false);
        mostrarTela();
        auth.signOut();
        if (r.motivo === 'nao_cadastrado') {
          msg('Sua conta existe, mas não está liberada para este painel. ' +
              'Peça ao administrador para cadastrar ' + user.email + '.', 'err');
        } else if (r.motivo === 'inativo') {
          msg('Seu acesso foi desativado.', 'err');
        } else {
          msg('As regras de segurança do Firestore ainda não foram publicadas.', 'err');
        }
      });
    });
  }

  /* ── API PÚBLICA ───────────────────────────────────────────────────────── */
  IDEPI.auth = {
    configurado: CONFIGURADO,
    usuario: null,
    perfil: null,
    db: null,
    sair: sair,

    /** Executa `fn` assim que houver um usuário autenticado (ou já autenticado). */
    aoEntrar: function (fn) {
      if (usuarioAtual || !CONFIGURADO) { fn(usuarioAtual); return; }
      prontos.push(fn);
    },

    /** Promise que resolve quando o acesso estiver liberado. */
    pronto: function () {
      return new Promise(function (resolve) { IDEPI.auth.aoEntrar(resolve); });
    }
  };
  global.sairDoPainel = sair;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

})(window);
