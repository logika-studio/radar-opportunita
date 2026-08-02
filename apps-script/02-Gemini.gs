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
