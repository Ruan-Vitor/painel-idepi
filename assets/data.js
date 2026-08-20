/* ══════════════════════════════════════════════════════════════════════════
   IDEPI — data.js
   Camada única de leitura de dados dos painéis.

   ANTES: cada HTML dava o seu próprio
       fetch("https://raw.githubusercontent.com/.../dados.json")
   e baixava o arquivo INTEIRO — inclusive o execucao.html, que precisa de um
   instrumento só mas puxava ~1 MB de execução financeira de todos.

   AGORA: o Firestore é a fonte, com os dados separados por assunto:

       painel/vigencias        { gerado_em, total, convenios[] }
       painel/repasses         { repasses_atualizado_em, historico_repasses{} }
       painel/exec_index       { exec_atualizado_em, instrumentos[] }   ← só o resumo
       exec_financeira/{num}   { ...dados completos de UM instrumento }

   Assim o painel de execução baixa 1 documento em vez de 98, e as regras do
   Firestore garantem que nada disso é legível sem login.

   PLANO B: enquanto o Firestore não estiver preenchido (ou se cair), lemos o
   dados.json antigo do GitHub. E, sem internet, servimos o último conteúdo
   guardado no aparelho — é o que faz o app instalado continuar útil em campo.
   ══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var IDEPI = global.IDEPI || (global.IDEPI = {});
  var opc = global.IDEPI_OPCOES || {};

  var TTL = (opc.cacheMinutos || 60) * 60 * 1000;
  var PREFIXO = 'idepi_cache_';

  /* ── CACHE LOCAL ───────────────────────────────────────────────────────── */

  function lerCache(chave) {
    try {
      var bruto = localStorage.getItem(PREFIXO + chave);
      if (!bruto) return null;
      var o = JSON.parse(bruto);
      return { dados: o.d, em: o.t, velho: (Date.now() - o.t) > TTL };
    } catch (e) { return null; }
  }

  function gravarCache(chave, dados) {
    try {
      localStorage.setItem(PREFIXO + chave, JSON.stringify({ t: Date.now(), d: dados }));
    } catch (e) {
      // Cota estourada: limpamos o cache antigo e desistimos em silêncio.
      // Ficar sem cache é degradação aceitável; travar a página não é.
      limparCache();
    }
  }

  function limparCache() {
    try {
      Object.keys(localStorage)
        .filter(function (k) { return k.indexOf(PREFIXO) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* ignora */ }
  }

  /* ── FONTE 1: FIRESTORE ────────────────────────────────────────────────── */

  function temFirestore() {
    return !!(IDEPI.auth && IDEPI.auth.configurado && IDEPI.auth.db);
  }

  function doc(colecao, id) {
    return IDEPI.auth.db.collection(colecao).doc(id).get().then(function (d) {
      return d.exists ? d.data() : null;
    });
  }

  /* ── FONTE 2: dados.json público no GitHub (legado) ────────────────────── */

  function baixarLegado() {
    var u = opc.githubUsuario || 'Ruan-Vitor';
    var r = opc.githubRepo || 'painel-idepi';
    var url = 'https://raw.githubusercontent.com/' + u + '/' + r +
              '/main/dados.json?t=' + Date.now();
    return fetch(url).then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     CARREGAMENTO PRINCIPAL — vigências + ingressos
     Devolve sempre o mesmo formato que o dados.json já tinha, para as
     páginas não precisarem saber de onde veio.
     ══════════════════════════════════════════════════════════════════════ */
  var _promessaPrincipal = null;

  function carregar(opcoes) {
    opcoes = opcoes || {};
    if (_promessaPrincipal && !opcoes.recarregar) return _promessaPrincipal;

    /* ── FONTE DA FICHA DO INSTRUMENTO (19/08/2026) ──────────────────────
       Registrada AQUI, e não em cada painel, porque todos passam por
       carregar(): uma linha em vez de seis, e painel novo já nasce com a
       ficha funcionando sem ninguém lembrar de ligá-la. A função só é
       chamada quando alguém abre a ficha, então lê sempre a versão mais
       recente do cache — registrar o array agora congelaria o vazio. */
    if (IDEPI.ficha && IDEPI.ficha.registrar)
      IDEPI.ficha.registrar({
        vigencias: function () {
          var c = lerCache('principal');
          return (c && c.dados && c.dados.convenios) || [];
        }
      });

    _promessaPrincipal = IDEPI.auth.pronto().then(function () {
      if (!temFirestore()) return viaLegado();

      return Promise.all([doc('painel', 'vigencias'), doc('painel', 'repasses')])
        .then(function (r) {
          var vig = r[0], rep = r[1];
          // Firestore vazio = migração ainda não rodou → cai no legado.
          if (!vig || !Array.isArray(vig.convenios)) return viaLegado();

          var saida = {
            gerado_em: vig.gerado_em || '',
            total: vig.total || vig.convenios.length,
            convenios: vig.convenios,
            /* Propostas ainda sem nº de instrumento. Viajam no mesmo
               documento das vigências (ver ler_propostas_vivas no
               publicar_firestore.py). Documento antigo não tem o campo —
               lista vazia é o certo, e a tela esconde o card. */
            propostas: vig.propostas || [],
            historico_repasses: (rep && rep.historico_repasses) || {},
            repasses_atualizado_em: (rep && rep.repasses_atualizado_em) || '',
            _origem: 'firestore'
          };
          gravarCache('principal', saida);
          return saida;
        })
        .catch(function (e) {
          console.warn('[IDEPI] Firestore indisponível:', e && e.message);
          return viaLegado();
        });
    });

    return _promessaPrincipal;
  }

  function viaLegado() {
    return baixarLegado()
      .then(function (j) {
        var saida = {
          gerado_em: j.gerado_em || '',
          total: j.total || (j.convenios || []).length,
          convenios: j.convenios || [],
          propostas: j.propostas || [],
          historico_repasses: j.historico_repasses || {},
          repasses_atualizado_em: j.repasses_atualizado_em || '',
          exec_financeira: j.exec_financeira || [],
          exec_atualizado_em: j.exec_atualizado_em || '',
          _origem: 'github'
        };
        gravarCache('principal', saida);
        return saida;
      })
      .catch(function (e) {
        var c = lerCache('principal');
        if (c) {
          c.dados._origem = 'cache';
          c.dados._cacheEm = c.em;
          return c.dados;
        }
        throw e;
      });
  }

  /* ══════════════════════════════════════════════════════════════════════
     EXECUÇÃO FINANCEIRA
     ══════════════════════════════════════════════════════════════════════ */

  /** Lista enxuta de instrumentos (número + objeto) para montar o seletor. */
  function execIndice() {
    return IDEPI.auth.pronto().then(function () {
      if (!temFirestore()) return execIndiceLegado();

      return doc('painel', 'exec_index')
        .then(function (d) {
          if (!d || !Array.isArray(d.instrumentos) || !d.instrumentos.length) {
            return execIndiceLegado();
          }
          gravarCache('exec_index', d);
          return d;
        })
        .catch(function () { return execIndiceLegado(); });
    });
  }

  function execIndiceLegado() {
    return carregar().then(function (j) {
      var lista = (j.exec_financeira || []).map(function (c) {
        return { numero: c.numero, objeto: c.objeto, coletado_em: c.coletado_em || '' };
      });
      return { exec_atualizado_em: j.exec_atualizado_em || '', instrumentos: lista };
    });
  }

  /** Dados completos de UM instrumento. */
  function execInstrumento(numero) {
    numero = String(numero);
    return IDEPI.auth.pronto().then(function () {
      if (!temFirestore()) return execInstrumentoLegado(numero);

      return doc('exec_financeira', numero)
        .then(function (d) {
          if (!d) return execInstrumentoLegado(numero);
          gravarCache('exec_' + numero, d);
          return d;
        })
        .catch(function () {
          var c = lerCache('exec_' + numero);
          if (c) return c.dados;
          return execInstrumentoLegado(numero);
        });
    });
  }

  function execInstrumentoLegado(numero) {
    return carregar().then(function (j) {
      return (j.exec_financeira || []).find(function (c) {
        return String(c.numero) === numero;
      }) || null;
    });
  }

  /* ── DIAGNÓSTICO ───────────────────────────────────────────────────────── */

  /** Texto curto para o header: quando e de onde vieram os dados. */
  function rotuloOrigem(j) {
    if (!j) return '—';
    if (j._origem === 'cache') {
      return 'Offline · dados de ' + new Date(j._cacheEm).toLocaleString('pt-BR');
    }
    return 'Atualizado ' + (j.gerado_em || '—');
  }

  /* ══════════════════════════════════════════════════════════════════════
     PRESTAÇÃO DE CONTAS FINAL
     ══════════════════════════════════════════════════════════════════════ */

  /** Documento painel/pcf, publicado pelo publicar_pcf.py.
   *
   *  Não tem plano B no GitHub como as vigências: a planilha de origem é de
   *  outra conta (idepconv@gmail.com) e nunca esteve no dados.json. Se o
   *  Firestore falhar, cai no cache local — e, sem ele, devolve vazio em vez
   *  de inventar. */
  function docDoPainel(nome, vazio) {
    return IDEPI.auth.pronto().then(function () {
      function doCache() {
        var c = lerCache(nome);
        return c ? c.dados : vazio;
      }
      if (!temFirestore()) return doCache();
      return doc('painel', nome)
        .then(function (d) {
          if (!d) return doCache();
          gravarCache(nome, d);
          return d;
        })
        .catch(doCache);
    });
  }

  function pcf() {
    return docDoPainel('pcf', { pcfs: [], total: 0, resumo: {} });
  }

  /** Documento painel/pagamentos, publicado pelo publicar_pagamentos.py.
   *  Mesma natureza da PCF: origem em planilha do setor, sem plano B no
   *  GitHub. */
  function pagamentos() {
    return docDoPainel('pagamentos', { pagamentos: [], total: 0, resumo: {} });
  }

  IDEPI.dados = {
    carregar: carregar,
    execIndice: execIndice,
    execInstrumento: execInstrumento,
    pcf: pcf,
    pagamentos: pagamentos,
    rotuloOrigem: rotuloOrigem,
    limparCache: limparCache
  };

})(window);
