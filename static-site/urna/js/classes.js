"use strict";

/*
 * Modelo didático: cada linha da consulta vira um objeto de uma classe de cargo.
 * O número da urna NÃO é um identificador único: ele pode se repetir em cargos
 * diferentes e também em registros históricos da mesma candidatura.
 */
class Candidatura {
  constructor(cargo, registro, indice) {
    Object.assign(this, registro);
    this.cargo = cargo;

    // Só usamos o ID do TSE se nome, número, cargo e arquivo da foto coincidiram.
    const chave = `${registro.numero}|${registro.nome}`;
    this.idTse = window.URNA_IDS_FOTOS?.[cargo]?.[chave] || null;

    // O índice distingue até duas linhas da mesma pessoa em uma exportação.
    this.id = `${cargo}:${this.idTse || "sem-id-tse"}:${indice}`;
    this.foto = this.idTse
      ? `assets/fotos-sp/${this.idTse}.jpg`
      : registro.foto || null;
    Object.freeze(this);
  }

  // Uma única imagem vetorial leve atende registros cuja foto não foi vinculada.
  get avatar() {
    return this.foto || "assets/avatar-generico.svg";
  }
}

class DeputadoFederal extends Candidatura {
  constructor(registro, indice) { super("federal", registro, indice); }
}
class DeputadoEstadual extends Candidatura {
  constructor(registro, indice) { super("estadual", registro, indice); }
}
class Senador extends Candidatura {
  constructor(registro, indice) { super("senador", registro, indice); }
}
class Governador extends Candidatura {
  constructor(registro, indice) { super("governador", registro, indice); }
}
class Presidente extends Candidatura {
  constructor(registro, indice) { super("presidente", registro, indice); }
}

// A urna consulta esta tabela para construir a classe adequada em cada etapa.
window.URNA_CLASSES = Object.freeze({
  federal: DeputadoFederal,
  estadual: DeputadoEstadual,
  senador: Senador,
  governador: Governador,
  presidente: Presidente
});
