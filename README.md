# Planning Cards

Planning poker cards for remote calls.

## Run

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open:

- Controller: http://127.0.0.1:4173/
- Public display: http://127.0.0.1:4173/?view=public

The controller also has a `Display` button that opens the public tab.

## Test

```sh
npm install
npm test
```
