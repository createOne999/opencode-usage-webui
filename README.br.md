# Painel de Uso do OpenCode

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

Um painel web local e leve para o **OpenCode V2** que ajuda você a explorar o uso de tokens, os custos dos modelos, o desempenho das ferramentas e o contexto das sessões por solicitação diretamente no navegador.

Execute **`/usage-dashboard`** no OpenCode Mini ou na TUI completa sempre que quiser abrir o painel. Ele é executado dentro do processo do plugin do OpenCode, sem exigir banco de dados adicional nem daemon em segundo plano.

## O que você pode explorar

- **Visão geral (`/stats`):** Total de tokens, custo registrado em USD, sessões, Steps de modelo, atividade diária, detalhamento de tokens e tendências diárias de tokens sob demanda.
- **Modelos (`/models`):** Gráficos e tabelas de tokens e custos por provedor, modelo e variante — com ordenação por tokens, custo, Steps ou nome do modelo.
- **Ferramentas (`/tools`):** Volume de chamadas, contagens de sucesso/falha/incompletas e tempo mediano de execução (`P50`) por ferramenta.
- **Sessões e contexto das solicitações (`/sessions`):** Busque sessões por título, navegue entre sessões principais e filhas, inspecione linhas do tempo de tokens e custos por solicitação e veja o histórico salvo que antecede qualquer Step selecionado.

## Início rápido

Adicione o plugin ao seu `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/oud#release"]
}
```

Em seguida, execute **`/usage-dashboard`** no OpenCode para abrir o painel no navegador padrão ou acesse <http://127.0.0.1:7331/stats> diretamente (`http://localhost:7331/stats` e `http://[::1]:7331/stats` também funcionam).

### Personalizar a porta

A porta padrão é `7331`. Se você executar vários projetos simultaneamente ou quiser usar outra porta, defina `options.port` (use `0` para escolher automaticamente qualquer porta disponível):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/oud#release", "options": { "port": 7332 } }
  ]
}
```

## Usar o painel

- **Filtros de data e projeto:** Por padrão, são usados o mês atual e o projeto atual no fuso horário do navegador (incluindo a data final). Você pode alternar para **Todos os projetos** ou para qualquer projeto específico a qualquer momento.
- **Interface em vários idiomas:** Troque o idioma no seletor superior. O idioma selecionado (`?lang=...`), o intervalo de datas, o filtro de projeto e o link da solicitação ativa permanecem na URL, facilitando salvar nos favoritos ou atualizar qualquer visualização.
- **Detalhamento diário de tokens:** Na página Visão geral, clique em **Carregar tokens diários** para ver gráficos diários de tokens de entrada, saída, raciocínio e leitura/gravação do cache para o período selecionado.
- **Inspecionar o contexto das solicitações:**
  1. Abra **Sessões / solicitações** e selecione uma sessão (use o indicador ou a seção **Sessões filhas** para alternar entre sessões de subagentes relacionadas).
  2. Clique em um ponto do gráfico de solicitações ou em um horário na tabela de solicitações.
  3. Consulte o **Histórico salvo antes da solicitação** (incluindo prompts do usuário, respostas anteriores, chamadas de ferramentas, habilidades e resumos de compactação) junto à **Resposta à solicitação selecionada**.
  4. Use **Carregar mais 100 itens do histórico** quando quiser inspecionar mensagens anteriores em uma sessão longa.

### Observações úteis sobre as métricas

- **Contagem de tokens:** Exibida em unidades compactas `K`, `M`, `B` e `T` (com até duas casas decimais), enquanto a ordenação e os totais usam números exatos. O total de tokens equivale a `input + output + reasoning + cache.read + cache.write`.
- **Estimativas de custo:** Os custos são exibidos em USD com base no uso informado pelo provedor e nas tarifas do catálogo de modelos, como referência prática.
- **Visualização do contexto salvo:** O inspetor de solicitações reconstrói o contexto a partir do histórico de sessão salvo e dos limites de compactação concluídos até o Step selecionado.

## Local e privado por projeto

- **Somente loopback:** Vincula estritamente aos endereços locais de loopback (`127.0.0.1` e `::1`) e valida cabeçalhos de mesma origem, mantendo os dados de uso acessíveis apenas na sua máquina.
- **Sem armazenamento extra nem telemetria:** Lê sob demanda do serviço compartilhado local do OpenCode V2 em execução. Todos os recursos da interface e traduções são empacotados localmente, sem CDNs externos, análises ou arquivos de dados adicionais. Para desinstalar, basta remover a entrada do plugin de `opencode.json`.

## Executar a partir do código-fonte

Desenvolvido para OpenCode **2.2.0** e Bun **1.4.2**. Na raiz do repositório:

```powershell
bun run setup
opencode mini
# Dentro do OpenCode: /usage-dashboard
```

Se você estiver trabalhando em um ambiente remoto, WSL ou sem interface gráfica, onde o navegador não possa abrir automaticamente, confira no terminal a URL ativa do painel e se ele está pronto:

```powershell
bun run status
```

### Verificações de desenvolvimento

```powershell
bun run build
bun run typecheck
bun run test
```

## Licença

Licenciado sob MIT. Consulte [LICENSE](LICENSE) para obter detalhes.
