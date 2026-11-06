// Builds on app.json (the real config) with what only exists on the developer's machine.
//
// Real push on Android needs Firebase: put the google-services.json from the Firebase console
// in this folder and the next build picks it up. Without it the app still builds and the phone
// makes its own notifications (README.md, "Push notifications").
//
// Kept as a function over app.json so `npx eas init` can still write the project id there.
const fs = require('fs');
const path = require('path');

const GOOGLE_SERVICES = './google-services.json';

module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, GOOGLE_SERVICES))) {
    config.android = { ...config.android, googleServicesFile: GOOGLE_SERVICES };
  }
  return config;
};
