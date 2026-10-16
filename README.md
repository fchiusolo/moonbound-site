# moonbound-site

The website for [Moonbound](https://apps.apple.com/us/app/moonbound/id6787484177), served by GitHub Pages at
[moonbound.theshed.me](https://moonbound.theshed.me). Plain static pages: no framework, no backend.

- `index.html`: the landing page, with "Tonight on the Moon".
- `press/`, `privacy/`, `support/`: the press kit, privacy policy and support pages.
- `assets/`: styles, the self-hosted font, images, press files and the built script.

## Tonight on the Moon

`src/` is a JavaScript port of the app's planner (`ios/Moonbound/Planner` in the LunAR repo), so the
website picks the same sights the app does for the same city and moment. It shows only the free
sights: Pro sights are in `src/catalog.js` as anonymous numbers, because the ranking needs all of
them to place the free ones the way the app does.

```bash
npm install
npm test        # the app's own Rome test month, night by night
npm run build   # bundles src/ into assets/js/tonight.js (commit the result)
```

When the app's catalog or photos change, regenerate from a LunAR checkout:

```bash
node scripts/build-data.mjs ../LunAR
python3 scripts/sight-photos.py ../LunAR
npm run build
```

When the app's planner changes, port the change to `src/planner.js` and keep `npm test` passing.

Screenshots and the press kit zip come from `scripts/phones.py <screenshots folder>`.
