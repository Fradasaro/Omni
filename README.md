# Omni 2.4

Web app (PWA) per pianificare, registrare e scambiare i pasti. Nessun server, nessuna dipendenza: HTML, CSS e JavaScript puri. I dati restano nel `localStorage` del dispositivo. L'unica chiamata esterna è lo scanner, che invia a Open Food Facts solo il codice a barre.

## Avvio in locale

Il service worker funziona solo via `http(s)`, quindi servi la cartella invece di aprire il file:

```bash
cd omni
python3 -m http.server 8000
# poi apri http://localhost:8000
```

Aperta con doppio clic (`file://`) l'app funziona lo stesso, ma senza modalità offline.

## Struttura

| File | Contenuto |
| --- | --- |
| `index.html` | Guscio della pagina (header, navigazione, contenitori) |
| `css/app.css` | Design system: token chiaro/scuro, componenti |
| `js/foods.js` | Database alimenti (~190 voci) e preset dei pasti liberi |
| `js/content.js` | Note del coach, linee guida, disclaimer |
| `js/core.js` | Stato, salvataggio, migrazione dati, calcoli (target, scambi, ricerca) |
| `js/planner.js` | Calcolo dei grammi del piano (minimi quadrati non negativi) |
| `js/ui.js` | Componenti condivisi: azioni, toast con Annulla, sheet, ricerca alimenti |
| `js/view-*.js` | Le cinque sezioni: Oggi, Piano, Scambi, Spesa, Profilo |
| `js/scanner.js` | Codice a barre → alimento (fotocamera con `BarcodeDetector` o, su Safari/iPhone, ZXing; oppure cifre a mano; dati Open Food Facts) |
| `js/vendor/zxing.min.js` | Libreria ZXing (`@zxing/library` 0.21.3, build UMD), caricata solo quando si apre lo scanner |
| `js/recipes.js` | Ricette divise in porzioni, aggiunte al diario come ingredienti |
| `js/reminders.js` | Promemoria come file calendario `.ics` (pasti, acqua, pesata) |
| `js/wizard.js` | Primo avvio in tre passi |
| `js/main.js` | Avvio e navigazione |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installazione come app e funzionamento offline |

## Note operative

- **Cambiare nome all'app**: modifica `APP_NAME` in `js/core.js`, poi `name`/`short_name` in `manifest.webmanifest` e `<title>`/`apple-mobile-web-app-title` in `index.html`. Rigenera le icone in `icons/`.
- **Nuova versione online**: aumenta `CACHE_VERSION` in `sw.js`, altrimenti chi ha l'app installata continua a vedere i file vecchi.
- **Dati della versione precedente**: al primo avvio vengono migrati automaticamente (chiave `omni_v1_state` e precedenti). La chiave vecchia non viene cancellata.
- **Database alimenti**: 136 alimenti di base verificati sulle tabelle CREA/INRAN (campo `src`); i prodotti confezionati usano valori medi da etichetta. Citare la fonte CREA è obbligatorio se si riproducono i dati. Non cambiare mai gli `id` esistenti: diari e piani salvati li usano.

## Licenze di terze parti

Font Plus Jakarta Sans (SIL OFL 1.1), icone Lucide (ISC) e lettore di codici a barre ZXing (Apache 2.0): vedi la cartella `licenses/`.
