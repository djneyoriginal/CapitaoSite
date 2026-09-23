# Urna Escola · São Paulo · Eleições 2026

Abra `index.html` em um navegador ou publique todo o conteúdo desta pasta na rota `/urna/` de um servidor web. A simulação funciona sem conexão depois de instalada; os dados e as fotografias já vinculadas estão no pacote.

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

As fotos dos presidenciáveis vieram dos perfis do g1 fornecidos pelo solicitante. Para os cargos de São Paulo, 2.452 linhas da lista foram associadas a 2.451 fotografias distintas do [pacote oficial de fotos do TSE](https://dadosabertos.tse.jus.br/dataset/candidatos-2026/resource/a2e40197-4d32-4282-87a5-59023a7ea3cd). Duas linhas de Senado se referem à mesma candidatura. O identificador `SQ_CANDIDATO` foi localizado em um [espelho datado do cadastro do TSE](https://github.com/leofn/tse-candidatos-2026), com coincidência exata de cargo, número e nome; só foi aceito quando a foto com esse ID existia no pacote oficial. Esse espelho não atualiza a situação eleitoral exibida, que permanece a consulta oficial de 22/09/2026. As 133 linhas sem vínculo confirmado usam o mesmo avatar vetorial genérico. Nenhum retrato artificial foi criado.

Cada linha vira uma instância da classe do seu cargo e recebe `id` único. O campo `idTse`, quando confirmado, determina o nome do arquivo da foto; o número de urna sozinho nunca identifica a foto. O guia de candidaturas carrega imagens sob demanda para evitar tráfego desnecessário.

## Apuração local

Uma simulação é registrada somente depois da sexta confirmação. O painel do professor separa os votos por cargo e exporta CSV. Os totais ficam apenas no armazenamento do navegador usado; a lista pública do site não recebe votos. O botão “Zerar atividade” apaga essa apuração local. O líder isolado da apuração local recebe uma recompensa visual com sete Esferas do Dragão; em empate ou sem votos, a recompensa fica oculta. A nova sequência inicia uma apuração separada; os totais antigos continuam na chave anterior do navegador, sem serem misturados às sessões de seis escolhas.

Este projeto é educativo e independente. Ele não representa a Justiça Eleitoral e não serve para votação oficial.
