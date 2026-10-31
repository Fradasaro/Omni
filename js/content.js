/* ==========================================================================
   CONTENUTI: note del coach, linee guida, testi legali.
   Tono: semplice, gentile, mai colpevolizzante. Nessuna promessa medica.
   ========================================================================== */
'use strict';

const DISCLAIMER =
  'Omni è uno strumento di calcolo ed educativo: non sostituisce il parere di medico, dietista o biologo nutrizionista. ' +
  'Valori nutrizionali: tabelle CREA (Centro di ricerca Alimenti e Nutrizione) per gli alimenti di base, etichette medie per i prodotti confezionati.';

/* Consigli a rotazione, mostrati quando non c'è un consiglio legato al contesto. */
const GENERAL_TIPS = [
  { t: 'La costanza batte la perfezione', d: 'Conta la media della settimana, non il singolo giorno. Stare entro ±10 g sui macro significa essere perfettamente in linea.' },
  { t: 'Verdure a ogni pasto principale', d: 'Due o trecento grammi a pranzo e a cena: fibre, sazietà e micronutrienti, con pochissime calorie.' },
  { t: 'Pesa a crudo', d: 'I grammi del piano sono a crudo, salvo dove indicato. Accanto a riso, pasta e carne trovi il peso indicativo da cotto.' },
  { t: 'Il sonno conta quanto il piatto', d: 'Dormire poco aumenta la fame e riduce il recupero. Sette-otto ore sono parte del piano.' },
  { t: 'Frutta ogni giorno', d: 'Due o tre porzioni al giorno, intere più che in succo: vitamine, fibre e un dolce naturale.' },
  { t: 'Sale con moderazione', d: 'Insaporisci con erbe, spezie, limone e aceto. Se hai condizioni particolari, segui le indicazioni del tuo medico.' },
  { t: 'Il peso oscilla, il trend no', d: 'Variazioni di 1-2 kg da un giorno all’altro sono normali (acqua, sale, digestione). Guarda la linea del trend.' },
  { t: 'Un pasto non definisce il percorso', d: 'Un pasto fuori piano non annulla nulla. Riprendi dal pasto successivo, senza digiuni né tagli punitivi.' },
  { t: 'Proteine distribuite', d: 'Una fonte proteica a ogni pasto aiuta sazietà e recupero più che concentrarle tutte a cena.' },
  { t: 'Acqua prima della fame', d: 'A volte la sete si traveste da fame. Un bicchiere d’acqua prima del pasto è un’abitudine semplice.' },
  { t: 'Scambi, non rinunce', d: 'Se un alimento non ti va o non lo hai in casa, usa Scambi: trovi l’equivalente al grammo.' },
  { t: 'Mangia con calma', d: 'Rallentare e masticare bene dà al corpo il tempo di sentire la sazietà.' }
];

/* Linee guida mostrate nel Profilo. */
const GUIDELINES = [
  { icon: 'target', t: 'La tolleranza è parte del piano', d: 'Una giornata entro ±10 g per ciascun macronutriente e ±100 kcal è in linea con il piano. Non serve inseguire il grammo esatto.' },
  { icon: 'leaf', t: 'Verdure libere, ma registrabili', d: 'Le verdure hanno pochissime calorie: puoi aggiungerle a piacere a pranzo e cena. Se le registri, i numeri restano onesti.' },
  { icon: 'scale', t: 'Pesa a crudo, una volta per tutte', d: 'I grammi si intendono a crudo e al netto degli scarti, salvo dove indicato «cotto». Per riso, pasta, legumi secchi e carne trovi il peso indicativo dopo la cottura.' },
  { icon: 'drop', t: 'Idratazione', d: 'Il target di acqua è un riferimento: aumenta se ti alleni o fa caldo. Tè, tisane e caffè non zuccherati contano.' },
  { icon: 'pizza', t: 'I pasti liberi fanno parte del percorso', d: 'Registra il pasto libero senza calcoli e riprendi il piano dal pasto successivo. Omni non ti proporrà mai di saltare pasti o ridurre la cena per compensare.' },
  { icon: 'chart', t: 'Guarda il trend del peso', d: 'Pesati a digiuno, dopo il bagno, 1-3 volte a settimana. La linea del trend conta più della singola pesata.' },
  { icon: 'shield', t: 'Sale, alcol e zuccheri', d: 'Con moderazione. Le esigenze individuali dipendono dalla salute di ciascuno: per pressione alta, diabete o altre condizioni segui il tuo medico.' },
  { icon: 'heart', t: 'Quando chiedere aiuto', d: 'Se il cibo o il peso diventano fonte di ansia, senso di colpa, abbuffate o restrizioni, parlane con il tuo medico o con un professionista. In Italia esiste il numero verde gratuito SOS Disturbi Alimentari: 800 180 969.' }
];
