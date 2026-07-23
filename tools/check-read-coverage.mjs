#!/usr/bin/env node
/**
 * check-read-coverage.mjs — mede quanto de um repo uma sessão realmente leu.
 *
 * O /learn-codebase manda ler todo arquivo-fonte, mas o agente pode declarar
 * "li tudo" e ter parado no meio: no vault Jarvis leu 40 de 92 e ignorou uma
 * camada inteira, relatando sucesso. Este script confere por fora, contando os
 * Read do transcript da sessão e comparando com os arquivos do repo.
 *
 * Uso:
 *   node tools/check-read-coverage.mjs                    # cwd, transcript mais recente
 *   node tools/check-read-coverage.mjs C:\dev\jarvis      # projeto especifico
 *   node tools/check-read-coverage.mjs C:\dev\jarvis --all  # soma TODOS os transcripts
 *   node tools/check-read-coverage.mjs . --ext md,ts      # so essas extensoes
 *   node tools/check-read-coverage.mjs . --list           # imprime a lista de faltantes
 *
 * Saida: percentual de cobertura + os arquivos nao lidos, prontos para alimentar
 * uma segunda passada. Sai com codigo 1 se faltar arquivo (util em script).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, extname, relative } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));

// `--ext md` consome o proximo argumento: sem isso "md" cairia nos posicionais
// e seria tratado como o caminho do projeto.
const iExt = args.indexOf('--ext');
const consumidos = new Set(iExt >= 0 ? [iExt, iExt + 1] : []);
const posicionais = args.filter((a, i) => !a.startsWith('--') && !consumidos.has(i));
const alvo = resolve(posicionais[0] || process.cwd());

const extArg = args.find((a) => a.startsWith('--ext='))?.split('=')[1]
  || (iExt >= 0 ? args[iExt + 1] : null);
const EXTS = extArg
  ? new Set(extArg.split(',').map((e) => '.' + e.replace(/^\./, '').trim()))
  : new Set(['.md', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.py', '.go', '.rs', '.java', '.rb', '.sh', '.sql', '.css', '.scss', '.html', '.yml', '.yaml', '.toml']);
const IGNORAR = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'out', 'coverage', '.venv', '__pycache__', 'vendor', '.turbo', '.cache']);

if (!existsSync(alvo)) {
  console.error(`Projeto nao encontrado: ${alvo}`);
  process.exit(2);
}

// Convenção do Claude Code: cada caractere não alfanumérico vira "-"
// (C:\dev\jarvis -> C--dev-jarvis)
const slug = alvo.replace(/[^a-zA-Z0-9]/g, '-');
const dirTranscripts = join(homedir(), '.claude', 'projects', slug);
if (!existsSync(dirTranscripts)) {
  console.error(`Sem transcripts para este projeto (${slug}).`);
  console.error(`Esperado em: ${dirTranscripts}`);
  process.exit(2);
}

const transcripts = readdirSync(dirTranscripts)
  .filter((f) => f.endsWith('.jsonl'))
  .map((f) => ({ nome: f, caminho: join(dirTranscripts, f), mtime: statSync(join(dirTranscripts, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (transcripts.length === 0) {
  console.error(`Nenhum transcript .jsonl em ${dirTranscripts}`);
  process.exit(2);
}

const usar = flags.has('--all') ? transcripts : [transcripts[0]];

function lidosEm(caminho) {
  const encontrados = new Set();
  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    if (!linha.trim() || !linha.includes('"Read"')) continue; // atalho barato
    let ev;
    try { ev = JSON.parse(linha); } catch { continue; }
    const blocos = ev?.message?.content;
    if (!Array.isArray(blocos)) continue;
    for (const b of blocos) {
      if (b?.type === 'tool_use' && b?.name === 'Read' && b?.input?.file_path) {
        try { encontrados.add(resolve(b.input.file_path)); } catch {}
      }
    }
  }
  return encontrados;
}

const lidos = new Set();
for (const t of usar) for (const f of lidosEm(t.caminho)) lidos.add(f);

function arquivosDoRepo(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) arquivosDoRepo(full, acc);
    else if (EXTS.has(extname(entry.name).toLowerCase())) acc.push(resolve(full));
  }
  return acc;
}

const todos = arquivosDoRepo(alvo);
const faltantes = todos.filter((f) => !lidos.has(f));
const cobertos = todos.length - faltantes.length;
const pct = todos.length ? Math.round((cobertos / todos.length) * 100) : 100;

console.log(`=== cobertura de leitura — ${alvo}`);
console.log(`transcripts analisados: ${usar.length}${flags.has('--all') ? ' (todos)' : ` (mais recente: ${usar[0].nome})`}`);
console.log(`arquivos-fonte: ${todos.length} | lidos: ${cobertos} | faltando: ${faltantes.length} | cobertura: ${pct}%`);

if (faltantes.length) {
  const mostrar = flags.has('--list') ? faltantes : faltantes.slice(0, 20);
  console.log('');
  for (const f of mostrar) console.log('  ' + relative(alvo, f));
  if (!flags.has('--list') && faltantes.length > mostrar.length) {
    console.log(`  ... e mais ${faltantes.length - mostrar.length} (use --list para todos)`);
  }
  console.log('\nAlimente esta lista numa segunda passada em vez de confiar no relatorio do agente.');
  process.exit(1);
}

console.log('\nCobertura completa — todo arquivo-fonte foi lido.');
