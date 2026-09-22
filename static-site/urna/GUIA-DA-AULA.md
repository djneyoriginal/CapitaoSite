# Guia de leitura e demonstração da urna

## Como o código se organiza

Leia primeiro o HTML, depois os dados e por último o JavaScript. O projeto usa HTML, CSS e JavaScript do navegador, sem instalar dependências.

| Arquivo | O que estudar |
| --- | --- |
| index.html | Estrutura da tela, botões, rótulos acessíveis e painel do professor. |
| css/style.css | Cores, posicionamento, teclado, adaptação ao celular e recompensa das esferas. |
| js/config.js | Lista presidencial fornecida pelo solicitante; ainda não importada do TSE. |
| js/dados-sp.js | Exportação oficial de São Paulo, com fonte, data e registros por cargo. |
| js/dados-governador.js | Sete registros para governador conferidos no sistema oficial do TSE. |
| js/urna2026.js | Regras da sessão, eventos, validação, renderização e armazenamento local. |
| assets/avatar-generico.svg | Avatar vetorial compartilhado para candidatos sem fotografia. |

As funções da lógica principal têm comentários de finalidade. Os blocos de HTML e CSS explicam estrutura e apresentação. A lista de milhares de candidatos é um conjunto de dados com o mesmo esquema para cada registro.

## Campos e fontes

O número é uma string: não deve ser somado nem tratado como quantidade. O campo partido dos dados de São Paulo preserva a legenda da exportação, que pode conter partido, federação ou coligação. A situação de totalização não é o julgamento do registro: Concorrendo e Inapto não significam automaticamente Deferido e Indeferido.

A consulta oficial de São Paulo é de 22/09/2026: 1.131 registros federais, 1.431 estaduais, 16 de Senado e sete de governador. A página usa uma cópia datada; não consulta o TSE automaticamente. A lista presidencial tem outra procedência, identificada no próprio código.

## Roteiro de demonstração

1. Abra index.html ou a rota /urna/ do site. Use a busca da lista para escolher números cadastrados.
2. Digite o número de deputado federal e aguarde a liberação de CONFIRMA. Mostre que CORRIGE limpa somente a etapa atual.
3. Complete deputado estadual e as duas escolhas de Senado. Repita o mesmo senador na segunda vaga para demonstrar o voto nulo dessa vaga.
4. Confirme governador e presidente. A apuração só muda quando as seis escolhas terminam. O 13 identifica Fernando Haddad na etapa de governador e Lula na etapa de presidente.
5. Abra o painel do professor e troque o cargo exibido. Com um único líder, aparecem as sete Esferas do Dragão. Em empate ou sem votos, a recompensa fica oculta.
6. Exporte o CSV e compare os totais. Os resultados pertencem a este navegador, não a todos os visitantes do site.

## Exercícios de programação

- Localize estado e explique a diferença entre os dígitos atuais e as escolhas já confirmadas.
- Siga digitar, classificarEscolha, confirmar, registrarSessao e renderizar para entender o fluxo.
- Compare Array, Map e objetos: a lista permite busca textual; o Map permite busca direta por número.
- Estude escapar antes de inserir texto em HTML e a validação de inteiros ao recuperar localStorage.
- Altere uma cor ou o tempo de conferência em uma cópia e observe o resultado.
- Demonstre a diferença entre branco, número inexistente e candidatura inapta usando uma cópia de teste.

O simulador é educativo e não reproduz integralmente o sistema eleitoral. A recompensa mostra liderança local por votos; não calcula eleição proporcional, quocientes ou distribuição oficial de cadeiras. As sessões antigas de cinco escolhas permanecem no armazenamento do navegador, separadas da nova apuração.
