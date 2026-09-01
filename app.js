(() => {
  const cfg = window.SITE_CONFIG || {};

  // =========================================================
  // MAIN PAGE
  // =========================================================

  const metricsEl = document.getElementById('metrics');
  const dateEl = document.getElementById('date-range');
  const statusEl = document.getElementById('status');
  const copyButton = document.getElementById('copy-button');

  // =========================================================
  // HISTORY PAGE
  // =========================================================

  const historyTableEl =
    document.getElementById('history-table');

  // =========================================================
  // DATES
  // =========================================================

  const fmtDate = (iso) => {
    const d = new Date(`${iso}T12:00:00`);

    return new Intl.DateTimeFormat(
      cfg.LOCALE || 'uk-UA',
      {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }
    ).format(d);
  };

  const formatRange = (start, end) => {
    const s = new Date(`${start}T12:00:00`);
    const e = new Date(`${end}T12:00:00`);

    const sameYear =
      s.getFullYear() === e.getFullYear();

    const sameMonth =
      sameYear &&
      s.getMonth() === e.getMonth();

    if (sameMonth) {
      return `${s.getDate()} – ${e.getDate()} ${new Intl.DateTimeFormat(
        cfg.LOCALE || 'uk-UA',
        {
          month: 'long',
          year: 'numeric'
        }
      ).format(s)}`;
    }

    if (sameYear) {
      const f = new Intl.DateTimeFormat(
        cfg.LOCALE || 'uk-UA',
        {
          day: 'numeric',
          month: 'long'
        }
      );

      return `${f.format(s)} – ${f.format(e)} ${e.getFullYear()}`;
    }

    return `${fmtDate(start)} – ${fmtDate(end)}`;
  };

  function mondayOfWeek(date = new Date()) {
    const d = new Date(date);

    d.setHours(12, 0, 0, 0);

    const day = d.getDay();

    const diff =
      day === 0
        ? -6
        : 1 - day;

    d.setDate(d.getDate() + diff);

    return d;
  }

  function isoDate(d) {
    return d.toISOString().slice(0, 10);
  }

  function currentWeek() {
    const start =
      mondayOfWeek(new Date());

    const end =
      new Date(start);

    end.setDate(
      end.getDate() + 6
    );

    return {
      start: isoDate(start),
      end: isoDate(end)
    };
  }

  // =========================================================
  // CSV
  // =========================================================

  function parseCsv(text) {
    const rows = [];

    let row = [];
    let cell = '';
    let quoted = false;

    for (
      let i = 0;
      i < text.length;
      i++
    ) {
      const c = text[i];
      const n = text[i + 1];

      if (
        c === '"' &&
        quoted &&
        n === '"'
      ) {
        cell += '"';
        i++;
        continue;
      }

      if (c === '"') {
        quoted = !quoted;
        continue;
      }

      if (
        c === ',' &&
        !quoted
      ) {
        row.push(cell);
        cell = '';
        continue;
      }

      if (
        (c === '\n' || c === '\r') &&
        !quoted
      ) {
        if (
          c === '\r' &&
          n === '\n'
        ) {
          i++;
        }

        row.push(cell);
        cell = '';

        if (
          row.some(
            v => v.trim() !== ''
          )
        ) {
          rows.push(row);
        }

        row = [];

        continue;
      }

      cell += c;
    }

    if (
      cell.length ||
      row.length
    ) {
      row.push(cell);
      rows.push(row);
    }

    if (!rows.length) {
      return [];
    }

    const headers =
      rows
        .shift()
        .map(
          h =>
            h.trim().toLowerCase()
        );

    return rows.map(r =>
      Object.fromEntries(
        headers.map(
          (h, i) => [
            h,
            (r[i] ?? '').trim()
          ]
        )
      )
    );
  }

  // =========================================================
  // MAIN DATA
  // =========================================================

  async function getData() {

    if (cfg.CSV_URL) {

      const response =
        await fetch(
          cfg.CSV_URL,
          {
            cache: 'no-store'
          }
        );

      if (!response.ok) {
        throw new Error(
          `Google Sheets: HTTP ${response.status}`
        );
      }

      const text =
        await response.text();

      return parseCsv(text);
    }

    const response =
      await fetch(
        cfg.FALLBACK_DATA_URL,
        {
          cache: 'no-store'
        }
      );

    if (!response.ok) {
      throw new Error(
        `Demo data: HTTP ${response.status}`
      );
    }

    return response.json();
  }

  // =========================================================
  // HISTORY DATA
  // =========================================================

  async function getHistoryData() {

    if (!cfg.HISTORY_CSV_URL) {
      throw new Error(
        'HISTORY_CSV_URL не налаштований'
      );
    }

    const response =
      await fetch(
        cfg.HISTORY_CSV_URL,
        {
          cache: 'no-store'
        }
      );

    if (!response.ok) {
      throw new Error(
        `Weekly History: HTTP ${response.status}`
      );
    }

    const text =
      await response.text();

    return parseCsv(text);
  }

  // =========================================================
  // MAIN NORMALIZE
  // =========================================================

  function normalize(row) {

    const percentRaw =
      String(
        row.percent ??
        row.percentage ??
        ''
      )
        .replace('%', '')
        .replace(',', '.');

    return {

      week_start:
        row.week_start ||
        row.start_date ||
        '',

      week_end:
        row.week_end ||
        row.end_date ||
        '',

      metric_id:
        row.metric_id ||
        row.id ||
        '',

      label:
        row.label ||
        row.question ||
        '',

      percent:
        Number(percentRaw),

      answer:
        row.answer ||
        row.response ||
        '',

      sort_order:
        Number(
          row.sort_order || 999
        )
    };
  }

  function chooseCurrentWeek(rows) {

    const normalized =
      rows
        .map(normalize)
        .filter(
          r =>
            r.metric_id &&
            Number.isFinite(
              r.percent
            )
        );

    if (!normalized.length) {
      return [];
    }

    const hasWeek =
      normalized.some(
        r => r.week_start
      );

    if (!hasWeek) {
      return normalized;
    }

    const wanted =
      currentWeek();

    const exact =
      normalized.filter(
        r =>
          r.week_start ===
            wanted.start &&
          r.week_end ===
            wanted.end
      );

    if (exact.length) {
      return exact;
    }

    const dated =
      normalized.filter(
        r => r.week_start
      );

    if (!dated.length) {
      return normalized;
    }

    const starts =
      [
        ...new Set(
          dated.map(
            r => r.week_start
          )
        )
      ]
        .sort()
        .reverse();

    return dated.filter(
      r =>
        r.week_start ===
        starts[0]
    );
  }

  // =========================================================
  // MAIN RENDER
  // =========================================================

  function render(rows) {

    const byMetric =
      new Map();

    rows.forEach(r => {

      if (
        !byMetric.has(
          r.metric_id
        ) ||
        r.percent >
          byMetric.get(
            r.metric_id
          ).percent
      ) {
        byMetric.set(
          r.metric_id,
          r
        );
      }

    });

    const items =
      [
        ...byMetric.values()
      ]
        .sort(
          (a, b) =>
            a.sort_order -
            b.sort_order
        )
        .slice(
          0,
          cfg.METRIC_COUNT || 7
        );

    metricsEl.innerHTML =
      items
        .map(
          item => `
            <article class="metric">
              <p class="percent">
                ${trimPercent(item.percent)}%
              </p>

              <p class="label">
                ${escapeHtml(item.label)}
              </p>

              <p class="answer">
                ${escapeHtml(item.answer)}
              </p>
            </article>
          `
        )
        .join('');

    if (items.length) {

      const week =
        currentWeek();

      dateEl.textContent =
        formatRange(
          week.start,
          week.end
        );
    }
  }

  // =========================================================
  // HISTORY CONFIG
  // =========================================================

  const HISTORY_METRICS = [

    {
      key: 'experience',
      label: 'Досвід керування дроном'
    },

    {
      key: 'jtbd',
      label: 'Бажання використовувати симулятор'
    },

    {
      key: 'training_method',
      label: 'Поточний метод тренування'
    },

    {
      key: 'current_problem',
      label: 'Головна проблема'
    },

    {
      key: 'simulator_selection',
      label: 'Критерій вибору симулятора'
    },

    {
      key: 'usage_barriers',
      label: 'Барʼєр використання'
    },

    {
      key: 'acquisition_channels',
      label: 'Канал залучення'
    }

  ];

  // =========================================================
  // HISTORY DATE
  // =========================================================

  function formatHistoryDate(value) {

    if (!value) {
      return '';
    }

    return value;
  }

  function parseHistoryDate(value) {

    if (!value) {
      return 0;
    }

    const parts =
      value.split('.');

    if (
      parts.length === 3
    ) {

      const day =
        Number(parts[0]);

      const month =
        Number(parts[1]) - 1;

      const year =
        Number(parts[2]);

      return new Date(
        year,
        month,
        day
      ).getTime();
    }

    const d =
      new Date(value);

    return Number.isNaN(
      d.getTime()
    )
      ? 0
      : d.getTime();
  }

  // =========================================================
  // HISTORY PERCENT
  // =========================================================

  function historyPercent(value) {

    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return '—';
    }

    const number =
      Number(
        String(value)
          .replace('%', '')
          .replace(',', '.')
      );

    if (
      !Number.isFinite(number)
    ) {
      return '—';
    }

    return `${number.toLocaleString(
      'uk-UA',
      {
        maximumFractionDigits: 1
      }
    )}%`;
  }

  // =========================================================
  // HISTORY RENDER
  // =========================================================

  function renderHistory(rows) {

    if (!historyTableEl) {
      return;
    }

    if (
      !rows ||
      !rows.length
    ) {

      historyTableEl.innerHTML = `
        <div class="history-loading">
          Немає історичних даних
        </div>
      `;

      return;
    }

    // Новіший тиждень зверху
    const sortedRows =
      [...rows].sort(
        (a, b) =>
          parseHistoryDate(
            b.week_end
          ) -
          parseHistoryDate(
            a.week_end
          )
      );

    const headerCells =
      HISTORY_METRICS
        .map(
          metric => `
            <th>
              ${escapeHtml(
                metric.label
              )}
            </th>
          `
        )
        .join('');

    const bodyRows =
      sortedRows
        .map(row => {

          const metricCells =
            HISTORY_METRICS
              .map(metric => {

                const percent =
                  row[
                    `${metric.key}_percent`
                  ];

                const answer =
                  row[
                    `${metric.key}_answer`
                  ] || '';

                return `
                  <td>

                    <div class="history-percent">
                      ${historyPercent(
                        percent
                      )}
                    </div>

                    <div class="history-answer">
                      ${escapeHtml(
                        answer
                      )}
                    </div>

                  </td>
                `;
              })
              .join('');

          return `
            <tr>

              <td class="history-date">
                ${escapeHtml(
                  formatHistoryDate(
                    row.week_end
                  )
                )}
              </td>

              ${metricCells}

            </tr>
          `;
        })
        .join('');

    historyTableEl.innerHTML = `

      <div class="history-table-wrapper">

        <table>

          <thead>

            <tr>

              <th class="history-week">
                Тиждень
              </th>

              ${headerCells}

            </tr>

          </thead>

          <tbody>

            ${bodyRows}

          </tbody>

        </table>

      </div>

    `;
  }

  // =========================================================
  // UTILITY
  // =========================================================

  function trimPercent(n) {

    return Number(n).toLocaleString(
      'uk-UA',
      {
        maximumFractionDigits: 1
      }
    );
  }

  function escapeHtml(v) {

    return String(v).replace(
      /[&<>'"]/g,
      ch =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[ch])
    );
  }

  function status(message) {

    if (!statusEl) {
      return;
    }

    statusEl.textContent =
      message;

    statusEl.classList.add(
      'visible'
    );

    clearTimeout(
      status.timer
    );

    status.timer =
      setTimeout(
        () =>
          statusEl.classList.remove(
            'visible'
          ),
        2200
      );
  }

  // =========================================================
  // PNG
  // =========================================================

  async function downloadPng() {

    copyButton.disabled =
      true;

    try {

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const canvas =
        await html2canvas(
          document.getElementById(
            'stats'
          ),
          {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
            logging: false,
            width: 1440,
            height: 812,
            windowWidth: 1440,
            windowHeight: 812
          }
        );

      const link =
        document.createElement(
          'a'
        );

      const week =
        currentWeek();

      link.download =
        `statystyka-${week.start}-${week.end}.png`;

      link.href =
        canvas.toDataURL(
          'image/png'
        );

      link.click();

      status(
        'PNG завантажено'
      );

    } catch (e) {

      console.error(e);

      status(
        'Не вдалося створити PNG'
      );

    } finally {

      copyButton.disabled =
        false;
    }
  }

  // =========================================================
  // INIT
  // =========================================================

  async function init() {

    document.documentElement
      .classList.add(
        'loading'
      );

    // -------------------------------------------------------
    // MAIN PAGE
    // -------------------------------------------------------

    try {

      const data =
        await getData();

      const rows =
        chooseCurrentWeek(
          data
        );

      if (!rows.length) {
        throw new Error(
          'Немає даних для відображення'
        );
      }

      render(rows);

    } catch (e) {

      console.error(
        'MAIN DATA ERROR:',
        e
      );

      status(
        'Помилка завантаження даних'
      );

      try {

        const fallback =
          await fetch(
            './demo-data.json'
          ).then(
            r => r.json()
          );

        render(
          chooseCurrentWeek(
            fallback
          )
        );

      } catch (_) {}

    }

    // -------------------------------------------------------
    // HISTORY
    // -------------------------------------------------------

    try {

      const historyData =
        await getHistoryData();

      console.log(
        'WEEKLY HISTORY:',
        historyData
      );

      renderHistory(
        historyData
      );

    } catch (e) {

      console.error(
        'HISTORY ERROR:',
        e
      );

      if (historyTableEl) {

        historyTableEl.innerHTML = `
          <div class="history-loading">
            Не вдалося завантажити історію
          </div>
        `;

      }

    }

    document.documentElement
      .classList.remove(
        'loading'
      );
  }

  // =========================================================
  // EVENTS
  // =========================================================

  if (copyButton) {

    copyButton.addEventListener(
      'click',
      downloadPng
    );

  }

  init();

})();
