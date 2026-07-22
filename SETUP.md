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

Instala 20 skills no total. As do obra/superpowers incluem: brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills.

> Nota: mensagens "PromptScript does not support global install" sao esperadas e nao afetam o Claude Code.

## 2. Bun (necessario para claude-mem)

```powershell
winget install oven-sh.bun
```

Reiniciar o terminal apos instalar.

## 3. Plugin claude-mem (compressao de contexto)

Baixar zip de https://github.com/thedotmack/claude-mem/archive/refs/heads/main.zip e extrair para C:\dev\Skill\claude-mem-main

```powershell
robocopy "C:\dev\Skill\claude-mem-main\plugin" "C:\Users\%USERNAME%\.claude\plugins\marketplaces\thedotmack" /E
cd "C:\Users\%USERNAME%\.claude\plugins\marketplaces\thedotmack"
npm install --ignore-scripts
```

### Iniciar worker manualmente (primeira vez)

```powershell
cd "C:\Users\%USERNAME%\.claude\plugins\marketplaces\thedotmack"
bun scripts/worker-service.cjs start
```

### Auto-start no login do Windows

```powershell
$action = New-ScheduledTaskAction -Execute "bun" -Argument "scripts/worker-service.cjs start" -WorkingDirectory "C:\Users\$env:USERNAME\.claude\plugins\marketplaces\thedotmack"
$trigger = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
Register-ScheduledTask -TaskName "claude-mem-worker" -Action $action -Trigger $trigger -RunLevel Highest -Force
```

## 4. MCP Playwright (automacao de browser)

Baixar zip de https://github.com/microsoft/playwright-mcp/archive/refs/heads/main.zip e extrair para C:\dev\Skill\playwright-mcp-main

```powershell
cd C:\dev\Skill\playwright-mcp-main
npm install
claude mcp add playwright "node C:\dev\Skill\playwright-mcp-main\cli.js" -g
```

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
