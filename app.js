(() => {
  const cfg = window.SITE_CONFIG || {};
  const metricsEl = document.getElementById('metrics');
  const dateEl = document.getElementById('date-range');
  const statusEl = document.getElementById('status');
  const copyButton = document.getElementById('copy-button');

  const fmtDate = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    return new Intl.DateTimeFormat(cfg.LOCALE || 'uk-UA', {
      day: '2-digit', month: 'long', year: 'numeric'
    }).format(d);
  };

  const formatRange = (start, end) => {
    const s = new Date(`${start}T12:00:00`);
    const e = new Date(`${end}T12:00:00`);
    const sameYear = s.getFullYear() === e.getFullYear();
    const sameMonth = sameYear && s.getMonth() === e.getMonth();
    if (sameMonth) {
      return `${s.getDate()} – ${e.getDate()} ${new Intl.DateTimeFormat(cfg.LOCALE, {month:'long', year:'numeric'}).format(s)}`;
    }
    if (sameYear) {
      const f = new Intl.DateTimeFormat(cfg.LOCALE, {day:'numeric', month:'long'});
      return `${f.format(s)} – ${f.format(e)} ${e.getFullYear()}`;
    }
    return `${fmtDate(start)} – ${fmtDate(end)}`;
  };

  function mondayOfWeek(date = new Date()) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    const day = d.getDay(); // 0 = Sunday
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function isoDate(d) { return d.toISOString().slice(0,10); }

  function currentWeek() {
    const start = mondayOfWeek(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: isoDate(start), end: isoDate(end) };
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i=0; i<text.length; i++) {
      const c = text[i], n = text[i+1];
      if (c === '"' && quoted && n === '"') { cell += '"'; i++; continue; }
      if (c === '"') { quoted = !quoted; continue; }
      if (c === ',' && !quoted) { row.push(cell); cell=''; continue; }
      if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && n === '\n') i++;
        row.push(cell); cell='';
        if (row.some(v => v.trim() !== '')) rows.push(row);
        row=[]; continue;
      }
      cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map(h => h.trim().toLowerCase());
    return rows.map(r => Object.fromEntries(headers.map((h,i) => [h, (r[i] ?? '').trim()])));
  }

  async function getData() {
    if (cfg.CSV_URL) {
      const response = await fetch(cfg.CSV_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Google Sheets: HTTP ${response.status}`);
      const text = await response.text();
      return parseCsv(text);
    }
    const response = await fetch(cfg.FALLBACK_DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Demo data: HTTP ${response.status}`);
    return response.json();
  }

  function normalize(row) {
    const percentRaw = String(row.percent ?? row.percentage ?? '').replace('%','').replace(',','.');
    return {
      week_start: row.week_start || row.start_date || '',
      week_end: row.week_end || row.end_date || '',
      metric_id: row.metric_id || row.id || '',
      label: row.label || row.question || '',
      percent: Number(percentRaw),
      answer: row.answer || row.response || '',
      sort_order: Number(row.sort_order || 999)
    };
  }

  function chooseCurrentWeek(rows) {
    const normalized = rows.map(normalize).filter(r => r.metric_id && Number.isFinite(r.percent));
    if (!normalized.length) return [];
    const wanted = currentWeek();
    let exact = normalized.filter(r => r.week_start === wanted.start && r.week_end === wanted.end);
    if (exact.length) return exact;

    // Якщо даних за поточний тиждень ще немає — показуємо останній доступний тиждень.
    const starts = [...new Set(normalized.map(r => r.week_start))].sort().reverse();
    const latest = starts[0];
    return normalized.filter(r => r.week_start === latest);
  }

  function render(rows) {
    const byMetric = new Map();
    // Для кожного metric_id беремо найбільше значення відсотка і відповідь з того ж рядка.
    rows.forEach(r => {
      if (!byMetric.has(r.metric_id) || r.percent > byMetric.get(r.metric_id).percent) byMetric.set(r.metric_id, r);
    });
    const items = [...byMetric.values()].sort((a,b) => a.sort_order - b.sort_order).slice(0, cfg.METRIC_COUNT || 7);
    metricsEl.innerHTML = items.map(item => `
      <article class="metric">
        <p class="percent">${trimPercent(item.percent)}%</p>
        <p class="label">${escapeHtml(item.label)}</p>
        <p class="answer">${escapeHtml(item.answer)}</p>
      </article>
    `).join('');

    if (items.length) {
      const start = items[0].week_start;
      const end = items[0].week_end || addDays(start, 6);
      dateEl.textContent = formatRange(start, end);
    }
  }

  function trimPercent(n) {
    return Number(n).toLocaleString('uk-UA', { maximumFractionDigits: 1 });
  }
  function addDays(iso, days) {
    const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate()+days); return isoDate(d);
  }
  function escapeHtml(v) {
    return String(v).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function status(message) {
    statusEl.textContent = message;
    statusEl.classList.add('visible');
    clearTimeout(status.timer);
    status.timer = setTimeout(() => statusEl.classList.remove('visible'), 2200);
  }

  async function downloadPng() {
    copyButton.disabled = true;
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await html2canvas(document.getElementById('stats'), {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        width: 1440,
        height: 812,
        windowWidth: 1440,
        windowHeight: 812
      });
      const link = document.createElement('a');
      const week = currentWeek();
      link.download = `statystyka-${week.start}-${week.end}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      status('PNG завантажено');
    } catch (e) {
      console.error(e);
      status('Не вдалося створити PNG');
    } finally { copyButton.disabled = false; }
  }

  async function init() {
    document.documentElement.classList.add('loading');
    try {
      const data = await getData();
      const rows = chooseCurrentWeek(data);
      if (!rows.length) throw new Error('Немає даних для відображення');
      render(rows);
    } catch (e) {
      console.error(e);
      status('Помилка завантаження даних');
      // Keep a useful demo state if the external sheet is unavailable.
      try {
        const fallback = await fetch('./demo-data.json').then(r => r.json());
        render(chooseCurrentWeek(fallback));
      } catch (_) {}
    } finally {
      document.documentElement.classList.remove('loading');
    }
  }

  copyButton.addEventListener('click', downloadPng);
  init();
})();
