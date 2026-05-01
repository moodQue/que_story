## Que - The Mood Djinn

This GitHub Pages site is now structured as a QR-driven scene system.

The public home page is `index.html`. It contains only the Que origin story and does not link to scene pages. Scene pages live at direct URLs like:

```text
/scenes/2026-04-28/serenity.html
```

Scene URLs are meant to be placed in QR codes for live stream moments. A visitor who scans a code lands on that one scene only.

## Folder Structure

```text
index.html                    Origin story only
css/scenes.css                Immersive scene styling
assets/scene-loader.js        Loads scene data from JSON
scenes/scenes.json            Weekly scene config for QR URLs
scenes/scene-template.html    Copy this for new scene pages
scenes/2026-04-28/*.html      Example 12-scene week
qr_codes/{week}/              Generated QR PNG output
scripts/generate_qr_codes.py  Optional QR generator
scripts/static_server.js      Optional local HTTP preview
```

## Scene Rules

Scene pages are isolated:

- No links to other scenes.
- No menus.
- No territory grid.
- No sitemap exposure.
- Every scene page includes `<meta name="robots" content="noindex, nofollow">`.
- The only page navigation is `Return to Origin`, which points back to `index.html`.

`sitemap.xml` includes only the origin page.

## Adding a New Weekly Drop

1. Create a folder for the week:

```text
scenes/YYYY-MM-DD/
```

2. Copy `scenes/scene-template.html` into that folder twelve times and rename each file for its centroid:

```text
scenes/2026-05-05/ember.html
scenes/2026-05-05/pulse.html
scenes/2026-05-05/lumen.html
...
```

3. Add twelve matching objects to `scenes/scenes.json`.

Each object should use this shape:

```json
{
  "week": "2026-05-05",
  "centroid": "ember",
  "title": "Ember",
  "url": "/scenes/2026-05-05/ember.html",
  "image": "/assets/scenes/2026-05-05/ember.jpg",
  "copy": "The short scene text shown after the QR scan.",
  "easter_egg": "/merch/founders-pack.html",
  "merch": "/merch/founders-pack.html",
  "qr": "/qr_codes/2026-05-05/ember.png"
}
```

4. Drop the twelve images into:

```text
assets/scenes/YYYY-MM-DD/
```

5. Generate QR codes:

```powershell
python scripts/generate_qr_codes.py https://your-github-pages-domain
```

This writes PNG files to:

```text
qr_codes/YYYY-MM-DD/
```

The script requires:

```powershell
python -m pip install qrcode[pil]
```

## Weekly Workflow

The fastest weekly loop:

1. Copy the template pages.
2. Add twelve rows to `scenes/scenes.json`.
3. Add twelve image files.
4. Run the QR script.
5. Commit and push to GitHub Pages.

No backend or build step is required.

## Local Preview

Because scene pages fetch `scenes/scenes.json`, preview them over HTTP:

```powershell
node scripts/static_server.js 4173
```

Then open:

```text
http://127.0.0.1:4173/scenes/2026-04-28/ember.html
```
