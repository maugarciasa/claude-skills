# Claude Skills — Setup Global

Guia completo para replicar todo o ambiente Claude Code em uma maquina nova.

## 1. Skills (npx skills)

```bash
npx skills add https://github.com/anthropics/skills --skill webapp-testing -g -y
npx skills add https://github.com/anthropics/skills --skill mcp-builder -g -y
npx skills add https://github.com/anthropics/skills --skill frontend-design -g -y
npx skills add https://github.com/supabase/agent-skills --skill supabase-postgres-best-practices -g -y
npx skills add https://github.com/coreyhaines31/marketingskills --skill copywriting -g -y
npx skills add https://github.com/firecrawl/cli --skill firecrawl -g -y
npx skills add https://github.com/inferen-sh/skills --skill nano-banana-2 -g -y
npx skills add https://github.com/shadcn/ui --skill shadcn -g -y
npx skills add obra/superpowers -g -y
```

Instala 22 skills no total (8 comandos acima + 14 do obra/superpowers). As do obra/superpowers incluem: brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills.

> Nota: mensagens "PromptScript does not support global install" sao esperadas e nao afetam o Claude Code.

## 2. Bun (necessario para claude-mem)

```powershell
winget install oven-sh.bun
```

Reiniciar o terminal apos instalar.

## 3. Plugin claude-mem (memoria entre sessoes)

> ⚠️ **Nao copiar o repo para `~/.claude/plugins/marketplaces/` na mao** (era o que este
> guia mandava ate 2026-07-23). O plugin fica no disco mas o Claude Code nao o registra:
> `claude plugin list` volta vazio, nenhum hook dispara e a memoria nunca grava nada.
> Usar o fluxo oficial abaixo.

```powershell
claude plugin marketplace add thedotmack/claude-mem
claude plugin install claude-mem@thedotmack
claude plugin list          # deve listar claude-mem@thedotmack como enabled
```

### Dependencia da busca semantica

```powershell
winget install astral-sh.uv
```

Sem `uv`/`uvx` o `chroma-mcp` nao sobe e so resta busca por palavra-chave. Na primeira
consulta o Chroma baixa o modelo de embeddings e estoura o timeout do MCP em loop —
pre-baixar uma vez resolve:

```powershell
uvx --python 3.13 --with "onnxruntime>=1.20" --with "protobuf<7" --from chroma-mcp==0.2.6 python -c "from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2; ONNXMiniLM_L6_V2()(['warmup'])"
```

### Configuracao obrigatoria

Em `~/.claude-mem/settings.json`, apontar `CLAUDE_CODE_PATH` para o executavel (secao 0)
— sem isso o agente de compressao nao inicia e a fila enche em silencio. Gravar **sem BOM**
(o PowerShell adiciona BOM por padrao e quebra o parse).

### Auto-start no login do Windows

⚠️ **Nunca apontar a tarefa para `~/.claude/plugins/marketplaces/thedotmack`** (era o que este
guia mandava ate 2026-07-23) **nem fixar o numero da versao**. Esses caminhos nao acompanham a
versao instalada: quando o plugin atualiza, o worker do login sobe a versao velha enquanto o
plugin resolve a nova. Isso dispara o *version-mismatch recycle* — o successor respawna a versao
stale, ela ganha a porta 37777 primeiro, a correta bate em `Port already in use` e o loop nunca
converge (ja medido em 2.424 reciclagens/dia com hooks falhando a cada prompt:
[#3378](https://github.com/thedotmack/claude-mem/issues/3378),
[#3216](https://github.com/thedotmack/claude-mem/issues/3216),
[#3205](https://github.com/thedotmack/claude-mem/issues/3205)).

Usar o script `tools/start-claude-mem-worker.ps1`, que resolve a versao mais recente do cache em
tempo de execucao e segue correto depois de qualquer atualizacao:

```powershell
$acao = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\dev\claude-skills\tools\start-claude-mem-worker.ps1"'
$trigger = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
Register-ScheduledTask -TaskName "claude-mem-worker" -Action $acao -Trigger $trigger -RunLevel Highest -Force
```

O hook de `SessionStart` do proprio plugin tambem sobe o worker, entao a tarefa agendada
e redundancia. Para reiniciar o worker: **matar tambem os processos `python.exe` do
`chroma-mcp`**, senao eles seguram a porta 37777 e o worker novo nao sobe.

### Trocar o modelo de compressao

`CLAUDE_MEM_MODEL` em `~/.claude-mem/settings.json` (com os tiers
`CLAUDE_MEM_TIER_FAST_MODEL`/`SIMPLE_MODEL`, que vencem para as tarefas rapidas). Haiku
gera observacoes de qualidade pior e foi quem produziu os `concepts` malformados da secao
anterior; Sonnet e mais caro mas roda em background, sem bloquear a sessao.

⚠️ **Reiniciar so o worker nao aplica a troca.** Os processos geradores carregam o modelo
no spawn e o worker os ressuscita segundos depois de subir. Matar todos os PIDs listados em
`~/.claude-mem/supervisor.json` (worker + `sdk:*` + `chroma-mcp`) antes de subir de novo:

```powershell
$s = Get-Content "$env:USERPROFILE\.claude-mem\supervisor.json" -Raw | ConvertFrom-Json
foreach ($p in $s.processes.PSObject.Properties) { Stop-Process -Id $p.Value.pid -Force -ErrorAction SilentlyContinue }
```

Conferir depois em qualquer observacao nova que `generated_by_model` mudou de fato.

### Manutencao: `tools/normalize-concepts.mjs`

A injecao de contexto so inclui observacoes cujo `concepts` casa **exatamente** com a lista
do modo. O agente de compressao as vezes grava `"gotcha: descricao longa"` em vez de
`"gotcha"` — a observacao existe, e pesquisavel, mas nunca e injetada, sem erro nem aviso.
Sintoma: o `Stats: N obs` do bloco injetado menor que a contagem real do projeto.

```powershell
node C:\dev\claude-skills\tools\normalize-concepts.mjs           # dry-run
node C:\dev\claude-skills\tools\normalize-concepts.mjs --apply   # corrige
```

Idempotente. Nao conserta observacoes com `concepts: []` — sem prefixo para extrair, nao ha
o que normalizar; essas ficam fora da injecao ate serem regravadas.

Para rodar sozinho a cada sessao, adicionar em `~/.claude/settings.json` (**ja ativo nesta
maquina**, verificado plantando um caso quebrado e abrindo sessao nova):

```json
"SessionStart": [
  {
    "matcher": "startup|clear|compact",
    "hooks": [
      { "type": "command", "command": "node \"C:/dev/claude-skills/tools/normalize-concepts.mjs\" --apply --quiet", "timeout": 30 }
    ]
  }
]
```

### Manutencao: `tools/check-read-coverage.mjs`

O `/learn-codebase` manda ler todo arquivo-fonte, mas o agente pode declarar "li tudo" e ter
parado no meio — no vault Jarvis leu 40 de 92, ignorou a camada `raw/` inteira e relatou
sucesso. Este script confere por fora, contando os `Read` do transcript:

```powershell
node C:\dev\claude-skills\tools\check-read-coverage.mjs C:\dev\jarvis          # ultima sessao
node C:\dev\claude-skills\tools\check-read-coverage.mjs C:\dev\jarvis --all    # soma todas
node C:\dev\claude-skills\tools\check-read-coverage.mjs . --list               # todos faltantes
```

Sai com codigo 1 se faltar arquivo. Rodar sempre depois de um `/learn-codebase` e alimentar a
lista de faltantes numa segunda passada. Com `--all` tambem serve para achar o que entrou no
repo depois da leitura inicial e nunca foi visto.

## 4. MCP Playwright (automacao de browser)

Baixar zip de https://github.com/microsoft/playwright-mcp/archive/refs/heads/main.zip e extrair para C:\dev\Skill\playwright-mcp-main

```powershell
cd C:\dev\Skill\playwright-mcp-main
npm install
claude mcp add playwright -s user -- node C:\dev\Skill\playwright-mcp-main\cli.js
```

> Nao testado nesta maquina (o binario `claude` nao estava no PATH do shell na hora). Se falhar, editar
> `~/.claude.json` manualmente, adicionando em `mcpServers`:
> ```json
> "playwright": { "type": "stdio", "command": "node", "args": ["C:\\dev\\Skill\\playwright-mcp-main\\cli.js"] }
> ```
> Reiniciar o app depois. Cuidado: o app reescreve `~/.claude.json` enquanto aberto, entao edite com o app fechado.

## 5. Jarvis — segundo cérebro (vault git/Markdown)

> O antigo servidor MCP (jarvis.nossatocaeventos.com/sse) foi desativado em julho/2026.
> O Jarvis agora é um vault git/Markdown (método LLM Wiki), consultado por ponteiro — sem token.

```powershell
gh repo clone maugarciasa/jarvis C:\dev\jarvis
```

Criar `~/.claude/CLAUDE.md` (global) com o ponteiro:

```markdown
# Jarvis — segundo cérebro (memória permanente)

Antes de tarefas que dependam de contexto pessoal, decisões passadas ou conhecimento
acumulado dos projetos, consulte o Jarvis: leia `C:\dev\jarvis\index.md` (catálogo) e
abra apenas as páginas relevantes em `C:\dev\jarvis\wiki\`. O schema e os workflows
(ingest/query/lint) estão em `C:\dev\jarvis\CLAUDE.md`.
```

## 6. Obsidian (leitura humana do Jarvis)

```powershell
winget install --id Obsidian.Obsidian --source winget --accept-package-agreements --silent
```

Depois abrir o Obsidian → *Open folder as vault* → `C:\dev\jarvis` (a config `.obsidian/` já vem versionada no repo).

## 7. Hook do português (UserPromptSubmit)

Adicionar em `~/.claude/settings.json` (mesclar com o conteúdo existente — reinjeta a regra de idioma a cada prompt):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"Regra de idioma: responda SEMPRE em portugues do Brasil. Apenas codigo, identificadores, comandos, caminhos e trechos literais citados permanecem no idioma original.\"}}'"
          }
        ]
      }
    ]
  }
}
```

## 8. Verificar instalacao

```bash
npx skills list -g
claude mcp list
bun --version
Get-Process bun
```
