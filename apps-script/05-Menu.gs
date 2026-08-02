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
