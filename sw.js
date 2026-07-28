/* ══════════════════════════════════════════════════════════════════════════
   IDEPI — sw.js (service worker)

   É o que transforma o site em aplicativo instalável e faz ele abrir mesmo
   sem internet.

   ESTRATÉGIAS (deliberadamente diferentes por tipo de arquivo)
   ────────────────────────────────────────────────────────────
   • Páginas (.html)  → REDE PRIMEIRO, cache como reserva.
     Motivo: o main.py republica os HTMLs a cada execução. Se servíssemos do
     cache primeiro, o servidor teria versão nova e o usuário continuaria na
     antiga por dias — um jeito clássico de "corrigi o bug e não mudou nada".

   • CSS/JS/ícones    → CACHE PRIMEIRO, revalidando por trás.
     Motivo: abrir instantâneo. A troca de VERSAO abaixo força a renovação.

   • Firebase e APIs  → NUNCA passam por aqui.
     Motivo: são dados autenticados e vivos; cachear resposta de API com
     credencial é pedido de dado errado (ou vazado) na tela.

   AO PUBLICAR UMA MUDANÇA: incremente VERSAO. É o que apaga os caches
   antigos de todo mundo.
   ══════════════════════════════════════════════════════════════════════════ */

/* Histórico de versões (subir a VERSAO é o que apaga o cache dos aparelhos
   já instalados — sem isso, quem instalou o app continua na versão antiga):
     v2 — 27/07: admin.html e auto-cadastro no auth.js
     v3 — 27/07: leitura de texto longo (objeto do convênio) e tabelas que
                 viram cartão no celular — mudou app.css e app.js
     v4 — 28/07: permissão por painel (auth.js, nav.js, admin.html) e correção
                 do corte na lista de usuários
     v5 — 28/07: correção do bloqueio indevido — a checagem de painel rodava
                 antes do login resolver e negava até para administradores */
const VERSAO = 'idepi-v5';
const CACHE_SHELL = VERSAO + '-shell';
const CACHE_PAGS  = VERSAO + '-paginas';

/* Arquivos que fazem o app abrir sozinho na primeira vez. */
const SHELL = [
  './',
  'index.html',
  'vigencias.html',
  'execucao.html',
  'fiscalgov.html',
  'ingressos.html',
  'admin.html',
  'assets/app.css',
  'assets/app.js',
  'assets/nav.js',
  'assets/auth.js',
  'assets/data.js',
  'assets/firebase-config.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

/* Domínios que o service worker deve ignorar por completo. */
const IGNORAR = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.googleapis.com',
  'raw.githubusercontent.com',
  'api.github.com'
];

/* ── INSTALAÇÃO ────────────────────────────────────────────────────────── */
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_SHELL)
      // addAll é "tudo ou nada": um 404 em qualquer item aborta a instalação
      // inteira. Guardamos um a um para o app instalar mesmo se faltar algo.
      .then((cache) => Promise.all(
        SHELL.map((url) => cache.add(url).catch((e) => {
          console.warn('[SW] não consegui guardar', url, e && e.message);
        }))
      ))
      .then(() => self.skipWaiting())
  );
});

/* ── ATIVAÇÃO — remove caches de versões anteriores ────────────────────── */
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── REQUISIÇÕES ───────────────────────────────────────────────────────── */
self.addEventListener('fetch', (evento) => {
  const req = evento.request;

  // Só interceptamos GET. POST/PUT vão direto para a rede.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Dados autenticados e chamadas de API passam batido.
  if (IGNORAR.some((h) => url.hostname.endsWith(h))) return;

  // Navegação (abrir uma página): rede primeiro.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    evento.respondWith(redePrimeiro(req));
    return;
  }

  // Recursos de outros domínios (fontes, Font Awesome, SheetJS, SDK do
  // Firebase): guardamos silenciosamente para o app funcionar offline.
  if (url.origin !== self.location.origin) {
    evento.respondWith(cachePrimeiro(req, CACHE_SHELL));
    return;
  }

  // Nossos próprios estáticos.
  evento.respondWith(cachePrimeiro(req, CACHE_SHELL));
});

/* ── ESTRATÉGIAS ───────────────────────────────────────────────────────── */

function redePrimeiro(req) {
  return fetch(req)
    .then((resp) => {
      if (resp && resp.status === 200) {
        const copia = resp.clone();
        caches.open(CACHE_PAGS).then((c) => c.put(req, copia));
      }
      return resp;
    })
    .catch(() => caches.match(req).then((c) => c || caches.match('index.html')));
}

function cachePrimeiro(req, nomeCache) {
  return caches.match(req).then((guardado) => {
    // Mesmo com resposta em cache, buscamos por trás para a próxima abertura
    // já vir atualizada (stale-while-revalidate).
    const rede = fetch(req)
      .then((resp) => {
        // Respostas opacas (CDN sem CORS) têm status 0 — guardamos assim mesmo,
        // é o único jeito de servir Font Awesome offline.
        if (resp && (resp.status === 200 || resp.type === 'opaque')) {
          const copia = resp.clone();
          caches.open(nomeCache).then((c) => c.put(req, copia));
        }
        return resp;
      })
      .catch(() => guardado);

    return guardado || rede;
  });
}

/* Permite que a página force a atualização do worker (botão "Atualizar"). */
self.addEventListener('message', (evento) => {
  if (evento.data === 'pular-espera') self.skipWaiting();
});
