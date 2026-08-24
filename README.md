# Planning Cards

Planning poker cards for remote calls.

## Screenshots

Single-player:

| Controller | Public hidden | Public revealed |
| --- | --- | --- |
| ![Controller view with a placed hidden card](docs/screenshots/controller-placed.png) | ![Public display with a hidden placed card](docs/screenshots/public-hidden.png) | ![Public display revealing card 8](docs/screenshots/public-revealed.png) |

Shared room:

| Controller | Public hidden | Public revealed |
| --- | --- | --- |
| ![Shared controller table with a ready participant](docs/screenshots/shared-controller-hidden.png) | ![Shared public table with a hidden card](docs/screenshots/shared-public-hidden.png) | ![Shared public table with a revealed card](docs/screenshots/shared-public-revealed.png) |

## Run

Hosted:

- Controller: https://domjancik.github.io/planning-cards/
- Public display: https://domjancik.github.io/planning-cards/?view=public
- Shared room: https://domjancik.github.io/planning-cards/?room=demo
- Shared public display: https://domjancik.github.io/planning-cards/?room=demo&view=public

Simplest:

Open `index.html` in your browser. No Python or build step is required for the standalone controller.

Recommended for two synced tabs and clean local URLs:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open:

- Controller: http://127.0.0.1:4173/
- Public display: http://127.0.0.1:4173/?view=public
- Shared room: http://127.0.0.1:4173/?room=demo

The controller also has a `Display` button that opens the public tab.

## Shared Rooms

Hosted shared rooms use the SpacetimeDB Maincloud database `planning-cards`.

Open a room URL such as `/?room=abc123`. Hidden card values stay in a private server table; clients only receive `hasSelection` until someone clicks `Reveal All`.

When changing the shared backend:

```sh
npm install
npm install --prefix spacetimedb
spacetime publish planning-cards --server maincloud -p spacetimedb --yes
npm run generate:spacetime
npm run build
```

## Test

```sh
npm install
npm test
```

Regenerate README screenshots:

```sh
npm run screenshots
```
