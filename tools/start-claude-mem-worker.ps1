# start-claude-mem-worker.ps1 — sobe o worker do claude-mem SEMPRE na versao atual.
#
# A tarefa agendada original apontava para ~/.claude/plugins/marketplaces/thedotmack
# (o clone do marketplace). Esse caminho nao acompanha a versao instalada: quando o
# plugin atualiza, o cache muda e o clone nao, entao o worker do login sobe a versao
# velha enquanto o plugin resolve a nova. O resultado e o "version mismatch recycle"
# — o successor respawna a versao stale, ela ganha a porta 37777 primeiro, a versao
# correta bate em "Port already in use" e o loop nunca converge.
# Ver thedotmack/claude-mem#3378, #3216, #3205.
#
# Este script resolve a versao mais recente do cache no momento da execucao, entao
# continua correto depois de qualquer atualizacao.

$ErrorActionPreference = 'Stop'
$cache = Join-Path $env:USERPROFILE '.claude\plugins\cache\thedotmack\claude-mem'

if (-not (Test-Path $cache)) {
    Write-Error "Cache do claude-mem nao encontrado em $cache. O plugin esta instalado? (claude plugin list)"
    exit 1
}

# Ordena por versao semantica de verdade — ordenacao textual poria 13.9.0 acima de 13.12.0.
$versao = Get-ChildItem $cache -Directory |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1

if (-not $versao) {
    Write-Error "Nenhuma versao valida em $cache"
    exit 1
}

$script = Join-Path $versao.FullName 'scripts\worker-service.cjs'
if (-not (Test-Path $script)) {
    Write-Error "worker-service.cjs nao encontrado em $($versao.FullName)"
    exit 1
}

Write-Output "Subindo claude-mem worker $($versao.Name)"
Set-Location $versao.FullName

# bun e o runtime preferido; node com o bun-runner e o fallback.
$bun = Get-Command bun -ErrorAction SilentlyContinue
if ($bun) {
    & $bun.Source 'scripts/worker-service.cjs' 'start'
} else {
    & node 'scripts/bun-runner.js' 'scripts/worker-service.cjs' 'start'
}
