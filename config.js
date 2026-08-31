/*
  НАЛАШТУВАННЯ
  1. Створіть/опублікуйте аркуш SiteData у Google Sheets.
  2. Скопіюйте URL CSV експорту цього аркуша нижче.
  3. SiteData не потребує week_start/week_end: тиждень визначається сайтом за календарем Пн–Нд.
  3. Якщо URL порожній, сайт використовує demo-data.json.
*/
window.SITE_CONFIG = {
  CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTX1JLYsoAmLVrZP3s11N2l0MOB-EpxgEGEeQiustOaKvlnb-u7lZJmzRd0ChFbTDy8zNDwZAV1ZVhv/pub?gid=0&single=true&output=csv',
  FALLBACK_DATA_URL: './demo-data.json',
  TITLE: 'Статистика за тиждень',
  LOCALE: 'uk-UA',
  WEEK_STARTS_MONDAY: true,
  METRIC_COUNT: 7,
  STYLES: {
    body: {
      margin: '0',
      padding: '0',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden'
    },
    container: {
      padding: '24px',
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      overflow: 'auto'
    }
  }
};
