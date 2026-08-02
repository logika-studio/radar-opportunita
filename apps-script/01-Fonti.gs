/**
 * RADAR DELLE OPPORTUNITÀ — Leggere le fonti.
 *
 * È il punto in cui il programma tocca il mondo di fuori, e quindi il più
 * fragile. Qui dentro stanno anche i due filtri gratuiti: girano sul foglio,
 * non costano niente, e servono a non far arrivare al modello pagine che non
 * valgono nulla.
 */

/**
 * Legge il foglio FONTI e restituisce solo le righe marcate «sì».
 * Com'è fatto (prima riga = intestazione):
 *   A nome   B indirizzo   C attiva? sì/no   D note   E destinatari
 */
function leggiFonti() {
  const righe = tab(TAB_FONTI).getDataRange().getValues();
  righe.shift(); // via l'intestazione

  return righe
    .filter(function (r) {
      const attiva = String(r[2]).toLowerCase().trim();
      return String(r[0]).trim() !== '' &&
             String(r[1]).trim() !== '' &&
             (attiva === 'sì' || attiva === 'si' || attiva === 'sÌ');
    })
    .map(function (r) {
      return { nome: String(r[0]).trim(), url: String(r[1]).trim() };
    });
}

/**
 * Scarica una pagina. Non solleva mai un'eccezione: se il portale non risponde
 * restituisce una stringa vuota e lo scrive nel registro. Una fonte che tace
 * non deve poter fermare le altre.
 */
function scaricaPagina(url) {
  const demo = cfg('html_demo');
  if (demo) return demo;   // modalità dimostrativa: si salta la rete

  try {
    const risposta = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,   // gli errori li gestiamo noi, non Google
      followRedirects: true,
      headers: { 'User-Agent': 'RadarOpportunita/2.0 (progetto PARTECIPA)' }
    });

    const codice = risposta.getResponseCode();
    if (codice !== 200) {
      scriviLog('lettura', url, 'il portale ha risposto ' + codice);
      return '';
    }
    return risposta.getContentText();

  } catch (e) {
    scriviLog('lettura', url, 'non raggiungibile: ' + e.message);
    return '';
  }
}

/**
 * Da HTML a testo leggibile. Nessuna magia: si buttano via script, stili e tag,
 * si comprimono gli spazi e si taglia. Il taglio non è un dettaglio tecnico:
 * quasi tutto il costo di una chiamata dipende da quanto testo le si dà da
 * leggere, e le prime novemila battute di una pagina di bandi contengono già
 * quello che serve. Il resto è quasi sempre menu, piè di pagina e cookie.
 */
function testoDaHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, cfg('max_caratteri_pagina'));
}

/* ----------------------------------------------------------------------
   PRIMO FILTRO GRATUITO — vale la pena chiedere?
   Due controlli che costano zero, fatti prima di spendere una chiamata.
   ---------------------------------------------------------------------- */
function valeLaPenaChiedere(testo) {
  // Una pagina troppo corta non è una pagina di bando: è un errore, un
  // reindirizzamento, o un avviso di manutenzione.
  if (!testo || testo.length < cfg('min_caratteri_pagina')) return false;

  // Se in tutta la pagina non compare nemmeno una parola spia, lì dentro quasi
  // certamente non c'è niente per noi.
  const minuscolo = testo.toLowerCase();
  return PAROLE_SPIA.some(function (p) { return minuscolo.indexOf(p) !== -1; });
}

/* ----------------------------------------------------------------------
   SECONDO FILTRO GRATUITO — la pagina è cambiata dall'ultima volta?
   È il risparmio più grosso di tutti. Un portale pubblica un bando ogni due
   settimane, ma il radar passa ogni lunedì: quasi sempre trova la stessa
   identica pagina di sette giorni prima, e rileggerla al modello costerebbe
   una chiamata per una risposta che abbiamo già.
   Della pagina si tiene solo un'impronta di 32 caratteri, non il testo.
   ---------------------------------------------------------------------- */
function impronta(testo) {
  const byte = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, testo, Utilities.Charset.UTF_8
  );
  // ogni byte va scritto sempre con due cifre, se no 5 e 80 darebbero '5' e '50'
  return byte.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function eCambiata(url, testo) {
  const vecchia = proprieta().getProperty('impronta:' + url);
  return vecchia !== impronta(testo);
}

/**
 * L'impronta si memorizza SOLO quando il modello ha davvero risposto: se la
 * chiamata era fallita non si scrive niente, così al giro dopo quella pagina
 * viene riprovata invece di essere data per già vista.
 */
function ricordaImpronta(url, testo) {
  proprieta().setProperty('impronta:' + url, impronta(testo));
}

/** Costringe il radar a rileggere tutto da zero al prossimo giro. */
function dimenticaImpronte() {
  const p = proprieta();
  const chiavi = Object.keys(p.getProperties())
    .filter(function (k) { return k.indexOf('impronta:') === 0; });

  chiavi.forEach(function (k) { p.deleteProperty(k); });
  scriviLog('manutenzione', 'dimenticaImpronte',
    chiavi.length + ' impronte cancellate: al prossimo giro si rilegge tutto');
  return chiavi.length;
}
