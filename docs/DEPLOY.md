# Publishing and installing

## GitHub Pages

1. Repository **Settings → Pages → Source: GitHub Actions**.
2. Merge to `main` (or run the *Deploy to GitHub Pages* workflow). The workflow tests, builds `frontend/` and
   publishes `frontend/dist`. The site lives at `https://<user>.github.io/<repo>/`.

The build uses a relative base and hash routes, so it works from any sub-path.

### Word lists

CSW21 and NWL2023 are copyrighted and are **not** published by default: the workflow sets `OXY_EXCLUDE_LISTS=csw21,nwl2023`.
The site ships the open ENABLE list and the Slovenian list; players import CSW21/NWL2023 from their own file
(*Word lists* screen) and the app remembers them on that device. To publish them too (only if you are entitled to),
set the repository variable `PUBLISH_WORD_LISTS` to `true`. Remember a Pages site is public even for a private repo.

Locally: `cd frontend && npm run build` includes everything in `public/`; `OXY_EXCLUDE_LISTS=csw21,nwl2023 npm run build`
mimics the public build.

## Installing on a phone (once, with internet)

- **iPhone (Safari):** open the site → Share → *Add to Home Screen*.
- **Android (Chrome):** open the site → menu → *Install app* / *Add to Home screen*.

After the first load the service worker has cached the whole app including the word lists; it then starts with no
network at all. Updating: open it online once; the new version is picked up on the next start.

## Laptop host (no install, same Wi-Fi)

`cd frontend && npm install && npm run dev`, open the printed address on the laptop, phones use the QR codes. This
mode keeps the game in the dev server and also enables the odd-one-out multiplayer mode.
