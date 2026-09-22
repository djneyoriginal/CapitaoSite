"use strict";

/*
 * Relação de governador de SP exibida pelo DivulgaCandContas/TSE em 22/09/2026.
 * Cada registro mantém o nome de urna, o número e a situação de totalização.
 * partido identifica a sigla; coligacao só aparece quando diferente da sigla.
 * Candidaturas inaptas ficam visíveis na consulta, mas não recebem voto.
 */
window.URNA_DADOS_GOVERNADOR = Object.freeze({
  source: "DivulgaCandContas · TSE",
  sourceUrl: "https://divulgacandcontas.tse.jus.br/divulga/#/candidato/SUDESTE/SP/20322002026",
  extractedAt: "2026-09-22",
  rawCount: 7,
  candidates: Object.freeze([
    Object.freeze({ nome: "CARLOS MACHADO", numero: "21", partido: "PCB", situacao: "Concorrendo", status: "" }),
    Object.freeze({ nome: "FERNANDO HADDAD", numero: "13", partido: "PT", coligacao: "DESPERTA SÃO PAULO", situacao: "Concorrendo", status: "" }),
    Object.freeze({ nome: "IZADORA DIAS", numero: "29", partido: "PCO", situacao: "Concorrendo", status: "" }),
    Object.freeze({ nome: "POLICIAL EDJANE", numero: "36", partido: "AGIR", situacao: "Inapto", status: "" }),
    Object.freeze({ nome: "TARCÍSIO", numero: "10", partido: "REPUBLICANOS", coligacao: "CORAGEM PARA SEGUIR AVANÇANDO", situacao: "Concorrendo", status: "" }),
    Object.freeze({ nome: "VERA LÚCIA", numero: "16", partido: "PSTU", situacao: "Concorrendo", status: "" }),
    Object.freeze({ nome: "VIVIAN MENDES", numero: "80", partido: "UP", situacao: "Concorrendo", status: "" })
  ])
});
