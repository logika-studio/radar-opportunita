/**
 * RADAR DELLE OPPORTUNITÀ — Scrivere nel foglio e nel registro.
 */

/**
 * Che cosa c'è già nel foglio, letto UNA volta sola all'inizio del giro.
 *
 * Il confronto è su link + titolo, non sul solo link: da quando il radar legge
 * le pagine di elenco, dieci bandi diversi arrivano dallo stesso indirizzo, e
 * confrontare solo quello li farebbe sparire tutti tranne il primo.
 */
function chiaviGiaViste() {
  const sh = tab(TAB_OPPORTUNITA);
  const viste = {};
  if (sh.getLastRow() < 2) return viste;

  sh.getRange(2, 3, sh.getLastRow() - 1, 5).getValues()   // C titolo … G link
    .forEach(function (r) {
      viste[chiaveRiga({ link: r[4], titolo: r[0] })] = true;
    });
  return viste;
}

/** La firma di una riga. Minuscole e spazi compressi: lo stesso bando
 *  ripubblicato con una maiuscola diversa non deve tornare come novità. */
function chiaveRiga(scheda) {
  return String(scheda.link) + '|' +
         String(scheda.titolo).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Aggiunge una riga al foglio OPPORTUNITÀ. L'ordine delle colonne conta: il
 * programma scrive contando le posizioni, non i nomi.
 *   A trovato il · B fonte · C titolo · D chi può · E cosa serve
 *   F entro quando · G link · H quanto vale · I stato
 */
function scriviRiga(dati, fonte) {
  tab(TAB_OPPORTUNITA).appendRow([
    new Date(),          // quando lo abbiamo trovato: serve a capire cos'è nuovo
    fonte,               // da quale portale: serve ad accorgersi di chi tace
    dati.titolo,
    dati.chi_puo,
    dati.cosa_serve,
    dati.entro_quando,
    dati.link,
    dati.quanto_vale,
    'da verificare'      // lo stato lo cambia una persona, mai il programma
  ]);
}

/**
 * Il registro. Ogni cosa che non ha funzionato finisce qui, con l'ora e il
 * punto esatto in cui è successa. Non serve a giustificare lo strumento:
 * serve a distinguere due cose che da fuori sembrano uguali — «il radar ha
 * sbagliato» e «la fonte non ha pubblicato niente».
 *
 * Ci finiscono anche i risparmi: sapere quante pagine sono state saltate senza
 * spendere è l'unico modo per accorgersi se i filtri sono troppo severi e
 * stanno buttando via roba buona.
 */
function scriviLog(fase, riferimento, messaggio) {
  try {
    tab(TAB_LOG).appendRow([new Date(), fase, riferimento, messaggio]);
  } catch (e) {
    // Se manca perfino il foglio LOG non si può fare altro che lasciarne
    // traccia nell'esecuzione: non deve comunque fermare il giro.
    console.error('registro non scrivibile: ' + messaggio);
  }
}

/** L'ultima riga del registro che parla di un giro completo: serve alla diagnostica. */
function ultimoGiro() {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  if (!sh || sh.getLastRow() < 2) return null;

  const righe = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  for (let i = righe.length - 1; i >= 0; i--) {
    if (String(righe[i][1]) === 'giro' && String(righe[i][2]) === 'radarEsegui') {
      return { quando: righe[i][0], messaggio: String(righe[i][3]) };
    }
  }
  return null;
}
