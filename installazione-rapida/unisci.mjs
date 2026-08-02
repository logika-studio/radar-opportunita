/**
 * Mette i sette file di `apps-script/` in un file solo.
 *
 * Perché: incollare otto file nell'editor di Apps Script è la parte più noiosa
 * dell'installazione, ed è quella in cui si sbaglia (un nome storto, un file
 * dimenticato). Con questo ne restano due: `Codice.gs` e `Pannello.html`.
 *
 * I sette file separati restano la versione da leggere e da modificare: questo
 * è un prodotto, si rigenera e non si edita a mano.
 *
 *     node docs/strumenti/radar-opportunita/installazione-rapida/unisci.mjs
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const SORGENTI = join(QUI, '..', 'apps-script');

const ORDINE = [
  '00-Configurazione.gs', '01-Fonti.gs', '02-Gemini.gs', '03-Foglio.gs',
  '04-Radar.gs', '05-Menu.gs', '06-Preparazione.gs'
];

const intestazione = [
  '/**',
  ' * RADAR DELLE OPPORTUNITÀ — tutto il codice in un file solo.',
  ' *',
  ' * Questo file è GENERATO: unisce i sette file di `apps-script/` per rendere',
  ' * l\'installazione due copia-incolla invece di otto. Per capire come è fatto',
  ' * il radar, o per modificarlo, si aprono quelli — sono divisi per come le',
  ' * cose accadono: configurazione, fonti, modello, foglio, giro, menu, setup.',
  ' *',
  ' * Rigenerare con: node installazione-rapida/unisci.mjs',
  ' */',
  ''
].join('\n');

const corpo = ORDINE.map((nome) => {
  const testo = readFileSync(join(SORGENTI, nome), 'utf8').trim();
  const titolo = '/* ' + '='.repeat(68) + '\n   ' + nome + '\n   ' + '='.repeat(68) + ' */';
  return titolo + '\n\n' + testo;
}).join('\n\n\n');

mkdirSync(QUI, { recursive: true });
writeFileSync(join(QUI, 'Codice.gs'), intestazione + '\n' + corpo + '\n', 'utf8');
copyFileSync(join(SORGENTI, 'Pannello.html'), join(QUI, 'Pannello.html'));

const righe = (intestazione + corpo).split('\n').length;
console.log(`Codice.gs scritto (${ORDINE.length} file uniti, ${righe} righe) + Pannello.html copiato.`);
