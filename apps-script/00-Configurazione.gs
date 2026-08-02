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
