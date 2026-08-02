/**
 * RADAR DELLE OPPORTUNITÀ — tutto il codice in un file solo.
 *
 * Questo file è GENERATO: unisce i sette file di `apps-script/` per rendere
 * l'installazione due copia-incolla invece di otto. Per capire come è fatto
 * il radar, o per modificarlo, si aprono quelli — sono divisi per come le
 * cose accadono: configurazione, fonti, modello, foglio, giro, menu, setup.
 *
 * Rigenerare con: node installazione-rapida/unisci.mjs
 */

/* ====================================================================
   00-Configurazione.gs
   ==================================================================== */

/**
 * RADAR DELLE OPPORTUNITÀ — Configurazione.
 *
 * Nella versione del laboratorio i numeri che governano il radar (l'età, il
 * modello, il tetto delle chiamate) erano costanti scritte nel codice: per
 * cambiarne uno bisognava aprire l'editor e sapere dove mettere le mani.
 *
 * Qui non più. I valori qui sotto sono soltanto i PUNTI DI PARTENZA: chi copia
 * il foglio li cambia dal pannello «Impostazioni», e il codice resta com'è.
 * È la differenza fra uno strumento che si usa e uno strumento che si legge.
 */

/** I tre fogli del file. Cambiarli qui significa doverli rinominare anche nel foglio. */
const TAB_FONTI       = 'FONTI';
const TAB_OPPORTUNITA = 'OPPORTUNITÀ';
const TAB_LOG         = 'LOG';

/**
 * I valori di partenza. Ogni voce può essere sovrascritta dal pannello: quello
 * che l'utente salva finisce nelle Proprietà del progetto, sotto 'cfg.<nome>'.
 * Il tipo del valore qui sotto decide come viene riletto (numero o testo).
 */
const PREDEFINITI = {
  // Chi ci interessa. È l'unico criterio di selezione, e passa nel prompt.
  eta_min: 14,
  eta_max: 35,

  // Il modello che legge le pagine. Se arriva un 429 anche dopo i ritentativi,
  // 'gemini-flash-lite-latest' ha la quota più larga.
  // I nomi con '-latest' seguono l'ultima versione senza dover cambiare niente
  // qui dentro: per uno strumento che deve girare da solo per mesi vale più
  // della riproducibilità di un numero di versione fisso.
  modello: 'gemini-flash-latest',

  // Tetto duro di chiamate per ogni giro: meglio un giro incompleto, con le
  // fonti rimaste rimandate alla settimana dopo, che una quota bruciata a metà.
  max_chiamate_per_giro: 12,

  // Il riepilogo parte da solo? Di norma no: resta nelle bozze finché una
  // persona non lo apre, e quella persona è ciò che rende adottabile lo
  // strumento in un ufficio pubblico. Chi ha bisogno del contrario può
  // metterlo a «sì» dal pannello, sapendo che si assume le scadenze che
  // nessuno ha controllato.
  invio_automatico: 'no',

  // Quando si sveglia il radar. Giorno in inglese maiuscolo (è il nome che usa
  // Google), ora in formato 0–23.
  giorno_sveglia: 'MONDAY',
  ora_sveglia: 8,

  // Regole aggiuntive del prompt. È il campo che rende il radar adattabile a un
  // territorio diverso senza toccare una riga di codice: qui dentro si scrive
  // per esempio «tieni solo le opportunità del Vallo di Diano», oppure si
  // aggiunge un esempio negativo dopo aver visto un errore. Una regola alla
  // volta, e si riprova: due insieme non dicono quale ha funzionato.
  regole_extra: '',

  // Quanto testo si dà da leggere al modello. Sotto il minimo non è una pagina
  // di bando; sopra il massimo si taglia, perché quasi tutto il costo di una
  // chiamata dipende da quanto testo le si passa.
  min_caratteri_pagina: 400,
  max_caratteri_pagina: 9000,
  // Una pagina di elenco può portare otto opportunità: la risposta deve
  // starci dentro, se no arriva troncata e non si scrive niente.
  max_token_risposta: 4000,

  // Ritentativi: si riprova poche volte, aspettando ogni volta il doppio.
  tentativi_max: 3,
  attesa_primo_ritentativo: 2000,

  // Quanto si aspetta fra una chiamata riuscita e la successiva. Il piano
  // gratuito non conta solo le richieste al giorno: conta anche quante ne
  // arrivano al minuto, e quel tetto è basso. Quattro secondi tengono il ritmo
  // ampiamente sotto; un giro da dodici chiamate resta comunque sotto il
  // minuto, dentro i sei che Google concede a uno script.
  pausa_fra_chiamate: 4000,

  // Modalità dimostrativa: se qui dentro c'è del testo, il radar non esce in
  // rete e lavora su quello. Serve quando la connessione non regge — in aula
  // succede — e per provare tutto il giro senza dipendere da un portale.
  html_demo: ''
};

/**
 * Le parole che fanno sospettare che in una pagina ci sia un'opportunità.
 * È un filtro grezzo e gratuito, fatto prima di disturbare il modello: deve
 * scartare solo l'ovvio, non fare il lavoro del modello. Nel dubbio, una
 * parola in più.
 */
const PAROLE_SPIA = [
  'bando', 'avviso', 'scadenz', 'domand', 'candidatur', 'concors',
  'tirocin', 'borsa', 'finanziament', 'contribut', 'opportunit', 'iscrizion'
];

/** Le proprietà del progetto: è lì che vivono la chiave e la configurazione. */
function proprieta() {
  return PropertiesService.getScriptProperties();
}

/**
 * Legge un valore di configurazione. Se l'utente non lo ha mai toccato,
 * restituisce il valore di partenza. Il tipo lo decide il predefinito: se
 * quello è un numero, quello che torna è un numero — anche se nelle proprietà
 * è per forza salvato come testo.
 */
function cfg(nome) {
  const predefinito = PREDEFINITI[nome];
  const salvato = proprieta().getProperty('cfg.' + nome);

  if (salvato === null || salvato === '') return predefinito;
  if (typeof predefinito === 'number') {
    const n = Number(salvato);
    return isNaN(n) ? predefinito : n;
  }
  return salvato;
}

/** Salva un gruppo di valori. Quelli uguali al predefinito si cancellano, così
 *  le proprietà restano pulite e si vede a colpo d'occhio cosa è stato cambiato. */
function salvaConfigurazione(valori) {
  const p = proprieta();
  Object.keys(valori).forEach(function (nome) {
    if (!(nome in PREDEFINITI)) return;         // niente chiavi inventate
    const valore = String(valori[nome]).trim();
    if (valore === '' || valore === String(PREDEFINITI[nome])) {
      p.deleteProperty('cfg.' + nome);
    } else {
      p.setProperty('cfg.' + nome, valore);
    }
  });
}

/** Tutta la configurazione com'è adesso — è quello che il pannello mostra. */
function configurazioneCorrente() {
  const attuale = {};
  Object.keys(PREDEFINITI).forEach(function (nome) { attuale[nome] = cfg(nome); });
  return attuale;
}

/**
 * La chiave di Gemini non sta nel codice e non sta nel foglio: sta nelle
 * proprietà del progetto, che non vengono copiate quando qualcuno duplica il
 * file. Chi copia il radar deve mettere la propria — ed è giusto così.
 */
function chiaveApi() {
  const k = proprieta().getProperty('GEMINI_API_KEY');
  if (!k) {
    throw new Error(
      'Manca la chiave di Gemini. Menu «🛰️ Radar» → «Impostazioni» e incollala lì.'
    );
  }
  return k;
}

function salvaChiaveApi(chiave) {
  const pulita = String(chiave || '').trim();
  if (!pulita) throw new Error('La chiave è vuota.');
  if (pulita.length < 20) throw new Error('Questa non sembra una chiave: è troppo corta.');
  proprieta().setProperty('GEMINI_API_KEY', pulita);
}

function chiaveApiPresente() {
  return !!proprieta().getProperty('GEMINI_API_KEY');
}

/** Prende un foglio per nome, con un errore leggibile se non c'è. */
function tab(nome) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!sh) {
    throw new Error(
      'Manca il foglio «' + nome + '». Menu «🛰️ Radar» → «Prepara il foglio».'
    );
  }
  return sh;
}

/**
 * A chi va la bozza. Nessun indirizzo è scritto nel codice, di proposito: sono
 * dati di persone, e il codice si copia e si manda in giro. Stanno nel foglio
 * FONTI, colonna E — così l'ufficio può aggiungere o togliere qualcuno senza
 * aprire l'editor.
 */
function destinatari() {
  const righe = tab(TAB_FONTI).getRange('E2:E').getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (v) { return v.indexOf('@') > 0; });

  if (!righe.length) {
    throw new Error('Nessun destinatario: scrivi almeno un indirizzo nel foglio FONTI, colonna E.');
  }
  return righe.join(',');
}

/* Contatore delle chiamate del giro in corso. Si azzera da solo a ogni
   esecuzione: le variabili come questa non sopravvivono alla fine del programma. */
var chiamateFatte = 0;

function budgetEsaurito() {
  return chiamateFatte >= cfg('max_chiamate_per_giro');
}


/* ====================================================================
   01-Fonti.gs
   ==================================================================== */

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


/* ====================================================================
   02-Gemini.gs
   ==================================================================== */

/**
 * RADAR DELLE OPPORTUNITÀ — La selezione e l'estrazione.
 *
 * Qui c'è l'unico punto del programma che spende: ogni volta che si passa di
 * qui, se ne va una chiamata del piano gratuito.
 */

/**
 * Il prompt. Due cose da sapere prima di metterci le mani.
 *
 * PERCHÉ È IN INGLESE. Le istruzioni sono scritte in inglese perché è la
 * lingua in cui questi modelli sono addestrati meglio a *seguire regole*: sul
 * rispetto dei vincoli («lascia vuoto», «rispondi solo con») la differenza è
 * piccola ma va in quella direzione. Il testo da leggere resta italiano e le
 * risposte devono essere italiane: per questo c'è una riga in maiuscolo che lo
 * impone: senza, il modello tende a rispondere nella lingua in cui gli si
 * parla, e nel foglio arriverebbero titoli in inglese.
 *
 * PERCHÉ È CORTO. Ogni regola in più costa precisione su tutte le altre. Le
 * regole che si aggiungono strada facendo non si scrivono qui — si scrivono
 * nel pannello «Impostazioni», campo «regole aggiuntive» (in italiano: il
 * modello le capisce lo stesso), e finiscono in coda. Una alla volta, e si
 * riprova: due insieme non dicono quale ha funzionato.
 */
function costruisciPrompt(testo) {
  const righe = [
    'You are an assistant to an Italian public office for youth policy.',
    '',
    'The text below is a web page from an Italian public body. It may list SEVERAL',
    'opportunities (it is often an index of calls), or just one, or none at all.',
    '',
    'List EVERY opportunity aimed at people aged ' + cfg('eta_min') + ' to ' + cfg('eta_max') + ':',
    'grants, public calls, competitions, internships, scholarships, training courses,',
    'civil service, EU mobility. Maximum ' + MAX_OPPORTUNITA_PER_PAGINA + ' items, most relevant first.',
    '',
    'IGNORE: municipal ordinances, road and traffic notices, taxes, public procurement,',
    'notices addressed to businesses or to all citizens with no age requirement,',
    'administrative news, navigation menus, cookie banners, newsletter boxes.',
    '',
    'If the page contains no opportunity at all, return an empty list. An empty list',
    'is a perfectly good answer: it means the page had nothing for us today.',
    '',
    'For each opportunity fill these fields, and NOTHING else — never write a field',
    'name or a value inside another field:',
    '  titolo         one short clear line naming that single opportunity',
    '  chi_puo        who can apply',
    '  cosa_serve     requirements and documents needed',
    '  entro_quando   the deadline, as DD/MM/YYYY',
    '  quanto_vale    amount or benefit',
    '',
    'WRITE EVERY VALUE IN ITALIAN, even though these instructions are in English,',
    'in plain language, with no bureaucratic wording.',
    '',
    'THE RULE THAT OUTRANKS EVERY OTHER RULE:',
    'if a value is not written explicitly in the page, leave that field EMPTY.',
    'Do not infer it, do not estimate it, do not round it, do not derive it from',
    'context, and never turn a vague phrase ("prossimamente", "fino a esaurimento',
    'fondi") into a date. An empty cell gets noticed; a wrong deadline does not.'
  ];

  const extra = String(cfg('regole_extra')).trim();
  if (extra) {
    righe.push('',
      'ADDITIONAL RULES FROM THIS OFFICE (they may be written in Italian — follow them literally):',
      extra);
  }

  righe.push('', '--- PAGE TEXT ---', testo);
  return righe.join('\n');
}

/**
 * È già passata? Le pagine di elenco tengono i bandi chiusi per mesi, e una
 * riga con una scadenza di aprile letta ad agosto non è un'informazione: è
 * rumore che fa perdere fiducia in tutte le altre.
 *
 * Si scarta SOLO quando la data c'è ed è leggibile. Campo vuoto o formato
 * strano vogliono dire «non lo sappiamo», e nel dubbio la riga resta: la
 * decide una persona. Vale la stessa regola dei campi vuoti — non si inventa
 * niente, nemmeno per togliere.
 */
function giaScaduta(entroQuando) {
  const m = String(entroQuando || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return false;

  const giorno = Number(m[1]), mese = Number(m[2]), anno = Number(m[3]);
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return false;

  // Fino alla fine del giorno di scadenza il bando è ancora aperto.
  const scadenza = new Date(anno, mese - 1, giorno, 23, 59, 59);
  const oggi = new Date();
  return scadenza.getTime() < oggi.getTime();
}

/** Quante opportunità al massimo si prendono da una pagina sola. Le pagine di
 *  elenco ne contengono dieci o venti: oltre una certa soglia si sta solo
 *  allungando la risposta, e la risposta ha un tetto. */
const MAX_OPPORTUNITA_PER_PAGINA = 8;

/**
 * La forma della risposta, dichiarata al modello invece che sperata.
 *
 * Due dettagli che sembrano burocrazia e invece hanno risolto un difetto vero:
 * `required` su tutti i campi (senza, il modello ne riempiva uno solo,
 * infilandoci dentro anche gli altri: «titolo: … quanto_vale: … chi_puo: …»)
 * e `propertyOrdering`, che gli dice in che ordine scriverli — questi modelli
 * generano un campo alla volta, e l'ordine cambia quello che scrivono.
 *
 * Il link non è fra i campi di proposito: dal testo i tag HTML sono già stati
 * tolti, quindi il modello un indirizzo non ce l'ha e se glielo si chiede se
 * lo inventa. Il link lo mette il programma, ed è quello della pagina letta.
 */
function schemaRisposta() {
  return {
    type: 'object',
    properties: {
      opportunita: {
        type: 'array',
        maxItems: MAX_OPPORTUNITA_PER_PAGINA,
        items: {
          type: 'object',
          properties: {
            titolo:       { type: 'string' },
            chi_puo:      { type: 'string' },
            cosa_serve:   { type: 'string' },
            entro_quando: { type: 'string' },
            quanto_vale:  { type: 'string' }
          },
          propertyOrdering: ['titolo', 'chi_puo', 'cosa_serve', 'entro_quando', 'quanto_vale'],
          required: ['titolo', 'chi_puo', 'cosa_serve', 'entro_quando', 'quanto_vale']
        }
      }
    },
    required: ['opportunita']
  };
}

/* ----------------------------------------------------------------------
   I RITENTATIVI — perché un intoppo non deve costare il giro intero.

   Quando il servizio risponde 429 («troppe richieste») o 503 («torna fra
   poco») non è successo niente di grave: sta chiedendo di rallentare. Se il
   programma si arrendesse al primo no, il lunedì mattina il foglio resterebbe
   vuoto per una scortesia di due secondi; se riprovasse subito e all'infinito
   brucerebbe la quota. La via di mezzo è riprovare poche volte, aspettando
   ogni volta il doppio.

   La distinzione che conta: si riprova SOLO per gli errori temporanei. Un 400
   o un 403 vogliono dire che la richiesta è sbagliata o la chiave non è
   valida — riprovare non la farebbe diventare giusta.
   ---------------------------------------------------------------------- */
function chiamaConRitentativi(endpoint, opzioni, riferimento) {
  const tentativiMax = cfg('tentativi_max');
  let attesa = cfg('attesa_primo_ritentativo');

  for (let tentativo = 1; tentativo <= tentativiMax; tentativo++) {
    let risposta;
    try {
      risposta = UrlFetchApp.fetch(endpoint, opzioni);
    } catch (e) {
      // La rete è caduta a metà richiesta: è temporaneo quanto un 503.
      if (tentativo === tentativiMax) {
        scriviLog('modello', riferimento,
          'rete non raggiungibile dopo ' + tentativiMax + ' tentativi: ' + e.message);
        return null;
      }
      Utilities.sleep(attesa);
      attesa = attesa * 2;
      continue;
    }

    const codice = risposta.getResponseCode();
    if (codice === 200) return risposta;

    // Temporanei: vale la pena aspettare e riprovare.
    if (codice === 429 || codice >= 500) {
      if (tentativo === tentativiMax) {
        scriviLog('modello', riferimento,
          'risposta ' + codice + ' anche al tentativo ' + tentativiMax +
          ': quota probabilmente esaurita per oggi, si riprende al prossimo giro');
        return null;
      }
      scriviLog('modello', riferimento,
        'risposta ' + codice + ', aspetto ' + (attesa / 1000) +
        's e riprovo (tentativo ' + tentativo + ' di ' + tentativiMax + ')');
      Utilities.sleep(attesa);
      attesa = attesa * 2;   // backoff: si raddoppia l'attesa, non si martella
      continue;
    }

    // Definitivi: riprovare non cambierebbe niente e costerebbe quota.
    scriviLog('modello', riferimento,
      'risposta ' + codice + ' — errore non temporaneo, non riprovo. ' +
      estraiMessaggioErrore(risposta));
    return null;
  }
  return null;
}

/** Il messaggio d'errore di Google, quando c'è: senza, un 400 non dice niente. */
function estraiMessaggioErrore(risposta) {
  try {
    const corpo = JSON.parse(risposta.getContentText());
    return (corpo.error && corpo.error.message) ? corpo.error.message : '';
  } catch (e) {
    return '';
  }
}

/**
 * La chiamata al modello. Tre accorgimenti che valgono più di tutto il resto:
 *  - lo schema della risposta: si dichiara il formato invece di sperarlo;
 *  - temperatura 0: la risposta più prevedibile possibile. Qui la fantasia non
 *    serve a niente — anzi, è esattamente il problema;
 *  - un tetto a quanto può scrivere: una risposta che scappa di mano non può
 *    costare cara.
 *
 * Restituisce sempre due informazioni distinte, che sembrano la stessa ma non
 * lo sono:
 *   riuscita — il modello ha risposto? (decide se ricordare l'impronta)
 *   schede   — quello che ha risposto vale delle righe nel foglio?
 * Una pagina senza opportunità è una chiamata RIUSCITA con elenco vuoto: la
 * risposta l'abbiamo avuta, ed è «qui oggi non c'è niente per noi».
 */
function chiediAGemini(testo, url) {
  if (budgetEsaurito()) return { riuscita: false, schede: [] };

  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/'
                 + cfg('modello') + ':generateContent';

  const opzioni = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': chiaveApi() },  // la chiave non finisce nell'URL
    payload: JSON.stringify({
      contents: [{ parts: [{ text: costruisciPrompt(testo) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: schemaRisposta(),
        maxOutputTokens: cfg('max_token_risposta'),
        // I modelli recenti "ragionano" prima di rispondere, e quel ragionamento
        // consuma lo stesso tetto della risposta: con il livello alto, su una
        // pagina lunga, i token finiscono nel ragionamento e la risposta arriva
        // troncata (nel registro: «risposta troncata»). Qui non serve pensare
        // molto — serve leggere e copiare cinque campi senza inventarli.
        thinkingConfig: { thinkingLevel: 'low' }
      }
    }),
    muteHttpExceptions: true
  };

  chiamateFatte = chiamateFatte + 1;   // si conta il tentativo, non il successo
  const risposta = chiamaConRitentativi(endpoint, opzioni, url);
  if (!risposta) return { riuscita: false, schede: [] };

  try {
    const grezzo = JSON.parse(risposta.getContentText());

    // Se il modello si è fermato perché ha finito lo spazio, la risposta è
    // troncata e il JSON non si chiude: meglio saperlo con un messaggio chiaro.
    const motivo = grezzo.candidates && grezzo.candidates[0] &&
                   grezzo.candidates[0].finishReason;
    if (motivo === 'MAX_TOKENS') {
      scriviLog('modello', url,
        'risposta troncata: alzare «lunghezza massima della risposta» nelle impostazioni');
      return { riuscita: true, schede: [] };
    }

    const testoRisposta = grezzo.candidates[0].content.parts[0].text;
    return { riuscita: true, schede: valida(JSON.parse(testoRisposta), url) };

  } catch (e) {
    // Capita: il modello risponde in un formato inatteso. Si scarta la pagina,
    // si annota, e il giro continua. Non si indovina mai il contenuto mancante.
    scriviLog('modello', url, 'risposta non leggibile: ' + e.message);
    return { riuscita: false, schede: [] };
  }
}

/**
 * Il controllo che il programma fa sulla risposta, prima di fidarsi.
 * Non verifica se il contenuto è VERO — quello lo fanno le persone, quando
 * controllano alla fonte. Verifica che abbia la forma giusta, butta via le
 * voci senza titolo e taglia i titoli-fiume: quando il modello sbaglia, di
 * solito sbaglia riversando mezza pagina nel primo campo, e una riga così nel
 * foglio è peggio di nessuna riga.
 */
function valida(risposta, url) {
  const elenco = (risposta && risposta.opportunita) || [];
  const campo = function (v) {
    return (v === undefined || v === null) ? '' : String(v).trim();
  };

  return elenco
    .map(function (o) {
      return {
        titolo:       campo(o.titolo),
        chi_puo:      campo(o.chi_puo),
        cosa_serve:   campo(o.cosa_serve),
        entro_quando: campo(o.entro_quando),
        quanto_vale:  campo(o.quanto_vale),
        link:         url          // il link è la pagina letta, non un'invenzione
      };
    })
    .filter(function (s) {
      if (!s.titolo) return false;
      if (s.titolo.length > 220) {                       // titolo-fiume: risposta sfuggita
        scriviLog('modello', url, 'scartata una voce col titolo lungo ' + s.titolo.length + ' caratteri');
        return false;
      }
      if (giaScaduta(s.entro_quando)) {
        scriviLog('scadute', url, 'scartata «' + s.titolo.slice(0, 60) + '»: scaduta il ' + s.entro_quando);
        return false;
      }
      return true;
    })
    .slice(0, MAX_OPPORTUNITA_PER_PAGINA);
}

/* ----------------------------------------------------------------------
   QUALI MODELLI PUÒ USARE QUESTA CHIAVE.

   I nomi dei modelli cambiano più in fretta di qualunque documentazione, e
   non sono gli stessi per tutti: due chiavi gratuite create a un anno di
   distanza vedono elenchi diversi. Scriverne uno nel codice significa
   condannare qualcuno a un 404 senza capire perché.
   Quindi non si indovina: si chiede a Google che cosa questa chiave può
   usare davvero, e la tendina del pannello mostra quello.
   ---------------------------------------------------------------------- */

/** I modelli che consigliamo, nell'ordine. Chi sta in cima alla tendina. */
const MODELLI_CONSIGLIATI = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

/**
 * Chiede a Google l'elenco dei modelli della chiave e tiene solo quelli buoni
 * per questo lavoro: leggere testo e restituire cinque campi. Fuori tutto ciò
 * che serve ad altro (immagini, voce, audio dal vivo, embedding) e i modelli
 * grossi, che su un piano gratuito finiscono la quota in mezza giornata.
 */
function modelliUtilizzabili() {
  try {
    const risposta = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
      { headers: { 'x-goog-api-key': chiaveApi() }, muteHttpExceptions: true }
    );
    if (risposta.getResponseCode() !== 200) {
      return { ok: false, modelli: MODELLI_CONSIGLIATI, messaggio: 'elenco non disponibile: uso quelli consigliati' };
    }

    const elenco = (JSON.parse(risposta.getContentText()).models || [])
      .filter(function (m) {
        return (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1;
      })
      .map(function (m) { return String(m.name).replace('models/', ''); })
      .filter(function (n) {
        if (n.indexOf('flash') === -1) return false;               // solo i leggeri
        return !/image|tts|audio|live|native|embedding|thinking|omni/.test(n);
      });

    // I consigliati per primi (se ci sono davvero), poi tutto il resto.
    const inCima = MODELLI_CONSIGLIATI.filter(function (n) { return elenco.indexOf(n) !== -1; });
    const resto = elenco.filter(function (n) { return inCima.indexOf(n) === -1; }).sort();

    const finale = inCima.concat(resto);
    return finale.length
      ? { ok: true, modelli: finale, messaggio: finale.length + ' modelli disponibili per questa chiave' }
      : { ok: false, modelli: MODELLI_CONSIGLIATI, messaggio: 'nessun modello leggero trovato: uso quelli consigliati' };

  } catch (e) {
    return { ok: false, modelli: MODELLI_CONSIGLIATI, messaggio: e.message };
  }
}

/**
 * La prova della chiave: una chiamata sola, su un testo finto, per sapere
 * subito se la chiave è valida — invece di scoprirlo lunedì mattina davanti a
 * un foglio vuoto. Non tocca il registro e non scrive righe.
 */
function provaLaChiave() {
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/'
                 + cfg('modello') + ':generateContent';
  try {
    const risposta = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': chiaveApi() },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: 'Rispondi con la parola: pronto' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10 }
      }),
      muteHttpExceptions: true
    });

    const codice = risposta.getResponseCode();
    if (codice === 200) return { ok: true, messaggio: 'la chiave funziona e il modello risponde' };
    if (codice === 400 || codice === 403) {
      return { ok: false, messaggio: 'chiave rifiutata (' + codice + '). ' + estraiMessaggioErrore(risposta) };
    }
    if (codice === 404) {
      return { ok: false, messaggio: 'il modello «' + cfg('modello') + '» non esiste o non è disponibile per questa chiave' };
    }
    if (codice === 429) {
      return { ok: false, messaggio: 'quota esaurita per adesso: la chiave è valida, ma va lasciata respirare' };
    }
    return { ok: false, messaggio: 'risposta inattesa: ' + codice + ' ' + estraiMessaggioErrore(risposta) };

  } catch (e) {
    return { ok: false, messaggio: e.message };
  }
}


/* ====================================================================
   03-Foglio.gs
   ==================================================================== */

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


/* ====================================================================
   04-Radar.gs
   ==================================================================== */

/**
 * RADAR DELLE OPPORTUNITÀ — Il giro, la bozza, la sveglia.
 */

/**
 * Il giro completo: fonti → pagine → filtri gratuiti → modello → foglio → bozza.
 *
 * L'ordine dei controlli non è casuale ed è la parte più importante di tutto
 * il file: PRIMA si scarta tutto quello che si può scartare gratis, e solo su
 * quello che resta si spende una chiamata. Ogni riga che compare prima di
 * `chiediAGemini` è una riga che fa risparmiare.
 */
function radarEsegui() {
  const fonti = leggiFonti();
  if (!fonti.length) {
    scriviLog('giro', 'radarEsegui', 'nessuna fonte attiva: niente da fare');
    return 0;
  }

  const giaViste = chiaviGiaViste();   // una lettura sola per tutto il giro
  const nuove = [];
  let risparmiate = 0;

  for (const fonte of fonti) {

    // Filtro 0 — il budget del giro. Si controlla PRIMA di ogni fonte: meglio
    // un giro incompleto, con le fonti rimaste rimandate alla settimana dopo,
    // che una quota esaurita a metà e nessuna bozza preparata.
    if (budgetEsaurito()) {
      scriviLog('giro', 'budget',
        'raggiunto il tetto di ' + cfg('max_chiamate_per_giro') +
        ' chiamate: le fonti rimaste si leggeranno al prossimo giro');
      break;
    }

    const html = scaricaPagina(fonte.url);
    if (!html) continue;               // fonte muta: già annotata nel registro

    const testo = testoDaHtml(html);

    // Filtro 1 — gratis: pagina troppo corta, o senza una sola parola che
    // somigli a un bando.
    if (!valeLaPenaChiedere(testo)) {
      risparmiate++;
      scriviLog('risparmio', fonte.url,
        'pagina troppo corta o senza parole utili: non chiesto al modello');
      continue;
    }

    // Filtro 2 — gratis: la pagina è identica all'ultima volta che l'abbiamo
    // letta. Rileggerla darebbe la stessa risposta di sette giorni fa.
    if (!eCambiata(fonte.url, testo)) {
      risparmiate++;
      scriviLog('risparmio', fonte.url,
        'pagina identica al giro scorso: non chiesto al modello');
      continue;
    }

    // Solo adesso si spende.
    const esito = chiediAGemini(testo, fonte.url);

    // L'impronta si aggiorna solo se il modello ha davvero risposto: se era
    // giù o fuori quota non si segna niente, così la volta dopo ci riprova
    // invece di dare la pagina per già letta.
    if (esito.riuscita) ricordaImpronta(fonte.url, testo);
    if (!esito.schede.length) continue;   // pagina senza opportunità, o chiamata fallita

    // Una pagina di elenco porta più bandi: si scrivono tutti quelli nuovi.
    // Il confronto è sull'elenco letto all'inizio, non sul foglio.
    for (const scheda of esito.schede) {
      const chiave = chiaveRiga(scheda);
      if (giaViste[chiave]) continue;
      giaViste[chiave] = true;

      scriviRiga(scheda, fonte.nome);
      nuove.push(scheda);
    }

    Utilities.sleep(cfg('pausa_fra_chiamate')); // un respiro fra una chiamata e l'altra
  }

  // Il riepilogo va nel registro anche quando è andato tutto bene: è la riga
  // che, riletta fra sei mesi, dice quanto è costato tenerlo acceso.
  scriviLog('giro', 'radarEsegui',
    nuove.length + ' righe nuove · ' + chiamateFatte + ' chiamate al modello · ' +
    risparmiate + ' pagine saltate senza spendere');

  if (nuove.length > 0) preparaBozza(nuove);
  return nuove.length;
}

/**
 * Prepara la bozza del riepilogo. La riga che conta è `createDraft`: la mail
 * RESTA NELLE BOZZE. Non parte da sola, non parte di notte, non parte mai
 * senza che una persona l'abbia aperta e premuta.
 *
 * È la parte del programma che vale più di tutto il resto del codice: è ciò
 * che rende questo strumento adottabile da un ufficio pubblico. Chi lo adatta
 * è libero di cambiare qualunque cosa, ma se cambia questa riga in `sendEmail`
 * si porta a casa un problema diverso da quello che aveva.
 */
function preparaBozza(righe) {
  const oggi = Utilities.formatDate(new Date(), fusoOrario(), 'd MMMM yyyy');

  const corpo = righe.map(function (r) {
    return [
      '• ' + r.titolo,
      '  chi può partecipare: ' + (r.chi_puo      || '— non indicato nella pagina'),
      '  entro:               ' + (r.entro_quando || '— non indicato nella pagina'),
      '  quanto vale:         ' + (r.quanto_vale  || '— non indicato nella pagina'),
      '  ' + r.link
    ].join('\n');
  }).join('\n\n');

  const bozza = GmailApp.createDraft(
    destinatari(),
    'Radar opportunità — ' + righe.length + ' novità del ' + oggi,
    'Queste righe sono state trovate automaticamente e NON sono state verificate.\n'
    + 'Controllare le scadenze alla fonte prima di inoltrare.\n\n'
    + corpo
    + '\n\n—\nRadar delle opportunità · progetto PARTECIPA — Giovani Campania'
    + '\nSviluppo e manutenzione: Logika.studio — https://logikastudio.it'
  );

  // L'invio automatico è spento salvo che qualcuno lo accenda apposta, e
  // quando è acceso resta scritto nel registro: fra sei mesi, se arriva una
  // segnalazione su una scadenza sbagliata, si deve poter sapere se quella
  // mail l'aveva letta una persona prima di partire.
  if (String(cfg('invio_automatico')).toLowerCase() === 'sì') {
    bozza.send();
    scriviLog('bozza', 'invio automatico',
      'riepilogo inviato a ' + destinatari() + ' senza passare da una persona');
    return;
  }

  scriviLog('bozza', 'preparaBozza', 'riepilogo pronto nelle bozze di Gmail, in attesa di una persona');
}

/**
 * Invia il riepilogo che aspetta nelle bozze. È la scorciatoia per non dover
 * cercare in Gmail: l'invio resta un gesto umano, fatto in un clic invece che
 * in cinque. Prende sempre la bozza più recente del radar.
 */
function inviaUltimoRiepilogo() {
  const nostre = GmailApp.getDrafts().filter(function (b) {
    return b.getMessage().getSubject().indexOf('Radar opportunità —') === 0;
  });

  if (!nostre.length) return null;

  nostre.sort(function (a, b) {
    return b.getMessage().getDate().getTime() - a.getMessage().getDate().getTime();
  });

  const bozza = nostre[0];
  const oggetto = bozza.getMessage().getSubject();
  const aChi = bozza.getMessage().getTo();
  bozza.send();

  scriviLog('bozza', 'inviaUltimoRiepilogo', 'inviato «' + oggetto + '» a ' + aChi);
  return { oggetto: oggetto, destinatari: aChi, rimaste: nostre.length - 1 };
}

/** Il fuso del foglio, se c'è; altrimenti quello italiano. */
function fusoOrario() {
  try {
    return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || 'Europe/Rome';
  } catch (e) {
    return 'Europe/Rome';
  }
}

/**
 * La sveglia: è questa funzione a trasformare un programma in un agente.
 * Prima cancella le sveglie già installate, poi ne crea una sola: eseguirla
 * due volte non raddoppia le email.
 */
function installaTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'radarEsegui'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });

  const giorno = ScriptApp.WeekDay[cfg('giorno_sveglia')] || ScriptApp.WeekDay.MONDAY;

  ScriptApp.newTrigger('radarEsegui')
    .timeBased()
    .onWeekDay(giorno)
    .atHour(cfg('ora_sveglia'))
    .create();

  const quando = nomeGiorno(cfg('giorno_sveglia')) + ' verso le ' + cfg('ora_sveglia');
  scriviLog('sveglia', 'installaTrigger', 'sveglia impostata: ' + quando);
  return quando;
}

/**
 * Come si spegne. Va mostrata insieme a quella che accende: un ufficio adotta
 * uno strumento solo se sa anche come fermarlo, senza chiamare nessuno.
 */
function spegniTrigger() {
  const trigger = ScriptApp.getProjectTriggers();
  trigger.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  scriviLog('sveglia', 'spegniTrigger', 'radar spento (' + trigger.length + ' sveglie rimosse)');
  return trigger.length;
}

/** La sveglia è accesa? Per il pannello e per la diagnostica. */
function svegliaAttiva() {
  return ScriptApp.getProjectTriggers()
    .some(function (t) { return t.getHandlerFunction() === 'radarEsegui'; });
}

function nomeGiorno(codice) {
  const nomi = {
    MONDAY: 'lunedì', TUESDAY: 'martedì', WEDNESDAY: 'mercoledì',
    THURSDAY: 'giovedì', FRIDAY: 'venerdì', SATURDAY: 'sabato', SUNDAY: 'domenica'
  };
  return nomi[codice] || codice;
}

/**
 * Prova a secco: legge le fonti, applica tutti i filtri e dice quante chiamate
 * COSTEREBBE il giro — senza farne nemmeno una. Da eseguire ogni volta che si
 * aggiungono fonti, prima di scoprire la spesa a quota già consumata.
 */
function quantoCosterebbe() {
  let spenderebbe = 0, gratis = 0;

  for (const fonte of leggiFonti()) {
    const html = scaricaPagina(fonte.url);
    if (!html) { gratis++; continue; }
    const testo = testoDaHtml(html);
    if (!valeLaPenaChiedere(testo) || !eCambiata(fonte.url, testo)) { gratis++; continue; }
    spenderebbe++;
  }

  const messaggio = 'il prossimo giro costerebbe ' + spenderebbe + ' chiamate (' +
    gratis + ' fonti risolte gratis, tetto a ' + cfg('max_chiamate_per_giro') + ')';
  scriviLog('risparmio', 'quantoCosterebbe', messaggio);
  return messaggio;
}


/* ====================================================================
   05-Menu.gs
   ==================================================================== */

/**
 * RADAR DELLE OPPORTUNITÀ — Il menu.
 *
 * Tutto quello che nel laboratorio si faceva aprendo l'editor e premendo
 * «Esegui» su una funzione, qui è una voce di menu. Non è cosmesi: un ufficio
 * adotta uno strumento che può usare, non uno che deve saper leggere.
 *
 * Nota tecnica per chi adatta: `onOpen` gira in modo limitato — può costruire
 * il menu e nient'altro. Qualunque cosa serva la chiave, le proprietà o la
 * rete va messa dentro le voci, non qui, o il menu non compare più.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛰️ Radar')
    .addItem('Prepara il foglio', 'vocePreparaIlFoglio')
    .addItem('Impostazioni…', 'voceImpostazioni')
    .addSeparator()
    .addItem('Esegui adesso', 'voceEseguiAdesso')
    .addItem('Invia il riepilogo che aspetta', 'voceInviaRiepilogo')
    .addItem('Quanto costerebbe il prossimo giro', 'voceQuantoCosterebbe')
    .addSeparator()
    .addItem('Accendi la sveglia settimanale', 'voceAccendi')
    .addItem('Spegni il radar', 'voceSpegni')
    .addSeparator()
    .addItem('Diagnostica', 'voceDiagnostica')
    .addItem('Fai rileggere tutte le pagine', 'voceDimenticaImpronte')
    .addToUi();
}

/** Il pannello laterale: chiave, età, modello, sveglia, regole aggiuntive. */
function voceImpostazioni() {
  const pannello = HtmlService.createTemplateFromFile('Pannello')
    .evaluate()
    .setTitle('Radar — impostazioni')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(pannello);
}

function vocePreparaIlFoglio() {
  const creati = preparaIlFoglio();
  avvisa('Foglio pronto',
    creati.length
      ? 'Creati: ' + creati.join(', ') + '.\n\nOra scrivi le tue fonti nel foglio FONTI e ' +
        'almeno un indirizzo email nella colonna E.'
      : 'I tre fogli c\'erano già: intestazioni e formati rimessi a posto.');
}

/**
 * Il giro a mano. Prima di partire controlla le due cose che fanno fallire il
 * 90% dei primi tentativi — la chiave e le fonti — invece di lasciare che il
 * programma si schianti a metà strada con un messaggio da programmatore.
 */
function voceEseguiAdesso() {
  if (!chiaveApiPresente()) {
    avvisa('Manca la chiave',
      'Prima di lanciare il radar serve la chiave di Gemini.\n' +
      'Menu «🛰️ Radar» → «Impostazioni…» e incollala nel primo campo.');
    return;
  }
  if (!leggiFonti().length) {
    avvisa('Nessuna fonte attiva',
      'Nel foglio FONTI non c\'è nessuna riga con «sì» nella colonna «Attiva?».');
    return;
  }

  SpreadsheetApp.getActive().toast('Sto leggendo le fonti…', 'Radar', 30);
  const quante = radarEsegui();

  avvisa('Giro finito',
    quante > 0
      ? quante + ' righe nuove nel foglio OPPORTUNITÀ.\n\n' +
        'Il riepilogo è nelle BOZZE di Gmail: aprilo, controlla le scadenze alla ' +
        'fonte e solo allora invialo. Il radar non manda niente da solo.'
      : 'Nessuna riga nuova. Nel foglio LOG c\'è scritto perché: può voler dire ' +
        'che le pagine non sono cambiate, e allora è una buona notizia.');
}

/**
 * L'invio in un clic. Prima di partire mostra a chi va e chiede conferma: è
 * l'ultimo momento in cui una persona può dire di no, e serve che sia una
 * scelta vera, non un pulsante premuto per sbaglio.
 */
function voceInviaRiepilogo() {
  const ui = SpreadsheetApp.getUi();
  const bozze = GmailApp.getDrafts().filter(function (b) {
    return b.getMessage().getSubject().indexOf('Radar opportunità —') === 0;
  });

  if (!bozze.length) {
    avvisa('Nessun riepilogo da inviare',
      'Non c\'è nessuna bozza del radar in attesa.\n\n' +
      'Le bozze si creano quando un giro trova righe nuove: prova «Esegui adesso».');
    return;
  }

  const ultima = bozze[bozze.length - 1].getMessage();
  const risposta = ui.alert('Inviare il riepilogo?',
    'Oggetto: ' + ultima.getSubject() + '\n' +
    'A: ' + ultima.getTo() + '\n\n' +
    'Hai controllato le scadenze alla fonte? Una volta partito, quel messaggio ' +
    'è la parola dell\'ufficio.',
    ui.ButtonSet.YES_NO);

  if (risposta !== ui.Button.YES) return;

  const esito = inviaUltimoRiepilogo();
  avvisa('Inviato',
    esito
      ? 'Partito verso ' + esito.destinatari +
        (esito.rimaste ? '\n\nRestano ' + esito.rimaste + ' bozze più vecchie in Gmail.' : '')
      : 'La bozza non c\'era più.');
}

function voceQuantoCosterebbe() {
  SpreadsheetApp.getActive().toast('Sto controllando le fonti…', 'Radar', 30);
  avvisa('Prova a secco', quantoCosterebbe() +
    '\n\nNessuna chiamata è stata fatta: questo è solo il conto di quello che ' +
    'costerebbe il prossimo giro.');
}

function voceAccendi() {
  const quando = installaTrigger();
  avvisa('Radar acceso',
    'Da adesso parte da solo ogni ' + quando + ', anche a computer spento.\n\n' +
    'Prepara la bozza e si ferma lì: l\'invio resta una decisione di una persona.');
}

function voceSpegni() {
  const ui = SpreadsheetApp.getUi();
  const risposta = ui.alert('Spegnere il radar?',
    'Non si cancella niente: il foglio e le righe restano dove sono. Smette ' +
    'solo di svegliarsi da solo, e potrai riaccenderlo quando vuoi.',
    ui.ButtonSet.YES_NO);

  if (risposta === ui.Button.YES) {
    const quante = spegniTrigger();
    avvisa('Radar spento', quante + ' sveglie rimosse. Puoi ancora lanciarlo a mano.');
  }
}

function voceDiagnostica() {
  const righe = diagnostica().map(function (e) {
    return (e.ok ? '✅ ' : '⚠️ ') + e.voce + ': ' + e.dettaglio;
  });
  avvisa('Diagnostica', righe.join('\n'));
}

function voceDimenticaImpronte() {
  const quante = dimenticaImpronte();
  avvisa('Fatto',
    quante + ' impronte cancellate. Al prossimo giro il radar rileggerà tutte le ' +
    'pagine da capo — anche quelle che non sono cambiate. Costa qualche chiamata ' +
    'in più: si fa quando si sospetta che qualcosa sia sfuggito.');
}

/* ---------------------------------------------------------------------- */

function avvisa(titolo, testo) {
  SpreadsheetApp.getUi().alert(titolo, testo, SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ----------------------------------------------------------------------
   Le funzioni chiamate dal pannello laterale. Stanno qui perché il pannello
   non può parlare direttamente con il resto: passa sempre da queste.
   ---------------------------------------------------------------------- */

function pannelloStato() {
  return {
    chiavePresente: chiaveApiPresente(),
    configurazione: configurazioneCorrente(),
    svegliaAttiva: svegliaAttiva()
  };
}

function pannelloSalva(dati) {
  if (dati.chiave) salvaChiaveApi(dati.chiave);
  delete dati.chiave;
  salvaConfigurazione(dati);
  return 'Impostazioni salvate.';
}

function pannelloProvaChiave() {
  if (!chiaveApiPresente()) return { ok: false, messaggio: 'la chiave non è ancora stata salvata' };
  return provaLaChiave();
}

/** L'elenco per la tendina dei modelli: quelli che questa chiave può usare. */
function pannelloModelli() {
  if (!chiaveApiPresente()) {
    return { ok: false, modelli: MODELLI_CONSIGLIATI, messaggio: 'salva la chiave per vedere i tuoi modelli' };
  }
  return modelliUtilizzabili();
}


/* ====================================================================
   06-Preparazione.gs
   ==================================================================== */

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
