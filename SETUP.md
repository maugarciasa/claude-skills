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

## 2. CLI nativo do Claude Code

```powershell
irm https://claude.ai/install.ps1 | iex
```

Instala em `~\.local\bin\claude.exe`. O instalador **nao** ajusta o PATH: adicionar
`C:\Users\<usuario>\.local\bin` ao PATH de usuario a mao. Shells ja abertos ficam com o
PATH antigo — abrir sessao nova.

## 3. MCP Playwright (automacao de browser)

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

## 4. Hook do português (UserPromptSubmit)

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

## 5. Verificar instalacao

```bash
npx skills list -g
claude mcp list
claude plugin list
```
