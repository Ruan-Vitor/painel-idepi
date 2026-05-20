# ══════════════════════════════════════════════════════════════════════════════
#  IDEPI — Coletor de Execução Financeira (Transferegov)
#  Arquivo: exec_financeiro.py
#  Repositório: https://github.com/Ruan-Vitor/painel-idepi
#
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║                     ESCOPO COMPLETO DO MÓDULO                          ║
# ╠══════════════════════════════════════════════════════════════════════════╣
# ║                                                                          ║
# ║  OBJETIVO:                                                               ║
# ║  Coletar dados de execução financeira do Transferegov para cada          ║
# ║  convênio ativo e publicar no dados.json (seção "exec_financeira"),      ║
# ║  alimentando o painel execucao.html.                                     ║
# ║                                                                          ║
# ║  DEPENDE DE: tgov_monitor.py (deve estar na mesma pasta)                ║
# ║  Reutiliza: criar_driver, estabelecer_sessao, buscar_instrumento,        ║
# ║             fechar_alert, fechar_popups, conectar_sheets, log, BASE      ║
# ║                                                                          ║
# ║  O QUE COLETA POR INSTRUMENTO:                                           ║
# ║                                                                          ║
# ║  1. VALORES GLOBAIS (página principal do instrumento):                   ║
# ║     - Valor Global, Valor de Repasse, Valor de Contrapartida             ║
# ║     - Situação, Regime (Simplificado / Normal)                           ║
# ║     - idConvenio e idProposta internos                                   ║
# ║                                                                          ║
# ║  2. CONTRATOS (aba Instrumentos Contratuais):                            ║
# ║     - CNPJ, razão social, valor do contrato, situação                    ║
# ║                                                                          ║
# ║  3. MOVIMENTAÇÕES FINANCEIRAS:                                           ║
# ║     - Paginação automática (todas as páginas)                            ║
# ║     - Campos: número, data, tipo, valores (orig/bruto/liq),              ║
# ║       favorecido, tributo, nº DL, tipo DL, situação                      ║
# ║                                                                          ║
# ║  4. NOTAS FISCAIS / DOCS DE LIQUIDAÇÃO:                                  ║
# ║     - Número, data, razão social, valores                                ║
# ║     - Origem do recurso (Repasse / Contrapartida / Rendimento)           ║
# ║                                                                          ║
# ║  5. EXECUÇÃO FÍSICA (Acompanhamento de Obras):                           ║
# ║     - % de execução física (Evolução física)                             ║
# ║     - Status ateste: Convenente (IDEPI) e Concedente                     ║
# ║     - Regime simplificado: concedente não atesta por medição             ║
# ║                                                                          ║
# ║  FLUXO:                                                                  ║
# ║    1. Conecta ao Google Sheets para ler lista de convênios               ║
# ║    2. Inicia Chrome + estabelece sessão Transferegov (via tgov_monitor)  ║
# ║    3. Para cada convênio: coleta 5 blocos de dados acima                 ║
# ║    4. Salva backup local (dados_exec_backup.json) sempre                 ║
# ║    5. Publica na seção "exec_financeira" do dados.json no GitHub         ║
# ║                                                                          ║
# ║  USO:                                                                    ║
# ║    python exec_financeiro.py                   todos os ativos           ║
# ║    python exec_financeiro.py --num 946260      so o 946260               ║
# ║    python exec_financeiro.py --num 946260 946261                         ║
# ║    python exec_financeiro.py --todos           inclui finalizados        ║
# ║                                                                          ║
# ╠══════════════════════════════════════════════════════════════════════════╣
# ║                    HISTORICO DE VERSOES                                  ║
# ╠══════════════════════════════════════════════════════════════════════════╣
# ║                                                                          ║
# ║  [INSTRUCAO PARA IAs FUTURAS]                                            ║
# ║  Este bloco deve ser SEMPRE mantido e incrementado.                      ║
# ║  Ao receber este arquivo para modificacao, leia TODO o historico,        ║
# ║  entenda o escopo e adicione uma nova entrada ao final:                  ║
# ║    ## [DATA] -- [IA/Responsavel]: o que foi solicitado e alterado.       ║
# ║                                                                          ║
# ║  ## [13/05/2026] -- Claude Sonnet 4.6 v1 (FALHOU):                      ║
# ║  Tentou implementar login proprio. Deu TimeoutException porque o         ║
# ║  campo de busca nao carregava (sessao nao estabelecida corretamente).    ║
# ║                                                                          ║
# ║  ## [13/05/2026] -- Claude Sonnet 4.6 v2:                               ║
# ║  Corrigido: importa e reutiliza DIRETAMENTE as funcoes testadas do       ║
# ║  tgov_monitor.py. Coleta 5 blocos de dados por instrumento.              ║
# ║                                                                          ║
# ║  ## [14/05/2026] -- Claude Sonnet 4.6 v3:                               ║
# ║  Correcoes pos-execucao real: contratos (clicar na aba antes de URL      ║
# ║  direta SPA), NFs (URL correta /execucao/ConsultarNotasFiscais/),        ║
# ║  exec_fisica coleta valor_realizado e valor_total.                       ║
# ║                                                                          ║
# ║  ## [14/05/2026] -- Claude Sonnet 4.6 v5:                               ║
# ║  Correcoes pos-execucao do 946260:                                       ║
# ║  (1) NFs COM COLUNAS ERRADAS: deteccao automatica de layout A/B e        ║
# ║      offset de coluna quando col0 e data.                                ║
# ║  (2) ATESTE CONVENENTE: deteccao expandida com 7 padroes regex.          ║
# ║  (3) EXEC. FISICA SEM VALOR: frontend monta note-fis de valor_realizado. ║
# ║  (4) TOTAL PAGO = 0: calcTotalPago usa v_bruto como fallback.            ║
# ║                                                                          ║
# ║  ## [14/05/2026] -- Claude Sonnet 4.6 v9 (ESTA VERSAO):                 ║
# ║  EMPRESA/CNPJ DO CONTRATO — abordagem completamente reescrita:           ║
# ║  Causa raiz: o <input disabled> da empresa na SPA Angular fica VAZIO     ║
# ║  no body.text porque os dados chegam via XHR depois do HTML inicial.     ║
# ║  Solução em 2 estratégias:                                               ║
# ║  (1) API REST direta: extrai o ID do instrumento do href da lupa         ║
# ║      (ex: /detalhar/detalhar/30751) e chama                              ║
# ║      GET /contratos/api/instrumentos-contratuais/30751                   ║
# ║      com os cookies do Selenium. O JSON da API tem fornecedor.cnpj       ║
# ║      e fornecedor.razaoSocial prontos — sem precisar esperar o Angular.  ║
# ║  (2) Navegação + poll de XHR: se a API falhar, navega para a URL de      ║
# ║      detalhe e faz poll a cada 1.5s (até 21s) lendo os <input value=">  ║
# ║      da seção "Empresa Executora" após o Angular preencher via XHR,      ║
# ║      ou o page_source por padrões JSON embutidos.                        ║
# ║  Logs: "IDs de detalhe encontrados", "API REST", "[API] CNPJ=",         ║
# ║         "[Angular] CNPJ=" para rastrear qual estratégia funcionou.       ║
# ║                                                                          ║
# ║  ## [14/05/2026] -- Claude Sonnet 4.6 v7:                               ║
# ║  (1) CONTRATOS SEM EMPRESA: clicar na lupa para capturar nome/CNPJ real ║
# ║  (2) EXEC. FISICA: captura valor realizado da tabela Lotes/Subm. SPA    ║
# ║  (3) ATESTE CONVENENTE: patterns adicionais SPA React /medicoes          ║
# ║  (4) RATEIO ITEM: URL corrigida BASE_HOST sem /voluntarias               ║
# ║                                                                          ║
# ║  ## [14/05/2026] -- Claude Sonnet 4.6 v6:                               ║
# ║  Correcoes pos-execucao v5 (problemas persistentes):                     ║
# ║  (1) MOVIMENTACOES — v_liq/v_bruto/tipo zerados: reescrita completa      ║
# ║      usando page_source (regex em HTML) em vez de find_elements.         ║
# ║      Detecta tipo pelo HTML do badge, com fallback por lista de tipos     ║
# ║      conhecidos. Log de tipos encontrados para diagnostico.              ║
# ║  (2) CONTRATOS SEM CNPJ/EMPRESA: extraí via regex CNPJ                   ║
# ║      (XX.XXX.XXX/XXXX-XX) no texto das celulas e no body_text.           ║
# ║  (3) RATEIO ERRADO: coletar_rateio_item agora localiza colunas           ║
# ║      (Repasse/Contrapartida/Rendimento) pelos <th> da tabela, nao        ║
# ║      por posicao fixa. Evita capturar numeros de Meta/Etapa.             ║
# ║  (4) ATESTE CONVENENTE: adiciona navegacao para aba /medicoes da SPA,    ║
# ║      onde o status de ateste aparece por medicao individualmente.        ║
# ║  (5) EXEC. FISICA VALOR REALIZADO: tambem capturado na aba /medicoes.    ║
# ║  (6) LOG DE DIAGNOSTICO: body preview de exec_fisica e medicoes.         ║
# ║  Correcoes de 6 bugs reportados apos execucao do 946260:                 ║
# ║  (1) VALORES TROCADOS: coletar_dados_gerais agora usa regex com padrao   ║
# ║      "R$ X,XX Valor Global" (valor antes do label) — ordem da arvore    ║
# ║      da pagina do Transferegov. Ignora celulas sem virgula decimal       ║
# ║      (evita capturar "Baixar Contrapartida" como valor).                 ║
# ║  (2) CONTRAPARTIDA=BOTAO: filtro adicionado (_reais_para_float).         ║
# ║  (3) MOVIMENTACOES NaN: v_orig/v_bruto/v_liq agora convertidos para     ║
# ║      float no coletor (funcao _val). Colunas reordenadas para o layout  ║
# ║      real da tabela: Num|Data|Tipo|VOrig|VBruto|VLiq|Favorecido|...     ║
# ║  (4) NFs — ITENS DO DL: coletar_notas_fiscais agora chama               ║
# ║      coletar_itens_dl() por NF, que abre ResultadoDaConsultaDetalhar    ║
# ║      e depois coletar_rateio_item() (DadosDaNotaFiscalDetalharItem)      ║
# ║      para pegar Repasse/Contrapartida/Rendimento por item. Funcoes       ║
# ║      antigas (coletar_origem_recurso) substituidas.                      ║
# ║  (5) CONTRATO NAO APARECIA: execucao.html normalizarInstrumento()        ║
# ║      converte contratos[] (array) para contrato{} (objeto unico).        ║
# ║  (6) VALORES NaN NO FRONTEND: nova funcao parseReais() no HTML aceita   ║
# ║      tanto numeros quanto strings "R$ X.XXX,XX" do JSON. Todos os       ║
# ║      campos monetarios passam por ela antes de renderizar.               ║
# ║                                                                          ║
# ║  ## [16/05/2026] -- Claude Sonnet 4.6 v10:                              ║
# ║  EXECUCAO FINANCEIRA REESTRUTURADA:                                      ║
# ║  (1) Nova funcao coletar_saldo_rendimentos(): coleta o Valor Total       ║
# ║      Disponivel de Rendimento de Aplicacao da aba de rendimentos e       ║
# ║      salva como saldo_rendimentos (float) em cada instrumento.           ║
# ║  (2) saldo_rendimentos adicionado ao reg de coletar_instrumento().       ║
# ║  (3) execucao.html: val-strip refeito em 2 blocos:                       ║
# ║      - Bloco esquerdo: Valor do Contrato (teto maximo de pagamento)      ║
# ║      - Bloco direito: 3 colunas (Repasse, Contrapartida, Rendimentos)    ║
# ║        cada uma com: pago, total da fonte, saldo e barra de progresso.   ║
# ║  (4) calcPagoRepasse() e calcPagoContrapartida() separadas para          ║
# ║      alimentar cada coluna individualmente no frontend.                  ║
# ║                                                                          ║
# ║  ## [18/05/2026] -- Claude Sonnet 4.6 v11: CORREÇÕES COLETA              ║
# ║  (1) MOVIMENTAÇÕES v_liq: v_liq agora = v_bruto quando null/0 (OBTV).   ║
# ║      Adicionado v_retencao = orig − bruto para auditoria.                ║
# ║  (2) FAVORECIDO OBTV: preencher_favorecido_movs() preenche favorecido    ║
# ║      das OBTVs com razão social + CNPJ do contrato principal.            ║
# ║  (3) NFs URL [v11]: tentativa de URL direta deu 404 no Transferegov.     ║
# ║      [v12] Reescrita com 4 tentativas em cascata:                        ║
# ║      1ª: abre instrumento e clica aba "Documento de Liquidação"          ║
# ║      2ª: URL direta DocumentoDeLiquidacao com idConvenio                 ║
# ║      3ª: URL antiga ConsultarNotasFiscais com idConvenio                 ║
# ║      4ª: URL DocumentoDeLiquidacao sem parâmetro                         ║
# ║      Detalhe: URL A (ResultadoDaConsultaDetalhar) primeiro, B fallback.  ║
# ║  (4) RATEIO: filtro remove linhas FEDERAL/MUNICIPAL/ISS/IR dos itens.    ║
# ║  (5) RATEIO: busca valores por formato monetário real (X.XXX,XX), não    ║
# ║      qualquer número positivo (evita nº de NF virar "rendimento").       ║
# ║  (6) coletar_rateio_item: soma acumulada em vez de max(); filtro de      ║
# ║      inteiros grandes (IDs de NF não viram valor de rateio).             ║
# ║                                                                          ║
# ║  ## [18/05/2026] -- Claude Sonnet 4.6 v13: TIPO E ANO DO INSTRUMENTO    ║
# ║  (1) coletar_dados_gerais: captura tipo_instrumento (Contrato de         ║
# ║      Repasse / Convênio / Termo de Compromisso) via regex no body_text.  ║
# ║  (2) Captura ano: tenta data de assinatura na página, fallback no        ║
# ║      número do instrumento (XXXXXX/AAAA).                                ║
# ║  (3) Ambos propagados para o reg em coletar_instrumento() e para a       ║
# ║      aba EXEC_FIN (colunas T e U). CABECALHOS_EXEC expandido de S→U.    ║
# ║  (4) Gravar EXEC_FIN no Sheets (v12): cria aba, 21 colunas, batch_update,║
# ║      chamada automática no main() após publicar_github().                ║
# ║                                                                          ║
# ║  ## [18/05/2026] -- Claude Sonnet 4.6 v14: MOVIMENTAÇÕES PRÉ-OBTV      ║
# ║  (1) MOVIMENTAÇÕES pré-OBTV: quando o instrumento não opera com OBTV,   ║
# ║      em vez de retornar lista vazia, coleta da aba "Pagamento"           ║
# ║      (/ListarPagamentosConvenio/) com campos: Nº DL, Data, Valor Líq.,  ║
# ║      Nº Doc. Pagamento (OB/PD), CNPJ e Razão Social do favorecido.      ║
# ║  (2) CNPJ do contrato inferido: após coletar movimentações pré-OBTV,    ║
# ║      preenche contratos[0].cnpj com o CNPJ extraído das movimentações.  ║
# ║  (3) RENDIMENTOS: remove fallback "último valor do src" que capturava   ║
# ║      o saldo disponível (R$ 290,34) em vez do total recebido. Novo      ║
# ║      fallback busca padrões próximos a palavras-chave de rendimento.    ║
# ║  (4) obs_manual: distingue "sem movimentações" (msg antiga) de          ║
# ║      "movimentações pré-OBTV coletadas da aba Pagamento" (msg nova).    ║
# ╚══════════════════════════════════════════════════════════════════════════╝

import sys
import os
import time
import json
import re
import argparse
import base64
import requests
from datetime import datetime

# ── Carrega .env automaticamente (token GitHub e outras vars) ─────
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_path):
    with open(_env_path, encoding="utf-8") as _ef:
        for _el in _ef:
            _el = _el.strip()
            if _el and not _el.startswith("#") and "=" in _el:
                _ek, _ev = _el.split("=", 1)
                os.environ.setdefault(_ek.strip(), _ev.strip())
# ─────────────────────────────────────────────────────────────────

# Importa funcoes testadas do tgov_monitor.py (deve estar na mesma pasta)
try:
    from tgov_monitor import (
        criar_driver,
        estabelecer_sessao,
        buscar_instrumento,
        fechar_alert,
        fechar_popups,
        conectar_sheets,
        log,
        BASE,
    )
except ImportError as e:
    print(f"ERRO: nao foi possivel importar tgov_monitor.py: {e}")
    print("Certifique-se de que tgov_monitor.py esta na mesma pasta.")
    sys.exit(1)

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, NoSuchElementException
)

# ══════════════════════════════════════════════════════════════════
#  CONFIGURACOES
# ══════════════════════════════════════════════════════════════════
PAUSA_ENTRE  = 3.0   # segundos entre instrumentos
MAX_PAG_MOV  = 20    # limite de paginas de movimentacoes

GITHUB_TOKEN   = os.environ.get("GITHUB_TOKEN", "")
GITHUB_USUARIO = "Ruan-Vitor"
GITHUB_REPO    = "painel-idepi"
GITHUB_ARQUIVO = "dados.json"

BASE_CONTRATOS = "https://instrumentoscontratuais.transferegov.sistema.gov.br"
BASE_HOST      = "https://discricionarias.transferegov.sistema.gov.br"  # sem /voluntarias
URL_MOV_FIN    = (f"{BASE}/prestacao/obtv/ManterMovimentacaoFinanceira/"
                  "consultarMovimentacaoFinanceira.jsf")
URL_NFS        = f"{BASE}/ConsultarNotasFiscais/ConsultarNotasFiscais.do"
# ══════════════════════════════════════════════════════════════════


def txt(el):
    try:
        return el.text.strip()
    except Exception:
        return ""


def ler_convenios(sheet, numeros_filtro=None, incluir_finalizados=False):
    result = []
    for i, l in enumerate(sheet.get_all_values()[1:]):
        if not l:
            continue
        numero = str(l[0]).strip()
        if not numero or numero == "N do Convenio":
            continue
        status = str(l[4]).strip() if len(l) > 4 else ""

        if numeros_filtro:
            num_norm = numero.split("/")[0].strip()
            if num_norm not in numeros_filtro and numero not in numeros_filtro:
                continue
        elif not incluir_finalizados and status in ("FINALIZADO", "SEM DADOS"):
            continue

        objeto = str(l[1]).strip() if len(l) > 1 else ""
        result.append({"linha": i + 2, "numero": numero,
                       "objeto": objeto, "status": status})
    return result


def extrair_id_proposta(driver):
    """Extrai idProposta do page_source ou dos links da pagina aberta."""
    src = driver.page_source
    for pat in [r'idProposta=(\d+)', r'proposta/(\d+)']:
        m = re.search(pat, src)
        if m:
            return m.group(1)
    links = driver.find_elements(By.XPATH, "//a[@href]")
    for lnk in links:
        href = lnk.get_attribute("href") or ""
        for pat in [r'idProposta=(\d+)', r'proposta/(\d+)']:
            m = re.search(pat, href)
            if m:
                return m.group(1)
    return None


# ── 1. DADOS GERAIS ───────────────────────────────────────────────
def _reais_para_float(txt):
    """Converte 'R$ 1.002.000,00' ou '1.002.000,00' em float. Retorna None se inválido."""
    try:
        limpo = re.sub(r'[^\d,]', '', str(txt).strip())  # mantém só dígitos e vírgula
        if not limpo or ',' not in limpo:
            return None
        return float(limpo.replace('.', '').replace(',', '.'))
    except Exception:
        return None


def coletar_dados_gerais(driver, id_conv):
    dados = {"valor_global": "", "valor_repasse": "",
             "valor_contrapartida": "", "situacao_tgov": "",
             "regime_simplificado": False, "objeto": "",
             "tipo_instrumento": "", "ano": ""}
    try:
        url = (f"{BASE}/ConsultarProposta/ResultadoDaConsultaDeConvenio"
               f"SelecionarConvenio.do?idConvenio={id_conv}&destino=")
        driver.get(url)
        time.sleep(3)
        fechar_alert(driver)

        body_text = driver.find_element(By.TAG_NAME, "body").text

        # ── Estratégia primária: regex no body_text (mais confiável que varrer TDs)
        # A página tem a seção "Valores" com o layout em árvore mostrado na imagem 2.
        # Ordem de captura: Global → Repasse → Contrapartida (evita confundir sub-labels)
        for campo, pats in [
            ("valor_global", [
                r"Valor\s+Global[^\d\n]{0,20}([\d.]+,\d{2})",
                r"R\$\s*([\d.]+,\d{2})\s*Valor\s+Global",
            ]),
            ("valor_repasse", [
                r"Valor\s+de\s+Repasse[^\d\n]{0,20}([\d.]+,\d{2})",
                r"R\$\s*([\d.]+,\d{2})\s*Valor\s+de\s+Repasse",
            ]),
            ("valor_contrapartida", [
                r"Valor\s+da\s+Contrapartida[^\d\n]{0,20}([\d.]+,\d{2})",
                r"Valor\s+Contrapartida[^\d\n]{0,20}([\d.]+,\d{2})",
                r"R\$\s*([\d.]+,\d{2})\s*Valor\s+(?:da\s+)?Contrapartida",
            ]),
        ]:
            if dados[campo]:
                continue
            for pat in pats:
                m = re.search(pat, body_text, re.DOTALL | re.IGNORECASE)
                if m:
                    raw = m.group(1).strip()
                    # Valida: deve ter vírgula decimal e pelo menos 4 caracteres
                    if ',' in raw and _reais_para_float(raw) is not None:
                        dados[campo] = "R$ " + raw
                        break

        # ── Estratégia secundária: varrer TDs ──
        # Só preenche campos ainda vazios. Ignora células que sejam botões/links (Baixar, etc.)
        if not all(dados[k] for k in ["valor_global", "valor_repasse", "valor_contrapartida"]):
            rows = driver.find_elements(By.XPATH, "//table//tr")
            for row in rows:
                cells = row.find_elements(By.XPATH, "./td | ./th")
                if len(cells) < 2:
                    continue
                label = cells[0].text.strip().lower()
                # Pega só a primeira linha do cell e descarta se parece botão
                valor_raw = cells[1].text.strip().split("\n")[0]
                # Ignora célula se parece texto de botão/ação (não tem dígito com vírgula)
                if not re.search(r'\d,\d{2}', valor_raw):
                    continue

                if "valor global" in label and not dados["valor_global"]:
                    dados["valor_global"] = valor_raw if "R$" in valor_raw else "R$ " + valor_raw
                elif "valor de repasse" in label and not dados["valor_repasse"]:
                    dados["valor_repasse"] = valor_raw if "R$" in valor_raw else "R$ " + valor_raw
                elif "contrapartida" in label and not dados["valor_contrapartida"]:
                    dados["valor_contrapartida"] = valor_raw if "R$" in valor_raw else "R$ " + valor_raw
                elif label in ("situacao", "situação") and not dados["situacao_tgov"]:
                    dados["situacao_tgov"] = valor_raw
                elif "objeto" in label and not dados["objeto"]:
                    dados["objeto"] = valor_raw

        if not dados["situacao_tgov"]:
            for row in driver.find_elements(By.XPATH, "//table//tr"):
                cells = row.find_elements(By.XPATH, "./td | ./th")
                if len(cells) >= 2:
                    lbl = cells[0].text.strip().lower()
                    if lbl in ("situacao", "situação", "situação do instrumento"):
                        dados["situacao_tgov"] = cells[1].text.strip().split("\n")[0]
                        break

        if re.search(r"regime simplificado|simplificado", body_text, re.IGNORECASE):
            dados["regime_simplificado"] = True

        # ── Tipo do instrumento ──────────────────────────────────────────────
        # O Transferegov exibe o tipo no cabeçalho: "Contrato de Repasse",
        # "Convênio" ou "Termo de Compromisso". Captura pelo body_text.
        for _pat, _label in [
            (r"contrato\s+de\s+repasse",  "Contrato de Repasse"),
            (r"termo\s+de\s+compromisso", "Termo de Compromisso"),
            (r"\bconv[eê]nio\b",          "Convênio"),
        ]:
            if re.search(_pat, body_text, re.IGNORECASE):
                dados["tipo_instrumento"] = _label
                break

        # ── Ano do instrumento ───────────────────────────────────────────────
        # Tenta extrair da data de assinatura na página (mais confiável que URL).
        _m_ass = re.search(
            r"(?:Data\s+de\s+Assinatura|Assinado\s+em|Data\s+Assinatura)[^\d]{0,20}"
            r"\d{2}/\d{2}/(\d{4})",
            body_text, re.IGNORECASE)
        if _m_ass:
            dados["ano"] = _m_ass.group(1)
        else:
            # Fallback: ano no número do instrumento (XXXXXX/AAAA)
            _m_num = re.search(r"/(\d{4})\b", str(id_conv) + " " + driver.current_url)
            if _m_num:
                _ano_c = int(_m_num.group(1))
                if 2000 <= _ano_c <= 2100:
                    dados["ano"] = str(_ano_c)

        log(f"  Global={dados['valor_global']} | Repasse={dados['valor_repasse']} | "
            f"Contrapartida={dados['valor_contrapartida']}"
            + (f" | {dados['tipo_instrumento']}" if dados["tipo_instrumento"] else "")
            + (f" | {dados['ano']}" if dados["ano"] else "")
            + (" | SIMPLIFICADO" if dados["regime_simplificado"] else ""))
    except Exception as e:
        log(f"  Erro dados_gerais: {type(e).__name__}: {str(e)[:80]}")
    return dados


# ── 2. CONTRATOS ──────────────────────────────────────────────────
def coletar_contratos(driver, numero, id_conv):
    """Coleta instrumentos contratuais do convênio.
    Navega à página do instrumento, extrai o href real do link
    'Instrumentos Contratuais' e abre essa URL. A SPA React do domínio
    instrumentoscontratuais.transferegov.sistema.gov.br exige o cookie de
    sessão — por isso nunca abrimos a URL sem passar pelo instrumento antes.
    """
    contratos = []
    try:
        # 1) Abre a página do instrumento
        url_inst = (f"{BASE}/ConsultarProposta/ResultadoDaConsultaDeConvenio"
                    f"SelecionarConvenio.do?idConvenio={id_conv}&destino=")
        driver.get(url_inst)
        time.sleep(4)
        fechar_alert(driver)

        # 2) Pega o href do link de Instrumentos Contratuais
        href_contrato = None
        for xpath in [
            "//a[contains(@href,'instrumentoscontratuais.transferegov')]",
            "//a[contains(translate(normalize-space(.),"
            "    'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),"
            "    'instrumento') and contains(translate(normalize-space(.),"
            "    'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),"
            "    'contrat')]",
        ]:
            for lnk in driver.find_elements(By.XPATH, xpath):
                h = (lnk.get_attribute("href") or "").strip()
                if h and "instrumentoscontratuais" in h:
                    href_contrato = h
                    break
            if href_contrato:
                break

        # Fallback: monta URL padrão da listagem
        if not href_contrato:
            href_contrato = (f"{BASE_CONTRATOS}/contratos/contratos/"
                             f"instrumentos-contratuais/listagem"
                             f"?idConvenio={id_conv}")

        log(f"  Contratos: {href_contrato[:90]}")
        driver.get(href_contrato)
        time.sleep(3)
        fechar_alert(driver)

        # Detecção imediata: URL erroNegocio.jsf = instrumento não opera com OBTV
        if "erroNegocio" in driver.current_url or "erronegocios" in driver.current_url.lower():
            log(f"  Instrumento não opera com OBTV (erroNegocio.jsf) — sem contratos.")
            return contratos
        # Checagem pelo page_source antes do loop (popup pode sumir do body.text)
        _src_pre = driver.page_source.lower()
        if "nao opera com obtv" in _src_pre or "n\u00e3o opera com obtv" in _src_pre \
                or "instrumento nao opera" in _src_pre:
            log(f"  Instrumento não opera com OBTV (page_source) — sem contratos.")
            return contratos

        # 3) Aguarda SPA carregar — espera tabela com linhas clicáveis (até 60s)
        for _w in range(30):
            time.sleep(2)
            _cur_url = driver.current_url
            # Saída imediata se página virou erroNegocio durante a espera
            if "erroNegocio" in _cur_url or "erronegocios" in _cur_url.lower():
                log(f"  erroNegocio.jsf detectado na iteração {_w+1} — sem contratos.")
                return contratos
            _bt = driver.find_element(By.TAG_NAME, "body").text
            _tem_tabela = bool(re.search(r"\d{1,4}/20\d{2}", _bt))
            _tem_vazio  = any(k in _bt.lower() for k in [
                "nenhum instrumento", "nenhum contrato", "nenhum registro",
                "nao ha contrato", "nao foram encontrados"
            ])
            # Saída rápida pelo texto do body
            _nao_obtv = any(k in _bt.lower() for k in [
                "não opera com obtv", "nao opera com obtv",
                "instrumento não opera", "instrumento nao opera"
            ])
            if _nao_obtv:
                log(f"  Instrumento não opera com OBTV (body) — sem contratos.")
                return contratos
            if _tem_tabela or _tem_vazio:
                log(f"  SPA carregada em {(_w+1)*2}s (tabela={_tem_tabela})")
                break
            if _w == 29:
                log(f"  Timeout SPA (60s) — body={len(_bt)} chars")

        body_text  = driver.find_element(By.TAG_NAME, "body").text
        body_lower = body_text.lower()

        if any(f in body_lower for f in [
            "nenhum instrumento", "nenhum contrato", "nenhum registro",
            "nao ha contrato", "nao foram encontrados",
            "proposta-nao-informada", "nenhuma proposta selecionada"
        ]):
            log(f"  0 contrato(s).")
            return contratos

        _src_listagem = driver.page_source
        url_listagem  = driver.current_url

        # IDs dos links de detalhe (lupa): padrão detalhar/detalhar/NNN
        _ids_detalhe = list(dict.fromkeys(
            re.findall(r"detalhar/detalhar/(\d+)", _src_listagem)
        ))
        if not _ids_detalhe:
            for _lnk in driver.find_elements(By.XPATH,
                    "//a[contains(@href,'detalhar') or .//i[contains(@class,'fa-search')]]"):
                _h = _lnk.get_attribute("href") or ""
                _m_id = re.search(r"detalhar/(\d+)", _h)
                if _m_id and _m_id.group(1) not in _ids_detalhe:
                    _ids_detalhe.append(_m_id.group(1))

        log(f"  IDs de detalhe encontrados: {_ids_detalhe}")

        _base_api = "https://instrumentoscontratuais.transferegov.sistema.gov.br"

        # Coleta linhas da tabela (usa count(td)>=3 para lidar com colspan)
        linhas_dados = []
        for _ri, row in enumerate(
                driver.find_elements(By.XPATH, "//table//tr[count(td)>=3]")):
            cels = row.find_elements(By.TAG_NAME, "td")
            txts = [txt(c) for c in cels]
            if not txts or not txts[0]:
                continue
            if any(h in txts[0] for h in ["Nº","Número","Instrumento","Situação","Ações"]):
                continue
            num_cont = txts[0].strip()
            if not re.search(r"\d+/20\d{2}", num_cont):
                continue
            linhas_dados.append({
                "num_cont":      num_cont,
                "situacao":      txts[1] if len(txts) > 1 else "",
                "valor":         txts[2] if len(txts) > 2 else "",
                "valor_repasse": txts[3] if len(txts) > 3 else "",
                "dt_inicio":     txts[4] if len(txts) > 4 else "",
                "dt_fim":        txts[5] if len(txts) > 5 else "",
            })
        log(f"  Linhas tabela: {len(linhas_dados)} | IDs lupa: {len(_ids_detalhe)}")

        for _li, lc in enumerate(linhas_dados):
            _cnpj  = ""
            _razao = ""

            # ══════════════════════════════════════════════════════════════════
            # ESTRATÉGIA DEFINITIVA: clicar na lupa com Selenium
            #
            # A URL da lupa NÃO é /detalhar/detalhar/30751 diretamente.
            # Ao clicar, o servidor gera um token único e redireciona para:
            #   /contratos/instrumentos-contratuais?token=UUID&idProposta=X&dest=...
            # Esse token autentica a sessão Angular. Navegar direto para /detalhar/30751
            # sem token abre página em branco (sem autenticação).
            #
            # Solução: relocalizar a lupa na linha correta e clicar com Selenium,
            # capturando a URL resultante e lendo o body após o Angular carregar.
            # ══════════════════════════════════════════════════════════════════
            try:
                # Relocaliza todas as linhas da tabela (fresh — sem stale elements)
                _linhas_fresh = driver.find_elements(
                    By.XPATH, "//table//tr[count(td)>=5]")
                _linhas_validas = []
                for _rf in _linhas_fresh:
                    _txs = [c.text.strip() for c in _rf.find_elements(By.TAG_NAME, "td")]
                    if _txs and re.search(r"\d", _txs[0]):
                        _linhas_validas.append(_rf)

                if _li < len(_linhas_validas):
                    _row = _linhas_validas[_li]
                    # Lupa: ícone fa-search dentro de <a> ou <button>
                    _lupa = None
                    for _sel in [
                        ".//a[.//i[contains(@class,'fa-search')]]",
                        ".//button[.//i[contains(@class,'fa-search')]]",
                        ".//a[contains(@title,'Detalhar') or contains(@title,'detalhar')]",
                        ".//a[contains(@href,'detalhar')]",
                        ".//a[last()]",
                    ]:
                        try:
                            _lupa = _row.find_element(By.XPATH, _sel)
                            break
                        except Exception:
                            pass

                    if _lupa:
                        log(f"    Lupa localizada — clicando ({lc['num_cont']})...")
                        # Scroll para garantir visibilidade
                        driver.execute_script(
                            "arguments[0].scrollIntoView({block:'center'});", _lupa)
                        time.sleep(0.5)
                        # Captura URL atual antes do clique
                        _url_antes = driver.current_url
                        try:
                            _lupa.click()
                        except Exception:
                            driver.execute_script("arguments[0].click();", _lupa)
                        time.sleep(1)

                        # Aguarda navegação E o Angular carregar os dados do instrumento.
                        # Saída antecipada só quando o CNPJ ou seção de empresa aparecer.
                        # "Instrumento Contratual" e "Vigência" são labels do MENU — não usamos.
                        # Esperamos: CNPJ no body OU "Empresa Executora" + número após ela.
                        fechar_alert(driver)
                        _body_det = ""
                        _src_det  = ""
                        for _wn in range(20):  # até 30s
                            time.sleep(1.5)
                            _url_agora = driver.current_url
                            _body_det  = driver.find_element(By.TAG_NAME, "body").text
                            _src_det   = driver.page_source
                            # Condição de saída: CNPJ real visível no body
                            _has_cnpj  = bool(re.search(
                                r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}", _body_det))
                            # OU: seção "Empresa Executora" com conteúdo após ela
                            _has_emp   = ("Empresa Executora" in _body_det and
                                          len(_body_det) > 500)
                            if _has_cnpj or _has_emp:
                                log(f"    Detalhe carregado em {(_wn+1)*1.5:.0f}s "
                                    f"(cnpj={_has_cnpj}, emp={_has_emp}): {_url_agora[:70]}")
                                break
                            if _wn == 19:
                                log(f"    Timeout aguardando Angular ({_wn*1.5:.0f}s) — "
                                    f"body={len(_body_det)} chars")

                        # Força scroll para seção "Empresa Executora" — o Angular pode
                        # usar lazy rendering e não popular campos fora da viewport.
                        # Também lê os <input> via JavaScript (value não reflete no body.text
                        # quando o campo é disabled, mas JS acessa o value interno).
                        try:
                            driver.execute_script("""
                                var all = document.querySelectorAll('input,textarea');
                                for(var i=0;i<all.length;i++){
                                    var v = all[i].value;
                                    if(v && v.trim()) {
                                        all[i].scrollIntoView({block:'center'});
                                        break;
                                    }
                                }
                            """)
                            time.sleep(1)
                        except Exception:
                            pass

                        # Lê CNPJ e razão social via JavaScript (acessa .value dos inputs,
                        # mesmo os disabled que o body.text não exibe)
                        _js_inputs = (
                            "var result = {cnpj:'', razao:''};"
                            "var inputs = document.querySelectorAll('input');"
                            "for(var i=0;i<inputs.length;i++){"
                            "  var v = (inputs[i].value || '').trim();"
                            "  if(!v) continue;"
                            r"  var mC = v.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s*[-\u2013]\s*(.+)/);"
                            "  if(mC){ result.cnpj=mC[1]; result.razao=mC[2].trim(); }"
                            r"  else if(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(v)){ result.cnpj=v.substring(0,18); }"
                            "}"
                            "var txts = document.querySelectorAll('textarea');"
                            "for(var j=0;j<txts.length;j++){"
                            "  var tv=(txts[j].value||'').trim();"
                            r"  var mx=tv.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);"
                            "  if(mx && !result.cnpj) result.cnpj=mx[1];"
                            "}"
                            "return result;"
                        )
                        try:
                            _js_result = driver.execute_script(_js_inputs)
                            log(f"    [JS inputs] cnpj={(_js_result or {}).get('cnpj','')!r} "
                                f"razao={(_js_result or {}).get('razao','')!r}")
                            if _js_result:
                                if _js_result.get('cnpj') and _js_result['cnpj'] != "09.034.960/0001-47":
                                    _cnpj  = _js_result['cnpj']
                                    _razao = _js_result.get('razao','')
                        except Exception as _je:
                            log(f"    JS inputs erro: {str(_je)[:50]}")

                        # Re-lê body após JS scroll (pode ter mudado)
                        _body_det = driver.find_element(By.TAG_NAME, "body").text
                        _src_det  = driver.page_source

                        log(f"    [detalhe body] {_body_det[:300].replace(chr(10), ' ')}")

                        # ── Complementa com body SOMENTE se JS não capturou ──
                        # O body.text contém o CNPJ do IDEPI (09.034.960/0001-47) no cabeçalho
                        # da página — por isso só usamos o body se o JS falhou.
                        if not _cnpj:
                            for _mci in re.finditer(
                                    r"(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})", _body_det):
                                if _mci.group(1) != "09.034.960/0001-47":
                                    _cnpj = _mci.group(1)
                                    # Razão social: texto antes do CNPJ no body
                                    _idx_c = _body_det.find(_cnpj)
                                    _apos  = _body_det[_idx_c+len(_cnpj):_idx_c+len(_cnpj)+200]
                                    _md    = re.match(r"\s*[-–]\s*([A-Za-zÀ-ú][^\n]{4,})", _apos)
                                    if _md: _razao = _md.group(1).strip()
                                    break
                        if not _razao:
                            for _rpat in [r'"razaoSocial"\s*:\s*"([^"]{5,})"',
                                          r'"nomeEmpresa"\s*:\s*"([^"]{5,})"']:
                                _mr = re.search(_rpat, _src_det)
                                if _mr and re.search(r"[A-Za-zÀ-ú]{3,}", _mr.group(1)):
                                    _razao = _mr.group(1); break

                        log(f"    [detalhe final] CNPJ={_cnpj!r} | Razão={_razao!r}")
                    else:
                        log(f"    Lupa não encontrada na linha {_li} ({lc['num_cont']})")
                else:
                    log(f"    Linha {_li} fora do range ({len(_linhas_validas)} linhas válidas)")

            except Exception as _ed:
                log(f"    Aviso detalhe: {type(_ed).__name__}: {str(_ed)[:80]}")
            finally:
                # Volta para a listagem e aguarda SPA recarregar (até 21s)
                try:
                    driver.get(url_listagem)
                    for _wl in range(14):
                        time.sleep(1.5)
                        _chk = driver.find_elements(
                            By.XPATH, "//table//tr[count(td)>=5]")
                        _validas_chk = []
                        for _r in _chk:
                            _tds_chk = _r.find_elements(By.TAG_NAME, "td")
                            if _tds_chk and re.search(r"\d", _tds_chk[0].text or ""):
                                _validas_chk.append(_r)
                        if len(_validas_chk) >= 1:
                            break
                    fechar_alert(driver)
                except Exception:
                    pass

            # ── Fallback: CNPJ das NFs (coletadas anteriormente ou do body) ─
            # O CNPJ da empresa executora aparece nas movimentações OBTV
            if not _cnpj:
                for _mc in re.finditer(r'\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}',
                                       body_text):
                    _c = _mc.group(0)
                    if _c != "09.034.960/0001-47":
                        _cnpj = _c; break

            contratos.append({
                "numero_contrato": lc["num_cont"],
                "situacao":        lc["situacao"],
                "valor":           lc["valor"],
                "valor_repasse":   lc["valor_repasse"],
                "dt_inicio":       lc["dt_inicio"],
                "dt_fim":          lc["dt_fim"],
                "cnpj":            _cnpj,
                "razao_social":    _razao,
            })

        log(f"  {len(contratos)} contrato(s).")
    except Exception as e:
        log(f"  Erro contratos: {type(e).__name__}: {str(e)[:80]}")
    return contratos


# ── 3. MOVIMENTACOES FINANCEIRAS ──────────────────────────────────
def coletar_movimentacoes(driver, id_conv):
    """Coleta movimentações financeiras via page_source (mais confiável que find_elements
    quando há badges/spans dentro das células).

    Layout real da tabela (Transferegov):
      Número | Data | Tipo(badge) | Vlr. Original | Vlr. Bruto | Vlr. Líquido |
      Favorecido/CNPJ | Tributo | Nº DL | Tipo DL | Situação

    Nota sobre Vlr. Líquido: para movimentações do tipo OBTV (pagamento à empresa),
    o Transferegov pode gravar Vlr. Líquido = 0,00 porque o desconto de tributos é
    lançado em linhas separadas. Por isso gravamos v_bruto separado de v_liq.
    """
    movimentacoes = []
    try:
        url_inst = (f"{BASE}/ConsultarProposta/ResultadoDaConsultaDeConvenio"
                    f"SelecionarConvenio.do?idConvenio={id_conv}&destino=")
        driver.get(url_inst)
        time.sleep(3)
        fechar_alert(driver)

        clicou = False
        for xpath in [
            "//a[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'movimenta')]",
            "//a[contains(@href,'Movimentacao') or contains(@href,'movimentacao')]",
        ]:
            try:
                aba = driver.find_element(By.XPATH, xpath)
                driver.execute_script("arguments[0].click();", aba)
                time.sleep(3)
                fechar_alert(driver)
                clicou = True
                log(f"  Aba Movimentacoes clicada.")
                break
            except NoSuchElementException:
                continue

        if not clicou:
            url_mov = (f"{URL_MOV_FIN}?destino=ManterMovimentacaoFinanceira"
                       f"&idConvenio={id_conv}")
            log(f"  URL direta mov: {url_mov[:80]}")
            driver.get(url_mov)
            time.sleep(4)
            fechar_alert(driver)
            # Detecta mensagem explicita do Transferegov para instrumentos pre-OBTV:
            # "Atencao: este instrumento nao opera com OBTV."
            _body_mov_chk = driver.find_element(By.TAG_NAME, "body").text
            if any(p in _body_mov_chk.lower() for p in [
                "nao opera com obtv", "não opera com obtv",
                "instrumento nao opera", "instrumento não opera"
            ]):
                log("  ⚠️  Instrumento nao opera com OBTV — usando aba Pagamento (pre-OBTV).")
                # ── Fallback pré-OBTV: aba "Pagamento" do Transferegov ──────────────
                # URL: /ListarPagamentosConvenio/ListarPagamentosConvenio.do
                # Tabela: Nº DL | Data | Valor do Pagamento | Nº Doc. Pagamento | CNPJ/Razão
                _url_pag = (f"{BASE}/ListarPagamentosConvenio/"
                            f"ListarPagamentosConvenio.do"
                            f"?destino=ListarPagamentosConvenio"
                            f"&idConvenio={id_conv}")
                try:
                    log(f"  [pré-OBTV] Aba Pagamento: {_url_pag[:90]}")
                    driver.get(_url_pag)
                    time.sleep(4)
                    fechar_alert(driver)

                    _src_pag = driver.page_source
                    _linhas_pag = re.findall(r'<tr[^>]*>(.*?)</tr>', _src_pag,
                                             re.DOTALL | re.IGNORECASE)

                    def _limpar_pag(h):
                        return re.sub(r'<[^>]+>', '', h).strip().replace('&nbsp;', ' ')

                    def _val_pag(s):
                        v = re.sub(r'[R$\s]', '', str(s)).strip()
                        if not v or v in ("—", "", "-"):
                            return None
                        try:
                            return float(v.replace(".", "").replace(",", "."))
                        except Exception:
                            return None

                    for _lp in _linhas_pag:
                        _tds_p = re.findall(r'<td[^>]*>(.*?)</td>', _lp,
                                            re.DOTALL | re.IGNORECASE)
                        if len(_tds_p) < 4:
                            continue
                        _tp = [_limpar_pag(t) for t in _tds_p]

                        # col0 = Nº DL (número puro ou com zeros à esquerda)
                        _ndl = _tp[0].strip()
                        if not re.search(r'^\d+$', _ndl):
                            continue

                        # col1 = Data (dd/mm/aaaa)
                        _data_p = _tp[1].strip()
                        if not re.match(r'^\d{2}/\d{2}/\d{4}$', _data_p):
                            continue

                        _v_liq_p = _val_pag(_tp[2])   # col2 = Valor do Pagamento
                        _ndoc    = _tp[3].strip()       # col3 = Nº Doc. Pagamento (OB)
                        _fav_raw = _tp[4].strip() if len(_tp) > 4 else ""

                        # Separa CNPJ e razão social do campo favorecido
                        # Formato: "04052287000154 / CONSTRUTORA P2 LTDA"
                        _cnpj_mov, _razao_mov = "", _fav_raw
                        _m_cnpj = re.match(r'^(\d{14})\s*/\s*(.+)$', _fav_raw)
                        if _m_cnpj:
                            _raw_cnpj = _m_cnpj.group(1)
                            # Formata como XX.XXX.XXX/XXXX-XX
                            _cnpj_mov = "{}.{}.{}/{}-{}".format(
                                _raw_cnpj[0:2], _raw_cnpj[2:5],
                                _raw_cnpj[5:8], _raw_cnpj[8:12], _raw_cnpj[12:14]
                            )
                            _razao_mov = _m_cnpj.group(2).strip()

                        mov_pag = {
                            "num":        _ndl,
                            "data":       _data_p,
                            "tipo":       "PAGAMENTO",
                            "v_orig":     _v_liq_p,
                            "v_bruto":    _v_liq_p,
                            "v_liq":      _v_liq_p,
                            "v_retencao": 0.0,
                            "favorecido": _razao_mov,
                            "cnpj":       _cnpj_mov,
                            "tributo":    "",
                            "ndl":        _ndl,
                            "tdl":        "",
                            "ndoc_pag":   _ndoc,   # campo extra: nº doc. pagamento (OB)
                            "situacao":   "Pago",
                        }
                        if not any(m["num"] == _ndl for m in movimentacoes):
                            movimentacoes.append(mov_pag)

                    log(f"  [pré-OBTV] {len(movimentacoes)} pagamento(s) coletado(s) da aba Pagamento.")
                except Exception as _ep:
                    log(f"  [pré-OBTV] Erro aba Pagamento: {type(_ep).__name__}: {str(_ep)[:80]}")
                return movimentacoes

        def _val_mov(s):
            """Converte string BR para float. None se vazio/traço."""
            v = re.sub(r'[R$\s]', '', str(s)).strip()
            if not v or v in ("—", "", "-", "NaN"):
                return None
            try:
                return float(v.replace(".", "").replace(",", "."))
            except Exception:
                return None

        def _limpar_html(h):
            return re.sub(r'<[^>]+>', ' ', h).strip().replace('&nbsp;', ' ')

        # ── Detecta tipo pelo HTML do badge (span com classe de tipo) ──
        # O badge de tipo pode ser: "PAGAMENTO A FAVORECIDO COM OBTV", "INGRESSO DE CONTRAPARTIDA" etc.
        # O texto completo do badge está dentro de <span> ou <td> na coluna 2.
        TIPOS_CONHECIDOS = [
            "PAGAMENTO A FAVORECIDO COM OBTV",
            "PAGAMENTO DE TRIBUTOS",
            "INGRESSO DE CONTRAPARTIDA",
            "DEVOLUCAO DE SALDO",
            "DEVOLUÇÃO DE SALDO",
            "DEVOLUCAO DE PAGAMENTO",
            "DEVOLUÇÃO DE PAGAMENTO",
            "RENDIMENTO DE APLICACAO",
            "RENDIMENTO DE APLICAÇÃO",
            "TRANSFERENCIA",
            "TRANSFERÊNCIA",
            "ESTORNO",
            "CANCELAMENTO",
            "RECOLHIMENTO",
        ]

        pagina = 1
        while pagina <= MAX_PAG_MOV:
            qtd_antes = len(movimentacoes)

            _src = driver.page_source
            _linhas = re.findall(r'<tr[^>]*>(.*?)</tr>', _src, re.DOTALL | re.IGNORECASE)

            for _linha in _linhas:
                _tds_raw = re.findall(r'<td[^>]*>(.*?)</td>', _linha, re.DOTALL | re.IGNORECASE)
                if len(_tds_raw) < 5:
                    continue
                txts = [_limpar_html(t) for t in _tds_raw]

                # Col 0 deve ser número de 7+ dígitos (ex: 10249848)
                num_raw = re.sub(r'\s+', '', txts[0])
                if not re.match(r'^\d{7,}$', num_raw):
                    continue

                # ── Extrai tipo do HTML bruto da linha ──
                # Prioridade: texto do badge (span com class de tipo ou valor visível)
                tipo_str = txts[2] if len(txts) > 2 else ""
                # Limpa espaços extras
                tipo_str = re.sub(r'\s+', ' ', tipo_str).strip()
                # Se o tipo ficou como um valor numérico (bug de coluna), tenta regex no HTML
                if not tipo_str or re.match(r'^[\d.,]+$', tipo_str):
                    for _t in TIPOS_CONHECIDOS:
                        if _t.lower() in _linha.lower():
                            tipo_str = _t
                            break
                    if not tipo_str:
                        # Extrai texto de qualquer span na col 2
                        _spans = re.findall(r'<span[^>]*>(.*?)</span>',
                                           _tds_raw[2] if len(_tds_raw) > 2 else "",
                                           re.DOTALL | re.IGNORECASE)
                        for _sp in _spans:
                            _st = _limpar_html(_sp).strip()
                            if _st and not re.match(r'^[\d.,]+$', _st):
                                tipo_str = _st
                                break

                # ── Mapeamento de colunas ─────────────────────────────────────────────
                # Layout real do Transferegov (confirmado nas imagens):
                #   col0=Número | col1=Data | col2=Vlr.Original DL | col3=Vlr.Bruto |
                #   col4=Vlr.Líquido | col5=CNPJ/Favorecido
                # O "Tipo" NÃO é uma coluna separada — vem de um badge/span embutido
                # em alguma das células (geralmente col2 ou col1), ou é detectado pelo
                # texto da linha via TIPOS_CONHECIDOS.
                #
                # ATENÇÃO: para linhas de tributo, col2 pode estar vazia (Transferegov
                # não preenche "Valor Original DL" para retenções automáticas).
                # Heurística: se col2 for numérico OU vazio, usamos col2/3/4 para valores.
                # Se col2 for texto (ex: nome de tipo vazado), usamos col3/4/5.

                def _is_num(s):
                    """True se a string representa um número BR (pode ser vazia)."""
                    v = (s or "").strip().replace(".", "").replace(",", "").replace("-", "")
                    return v == "" or v.replace(" ", "").isdigit()

                if _is_num(txts[2] if len(txts) > 2 else ""):
                    # Layout padrão: col2=VOrig, col3=VBruto, col4=VLiq, col5=Favorecido
                    v_orig  = _val_mov(txts[2] if len(txts) > 2 else "")
                    v_bruto = _val_mov(txts[3] if len(txts) > 3 else "")
                    v_liq   = _val_mov(txts[4] if len(txts) > 4 else "")
                    favorecido = txts[5] if len(txts) > 5 else ""
                    tributo_raw = txts[6] if len(txts) > 6 else ""
                    ndl_raw     = txts[7] if len(txts) > 7 else ""
                    tdl_raw     = txts[8] if len(txts) > 8 else ""
                    situacao_raw= txts[9] if len(txts) > 9 else ""
                else:
                    # Col2 é texto — provavelmente o tipo vazou para a célula de VOrig.
                    # Desloca tudo em +1.
                    if not tipo_str:
                        tipo_str = txts[2] if len(txts) > 2 else ""
                    v_orig  = _val_mov(txts[3] if len(txts) > 3 else "")
                    v_bruto = _val_mov(txts[4] if len(txts) > 4 else "")
                    v_liq   = _val_mov(txts[5] if len(txts) > 5 else "")
                    favorecido = txts[6] if len(txts) > 6 else ""
                    tributo_raw = txts[7] if len(txts) > 7 else ""
                    ndl_raw     = txts[8] if len(txts) > 8 else ""
                    tdl_raw     = txts[9] if len(txts) > 9 else ""
                    situacao_raw= txts[10] if len(txts) > 10 else ""

                # Se v_bruto ainda vazio mas v_orig tem valor, assume bruto = orig
                if not v_bruto and v_orig:
                    v_bruto = v_orig

                # Retenção = orig − bruto (quando orig > bruto)
                v_retencao = 0.0
                if v_orig and v_bruto and v_orig > v_bruto:
                    v_retencao = round(v_orig - v_bruto, 2)

                # v_liq: quando zerado/nulo, usa v_bruto (OBTVs têm tributos em linhas separadas)
                if not v_liq:
                    v_liq = v_bruto

                # Remove texto de tipo que possa ter vazado para favorecido
                if any(t.lower() in (favorecido or "").lower()
                       for t in ["PAGAMENTO", "INGRESSO", "DEVOLUCAO", "RENDIMENTO"]):
                    if not tipo_str:
                        tipo_str = favorecido
                    favorecido = ""

                # ── Normaliza tributo / ndl / tdl ─────────────────────────────────
                # O Transferegov às vezes exibe as colunas nesta ordem diferente:
                #   col6=Tipo do tributo ("PAGAMENTO DE TRIBUTOS"), col7=Sigla ("ISS"),
                #   col8=Nº NF ("904, 905"), col9=Tipo DL ("NOTA FISCAL")
                # Queremos gravar: tributo=sigla(ISS/IR), ndl=número(905), tdl=tipo(NF)
                # Detecção: se tributo_raw parece tipo longo (tem espaço e >5 chars),
                # e ndl_raw parece sigla (ISS/IR/CSLL etc), então troca.
                _siglas_tributo = {"ISS","IR","CSLL","PIS","COFINS","INSS","IRRF","IRPJ"}
                _tributo_norm = tributo_raw.strip()
                _ndl_norm     = ndl_raw.strip()
                _tdl_norm     = tdl_raw.strip()
                _sit_norm     = situacao_raw.strip()

                if _ndl_norm.upper() in _siglas_tributo:
                    # Layout novo: tributo=tipo longo, ndl=sigla → troca
                    _tributo_norm = _ndl_norm          # sigla vai para tributo
                    _ndl_norm     = _tdl_norm          # nº NF vai para ndl
                    _tdl_norm     = _sit_norm          # tipo DL vai para tdl
                    _sit_norm     = ""
                elif _tributo_norm.upper() in _siglas_tributo:
                    pass  # Layout correto, não mexe
                # OBTVs: ndl vazio e tdl tem o número da NF (valor numérico)
                # Neste caso move tdl → ndl para manter consistência
                if not _ndl_norm and _tdl_norm and re.match(r'^[\d,; ]+$', _tdl_norm):
                    _ndl_norm = _tdl_norm
                    _tdl_norm = "NOTA FISCAL"

                # v_orig null para tributos (coletor anterior gravava isso)
                # Garante que nunca seja string vazia — usa None explícito
                _v_orig_final = v_orig if v_orig else None

                mov = {
                    "num":        txts[0].strip(),
                    "data":       txts[1] if len(txts) > 1 else "",
                    "tipo":       tipo_str,
                    "v_orig":     _v_orig_final,
                    "v_bruto":    v_bruto,
                    "v_liq":      v_liq,
                    "v_retencao": v_retencao,
                    "favorecido": (favorecido or "").strip(),
                    "tributo":    _tributo_norm,
                    "ndl":        _ndl_norm,
                    "tdl":        _tdl_norm,
                    "situacao":   _sit_norm,
                }

                if not any(m["num"] == mov["num"] for m in movimentacoes):
                    movimentacoes.append(mov)

            if len(movimentacoes) == qtd_antes:
                log(f"  Movimentacoes: sem novos na pag {pagina}. Fim.")
                break

            # ── Avança para próxima página ─────────────────────────────────
            # O Transferegov usa vários padrões de paginação:
            # 1. Link "[Próx./Última]" (texto literal com colchete)
            # 2. Números de página clicáveis "[1,2,3]"
            # 3. Botão/link com texto "Próximo"
            try:
                prox = None

                # Padrão 1: detecta "Página X de N" e clica no número seguinte
                try:
                    _body_pag = driver.find_element(By.TAG_NAME, "body").text
                    _m_pag = re.search(
                        r'P[áa]gina\s+(\d+)\s+de\s+(\d+)',
                        _body_pag, re.IGNORECASE
                    )
                    if _m_pag:
                        _pag_atual = int(_m_pag.group(1))
                        _pag_total = int(_m_pag.group(2))
                        if _pag_atual >= _pag_total:
                            log(f"  Movimentacoes: ultima pagina ({pagina}/{_pag_total}).")
                            break
                        _prox_num = _pag_atual + 1
                        for _xp_num in [
                            f"//a[normalize-space(text())='{_prox_num}']",
                            f"//a[contains(text(),',{_prox_num}') or contains(text(),'{_prox_num},')]",
                            f"//a[contains(text(),'{_prox_num}')]",
                        ]:
                            try:
                                prox = driver.find_element(By.XPATH, _xp_num)
                                log(f"  Movimentacoes: avancando para pagina {_prox_num}/{_pag_total}.")
                                break
                            except Exception:
                                continue
                except Exception:
                    pass

                # Padrão 2: links com texto Próx/Próximo/Next/>
                if not prox:
                    for _xp in [
                        "//a[contains(translate(normalize-space(text()),'PRÓXÁÉÍÓÚÂÊÎÔÛÃÕÇ','proxaeiouaeiouaoc'),'prox')]",
                        "//a[normalize-space(text())='>' or normalize-space(text())='»']",
                        "//input[@type='button' and (contains(@value,'Pr') or contains(@value,'pr'))]",
                    ]:
                        try:
                            prox = driver.find_element(By.XPATH, _xp)
                            break
                        except Exception:
                            continue

                if not prox:
                    log(f"  Movimentacoes: ultima pagina ({pagina}) — sem link proximo.")
                    break

                driver.execute_script("arguments[0].click();", prox)
                time.sleep(3)
                pagina += 1
            except NoSuchElementException:
                log(f"  Movimentacoes: ultima pagina ({pagina}).")
                break

        # Log diagnóstico: mostra tipos encontrados para debug
        tipos_encontrados = list(set(m["tipo"] for m in movimentacoes if m["tipo"]))
        log(f"  Total movimentacoes: {len(movimentacoes)} | tipos: {tipos_encontrados[:4]}")
    except Exception as e:
        log(f"  Erro movimentacoes: {type(e).__name__}: {str(e)[:80]}")
    return movimentacoes


def preencher_favorecido_movs(movimentacoes, contrato):
    """Pós-processamento: preenche campo 'favorecido' nas movimentações OBTV
    usando os dados do contrato (razão social + CNPJ da empresa executora).
    O Transferegov frequentemente não exibe o favorecido na listagem de movimentações,
    mas ele pode ser obtido cruzando com o contrato do instrumento."""
    if not contrato:
        return movimentacoes
    empresa = contrato.get("empresa", "")
    cnpj    = contrato.get("cnpj", "")
    label   = f"{empresa} ({cnpj})" if empresa and cnpj else (empresa or cnpj)
    for m in movimentacoes:
        t = (m.get("tipo") or "").upper()
        is_obtv = "OBTV" in t or "PAGAMENTO A FAVORECIDO" in t or "PGTO OBTV" in t
        if is_obtv and not m.get("favorecido"):
            m["favorecido"] = label
    return movimentacoes


# ── 4. NOTAS FISCAIS ──────────────────────────────────────────────
def _str_para_float_nf(s):
    """Converte string de valor BR para float. Ex: '338.345,44' → 338345.44"""
    v = str(s).strip().replace("R$","").replace(" ","")
    if not v or v in ("—","","-","NaN","0"):
        return 0.0
    try:
        return float(v.replace(".","").replace(",","."))
    except Exception:
        return 0.0


def coletar_notas_fiscais(driver, id_conv):
    notas = []
    try:
        # ── Estratégia: navegar pelo instrumento aberto e clicar na aba DL ──
        # O Transferegov requer sessão ativa no contexto do convênio.
        # Tentamos 4 URLs em ordem até uma funcionar (não dar 404 nem body vazio).
        _urls_tentativa = [
            # 1. Aba DL dentro do instrumento (mais confiável — preserva sessão)
            (f"{BASE}/ConsultarProposta/ResultadoDaConsultaDeConvenio"
             f"SelecionarConvenio.do?idConvenio={id_conv}&destino="),
            # 2. URL direta da listagem de DL com idConvenio
            (f"{BASE}/execucao/DocumentoDeLiquidacao/"
             f"ListarDocumentoDeLiquidacao.do"
             f"?destino=ListarDocumentoDeLiquidacao&idConvenio={id_conv}"),
            # 3. URL antiga ConsultarNotasFiscais (ainda funciona em alguns convênios)
            (f"{BASE}/execucao/ConsultarNotasFiscais/"
             f"ConsultarNotasFiscais.do?destino=ConsultarNotasFiscais"
             f"&idConvenio={id_conv}"),
            # 4. URL base sem parâmetro idConvenio
            (f"{BASE}/execucao/DocumentoDeLiquidacao/"
             f"ListarDocumentoDeLiquidacao.do"
             f"?destino=ListarDocumentoDeLiquidacao"),
        ]

        _chegou_na_lista = False
        for _tentativa_idx, _url_base in enumerate(_urls_tentativa):
            try:
                log(f"  Doc. Liquidação [{_tentativa_idx+1}]: {_url_base[:90]}")
                driver.get(_url_base)
                time.sleep(4)
                fechar_alert(driver)

                _body_chk = driver.find_element(By.TAG_NAME, "body").text.strip()

                # Se 404 ou página em branco, tenta próxima
                if (not _body_chk
                        or "404" in _body_chk[:200]
                        or "não encontrada" in _body_chk[:200].lower()
                        or "houve um erro" in _body_chk[:200].lower()):
                    log(f"  [DL] URL {_tentativa_idx+1} retornou 404/erro.")
                    continue

                # Se caiu na página do instrumento (estratégia 1), clica na aba DL
                if _tentativa_idx == 0:
                    _clicou_dl = False
                    for _xpath_dl in [
                        "//a[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"
                        "    'abcdefghijklmnopqrstuvwxyz'),'documento de liquid')]",
                        "//a[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"
                        "    'abcdefghijklmnopqrstuvwxyz'),'doc. liquid')]",
                        "//a[contains(@href,'DocumentoDeLiquidacao') or "
                        "    contains(@href,'documentoLiquidacao')]",
                        "//a[contains(@href,'ConsultarNotasFiscais')]",
                    ]:
                        try:
                            _aba_dl = driver.find_element(By.XPATH, _xpath_dl)
                            driver.execute_script("arguments[0].click();", _aba_dl)
                            time.sleep(4)
                            fechar_alert(driver)
                            log(f"  Aba Documento de Liquidação clicada.")
                            _clicou_dl = True
                            break
                        except NoSuchElementException:
                            continue
                    if not _clicou_dl:
                        log(f"  [DL] Aba DL não encontrada no instrumento — tentando URL direta.")
                        continue

                _chegou_na_lista = True
                break
            except Exception as _e_url:
                log(f"  [DL] Erro URL {_tentativa_idx+1}: {_e_url}")
                continue

        if not _chegou_na_lista:
            log(f"  [DL] Nenhuma URL funcionou — NFs não coletadas.")
            return notas

        # Clica em Consultar para carregar os registros (se necessário)
        try:
            btn_consultar = WebDriverWait(driver, 8).until(
                EC.element_to_be_clickable((By.XPATH,
                    "//input[@value='Consultar' or @value='consultar']"
                    "| //button[contains(text(),'Consultar')]"
                ))
            )
            driver.execute_script("arguments[0].click();", btn_consultar)
            time.sleep(5)
            fechar_alert(driver)
            log(f"  Botão Consultar clicado.")
        except TimeoutException:
            log(f"  Botão Consultar não encontrado — lendo direto.")

        # Aguarda tabela aparecer
        try:
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.XPATH, "//table//tr[count(td)>=3]"))
            )
        except TimeoutException:
            pass
        time.sleep(1)

        # ── Coleta lista de NFs via page_source ──
        _src = driver.page_source
        _linhas_html = re.findall(r'<tr[^>]*>(.*?)</tr>', _src, re.DOTALL | re.IGNORECASE)

        def _limpar(h):
            return re.sub(r'<[^>]+>', '', h).strip().replace('&nbsp;', ' ').replace('\n', ' ')

        # ── LOG DIAGNÓSTICO: primeiras 5 linhas com >=4 TDs ──
        _diag_count = 0
        for _dh in _linhas_html:
            _dtds = re.findall(r'<td[^>]*>(.*?)</td>', _dh, re.DOTALL | re.IGNORECASE)
            if len(_dtds) >= 4 and _diag_count < 5:
                _dtxts = [_limpar(t)[:40] for t in _dtds]
                log(f"  [NF diag linha {_diag_count}] {len(_dtds)} TDs: {_dtxts}")
                _diag_count += 1

        for _linha_html in _linhas_html:
            _tds = re.findall(r'<td[^>]*>(.*?)</td>', _linha_html, re.DOTALL | re.IGNORECASE)
            if len(_tds) < 4:
                continue
            txts = [_limpar(t) for t in _tds]

            # Rejeita linhas de cabeçalho
            if any(c in txts[0] for c in ["Número", "Data", "Tipo", "Razão"]):
                log(f"  [NF skip cabeçalho] {txts[:3]}")
                continue

            # ── Detecta offset de coluna ──────────────────────────────────────
            # Layout padrão do Transferegov (NFs):
            #   Variante A (11 cols): Num | Data | Tipo | Razão | VOrig | VBruto |
            #                         Tributos | Contribuições | OutrasRet | VLiq | Status
            #   Variante B (9 cols):  Num | Data | Tipo | Razão | VOrig | VBruto |
            #                         Tributos | VLiq | Status
            # Às vezes uma coluna extra (checkbox/ícone) aparece na posição 0,
            # deslocando tudo em +1.
            # Heurística: col[0] deve ser um número puro (NF 896, 897, 898…).
            #             Se col[0] parece data (dd/mm/aaaa), aplica offset = 1.
            # ── Detecta layout da tabela pelo cabeçalho ──────────────────────
            # Layout A (mais comum, 9 cols):
            #   Nº | Data Emissão | Razão Social | Vlr.Orig | Vlr.Bruto | Tributos | Vlr.Líq | Status | Tipo
            # Layout B (sem data, 8 cols):
            #   Nº | Razão Social | Vlr.Orig | Vlr.Bruto | Tributos | Vlr.Líq | Status | Tipo
            # Layout C (com contribuições, 11 cols):
            #   Nº | Data | Razão | Vlr.Orig | Vlr.Bruto | ISS | IR | Outras | Vlr.Líq | Status | Tipo
            #
            # Detecção: col[1] parece data (dd/mm/aaaa) → Layout A/C; senão Layout B
            # Invariante: col[0] = Nº (número puro ou alfanumérico curto, NÃO data)

            # ── Layout real confirmado pelo diagnóstico (16/05/2026): ──────────
            # col[0]=Data  col[1]=Nº NF  col[2]=Tipo  col[3]=Razão Social
            # col[4]=VOrig col[5]=VBruto col[6]=Tributos col[7]=ISS col[8]=IR col[9]=Status
            # (10 colunas, Vlr.Líquido aparece nos cols 7 e 8 como zeros separados)
            #
            # Invariante: col[0] é SEMPRE uma data (dd/mm/aaaa), col[1] é o Nº da NF

            # col[0] deve ser data
            _c0 = txts[0].strip()
            if not re.match(r'^\d{1,2}/\d{2}/\d{4}$', _c0):
                continue  # não é linha de NF

            # col[1] deve ter dígitos (Nº da NF)
            num_raw = txts[1].strip() if len(txts) > 1 else ""
            if not re.search(r'^\d+$', num_raw):
                continue

            _data  = _c0
            _tipo  = txts[2].strip() if len(txts) > 2 else ""
            _razao = txts[3].strip() if len(txts) > 3 else ""
            _vorig = _str_para_float_nf(txts[4]) if len(txts) > 4 else 0.0
            _vbrut = _str_para_float_nf(txts[5]) if len(txts) > 5 else 0.0

            # cols 6,7,8 = Tributos, ISS separado, IR separado (ou variantes)
            # Soma tudo que for numérico positivo como tributo total
            _vtrib = 0.0
            _vliq  = 0.0
            _status = ""
            if len(txts) >= 10:
                # 10 cols: Trib=col6, ISS=col7, IR=col8, Status=col9
                _vtrib  = (_str_para_float_nf(txts[6]) +
                           _str_para_float_nf(txts[7]) +
                           _str_para_float_nf(txts[8]))
                _status = txts[9].strip()
            elif len(txts) == 9:
                # 9 cols: Trib=col6, VLiq=col7, Status=col8
                _vtrib  = _str_para_float_nf(txts[6])
                _vliq   = _str_para_float_nf(txts[7])
                _status = txts[8].strip()
            elif len(txts) >= 7:
                _vtrib  = _str_para_float_nf(txts[6])
                _status = txts[7].strip() if len(txts) > 7 else ""

            # v_liq = bruto − tributos (Transferegov não exibe campo liq explícito nas 10-col)
            if _vliq == 0.0 and _vbrut > 0:
                _vliq = round(_vbrut - _vtrib, 2)

            # Extrai IDs do HTML da linha
            _m_nf   = re.search(r'idNotaFiscal=(\d+)', _linha_html)
            _m_item = re.search(r'DadosDaNotaFiscalDetalharItem\.do\?id=(\d+)', _linha_html)
            id_nf   = _m_nf.group(1)   if _m_nf   else ""
            id_item = _m_item.group(1) if _m_item else ""

            nota = {
                "num":     num_raw,
                "data":    _data,
                "tipo":    _tipo,
                "razao":   _razao,
                "v_orig":  _vorig,
                "v_bruto": _vbrut,
                "tributos":_vtrib,
                "v_liq":   _vliq,
                "status":  _status,
                "id_nf":   id_nf,
                "id_item": id_item,
                "origem_recurso": "",
                "itens":   [],
            }
            log(f"    NF {num_raw}: {_data} | {_razao[:25]} | "
                f"orig={_vorig} trib={_vtrib} liq={_vliq} status={_status!r}")
            notas.append(nota)

        log(f"  NFs encontradas: {len(notas)}")

        # ── Para cada NF: entra nos Itens do Documento de Liquidação ──
        url_lista = driver.current_url  # URL da lista de NFs após consultar
        for nota in notas:
            id_nf = nota.get("id_nf", "")
            id_item = nota.get("id_item", "")

            if id_nf:
                nota["origem_recurso"], nota["itens"] = coletar_itens_dl(
                    driver, id_nf, id_item, url_lista
                )
                url_lista = driver.current_url  # atualiza após navegar

        log(f"  NFs coletadas: {len(notas)}")
    except Exception as e:
        log(f"  Erro NFs: {type(e).__name__}: {str(e)[:80]}")
    return notas


def coletar_itens_dl(driver, id_nf, id_item, url_retorno):
    """Entra na página de Itens do Documento de Liquidação de uma NF específica.
    Retorna (origem_recurso: str, itens: list).
    URL padrão: ResultadoDaConsultaDetalhar.do?idNotaFiscal=X
    Os itens ficam na seção 'Itens do Documento de Liquidação'.
    A coluna 'Dados do Rateio de Recursos' mostra Repasse / Contrapartida / Rendimento."""
    origens = set()
    itens = []
    # O Transferegov tem dois padrões de URL para o detalhe do Documento de Liquidação:
    # Padrão A (mais comum): ResultadoDaConsultaDetalhar.do?idNotaFiscal=X
    # Padrão B (novo):       DetalharDocumentoDeLiquidacao.do?idDocumentoLiquidacao=X
    # Tentamos A primeiro pois é o que retorna os itens de rateio com segurança.
    url_detalhe     = (f"{BASE}/execucao/ConsultarNotasFiscais/"
                       f"ResultadoDaConsultaDetalhar.do"
                       f"?idNotaFiscal={id_nf}")
    url_detalhe_b   = (f"{BASE}/execucao/DocumentoDeLiquidacao/"
                       f"DetalharDocumentoDeLiquidacao.do"
                       f"?idDocumentoLiquidacao={id_nf}")
    try:
        driver.get(url_detalhe)
        time.sleep(3)
        fechar_alert(driver)
        # Se 404 ou sem conteúdo relevante, tenta padrão B
        _btest = driver.find_element(By.TAG_NAME, "body").text.strip()
        if (len(_btest) < 100
                or "404" in _btest[:200]
                or "não encontrada" in _btest[:200].lower()
                or "houve um erro" in _btest[:200].lower()):
            log(f"    [DL detalhe] URL A sem conteúdo — tentando URL B...")
            driver.get(url_detalhe_b)
            time.sleep(3)
            fechar_alert(driver)
            _btest = driver.find_element(By.TAG_NAME, "body").text.strip()
            # Se ainda sem conteúdo, usa url_retorno como contexto e tenta clicar no item
            if len(_btest) < 100 or "404" in _btest[:200]:
                log(f"    [DL detalhe] URL B também sem conteúdo — pulando NF {id_nf}.")
                try:
                    driver.get(url_retorno)
                    time.sleep(2)
                except Exception:
                    pass
                return " / ".join(["Repasse"]), []

        # Aguarda seção "Itens do Documento de Liquidação"
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//table | //td | //*[contains(text(),'Item')]")
                )
            )
        except TimeoutException:
            pass

        body_text = driver.find_element(By.TAG_NAME, "body").text
        body_lower = body_text.lower()

        # ── Detecta origem do recurso ──
        if "repasse" in body_lower:
            origens.add("Repasse")
        if "contrapartida" in body_lower:
            origens.add("Contrapartida")
        if "rendimento" in body_lower:
            origens.add("Rendimento")

        # ── Extrai itens da tabela "Itens do Documento de Liquidação" ──
        # Tenta encontrar a tabela após o cabeçalho "Itens do Documento de Liquidação"
        _src = driver.page_source
        # Localiza bloco da seção de itens
        _m_sec = re.search(
            r'Itens\s+do\s+Documento\s+de\s+Liquida[çc][aã]o.{0,200}?<table',
            _src, re.DOTALL | re.IGNORECASE
        )
        _tabela_src = _src if not _m_sec else _src[_m_sec.start():]

        _linhas = re.findall(r'<tr[^>]*>(.*?)</tr>', _tabela_src, re.DOTALL | re.IGNORECASE)
        for _linha in _linhas:
            _tds = re.findall(r'<td[^>]*>(.*?)</td>', _linha, re.DOTALL | re.IGNORECASE)
            if len(_tds) < 3:
                continue
            def _lp(h):
                return re.sub(r'<[^>]+>', '', h).strip().replace('&nbsp;',' ').replace('\n',' ')
            txts = [_lp(t) for t in _tds]
            if not any(t for t in txts):
                continue
            # Ignora linha de cabeçalho
            if any(k in txts[0].lower() for k in ["item","qntd","valor total","descrição","nº","número"]):
                continue
            # ── IGNORA linhas de tributos (FEDERAL, MUNICIPAL, ESTADUAL) ──────
            # Essas linhas aparecem na seção de tributos/retenções do DL,
            # NÃO são itens do objeto contratual.
            _desc_upper = txts[0].strip().upper()
            if _desc_upper in ("FEDERAL", "MUNICIPAL", "ESTADUAL", "DISTRITAL",
                               "FEDERAL IRRF", "MUNICIPAL ISS", "ISS", "IR", "IRRF",
                               "INSS", "COFINS", "PIS", "CSLL"):
                log(f"    [item skip tributo] {txts[0]}")
                continue
            # Ignora linhas que parecem ser arquivos/documentos (.pdf, .doc)
            if re.search(r'\.(pdf|doc|docx|jpg|png)\b', txts[0], re.IGNORECASE):
                continue

            # Colunas típicas: Item | Qtd | UN | Valor Total (R$) | Descrição | ...
            #   + Dados do Rateio: Valor Repasse | Valor Contrapartida | Valor Rendimento
            item_desc = txts[0].strip()
            if not item_desc:
                continue

            # Tenta extrair link para DadosDaNotaFiscalDetalharItem
            _m_link = re.search(r'DadosDaNotaFiscalDetalharItem\.do\?id=(\d+)', _linha)
            id_it = _m_link.group(1) if _m_link else ""

            # Valor Total do item (coluna 3 ou 4 tipicamente)
            val_total = 0.0
            for t in txts[2:6]:
                v = _str_para_float_nf(t)
                if v > 0:
                    val_total = v
                    break

            item = {
                "desc":          item_desc,
                "valor":         val_total,
                "id_item":       id_it,
                "repasse":       0.0,
                "contrapartida": 0.0,
                "rendimento":    0.0,
            }

            # Se há link de detalhe do item, entra para pegar o rateio
            if id_it:
                item["repasse"], item["contrapartida"], item["rendimento"] = \
                    coletar_rateio_item(driver, id_it)
                # Volta para a página de detalhe da NF
                driver.get(url_detalhe)
                time.sleep(2)
                fechar_alert(driver)
            else:
                # Tenta extrair rateio direto das colunas finais da linha.
                # Procura padrão de 3 valores (repasse, cp, rendimento) nas colunas numéricas.
                # IMPORTANTE: não usa posição cega — busca apenas valores monetários reais
                # (não números de NF que aparecem em colunas de ID).
                vals_com_idx = [(i, _str_para_float_nf(t)) for i, t in enumerate(txts)
                                if _str_para_float_nf(t) > 0 and
                                   re.match(r'^[\d]{1,3}(?:\.[\d]{3})*,\d{2}$',
                                            t.strip().replace('R$','').strip())]
                if len(vals_com_idx) >= 3:
                    item["repasse"]       = vals_com_idx[0][1]
                    item["contrapartida"] = vals_com_idx[1][1]
                    item["rendimento"]    = vals_com_idx[2][1]
                elif len(vals_com_idx) == 2:
                    item["repasse"]       = vals_com_idx[0][1]
                    item["contrapartida"] = vals_com_idx[1][1]
                elif len(vals_com_idx) == 1:
                    # Um único valor — decide pela origem detectada no body
                    v = vals_com_idx[0][1]
                    if "contrapartida" in body_lower and "repasse" not in body_lower:
                        item["contrapartida"] = v
                    else:
                        item["repasse"] = v

            itens.append(item)

        # Se não achou itens na tabela mas achou valores no body, cria item sintético
        if not itens:
            _m_vt = re.search(
                r'Valor\s+Total[^\d]{0,20}R\$\s*([\d.]+,\d{2})', body_text, re.IGNORECASE
            )
            if _m_vt:
                vt = _str_para_float_nf(_m_vt.group(1))
                itens.append({
                    "desc": "Item do Documento de Liquidação",
                    "valor": vt,
                    "id_item": "",
                    "repasse": vt if "repasse" in body_lower else 0.0,
                    "contrapartida": vt if "contrapartida" in body_lower and "repasse" not in body_lower else 0.0,
                    "rendimento": 0.0,
                })

    except Exception as e:
        log(f"    Erro itens_dl (idNF={id_nf}): {type(e).__name__}: {str(e)[:60]}")

    # Volta para a lista de NFs
    try:
        driver.get(url_retorno)
        time.sleep(2)
    except Exception:
        pass

    ordem = ["Repasse", "Contrapartida", "Rendimento"]
    origem_str = " / ".join(o for o in ordem if o in origens) if origens else "Repasse"
    return origem_str, itens


def coletar_rateio_item(driver, id_item):
    """Entra em DadosDaNotaFiscalDetalharItem.do?id=X e lê a tabela Dados do Rateio.
    Localiza as colunas pelo cabeçalho (Valor Repasse, Valor Contrapartida, Valor Rendimento)
    em vez de posição fixa, para evitar capturar números do texto de Meta/Etapa.
    Retorna (repasse, contrapartida, rendimento) como floats."""
    # URL correta: usa BASE sem /voluntarias já incluído em BASE; ou BASE_HOST + /voluntarias
    url = (f"{BASE}/DetalharNotasFiscais/"
           f"DadosDaNotaFiscalDetalharItem.do?id={id_item}")
    # Fallback alternativo
    url_alt = (f"{BASE_HOST}/voluntarias/DetalharNotasFiscais/"
               f"DadosDaNotaFiscalDetalharItem.do?id={id_item}")
    try:
        driver.get(url)
        time.sleep(3)
        fechar_alert(driver)
        # Se página em branco ou erro 404, tenta URL alternativa
        _btest = driver.find_element(By.TAG_NAME, "body").text.strip()
        if not _btest or "404" in _btest or "não encontrada" in _btest.lower():
            driver.get(url_alt)
            time.sleep(3)
            fechar_alert(driver)

        body = driver.find_element(By.TAG_NAME, "body").text
        repasse = contrapartida = rendimento = 0.0

        # ── Estratégia 1: localiza índices das colunas pelos <th> ──────────────
        # A tabela "Dados do Rateio" tem:
        #   Meta | Etapa | Valor Repasse (R$) | Valor Contrapartida (R$) | Valor Rendimento (R$)
        # Encontra a tabela correta (a que tem "Rateio" no cabeçalho) e mapeia as colunas.
        _src = driver.page_source
        _tabelas = re.findall(r'<table[^>]*>(.*?)</table>', _src, re.DOTALL | re.IGNORECASE)
        for _tab in _tabelas:
            # Só processa tabelas com pelo menos "Repasse" e uma das palavras de rateio
            if not re.search(r'Valor\s+Repasse', _tab, re.IGNORECASE):
                continue

            # Extrai cabeçalhos para mapear índices das colunas
            _headers_raw = re.findall(r'<th[^>]*>(.*?)</th>', _tab, re.DOTALL | re.IGNORECASE)
            _headers = [re.sub(r'<[^>]+>', '', h).strip().lower() for h in _headers_raw]

            idx_rep  = next((i for i, h in enumerate(_headers) if 'repasse' in h), -1)
            idx_cp   = next((i for i, h in enumerate(_headers) if 'contrapartida' in h), -1)
            idx_rend = next((i for i, h in enumerate(_headers) if 'rendimento' in h), -1)

            if idx_rep < 0:
                continue  # tabela errada

            # Extrai linhas de dados — SOMA todas as linhas (pode haver meta+etapa)
            _linhas_dados = re.findall(r'<tr[^>]*>(.*?)</tr>', _tab, re.DOTALL | re.IGNORECASE)
            for _ln in _linhas_dados:
                _tds = re.findall(r'<td[^>]*>(.*?)</td>', _ln, re.DOTALL | re.IGNORECASE)
                if not _tds:
                    continue
                _vals = [re.sub(r'<[^>]+>', '', t).strip().replace('&nbsp;', '') for t in _tds]
                # Ignora linha de cabeçalho
                if any(k in (_vals[0] or "").lower() for k in ["meta","etapa","item","descrição"]):
                    continue

                def _safe_val(idx, vals):
                    if idx < 0 or idx >= len(vals): return 0.0
                    v = _str_para_float_nf(vals[idx])
                    # Rejeita valores que parecem ser números de NF/ID (inteiros grandes sem centavos)
                    raw = vals[idx].strip()
                    if re.match(r'^\d+$', raw) and int(raw) > 9999:
                        return 0.0
                    return v if v >= 0 else 0.0

                if idx_rep >= 0:
                    repasse       += _safe_val(idx_rep,  _vals)
                if idx_cp >= 0:
                    contrapartida += _safe_val(idx_cp,   _vals)
                if idx_rend >= 0:
                    rendimento    += _safe_val(idx_rend, _vals)

            if repasse > 0 or contrapartida > 0 or rendimento > 0:
                break  # achou a tabela correta

        # ── Estratégia 2: regex no body_text (fallback) ────────────────────────
        if repasse == 0 and contrapartida == 0 and rendimento == 0:
            # Padrão: "338.345,44\n0,00\n0,00" após cabeçalhos de rateio
            # Tenta extrair 3 valores na sequência após "Dados do Rateio"
            _bloco = re.search(
                r'Dados\s+do\s+Rateio[^\n]*\n.*?'
                r'([\d.]+,\d{2})\s*\n\s*([\d.]+,\d{2})\s*\n\s*([\d.]+,\d{2})',
                body, re.DOTALL | re.IGNORECASE
            )
            if _bloco:
                repasse       = _str_para_float_nf(_bloco.group(1))
                contrapartida = _str_para_float_nf(_bloco.group(2))
                rendimento    = _str_para_float_nf(_bloco.group(3))
            else:
                # Último recurso: regex por label
                m_rep  = re.search(r'Valor\s+Repasse[^\d]{0,30}([\d.]+,\d{2})', body, re.IGNORECASE)
                m_cp   = re.search(r'Valor\s+Contrapartida[^\d]{0,30}([\d.]+,\d{2})', body, re.IGNORECASE)
                m_rend = re.search(r'Valor\s+Rendimento[^\d]{0,30}([\d.]+,\d{2})', body, re.IGNORECASE)
                if m_rep:  repasse       = _str_para_float_nf(m_rep.group(1))
                if m_cp:   contrapartida = _str_para_float_nf(m_cp.group(1))
                if m_rend: rendimento    = _str_para_float_nf(m_rend.group(1))

        log(f"    Rateio item {id_item}: rep={repasse} cp={contrapartida} rend={rendimento}")
        return repasse, contrapartida, rendimento
    except Exception as e:
        log(f"    Erro rateio_item (id={id_item}): {type(e).__name__}: {str(e)[:50]}")
        return 0.0, 0.0, 0.0


# ── 5. EXECUCAO FISICA ────────────────────────────────────────────
def coletar_exec_fisica(driver, id_conv, id_prop):
    dados = {"exec_fisica_pct": 0, "exec_fisica_str": "0%",
             "ateste_convenente": False, "ateste_concedente": False,
             "status_obra": "", "tem_medicao": False}
    try:
        url_inst = (f"{BASE}/ConsultarProposta/ResultadoDaConsultaDeConvenio"
                    f"SelecionarConvenio.do?idConvenio={id_conv}&destino=")
        if "SelecionarConvenio" not in driver.current_url:
            driver.get(url_inst)
            time.sleep(3)
            fechar_alert(driver)

        if not id_prop:
            src = driver.page_source
            for pat in [r'medicao\.transferegov[^"\']*proposta/(\d+)',
                        r'idProposta=(\d+)']:
                m = re.search(pat, src)
                if m:
                    id_prop = m.group(1)
                    break

        url_med = None
        for lnk in driver.find_elements(By.XPATH,
                "//a[contains(@href,'medicao.transferegov') or contains(@href,'/medicao/')]"):
            href = lnk.get_attribute("href") or ""
            if "medicao.transferegov" in href or "/medicao/" in href:
                url_med = href
                break

        if not url_med and id_prop:
            url_med = (f"https://medicao.transferegov.sistema.gov.br"
                       f"/medicao/acompanhamento/proposta/{id_prop}/dados-gerais")

        if not url_med:
            log(f"  Link de medicao nao encontrado.")
            return dados

        log(f"  Exec. fisica: {url_med[:80]}")
        driver.get(url_med)
        # Verifica 404 rapidamente (3s) antes de aguardar render completo
        time.sleep(3)
        _body_quick = driver.find_element(By.TAG_NAME, "body").text
        _is_404 = ("404" in _body_quick or
                   "não encontrada" in _body_quick.lower() or
                   "page not found" in _body_quick.lower() or
                   "não existe" in _body_quick.lower())
        if not _is_404:
            # Página existe — aguarda render completo da SPA React
            for _wait in range(12):
                time.sleep(2)
                _body_wait = driver.find_element(By.TAG_NAME, "body").text
                if any(k in _body_wait for k in [
                    "Percentual de Execução", "Valor Realizado", "Valor Total",
                    "Resumo Físico", "Acompanhamento de Obras", "Acumulado",
                    "nenhum registro", "Nenhum registro", "%"
                ]):
                    break
            time.sleep(1)
        fechar_alert(driver)

        body = driver.find_element(By.TAG_NAME, "body").text
        body_lower = body.lower()
        _src_dadosgerais = driver.page_source

        # Log do body (primeiras 400 chars) para diagnóstico
        log(f"  [exec_fisica body preview] {body[:200].replace(chr(10),' ')}")

        # ── Captura valor realizado e ateste direto da página /dados-gerais ──
        # A SPA React mostra tabela Lotes/Subm. com colunas:
        # Submeta | Valor Total | Realizado | Empresa R$ | % | Convenente R$ | % | Concedente/Mand R$ | %
        # e linha "Total" com o valor acumulado. Ex: "Acumulado 961.313,35 100,00"
        # Estratégia: pega o maior valor numérico na linha de "Acumulado" como valor realizado
        _m_acum = re.search(
            r'Acumulado\s+([\d.]+,\d{2})\s+[\d.,]+\s+([\d.]+,\d{2})\s+([\d.,]+)',
            body, re.IGNORECASE
        )
        if _m_acum and not dados.get("exec_fisica_valor_realizado"):
            # grupo 1 = valor empresa, grupo 2 = valor convenente (realizado)
            _vr = _str_para_float_nf(_m_acum.group(2))
            if _vr > 0:
                dados["exec_fisica_valor_realizado"] = "R$ {:,.2f}".format(_vr).replace(",","X").replace(".",",").replace("X",".")
        # Fallback: captura "Valor Realizado R$ X" da section Resumo Físico
        if not dados.get("exec_fisica_valor_realizado"):
            _mr2 = re.search(r'Valor\s+Realizado[^\d\n]{0,30}([\d.]+,\d{2})', body, re.IGNORECASE)
            if _mr2:
                dados["exec_fisica_valor_realizado"] = "R$ " + _mr2.group(1)
        # Valor Total (da seção Resumo Físico-Financeiro)
        if not dados.get("exec_fisica_valor_total"):
            _mt = re.search(r'Valor\s+Total[^\d\n]{0,30}([\d.]+,\d{2})', body, re.IGNORECASE)
            if _mt:
                dados["exec_fisica_valor_total"] = "R$ " + _mt.group(1)

        # ── Ateste do Convenente via dados-gerais ──
        # Na SPA /dados-gerais, o ateste do Convenente pode aparecer como botão/card
        # ou na coluna "Situação" da tabela de Lotes: ex "Apta a Iniciar" = pendente
        # Se Convenente % = 100 e Acumulado = Valor Total → convenente atestou
        if not dados["ateste_convenente"]:
            # Convenente acumulado = 100%
            _mc = re.search(r'Convenente.*?100[,.]00', body, re.IGNORECASE | re.DOTALL)
            if _mc:
                dados["ateste_convenente"] = True
            # Padrões diretos
            for _pa in [r'Atestado\s+pelo\s+Convenente', r'convenente.*?atestado',
                        r'atestado.*?convenente', r'Convenente[\s\S]{0,30}Atestado']:
                if re.search(_pa, body, re.IGNORECASE | re.DOTALL):
                    dados["ateste_convenente"] = True
                    break

        # Estratégia 1: elemento visual com o percentual (ex: "100%" dentro de span/div)
        _pct_encontrado = False
        for _sel in [
            "//*[contains(@class,'percentual') or contains(@class,'percent') "
            "    or contains(@class,'pct') or contains(@class,'evolucao')]",
            "//span[contains(text(),'%')]",
            "//div[contains(text(),'%') and string-length(text()) < 10]",
        ]:
            try:
                _els = driver.find_elements(By.XPATH, _sel)
                for _el in _els:
                    _t = _el.text.strip()
                    _m = re.search(r'(\d+(?:[,.]\d+)?)\s*%', _t)
                    if _m:
                        try:
                            _v = float(_m.group(1).replace(",", "."))
                            if 0 <= _v <= 100:
                                dados["exec_fisica_pct"] = _v
                                dados["exec_fisica_str"] = _m.group(1) + "%"
                                _pct_encontrado = True
                                break
                        except Exception:
                            pass
                if _pct_encontrado:
                    break
            except Exception:
                pass

        # Estratégia 2: regex no texto da página
        if not _pct_encontrado:
            for pat in [
                r'Percentual\s+de\s+Execu[cç][aã]o[^\d]{0,40}(\d{1,3}(?:[,.]\d{1,2})?)\s*%',
                r'evolu[cç][aã]o\s+f[ií]sica[^\d]{0,30}(\d{1,3}(?:[,.]\d{1,2})?)\s*%',
                r'execu[cç][aã]o\s+f[ií]sica[^\d]{0,30}(\d{1,3}(?:[,.]\d{1,2})?)\s*%',
                r'Acumulado[^\d]{0,20}(\d{1,3}(?:,\d{1,2})?)\s*[%]',
                r'(\d{1,3}(?:[,.]\d{1,2})?)\s*%\s*(?:executado|realizado|concluído|concluido)',
            ]:
                m = re.search(pat, body, re.IGNORECASE | re.DOTALL)
                if m:
                    try:
                        _v = float(m.group(1).replace(",", "."))
                        if 0 <= _v <= 100:
                            dados["exec_fisica_pct"] = _v
                            dados["exec_fisica_str"] = m.group(1) + "%"
                            break
                    except Exception:
                        pass

        # Estratégia 3: page_source — React renderiza o percentual em vários formatos
        if dados["exec_fisica_pct"] == 0:
            _src = driver.page_source
            # 3a: aria-valuenow="100" (acessibilidade)
            _m2 = re.search(r'aria-valuenow=["\']?(\d+(?:[,.]\d+)?)["\']?', _src)
            if _m2:
                try:
                    _v = float(_m2.group(1).replace(",", "."))
                    if 0 < _v <= 100:
                        dados["exec_fisica_pct"] = _v
                        dados["exec_fisica_str"] = _m2.group(1) + "%"
                except Exception:
                    pass
            # 3b: >(número)< logo antes de "%"
            if dados["exec_fisica_pct"] == 0:
                _m2 = re.search(r'>(\d{1,3}(?:[,.]\d+)?)<[^>]*>\s*%', _src)
                if _m2:
                    try:
                        _v = float(_m2.group(1).replace(",", "."))
                        if 0 < _v <= 100:
                            dados["exec_fisica_pct"] = _v
                            dados["exec_fisica_str"] = _m2.group(1) + "%"
                    except Exception:
                        pass
            # 3c: Acumulado 100,00 (tabela Lotes/Subm.) — coluna % Acumulado Convenente
            if dados["exec_fisica_pct"] == 0:
                _m2 = re.search(r'Acumulado[^\n]{0,200}?(\d{1,3}(?:,\d+)?)\s*\n', body, re.IGNORECASE)
                if _m2:
                    try:
                        _v = float(_m2.group(1).replace(",", "."))
                        if 0 < _v <= 100:
                            dados["exec_fisica_pct"] = _v
                            dados["exec_fisica_str"] = _m2.group(1) + "%"
                    except Exception:
                        pass
            # 3d: busca qualquer número entre 1 e 100 seguido de "%" na página
            if dados["exec_fisica_pct"] == 0:
                _todos_pct = re.findall(r'(\d{1,3}(?:[,.]\d{1,2})?)\s*%', body)
                _candidatos = []
                for _p in _todos_pct:
                    try:
                        _v = float(_p.replace(",", "."))
                        if 0 < _v <= 100:
                            _candidatos.append(_v)
                    except Exception:
                        pass
                if _candidatos:
                    # Pega o maior percentual encontrado (mais provável ser execução total)
                    _vmax = max(_candidatos)
                    dados["exec_fisica_pct"] = _vmax
                    dados["exec_fisica_str"] = str(_vmax).replace(".", ",") + "%"

        # ── Detecção de ateste ────────────────────────────────────────────
        # A SPA React do Transferegov pode exibir o ateste de formas diferentes:
        #   "Atestado pelo Convenente"  /  "Convenente: Atestado"
        #   "convenente" em um card + "Atestado" como status
        #   JSON embutido: "situacaoConvenente":"ATESTADO"  / "atestadoConvenente":true
        # Verifica tanto no body_text quanto no page_source (HTML/JSON da SPA)
        _src_med_ateste = driver.page_source
        _body_ateste = body  # já capturado acima

        _pats_conv = [
            r'convenente.{0,80}atestado',
            r'atestado.{0,80}convenente',
            r'atestado\s+pelo\s+convenente',
            r'situacaoConvenente["\s:>]+ATESTADO',
            r'"atestadoConvenente"\s*:\s*true',
            r'Convenente\s*\n\s*Atestado',
            r'Atestado\s*\n\s*Convenente',
        ]
        for _pat in _pats_conv:
            if re.search(_pat, _body_ateste, re.IGNORECASE | re.DOTALL) or \
               re.search(_pat, _src_med_ateste, re.IGNORECASE | re.DOTALL):
                dados["ateste_convenente"] = True
                break

        _pats_conc = [
            r'concedente.{0,80}atestado',
            r'atestado.{0,80}concedente',
            r'atestado\s+pelo\s+concedente',
            r'situacaoConcedente["\s:>]+ATESTADO',
            r'"atestadoConcedente"\s*:\s*true',
            r'Concedente\s*\n\s*Atestado',
            r'Atestado\s*\n\s*Concedente',
        ]
        for _pat in _pats_conc:
            if re.search(_pat, _body_ateste, re.IGNORECASE | re.DOTALL) or \
               re.search(_pat, _src_med_ateste, re.IGNORECASE | re.DOTALL):
                dados["ateste_concedente"] = True
                break

        # Estratégia adicional: varrer elementos da página com texto "Atestado"
        if not dados["ateste_convenente"] or not dados["ateste_concedente"]:
            try:
                _els_ateste = driver.find_elements(By.XPATH,
                    "//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"
                    "    'abcdefghijklmnopqrstuvwxyz'),'atestado')]"
                )
                for _el in _els_ateste:
                    _ctx = ""
                    # Pega contexto: texto do elemento + elementos próximos
                    try:
                        _ctx = _el.text.strip()
                        _pai = _el.find_element(By.XPATH, "..")
                        _ctx += " " + _pai.text.strip()
                    except Exception:
                        pass
                    _ctx_low = _ctx.lower()
                    if "convenente" in _ctx_low and "atestado" in _ctx_low:
                        dados["ateste_convenente"] = True
                    if "concedente" in _ctx_low and "atestado" in _ctx_low:
                        dados["ateste_concedente"] = True
            except Exception:
                pass

        for row in driver.find_elements(By.XPATH, "//table//tr"):
            cells = row.find_elements(By.XPATH, "./td | ./th")
            if len(cells) >= 2:
                lbl = cells[0].text.strip().lower()
                val = cells[1].text.strip().split("\n")[0]
                if "situa" in lbl and not dados["status_obra"]:
                    dados["status_obra"] = val

        dados["tem_medicao"] = any(k in body_lower for k in
            ["medicao", "valor realizado", "contrato de obra"])

        # ── Navega para aba /medicoes para capturar ateste e valor realizado ──
        # A aba "dados-gerais" mostra % mas não o status de ateste por medição.
        # A aba "medicoes" lista as medições com status Convenente/Concedente.
        if id_prop and not dados["ateste_convenente"]:
            _url_med2 = (f"https://medicao.transferegov.sistema.gov.br"
                         f"/medicao/acompanhamento/proposta/{id_prop}/medicoes")
            try:
                driver.get(_url_med2)
                time.sleep(3)
                _bq2 = driver.find_element(By.TAG_NAME, "body").text
                _is_404_med2 = ("404" in _bq2 or
                                "não encontrada" in _bq2.lower() or
                                "page not found" in _bq2.lower())
                if _is_404_med2:
                    log(f"  [medicoes] 404 — sem medicoes registradas no sistema.")
                else:
                    for _w2 in range(10):
                        time.sleep(2)
                        _bw2 = driver.find_element(By.TAG_NAME, "body").text
                        if any(k in _bw2 for k in [
                            "Medição", "Atestado", "Convenente", "Concedente",
                            "Nenhum", "nenhum", "Status", "Situação"
                        ]):
                            break
                    time.sleep(1)
                    _body_med2 = driver.find_element(By.TAG_NAME, "body").text
                    _src_med2  = driver.page_source
                    log(f"  [medicoes body preview] {_body_med2[:200].replace(chr(10),' ')}")

                # Re-verifica ateste na aba de medições
                for _pat in _pats_conv:
                    if re.search(_pat, _body_med2, re.IGNORECASE | re.DOTALL) or \
                       re.search(_pat, _src_med2, re.IGNORECASE | re.DOTALL):
                        dados["ateste_convenente"] = True
                        break

                for _pat in _pats_conc:
                    if re.search(_pat, _body_med2, re.IGNORECASE | re.DOTALL) or \
                       re.search(_pat, _src_med2, re.IGNORECASE | re.DOTALL):
                        dados["ateste_concedente"] = True
                        break

                # Varredura DOM na aba de medições
                if not dados["ateste_convenente"]:
                    try:
                        _rows_med = driver.find_elements(By.XPATH, "//table//tr | //li | //div[@role='row']")
                        for _rm in _rows_med:
                            _rt = _rm.text.strip().lower()
                            if "atestado" in _rt and "convenente" in _rt:
                                dados["ateste_convenente"] = True
                            if "atestado" in _rt and "concedente" in _rt:
                                dados["ateste_concedente"] = True
                    except Exception:
                        pass

                # Captura Valor Realizado da aba de medições se ainda não temos
                if not dados.get("exec_fisica_valor_realizado"):
                    for _pm in [
                        r'Valor\s+Realizado[^\d\n]{0,30}([\d.]+,\d{2})',
                        r'Realizado[^\d\n]{0,20}([\d.]+,\d{2})',
                        r'"valorRealizado"\s*:\s*([\d.]+)',
                    ]:
                        _mm = re.search(_pm, _body_med2, re.IGNORECASE | re.DOTALL) or \
                              re.search(_pm, _src_med2, re.IGNORECASE)
                        if _mm:
                            _rv = _mm.group(1)
                            try:
                                _fv = float(_rv.replace(".", "").replace(",", "."))
                                dados["exec_fisica_valor_realizado"] = (
                                    "R$ {:,.2f}".format(_fv)
                                    .replace(",","X").replace(".",",").replace("X",".")
                                )
                            except Exception:
                                dados["exec_fisica_valor_realizado"] = "R$ " + _rv
                            break
            except Exception as _e2:
                log(f"  Aviso: aba medicoes nao disponivel: {str(_e2)[:60]}")

        # ── Coleta Valor Realizado e Valor Total da execução física ──
        # A SPA React de Acompanhamento de Obras exibe esses valores em cards.
        # Padrões encontrados no page_source e no body_text:
        #   "Valor Realizado R$ 961.313,35" / "Valor Total R$ 961.313,35"
        #   Também pode estar em JSON embutido: "valorRealizado":961313.35
        _src_med = driver.page_source

        for campo, pats_txt, pats_src in [
            (
                "exec_fisica_valor_realizado",
                [  # padrões no body_text
                    r'Valor\s+Realizado[^\d\n]{0,30}([\d.]+,\d{2})',
                    r'Valor\s+Executado[^\d\n]{0,30}([\d.]+,\d{2})',
                    r'Realizado[^\d\n]{0,20}([\d.]+,\d{2})',
                ],
                [  # padrões no page_source (JSON/props React)
                    r'"valorRealizado"\s*:\s*([\d.]+)',
                    r'"valorExecutado"\s*:\s*([\d.]+)',
                    r'valorRealizado["\s:>]+([0-9]+(?:\.[0-9]+)?)',
                ],
            ),
            (
                "exec_fisica_valor_total",
                [
                    r'Valor\s+Total[^\d\n]{0,30}([\d.]+,\d{2})',
                    r'Valor\s+Contratado[^\d\n]{0,30}([\d.]+,\d{2})',
                    r'Valor\s+da\s+Obra[^\d\n]{0,30}([\d.]+,\d{2})',
                ],
                [
                    r'"valorTotal"\s*:\s*([\d.]+)',
                    r'"valorContrato"\s*:\s*([\d.]+)',
                    r'valorTotal["\s:>]+([0-9]+(?:\.[0-9]+)?)',
                ],
            ),
        ]:
            # Tenta no body_text primeiro
            for pat in pats_txt:
                _m = re.search(pat, body, re.IGNORECASE | re.DOTALL)
                if _m:
                    dados[campo] = "R$ " + _m.group(1).strip()
                    break
            # Fallback no page_source
            if not dados.get(campo):
                for pat in pats_src:
                    _m = re.search(pat, _src_med, re.IGNORECASE)
                    if _m:
                        raw = _m.group(1)
                        # Converte float puro (961313.35) → string BR
                        try:
                            fv = float(raw)
                            dados[campo] = "R$ {:,.2f}".format(fv).replace(",","X").replace(".",",").replace("X",".")
                        except Exception:
                            dados[campo] = "R$ " + raw
                        break
            # Fallback nas TDs da tabela
            if not dados.get(campo):
                _kws_rep = (["realizado","executado"] if "realizado" in campo
                            else ["valor total","contratado","obra"])
                for row in driver.find_elements(By.XPATH, "//table//tr"):
                    cells = row.find_elements(By.XPATH, "./td | ./th")
                    if len(cells) >= 2:
                        lbl_r = cells[0].text.strip().lower()
                        val_r = cells[1].text.strip().split("\n")[0]
                        if any(k in lbl_r for k in _kws_rep):
                            if re.search(r'\d,\d{2}', val_r):
                                dados[campo] = val_r if "R$" in val_r else "R$ " + val_r
                                break

        log(f"  Exec. {dados['exec_fisica_str']}"
            + (f" | Realizado={dados.get('exec_fisica_valor_realizado','')}" if dados.get("exec_fisica_valor_realizado") else "")
            + (f" | Total={dados.get('exec_fisica_valor_total','')}"         if dados.get("exec_fisica_valor_total")     else "")
            + f" | Conv={'OK' if dados['ateste_convenente'] else 'nao'}"
            + f" | Conc={'OK' if dados['ateste_concedente'] else 'pendente'}")
    except Exception as e:
        log(f"  Erro exec. fisica: {type(e).__name__}: {str(e)[:80]}")
    return dados


# ── 6. SALDO DE RENDIMENTOS DE APLICAÇÃO ─────────────────────────
def coletar_saldo_rendimentos(driver, id_conv):
    """Coleta o Valor Total Disponível de Rendimento de Aplicação.
    URL: .../ListarSolicitacaoRendimentosAplicacao.do
    A página exibe o texto 'Rendimento de Aplicação – Valor Total Disponível em DD/MM/AAAA'
    com o valor em destaque (ex: R$ 150.937,98).
    Retorna float ou 0.0 se não encontrado."""
    saldo = 0.0
    try:
        url_rend = (f"{BASE}/execucao/ListarSolicitacaoRendimentosAplicacao/"
                    f"ListarSolicitacaoRendimentosAplicacao.do"
                    f"?destino=ListarSolicitacaoRendimentosAplicacao"
                    f"&idConvenio={id_conv}")
        log(f"  Rendimentos: {url_rend[:90]}")
        driver.get(url_rend)
        time.sleep(4)
        fechar_alert(driver)

        body = driver.find_element(By.TAG_NAME, "body").text
        src  = driver.page_source

        # Verificação rápida: se a página exibe R$ 0,00 como valor total,
        # retorna 0.0 imediatamente — evita que fallbacks capturem outros
        # números da página (ex: saldo de conta corrente).
        # Também cobre o caso "Nenhum registro foi encontrado" sem valor.
        pat_zero = r"Valor\s+Total\s+Disponível[^\n]{0,80}R\$\s*0,00"
        if re.search(pat_zero, body, re.IGNORECASE):
            log("  Rendimento disponível: R$ 0,00 (página confirma zero)")
            return 0.0
        if "nenhum registro foi encontrado" in body.lower() and \
                not re.search(r"R\$\s*(?!0,00)[1-9][\d.]*,\d{2}", body):
            log("  Rendimento: nenhum registro e sem valor positivo na página → 0.0")
            return 0.0

        # Padrão principal: "Valor Total Disponível em DD/MM/AAAA ... R$ X.XXX,XX"
        # O valor fica logo depois do bloco de aviso, em destaque
        for pat in [
            r"Valor\s+Total\s+Disponível\s+em\s+\d{2}/\d{2}/\d{4}[^\d]{0,200}?R\$\s*([\d.]+,\d{2})",
            r"Rendimento\s+de\s+Aplica[çc][aã]o[^\d]{0,300}?R\$\s*([\d.]+,\d{2})",
            r"R\$\s*([\d.]+,\d{2})\s*$",          # último valor monetário na página
        ]:
            m = re.search(pat, body, re.IGNORECASE | re.DOTALL)
            if m:
                saldo = _reais_para_float(m.group(1)) or 0.0
                if saldo > 0:
                    log(f"  Rendimento disponível: R$ {m.group(1)}")
                    break

        # Fallback no page_source — busca apenas padrões próximos a palavras-chave.
        # NÃO usamos "último valor do src" pois ele captura o saldo disponível
        # (ex: R$ 290,34) em vez do total histórico de rendimentos recebidos.
        if saldo == 0.0:
            for _pat_src in [
                r"Valor\s+Total\s+Dispon[íi]vel[^\d]{0,100}?([\d]{1,3}(?:\.[\d]{3})*,\d{2})",
                r"Rendimento[^\d]{0,200}?([\d]{1,3}(?:\.[\d]{3})*,\d{2})",
            ]:
                _ms = re.search(_pat_src, src, re.IGNORECASE | re.DOTALL)
                if _ms:
                    _f = _reais_para_float(_ms.group(1))
                    if _f and _f > 0:
                        saldo = _f
                        log(f"  Rendimento (fallback src keyword): R$ {_ms.group(1)}")
                        break

    except Exception as e:
        log(f"  Erro rendimentos: {type(e).__name__}: {str(e)[:80]}")
    return saldo


# ── ORQUESTRADOR ──────────────────────────────────────────────────
def coletar_instrumento(driver, numero, objeto):
    log(f"\n{'─'*55}")
    log(f"  Instrumento: {numero}")

    reg = {
        "numero": numero, "objeto": objeto,
        "coletado_em": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "valor_global": "", "valor_repasse": "", "valor_contrapartida": "",
        "situacao_tgov": "", "regime_simplificado": False,
        "tipo_instrumento": "", "ano": "",
        "contratos": [], "movimentacoes": [], "notas_fiscais": [],
        "exec_fisica_pct": 0, "exec_fisica_str": "0%",
        "exec_fisica_valor_realizado": "", "exec_fisica_valor_total": "",
        "ateste_convenente": False, "ateste_concedente": False,
        "status_obra": "", "tem_medicao": False,
        "saldo_rendimentos": 0.0,  # Saldo da aba Rendimento de Aplicação
        "_id_convenio": "", "_id_proposta": "", "erro": "",
        "obs_manual": "",  # Observação automática ou preenchida manualmente
    }

    try:
        achou, id_conv = buscar_instrumento(driver, numero)
        if not achou or not id_conv:
            reg["erro"] = "Nao encontrado no Transferegov"
            return reg

        reg["_id_convenio"] = id_conv

        id_prop = None
        if "idProposta=" in driver.current_url:
            id_prop = driver.current_url.split("idProposta=")[1].split("&")[0]
        if not id_prop:
            id_prop = extrair_id_proposta(driver)
        reg["_id_proposta"] = id_prop or ""
        log(f"  idConvenio={id_conv} | idProposta={id_prop}")

        g = coletar_dados_gerais(driver, id_conv)
        reg.update({"valor_global": g["valor_global"],
                    "valor_repasse": g["valor_repasse"],
                    "valor_contrapartida": g["valor_contrapartida"],
                    "situacao_tgov": g["situacao_tgov"],
                    "regime_simplificado": g["regime_simplificado"],
                    "tipo_instrumento": g["tipo_instrumento"],
                    "ano": g["ano"]})
        if g["objeto"]:
            reg["objeto"] = g["objeto"]

        reg["contratos"] = coletar_contratos(driver, numero, id_conv)
        time.sleep(1)
        reg["movimentacoes"] = coletar_movimentacoes(driver, id_conv)
        # Preenche favorecido das OBTVs com dados do contrato
        _contrato_principal = reg["contratos"][0] if reg["contratos"] else None
        reg["movimentacoes"] = preencher_favorecido_movs(reg["movimentacoes"], _contrato_principal)
        time.sleep(1)
        reg["notas_fiscais"] = coletar_notas_fiscais(driver, id_conv)

        # ── Fallback: infere empresa das NFs quando contratos estão vazios ──
        # Instrumentos 2012 com SPA Angular sem dados: a razão social da empresa
        # aparece nas notas fiscais coletadas (CONSTRUTORA P2 LTDA no 781089).
        if not reg["contratos"] and reg["notas_fiscais"]:
            from collections import Counter
            _razoes = [nf.get("razao", "") for nf in reg["notas_fiscais"] if nf.get("razao")]
            if _razoes:
                _razao_princ = Counter(_razoes).most_common(1)[0][0]
                log(f"  [fallback] Empresa inferida das NFs: {_razao_princ}")
                reg["contratos"] = [{
                    "numero_contrato": "—",
                    "situacao":        "Rescindido (inferido)",
                    "valor": "", "valor_repasse": "",
                    "dt_inicio": "", "dt_fim": "",
                    "cnpj": "", "razao_social": _razao_princ,
                }]

        # ── Preenche CNPJ no contrato inferido usando movimentações pré-OBTV ──
        # Quando o instrumento não opera com OBTV, as movimentações vêm da aba
        # Pagamento e já trazem o CNPJ da empresa favorecida.
        if reg["contratos"] and not reg["contratos"][0].get("cnpj"):
            _cnpj_mov = next(
                (m.get("cnpj", "") for m in reg["movimentacoes"] if m.get("cnpj")),
                ""
            )
            if _cnpj_mov:
                reg["contratos"][0]["cnpj"] = _cnpj_mov
                log(f"  [CNPJ do contrato] preenchido das movimentações: {_cnpj_mov}")

        time.sleep(1)
        ef = coletar_exec_fisica(driver, id_conv, id_prop)
        reg.update(ef)
        time.sleep(1)
        reg["saldo_rendimentos"] = coletar_saldo_rendimentos(driver, id_conv)

        # ── obs_manual: gerado automaticamente, pode ser editado depois ──
        _obs = reg.get("obs_manual", "")
        if not _obs:
            _ano_str = reg.get("ano", "")
            _ano = int(_ano_str) if _ano_str and _ano_str.isdigit() else 0
            _tem_mov = bool(reg.get("movimentacoes"))
            _mov_pre_obtv = _tem_mov and any(
                m.get("tipo") == "PAGAMENTO" for m in reg.get("movimentacoes", [])
            )
            _inferido = any("inferido" in (c.get("situacao") or "").lower()
                            for c in reg.get("contratos", []))
            if not _tem_mov and _ano and _ano <= 2015:
                _obs = ("Instrumento antigo (pré-OBTV). Pagamentos inseridos "
                        "diretamente na plataforma — movimentações não disponíveis "
                        "na API OBTV. Empresa executora (CONSTRUTORA P2 LTDA) "
                        "rescindida; novo projeto apresentado e aguardando "
                        "análise da CAIXA para licitação do remanescente.")
            elif _mov_pre_obtv and _ano and _ano <= 2015:
                _obs = ("Instrumento antigo (pré-OBTV). Pagamentos coletados "
                        "da aba Pagamento do Transferegov — movimentações OBTV "
                        "não disponíveis. Empresa executora rescindida; novo "
                        "projeto aguardando análise da CAIXA para licitação "
                        "do remanescente.")
            elif _inferido:
                _obs = ("Empresa executora inferida das notas fiscais — "
                        "SPA de Instrumentos Contratuais não retornou dados.")
            if _obs:
                log(f"  [obs_manual auto] {_obs[:80]}")
        reg["obs_manual"] = _obs

        log(f"  OK: contratos={len(reg['contratos'])} | "
            f"mov={len(reg['movimentacoes'])} | nfs={len(reg['notas_fiscais'])}")
    except Exception as e:
        reg["erro"] = f"{type(e).__name__}: {e}"
        log(f"  ERRO: {e}")
    return reg


# ── PUBLICAR NO GITHUB ────────────────────────────────────────────
NOME_ABA_EXEC   = "EXEC_FIN"
CABECALHOS_EXEC = [
    "Número",            # A
    "Coletado em",       # B
    "Valor Global",      # C
    "Valor Repasse",     # D
    "Valor Contrapartida",# E
    "Total Pago Repasse",# F
    "Total Pago Contrap.",# G
    "Saldo Repasse",     # H
    "Saldo Rendimentos", # I
    "% Exec. Financeira",# J
    "% Exec. Física",    # K
    "Ateste Convenente", # L
    "Ateste Concedente", # M
    "Nº Contrato",       # N
    "Empresa",           # O
    "CNPJ",              # P
    "Qtd NFs",           # Q
    "Situação (Tgov)",   # R
    "Regime",            # S
    "Tipo Instrumento",  # T
    "Ano",               # U
    "Obs. Manual",       # V
]


def _calcTotalPagoRepasse(reg):
    """Replica a lógica do frontend: soma v_bruto de OBTVs que NÃO são contrapartida."""
    cnpj_idepi = "09.034.960/0001-47"
    try:
        val_cp = float(str(reg.get("valor_contrapartida", "0")).replace("R$","").replace(".","").replace(",",".").strip() or 0)
    except Exception:
        val_cp = 0.0

    total = 0.0
    for mov in reg.get("movimentacoes", []):
        if "OBTV" not in mov.get("tipo", "").upper():
            continue
        fav = str(mov.get("favorecido", ""))
        v_orig = float(mov.get("v_orig") or 0)
        # Exclui se favorecido é o IDEPI
        if cnpj_idepi in fav:
            continue
        # Exclui se valor bate exatamente com contrapartida
        if val_cp and abs(v_orig - val_cp) < 0.01:
            continue
        # Verifica se NF associada tem apenas contrapartida (itens cp>0, rep=0)
        tdl = str(mov.get("tdl", ""))
        eh_cp = False
        for nf in reg.get("notas_fiscais", []):
            if str(nf.get("num", "")) == tdl:
                for item in nf.get("itens", []):
                    if float(item.get("repasse", 0)) == 0 and float(item.get("contrapartida", 0)) > 0:
                        eh_cp = True
                break
        if not eh_cp:
            total += float(mov.get("v_bruto") or 0)
    return total


def _calcTotalPagoCP(reg):
    """Soma OBTVs de contrapartida."""
    cnpj_idepi = "09.034.960/0001-47"
    try:
        val_cp = float(str(reg.get("valor_contrapartida", "0")).replace("R$","").replace(".","").replace(",",".").strip() or 0)
    except Exception:
        val_cp = 0.0

    total = 0.0
    for mov in reg.get("movimentacoes", []):
        if "OBTV" not in mov.get("tipo", "").upper():
            continue
        fav = str(mov.get("favorecido", ""))
        v_orig = float(mov.get("v_orig") or 0)
        if cnpj_idepi in fav:
            continue
        tdl = str(mov.get("tdl", ""))
        eh_cp = False
        for nf in reg.get("notas_fiscais", []):
            if str(nf.get("num", "")) == tdl:
                for item in nf.get("itens", []):
                    if float(item.get("repasse", 0)) == 0 and float(item.get("contrapartida", 0)) > 0:
                        eh_cp = True
                break
        if eh_cp or (val_cp and abs(v_orig - val_cp) < 0.01):
            total += float(mov.get("v_bruto") or 0)
    return total


def _reais_float(s):
    """Converte 'R$ 1.234,56' ou 1234.56 para float."""
    if isinstance(s, (int, float)):
        return float(s)
    try:
        return float(str(s).replace("R$","").replace(".","").replace(",",".").strip())
    except Exception:
        return 0.0


def gravar_exec_sheets(sheet_raiz, resultados):
    """
    Cria (se necessário) a aba EXEC_FIN na planilha e grava/atualiza
    uma linha por instrumento coletado.

    Parâmetros
    ----------
    sheet_raiz : gspread.Spreadsheet
        Objeto planilha (não a aba sheet1, mas o Spreadsheet pai).
    resultados : list[dict]
        Lista de registros já coletados pelo exec_financeiro.py.
    """
    # ── 1. Obtém ou cria a aba EXEC_FIN ──────────────────────────────────────
    try:
        aba = sheet_raiz.worksheet(NOME_ABA_EXEC)
        log(f"[Sheets] Aba '{NOME_ABA_EXEC}' encontrada.")
    except Exception:
        aba = sheet_raiz.add_worksheet(title=NOME_ABA_EXEC, rows=200, cols=len(CABECALHOS_EXEC) + 2)
        log(f"[Sheets] Aba '{NOME_ABA_EXEC}' criada.")

    # ── 2. Garante cabeçalho na linha 1 ──────────────────────────────────────
    linha1 = aba.row_values(1)
    if linha1 != CABECALHOS_EXEC:
        aba.update("A1", [CABECALHOS_EXEC])
        aba.format("A1:V1", {
            "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
            "backgroundColor": {"red": 0.10, "green": 0.27, "blue": 0.49},
            "horizontalAlignment": "CENTER",
        })
        log("[Sheets] Cabeçalho da aba EXEC_FIN gravado.")

    # ── 3. Lê índice: número → número da linha ────────────────────────────────
    todos = aba.get_all_values()
    idx_numero = {}  # "946260" → linha (1-based)
    for i, row in enumerate(todos[1:], start=2):
        num = str(row[0]).strip() if row else ""
        if num:
            idx_numero[num] = i

    # ── 4. Monta as linhas a gravar ───────────────────────────────────────────
    atualizacoes = []  # lista de {"range": "A5", "values": [[...]]}

    for reg in resultados:
        if reg.get("erro"):
            log(f"[Sheets] {reg['numero']} ignorado (erro na coleta).")
            continue

        num = reg.get("numero", "")
        contrato = (reg.get("contratos") or [{}])[0]

        pago_rep = _calcTotalPagoRepasse(reg)
        pago_cp  = _calcTotalPagoCP(reg)
        val_rep  = _reais_float(reg.get("valor_repasse", 0))
        val_cp   = _reais_float(reg.get("valor_contrapartida", 0))
        saldo_rep = max(val_rep - pago_rep, 0.0)
        saldo_rend = float(reg.get("saldo_rendimentos") or 0)

        pct_fin = ""
        if val_rep > 0:
            pct_fin = f"{round(pago_rep / val_rep * 100, 1)}%"

        pct_fis = reg.get("exec_fisica_str", "") or (
            f"{reg.get('exec_fisica_pct', '')}%" if reg.get("exec_fisica_pct") not in (None, "") else ""
        )

        def fmt_reais(v):
            return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

        linha = [
            num,                                                          # A
            reg.get("coletado_em", ""),                                   # B
            reg.get("valor_global", ""),                                  # C
            reg.get("valor_repasse", ""),                                 # D
            reg.get("valor_contrapartida", ""),                           # E
            fmt_reais(pago_rep),                                          # F
            fmt_reais(pago_cp),                                           # G
            fmt_reais(saldo_rep),                                         # H
            fmt_reais(saldo_rend),                                        # I
            pct_fin,                                                      # J
            pct_fis,                                                      # K
            "SIM" if reg.get("ateste_convenente") else "NÃO",            # L
            "SIM" if reg.get("ateste_concedente") else "NÃO",            # M
            contrato.get("numero_contrato", ""),                          # N
            contrato.get("razao_social", ""),                             # O
            contrato.get("cnpj", ""),                                     # P
            str(len(reg.get("notas_fiscais", []))),                       # Q
            reg.get("situacao_tgov", ""),                                 # R
            "Simplificado" if reg.get("regime_simplificado") else "Normal",# S
            reg.get("tipo_instrumento", ""),                              # T
            reg.get("ano", ""),                                           # U
            reg.get("obs_manual", ""),                                    # V
        ]

        linha_num = idx_numero.get(num)
        if linha_num:
            # Atualiza linha existente
            atualizacoes.append({"range": f"A{linha_num}:V{linha_num}", "values": [linha]})
        else:
            # Insere nova linha (próxima vazia após cabeçalho)
            prox = max(idx_numero.values(), default=1) + 1 if idx_numero else 2
            # Re-lê para garantir
            prox = len(aba.get_all_values()) + 1
            atualizacoes.append({"range": f"A{prox}:V{prox}", "values": [linha]})
            idx_numero[num] = prox  # evita conflito se vários novos

    # ── 5. Grava em lote ──────────────────────────────────────────────────────
    if not atualizacoes:
        log("[Sheets] Nenhuma linha para gravar na EXEC_FIN.")
        return

    # Divide em lotes de 20 (a aba pode ter muitos campos)
    lote_size = 20
    for inicio in range(0, len(atualizacoes), lote_size):
        lote = atualizacoes[inicio:inicio + lote_size]
        try:
            aba.batch_update(lote)
            log(f"[Sheets] Lote {inicio // lote_size + 1} gravado ({len(lote)} linha(s)).")
            time.sleep(1)
        except Exception as e:
            log(f"[Sheets] Erro ao gravar lote {inicio // lote_size + 1}: {e}")

    log(f"[Sheets] ✅ EXEC_FIN atualizada: {len(atualizacoes)} instrumento(s).")


def publicar_github(novos_dados):
    import base64
    import requests

    with open("dados_exec_backup.json", "w", encoding="utf-8") as f:
        json.dump({"exec_financeira": novos_dados,
                   "gerado_em": datetime.now().strftime("%d/%m/%Y %H:%M")},
                  f, ensure_ascii=False, indent=2)
    log("Backup salvo: dados_exec_backup.json")

    if not GITHUB_TOKEN:
        log("GITHUB_TOKEN nao definido -- nao publicou no GitHub.")
        log("Defina: set GITHUB_TOKEN=seu_token  (Windows)")
        log("        export GITHUB_TOKEN=seu_token (Linux/Mac)")
        return

    api_url = (f"https://api.github.com/repos/{GITHUB_USUARIO}/{GITHUB_REPO}"
               f"/contents/{GITHUB_ARQUIVO}")
    headers = {"Authorization": f"token {GITHUB_TOKEN}",
               "Accept": "application/vnd.github.v3+json"}

    dados_atuais, sha = {}, None
    try:
        r = requests.get(api_url, headers=headers, timeout=15)
        if r.status_code == 200:
            info = r.json()
            sha = info.get("sha")
            dados_atuais = json.loads(base64.b64decode(info["content"]).decode())
    except Exception as e:
        log(f"Erro lendo dados.json do GitHub: {e}")

    exec_lista = dados_atuais.get("exec_financeira", [])
    idx = {r["numero"]: i for i, r in enumerate(exec_lista)}
    for reg in novos_dados:
        if reg["numero"] in idx:
            exec_lista[idx[reg["numero"]]] = reg
        else:
            exec_lista.append(reg)

    dados_atuais["exec_financeira"] = exec_lista
    dados_atuais["exec_atualizado_em"] = datetime.now().strftime("%d/%m/%Y %H:%M")

    conteudo = json.dumps(dados_atuais, ensure_ascii=False, indent=2)
    payload = {"message": f"exec_financeiro: {len(novos_dados)} instrumento(s) "
               f"-- {datetime.now().strftime('%d/%m/%Y %H:%M')}",
               "content": base64.b64encode(conteudo.encode()).decode()}
    if sha:
        payload["sha"] = sha

    r = requests.put(api_url, headers=headers, json=payload, timeout=30)
    if r.status_code in (200, 201):
        log(f"Publicado no GitHub! {len(novos_dados)} instrumento(s).")
    else:
        log(f"Erro GitHub: {r.status_code} -- {r.text[:200]}")


# ── PRINCIPAL ─────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="IDEPI -- Coletor de Execucao Financeira",
        epilog="""
Exemplos:
  python exec_financeiro.py                     todos os ativos
  python exec_financeiro.py --num 946260        so o 946260
  python exec_financeiro.py --num 946260 946261 dois instrumentos
  python exec_financeiro.py --todos             inclui finalizados
        """
    )
    parser.add_argument("--num", nargs="+", default=None)
    parser.add_argument("--todos", action="store_true")
    args = parser.parse_args()

    print("=" * 60)
    print("  IDEPI -- Coletor de Execucao Financeira")
    print(f"  Iniciado: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    if args.num:
        print(f"  Filtro: {', '.join(args.num)}")
    print("=" * 60)

    log("Conectando ao Google Sheets...")
    try:
        sheet = conectar_sheets()
    except Exception as e:
        log(f"Erro Sheets: {e}")
        sys.exit(1)

    numeros_filtro = set(args.num) if args.num else None
    convenios = ler_convenios(sheet, numeros_filtro=numeros_filtro,
                              incluir_finalizados=args.todos)

    if not convenios:
        log("Nenhum convenio para processar.")
        sys.exit(0)

    log(f"{len(convenios)} convenio(s) para processar.")

    driver = criar_driver()
    resultados = []

    try:
        log("Estabelecendo sessao no Transferegov...")
        if not estabelecer_sessao(driver):
            log("Nao foi possivel estabelecer sessao. Verifique o login.")
            driver.quit()
            sys.exit(1)

        for i, conv in enumerate(convenios):
            log(f"\n[{i+1}/{len(convenios)}] {conv['numero']}")
            reg = coletar_instrumento(driver, conv["numero"], conv["objeto"])
            resultados.append(reg)
            if i < len(convenios) - 1:
                time.sleep(PAUSA_ENTRE)

    except KeyboardInterrupt:
        log("Interrompido pelo usuario.")
    finally:
        try:
            driver.quit()
        except Exception:
            pass
        log("Chrome encerrado.")

    if resultados:
        publicar_github(resultados)

    ok  = sum(1 for r in resultados if not r.get("erro"))
    err = sum(1 for r in resultados if r.get("erro"))
    print(f"\n{'='*60}")
    print(f"  Sucesso: {ok}   Erro: {err}")
    print(f"  Concluido: {datetime.now().strftime('%H:%M:%S')}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
