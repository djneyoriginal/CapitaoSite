# Urna Escola · São Paulo · Eleições 2026

Abra `index.html` em um navegador ou publique todo o conteúdo desta pasta na rota `/urna/` de um servidor web. A simulação funciona sem conexão depois de instalada; os dados e as fotos presidenciais estão no pacote.

Para preparar uma aula de leitura do código, use o [guia didático](GUIA-DA-AULA.md). A função de cada parte da lógica está comentada em `js/urna2026.js`.

## Cargos e dados

A atividade tem seis escolhas: deputado federal (4 dígitos), deputado estadual (5), senador para a primeira vaga (3), senador para a segunda vaga (3), governador (2) e presidente (2). Há duas vagas no Senado em 2026; repetir o mesmo número na segunda escolha produz voto nulo nessa vaga.

| Cargo | Registros | Fonte | Dados consultados pela fonte |
| --- | ---: | --- | --- |
| Deputado federal, SP | 1.131 | [TSE · DivulgaCandContas](https://divulgacandcontas.tse.jus.br/divulga/#/candidato/SUDESTE/SP/20322002026) | 22/09/2026 |
| Deputado estadual, SP | 1.431 | [TSE · DivulgaCandContas](https://divulgacandcontas.tse.jus.br/divulga/#/candidato/SUDESTE/SP/20322002026) | 22/09/2026 |
| Senador, SP | 16 | [TSE · DivulgaCandContas](https://divulgacandcontas.tse.jus.br/divulga/#/candidato/SUDESTE/SP/20322002026) | 22/09/2026 |
| Governador, SP | 7 | [TSE · DivulgaCandContas](https://divulgacandcontas.tse.jus.br/divulga/#/candidato/SUDESTE/SP/20322002026) | 22/09/2026 |
| Presidente | 14 | Perfis do g1 indicados pelo solicitante | Informados em 22/09/2026 |

As listas de deputado e Senado preservam os registros exportados pelo TSE. A lista de governador foi transcrita dos sete registros mostrados pelo mesmo sistema em 22/09/2026. Em governador, o partido e a coligação são campos separados. Registros marcados como `Inapto` aparecem na consulta, mas não recebem votos no simulador. A situação de totalização (`Concorrendo` ou `Inapto`) não equivale ao julgamento do registro. São consultas datadas, sem atualização automática contínua. Consulte o [DivulgaCandContas do TSE](https://divulgacandcontas.tse.jus.br/) para a situação atual. Na lista presidencial fornecida pelo solicitante, registros com `Renúncia`, `Indeferido` ou impedimento explícito também não recebem votos.

As fotos dos presidenciáveis vieram dos perfis do g1 fornecidos pelo solicitante. Para economizar espaço, os cargos de São Paulo usam um único avatar vetorial genérico enquanto as fotografias oficiais não são consolidadas. O [TSE disponibiliza o arquivo oficial de fotos de São Paulo](https://dadosabertos.tse.jus.br/dataset/candidatos-2026); nenhum retrato artificial foi criado.

## Apuração local

Uma simulação é registrada somente depois da sexta confirmação. O painel do professor separa os votos por cargo e exporta CSV. Os totais ficam apenas no armazenamento do navegador usado; a lista pública do site não recebe votos. O botão “Zerar atividade” apaga essa apuração local. O líder isolado da apuração local recebe uma recompensa visual com sete Esferas do Dragão; em empate ou sem votos, a recompensa fica oculta. A nova sequência inicia uma apuração separada; os totais antigos continuam na chave anterior do navegador, sem serem misturados às sessões de seis escolhas.

Este projeto é educativo e independente. Ele não representa a Justiça Eleitoral e não serve para votação oficial.
