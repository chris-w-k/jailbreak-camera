/**
 * JAILBREAK: CAMERA — interface strings.
 *
 * Chrome only. Two things deliberately stay English in every language, because
 * an English voice reads them aloud: the punk's asks (from stages.js) and the
 * judge's one-line reactions.
 *
 * Spanish, Portuguese and Turkish are written in plain international forms
 * rather than a strongly regional register. These translations have not been
 * reviewed by a native speaker — treat them as prototype quality.
 *
 * Loaded as a separate file so a wording change is a small diff rather than a
 * 60KB one, and so a missing or blocked fetch degrades to English rather than
 * taking the page down.
 */
window.I18N = {
  // Order here is the order of the chips on the title screen.
  langs: [
    { code: 'en', label: 'ENGLISH',    locale: 'en-GB' },
    { code: 'es', label: 'ESPAÑOL',    locale: 'es' },
    { code: 'pt', label: 'PORTUGUÊS',  locale: 'pt' },
    { code: 'tr', label: 'TÜRKÇE',     locale: 'tr' },
  ],

  strings: {
    en: {
      say_hint: 'TAP TO HEAR IT',
      lang_prompt: 'LANGUAGE',
      title_tag: 'HE CAN’T REACH ANYTHING. YOU CAN.',
      title_start: 'BREAK HIM OUT',
      title_foot: 'FIND IT · SHOOT IT · GET OUT',

      gate_title: 'RESTRICTED AREA',
      gate_hint: 'ACCESS CODE',
      gate_go: 'UNLOCK',

      cam_title: 'CAMERA CHECK',
      cam_why: 'This game is played with the camera on the back of your phone. He’ll ask you for real things — you find them in the room you’re in and hold them up.',
      cam_privacy: 'Photos are looked at once, then thrown away. Nothing is saved, stored or sent anywhere else.',
      cam_allow: 'TURN ON THE CAMERA',
      cam_denied: 'No camera, no problem — you can pick a photo instead.',
      cam_pick: 'CHOOSE A PHOTO',
      cam_retry: 'TRY THE CAMERA AGAIN',
      // Shown when the device will not put the camera feed inside the page, so
      // the shot is taken in the phone's own camera instead.
      cam_native: 'This phone opens the camera full screen — snap it there and you’re straight back.',

      hud_stage: 'STAGE {n}/{total}',
      // The punk's own words, so English in every language — same rule as the
      // asks in stages.js, because an English voice is reading them aloud.
      intro_1: 'Oh no mate, I’m never going to make the show at this rate...',
      intro_2: 'I’ve gotta get out of here!!',
      intro_next: 'NEXT',
      intro_go: 'LET’S GO',
      intro_skip: 'SKIP THE INTRO',

      brief_go: 'OPEN CAMERA',
      cam_shoot: 'SHOOT IT',
      cam_switch: 'PICK A PHOTO INSTEAD',
      cam_hint: 'HOLD IT UP AND FILL THE FRAME',

      judging: 'DEVELOPING',
      judging_notes: ['HE’S HAVING A LOOK...', 'SQUINTING AT IT...', 'TURNING IT OVER...'],

      verdict_pass: 'THAT’LL DO',
      verdict_fail: 'NOT A CHANCE',
      verdict_unreadable: 'CAN’T SEE IT',
      verdict_error: 'HOLD ON',
      verdict_timeout: 'OUT OF TIME',
      free_retry: 'FREE GO — THAT ONE DIDN’T COUNT',
      attempts_left: '{n} LEFT',
      last_chance: 'LAST CHANCE',
      retry: 'GO AGAIN',
      onward: 'GO ON THEN',

      caught_title: 'CAUGHT',
      caught_sub: 'Three strikes and the guard was already behind you.',
      caught_far: 'YOU GOT TO {scene}',
      escaped_title: 'OUT!',
      escaped_sub: 'Seven rooms, seven things you found lying around. Not bad.',
      restart: 'GO AGAIN',
      // Only ever seen inside the app, where finishing completes the quest.
      finish: 'FINISH',
      finish_wait: 'Finishing up — tap again if nothing happens.',

      evidence_title: 'THE EVIDENCE',
      evidence_tap: 'WHAT YOU ACTUALLY HANDED HIM',

      err_system: 'SYSTEM ERROR',
      err_camera: 'CAMERA UNAVAILABLE',
      err_try: 'TRY AGAIN',
      err_new: 'START A NEW RUN',
    },

    es: {
      say_hint: 'TOCA PARA OÍRLO',
      lang_prompt: 'IDIOMA',
      title_tag: 'ÉL NO ALCANZA NADA. TÚ SÍ.',
      title_start: 'SÁCALO DE AHÍ',
      title_foot: 'BÚSCALO · FOTOGRÁFIALO · SAL',

      gate_title: 'ZONA RESTRINGIDA',
      gate_hint: 'CÓDIGO DE ACCESO',
      gate_go: 'ENTRAR',

      cam_title: 'PRUEBA DE CÁMARA',
      cam_why: 'Este juego se juega con la cámara trasera del móvil. Él te pedirá cosas reales: búscalas en la habitación donde estás y enséñaselas.',
      cam_privacy: 'Las fotos se miran una vez y se descartan. No se guarda ni se envía nada a ningún sitio.',
      cam_allow: 'ACTIVAR LA CÁMARA',
      cam_denied: 'Sin cámara no pasa nada: puedes elegir una foto.',
      cam_pick: 'ELEGIR UNA FOTO',
      cam_retry: 'PROBAR LA CÁMARA OTRA VEZ',
      cam_native: 'Este móvil abre la cámara a pantalla completa: haz la foto ahí y volverás enseguida.',

      hud_stage: 'FASE {n}/{total}',
      intro_next: 'SIGUIENTE',
      intro_go: '¡VAMOS!',
      intro_skip: 'SALTAR LA INTRO',

      brief_go: 'ABRIR LA CÁMARA',
      cam_shoot: 'FOTO',
      cam_switch: 'MEJOR ELEGIR UNA FOTO',
      cam_hint: 'SUJÉTALO Y LLENA EL ENCUADRE',

      judging: 'REVELANDO',
      judging_notes: ['LE ESTÁ ECHANDO UN OJO...', 'ENTORNANDO LOS OJOS...', 'DÁNDOLE VUELTAS...'],

      verdict_pass: 'ESO SIRVE',
      verdict_fail: 'NI DE BROMA',
      verdict_unreadable: 'NO LO VEO',
      verdict_error: 'UN MOMENTO',
      verdict_timeout: 'SE ACABÓ EL TIEMPO',
      free_retry: 'TIRO GRATIS: ESA NO CONTÓ',
      attempts_left: 'QUEDAN {n}',
      last_chance: 'ÚLTIMA OPORTUNIDAD',
      retry: 'OTRA VEZ',
      onward: 'VENGA, VAMOS',

      caught_title: 'TE PILLARON',
      caught_sub: 'Tres fallos y el guardia ya estaba detrás de ti.',
      caught_far: 'LLEGASTE A {scene}',
      escaped_title: '¡FUERA!',
      escaped_sub: 'Siete salas, siete cosas que tenías por ahí tiradas. No está mal.',
      restart: 'OTRA VEZ',
      finish: 'TERMINAR',
      finish_wait: 'Terminando: toca otra vez si no pasa nada.',

      evidence_title: 'LAS PRUEBAS',
      evidence_tap: 'LO QUE LE PASASTE DE VERDAD',

      err_system: 'ERROR DEL SISTEMA',
      err_camera: 'CÁMARA NO DISPONIBLE',
      err_try: 'REINTENTAR',
      err_new: 'EMPEZAR DE NUEVO',
    },

    pt: {
      say_hint: 'TOQUE PARA OUVIR',
      lang_prompt: 'IDIOMA',
      title_tag: 'ELE NÃO ALCANÇA NADA. VOCÊ ALCANÇA.',
      title_start: 'TIRE ELE DE LÁ',
      title_foot: 'ACHE · FOTOGRAFE · FUJA',

      gate_title: 'ÁREA RESTRITA',
      gate_hint: 'CÓDIGO DE ACESSO',
      gate_go: 'DESBLOQUEAR',

      cam_title: 'TESTE DE CÂMERA',
      cam_why: 'Este jogo usa a câmera de trás do celular. Ele vai pedir coisas reais: encontre no lugar onde você está e mostre para ele.',
      cam_privacy: 'As fotos são vistas uma vez e descartadas. Nada é salvo, guardado ou enviado para outro lugar.',
      cam_allow: 'LIGAR A CÂMERA',
      cam_denied: 'Sem câmera, sem problema: você pode escolher uma foto.',
      cam_pick: 'ESCOLHER UMA FOTO',
      cam_retry: 'TENTAR A CÂMERA DE NOVO',
      cam_native: 'Este celular abre a câmera em tela cheia: tire a foto ali e você volta na hora.',

      hud_stage: 'FASE {n}/{total}',
      intro_next: 'SEGUINTE',
      intro_go: 'VAMOS LÁ',
      intro_skip: 'PULAR A INTRO',

      brief_go: 'ABRIR A CÂMERA',
      cam_shoot: 'FOTOGRAFAR',
      cam_switch: 'ESCOLHER UMA FOTO',
      cam_hint: 'SEGURE E PREENCHA O QUADRO',

      judging: 'REVELANDO',
      judging_notes: ['ELE ESTÁ OLHANDO...', 'APERTANDO OS OLHOS...', 'VIRANDO DE LADO...'],

      verdict_pass: 'ISSO SERVE',
      verdict_fail: 'SEM CHANCE',
      verdict_unreadable: 'NÃO CONSIGO VER',
      verdict_error: 'ESPERA AÍ',
      verdict_timeout: 'TEMPO ESGOTADO',
      free_retry: 'DE GRAÇA: ESSA NÃO CONTOU',
      attempts_left: 'FALTAM {n}',
      last_chance: 'ÚLTIMA CHANCE',
      retry: 'DE NOVO',
      onward: 'VAMBORA',

      caught_title: 'PEGARAM VOCÊ',
      caught_sub: 'Três erros e o guarda já estava atrás de você.',
      caught_far: 'VOCÊ CHEGOU EM {scene}',
      escaped_title: 'FUGIU!',
      escaped_sub: 'Sete salas, sete coisas que estavam ali jogadas. Nada mal.',
      restart: 'DE NOVO',
      finish: 'CONCLUIR',
      finish_wait: 'Finalizando: toque outra vez se nada acontecer.',

      evidence_title: 'AS PROVAS',
      evidence_tap: 'O QUE VOCÊ REALMENTE ENTREGOU',

      err_system: 'ERRO DE SISTEMA',
      err_camera: 'CÂMERA INDISPONÍVEL',
      err_try: 'TENTAR DE NOVO',
      err_new: 'COMEÇAR DE NOVO',
    },

    tr: {
      say_hint: 'DİNLEMEK İÇİN DOKUN',
      lang_prompt: 'DİL',
      title_tag: 'O HİÇBİR ŞEYE UZANAMIYOR. SEN UZANABİLİRSİN.',
      title_start: 'ONU KAÇIR',
      title_foot: 'BUL · ÇEK · KAÇ',

      gate_title: 'YASAK BÖLGE',
      gate_hint: 'ERİŞİM KODU',
      gate_go: 'AÇ',

      cam_title: 'KAMERA KONTROLÜ',
      cam_why: 'Bu oyun telefonunun arka kamerasıyla oynanır. Senden gerçek şeyler isteyecek: bulunduğun odada bul ve ona göster.',
      cam_privacy: 'Fotoğraflara bir kez bakılır, sonra atılır. Hiçbir şey kaydedilmez, saklanmaz ya da başka bir yere gönderilmez.',
      cam_allow: 'KAMERAYI AÇ',
      cam_denied: 'Kamera yoksa sorun değil, bir fotoğraf seçebilirsin.',
      cam_pick: 'FOTOĞRAF SEÇ',
      cam_retry: 'KAMERAYI TEKRAR DENE',
      cam_native: 'Bu telefon kamerayı tam ekran açar: fotoğrafı orada çek, hemen geri dönersin.',

      hud_stage: 'BÖLÜM {n}/{total}',
      intro_next: 'SONRAKİ',
      intro_go: 'HADİ GİDELİM',
      intro_skip: 'GİRİŞİ ATLA',

      brief_go: 'KAMERAYI AÇ',
      cam_shoot: 'ÇEK',
      cam_switch: 'FOTOĞRAF SEÇ',
      cam_hint: 'TUT VE KAREYİ DOLDUR',

      judging: 'BANYO EDİLİYOR',
      judging_notes: ['BİR BAKIYOR...', 'GÖZLERİNİ KISIYOR...', 'ÇEVİRİP BAKIYOR...'],

      verdict_pass: 'BU İŞ GÖRÜR',
      verdict_fail: 'ASLA OLMAZ',
      verdict_unreadable: 'GÖREMİYORUM',
      verdict_error: 'BİR SANİYE',
      verdict_timeout: 'SÜRE DOLDU',
      free_retry: 'BEDAVA HAK: O SAYILMADI',
      attempts_left: '{n} KALDI',
      last_chance: 'SON ŞANS',
      retry: 'TEKRAR DENE',
      onward: 'HADİ GİDELİM',

      caught_title: 'YAKALANDIN',
      caught_sub: 'Üç hata ve gardiyan çoktan arkandaydı.',
      caught_far: '{scene} BÖLÜMÜNE KADAR GELDİN',
      escaped_title: 'KAÇTI!',
      escaped_sub: 'Yedi oda, etrafta duran yedi şey. Fena değil.',
      restart: 'TEKRAR DENE',
      finish: 'BİTİR',
      finish_wait: 'Bitiriliyor: bir şey olmazsa tekrar dokun.',

      evidence_title: 'KANITLAR',
      evidence_tap: 'ONA GERÇEKTEN NE VERDİN',

      err_system: 'SİSTEM HATASI',
      err_camera: 'KAMERA KULLANILAMIYOR',
      err_try: 'TEKRAR DENE',
      err_new: 'YENİ BİR TUR BAŞLAT',
    },
  },
};
