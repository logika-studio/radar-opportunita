/**
 * RADAR DELLE OPPORTUNITÀ — Preparare il foglio, e capire perché non va.
 *
 * Nella versione del laboratorio queste due cose le faceva una persona: creare
 * i tre fogli con le intestazioni giuste (e sbagliare un accento voleva dire
 * mezz'ora persa), e leggere il codice quando qualcosa non funzionava.
 */

const INTESTAZIONI = {
  FONTI: ['Nome fonte', 'Indirizzo', 'Attiva?', 'Note', 'Destinatari del riepilogo'],
  'OPPORTUNITÀ': ['Trovato il', 'Fonte', 'Titolo', 'Chi può partecipare', 'Cosa serve',
                  'Entro quando', 'Link', 'Quanto vale', 'Stato'],
  LOG: ['Quando', 'Fase', 'Riferimento', 'Che cosa è successo']
};

/**
 * Fonti per partire, tutte provate: rispondono senza login e — soprattutto —
 * senza JavaScript. È il criterio che conta e non è ovvio: il radar legge
 * l'HTML così com'è, non esegue gli script, quindi i portali che costruiscono
 * l'elenco dei bandi nel browser (Sviluppo Campania, il Portale Giovani della
 * Regione) per lui sono pagine vuote. Vanno indicate le PAGINE DI ELENCO
 * AVVISI, non le home.
 */
const FONTI_ESEMPIO = [
  ['Giovani2030 — bandi e opportunità', 'https://giovani2030.it/bandi-e-opportunita/', 'sì',
   'Dipartimento Politiche Giovanili: l\'elenco più ricco, con le scadenze', ''],
  ['Politiche Giovanili — avvisi e bandi', 'https://www.politichegiovanili.gov.it/comunicazione/avvisi-e-bandi/', 'sì',
   'avvisi nazionali, servizio civile', ''],
  ['Agenzia Italiana per la Gioventù', 'https://www.agenziagiovani.it/', 'sì',
   'Erasmus+ e Corpo Europeo di Solidarietà', ''],
  ['Eurodesk Italy — notizie', 'https://www.eurodesk.it/notizie', 'no',
   'mobilità europea: attivala quando ti serve', ''],
  ['Avvisi del mio Comune', '', 'no',
   'il pezzo più locale e più utile: metti qui l\'indirizzo della pagina avvisi', '']
];

/**
 * Crea (o rimette a posto) i tre fogli. Si può eseguire quante volte si vuole:
 * non cancella niente di quello che c'è già, si limita a rimettere le
 * intestazioni al posto giusto e a ricreare quello che manca.
 */
function preparaIlFoglio() {
  const file = SpreadsheetApp.getActive();
  const creati = [];

  [TAB_FONTI, TAB_OPPORTUNITA, TAB_LOG].forEach(function (nome) {
    let sh = file.getSheetByName(nome);
    if (!sh) {
      sh = file.insertSheet(nome);
      creati.push(nome);
    }
    vestiIlFoglio(sh, nome);
  });

  // Se il file era appena nato ha ancora il «Foglio1» vuoto: si toglie di mezzo.
  const primo = file.getSheetByName('Foglio1') || file.getSheetByName('Sheet1');
  if (primo && file.getSheets().length > 3 && primo.getLastRow() === 0) {
    file.deleteSheet(primo);
  }

  // Le fonti d'esempio si mettono solo la prima volta, su un foglio vuoto.
  const fonti = file.getSheetByName(TAB_FONTI);
  if (fonti.getLastRow() < 2) {
    fonti.getRange(2, 1, FONTI_ESEMPIO.length, 5).setValues(FONTI_ESEMPIO);
  }

  file.setActiveSheet(fonti);
  return creati;
}

/** Intestazioni, larghezze, blocco della prima riga, menu a tendina del sì/no. */
function vestiIlFoglio(sh, nome) {
  const teste = INTESTAZIONI[nome];

  sh.getRange(1, 1, 1, teste.length)
    .setValues([teste])
    .setFontWeight('bold')
    .setBackground('#1C2E6E')      // il navy del progetto PARTECIPA
    .setFontColor('#FFFFFF')
    .setVerticalAlignment('middle');

  sh.setFrozenRows(1);
  sh.setRowHeight(1, 34);

  if (nome === TAB_FONTI) {
    sh.setColumnWidths(1, 5, 220);
    // Il sì/no come menu a tendina: è il campo che si sbaglia più spesso, e
    // una fonte scritta «Si» invece che «sì» semplicemente non viene letta.
    const regola = SpreadsheetApp.newDataValidation()
      .requireValueInList(['sì', 'no'], true)
      .setAllowInvalid(false)
      .setHelpText('Solo «sì» o «no»: le fonti con «no» vengono saltate.')
      .build();
    sh.getRange(2, 3, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(regola);
  }

  if (nome === TAB_OPPORTUNITA) {
    sh.setColumnWidth(1, 140);   // trovato il
    sh.setColumnWidth(2, 180);   // fonte
    sh.setColumnWidth(3, 320);   // titolo
    sh.setColumnWidths(4, 3, 260);
    sh.setColumnWidth(7, 260);   // link
    sh.setColumnWidth(8, 160);
    sh.setColumnWidth(9, 130);   // stato
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), 9).setWrap(true);
  }

  if (nome === TAB_LOG) {
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(2, 110);
    sh.setColumnWidth(3, 300);
    sh.setColumnWidth(4, 520);
  }
}

/**
 * La diagnostica. Risponde alla sola domanda che conta quando qualcosa non va:
 * «a che punto si è rotto?». Sette controlli, nell'ordine in cui le cose
 * accadono davvero: prima i fogli, poi la chiave, poi le fonti, poi la sveglia.
 */
function diagnostica() {
  const file = SpreadsheetApp.getActive();
  const esiti = [];

  [TAB_FONTI, TAB_OPPORTUNITA, TAB_LOG].forEach(function (nome) {
    const sh = file.getSheetByName(nome);
    esiti.push({
      ok: !!sh,
      voce: 'foglio ' + nome,
      dettaglio: sh ? 'presente' : 'manca — usa «Prepara il foglio»'
    });
  });

  esiti.push({
    ok: chiaveApiPresente(),
    voce: 'chiave di Gemini',
    dettaglio: chiaveApiPresente() ? 'impostata' : 'manca — aprila da «Impostazioni»'
  });

  let fonti = [];
  try { fonti = leggiFonti(); } catch (e) { /* il foglio manca: già segnalato sopra */ }
  esiti.push({
    ok: fonti.length > 0,
    voce: 'fonti attive',
    dettaglio: fonti.length
      ? fonti.length + ' (' + fonti.map(function (f) { return f.nome; }).join(', ') + ')'
      : 'nessuna riga con «sì» nel foglio FONTI'
  });

  let quantiDestinatari = 0;
  try { quantiDestinatari = destinatari().split(',').length; } catch (e) { /* nessuno */ }
  esiti.push({
    ok: quantiDestinatari > 0,
    voce: 'destinatari del riepilogo',
    dettaglio: quantiDestinatari
      ? quantiDestinatari + ' indirizzi (colonna E del foglio FONTI)'
      : 'nessun indirizzo nella colonna E del foglio FONTI'
  });

  const accesa = svegliaAttiva();
  esiti.push({
    ok: accesa,
    voce: 'sveglia settimanale',
    dettaglio: accesa
      ? 'accesa: ' + nomeGiorno(cfg('giorno_sveglia')) + ' verso le ' + cfg('ora_sveglia')
      : 'spenta — il radar gira solo quando lo lanci a mano'
  });

  const ultimo = ultimoGiro();
  esiti.push({
    ok: !!ultimo,
    voce: 'ultimo giro',
    dettaglio: ultimo
      ? Utilities.formatDate(new Date(ultimo.quando), fusoOrario(), 'd/MM/yyyy HH:mm') +
        ' — ' + ultimo.messaggio
      : 'mai eseguito'
  });

  return esiti;
}
