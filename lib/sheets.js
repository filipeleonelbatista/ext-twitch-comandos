/**
 * Fetch and parse Google Sheets CSV (client).
 */
export async function fetchSheetCsv(url) {
  const res = await fetch(url, {
    method: 'get',
    headers: { Accept: 'text/csv, text/plain' },
  });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const rows = lines.map((line) => parseCsvLine(line));
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const command = (row[0] ?? '').trim();
    const category = (row[1] ?? '').trim();
    if (!command) continue;
    data.push({ command, category: category || 'Geral' });
  }
  return data;
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\t') {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

export async function fetchAllSheets(followersUrl, subscribersUrl) {
  const [followers, subscribers] = await Promise.all([
    fetchSheetCsv(followersUrl).catch(() => []),
    fetchSheetCsv(subscribersUrl).catch(() => []),
  ]);
  return { followers, subscribers };
}

export function getUniqueCategories(followers, subscribers) {
  const set = new Set();
  followers.forEach((r) => set.add(r.category));
  subscribers.forEach((r) => set.add(r.category));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
