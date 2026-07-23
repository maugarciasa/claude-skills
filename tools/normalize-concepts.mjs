#!/usr/bin/env node
/**
 * normalize-concepts.mjs — conserta observações do claude-mem que ficam
 * invisíveis para a injeção de contexto.
 *
 * A query que monta o bloco injetado exige que a observação tenha ao menos um
 * `concept` que case EXATAMENTE com a lista do modo ativo. O agente de
 * compressão às vezes grava "gotcha: descrição longa..." em vez de "gotcha" —
 * e aí a observação existe, é pesquisável, mas nunca é injetada, sem erro nem
 * aviso em lugar nenhum.
 *
 * Este script trunca no ":" e regrava apenas os conceitos válidos. Só toca nas
 * observações em que NENHUM conceito casa: basta um para a observação já passar
 * no filtro, então normalizar as demais mexeria em dados que funcionam.
 *
 * Uso:
 *   node tools/normalize-concepts.mjs           # dry-run: só relata
 *   node tools/normalize-concepts.mjs --apply   # regrava
 *
 * Idempotente e seguro para rodar como hook de SessionStart.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const APPLY = process.argv.includes('--apply');
const QUIET = process.argv.includes('--quiet');

const dataDir = process.env.CLAUDE_MEM_DATA_DIR || join(homedir(), '.claude-mem');
const dbPath = join(dataDir, 'claude-mem.db');
if (!existsSync(dbPath)) {
  if (!QUIET) console.error(`claude-mem.db não encontrado em ${dbPath}`);
  process.exit(0); // não é erro: a máquina pode não ter o plugin
}

// A lista de conceitos válidos vem do modo ativo, não de uma cópia hardcoded:
// se o modo mudar (ou for traduzido), o script acompanha.
function conceitosValidos() {
  const fallback = ['how-it-works', 'why-it-exists', 'what-changed', 'problem-solution', 'gotcha', 'pattern', 'trade-off'];
  try {
    const settings = JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf8'));
    const modo = settings.CLAUDE_MEM_MODE || 'code';
    const cache = join(homedir(), '.claude', 'plugins', 'cache', 'thedotmack', 'claude-mem');
    if (!existsSync(cache)) return fallback;
    const dirs = readdirSync(cache).sort().reverse(); // versão mais recente primeiro
    for (const v of dirs) {
      const modeFile = join(cache, v, 'modes', `${modo}.json`);
      if (existsSync(modeFile)) {
        const ids = JSON.parse(readFileSync(modeFile, 'utf8')).observation_concepts?.map((c) => c.id);
        if (ids?.length) return ids;
      }
    }
  } catch {}
  return fallback;
}

const VALID = new Set(conceitosValidos());
const d = new DatabaseSync(dbPath, APPLY ? {} : { readOnly: true });

const rows = d.prepare('SELECT id, project, concepts FROM observations').all();
const corrigidas = [];
const semSalvacao = [];

for (const r of rows) {
  let arr;
  try { arr = JSON.parse(r.concepts || '[]'); } catch { continue; }
  if (!Array.isArray(arr) || arr.length === 0) continue;
  if (arr.some((c) => VALID.has(c))) continue; // já visível — não tocar

  const norm = [...new Set(arr.map((c) => String(c).split(':')[0].trim()).filter((c) => VALID.has(c)))];
  if (norm.length === 0) { semSalvacao.push(r); continue; }
  if (APPLY) d.prepare('UPDATE observations SET concepts = ? WHERE id = ?').run(JSON.stringify(norm), r.id);
  corrigidas.push({ id: r.id, project: r.project, de: arr, para: norm });
}

if (!QUIET || corrigidas.length > 0) {
  for (const c of corrigidas) {
    console.log(`#${c.id} [${c.project}] ${JSON.stringify(c.de).slice(0, 70)}... -> ${JSON.stringify(c.para)}`);
  }
  if (semSalvacao.length && !QUIET) {
    console.log(`\nsem conceito aproveitável (intactas): ${semSalvacao.map((r) => `#${r.id}`).join(', ')}`);
  }
  const verbo = APPLY ? 'normalizadas' : 'a normalizar';
  console.log(`\n${verbo}: ${corrigidas.length} de ${rows.length} observações`);
  if (!APPLY && corrigidas.length) console.log('Rode com --apply para regravar.');
}

d.close();
