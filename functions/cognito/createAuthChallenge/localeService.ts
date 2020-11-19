const i18next = require('i18next');
const Backend = require('i18next-fs-backend');

const i18nextOptions = {
  initImmediate: false,
  lng: 'en',
  fallbackLng: 'en',
  preload: ['en', 'it', 'es', 'fr'],
  backend: {
    loadPath: 'locales/{{lng}}.json',
  },
};

i18next.use(Backend).init(i18nextOptions);

export default i18next;
