/*
  НАЛАШТУВАННЯ
  1. Створіть/опублікуйте аркуш SiteData у Google Sheets.
  2. Скопіюйте URL CSV експорту цього аркуша нижче.
  3. Якщо URL порожній, сайт використовує demo-data.json.
*/
window.SITE_CONFIG = {
  CSV_URL: '',
  FALLBACK_DATA_URL: './demo-data.json',
  TITLE: 'Статистика за тиждень',
  LOCALE: 'uk-UA',
  WEEK_STARTS_MONDAY: true,
  METRIC_COUNT: 7
};
