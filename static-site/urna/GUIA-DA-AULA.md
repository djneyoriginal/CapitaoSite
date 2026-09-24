# Guia técnico da urna

## Como o código se organiza

Leia primeiro o HTML, depois os dados e por último o JavaScript. O projeto usa HTML, CSS e JavaScript do navegador, sem instalar dependências.

| Arquivo | O que estudar |
| --- | --- |
| index.html | Estrutura da tela, botões, rótulos acessíveis e painel do professor. |
| css/style.css | Cores, posicionamento, teclado e adaptação ao celular. |
| js/config.js | Lista presidencial fornecida pelo solicitante; ainda não importada do TSE. |
| js/dados-sp.js | Exportação oficial de São Paulo, com fonte, data e registros por cargo. |
| js/dados-governador.js | Sete registros para governador conferidos no sistema oficial do TSE. |
| js/ids-fotos.js | Mapa dos IDs do TSE confirmados por cargo, nome e número para localizar a foto. |
| js/classes.js | Classe-base `Candidatura` e classes dos cinco cargos; IDs únicos e avatar de cada instância. |
| js/urna2026.js | Regras da sessão, eventos, validação, renderização e armazenamento local. |
| assets/avatar-generico.svg | Avatar vetorial compartilhado para candidatos sem fotografia. |
| assets/fotos-sp/ | Fotografias baixadas do pacote oficial do TSE e nomeadas pelo `SQ_CANDIDATO`. |

As funções da lógica principal têm comentários de finalidade. Os blocos de HTML e CSS explicam estrutura e apresentação. A lista de milhares de candidatos é um conjunto de dados com o mesmo esquema para cada registro.

## Campos e fontes

O número é uma string: não deve ser somado nem tratado como quantidade. O campo partido dos dados de São Paulo preserva o nome da legenda, que pode conter partido, federação ou coligação. A interface resume federações pelas siglas integrantes e encurta as duas coligações cadastradas; a busca e os dados mantêm os nomes completos. A urna filtra os registros inaptos antes de montar a votação e a consulta. Os cartões e a tela de voto mostram número, nome e legenda, sem rótulos de aptidão.

Uma classe representa o tipo de candidatura, não um partido. `DeputadoFederal`, `DeputadoEstadual`, `Senador`, `Governador` e `Presidente` herdam de `Candidatura`. O `id` identifica exclusivamente cada linha da urna; `idTse` é o identificador do cadastro eleitoral usado no arquivo da fotografia. Duas linhas históricas podem compartilhar `idTse`, mas não `id`. Se não houver vínculo fotográfico seguro, a propriedade `avatar` devolve o SVG genérico. As fotos presidenciais ainda são as dos perfis do g1, não do pacote do TSE.

A consulta oficial de São Paulo é de 22/09/2026: 1.131 registros federais, 1.431 estaduais, 16 de Senado e sete de governador. A página usa uma cópia datada; não consulta o TSE automaticamente. A lista presidencial tem outra procedência, identificada no próprio código.

## Roteiro de demonstração

1. Abra index.html ou a rota /urna/ do site. Use a busca da lista para escolher números cadastrados.
2. Digite o número de deputado federal e aguarde a liberação de CONFIRMA. Mostre que CORRIGE limpa somente a etapa atual.
3. Complete deputado estadual e as duas escolhas de Senado. Repita o mesmo senador na segunda vaga para demonstrar o voto nulo dessa vaga.
4. Confirme governador e presidente. A apuração só muda quando as seis escolhas terminam. O 13 identifica Fernando Haddad na etapa de governador e Lula na etapa de presidente.
5. Abra o painel do professor e troque o cargo exibido para conferir os votos por candidatura, brancos e nulos.
6. Exporte o PDF paginado ou o CSV e compare os totais. Ambos incluem candidaturas votadas, brancos e nulos, com legenda resumida. Os resultados são mantidos em `localStorage` e não são somados entre navegadores ou dispositivos.

## Exercícios de programação

- Localize estado e explique a diferença entre os dígitos atuais e as escolhas já confirmadas.
- Siga digitar, classificarEscolha, confirmar, registrarSessao e renderizar para entender o fluxo.
- Compare Array, Map e objetos: a lista permite busca textual; o Map permite busca direta por número.
- Compare classe, herança e instância: encontre `new ClasseDoCargo` e observe `id`, `idTse`, `foto` e `avatar`. Digite 13 nas etapas de governador e presidente para ver que o mesmo número não identifica a mesma pessoa.
- Estude escapar antes de inserir texto em HTML e a validação de inteiros ao recuperar localStorage.
- Altere uma cor ou o tempo de conferência em uma cópia e observe o resultado.
- Demonstre a diferença entre branco, número inexistente e candidatura inapta usando uma cópia de teste.

Este projeto é independente e não integra a Justiça Eleitoral. O painel mostra apenas os votos registrados; não calcula eleição proporcional, quocientes ou distribuição oficial de cadeiras. As sessões antigas de cinco escolhas permanecem em uma chave separada de `localStorage`.
