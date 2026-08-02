/**
 * Prova delle funzioni pure del radar, fuori da Google.
 *
 * Serve a chi adatta il codice: prima di ricaricare i file nell'editor si lancia
 *
 *     node docs/strumenti/radar-opportunita/prova/prova-logica.js
 *
 * e si sa subito se la pulizia dell'HTML, i filtri gratuiti, il prompt e il
 * controllo della risposta si comportano ancora come devono. Non tocca la rete
 * e non chiama Gemini: quello che sta dietro a Google è sostituito da stub.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'apps-script');
const sorgenti = ['00-Configurazione.gs', '01-Fonti.gs', '02-Gemini.gs']
  .map(function (f) { return fs.readFileSync(path.join(DIR, f), 'utf8'); })
  .join('\n');

// Gli unici pezzi di Google che servono a queste funzioni.
global.scriviLog = function () {};
global.PropertiesService = { getScriptProperties: function () { return { getProperty: function () { return null; } }; } };
global.Utilities = { computeDigest: function () { return [1, 2, 255]; }, DigestAlgorithm: {}, Charset: {} };
global.SpreadsheetApp = { getActive: function () { return { getSheetByName: function () { return null; } }; } };

eval(sorgenti);

let falliti = 0;
function prova(nome, condizione) {
  console.log((condizione ? 'OK   ' : 'FAIL ') + nome);
  if (!condizione) falliti++;
}

// --- configurazione: i predefiniti, e il tipo giusto
prova('cfg numerico', cfg('eta_min') === 14 && typeof cfg('eta_min') === 'number');
prova('cfg testuale', cfg('modello') === 'gemini-flash-latest');
prova('budget vuoto a inizio giro', budgetEsaurito() === false);

// --- pulizia dell'HTML
const html = '<html><head><style>a{color:red}</style><script>var x=1;</script></head>' +
             '<body><h1>Bando &amp; avviso</h1><p>Scadenza   30/09/2026</p></body></html>';
const testo = testoDaHtml(html);
prova('via gli script', testo.indexOf('var x') === -1);
prova('via gli stili', testo.indexOf('color:red') === -1);
prova('entità & tradotta', testo.indexOf('Bando & avviso') !== -1);
prova('spazi compressi', testo.indexOf('   ') === -1);

// --- primo filtro gratuito
prova('scarta la pagina corta', valeLaPenaChiedere('poco testo') === false);
prova('scarta la pagina senza parole spia', valeLaPenaChiedere('a'.repeat(500)) === false);
prova('tiene la pagina con un bando', valeLaPenaChiedere('bando ' + 'x'.repeat(500)) === true);

// --- il prompt
const p = costruisciPrompt('testo pagina');
prova('prompt: età presa dalla configurazione', p.indexOf('aged 14 to 35') !== -1);
prova('prompt: chiede TUTTE le opportunità della pagina', p.indexOf('List EVERY opportunity') !== -1);
prova('prompt: l\'elenco vuoto è una risposta legittima', p.indexOf('return an empty list') !== -1);
prova('prompt: regola dei campi vuoti', p.indexOf('leave that field EMPTY') !== -1);
prova('prompt: risposte in italiano imposte', p.indexOf('WRITE EVERY VALUE IN ITALIAN') !== -1);
prova('prompt: nessuna regola extra se non impostata', p.indexOf('ADDITIONAL RULES') === -1);
prova('prompt: il testo della pagina arriva in fondo',
      p.indexOf('--- PAGE TEXT ---') > p.indexOf('WRITE EVERY VALUE IN ITALIAN'));

// --- il controllo sulla risposta del modello
prova('pagina senza opportunità = elenco vuoto', valida({ opportunita: [] }, 'u').length === 0);
prova('risposta malformata = elenco vuoto', valida(null, 'u').length === 0);
prova('scarta le voci senza titolo',
      valida({ opportunita: [{ titolo: '  ' }, { titolo: 'Borsa' }] }, 'u').length === 1);
prova('scarta il titolo-fiume (il modello che riversa mezza pagina)',
      valida({ opportunita: [{ titolo: 'x'.repeat(300) }] }, 'u').length === 0);

const schede = valida({ opportunita: [
  { titolo: 'Borsa di studio', chi_puo: 'under 30' },
  { titolo: 'Servizio civile', entro_quando: '31/12/2099' }
] }, 'https://u/x');
prova('tiene tutte le opportunità della pagina', schede.length === 2);
prova('campi mancanti = vuoti, mai inventati', schede[0].entro_quando === '' && schede[0].quanto_vale === '');
prova('il link è la pagina letta, non un\'invenzione del modello',
      schede[0].link === 'https://u/x' && schede[1].link === 'https://u/x');

const tetto = schemaRisposta().properties.opportunita.maxItems;
let tante = [];
for (let i = 0; i < 20; i++) tante.push({ titolo: 'voce ' + i });
prova('non più di ' + tetto + ' voci per pagina',
      valida({ opportunita: tante }, 'u').length === tetto);


// --- scadenze passate
prova('scarta un bando scaduto', giaScaduta('16/04/2020') === true);
prova('tiene un bando ancora aperto', giaScaduta('31/12/2099') === false);
prova('senza data non si butta niente', giaScaduta('') === false);
prova('data illeggibile: nel dubbio si tiene', giaScaduta('prossimamente') === false);
prova('la voce scaduta non arriva nel foglio',
      valida({ opportunita: [{ titolo: 'Vecchio bando', entro_quando: '01/01/2020' },
                             { titolo: 'Bando aperto', entro_quando: '31/12/2099' }] }, 'u').length === 1);

// --- lo schema della risposta
const s = schemaRisposta();
const voce = s.properties.opportunita.items;
prova('schema: una lista di opportunità', s.properties.opportunita.type === 'array');
prova('schema: cinque campi per voce', Object.keys(voce.properties).length === 5);
prova('schema: tutti i campi obbligatori (se no il modello ne riempie uno solo)',
      voce.required.length === 5);
prova('schema: ordine dei campi dichiarato', voce.propertyOrdering[0] === 'titolo');
prova('schema: niente campo link (il modello se lo inventerebbe)',
      voce.properties.link === undefined);

console.log(falliti === 0 ? '\nTutto a posto.' : '\n' + falliti + ' controlli falliti.');
process.exit(falliti === 0 ? 0 : 1);
