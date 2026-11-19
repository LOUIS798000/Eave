/**
 * Lightweight main-process localization table (tray menu & display labels only).
 * Avoids bundling the 630 KB renderer translation catalog into the Electron main process.
 */
export interface MainLocaleStrings {
  tray: Record<string, string>
  primaryDisplay: string
}

export const MAIN_STRINGS: Record<string, MainLocaleStrings> = {
  "en": {
    "tray": {
      "showClipboard": "Show Clipboard",
      "settings": "Settings",
      "incognito": "Incognito (pause capture)",
      "hoverTrigger": "Hover Trigger (open on hover)",
      "stickTo": "Stick to",
      "left": "Left",
      "right": "Right",
      "top": "Top",
      "bottom": "Bottom",
      "display": "Display",
      "quit": "Quit Eave",
      "welcomeTitle": "Eave Clipboard Shelf",
      "welcomeBody": "Hover against the middle-left screen edge, or press Alt+C to slide open your shelf."
    },
    "primaryDisplay": "Primary Display"
  },
  "es": {
    "tray": {
      "bottom": "Abajo",
      "top": "Arriba",
      "showClipboard": "Mostrar portapapeles",
      "settings": "Configuración",
      "incognito": "Incógnito (pausar captura)",
      "hoverTrigger": "Activación por desplazamiento (abrir al pasar)",
      "stickTo": "Anclar a",
      "left": "Izquierda",
      "right": "Derecha",
      "display": "Pantalla",
      "quit": "Salir de Eave",
      "welcomeTitle": "Panel de portapapeles Eave",
      "welcomeBody": "Pasa el cursor por el centro del borde izquierdo de la pantalla o pulsa Alt+C para deslizar y abrir tu panel."
    },
    "primaryDisplay": "Pantalla principal"
  },
  "fr": {
    "tray": {
      "bottom": "Bas",
      "top": "Haut",
      "showClipboard": "Afficher le presse-papiers",
      "settings": "Paramètres",
      "incognito": "Incognito (suspendre la capture)",
      "hoverTrigger": "Déclencheur au survol (ouvrir au survol)",
      "stickTo": "Coller à",
      "left": "Gauche",
      "right": "Droite",
      "display": "Écran",
      "quit": "Quitter Eave",
      "welcomeTitle": "Étagère de presse-papiers Eave",
      "welcomeBody": "Survolez le milieu du bord gauche de l'écran, ou appuyez sur Alt+C pour ouvrir votre étagère."
    },
    "primaryDisplay": "Écran principal"
  },
  "de": {
    "tray": {
      "bottom": "Unten",
      "top": "Oben",
      "showClipboard": "Zwischenablage anzeigen",
      "settings": "Einstellungen",
      "incognito": " Inkognito (Erfassung pausieren)",
      "hoverTrigger": "Hover-Auslöser (beim Darüberfahren öffnen)",
      "stickTo": "Anheften an",
      "left": "Links",
      "right": "Rechts",
      "display": "Anzeige",
      "quit": "Eave beenden",
      "welcomeTitle": "Eave Zwischenablage-Ablage",
      "welcomeBody": "Fahren Sie mit der Maus an die mittlere linke Bildschirmkante, oder drücken Sie Alt+C, um Ihre Ablage zu öffnen."
    },
    "primaryDisplay": "Hauptanzeige"
  },
  "it": {
    "tray": {
      "bottom": "In basso",
      "top": "In alto",
      "showClipboard": "Mostra appunti",
      "settings": "Impostazioni",
      "incognito": "Incognito (metti in pausa acquisizione)",
      "hoverTrigger": "Attivatore hover (apri al passaggio)",
      "stickTo": "Ancora a",
      "left": "Sinistra",
      "right": "Destra",
      "display": "Schermo",
      "quit": "Esci da Eave",
      "welcomeTitle": "Scaffale appunti Eave",
      "welcomeBody": "Passa il mouse al centro del bordo sinistro dello schermo, o premi Alt+C per aprire lo scaffale."
    },
    "primaryDisplay": "Schermo principale"
  },
  "pt": {
    "tray": {
      "bottom": "Inferior",
      "top": "Superior",
      "showClipboard": "Mostrar área de transferência",
      "settings": "Configurações",
      "incognito": "Anônimo (pausar captura)",
      "hoverTrigger": "Gatilho de hover (abrir ao passar)",
      "stickTo": "Fixar em",
      "left": "Esquerda",
      "right": "Direita",
      "display": "Tela",
      "quit": "Sair do Eave",
      "welcomeTitle": "Prateleira de Área de Transferência Eave",
      "welcomeBody": "Passe o mouse contra o centro da borda esquerda da tela, ou pressione Alt+C para abrir sua prateleira."
    },
    "primaryDisplay": "Tela principal"
  },
  "ru": {
    "tray": {
      "bottom": "Снизу",
      "top": "Сверху",
      "showClipboard": "Показать буфер обмена",
      "settings": "Настройки",
      "incognito": "Инкогнито (приостановить захват)",
      "hoverTrigger": "Триггер наведения (открывать при наведении)",
      "stickTo": "Прикрепить к",
      "left": "Слева",
      "right": "Справа",
      "display": "Экран",
      "quit": "Выйти из Eave",
      "welcomeTitle": "Полка буфера обмена Eave",
      "welcomeBody": "Наведите курсор на середину левого края экрана или нажмите Alt+C, чтобы открыть полку."
    },
    "primaryDisplay": "Основной экран"
  },
  "ja": {
    "tray": {
      "bottom": "下",
      "top": "上",
      "showClipboard": "パネルを表示",
      "settings": "設定",
      "incognito": "クリップボードの取得を一時的に停止",
      "hoverTrigger": "ホバーして表示",
      "stickTo": "パネルの配置位置",
      "left": "左",
      "right": "右",
      "display": "パネルを表示するディスプレイ",
      "quit": "Eave を終了",
      "welcomeTitle": "Eave クリップボードパネル",
      "welcomeBody": "画面左端中央にホバーするか、Alt + C を押してパネルを開きます。"
    },
    "primaryDisplay": "メインディスプレイ"
  },
  "ko": {
    "tray": {
      "bottom": "아래",
      "top": "위",
      "showClipboard": "클립보드 표시",
      "settings": "설정",
      "incognito": "시크릿 (캡처 일시정지)",
      "hoverTrigger": "호버 트리거 (호버 시 열기)",
      "stickTo": "고정 위치",
      "left": "왼쪽",
      "right": "오른쪽",
      "display": "디스플레이",
      "quit": "Eave 종료",
      "welcomeTitle": "Eave 클립보드 선반",
      "welcomeBody": "화면 왼쪽 가장자리 중앙에 호버하거나 Alt+C를 눌러 선반을 여세요."
    },
    "primaryDisplay": "주 디스플레이"
  },
  "zh-CN": {
    "tray": {
      "bottom": "底部",
      "top": "顶部",
      "showClipboard": "显示剪贴板",
      "settings": "设置",
      "incognito": "无痕（暂停捕获）",
      "hoverTrigger": "悬停触发（悬停时打开）",
      "stickTo": "贴附到",
      "left": "左",
      "right": "右",
      "display": "显示器",
      "quit": "退出檐下",
      "welcomeTitle": "檐下剪贴板搁架",
      "welcomeBody": "将鼠标悬停在屏幕左中边缘，或按 Alt+C 滑出打开您的搁架。"
    },
    "primaryDisplay": "主显示器"
  },
  "zh-TW": {
    "tray": {
      "bottom": "下方",
      "top": "上方",
      "showClipboard": "顯示剪貼簿",
      "settings": "設定",
      "incognito": "無痕（暫停擷取）",
      "hoverTrigger": "懸停觸發（懸停時開啟）",
      "stickTo": "貼附到",
      "left": "左",
      "right": "右",
      "display": "顯示器",
      "quit": "結束檐下",
      "welcomeTitle": "檐下剪貼簿層架",
      "welcomeBody": "將滑鼠懸停在螢幕左中邊緣，或按 Alt+C 滑出開啟您的層架。"
    },
    "primaryDisplay": "主顯示器"
  },
  "hi": {
    "tray": {
      "bottom": "नीचे",
      "top": "ऊपर",
      "showClipboard": "क्लिपबोर्ड दिखाएँ",
      "settings": "सेटिंग्स",
      "incognito": "गुप्त (कैप्चर रोकें)",
      "hoverTrigger": "होवर ट्रिगर (होवर पर खोलें)",
      "stickTo": "इस पर चिपकाएँ",
      "left": "बायाँ",
      "right": "दायाँ",
      "display": "डिस्प्ले",
      "quit": "Eave से बाहर",
      "welcomeTitle": "Eave क्लिपबोर्ड शेल्फ़",
      "welcomeBody": "मध्य-बाएँ स्क्रीन किनारे के साथ होवर करें, या अपनी शेल्फ़ खोलने के लिए Alt+C दबाएँ।"
    },
    "primaryDisplay": "प्राथमिक डिस्प्ले"
  },
  "ar": {
    "tray": {
      "bottom": "أسفل",
      "top": "أعلى",
      "showClipboard": "إظهار الحافظة",
      "settings": "الإعدادات",
      "incognito": "التخفي (إيقاف الالتقاط)",
      "hoverTrigger": "تشغيل التحويم (فتح عند التحويم)",
      "stickTo": "إلصاق بـ",
      "left": "يسار",
      "right": "يمين",
      "display": "الشاشة",
      "quit": "إنهاء Eave",
      "welcomeTitle": "رف حافظة Eave",
      "welcomeBody": "حوّم مقابل منتصف الحافة اليسرى للشاشة، أو اضغط Alt+C لفتح رفك."
    },
    "primaryDisplay": "الشاشة الأساسية"
  },
  "fa": {
    "tray": {
      "bottom": "پایین",
      "top": "بالا",
      "showClipboard": "کلیپ‌بورد رو نشون بده",
      "settings": "تنظیمات",
      "incognito": "حالت ناشناس (فعلاً ذخیره نکن)",
      "hoverTrigger": "باز شدن با ماوس",
      "stickTo": "بچسبون به",
      "left": "چپ",
      "right": "راست",
      "display": "نمایشگر",
      "quit": "بستن کامل Eave",
      "welcomeTitle": "قفسه کلیپ‌بورد Eave",
      "welcomeBody": "ماوس رو نزدیک وسط لبه چپ نگه دار یا Alt+C رو بزن تا قفسه باز بشه."
    },
    "primaryDisplay": "نمایشگر اصلی"
  },
  "bn": {
    "tray": {
      "bottom": "নিচে",
      "top": "উপরে",
      "showClipboard": "ক্লিপবোর্ড দেখান",
      "settings": "সেটিংস",
      "incognito": "ইনকগনিটো (ক্যাপচার বিরতি)",
      "hoverTrigger": "হোভার ট্রিগার (হোভারে খুলুন)",
      "stickTo": "এতে সংযুক্ত করুন",
      "left": "বাম",
      "right": "ডান",
      "display": "প্রদর্শন",
      "quit": "Eave থেকে প্রস্থান",
      "welcomeTitle": "Eave ক্লিপবোর্ড শেলফ",
      "welcomeBody": "মাঝ-বাম স্ক্রিন প্রান্তে হোভার করুন, বা আপনার শেলফ খুলতে Alt+C চাপুন।"
    },
    "primaryDisplay": "প্রাথমিক প্রদর্শন"
  },
  "tr": {
    "tray": {
      "bottom": "Alt",
      "top": "Üst",
      "showClipboard": "Panoyu Göster",
      "settings": "Ayarlar",
      "incognito": "Gizli (yakalamayı duraklat)",
      "hoverTrigger": "Üzerine Gelme Tetikleyicisi (gelince aç)",
      "stickTo": "Şuraya sabitle",
      "left": "Sol",
      "right": "Sağ",
      "display": "Ekran",
      "quit": "Eave'tan Çık",
      "welcomeTitle": "Eave Pano Rafı",
      "welcomeBody": "Ekranın sol-orta kenarına gelin veya rafınızı açmak için Alt+C tuşlarına basın."
    },
    "primaryDisplay": "Birincil Ekran"
  },
  "vi": {
    "tray": {
      "bottom": "Dưới",
      "top": "Trên",
      "showClipboard": "Hiển thị Bảng tạm",
      "settings": "Cài đặt",
      "incognito": "Ẩn danh (tạm dừng chụp)",
      "hoverTrigger": "Kích hoạt di chuột (mở khi di chuột)",
      "stickTo": "Dính vào",
      "left": "Trái",
      "right": "Phải",
      "display": "Màn hình",
      "quit": "Thoát Eave",
      "welcomeTitle": "Giá Bảng tạm Eave",
      "welcomeBody": "Di chuột vào giữa mép trái màn hình hoặc nhấn Alt+C để mở giá."
    },
    "primaryDisplay": "Màn hình chính"
  },
  "pl": {
    "tray": {
      "bottom": "Dół",
      "top": "Góra",
      "showClipboard": "Pokaż schowek",
      "settings": "Ustawienia",
      "incognito": "Incognito (wstrzymaj przechwytywanie)",
      "hoverTrigger": "Wyzwalacz najechania (otwórz po najechaniu)",
      "stickTo": "Przyczep do",
      "left": "Lewo",
      "right": "Prawo",
      "display": "Ekran",
      "quit": "Zakończ Eave",
      "welcomeTitle": "Półka schowka Eave",
      "welcomeBody": "Najedź na środek lewej krawędzi ekranu lub naciśnij Alt+C, aby wysunąć półkę."
    },
    "primaryDisplay": "Ekran główny"
  },
  "nl": {
    "tray": {
      "bottom": "Onder",
      "top": "Boven",
      "showClipboard": "Klembord tonen",
      "settings": "Instellingen",
      "incognito": "Incognito (vastleggen pauzeren)",
      "hoverTrigger": "Hover-trigger (openen bij hover)",
      "stickTo": "Vastmaken aan",
      "left": "Links",
      "right": "Rechts",
      "display": "Weergave",
      "quit": "Eave afsluiten",
      "welcomeTitle": "Eave klembordplank",
      "welcomeBody": "Beweeg tegen het midden van de linkerschermrand of druk op Alt+C om je plank te openen."
    },
    "primaryDisplay": "Primaire weergave"
  },
  "sv": {
    "tray": {
      "bottom": "Nederst",
      "top": "Överst",
      "showClipboard": "Visa urklipp",
      "settings": "Inställningar",
      "incognito": "Inkognito (pausa infångning)",
      "hoverTrigger": "Svävningsutlösare (öppna vid svävning)",
      "stickTo": "Fäst vid",
      "left": "Vänster",
      "right": "Höger",
      "display": "Skärm",
      "quit": "Avsluta Eave",
      "welcomeTitle": "Eave urklippshylla",
      "welcomeBody": "Sväv mot mitten av den vänstra skärmkanten eller tryck Alt+C för att skjuta ut din hylla."
    },
    "primaryDisplay": "Primär skärm"
  },
  "id": {
    "tray": {
      "bottom": "Bawah",
      "top": "Atas",
      "showClipboard": "Tampilkan Papan Klip",
      "settings": "Pengaturan",
      "incognito": "Penyamaran (jeda penangkapan)",
      "hoverTrigger": "Pemicu Hover (buka saat hover)",
      "stickTo": "Tempel ke",
      "left": "Kiri",
      "right": "Kanan",
      "display": "Layar",
      "quit": "Keluar dari Eave",
      "welcomeTitle": "Rak Papan Klip Eave",
      "welcomeBody": "Hover di tepi tengah-kiri layar, atau tekan Alt+C untuk membuka rak Anda."
    },
    "primaryDisplay": "Layar Utama"
  },
  "uk": {
    "tray": {
      "bottom": "Внизу",
      "top": "Вгорі",
      "showClipboard": "Показати буфер обміну",
      "settings": "Налаштування",
      "incognito": "Інкогніто (призупинити захоплення)",
      "hoverTrigger": "Тригер наведення (відкривати при наведенні)",
      "stickTo": "Прикріпити до",
      "left": "Ліворуч",
      "right": "Праворуч",
      "display": "Екран",
      "quit": "Вийти з Eave",
      "welcomeTitle": "Полиця буфера обміну Eave",
      "welcomeBody": "Наведіть курсор на середину лівого краю екрана або натисніть Alt+C, щоб відкрити полицю."
    },
    "primaryDisplay": "Основний екран"
  },
  "el": {
    "tray": {
      "bottom": "Κάτω",
      "top": "Πάνω",
      "showClipboard": "Εμφάνιση Προχείρου",
      "settings": "Ρυθμίσεις",
      "incognito": "Υποκρυπτό (παύση καταγραφής)",
      "hoverTrigger": "Εναύσμα αιώρησης (άνοιγμα με αιώρηση)",
      "stickTo": "Προσκόλληση σε",
      "left": "Αριστερά",
      "right": "Δεξιά",
      "display": "Οθόνη",
      "quit": "Έξοδος από το Eave",
      "welcomeTitle": "Ράφι Προχείρου Eave",
      "welcomeBody": "Αιωρηθείτε against τη μέση-αριστερή άκρη οθόνης ή πατήστε Alt+C για να ανοίξετε το ράφι σας."
    },
    "primaryDisplay": "Κύρια οθόνη"
  },
  "cs": {
    "tray": {
      "bottom": "Dolů",
      "top": "Nahoru",
      "showClipboard": "Zobrazit schránku",
      "settings": "Nastavení",
      "incognito": "Inkognito (pozastavit zachytávání)",
      "hoverTrigger": "Spouštěč najetí (otevřít při najetí)",
      "stickTo": "Přichytit k",
      "left": "Vlevo",
      "right": "Vpravo",
      "display": "Obrazovka",
      "quit": "Ukončit Eave",
      "welcomeTitle": "Police schránky Eave",
      "welcomeBody": "Najeďte na střed levého okraje obrazovky nebo stiskněte Alt+C pro vysunutí vaší police."
    },
    "primaryDisplay": "Primární obrazovka"
  },
  "ro": {
    "tray": {
      "bottom": "Jos",
      "top": "Sus",
      "showClipboard": "Arată clipboard",
      "settings": "Setări",
      "incognito": "Incognito (pauză captură)",
      "hoverTrigger": "Declanșator survol (deschide la survol)",
      "stickTo": "Lipește de",
      "left": "Stânga",
      "right": "Dreapta",
      "display": "Ecran",
      "quit": "Ieșire din Eave",
      "welcomeTitle": "Raft clipboard Eave",
      "welcomeBody": "Survolează marginea stângă-centrală a ecranului sau apasă Alt+C pentru a-ți glisa raftul."
    },
    "primaryDisplay": "Ecran principal"
  },
  "hu": {
    "tray": {
      "bottom": "Alul",
      "top": "Felül",
      "showClipboard": "Vágólap megjelenítése",
      "settings": "Beállítások",
      "incognito": "Inkognitó (rögzítés szüneteltetése)",
      "hoverTrigger": "Hover-esemény (nyitás hoverre)",
      "stickTo": "Rögzítés",
      "left": "Bal",
      "right": "Jobb",
      "display": "Képernyő",
      "quit": "Kilépés az Eave-ból",
      "welcomeTitle": "Eave vágólap-polc",
      "welcomeBody": "Húzza az egeret a képernyő bal-középső széle mentén, vagy nyomja meg az Alt+C billentyűt a polc kinyitásához."
    },
    "primaryDisplay": "Elsődleges képernyő"
  },
  "da": {
    "tray": {
      "bottom": "Bund",
      "top": "Top",
      "showClipboard": "Vis udklipsholder",
      "settings": "Indstillinger",
      "incognito": "Incognito (sæt optagelse på pause)",
      "hoverTrigger": "Hover-udløser (åbn ved hover)",
      "stickTo": "Klistr til",
      "left": "Venstre",
      "right": "Højre",
      "display": "Skærm",
      "quit": "Afslut Eave",
      "welcomeTitle": "Eave Udklipsholder-hylde",
      "welcomeBody": "Svæv mod midten af venstre skærmkant, eller tryk Alt+C for at åbne din hylde."
    },
    "primaryDisplay": "Primær skærm"
  },
  "fi": {
    "tray": {
      "bottom": "Alas",
      "top": "Ylös",
      "showClipboard": "Näytä leikepöytä",
      "settings": "Asetukset",
      "incognito": "Incognito (keskeytä kaappaus)",
      "hoverTrigger": "Hover-laukaisin (avaa hoverilla)",
      "stickTo": "Kiinnitä kohtaan",
      "left": "Vasen",
      "right": "Oikea",
      "display": "Näyttö",
      "quit": "Lopeta Eave",
      "welcomeTitle": "Eave leikepöytähylly",
      "welcomeBody": "Vie osoitin näytön vasemman reunan keskikohtaan tai paina Alt+C avataksesi hylly."
    },
    "primaryDisplay": "Ensisijainen näyttö"
  },
  "th": {
    "tray": {
      "bottom": "ด้านล่าง",
      "top": "ด้านบน",
      "showClipboard": "แสดงคลิปบอร์ด",
      "settings": "การตั้งค่า",
      "incognito": "ไม่ระบุตัวตน (หยุดการจับภาพ)",
      "hoverTrigger": "ตัวกระตุ้นการโฮเวอร์ (เปิดเมื่อโฮเวอร์)",
      "stickTo": "ยึดที่",
      "left": "ซ้าย",
      "right": "ขวา",
      "display": "หน้าจอ",
      "quit": "ออกจาก Eave",
      "welcomeTitle": "ชั้นวางคลิปบอร์ด Eave",
      "welcomeBody": "เลื่อนเมาส์ไปที่กึ่งกลางขอบซ้ายของหน้าจอ หรือกด Alt+C เพื่อเปิดชั้นวางของคุณ"
    },
    "primaryDisplay": "จอหลัก"
  },
  "he": {
    "tray": {
      "bottom": "למטה",
      "top": "למעלה",
      "showClipboard": "הצג לוח",
      "settings": "הגדרות",
      "incognito": "גלישה בסתר (השהה לכידה)",
      "hoverTrigger": "מפעיל ריחוף (פתח בריחוף)",
      "stickTo": "הצמד ל",
      "left": "שמאל",
      "right": "ימין",
      "display": "מסך",
      "quit": "צא מ-Eave",
      "welcomeTitle": "מדף לוח הגזירים Eave",
      "welcomeBody": "רחף מול קצה שמאל-אמצע המסך, או לחץ Alt+C כדי להחליק ולפתוח את המדף שלך."
    },
    "primaryDisplay": "מסך ראשי"
  },
  "no": {
    "tray": {
      "bottom": "Bunn",
      "top": "Topp",
      "showClipboard": "Vis utklippstavle",
      "settings": "Innstillinger",
      "incognito": "Inkognito (pause opptak)",
      "hoverTrigger": "Hover-utløser (åpne ved hover)",
      "stickTo": "Fest til",
      "left": "Venstre",
      "right": "Høyre",
      "display": "Skjerm",
      "quit": "Avslutt Eave",
      "welcomeTitle": "Eave utklippstavle-hylle",
      "welcomeBody": "Hold markøren mot midten av venstre skjermkant, eller trykk Alt+C for å skyve ut hyllen din."
    },
    "primaryDisplay": "Primærskjerm"
  }
}
