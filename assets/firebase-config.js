/* ══════════════════════════════════════════════════════════════════════════
   IDEPI — firebase-config.js
   ─────────────────────────────────────────────────────────────────────────
   ⚠️  PREENCHA ESTE ARQUIVO ANTES DE PUBLICAR. Enquanto os campos estiverem
       com "COLE_...", o painel continua funcionando no modo antigo (lendo o
       dados.json público do GitHub) e o login fica desligado.

   ONDE PEGAR ESSES VALORES
   ───────────────────────
   1. Acesse https://console.firebase.google.com e crie o projeto (ex.: "idepi-painel").
   2. Menu ⚙️ → Configurações do projeto → aba "Geral".
   3. Em "Seus aplicativos", clique no ícone </> (Web) e registre um app
      (ex.: apelido "Painel IDEPI"). NÃO precisa marcar Firebase Hosting.
   4. O console mostra um bloco `const firebaseConfig = { ... }`.
      Copie cada valor para o objeto abaixo.
   5. Ative os serviços:
      • Criação → Authentication → Começar → aba "Sign-in method"
        → ative "E-mail/senha".
      • Criação → Firestore Database → Criar banco de dados
        → escolha a região southamerica-east1 (São Paulo)
        → comece em "modo de produção".
   6. Publique as regras do arquivo firestore.rules
      (Firestore → aba "Regras" → cole → Publicar).
   7. Rode `py publicar_firestore.py --tudo` para subir os dados.
   8. Cadastre os usuários: `py publicar_firestore.py --novo-usuario email@idepi.pi.gov.br`

   É SEGURO DEIXAR ESTA CHAVE NO CÓDIGO?
   ─────────────────────────────────────
   Sim. A apiKey do Firebase é um identificador público, não um segredo — ela
   só diz "qual projeto". Quem protege os dados são as Security Rules do
   Firestore (firestore.rules) somadas ao login. É por isso que a lista de
   usuários autorizados (coleção `usuarios`) é obrigatória: sem ela, qualquer
   pessoa poderia criar uma conta no projeto e passar pelas regras.

   O QUE NUNCA PODE VIR PARA CÁ
   ────────────────────────────
   O arquivo de service account (firebase-admin.json), o GITHUB_TOKEN e o
   TOKEN_CGU. Esses ficam só na máquina que roda os scripts Python.
   ══════════════════════════════════════════════════════════════════════════ */
window.IDEPI_FIREBASE = {
  apiKey:            "AIzaSyA_0xHSFgFzz30gY394gJTBuQIZlUaBjek",
  authDomain:        "idepi-painel.firebaseapp.com",
  projectId:         "idepi-painel",
  storageBucket:     "idepi-painel.firebasestorage.app",
  messagingSenderId: "1010934523490",
  appId:             "1:1010934523490:web:6485a405cec4ab3502d33b"
};

/* ── Ajustes de comportamento ───────────────────────────────────────────── */
window.IDEPI_OPCOES = {
  /* Domínio institucional. Deixe "" para aceitar qualquer e-mail cadastrado.
     Com valor preenchido, o login recusa e-mails de fora antes mesmo de
     chamar o Firebase — evita gastar tentativa e deixa o erro mais claro. */
  dominioPermitido: "",

  /* Enquanto o Firestore não estiver populado, o painel lê daqui.
     Depois que `py publicar_firestore.py --tudo` rodar, o Firestore vira a
     fonte principal e isto fica só como plano B para quedas de rede. */
  githubUsuario: "Ruan-Vitor",
  githubRepo:    "painel-idepi",

  /* Minutos que os dados ficam guardados no aparelho antes de buscar de novo.
     Serve para o app abrir instantâneo e continuar útil sem internet. */
  cacheMinutos: 60
};
