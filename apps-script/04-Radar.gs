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
