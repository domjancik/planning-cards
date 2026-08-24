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

Open `index.html` in your browser.

Recommended for two synced tabs:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open:

- Controller: http://127.0.0.1:4173/
- Public display: http://127.0.0.1:4173/?view=public
- Shared room: http://127.0.0.1:4173/?room=demo

The controller also has a `Display` button that opens the public tab.

## Shared Rooms

Hosted shared rooms are already configured with a public Supabase publishable key.

For another deployment, update `supabase-config.js`:

```js
window.PLANNING_CARDS_SUPABASE = {
  url: "https://your-project-ref.supabase.co",
  anonKey: "your-publishable-or-anon-key",
};
```

Then open a room URL such as `/?room=abc123`.

This app uses Supabase Realtime Presence and Broadcast only; no database tables or migrations are required.

## Test

```sh
npm install
npm test
```

Regenerate README screenshots:

```sh
npm run screenshots
```
