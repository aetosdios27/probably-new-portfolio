import type { Benchmark } from './types';

export function plain(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1').replace(/[*_`]/g, '').replace(/~~/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

export function intro(readme: string): string[] {
  const cleaned = readme.replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  const blocks = cleaned.split(/\n\s*\n/);
  const paragraphs: string[] = [];
  let words = 0;
  for (const block of blocks) {
    if (/^\s*#{2,}\s/.test(block)) {
      if (!paragraphs.length && /^\s*#+\s+(about|overview|introduction)\b/i.test(block)) continue;
      break;
    }
    if (/^\s*(#|[-*]\s|\d+\.|\||\[![\w-]+\]|\[[^\]]+\]:|[-*_]{3,}\s*$)/.test(block)) continue;
    let text = plain(block.replace(/^>\s?/gm, ''));
    if (!text || /^(build|license|status|docs)\s*$/i.test(text)) continue;
    if (words + text.split(/\s+/).length > 120) {
      const sentences = text.match(/[^.!?]+[.!?](?:\s|$)/g) ?? [];
      text = '';
      for (const sentence of sentences) {
        const count = sentence.trim().split(/\s+/).length;
        if (words + count > 120) break;
        text += sentence; words += count;
      }
      if (text.trim()) paragraphs.push(text.trim());
      break;
    }
    paragraphs.push(text); words += text.split(/\s+/).length;
    if (paragraphs.length === 3) break;
  }
  return paragraphs;
}

// Only explicit measured units. Counts, thread numbers, versions, and
// dimensionless assertions are deliberately not interpreted as measurements.
const measurement = /(?<![\w.])([<>≤≥~]?\d+(?:\.\d+)?(?:[KM])?)\s*(ns|us|µs|μs|ms|seconds?|secs?|s|GB\/s|MB\/s|KB\/s|bytes\/s|gets\/s|ops\/s|requests\/s|req\/s|MiB|GiB|MB|GB|KB|bytes|%)(?!\w)/g;
function values(cell: string) {
  return [...plain(cell).matchAll(measurement)].filter(m => !/[\d.-]$/.test(cell.slice(0, m.index))).map(m => {
    const raw = m[1].replace(/^[<>≤≥~]/, '');
    const scale = raw.endsWith('M') ? 1e6 : raw.endsWith('K') ? 1e3 : 1;
    return { text: m[0], unit: m[2], value: /^[<>≤≥]/.test(m[1]) ? NaN : parseFloat(raw) * scale };
  });
}

// A table or list only counts as a benchmark when it sits under a heading about performance. Feature
// lists ("Sub-10ms editor response") and stack tables ("<10MB binary") quote numbers without measuring.
const performanceHeading = /perf|bench|latenc|throughput|speed|results?\b/i;

export function benchmarks(readme: string): Benchmark[] | null {
  const rows: Benchmark[] = [];
  const lines = readme.replace(/```[\s\S]*?```/g, '').split('\n');
  let section = '';
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) section = plain(lines[i].replace(/^#+\s*/, ''));
    if (!performanceHeading.test(section) || !lines[i].includes('|') || !/^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) continue;
    const split = (s: string) => s.trim().replace(/^\||\|$/g, '').split('|').map(plain);
    const headers = split(lines[i]);
    let before = headers.findIndex(h => /^(baseline|old|previous|fixedpriority)$/i.test(h));
    headers.forEach((h, index) => { if (/before/i.test(h)) before = index; });
    let after = -1;
    headers.forEach((h, index) => { if (/after|result|current|new|optimized/i.test(h)) after = index; });
    i += 2;
    while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
      const cells = split(lines[i]);
      const raw = lines[i];
      const targets = after >= 0 ? [after] : cells.map((_, index) => index).filter(index => index > 0);
      for (const col of targets) {
        const resultValues = values(cells[col] ?? '');
        if (!resultValues.length) continue;
        for (const result of resultValues) {
          const baseline = before >= 0 ? values(cells[before] ?? '').find(v => v.unit === result.unit) : undefined;
          rows.push({ label: `${cells[0]}${resultValues.length > 1 || after < 0 ? ` · ${headers[col]} · ${result.unit}` : ''}`,
            baseline: baseline?.text ?? null, result: result.text,
            delta: baseline && baseline.value !== 0 && Number.isFinite(baseline.value) && Number.isFinite(result.value) ? Math.round((result.value - baseline.value) / baseline.value * 1000) / 10 : null,
            source: `${section}\n${headers.join(' | ')}\n${raw}` });
        }
      }
      i++;
    }
    i--;
  }
  // Numeric list statements under a performance heading are kept verbatim.
  section = '';
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) section = plain(line.replace(/^#+\s*/, ''));
    if (performanceHeading.test(section) && /^\s*[-*]\s/.test(line) && values(line).length) {
      rows.push({ label: section, baseline: null, result: plain(line.replace(/^\s*[-*]\s*/, '')), delta: null, source: line });
    }
  }
  return rows.length ? rows : null;
}

export function readmeLinks(readme: string) {
  return [...readme.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g)]
    .filter(m => /\b(demo|live|playground|docs[- ]site|website)\b/i.test(m[1]))
    .map(m => ({ label: plain(m[1]), url: m[2] }));
}

export function screenshotUrls(readme: string, rawBase: string) {
  const images = [...readme.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)|<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi)];
  return images.flatMap(m => {
    const url = m[2] ?? m[3];
    if ((!/\.(png|jpe?g|webp)(?:[?#]|$)/i.test(url) && !/github\.com\/[^/]+\/[^/]+\/assets\//i.test(url)) || /badge|shield|logo|icon|avatar/i.test(`${m[1] ?? ''} ${url}`)) return [];
    try {
      const resolved = new URL(url, rawBase).href.replace(/https:\/\/github.com\/([^/]+)\/([^/]+)\/blob\//, 'https://raw.githubusercontent.com/$1/$2/');
      return [resolved];
    } catch { return []; }
  });
}
