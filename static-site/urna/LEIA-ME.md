# Urna Escola · São Paulo · Eleições 2026

Abra `index.html` em um navegador ou publique todo o conteúdo desta pasta na rota `/urna/` de um servidor web. A simulação funciona sem conexão depois de instalada; os dados e as fotos presidenciais estão no pacote.

## Cargos e dados

A atividade tem cinco escolhas: deputado federal (4 dígitos), deputado estadual (5), senador para a primeira vaga (3), senador para a segunda vaga (3) e presidente (2). Há duas vagas no Senado em 2026; repetir o mesmo número na segunda escolha produz voto nulo nessa vaga. O cargo de governador não está cadastrado nesta versão.

| Cargo | Registros | Fonte | Dados consultados pela fonte |
| --- | ---: | --- | --- |
| Deputado federal, SP | 1.131 | [UOL](https://noticias.uol.com.br/eleicoes/2026/09/21/veja-lista-dos-candidatos-a-deputado-federal-por-sao-paulo-em-2026.ghtm) | 21/09/2026, 05h30 |
| Deputado estadual, SP | 1.430 | [UOL](https://noticias.uol.com.br/eleicoes/2026/09/18/candidatos-deputado-estadual-sao-paulo-sp-2026.ghtm) | 17/09/2026, 05h30 |
| Senador, SP | 15 | [UOL](https://noticias.uol.com.br/eleicoes/2026/09/21/veja-lista-dos-candidatos-ao-senado-por-sao-paulo-em-2026.ghtm) | 21/09/2026, 05h30 |
| Presidente | 14 | Perfis do g1 indicados pelo solicitante | Informados em 22/09/2026 |

As listas mostram também candidaturas com renúncia ou indeferimento. Para simular a escolha pelo número, o programa ignora apenas os registros com situação exata `Renúncia` ou `Indeferido`; situações pendentes e em recurso aparecem conforme a fonte. Os números repetidos após renúncia são resolvidos para a candidatura que permaneceu na disputa. Essas regras são simplificações do simulador e não substituem a consulta ao [DivulgaCandContas do TSE](https://divulgacandcontas.tse.jus.br/) para a situação atual.

As fotos dos presidenciáveis vieram dos perfis do g1 fornecidos pelo solicitante. Para economizar espaço, os cargos de São Paulo usam um único avatar vetorial genérico enquanto as fotografias oficiais não são consolidadas. O [TSE disponibiliza o arquivo oficial de fotos de São Paulo](https://dadosabertos.tse.jus.br/dataset/candidatos-2026); nenhum retrato artificial foi criado.

## Apuração local

Uma simulação é registrada somente depois da quinta confirmação. O painel do professor separa os votos por cargo e exporta CSV. Os totais ficam apenas no armazenamento do navegador usado; a lista pública do site não recebe votos. O botão “Zerar atividade” apaga essa apuração local.

Este projeto é educativo e independente. Ele não representa a Justiça Eleitoral e não serve para votação oficial.
