/* ══════════════════════════════════════════════════════════════════════════
   IDEPI — auth.js
   Login, auto-cadastro com aprovação e administração de acessos.

   O QUE ISTO SUBSTITUI
   ────────────────────
   Até 26/07/2026 cada HTML tinha:

       var SENHA = "idepi2026";
       if (v === SENHA) { sessionStorage.setItem("idepi_auth","1"); ... }

   Isso não protegia nada: a senha estava no código-fonte da página, dava para
   pular a tela pelo console, e o dados.json era público de qualquer jeito.

   COMO FUNCIONA AGORA
   ───────────────────
   1. A pessoa cria a própria conta pela tela de login ("Solicitar acesso").
   2. Isso gera um pedido em `solicitacoes/{email}` com status "pendente".
      Ela NÃO vê nenhum dado ainda — só a tela de "aguardando aprovação".
   3. Um administrador abre o painel Administração, vê o pedido e aprova ou
      recusa. Aprovar cria `usuarios/{email}`, que é o que as Security Rules
      exigem para liberar a leitura.

   POR QUE O PEDIDO NÃO BASTA POR SI SÓ
   ────────────────────────────────────
   A apiKey do Firebase é pública (é assim que o serviço funciona) e o provedor
   e-mail/senha aceita auto-cadastro. Ou seja: criar conta é livre. O que separa
   "tem conta" de "tem permissão" é o documento em `usuarios` — e só admin
   consegue criá-lo. Sem essa separação, a proteção seria decorativa, como era
   a senha antiga.

   Depende de: firebase-config.js e do SDK compat do Firebase.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var IDEPI = global.IDEPI || (global.IDEPI = {});

  var cfg = global.IDEPI_FIREBASE || {};
  var opc = global.IDEPI_OPCOES || {};

  /* Enquanto o firebase-config.js não for preenchido, seguimos no modo antigo
     (dados públicos do GitHub) para o painel não sair do ar na migração. */
  var CONFIGURADO = !!(cfg.apiKey && cfg.apiKey.indexOf('COLE_') !== 0 &&
                       cfg.projectId && cfg.projectId.indexOf('COLE_') !== 0);

  var auth = null, db = null;
  var usuarioAtual = null;
  var prontos = [];          // callbacks aguardando a liberação
  var ignorarProximoEstado = false;   // usado durante o auto-cadastro

  /* ══════════════════════════════════════════════════════════════════════
     TELAS
     Tudo acontece dentro de #lockscreen, trocando só o cartão de dentro.
     ══════════════════════════════════════════════════════════════════════ */
  function caixa() {
    var lk = document.getElementById('lockscreen');
    if (!lk) {
      lk = document.createElement('div');
      lk.id = 'lockscreen';
      document.body.appendChild(lk);
    }
    lk.hidden = false;
    lk.style.display = '';
    return lk;
  }

  function esconderTela() {
    var l = document.getElementById('lockscreen');
    if (l) { l.hidden = true; l.style.display = 'none'; }
  }

  var CABECALHO =
    '<div class="lk-icon"><i class="fa-solid fa-lock"></i></div>' +
    '<div class="lk-title">IDEPI — Convênios Federais</div>';

  var RODAPE =
    '<div class="lk-foot">Instituto de Desenvolvimento do Piauí<br>Teresina-PI</div>';

  /* ── Tela 1: entrar ────────────────────────────────────────────────────── */
  function telaLogin(mensagem, tipo) {
    caixa().innerHTML =
      '<div class="lk-card">' + CABECALHO +
        '<div class="lk-sub">Acesso restrito a servidores autorizados.</div>' +
        '<form id="lkForm" autocomplete="on">' +
          '<input class="lk-input" id="lkEmail" type="email" inputmode="email" ' +
                 'autocomplete="username" placeholder="E-mail" required>' +
          '<input class="lk-input" id="lkSenha" type="password" ' +
                 'autocomplete="current-password" placeholder="Senha" required>' +
          '<div class="lk-msg" id="lkMsg"></div>' +
          '<button class="lk-btn" id="lkBtn" type="submit">Entrar</button>' +
        '</form>' +
        '<button class="lk-link" id="lkReset" type="button">Esqueci minha senha</button>' +
        '<div class="lk-sep"><span>ainda não tem acesso?</span></div>' +
        '<button class="lk-btn lk-btn-fora" id="lkIrCadastro" type="button">' +
          '<i class="fa-solid fa-user-plus"></i> Solicitar acesso</button>' +
      RODAPE + '</div>';

    document.getElementById('lkForm').addEventListener('submit', function (e) {
      e.preventDefault(); entrar();
    });
    document.getElementById('lkReset').addEventListener('click', recuperarSenha);
    document.getElementById('lkIrCadastro').addEventListener('click', function () {
      telaCadastro();
    });
    if (mensagem) msg(mensagem, tipo || 'err');
  }

  /* ── Tela 2: solicitar acesso ──────────────────────────────────────────── */
  function telaCadastro(mensagem, tipo) {
    caixa().innerHTML =
      '<div class="lk-card">' +
        '<div class="lk-icon"><i class="fa-solid fa-user-plus"></i></div>' +
        '<div class="lk-title">Solicitar acesso</div>' +
        '<div class="lk-sub">Crie sua conta. Um administrador do IDEPI precisa ' +
          'aprovar antes de você ver os dados.</div>' +
        '<form id="lkFormCad" autocomplete="on">' +
          '<input class="lk-input" id="lkNome" type="text" autocomplete="name" ' +
                 'placeholder="Nome completo" required>' +
          '<input class="lk-input" id="lkEmail" type="email" inputmode="email" ' +
                 'autocomplete="username" placeholder="E-mail institucional" required>' +
          '<input class="lk-input" id="lkSenha" type="password" ' +
                 'autocomplete="new-password" placeholder="Crie uma senha (mín. 8 caracteres)" ' +
                 'minlength="8" required>' +
          '<input class="lk-input" id="lkSenha2" type="password" ' +
                 'autocomplete="new-password" placeholder="Repita a senha" ' +
                 'minlength="8" required>' +
          '<div class="lk-msg" id="lkMsg"></div>' +
          '<button class="lk-btn" id="lkBtn" type="submit">Enviar solicitação</button>' +
        '</form>' +
        '<button class="lk-link" id="lkVoltar" type="button">Já tenho acesso — entrar</button>' +
      RODAPE + '</div>';

    document.getElementById('lkFormCad').addEventListener('submit', function (e) {
      e.preventDefault(); solicitarAcesso();
    });
    document.getElementById('lkVoltar').addEventListener('click', function () {
      telaLogin();
    });
    if (mensagem) msg(mensagem, tipo || 'err');
  }

  /* ── Tela 3: aguardando / recusado / sem pedido ────────────────────────── */
  function telaEstado(icone, titulo, texto, botoes) {
    caixa().innerHTML =
      '<div class="lk-card">' +
        '<div class="lk-icon"><i class="fa-solid ' + icone + '"></i></div>' +
        '<div class="lk-title">' + titulo + '</div>' +
        '<div class="lk-sub">' + texto + '</div>' +
        '<div class="lk-msg" id="lkMsg"></div>' +
        (botoes || '') +
      RODAPE + '</div>';
  }

  function telaAguardando(email) {
    telaEstado('fa-hourglass-half', 'Solicitação enviada',
      'Seu pedido de acesso para <strong>' + IDEPI.esc(email) + '</strong> está ' +
      'aguardando aprovação de um administrador do IDEPI.<br><br>' +
      'Avise a equipe para agilizar. Depois de aprovado, é só entrar normalmente.',
      '<button class="lk-btn" id="lkRever" type="button">Já fui aprovado — verificar</button>' +
      '<button class="lk-link" id="lkSair" type="button">Sair</button>');

    document.getElementById('lkRever').addEventListener('click', function () {
      location.reload();
    });
    document.getElementById('lkSair').addEventListener('click', sairSemConfirmar);
  }

  function telaRecusada(email, motivo) {
    telaEstado('fa-circle-xmark', 'Solicitação recusada',
      'O pedido de acesso para <strong>' + IDEPI.esc(email) + '</strong> não foi aprovado.' +
      (motivo ? '<br><br><em>' + IDEPI.esc(motivo) + '</em>' : '') +
      '<br><br>Se acredita que houve engano, procure a equipe do IDEPI.',
      '<button class="lk-link" id="lkSair" type="button">Sair</button>');
    document.getElementById('lkSair').addEventListener('click', sairSemConfirmar);
  }

  function telaSemPedido(email) {
    telaEstado('fa-user-clock', 'Conta sem acesso',
      'A conta <strong>' + IDEPI.esc(email) + '</strong> existe, mas ainda não tem ' +
      'permissão para ver os dados do painel.',
      '<button class="lk-btn" id="lkPedir" type="button">Solicitar acesso agora</button>' +
      '<button class="lk-link" id="lkSair" type="button">Sair</button>');

    document.getElementById('lkPedir').addEventListener('click', function () {
      ocupado(true, 'Enviando...');
      criarSolicitacao(usuarioAtual, usuarioAtual.displayName || email.split('@')[0])
        .then(function () { telaAguardando(email); })
        .catch(function (e) {
          ocupado(false);
          msg('Não foi possível enviar: ' + (e.message || e.code), 'err');
        });
    });
    document.getElementById('lkSair').addEventListener('click', sairSemConfirmar);
  }

  /* ── Utilidades das telas ──────────────────────────────────────────────── */
  function msg(texto, tipo) {
    var el = document.getElementById('lkMsg');
    if (!el) return;
    el.innerHTML = texto || '';
    el.className = 'lk-msg' + (tipo ? ' ' + tipo : '');
  }

  function ocupado(v, rotulo) {
    var b = document.getElementById('lkBtn');
    if (!b) return;
    b.disabled = v;
    if (v) { b.dataset.antes = b.dataset.antes || b.textContent; b.textContent = rotulo || 'Aguarde...'; }
    else if (b.dataset.antes) { b.textContent = b.dataset.antes; }
  }

  /* Mensagens do Firebase são em inglês e técnicas demais para o usuário. */
  function traduzirErro(e) {
    var c = (e && e.code) || '';
    if (c === 'auth/invalid-email')            return 'E-mail inválido.';
    if (c === 'auth/user-disabled')            return 'Este usuário está desativado. Procure o administrador.';
    if (c === 'auth/user-not-found' ||
        c === 'auth/wrong-password' ||
        c === 'auth/invalid-credential')       return 'E-mail ou senha incorretos.';
    if (c === 'auth/too-many-requests')        return 'Muitas tentativas seguidas. Aguarde alguns minutos.';
    if (c === 'auth/network-request-failed')   return 'Sem conexão com a internet.';
    if (c === 'auth/missing-password')         return 'Digite a senha.';
    if (c === 'auth/email-already-in-use')     return 'Já existe uma conta com este e-mail. Use "Já tenho acesso — entrar".';
    if (c === 'auth/weak-password')            return 'Senha muito fraca. Use pelo menos 8 caracteres.';
    if (c === 'auth/operation-not-allowed')    return 'O cadastro por e-mail/senha está desligado no Firebase.';

    // Acontece quando as Security Rules ainda são as antigas, sem a coleção
    // `solicitacoes`. A conta chega a ser criada, mas o pedido não é gravado.
    if (c === 'permission-denied' || c === 'PERMISSION_DENIED') {
      return 'Sua conta foi criada, mas o pedido não pôde ser registrado.<br>' +
             'O administrador precisa publicar a versão nova das regras do ' +
             'Firestore (firestore.rules). Avise a equipe e tente entrar depois.';
    }
    return 'Não foi possível concluir (' + (c || 'erro desconhecido') + ').';
  }

  function dominioOk(email) {
    if (!opc.dominioPermitido) return true;
    return email.slice(-(opc.dominioPermitido.length + 1)) === '@' + opc.dominioPermitido;
  }

  /* ══════════════════════════════════════════════════════════════════════
     AÇÕES
     ══════════════════════════════════════════════════════════════════════ */
  function entrar() {
    var email = (document.getElementById('lkEmail').value || '').trim().toLowerCase();
    var senha = document.getElementById('lkSenha').value || '';

    if (!email || !senha) { msg('Preencha e-mail e senha.', 'err'); return; }
    if (!dominioOk(email)) {
      msg('Use o e-mail institucional (@' + opc.dominioPermitido + ').', 'err');
      return;
    }

    ocupado(true, 'Entrando...');
    msg('');
    auth.signInWithEmailAndPassword(email, senha).catch(function (e) {
      ocupado(false);
      msg(traduzirErro(e), 'err');
    });
    // O sucesso é tratado em onAuthStateChanged.
  }

  function solicitarAcesso() {
    var nome   = (document.getElementById('lkNome').value  || '').trim();
    var email  = (document.getElementById('lkEmail').value || '').trim().toLowerCase();
    var senha  = document.getElementById('lkSenha').value  || '';
    var senha2 = document.getElementById('lkSenha2').value || '';

    if (nome.length < 3)   { msg('Digite seu nome completo.', 'err'); return; }
    if (senha !== senha2)  { msg('As duas senhas não são iguais.', 'err'); return; }
    if (senha.length < 8)  { msg('A senha precisa ter pelo menos 8 caracteres.', 'err'); return; }
    if (!dominioOk(email)) {
      msg('Use o e-mail institucional (@' + opc.dominioPermitido + ').', 'err');
      return;
    }

    ocupado(true, 'Enviando...');
    msg('');

    // O createUser já deixa a pessoa autenticada — e é justamente por estar
    // autenticada que ela consegue gravar o próprio pedido. A trava para não
    // mostrar a tela errada nesse meio-tempo é o ignorarProximoEstado.
    ignorarProximoEstado = true;
    auth.createUserWithEmailAndPassword(email, senha)
      .then(function (cred) {
        return cred.user.updateProfile({ displayName: nome })
          .catch(function () { /* não é crítico */ })
          .then(function () { return criarSolicitacao(cred.user, nome); });
      })
      .then(function () {
        ignorarProximoEstado = false;
        telaAguardando(email);
      })
      .catch(function (e) {
        ignorarProximoEstado = false;
        ocupado(false);
        console.error('[IDEPI] falha ao solicitar acesso:', e);
        msg(traduzirErro(e), 'err');
      });
  }

  function criarSolicitacao(user, nome) {
    return db.collection('solicitacoes').doc(user.email.toLowerCase()).set({
      email:      user.email.toLowerCase(),
      nome:       nome || user.displayName || '',
      uid:        user.uid,
      status:     'pendente',
      criado_em:  firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function recuperarSenha() {
    var campo = document.getElementById('lkEmail');
    var email = ((campo && campo.value) || '').trim().toLowerCase();
    if (!email) { msg('Digite seu e-mail acima e toque de novo.', 'err'); return; }
    auth.sendPasswordResetEmail(email)
      .then(function () { msg('Enviamos um link de redefinição para ' + IDEPI.esc(email) + '.', 'ok'); })
      .catch(function (e) { msg(traduzirErro(e), 'err'); });
  }

  function sairSemConfirmar() {
    if (auth) auth.signOut().then(function () { location.reload(); });
  }

  function sair() {
    if (!auth) return;
    if (!confirm('Sair do painel?')) return;
    auth.signOut().then(function () { location.reload(); });
  }

  /* ══════════════════════════════════════════════════════════════════════
     DECISÃO DE ACESSO
     ══════════════════════════════════════════════════════════════════════ */
  function avaliarAcesso(user) {
    var email = user.email.toLowerCase();

    return db.collection('usuarios').doc(email).get()
      .then(function (doc) {
        if (doc.exists) {
          var d = doc.data() || {};
          if (d.ativo === false) return { estado: 'inativo' };
          return { estado: 'liberado', perfil: d };
        }
        // Sem liberação: existe um pedido?
        return db.collection('solicitacoes').doc(email).get().then(function (s) {
          if (!s.exists) return { estado: 'sem_pedido' };
          var sd = s.data() || {};
          if (sd.status === 'recusada') return { estado: 'recusada', motivo: sd.motivo };
          return { estado: 'pendente' };
        });
      })
      .catch(function (e) {
        console.error('[IDEPI] falha ao verificar acesso:', e);
        return { estado: 'erro_regras' };
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
     HEADER DO USUÁRIO
     ══════════════════════════════════════════════════════════════════════ */
  function montarHeaderUsuario(user, perfil) {
    var alvo = document.querySelector('.hd-right');
    if (!alvo || document.getElementById('hdUser')) return;

    var nome = (perfil && perfil.nome) || user.displayName || user.email.split('@')[0];
    var iniciais = nome.trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p[0]; }).join('');
    var ehAdm = perfil && perfil.papel === 'admin';

    var box = document.createElement('div');
    box.className = 'hd-user';
    box.id = 'hdUser';
    box.innerHTML =
      '<div class="hd-user-av" title="' + IDEPI.esc(user.email) + '">' + IDEPI.esc(iniciais) + '</div>' +
      '<span class="hd-user-nome">' + IDEPI.esc(nome) +
        (ehAdm ? ' <span class="hd-user-papel">admin</span>' : '') + '</span>' +
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
    document.dispatchEvent(new CustomEvent('idepi-auth', {
      detail: { usuario: user, perfil: perfil, admin: !!(perfil && perfil.papel === 'admin') }
    }));
  }

  function iniciar() {
    if (!CONFIGURADO) {
      console.warn('[IDEPI] Firebase não configurado — preencha assets/firebase-config.js. ' +
                   'O painel está SEM proteção de acesso.');
      esconderTela();
      liberar(null, null);
      return;
    }

    if (typeof firebase === 'undefined') {
      telaLogin('Não foi possível carregar o Firebase. Verifique a conexão.');
      return;
    }

    if (!firebase.apps.length) firebase.initializeApp(cfg);
    auth = firebase.auth();
    db   = firebase.firestore();
    IDEPI.auth.db = db;

    // LOCAL = a sessão sobrevive a fechar o app. Essencial no celular: com
    // persistência de sessão, o app instalado pedia senha a cada abertura.
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});

    caixa();

    auth.onAuthStateChanged(function (user) {
      if (ignorarProximoEstado) return;   // estamos no meio do auto-cadastro

      if (!user) { telaLogin(); return; }

      avaliarAcesso(user).then(function (r) {
        usuarioAtual = user;
        var email = user.email.toLowerCase();

        switch (r.estado) {
          case 'liberado':
            liberar(user, r.perfil);
            break;
          case 'pendente':
            telaAguardando(email);
            break;
          case 'recusada':
            telaRecusada(email, r.motivo);
            break;
          case 'sem_pedido':
            telaSemPedido(email);
            break;
          case 'inativo':
            telaEstado('fa-user-slash', 'Acesso desativado',
              'O acesso de <strong>' + IDEPI.esc(email) + '</strong> foi desativado ' +
              'por um administrador.',
              '<button class="lk-link" id="lkSair" type="button">Sair</button>');
            document.getElementById('lkSair').addEventListener('click', sairSemConfirmar);
            break;
          default:
            telaEstado('fa-triangle-exclamation', 'Não foi possível verificar seu acesso',
              'As regras de segurança do Firestore podem não ter sido publicadas, ' +
              'ou houve falha de conexão.',
              '<button class="lk-btn" id="lkRever" type="button">Tentar de novo</button>' +
              '<button class="lk-link" id="lkSair" type="button">Sair</button>');
            document.getElementById('lkRever').addEventListener('click', function () { location.reload(); });
            document.getElementById('lkSair').addEventListener('click', sairSemConfirmar);
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     PERMISSÃO POR PAINEL

     Cada usuário tem uma lista `paineis` no perfil. Quem não a tiver vê tudo
     (é o caso de quem foi cadastrado antes desta funcionalidade — mudar isso
     retroativamente tiraria acesso de gente que já trabalha com o painel).

     O Painel Geral é sempre liberado: é a porta de entrada e mostra apenas
     números agregados.

     ⚠️  ALCANCE DESTA TRAVA — leia antes de confiar nela:
     Esconder o item do menu é conveniência, não segurança. A trava de verdade
     está nas Security Rules do Firestore, e ela alcança:
        • Ingressos de Recurso   → painel/repasses          ✅ trava real
        • Execução Financeira    → exec_financeira/*        ✅ trava real
        • Vigências e FiscalGov  → painel/vigencias         ⚠️  só na interface
     Vigências e FiscalGov leem o MESMO documento que o Painel Geral precisa
     para montar os totais. Enquanto for assim, quem souber usar o console do
     navegador consegue ler a lista de convênios mesmo sem o painel liberado.
     Para virar trava real, o Painel Geral precisaria ler um documento só de
     agregados (painel/resumo), separado da lista de convênios.
     ══════════════════════════════════════════════════════════════════════ */

  /* Esta lista é o que o admin.html usa para desenhar os botões de liberar
     painel. Painel novo TEM de entrar aqui, senão ele não aparece na tela de
     permissões e ninguém com lista explícita consegue recebê-lo — foi o que
     aconteceu com a PCF em 04/08/2026, que só abria para quem não tinha
     lista nenhuma.

     Ela também precisa combinar com PAINEIS_VALIDOS no publicar_firestore.py
     e com as regras do firestore.rules. */
  var PAINEIS = ['vigencias', 'execucao', 'ingressos', 'fiscalgov', 'pcf'];

  /** Um leitor pode abrir este painel? Admin e Painel Geral sempre podem. */
  function podeVer(painel) {
    if (!CONFIGURADO) return true;              // modo transição, sem login
    if (painel === 'index' || !painel) return true;
    var p = IDEPI.auth.perfil;
    if (!p) return false;
    if (p.papel === 'admin') return true;
    if (!Array.isArray(p.paineis)) return true; // perfil antigo: vê tudo
    return p.paineis.indexOf(painel) !== -1;
  }

  /**
   * A forma CERTA de proteger uma página. Espera o login resolver e só então
   * decide — chamando `aoLiberar()` se puder, ou trocando a tela pelo aviso.
   *
   * ⚠️  POR QUE ISTO EXISTE, e não só o exigirPainel():
   * Em 28/07/2026 três páginas chamavam exigirPainel() na hora em que o script
   * era lido, antes de o Firebase confirmar quem era o usuário. Nesse instante
   * o perfil ainda é null, então a resposta era sempre "não pode" — e até
   * administradores viam "Você não tem acesso a este painel".
   *
   * Use SEMPRE comPainel(). Ele não tem como ser chamado cedo demais.
   */
  function comPainel(painel, aoLiberar) {
    IDEPI.auth.aoEntrar(function () {
      if (exigirPainel(painel) && typeof aoLiberar === 'function') aoLiberar();
    });
  }

  /**
   * Decide na hora, com o perfil que já estiver carregado. Só chame depois do
   * login resolver — na prática, de dentro do comPainel() ou do aoEntrar().
   */
  function exigirPainel(painel) {
    // Rede de proteção: chamado cedo demais, avisa em vez de negar em silêncio.
    if (CONFIGURADO && !usuarioAtual) {
      console.warn('[IDEPI] exigirPainel("' + painel + '") foi chamado antes do ' +
                   'login resolver. Use IDEPI.auth.comPainel(painel, callback).');
      return false;
    }
    if (podeVer(painel)) return true;

    var NOMES = {
      vigencias: 'Vigências',
      execucao:  'Execução Financeira',
      ingressos: 'Ingressos de Recurso',
      fiscalgov: 'FiscalGov · EX-01'
    };

    esconderTela();
    var alvo = document.querySelector('.scroll') || document.body;
    alvo.innerHTML =
      '<div class="sem-permissao">' +
        '<i class="fa-solid fa-lock"></i>' +
        '<strong>Você não tem acesso ao painel ' + IDEPI.esc(NOMES[painel] || painel) + '</strong>' +
        '<p>Seu acesso ao sistema está ativo, mas este painel não foi liberado ' +
          'para o seu usuário.<br>Peça a um administrador do IDEPI se precisar dele.</p>' +
        '<a class="lk-btn" style="max-width:260px;margin:18px auto 0;text-decoration:none;' +
          'display:flex;align-items:center;justify-content:center;gap:8px" href="index.html">' +
          '<i class="fa-solid fa-arrow-left"></i> Voltar ao Painel Geral</a>' +
      '</div>';
    IDEPI.esconderOverlay();
    return false;
  }

  /* ══════════════════════════════════════════════════════════════════════
     ADMINISTRAÇÃO — usado por admin.html
     Só funciona para quem tem papel "admin"; as Security Rules recusam o resto.
     ══════════════════════════════════════════════════════════════════════ */
  var admin = {
    ehAdmin: function () {
      return !!(IDEPI.auth.perfil && IDEPI.auth.perfil.papel === 'admin');
    },

    listarSolicitacoes: function (status) {
      var q = db.collection('solicitacoes');
      if (status) q = q.where('status', '==', status);
      return q.get().then(function (snap) {
        return snap.docs.map(function (d) {
          var o = d.data() || {};
          o._id = d.id;
          return o;
        });
      });
    },

    contarPendentes: function () {
      return db.collection('solicitacoes').where('status', '==', 'pendente').get()
        .then(function (s) { return s.size; })
        .catch(function () { return 0; });
    },

    listarUsuarios: function () {
      return db.collection('usuarios').get().then(function (snap) {
        return snap.docs.map(function (d) {
          var o = d.data() || {};
          o._id = d.id;
          return o;
        });
      });
    },

    /** Aprovar = criar o documento em `usuarios`. É o que libera os dados. */
    aprovar: function (email, papel) {
      email = String(email).toLowerCase();
      var quem = (IDEPI.auth.usuario && IDEPI.auth.usuario.email) || '';
      var lote = db.batch();

      lote.set(db.collection('usuarios').doc(email), {
        nome:       '',   // preenchido abaixo com o nome da solicitação
        ativo:      true,
        papel:      papel || 'leitor',
        criado_em:  firebase.firestore.FieldValue.serverTimestamp(),
        aprovado_por: quem
      }, { merge: true });

      lote.update(db.collection('solicitacoes').doc(email), {
        status:        'aprovada',
        decidido_em:   firebase.firestore.FieldValue.serverTimestamp(),
        decidido_por:  quem
      });

      return db.collection('solicitacoes').doc(email).get()
        .then(function (s) {
          var nome = (s.exists && (s.data() || {}).nome) || email.split('@')[0];
          lote.set(db.collection('usuarios').doc(email), { nome: nome }, { merge: true });
          return lote.commit();
        });
    },

    recusar: function (email, motivo) {
      email = String(email).toLowerCase();
      return db.collection('solicitacoes').doc(email).update({
        status:       'recusada',
        motivo:       motivo || '',
        decidido_em:  firebase.firestore.FieldValue.serverTimestamp(),
        decidido_por: (IDEPI.auth.usuario && IDEPI.auth.usuario.email) || ''
      });
    },

    definirAtivo: function (email, ativo) {
      return db.collection('usuarios').doc(String(email).toLowerCase())
        .set({ ativo: !!ativo }, { merge: true });
    },

    definirPapel: function (email, papel) {
      return db.collection('usuarios').doc(String(email).toLowerCase())
        .set({ papel: papel }, { merge: true });
    },

    /** Define quais painéis o usuário enxerga. Lista vazia = só o Painel Geral. */
    definirPaineis: function (email, paineis) {
      return db.collection('usuarios').doc(String(email).toLowerCase())
        .set({ paineis: paineis || [] }, { merge: true });
    },

    PAINEIS: PAINEIS,

    /** Remove o acesso. A conta continua existindo no Authentication. */
    remover: function (email) {
      email = String(email).toLowerCase();
      var lote = db.batch();
      lote.delete(db.collection('usuarios').doc(email));
      lote.delete(db.collection('solicitacoes').doc(email));
      return lote.commit();
    }
  };

  /* ── API PÚBLICA ───────────────────────────────────────────────────────── */
  IDEPI.auth = {
    configurado: CONFIGURADO,
    usuario: null,
    perfil: null,
    db: null,
    sair: sair,
    admin: admin,

    ehAdmin: function () { return admin.ehAdmin(); },
    podeVer: podeVer,
    comPainel: comPainel,       // ← use este nas páginas
    exigirPainel: exigirPainel, // só depois do login resolver
    PAINEIS: PAINEIS,

    /** Executa `fn` assim que houver acesso liberado (ou já liberado). */
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
