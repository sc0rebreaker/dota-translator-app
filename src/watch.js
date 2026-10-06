// Terminal mode: node src/watch.js (npm run watch)
// It used to run the whole chain in a console with a Gemini key of the
// player's own. Since 0.7.0 every translation goes through the hosted
// translator behind a signed-in session, which only the app holds, so this
// mode no longer translates anything.

console.error('Terminal mode no longer translates: translation needs the signed-in app. Run "npm start" and sign in (tray icon > Settings).');
process.exit(1);
