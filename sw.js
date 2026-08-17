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
                 antes do login resolver e negava até para administradores
     v6 — 28/07: Ingressos com lista completa, busca própria, filtros por tipo
                 e ano, e aviso de lançamento em duplicidade
     v7 — 28/07: cards deixam de ser espremidos pelo flex do .scroll. Era o
                 mesmo defeito que cortou a lista de usuários: o card ficava
                 com 316px de altura para 1798px de conteúdo e o resto sumia
                 sem barra de rolagem
     v8 — 29/07: `[hidden]` volta a esconder de verdade (classe com display
                 fixo vencia o atributo, e a faixa de duplicidade aparecia
                 vazia); atalho "Histórico por convênio" no topo; busca da
                 tabela passa a achar por banco, agência e conta
     v9 — 03/08: "Aguardando Prestação de Contas" deixa de contar como
                 finalizado. O Transferegov nunca escreve "vencido": um
                 instrumento cuja vigência acabou sem PCF entregue aparece
                 com essa frase, e o termo solto "prestação de contas"
                 mandava justamente ele para o card de FINALIZADO. Agora vai
                 para VENCIDO. Só conta como finalizado a PCF já entregue
                 (enviada, em análise, aprovada, com ressalvas, concluída),
                 mais rescindido/encerrado/anulado. "Iniciada por
                 Antecipação" fica com a data, porque foi aberta antes do
                 fim da vigência. 6 convênios mudam de card
     v10..v18 — 03 a 05/08: painel geral refeito (legado x nova gestão, KPI de
                 eficiência, travados por suspensiva), painel de PCF, números
                 clicáveis, SEI múltiplo e fiscal no cabeçalho
     v19 — 05/08: movimentação CANCELADA sai de toda soma. No 838065 a soma dos
                 tributos passava R$ 2.851,20 do (bruto - líquido), e esses
                 R$ 2.851,20 eram exatamente a única linha cancelada
     v20..v22 — 05/08: card "Sem execução financeira" (90/180/360 dias), busca
                 nos quatro cards do painel geral, remoção de instrumento só
                 para admin, empresas pelos pagamentos quando não há contrato
     v23 — 06/08: correção do card de parada, que vinha zerado — diasAtras()
                 devolve TEXTO ("há 1476 dias") e a comparação com 90 era
                 sempre falsa; e do fmtBRL() inexistente, cujo ReferenceError
                 derrubava o card de contratos inteiro
     v24 — 06/08: marco do aditivo na execução financeira (Atalaia): antes do
                 marco conta como quitado, do marco em diante vale o rateio
                 por nota fiscal
     v25..v27 — 06/08: EX-01 deixa de cobrar relatório fotográfico de quem não
                 tem recurso federal ou está sem AIO emitida. A AIO é lida do
                 Checklist do contrato no Transferegov, não inferida
     v28 — 06/08: tela cheia e exportação em Excel nos quatro cards de lista do
                 painel geral (suspensiva, sem execução, repasse a receber,
                 contrapartida). Junto, a busca de repasse e contrapartida
                 voltou a funcionar: o filtro procurava só `.sus-item` e esses
                 dois cards desenham `.cp-item`, então a caixa nem aparecia
     v29 — 06/08: concedente e Novo PAC no cabeçalho do instrumento. O
                 concedente vem do documento de vigências: o campo de mesmo
                 nome no registro de execução guarda a MANDATÁRIA ("Caixa
                 ... (inferido)") e mostraria Caixa no lugar do ministério.
                 PAC é DERIVADO — Termo de Compromisso é a forma do Novo
                 PAC, direto com o ministério; não existe campo de PAC em
                 fonte nenhuma. São 5: 967173, 967182, 992850, 992940
                 e 965789
     v30 — 06/08: 7ª página — RELAÇÃO DE PAGAMENTOS. Qual medição foi paga,
                 em que processo SEI ela tramitou e quanto saiu; medições
                 pagas por mês (bruto x líquido, a diferença é a retenção);
                 e o mês atual com a previsão — pago + medições enviadas e
                 ainda não pagas. As 15 linhas sem data NÃO são descarte:
                 são medições na fila, e é delas que sai a previsão
     v31 — 06/08: rendimentos da aplicação dentro de cada instrumento —
                 disponível, já usado em pagamentos e total, com as notas
                 que consumiram rendimento. Junto, a correção de um dado
                 errado: `origem_recurso` dizia "Rendimento" em 507 de 578
                 NFs porque procurava a palavra no texto da página, e o
                 cabeçalho da tabela de rateio traz as três sempre. O
                 Atalaia aparecia com R$ 38,67 mi de rendimento; pagou ZERO.
                 Agora a origem sai dos VALORES dos itens. E o card do
                 aditivo deixou de embolar: rótulo e valor com explicação
                 disputavam a mesma linha num card estreito e quebravam um
                 por cima do outro
     v32 — 07/08: (1) o "espaco em branco" do Painel Geral: a .sr-only da
                 faixa de fase e `position:absolute` e o pai nao era
                 posicionado, entao cada uma escapava do corte e esticava a
                 pagina — 6.561px para 720px de conteudo. Uma linha de CSS.
                 (2) EX-01 do Painel Geral batia diferente do FiscalGov: a
                 pagina calculava sem juntar a execucao, logo sem `tem_aio`,
                 e nao dispensava ninguem (47 aptos x 45). A juncao passou
                 para o app.js. (3) ATALAIA: o pago deixou de ser a soma das
                 notas (R$ 40,3 mi) e passou a incluir o que o marco do
                 aditivo ja da por quitado — R$ 105,66 mi, 77% de execucao.
                 Repasse mostra recebido x previsto, contrapartida mostra
                 depositado, e os rendimentos separam liberado, aguardando
                 e disponivel. (4) pagamentos: mais recentes primeiro e o
                 bloco por mes recolhido
     v33 — 07/08: o RECEBIDO de repasse e o DEPOSITADO de contrapartida
                 passam a vir do historico de ingressos, que a varredura das
                 08:30 atualiza todo dia util — antes vinham do
                 marcos_aditivo.json, escrito a mao, e o painel diria
                 "a receber R$ 22.322.718,00" para sempre depois que a
                 parcela caisse. Os numeros de hoje sao os mesmos; o que
                 muda e que agora eles se corrigem sozinhos
     v34 — 13/08: clicar na EMPRESA abre um balao com o que ela mediu naquele
                 instrumento e no geral, instrumento a instrumento — a mesma
                 construtora toca obra em varios convenios. Quem junta as
                 grafias ('BS CONSTRUTORA' x 'B S Construtora Eireli') e o
                 Python, que publica `empresa_chave`; o balao mostra quais
                 grafias agrupou, porque somar empresa errada nao da erro na
                 tela, da um total que ninguem confere. "Ver so esta empresa"
                 filtra pela chave, entao traz tambem as linhas escritas de
                 outro jeito
     v35 — 13/08: dentro do balao, passar o mouse no instrumento mostra o
                 OBJETO da obra — so o numero do convenio nao basta para
                 reconhecer de qual se trata. Em tela de TOQUE, que nao tem
                 hover, o objeto vem escrito embaixo: esconder atras de hover
                 num celular e esconder para sempre
     v36 — 13/08: CONCEDENTE e MANDATARIA no detalhe de Vigencias. Nao faltava
                 dado: os 41 contratos de repasse tem Caixa desde sempre e o
                 concedente cobre 94 de 99 — faltava MOSTRAR. A pagina nem
                 juntava a execucao, entao o filtro por mandataria que ja
                 existia lia um campo que nunca chegava e vinha sempre vazio.
                 Convenio e Termo de Compromisso nao tem mandataria por
                 natureza (sao direto com o ministerio) e a linha diz isso, em
                 vez de um traco que parece dado faltando
     v37 — 13/08: ORGAO VINCULADO (quem executa: CODEVASF, FUNASA), LIMITE P/
                 PRESTACAO DE CONTAS e a ORIGEM da vigencia no detalhe de
                 Vigencias. Os tres vem do tgov_monitor, que passou a ler a
                 tela do instrumento — campos que estavam a vista e o projeto
                 nao lia. A vigencia passa a preferir o "Termino de Vigencia
                 Atual" do Transferegov: a CGU leva semanas para publicar um
                 aditivo e ate la o painel vence o convenio antes da hora.
                 A origem fica escrita ao lado da data
     v38 — 17/08: FICHA DO INSTRUMENTO na execucao financeira, que passa a ser
                 a pagina principal de cada instrumento — e para onde o numero
                 clicavel de todos os paineis ja apontava. Abre em janela por
                 cima (X, clique fora ou Esc), sem recarregar, para nao empurrar
                 os numeros de execucao para baixo da dobra. Traz MUNICIPIO,
                 FISCAL, CONTATO (ponto focal) e DONO DA EMENDA, os tres
                 ultimos vindos do controle do setor — nao existem na CGU nem
                 no Transferegov. Ponto focal so existe para os de 2023 em
                 diante; nos 40 do legado a planilha nao tem a coluna e a linha
                 diz "—" em vez de sumir. De quebra, a ficha que ja existia no
                 codigo desde 04/08 passou a APARECER: ela escrevia num
                 #fichaBasica que nunca existiu no HTML
     v39 — 17/08: STATUS DA PRESTACAO DE CONTAS FINAL na ficha: etapa, processo
                 SEI, situacao e a OBSERVACAO, que e a unica coluna que nenhum
                 script sabe preencher (vem do SEI, escrita a mao) e e o que diz
                 de quem o processo esta esperando. Vem de painel/pcf, que tem
                 regra propria no Firestore: quem nao tem o painel de PCF na
                 lista de permissoes simplesmente nao ve o bloco. O estado tem
                 TRES valores de proposito - lista vazia por falta de permissao
                 nao pode virar "nao ha PCF", que seria afirmar o que nao se
                 sabe. Carrega na 1a abertura da ficha, nao no start da pagina */
     v40 — 17/08: o botao "Ficha do instrumento" deixa de MORRER CALADO quando
                 o navegador tem o HTML novo e o app.js velho em cache. Foi o
                 que aconteceu entre 15:29 e 16:15 de 17/08: um 503 do GitHub
                 separou as publicacoes, o sw.js ficou em v37 e o app instalado
                 seguiu servindo o app.js sem abrirModal. Clicar lancava
                 TypeError no console e mostrava NADA. Agora avisa para
                 recarregar. Versao de HTML e de JS podem divergir sempre que o
                 cache entrar no meio; morrer calado nao e opcao */
const VERSAO = 'idepi-v40';
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
  'pcf.html',
  'pagamentos.html',
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
