/* ==========================================================================
   DATABASE ALIMENTI NATIVO (offline)
   Valori per 100 g di parte edibile.
   - src: 'CREA'  → Tabelle di composizione degli alimenti, CREA Centro di
                    ricerca Alimenti e Nutrizione (www.alimentinutrizione.it).
                    Dove indicati più codici CREA, il valore è la media.
   - src: 'INRAN' → Tabelle INRAN (ente poi confluito nel CREA).
   - senza src    → prodotti confezionati: valore medio da etichette italiane.
   Verifica: 31/10/2026.

   Campi:
   - cat:  P proteine · C carboidrati · G grassi · V verdure
   - st:   'r' peso a crudo · 's' peso a secco · 'k' cotto / pronto
   - ck:   resa in cottura (peso cotto / peso crudo), per mostrare "≈ X g da cotto"
   - u:    porzione comune [nome, grammi]
   - alt:  sinonimi per la ricerca
   - tags: veg (vegetariano) · vegan · nolact (naturalmente senza lattosio)
   - src:  fonte del valore (vedi sopra)
   Gli id storici (es. 'pollo', 'riso', 'olio') non vanno mai cambiati:
   i diari salvati li usano come riferimento.
   ========================================================================== */
'use strict';

const AISLES = {
  CARNE: 'Carne e salumi',
  PESCE: 'Pesce',
  UOVA: 'Uova e latticini',
  VPROT: 'Alternative vegetali',
  CEREALI: 'Cereali, pane e pasta',
  LEGUMI: 'Legumi',
  FRUTTA: 'Frutta',
  VERDURA: 'Verdura',
  SECCA: 'Frutta secca e semi',
  COND: 'Condimenti e salse',
  DISP: 'Dispensa',
  INTEG: 'Integratori'
};

const TAGSETS = {
  m: ['nolact'],                  // carne e pesce
  d: ['veg'],                     // latticini
  dl: ['veg', 'nolact'],          // latticini stagionati (naturalmente senza lattosio)
  o: ['veg', 'nolact'],           // vegetariano non caseario (uova, miele)
  v: ['veg', 'vegan', 'nolact']   // vegetale
};

function F(id, name, cat, aisle, kcal, p, c, g, tag, extra = {}) {
  return Object.assign({ id, name, cat, aisle, kcal, p, c, g, tags: TAGSETS[tag] || [] }, extra);
}

const A = AISLES;

const DEFAULT_FOODS = [
  /* ---------------- CARNE (peso a crudo) ---------------- */
  F('pollo', 'Petto di pollo', 'P', A.CARNE, 100, 23.3, 0, 0.8, 'm', { src: 'CREA', st: 'r', ck: 0.75 }),
  F('pollo_coscia', "Sovracoscia di pollo senza pelle", 'P', A.CARNE, 132, 18.7, 0, 6.3, 'm', { src: 'CREA', st: 'r', ck: 0.72, alt: 'sovracoscia' }),
  F('tacchino', 'Fesa di tacchino', 'P', A.CARNE, 107, 24, 0, 1.2, 'm', { src: 'CREA', st: 'r', ck: 0.75, alt: 'petto tacchino' }),
  F('tacchino_macinato', 'Macinato di tacchino', 'P', A.CARNE, 150, 19, 0, 8, 'm', { st: 'r', ck: 0.72 }),
  F('manzo_magro', 'Manzo magro (fesa, girello)', 'P', A.CARNE, 106, 21.6, 0, 2.3, 'm', { src: 'CREA', st: 'r', ck: 0.7, alt: 'tagliata bistecca' }),
  F('manzo_filetto', 'Filetto di manzo', 'P', A.CARNE, 127, 20.5, 0, 5, 'm', { src: 'CREA', st: 'r', ck: 0.7 }),
  F('macinato_magro', 'Macinato di manzo magro (5%)', 'P', A.CARNE, 125, 21, 0, 4.5, 'm', { st: 'r', ck: 0.7, alt: 'carne trita' }),
  F('macinato_15', 'Macinato di manzo (15%)', 'P', A.CARNE, 215, 18.5, 0, 15.5, 'm', { st: 'r', ck: 0.7, alt: 'hamburger carne trita' }),
  F('vitello', "Vitello magro (filetto)", 'P', A.CARNE, 107, 20.7, 0, 2.7, 'm', { src: 'CREA', st: 'r', ck: 0.7, alt: 'scaloppine' }),
  F('lonza', "Lonza di maiale (lombo)", 'P', A.CARNE, 146, 20.7, 0, 7, 'm', { src: 'CREA', st: 'r', ck: 0.72, alt: 'braciola' }),
  F('filetto_maiale', 'Filetto di maiale', 'P', A.CARNE, 120, 21, 0, 4, 'm', { st: 'r', ck: 0.72 }),
  F('coniglio', 'Coniglio', 'P', A.CARNE, 118, 19.9, 0, 4.3, 'm', { src: 'CREA', st: 'r', ck: 0.72 }),
  F('cavallo', 'Carne di cavallo', 'P', A.CARNE, 106, 23.5, 0.7, 1, 'm', { src: 'CREA', st: 'r', ck: 0.72, alt: 'equina' }),
  F('agnello', 'Agnello magro', 'P', A.CARNE, 159, 20, 0, 8.8, 'm', { src: 'CREA', st: 'r', ck: 0.7 }),
  F('fegato', 'Fegato di vitello', 'P', A.CARNE, 135, 20, 4, 3.5, 'm', { st: 'r', ck: 0.75 }),
  F('salsiccia', 'Salsiccia di maiale', 'P', A.CARNE, 300, 15, 1, 26.5, 'm', { st: 'r', ck: 0.75 }),
  F('bresaola', 'Bresaola', 'P', A.CARNE, 151, 32, 0, 2.6, 'm', { src: 'INRAN', st: 'k', u: ['fetta', 10] }),
  F('crudo_magro', 'Prosciutto crudo sgrassato', 'P', A.CARNE, 159, 29.3, 0, 4.6, 'm', { src: 'INRAN', st: 'k', u: ['fetta', 12] }),
  F('crudo', 'Prosciutto crudo', 'P', A.CARNE, 268, 25.5, 0, 18.4, 'm', { src: 'INRAN', st: 'k', u: ['fetta', 12] }),
  F('cotto', 'Prosciutto cotto', 'P', A.CARNE, 215, 19.5, 1, 14.7, 'm', { src: 'INRAN', st: 'k', u: ['fetta', 15] }),
  F('arrosto_tac', 'Petto di tacchino arrosto (affettato)', 'P', A.CARNE, 105, 20, 1.5, 2, 'm', { st: 'k', u: ['fetta', 12] }),
  F('speck', 'Speck', 'P', A.CARNE, 300, 28, 0.5, 20.5, 'm', { st: 'k', u: ['fetta', 10] }),

  /* ---------------- PESCE (peso a crudo) ---------------- */
  F('merluzzo', 'Merluzzo / Nasello', 'P', A.PESCE, 71, 17, 0, 0.3, 'm', { src: 'CREA', st: 'r', ck: 0.8, alt: 'nasello filetto' }),
  F('orata', "Orata d'allevamento", 'P', A.PESCE, 159, 19.7, 1.2, 8.4, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('branzino', "Branzino / Spigola d'allevamento", 'P', A.PESCE, 149, 21.3, 0.8, 6.8, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('salmone', 'Salmone fresco', 'P', A.PESCE, 185, 18.4, 1, 12, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('salmone_aff', 'Salmone affumicato', 'P', A.PESCE, 147, 25.4, 1.2, 4.5, 'm', { src: 'CREA', st: 'k', u: ['confezione', 100] }),
  F('tonno_fresco', "Tonno fresco (rosso)", 'P', A.PESCE, 159, 21.5, 0.1, 8.1, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('tonno_nat', 'Tonno al naturale (sgocciolato)', 'P', A.PESCE, 103, 25.1, 0, 0.3, 'm', { src: 'CREA', st: 'k', u: ['scatoletta', 56] }),
  F('tonno_olio', "Tonno sott'olio (sgocciolato)", 'P', A.PESCE, 192, 25.2, 0, 10.1, 'm', { src: 'CREA', st: 'k', u: ['scatoletta', 52] }),
  F('sgombro', 'Sgombro', 'P', A.PESCE, 170, 17, 0.5, 11.1, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('sardine', "Sardine fresche", 'P', A.PESCE, 129, 20.8, 1.5, 4.5, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('alici', 'Alici / Acciughe fresche', 'P', A.PESCE, 96, 16.8, 1.5, 2.6, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('pesce_spada', 'Pesce spada', 'P', A.PESCE, 109, 16.9, 1, 4.2, 'm', { st: 'r', ck: 0.8 }),
  F('trota', 'Trota', 'P', A.PESCE, 118, 20.3, 0, 4.1, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('platessa', "Sogliola / Platessa", 'P', A.PESCE, 83, 16.9, 0.8, 1.4, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('polpo', 'Polpo', 'P', A.PESCE, 57, 10.6, 1.4, 1, 'm', { src: 'CREA', st: 'r', ck: 0.6 }),
  F('calamari', 'Calamari', 'P', A.PESCE, 68, 12.6, 0.6, 1.7, 'm', { src: 'CREA', st: 'r', ck: 0.75 }),
  F('seppie', 'Seppie', 'P', A.PESCE, 72, 14, 0.7, 1.5, 'm', { src: 'CREA', st: 'r', ck: 0.75 }),
  F('gamberi', 'Gamberi / Mazzancolle sgusciati', 'P', A.PESCE, 71, 13.6, 2.9, 0.6, 'm', { src: 'CREA', st: 'r', ck: 0.8 }),
  F('cozze', 'Cozze (sgusciate)', 'P', A.PESCE, 84, 11.7, 3.4, 2.7, 'm', { src: 'CREA', st: 'k' }),
  F('vongole', 'Vongole (sgusciate)', 'P', A.PESCE, 65, 9.8, 3.9, 1.2, 'm', { src: 'CREA', st: 'k' }),
  F('baccala', 'Baccalà ammollato', 'P', A.PESCE, 95, 21.6, 0, 1, 'm', { src: 'CREA', st: 'r', ck: 0.85 }),
  F('surimi', 'Surimi', 'P', A.PESCE, 95, 9, 13, 1, 'm', { st: 'k', u: ['bastoncino', 17] }),

  /* ---------------- UOVA E LATTICINI ---------------- */
  F('uova', 'Uova intere', 'P', A.UOVA, 128, 12.4, 0, 8.7, 'o', { src: 'CREA', st: 'r', u: ['uovo medio', 55] }),
  F('albume', "Albume d'uovo", 'P', A.UOVA, 43, 10.7, 0, 0, 'o', { src: 'CREA', st: 'r', alt: 'albumi liquidi chiare' }),
  F('ygreco0', 'Yogurt greco 0%', 'P', A.UOVA, 51, 9, 4, 0, 'd', { src: 'CREA', st: 'k', u: ['vasetto', 170] }),
  F('ygreco2', 'Yogurt greco 2%', 'P', A.UOVA, 75, 9.6, 3.6, 2.2, 'd', { st: 'k', u: ['vasetto', 170] }),
  F('ygreco5', 'Yogurt greco intero', 'P', A.UOVA, 115, 6.4, 2, 9.1, 'd', { src: 'CREA', st: 'k', u: ['vasetto', 170] }),
  F('skyr', 'Skyr bianco', 'P', A.UOVA, 63, 11, 4, 0.2, 'd', { st: 'k', u: ['vasetto', 150] }),
  F('quark', 'Quark magro', 'P', A.UOVA, 67, 12, 4, 0.2, 'd', { st: 'k' }),
  F('fiocchi', 'Fiocchi di latte', 'P', A.UOVA, 98, 11.5, 3.4, 4.3, 'd', { st: 'k', u: ['vasetto', 150], alt: 'cottage cheese' }),
  F('ricotta', 'Ricotta vaccina light', 'P', A.UOVA, 114, 11.5, 3.5, 6, 'd', { st: 'k' }),
  F('ricotta_intera', 'Ricotta vaccina', 'P', A.UOVA, 146, 8.8, 3.5, 10.9, 'd', { src: 'INRAN', st: 'k' }),
  F('mozzarella_light', 'Mozzarella light', 'P', A.UOVA, 160, 19.5, 1.5, 8.5, 'd', { st: 'k', u: ['mozzarella', 125] }),
  F('latte_scremato', 'Latte scremato', 'C', A.UOVA, 36, 3.6, 5.3, 0.2, 'd', { src: 'CREA', st: 'k', u: ['tazza', 200] }),
  F('latte_ps', 'Latte parzialmente scremato', 'C', A.UOVA, 46, 3.5, 5, 1.5, 'd', { src: 'CREA', st: 'k', u: ['tazza', 200] }),
  F('latte_intero', 'Latte intero', 'C', A.UOVA, 64, 3.3, 4.9, 3.6, 'd', { src: 'CREA', st: 'k', u: ['tazza', 200] }),
  F('parmigiano', 'Parmigiano Reggiano / Grana Padano', 'G', A.UOVA, 387, 33.5, 0, 28.1, 'dl', { src: 'INRAN', st: 'k', u: ['cucchiaio grattugiato', 10] }),
  F('mozzarella', 'Mozzarella vaccina', 'G', A.UOVA, 253, 18.7, 0.7, 19.5, 'd', { src: 'INRAN', st: 'k', u: ['mozzarella', 125], alt: 'fiordilatte' }),
  F('feta', 'Feta', 'G', A.UOVA, 250, 15, 1, 21, 'd', { st: 'k' }),
  F('stracchino', 'Stracchino / Crescenza', 'G', A.UOVA, 281, 15, 1.5, 23.5, 'd', { st: 'k' }),
  F('burrata', 'Burrata', 'G', A.UOVA, 290, 15, 1.5, 25, 'd', { st: 'k', u: ['burrata', 125] }),
  F('burro', 'Burro', 'G', A.UOVA, 758, 0.8, 1.1, 83.4, 'd', { src: 'CREA', st: 'k', u: ['noce', 10] }),

  /* ---------------- ALTERNATIVE VEGETALI ---------------- */
  F('tofu', 'Tofu al naturale', 'P', A.VPROT, 122, 14, 1.5, 6.5, 'v', { st: 'k' }),
  F('tempeh', 'Tempeh', 'P', A.VPROT, 192, 20, 7.5, 10.5, 'v', { st: 'k' }),
  F('seitan', 'Seitan', 'P', A.VPROT, 130, 24, 4.5, 1.8, 'v', { st: 'k' }),
  F('edamame', 'Edamame (sgusciati)', 'P', A.VPROT, 121, 12, 6.5, 5.2, 'v', { st: 'k' }),
  F('lupini', 'Lupini (sgocciolati)', 'P', A.VPROT, 119, 16.4, 7.1, 2.4, 'v', { src: 'CREA', st: 'k' }),
  F('bev_soia', 'Bevanda di soia (senza zucchero)', 'P', A.VPROT, 33, 3.3, 0.3, 1.9, 'v', { st: 'k', u: ['tazza', 200], alt: 'latte di soia' }),
  F('bev_avena', "Bevanda d'avena", 'C', A.VPROT, 45, 0.5, 6.5, 1.5, 'v', { st: 'k', u: ['tazza', 200], alt: 'latte di avena' }),
  F('bev_mandorla', 'Bevanda di mandorla (senza zucchero)', 'G', A.VPROT, 13, 0.4, 0, 1.1, 'v', { st: 'k', u: ['tazza', 200], alt: 'latte di mandorla' }),
  F('yogurt_soia', 'Yogurt di soia bianco', 'P', A.VPROT, 50, 4, 2.5, 2.3, 'v', { st: 'k', u: ['vasetto', 125] }),

  /* ---------------- CEREALI, PANE E PASTA ---------------- */
  F('riso', 'Riso (basmati, carnaroli, parboiled)', 'C', A.CEREALI, 346, 7.7, 81.5, 0.9, 'v', { src: 'CREA', st: 's', ck: 2.6 }),
  F('riso_integrale', 'Riso integrale', 'C', A.CEREALI, 341, 7.5, 77.4, 1.9, 'v', { src: 'CREA', st: 's', ck: 2.5 }),
  F('riso_venere', 'Riso venere / rosso', 'C', A.CEREALI, 355, 7.8, 80.4, 1.3, 'v', { src: 'CREA', st: 's', ck: 2.5 }),
  F('pasta', 'Pasta di semola', 'C', A.CEREALI, 341, 13.5, 72.7, 1.2, 'v', { src: 'CREA', st: 's', ck: 2.1 }),
  F('pasta_integrale', 'Pasta integrale', 'C', A.CEREALI, 330, 13.3, 64.8, 2.2, 'v', { src: 'CREA', st: 's', ck: 2.1 }),
  F('pasta_legumi', 'Pasta di legumi', 'C', A.CEREALI, 335, 25, 48, 2.5, 'v', { st: 's', ck: 2.1, alt: 'lenticchie rosse ceci' }),
  F('pasta_uovo', "Pasta all'uovo (secca)", 'C', A.CEREALI, 346, 13, 71, 2.4, 'o', { src: 'CREA', st: 's', ck: 2.3, alt: 'tagliatelle fettuccine' }),
  F('gnocchi', 'Gnocchi di patate', 'C', A.CEREALI, 164, 3.9, 37.9, 0.3, 'v', { src: 'CREA', st: 'k' }),
  F('couscous', 'Couscous', 'C', A.CEREALI, 361, 13.7, 76.5, 1.1, 'v', { src: 'CREA', st: 's', ck: 2.4, alt: 'cous cous' }),
  F('quinoa', 'Quinoa', 'C', A.CEREALI, 376, 15.4, 57.8, 8.1, 'v', { src: 'CREA', st: 's', ck: 2.8 }),
  F('farro', 'Farro', 'C', A.CEREALI, 353, 14.6, 69.3, 2.4, 'v', { src: 'CREA', st: 's', ck: 2.5 }),
  F('orzo', 'Orzo perlato', 'C', A.CEREALI, 346, 9.4, 73.7, 1.5, 'v', { src: 'CREA', st: 's', ck: 2.7 }),
  F('saraceno', 'Grano saraceno', 'C', A.CEREALI, 329, 12.4, 61.2, 3.3, 'v', { src: 'CREA', st: 's', ck: 2.5 }),
  F('amaranto', 'Amaranto', 'C', A.CEREALI, 371, 13.6, 65, 7, 'v', { st: 's', ck: 2.8 }),
  F('miglio', 'Miglio', 'C', A.CEREALI, 342, 11, 67.8, 4.2, 'v', { src: 'CREA', st: 's', ck: 3 }),
  F('polenta', 'Farina di mais (polenta)', 'C', A.CEREALI, 341, 8.7, 73.5, 2.7, 'v', { src: 'CREA', st: 's', ck: 4 }),
  F('tapioca', 'Tapioca', 'C', A.CEREALI, 332, 0.6, 87.2, 0.2, 'v', { src: 'CREA', st: 's' }),
  F('avena', "Fiocchi d'avena", 'C', A.CEREALI, 370, 13.5, 59, 7, 'v', { st: 's', alt: 'porridge' }),
  F('farina_avena', "Farina d'avena", 'C', A.CEREALI, 378, 12.6, 66.3, 7.1, 'v', { src: 'CREA', st: 's' }),
  F('crema_riso', 'Crema di riso', 'C', A.CEREALI, 360, 7, 81, 0.7, 'v', { st: 's' }),
  F('cornflakes', 'Corn flakes', 'C', A.CEREALI, 367, 6.6, 87.4, 0.8, 'v', { src: 'CREA', st: 'k' }),
  F('muesli', 'Muesli senza zuccheri aggiunti', 'C', A.CEREALI, 374, 9.7, 71.7, 6, 'v', { src: 'CREA', st: 'k' }),
  F('granola', 'Granola', 'C', A.CEREALI, 450, 9, 63, 17, 'v', { st: 'k' }),
  F('pane_bianco', 'Pane comune', 'C', A.CEREALI, 268, 8.1, 59.5, 0.5, 'v', { src: 'CREA', st: 'k', u: ['fetta', 30], alt: 'rosetta michetta' }),
  F('pane_int', 'Pane integrale', 'C', A.CEREALI, 224, 8.5, 44.1, 1.3, 'v', { src: 'CREA', st: 'k', u: ['fetta', 30] }),
  F('pane_segale', 'Pane di segale', 'C', A.CEREALI, 228, 8.3, 45.4, 1.7, 'v', { src: 'CREA', st: 'k', u: ['fetta', 30] }),
  F('pancarre', 'Pane in cassetta integrale', 'C', A.CEREALI, 260, 9, 44, 4.5, 'v', { st: 'k', u: ['fetta', 25], alt: 'pancarrè toast' }),
  F('piadina', 'Piadina', 'C', A.CEREALI, 330, 8, 52, 10, 'v', { st: 'k', u: ['piadina', 100] }),
  F('wrap', 'Tortilla / Wrap', 'C', A.CEREALI, 300, 8.5, 50, 7, 'v', { st: 'k', u: ['wrap', 60] }),
  F('gallette_riso', 'Gallette di riso', 'C', A.CEREALI, 382, 8, 80, 2.5, 'v', { st: 'k', u: ['galletta', 8] }),
  F('gallette_mais', 'Gallette di mais', 'C', A.CEREALI, 380, 7.5, 81, 2.5, 'v', { st: 'k', u: ['galletta', 8] }),
  F('fette_bisc', 'Fette biscottate integrali', 'C', A.CEREALI, 394, 14.2, 63, 10, 'v', { src: 'CREA', st: 'k', u: ['fetta', 9] }),
  F('wasa', 'Cracker di segale (tipo Wasa)', 'C', A.CEREALI, 335, 9, 61, 1.5, 'v', { st: 'k', u: ['fetta', 11] }),
  F('cracker', 'Cracker salati', 'C', A.CEREALI, 386, 9.4, 67.5, 10, 'v', { src: 'CREA', st: 'k', u: ['pacchetto', 25] }),
  F('grissini', 'Grissini', 'C', A.CEREALI, 421, 11.3, 65.1, 13.9, 'v', { src: 'CREA', st: 'k', u: ['grissino', 6] }),
  F('biscotti', 'Biscotti secchi', 'C', A.CEREALI, 404, 6.6, 80.4, 7.9, 'v', { src: 'CREA', st: 'k', u: ['biscotto', 8] }),
  F('patate', 'Patate', 'C', A.CEREALI, 72, 2, 16, 0.1, 'v', { src: 'CREA', st: 'r', ck: 1 }),
  F('patate_dolci', 'Patate dolci', 'C', A.CEREALI, 86, 1.6, 20, 0.1, 'v', { st: 'r', ck: 1, alt: 'americane batata' }),

  /* ---------------- LEGUMI ---------------- */
  F('lenticchie_secche', 'Lenticchie secche', 'C', A.LEGUMI, 319, 22.7, 51.1, 1, 'v', { src: 'CREA', st: 's', ck: 2.5 }),
  F('lenticchie', 'Lenticchie cotte (sgocciolate)', 'C', A.LEGUMI, 91, 5, 15.4, 0.5, 'v', { src: 'CREA', st: 'k' }),
  F('ceci_secchi', 'Ceci secchi', 'C', A.LEGUMI, 343, 20.9, 46.9, 6.3, 'v', { src: 'CREA', st: 's', ck: 2.2 }),
  F('ceci', 'Ceci cotti (sgocciolati)', 'C', A.LEGUMI, 111, 6.7, 13.9, 2.3, 'v', { src: 'CREA', st: 'k' }),
  F('fagioli_secchi', 'Fagioli secchi', 'C', A.LEGUMI, 313, 21.8, 46.6, 1.8, 'v', { src: 'CREA', st: 's', ck: 2.4, alt: 'borlotti cannellini' }),
  F('fagioli', 'Fagioli cotti (sgocciolati)', 'C', A.LEGUMI, 94, 6.3, 14.2, 0.6, 'v', { src: 'CREA', st: 'k', alt: 'borlotti cannellini' }),
  F('piselli', 'Piselli', 'C', A.LEGUMI, 61, 5.4, 6.5, 0.3, 'v', { src: 'CREA', st: 'r' }),
  F('fave', 'Fave', 'C', A.LEGUMI, 51, 5.2, 4.5, 0.4, 'v', { src: 'CREA', st: 'r' }),

  /* ---------------- FRUTTA ---------------- */
  F('banana', 'Banana', 'C', A.FRUTTA, 76, 1.2, 17.4, 0.3, 'v', { src: 'CREA', st: 'k', u: ['banana media', 120] }),
  F('mela', 'Mela', 'C', A.FRUTTA, 44, 0.2, 10, 0, 'v', { src: 'CREA', st: 'k', u: ['mela media', 180] }),
  F('pera', 'Pera', 'C', A.FRUTTA, 43, 0.3, 8.8, 0.1, 'v', { src: 'CREA', st: 'k', u: ['pera media', 170] }),
  F('arancia', 'Arancia', 'C', A.FRUTTA, 37, 0.7, 7.8, 0.2, 'v', { src: 'CREA', st: 'k', u: ['arancia media', 180] }),
  F('mandarino', 'Mandarino / Clementina', 'C', A.FRUTTA, 58, 0.9, 13.2, 0.2, 'v', { src: 'CREA', st: 'k', u: ['frutto', 70] }),
  F('kiwi', 'Kiwi', 'C', A.FRUTTA, 48, 1.2, 9, 0.6, 'v', { src: 'CREA', st: 'k', u: ['kiwi', 75] }),
  F('fragole', 'Fragole', 'C', A.FRUTTA, 30, 0.9, 5.3, 0.4, 'v', { src: 'CREA', st: 'k' }),
  F('mirtilli', 'Mirtilli', 'C', A.FRUTTA, 49, 0.9, 10.1, 0.2, 'v', { src: 'CREA', st: 'k' }),
  F('frutti_bosco', 'Frutti di bosco (misto)', 'C', A.FRUTTA, 47, 1.1, 8.2, 0.3, 'v', { src: 'CREA', st: 'k', alt: 'lamponi more' }),
  F('uva', 'Uva', 'C', A.FRUTTA, 64, 0.5, 15.6, 0.1, 'v', { src: 'CREA', st: 'k' }),
  F('ananas', 'Ananas', 'C', A.FRUTTA, 42, 0.5, 10, 0, 'v', { src: 'CREA', st: 'k' }),
  F('mango', 'Mango', 'C', A.FRUTTA, 56, 1, 12.6, 0.2, 'v', { src: 'CREA', st: 'k' }),
  F('pesca', "Pesca / Nettarina (con buccia)", 'C', A.FRUTTA, 28, 0.7, 5.8, 0, 'v', { src: 'CREA', st: 'k', u: ['pesca media', 150] }),
  F('albicocche', 'Albicocche', 'C', A.FRUTTA, 42, 0.4, 9.8, 0.1, 'v', { src: 'CREA', st: 'k', u: ['albicocca', 40] }),
  F('anguria', 'Anguria', 'C', A.FRUTTA, 16, 0.4, 3.7, 0, 'v', { src: 'CREA', st: 'k' }),
  F('melone', 'Melone', 'C', A.FRUTTA, 34, 0.8, 7.4, 0.2, 'v', { src: 'CREA', st: 'k' }),
  F('ciliegie', 'Ciliegie', 'C', A.FRUTTA, 48, 0.8, 11, 0.1, 'v', { src: 'CREA', st: 'k' }),
  F('fichi', 'Fichi', 'C', A.FRUTTA, 63, 0.9, 14.2, 0.2, 'v', { src: 'CREA', st: 'k' }),
  F('cachi', 'Cachi', 'C', A.FRUTTA, 70, 0.6, 16, 0.3, 'v', { src: 'CREA', st: 'k', u: ['caco', 200] }),
  F('datteri', 'Datteri secchi', 'C', A.FRUTTA, 270, 2.7, 63.1, 0.6, 'v', { src: 'CREA', st: 'k', u: ['dattero', 8] }),
  F('uvetta', 'Uvetta', 'C', A.FRUTTA, 293, 1.9, 72, 0.6, 'v', { src: 'CREA', st: 'k' }),
  F('albicocche_secche', 'Albicocche secche', 'C', A.FRUTTA, 286, 5, 66.5, 0.5, 'v', { src: 'CREA', st: 'k' }),

  /* ---------------- VERDURA (peso a crudo) ---------------- */
  F('verdure_miste', 'Verdure miste di stagione', 'V', A.VERDURA, 26, 1.8, 3.1, 0.3, 'v', { src: 'CREA', st: 'r', alt: 'contorno insalata' }),
  F('zucchine', 'Zucchine', 'V', A.VERDURA, 16, 1.5, 1.7, 0.1, 'v', { src: 'CREA', st: 'r' }),
  F('pomodori', 'Pomodori', 'V', A.VERDURA, 19, 1.2, 2.8, 0.2, 'v', { src: 'CREA', st: 'r', alt: 'ciliegini datterini' }),
  F('insalata', 'Insalata / Lattuga', 'V', A.VERDURA, 22, 1.8, 2.2, 0.4, 'v', { src: 'CREA', st: 'r', alt: 'iceberg valeriana' }),
  F('rucola', 'Rucola', 'V', A.VERDURA, 30, 2.6, 3.9, 0.3, 'v', { src: 'CREA', st: 'r' }),
  F('spinaci', 'Spinaci', 'V', A.VERDURA, 35, 3.4, 2.9, 0.7, 'v', { src: 'CREA', st: 'r' }),
  F('broccoli', 'Broccoli', 'V', A.VERDURA, 33, 3, 3.1, 0.4, 'v', { src: 'CREA', st: 'r' }),
  F('cavolfiore', 'Cavolfiore', 'V', A.VERDURA, 30, 3.2, 2.7, 0.2, 'v', { src: 'CREA', st: 'r' }),
  F('verza', 'Verza / Cavolo cappuccio', 'V', A.VERDURA, 29, 2, 3.8, 0.1, 'v', { src: 'CREA', st: 'r' }),
  F('cavolo_nero', 'Cavolo nero / Kale', 'V', A.VERDURA, 35, 3, 4, 0.6, 'v', { st: 'r' }),
  F('carote', 'Carote', 'V', A.VERDURA, 41, 1.1, 7.6, 0.2, 'v', { src: 'CREA', st: 'r', u: ['carota media', 80] }),
  F('peperoni', 'Peperoni', 'V', A.VERDURA, 26, 0.9, 4.2, 0.3, 'v', { src: 'CREA', st: 'r' }),
  F('melanzane', 'Melanzane', 'V', A.VERDURA, 23, 1, 2.6, 0.4, 'v', { src: 'CREA', st: 'r' }),
  F('finocchi', 'Finocchi', 'V', A.VERDURA, 15, 1.2, 1.5, 0, 'v', { src: 'CREA', st: 'r' }),
  F('cetrioli', 'Cetrioli', 'V', A.VERDURA, 16, 0.7, 1.8, 0.5, 'v', { src: 'CREA', st: 'r' }),
  F('fagiolini', 'Fagiolini', 'V', A.VERDURA, 24, 2.1, 2.4, 0.1, 'v', { src: 'CREA', st: 'r' }),
  F('asparagi', 'Asparagi', 'V', A.VERDURA, 28, 3, 3, 0.1, 'v', { src: 'CREA', st: 'r' }),
  F('funghi', 'Funghi champignon', 'V', A.VERDURA, 24, 3.7, 0.8, 0.2, 'v', { src: 'CREA', st: 'r' }),
  F('cipolla', 'Cipolla', 'V', A.VERDURA, 28, 1, 5.7, 0.1, 'v', { src: 'CREA', st: 'r' }),
  F('carciofi', 'Carciofi', 'V', A.VERDURA, 33, 2.7, 2.5, 0.2, 'v', { src: 'CREA', st: 'r' }),
  F('zucca', 'Zucca', 'V', A.VERDURA, 29, 1.1, 3.5, 0.1, 'v', { src: 'CREA', st: 'r' }),
  F('bieta', 'Bietole / Erbette', 'V', A.VERDURA, 15, 1.3, 1.8, 0.1, 'v', { src: 'CREA', st: 'r' }),
  F('passata', 'Passata di pomodoro', 'V', A.VERDURA, 21, 1.3, 3, 0.2, 'v', { src: 'CREA', st: 'k', alt: 'sugo pomodoro' }),

  /* ---------------- FRUTTA SECCA E SEMI ---------------- */
  F('mandorle', 'Mandorle', 'G', A.SECCA, 628, 22, 4.6, 55.3, 'v', { src: 'CREA', st: 'k', u: ['mandorla', 1.2] }),
  F('noci', 'Noci', 'G', A.SECCA, 702, 14.3, 5.1, 68.1, 'v', { src: 'CREA', st: 'k', u: ['gheriglio', 4] }),
  F('nocciole', 'Nocciole', 'G', A.SECCA, 671, 13.8, 6.1, 64.1, 'v', { src: 'CREA', st: 'k' }),
  F('anacardi', 'Anacardi', 'G', A.SECCA, 604, 15, 33, 46, 'v', { src: 'CREA', st: 'k' }),
  F('pistacchi', 'Pistacchi sgusciati', 'G', A.SECCA, 629, 18.1, 8.1, 56.1, 'v', { src: 'CREA', st: 'k' }),
  F('arachidi', 'Arachidi tostate', 'G', A.SECCA, 620, 29, 8.5, 50, 'v', { src: 'CREA', st: 'k', alt: 'noccioline' }),
  F('burro_arachidi', "Burro d'arachidi 100%", 'G', A.SECCA, 625, 24.9, 8, 53.7, 'v', { src: 'CREA', st: 'k', u: ['cucchiaino', 10], alt: 'peanut butter' }),
  F('crema_mandorle', 'Crema di mandorle / nocciole 100%', 'G', A.SECCA, 615, 21, 9, 55, 'v', { st: 'k', u: ['cucchiaino', 10] }),
  F('semi_chia', 'Semi di chia', 'G', A.SECCA, 486, 17, 8, 31, 'v', { st: 'k', u: ['cucchiaio', 10] }),
  F('semi_lino', 'Semi di lino', 'G', A.SECCA, 534, 18, 2, 42, 'v', { st: 'k', u: ['cucchiaio', 10] }),
  F('semi_zucca', 'Semi di zucca', 'G', A.SECCA, 559, 30, 5, 49, 'v', { st: 'k' }),
  F('semi_girasole', 'Semi di girasole', 'G', A.SECCA, 584, 21, 11, 51, 'v', { st: 'k' }),
  F('cocco', 'Cocco rapè', 'G', A.SECCA, 669, 5.6, 16.4, 62, 'v', { src: 'CREA', st: 'k' }),
  F('cioccolato85', 'Cioccolato fondente 85%', 'G', A.SECCA, 584, 11, 19, 50, 'v', { st: 'k', u: ['quadratino', 5] }),
  F('cioccolato70', 'Cioccolato fondente 70%', 'G', A.SECCA, 560, 8, 34, 42, 'v', { st: 'k', u: ['quadratino', 5] }),

  /* ---------------- CONDIMENTI E SALSE ---------------- */
  F('olio', "Olio extravergine d'oliva", 'G', A.COND, 899, 0, 0, 99.9, 'v', { src: 'CREA', st: 'k', u: ['cucchiaio', 10], alt: 'evo' }),
  F('avocado', 'Avocado', 'G', A.COND, 238, 4.4, 1.8, 23, 'v', { src: 'CREA', st: 'k', u: ['mezzo avocado', 70] }),
  F('olive', 'Olive (denocciolate)', 'G', A.COND, 196, 1.2, 0.9, 20.1, 'v', { src: 'CREA', st: 'k', u: ['oliva', 4] }),
  F('pesto', 'Pesto alla genovese', 'G', A.COND, 460, 5, 6, 45, 'd', { st: 'k', u: ['cucchiaio', 15] }),
  F('hummus', 'Hummus', 'G', A.COND, 200, 7, 12, 14, 'v', { st: 'k', u: ['cucchiaio', 20] }),
  F('maionese', 'Maionese', 'G', A.COND, 680, 1, 1, 75, 'o', { st: 'k', u: ['cucchiaio', 15] }),

  /* ---------------- DISPENSA ---------------- */
  F('miele', 'Miele', 'C', A.DISP, 304, 0.3, 82, 0, 'o', { st: 'k', u: ['cucchiaino', 7] }),
  F('marmellata', 'Marmellata / Confettura', 'C', A.DISP, 220, 0.4, 54, 0.1, 'v', { st: 'k', u: ['cucchiaino', 10] }),
  F('zucchero', 'Zucchero', 'C', A.DISP, 392, 0, 100, 0, 'v', { st: 'k', u: ['cucchiaino', 5] }),

  /* ---------------- INTEGRATORI ---------------- */
  F('whey', 'Proteine whey isolate', 'P', A.INTEG, 370, 85, 3, 1.5, 'd', { st: 'k', u: ['misurino', 30], max: 60 }),
  F('caseine', 'Proteine caseine', 'P', A.INTEG, 360, 80, 5, 1.5, 'd', { st: 'k', u: ['misurino', 30], max: 60 }),
  F('proteine_veg', 'Proteine vegetali (pisello/riso)', 'P', A.INTEG, 380, 80, 4, 6, 'v', { st: 'k', u: ['misurino', 30], max: 60 }),
  F('barretta', 'Barretta proteica', 'P', A.INTEG, 360, 30, 38, 10, 'd', { st: 'k', u: ['barretta', 55], max: 110 })
];

/* ==========================================================================
   PASTI LIBERI: preset forfettari realistici (valori medi indicativi).
   Servono a registrare senza calcoli, non a giudicare.
   ========================================================================== */
const FREE_MEAL_PRESETS = [
  { id: 'pizza', emoji: '🍕', name: 'Pizza in pizzeria', kcal: 900, p: 35, c: 120, g: 30 },
  { id: 'burger', emoji: '🍔', name: 'Hamburger e patatine', kcal: 1100, p: 40, c: 105, g: 58 },
  { id: 'sushi', emoji: '🍣', name: 'Sushi all you can eat', kcal: 1500, p: 65, c: 230, g: 35 },
  { id: 'ristorante', emoji: '🍽️', name: 'Cena completa al ristorante', kcal: 1200, p: 55, c: 120, g: 52 },
  { id: 'pranzo_fuori', emoji: '🍝', name: 'Pranzo fuori (primo + secondo)', kcal: 1000, p: 50, c: 110, g: 38 },
  { id: 'kebab', emoji: '🌯', name: 'Kebab o piadina farcita', kcal: 850, p: 40, c: 80, g: 40 },
  { id: 'aperitivo', emoji: '🥂', name: 'Aperitivo / Apericena', kcal: 800, p: 25, c: 75, g: 42 },
  { id: 'festa', emoji: '🎉', name: 'Pranzo della festa', kcal: 1600, p: 70, c: 170, g: 68 },
  { id: 'colazione_bar', emoji: '☕', name: 'Colazione al bar', kcal: 400, p: 8, c: 55, g: 16 },
  { id: 'dolce', emoji: '🍨', name: 'Dolce o gelato', kcal: 400, p: 6, c: 50, g: 19 }
];
