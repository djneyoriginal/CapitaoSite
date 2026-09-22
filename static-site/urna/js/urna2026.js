"use strict";

/* Simulação educativa dos cargos cadastrados para São Paulo em 2026. */
/** As fontes de dados são carregadas antes desta lógica pela ordem dos scripts defer. */
const dados = window.URNA_DADOS_SP;
const dadosGovernador = window.URNA_DADOS_GOVERNADOR;
const presidencia = window.URNA_CONFIG;
/** Chave da apuração local. Os tempos abaixo estão em milissegundos. */
const CHAVE = "urna-escola-sp-2026-seis-votos-v2";
const DURACAO_FIM = 5000;
const TEMPO_CONFERENCIA = 1000;
const LIMITE_GUIA = 40;

/** Aplica as regras educativas de elegibilidade; a lista continua exibindo os registros inaptos. */
function podeVotar(candidato) {
  if (candidato.votavel === false) return false;
  return candidato.situacao !== "Inapto" && !["Renúncia", "Indeferido"].includes(candidato.status);
}

/** Cada cargo reúne nome, quantidade de dígitos e sua lista de candidatos. */
const cargos = {
  federal: { nome: "DEPUTADO FEDERAL", digitos: 4, ...dados.federal },
  estadual: { nome: "DEPUTADO ESTADUAL", digitos: 5, ...dados.estadual },
  senador: { nome: "SENADOR", digitos: 3, ...dados.senador },
  governador: { nome: "GOVERNADOR", digitos: 2, ...dadosGovernador },
  presidente: {
    nome: "PRESIDENTE DA REPÚBLICA", digitos: 2,
    source: "Perfis do g1 informados pelo usuário", extractedAt: "",
    candidates: presidencia.candidatos
  }
};
/** Há seis escolhas porque o Senado aparece duas vezes. */
const etapas = [
  { cargo: "federal", titulo: "DEPUTADO FEDERAL" },
  { cargo: "estadual", titulo: "DEPUTADO ESTADUAL" },
  { cargo: "senador", titulo: "SENADOR · PRIMEIRA VAGA" },
  { cargo: "senador", titulo: "SENADOR · SEGUNDA VAGA" },
  { cargo: "governador", titulo: "GOVERNADOR" },
  { cargo: "presidente", titulo: "PRESIDENTE DA REPÚBLICA" }
];

/** Map oferece busca direta por número e rejeita números ativos ambíguos. */
const candidatosPorNumero = Object.fromEntries(Object.entries(cargos).map(([id, cargo]) => {
  const mapa = new Map();
  cargo.candidates.filter(podeVotar).forEach((candidato) => {
    if (mapa.has(candidato.numero)) throw new Error(`Número ativo repetido em ${id}: ${candidato.numero}`);
    mapa.set(candidato.numero, candidato);
  });
  return [id, mapa];
}));

/** Estado temporário da votação em andamento; a apuração guarda sessões completas. */
const estado = {
  etapa: 0, digitos: "", branco: false, liberado: false, fase: "votacao",
  escolhas: [], somLigado: true, temporizadorConferencia: null, temporizadorFim: null,
  guiaLimite: LIMITE_GUIA
};
/** Referências aos nós do HTML usados na atualização da tela. */
const elementos = {};
let contextoDeAudio = null;
let temporizadorToast = null;

/** Retorna o objeto do cargo da etapa atual, incluindo a quantidade de dígitos. */
function obterCargoAtual() { return cargos[etapas[estado.etapa].cargo]; }
/** Retorna a chave interna do cargo, usada para acessar os totais e os candidatos. */
function obterIdAtual() { return etapas[estado.etapa].cargo; }

/** Interrompe a inicialização se faltar uma lista ou se um número tiver tamanho incorreto. */
function validarDados() {
  for (const [id, cargo] of Object.entries(cargos)) {
    if (!Array.isArray(cargo.candidates) || cargo.candidates.length === 0) throw new Error(`Sem candidaturas: ${id}`);
    cargo.candidates.forEach((candidato) => {
      if (!/^\d+$/.test(candidato.numero) || candidato.numero.length !== cargo.digitos) {
        throw new Error(`Número inválido em ${id}: ${candidato.numero}`);
      }
    });
  }
}

/** Cria os contadores zerados por cargo, incluindo branco, nulo e sessões completas. */
function criarApuracao() {
  return {
    sessoes: 0,
    cargos: Object.fromEntries(Object.entries(cargos).map(([id]) => [id, {
      ...Object.fromEntries([...candidatosPorNumero[id].keys()].map((numero) => [numero, 0])),
      branco: 0, nulo: 0
    }]))
  };
}

/** Recupera somente contadores inteiros válidos do navegador; ignora dados locais corrompidos. */
function lerApuracao() {
  const apuracao = criarApuracao();
  try {
    const salva = JSON.parse(localStorage.getItem(CHAVE));
    if (!salva || typeof salva !== "object") return apuracao;
    if (Number.isSafeInteger(salva.sessoes) && salva.sessoes >= 0) apuracao.sessoes = salva.sessoes;
    for (const [id, linhas] of Object.entries(apuracao.cargos)) {
      for (const chave of Object.keys(linhas)) {
        const valor = salva.cargos?.[id]?.[chave];
        if (Number.isSafeInteger(valor) && valor >= 0) linhas[chave] = valor;
      }
    }
  } catch (_) { /* Dados locais indisponíveis: iniciar uma apuração vazia. */ }
  return apuracao;
}

/** Persiste os totais neste navegador e avisa caso o armazenamento esteja indisponível. */
function salvarApuracao(apuracao) {
  try { localStorage.setItem(CHAVE, JSON.stringify(apuracao)); }
  catch (_) { mostrarToast("O navegador não permitiu guardar a apuração local."); }
}

/** Converte a digitação em candidato, branco ou nulo; impede repetir senador na segunda vaga. */
function classificarEscolha() {
  const id = obterIdAtual();
  if (estado.branco) return { cargo: id, tipo: "branco", numero: null };
  const candidato = candidatosPorNumero[id].get(estado.digitos) || null;
  if (id === "senador" && estado.etapa === 3 &&
      estado.escolhas[2]?.tipo === "candidato" && estado.escolhas[2].numero === estado.digitos) {
    return { cargo: id, tipo: "nulo", numero: null, motivo: "MESMO CANDIDATO DA PRIMEIRA VAGA" };
  }
  return candidato
    ? { cargo: id, tipo: "candidato", numero: candidato.numero, candidato }
    : { cargo: id, tipo: "nulo", numero: null, motivo: "NÚMERO SEM CANDIDATURA ATIVA" };
}

/** Valida as listas, conecta elementos e eventos e desenha a primeira etapa após o HTML carregar. */
function iniciar() {
  validarDados();
  [
    "ballotState", "finishState", "stageProgress", "officeName", "digitBoxes",
    "candidateData", "candidateName", "candidateProject", "candidatePhotoWrap",
    "candidatePhoto", "nullVote", "nullReason", "blankVote", "reviewMessage",
    "keyHint", "blankButton", "correctButton", "confirmButton", "guideOffice",
    "candidateSearch", "candidateGuide", "guideCount", "guideMore", "guideSource",
    "soundButton", "fullscreenButton", "resultsButton", "resultsDialog",
    "resultsOffice", "resultsList", "dragonReward", "dragonWinner", "totalVotes", "validVotes", "resetButton",
    "exportButton", "toast", "announcer"
  ].forEach((id) => { elementos[id] = document.getElementById(id); });

  document.querySelectorAll("[data-number]").forEach((tecla) => {
    tecla.addEventListener("click", () => digitar(tecla.dataset.number));
  });
  elementos.blankButton.addEventListener("click", escolherBranco);
  elementos.correctButton.addEventListener("click", corrigir);
  elementos.confirmButton.addEventListener("click", confirmar);
  elementos.soundButton.addEventListener("click", alternarSom);
  elementos.fullscreenButton.addEventListener("click", alternarTelaCheia);
  elementos.resultsButton.addEventListener("click", abrirResultados);
  elementos.resultsOffice.addEventListener("change", renderizarResultados);
  elementos.resetButton.addEventListener("click", zerarResultados);
  elementos.exportButton.addEventListener("click", exportarResultados);
  elementos.guideOffice.addEventListener("change", () => { estado.guiaLimite = LIMITE_GUIA; renderizarGuia(); });
  elementos.candidateSearch.addEventListener("input", () => { estado.guiaLimite = LIMITE_GUIA; renderizarGuia(); });
  elementos.guideMore.addEventListener("click", () => { estado.guiaLimite += LIMITE_GUIA; renderizarGuia(); });
  elementos.candidatePhoto.addEventListener("error", () => { elementos.candidatePhotoWrap.hidden = true; });
  document.addEventListener("keydown", tratarTecladoFisico);
  document.addEventListener("fullscreenchange", atualizarBotaoTelaCheia);

  renderizar();
  renderizarGuia();
  anunciar("Urna pronta. Digite 4 números para deputado federal.");
}

/** Acrescenta um dígito até o limite do cargo e inicia a conferência quando o número fica completo. */
function digitar(numero) {
  if (estado.fase !== "votacao") return;
  if (estado.branco) { estado.branco = false; estado.digitos = ""; }
  if (estado.digitos.length >= obterCargoAtual().digitos) return;
  cancelarConferencia();
  estado.digitos += numero;
  tocarTom(310 + Number(numero) * 12, .055, 0, .028);
  if (estado.digitos.length === obterCargoAtual().digitos) armarConferencia();
  renderizar();
}

/** Limpa o número e prepara a confirmação de voto em branco, sem registrar imediatamente. */
function escolherBranco() {
  if (estado.fase !== "votacao") return;
  cancelarConferencia();
  estado.digitos = "";
  estado.branco = true;
  tocarSequencia([[270, .06], [230, .07]]);
  armarConferencia();
  renderizar();
}

/** Descarta somente a escolha atual, preservando as etapas que já foram confirmadas. */
function corrigir() {
  if (estado.fase !== "votacao") return;
  cancelarConferencia();
  estado.digitos = "";
  estado.branco = false;
  tocarSequencia([[330, .055], [245, .075]]);
  renderizar();
  anunciar("Escolha apagada. Digite novamente.");
}

/** Libera CONFIRMA após uma pausa curta para que o aluno confira a escolha. */
function armarConferencia() {
  estado.liberado = false;
  clearTimeout(estado.temporizadorConferencia);
  estado.temporizadorConferencia = setTimeout(() => {
    estado.liberado = true;
    renderizar();
    anunciar("Confira sua escolha. Pressione CONFIRMA ou CORRIGE.");
  }, TEMPO_CONFERENCIA);
}

/** Cancela a pausa anterior e bloqueia a confirmação enquanto a escolha muda. */
function cancelarConferencia() {
  clearTimeout(estado.temporizadorConferencia);
  estado.temporizadorConferencia = null;
  estado.liberado = false;
}

/** Guarda a escolha e avança; somente a sexta confirmação registra a sessão na apuração. */
function confirmar() {
  if (estado.fase !== "votacao" || !estado.liberado) return;
  cancelarConferencia();
  estado.escolhas.push(classificarEscolha());
  estado.digitos = "";
  estado.branco = false;
  if (estado.etapa === etapas.length - 1) {
    registrarSessao();
    estado.fase = "fim";
    tocarSequencia([[740, .09], [880, .09], [740, .09], [880, .09], [1040, .24]]);
    renderizar();
    anunciar("Fim. Simulação concluída.");
    estado.temporizadorFim = setTimeout(iniciarNovaSessao, DURACAO_FIM);
    return;
  }
  estado.etapa += 1;
  elementos.guideOffice.value = obterIdAtual();
  elementos.candidateSearch.value = "";
  estado.guiaLimite = LIMITE_GUIA;
  renderizar();
  renderizarGuia();
  anunciar(`Próxima escolha: ${etapas[estado.etapa].titulo}. Digite ${obterCargoAtual().digitos} números.`);
}

/** Soma as seis escolhas aos totais locais e conta uma simulação concluída. */
function registrarSessao() {
  const apuracao = lerApuracao();
  estado.escolhas.forEach((escolha) => {
    const chave = escolha.tipo === "candidato" ? escolha.numero : escolha.tipo;
    apuracao.cargos[escolha.cargo][chave] += 1;
  });
  apuracao.sessoes += 1;
  salvarApuracao(apuracao);
}

/** Reinicia a interface para o próximo aluno e mantém os totais já registrados. */
function iniciarNovaSessao() {
  clearTimeout(estado.temporizadorFim);
  estado.etapa = 0;
  estado.digitos = "";
  estado.branco = false;
  estado.liberado = false;
  estado.fase = "votacao";
  estado.escolhas = [];
  elementos.guideOffice.value = "federal";
  elementos.candidateSearch.value = "";
  estado.guiaLimite = LIMITE_GUIA;
  renderizar();
  renderizarGuia();
  anunciar("Nova simulação iniciada. Digite 4 números para deputado federal.");
}

/** Projeta o estado na tela: dígitos, foto ou avatar, branco, nulo e mensagens de conferência. */
function renderizar() {
  const emVotacao = estado.fase === "votacao";
  elementos.ballotState.hidden = !emVotacao;
  elementos.finishState.hidden = emVotacao;
  elementos.blankButton.disabled = !emVotacao;
  elementos.correctButton.disabled = !emVotacao;
  elementos.confirmButton.disabled = !emVotacao || !estado.liberado;
  document.querySelectorAll("[data-number]").forEach((tecla) => { tecla.disabled = !emVotacao; });
  if (!emVotacao) return;

  const cargo = obterCargoAtual();
  const completa = estado.branco || estado.digitos.length === cargo.digitos;
  const escolha = completa ? classificarEscolha() : null;
  elementos.stageProgress.textContent = `ETAPA ${estado.etapa + 1} DE ${etapas.length} · SEU VOTO PARA`;
  elementos.officeName.textContent = etapas[estado.etapa].titulo;
  elementos.digitBoxes.replaceChildren(...Array.from({ length: cargo.digitos }, (_, i) => {
    const caixa = document.createElement("span");
    caixa.className = "digit-box" + (!estado.branco && i === estado.digitos.length ? " is-current" : "");
    caixa.textContent = estado.digitos[i] || "";
    return caixa;
  }));

  const candidato = escolha?.candidato || null;
  elementos.candidateData.hidden = !candidato;
  elementos.candidatePhotoWrap.hidden = !candidato;
  elementos.nullVote.hidden = escolha?.tipo !== "nulo";
  elementos.blankVote.hidden = escolha?.tipo !== "branco";
  if (candidato) {
    elementos.candidateName.textContent = candidato.nome.toUpperCase();
    elementos.candidateProject.textContent = [candidato.partido, candidato.coligacao, candidato.situacao, candidato.status].filter(Boolean).join(" · ").toUpperCase();
    const usaAvatarGenerico = !candidato.foto;
    elementos.candidatePhoto.src = candidato.foto || "assets/avatar-generico.svg";
    elementos.candidatePhoto.alt = usaAvatarGenerico
      ? `Avatar genérico de ${candidato.nome}; fotografia ainda não consolidada.`
      : `Fotografia de ${candidato.nome}`;
  } else {
    elementos.candidatePhoto.removeAttribute("src");
    elementos.candidatePhoto.alt = "";
  }
  if (escolha?.tipo === "nulo") elementos.nullReason.textContent = escolha.motivo;
  elementos.reviewMessage.textContent = completa ? "CONFIRA SEU VOTO" : "Digite o número da candidatura";
  elementos.keyHint.textContent = !completa
    ? "CORRIGE para apagar • BRANCO para voto em branco"
    : estado.liberado ? "CONFIRMA para registrar • CORRIGE para apagar" : "Aguarde um instante…";
}

/** Normaliza o texto para que a busca aceite nomes com ou sem acentos. */
function semAcentos(texto) {
  return String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
/** Protege os textos inseridos em HTML, tratando caracteres especiais como conteúdo. */
function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[caractere]);
}

/** Filtra os candidatos e exibe um lote por vez para manter leve a lista de consulta. */
function renderizarGuia() {
  const id = elementos.guideOffice.value;
  const cargo = cargos[id];
  const busca = semAcentos(elementos.candidateSearch.value.trim());
  const encontrados = cargo.candidates.filter((candidato) =>
    semAcentos(`${candidato.nome} ${candidato.numero} ${candidato.partido} ${candidato.coligacao || ""}`).includes(busca));
  const exibidos = encontrados.slice(0, estado.guiaLimite);
  elementos.guideCount.textContent = `${encontrados.length.toLocaleString("pt-BR")} candidaturas · exibindo ${exibidos.length.toLocaleString("pt-BR")}`;
  elementos.candidateGuide.innerHTML = exibidos.map((candidato) => `
    <article class="guide-card${podeVotar(candidato) ? "" : " is-ineligible"}">
      <span class="guide-number">${escapar(candidato.numero)}</span>
      <span class="guide-copy"><strong>${escapar(candidato.nome)}</strong><small>${escapar(candidato.partido)}${candidato.coligacao ? ` · ${escapar(candidato.coligacao)}` : ""} · ${escapar(candidato.situacao || candidato.status)}</small></span>
    </article>`).join("");
  elementos.guideMore.hidden = exibidos.length >= encontrados.length;
  elementos.guideSource.replaceChildren();
  if (id === "presidente") {
    elementos.guideSource.textContent = cargo.source + ". Situações sujeitas a alterações.";
  } else {
    const ancora = document.createElement("a");
    ancora.href = cargo.sourceUrl || cargo.source;
    ancora.target = "_blank";
    ancora.rel = "noopener noreferrer";
    ancora.textContent = "Lista oficial do TSE";
    elementos.guideSource.append(ancora,
      ` · dados consultados em ${new Date(`${cargo.extractedAt}T12:00:00`).toLocaleDateString("pt-BR")}. Situações sujeitas a alterações.`);
  }
}

/** Atualiza a apuração e abre o painel do professor em uma janela de diálogo. */
function abrirResultados() {
  renderizarResultados();
  if (typeof elementos.resultsDialog.showModal === "function") elementos.resultsDialog.showModal();
  else elementos.resultsDialog.setAttribute("open", "");
}

/** Ordena os votos por cargo e mostra as sete esferas apenas para um líder isolado com votos. */
function renderizarResultados() {
  const apuracao = lerApuracao();
  const id = elementos.resultsOffice.value;
  const votos = apuracao.cargos[id];
  elementos.totalVotes.textContent = apuracao.sessoes.toLocaleString("pt-BR");
  elementos.validVotes.textContent = Object.entries(apuracao.cargos).reduce((total, [cargo, linhas]) =>
    total + [...candidatosPorNumero[cargo].keys()].reduce((soma, numero) => soma + linhas[numero], 0), 0).toLocaleString("pt-BR");
  const linhas = [...candidatosPorNumero[id].values()]
    .filter((candidato) => votos[candidato.numero] > 0)
    .map((candidato) => ({ numero: candidato.numero, nome: candidato.nome, votos: votos[candidato.numero] }))
    .sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, "pt-BR"));
  const lider = linhas.length > 1 && linhas[0].votos === linhas[1].votos ? null : linhas[0] || null;
  elementos.dragonReward.hidden = !lider;
  elementos.dragonWinner.textContent = lider ? lider.nome : "";
  linhas.push({ numero: "—", nome: "Votos em branco", votos: votos.branco },
              { numero: "—", nome: "Votos nulos", votos: votos.nulo });
  const maior = Math.max(...linhas.map((linha) => linha.votos), 1);
  elementos.resultsList.innerHTML = linhas.map((linha) => `
    <div class="result-row">
      <span class="result-number">${escapar(linha.numero)}</span>
      <span class="result-name">${escapar(linha.nome)}</span>
      <span class="result-track" aria-hidden="true"><i style="width:${linha.votos / maior * 100}%"></i></span>
      <strong>${linha.votos}</strong>
    </div>`).join("");
}

/** Pede confirmação antes de apagar os totais salvos neste navegador. */
function zerarResultados() {
  if (!window.confirm("Zerar todos os votos desta atividade neste navegador?")) return;
  localStorage.removeItem(CHAVE);
  renderizarResultados();
  mostrarToast("Apuração local zerada.");
}

/** Cria um CSV dos totais locais, com separador de ponto e vírgula e texto entre aspas. */
function exportarResultados() {
  const apuracao = lerApuracao();
  const linhas = [["cargo", "numero", "candidato ou opcao", "partido", "situacao", "votos"]];
  for (const [id, cargo] of Object.entries(cargos)) {
    for (const candidato of candidatosPorNumero[id].values()) {
      linhas.push([cargo.nome, candidato.numero, candidato.nome, candidato.partido, candidato.situacao || candidato.status,
        apuracao.cargos[id][candidato.numero]]);
    }
    linhas.push([cargo.nome, "", "Votos em branco", "", "", apuracao.cargos[id].branco]);
    linhas.push([cargo.nome, "", "Votos nulos", "", "", apuracao.cargos[id].nulo]);
  }
  const csv = "\uFEFF" + linhas.map((linha) => linha.map((valor) =>
    `"${String(valor).replaceAll('"', '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "resultado-urna-escola-sp-2026.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Traduz teclas do computador em ações da urna, respeitando campos de texto e diálogos. */
function tratarTecladoFisico(evento) {
  if (elementos.resultsDialog.open || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if (/^\d$/.test(evento.key)) digitar(evento.key);
  else if (evento.key === "Enter") confirmar();
  else if (["Escape", "Backspace", "Delete"].includes(evento.key)) corrigir();
  else if (evento.key.toLowerCase() === "b") escolherBranco();
  else return;
  evento.preventDefault();
}

/** Alterna os sinais sonoros e atualiza o rótulo acessível do botão. */
function alternarSom() {
  estado.somLigado = !estado.somLigado;
  elementos.soundButton.setAttribute("aria-pressed", String(estado.somLigado));
  elementos.soundButton.querySelector(".utility-label").textContent = estado.somLigado ? "Som ligado" : "Som desligado";
  mostrarToast(estado.somLigado ? "Som ativado." : "Som desativado.");
}
/** Solicita ou encerra a tela cheia; trata a recusa do navegador sem interromper a atividade. */
async function alternarTelaCheia() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (_) { mostrarToast("Tela cheia indisponível neste navegador."); }
}
/** Mantém o texto do botão coerente com o modo de exibição do navegador. */
function atualizarBotaoTelaCheia() {
  elementos.fullscreenButton.querySelector(".utility-label").textContent = document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia";
}
/** Gera um sinal curto com Web Audio; frequência, duração e volume definem o som. */
function tocarTom(frequencia, duracao, atraso = 0, volume = .045) {
  if (!estado.somLigado) return;
  try {
    if (!contextoDeAudio) contextoDeAudio = new (window.AudioContext || window.webkitAudioContext)();
    if (contextoDeAudio.state === "suspended") contextoDeAudio.resume();
    const inicio = contextoDeAudio.currentTime + atraso;
    const oscilador = contextoDeAudio.createOscillator();
    const ganho = contextoDeAudio.createGain();
    oscilador.type = "square";
    oscilador.frequency.setValueAtTime(frequencia, inicio);
    ganho.gain.setValueAtTime(.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(volume, inicio + .006);
    ganho.gain.exponentialRampToValueAtTime(.0001, inicio + duracao);
    oscilador.connect(ganho).connect(contextoDeAudio.destination);
    oscilador.start(inicio);
    oscilador.stop(inicio + duracao + .02);
  } catch (_) { /* O voto continua funcional sem áudio. */ }
}
/** Agenda vários tons sucessivos para indicar ações como confirmação e encerramento. */
function tocarSequencia(notas) {
  let atraso = 0;
  notas.forEach(([frequencia, duracao]) => { tocarTom(frequencia, duracao, atraso); atraso += duracao + .025; });
}
/** Envia uma mensagem curta à região acessível destinada a leitores de tela. */
function anunciar(mensagem) {
  elementos.announcer.textContent = "";
  setTimeout(() => { elementos.announcer.textContent = mensagem; }, 20);
}
/** Exibe um aviso temporário, substituindo o temporizador do aviso anterior. */
function mostrarToast(mensagem) {
  elementos.toast.textContent = mensagem;
  elementos.toast.classList.add("is-visible");
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => elementos.toast.classList.remove("is-visible"), 2300);
}

document.addEventListener("DOMContentLoaded", iniciar);
