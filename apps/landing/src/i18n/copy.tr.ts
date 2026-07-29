/** Every user-visible string on the page, in Turkish.
 *
 *  Rewritten rather than translated: same message and structure as copy.en.ts, phrased the
 *  way Turkish marketing copy is phrased. Where a literal rendering read stiff, the line was
 *  rewritten — the hero headline especially.
 *
 *  Declared as `Copy`, so a key that goes missing here fails the build. */
import type { Copy } from "./types";

export const copy: Copy = {
  meta: {
    title: "Sentezy — kamerasız dikey video",
    description: "Bir ürün linki ya da iki cümle yapıştırın; sunucusu, sesi, altyazısı ve müziğiyle bitmiş bir dikey video alın. Reels, TikTok ve Shorts'a hazır. Başlamak ücretsiz.",
  },

  nav: {
    platform: "Seçenekler",
    showcase: "Örnekler",
    how: "Nasıl çalışır",
    login: "Giriş yap",
    cta: "Ücretsiz başla",
    language: "Dil",
  },

  footer: {
    tagline: "İşletmeniz için kamerasız dikey video.",
    productHead: "Ürün",
    presenters: "Sunucular",
    captions: "Altyazılar",
    music: "Müzik",
    solutionsHead: "Sektörler",
    legalHead: "Yasal",
    privacy: "Gizlilik",
    terms: "Koşullar",
    instagramHead: "Instagram",
  },

  hero: {
    /* Berkan'ın yazdığı başlık. Ürünü bir cümlede değil, tek bir tamlamada adlandırıyor —
       üstündeki "KAMERASIZ DİKEY VİDEO" eyebrow'u kaldırıldığı için iddianın tamamını tek
       başına taşımak zorunda. İngilizce ikizi bunun ardından yazıldı; biri değişirse diğeri
       de değişmeli. */
    title: "Fotoğraflarınızı konuşturan yapay zeka",
    /* İki cümle. Öncesi dört cümleydi ve telefonda yedi satır tutuyordu; demoyu ekranın
       altına itiyordu ki bu hero'nun baştan yazılma sebebi tam olarak buydu. Müzik, önizleme,
       tek dosya, beş dakika — hepsi sayfanın devamında duruyor. */
    lead: "Bir ürün linki yapıştırın ya da kendi fotoğraflarınızı yükleyin. Sunucuyu, sesi ve altyazıyı seçin; dikey videonuz dakikalar içinde hazır.",
    ctaPrimary: "İlk videonuzu yapın",
    ctaSecondary: "Gerçek örnekleri izleyin",
    microcopy: "İlk videolarınız ücretsiz. Kart istemiyoruz.",
  },

  /* Uygulamanın kendisi İngilizce; buradaki etiketler o ekranın Türkçe karşılığı, birebir
     çevirisi değil. "Sunucu" = presenter, "Kitaplık" = library — ürünün Türkçe konuşurken
     kullandığı sözlük. `steps` satırı hiç arayüz okumayan birine bile hikâyeyi anlatmak
     zorunda: yükle → yaz → seç → hazır. */
  heroDemo: {
    dashTitle: "Bugün ne hazırlıyoruz?",
    dashLead: "Bir ürün linki yapıştırın ya da kendi fotoğraf ve videolarınızı yükleyin",
    nav: { home: "Ana sayfa", library: "Videolarınız", presenters: "Sunucular", brand: "Marka Kiti" },
    credits: "30 kredi",
    tabLink: "Ürün linki",
    tabUpload: "Medya yükle",
    dropTitle: "Videolarınızı ya da fotoğraflarınızı buraya bırakın",
    dropHint: ".mp4, .mov, .jpg ya da .png",
    clipsReady: "3 klip hazır",
    scriptPlaceholder: "Video ne desin? Buraya yazın…",
    script: "Bu mont su geçirmez, çantanıza sığar ve bu hafta %40 indirimde.",
    options: "Video seçenekleri",
    menuPresenter: "Sunucu",
    menuVoice: "Ses",
    menuMusic: "Müzik",
    menuCaptions: "Altyazı",
    menuNone: "seçilmedi",
    voiceValue: "Rene",
    preview: "Önizle",
    make: "Videoyu oluştur",
    making: "Başlatılıyor…",
    pickPresenter: "Sunucunuzu seçin",
    pickCaption: "Altyazı stilini seçin",
    ready: "Videonuz hazır",
    download: "İndir",
    steps: ["Medyanızı yükleyin", "Cümlenizi yazın", "Sunucu ve altyazı seçin", "Reels'iniz hazır"],
  },

  proof: [
    { n: "126", label: "Seçebileceğiniz sunucu" },
    { n: "24", label: "Hazırlandıkları sektör" },
    { n: "20", label: "Altyazı stili" },
    { n: "14", label: "Kesme ve geçiş" },
  ],

  sectors: {
    eyebrow: "KİMLER İÇİN",
    /* Eski hâli: "Müşterileriniz kaydırıyorsa, işinizi bulun." — iki yarısı birbiriyle
       ilgisiz bir koşul cümlesiydi; İngilizcesi kadar Türkçesi de anlaşılmıyordu. */
    title: "Sizin işiniz için hazırlandı.",
    lead: "Yirmi dört iş kolu, her biri işine göre giyinmiş sunucularla.",
    items: [
      { key: "beauty", name: "Güzellik & Kuaför", body: "Öncesi–sonrası, indirimler ve boş randevular." },
      { key: "tech", name: "Teknoloji & Yazılım", body: "Yeni özellikler, on beş saniyede anlatılmış." },
      { key: "realestate", name: "Emlak", body: "Her yeni ilan, listelendiği gün videosuna kavuşur." },
      { key: "fitness", name: "Spor Salonu", body: "Ders programları, değişim hikâyeleri, kampanyalar." },
      { key: "restaurant", name: "Restoran & Kafe", body: "Bugünün menüsü, bu akşamın masası, bu haftanın spesiyali." },
      { key: "fashion", name: "Moda & Butik", body: "Yeni gelenler rafta ve akışta." },
      { key: "dental", name: "Diş Kliniği", body: "Tedaviler, bekleme odası broşürü olmadan anlatılıyor." },
      { key: "health", name: "Sağlık & Klinik", body: "Randevular, kontroller ve sizi neyin beklediği." },
      { key: "pharmacy", name: "Eczane", body: "Mevsim önerileri ve şu an stokta olanlar." },
      { key: "education", name: "Eğitim & Kurslar", body: "Kayıt dönemleri ve kursun neleri kapsadığı." },
      { key: "legal", name: "Hukuk & Danışmanlık", body: "Haftada bir soru, net bir cevap." },
      { key: "finance", name: "Finans & Muhasebe", body: "Son tarihler, teşvikler ve sade cevaplar." },
      { key: "automotive", name: "Otomotiv", body: "Yeni gelenler, test sürüşleri ve servis fırsatları." },
      { key: "travel", name: "Seyahat & Turizm", body: "Turlar ve otel geceleri anlatılmıyor, gösteriliyor." },
      { key: "jewelry", name: "Kuyumculuk", body: "Yeni parçalar, yakın plan, ışık üzerlerindeyken." },
      { key: "optics", name: "Optik", body: "Sezonun çerçeveleri ve ikinci gözlük fırsatları." },
      { key: "petshop", name: "Pet Shop", body: "Mama, bakım ve haftanın yeni ürünleri." },
      { key: "construction", name: "İnşaat", body: "Devam eden projeler ve teslim edilen işler." },
      { key: "wedding", name: "Düğün & Organizasyon", body: "Mekânlar, paketler ve hâlâ boş olan tarihler." },
      { key: "cosmetics", name: "Kozmetik & Cilt Bakımı", body: "Rutinler, içerikler ve gerçekten değişen şeyler." },
      { key: "corporate", name: "Kurumsal", body: "Basın bülteni gibi okunmayan duyurular." },
      { key: "influencer", name: "Yaşam & İçerik Üreticileri", body: "Her gün çekim yapmadan her gün paylaşım." },
      { key: "ecommerce", name: "E-ticaret", body: "Her ürüne bir video, doğrudan linkten." },
      { key: "coaching", name: "Koçluk", body: "Video başına tek fikir, haftalık ritimde." },
    ],
  },

  showcase: {
    eyebrow: "ÖRNEKLER",
    title: "Bunlar Sentezy ile yapıldı.",
    lead: "Metin, sunucu, ses, altyazı ve kurgu. Kamera yok, stüdyo yok, kurgucu yok. Sesini duymak için birine dokunun.",
    follow: "@sentezy.ai hesabını takip edin",
    soundOff: "Ses için dokunun",
    soundOn: "Ses açık",
  },

  how: {
    eyebrow: "NASIL ÇALIŞIR",
    title: "Üç adım. Yaklaşık beş dakika.",
    steps: [
      {
        n: "01",
        title: "Link yapıştırın ya da kendi çekimlerinizi getirin",
        body: "Sentezy'ye bir ürün linki verin; sayfadaki fotoğrafları ve videoları çeker, metni yazar. Ya da kendi görüntülerinizi yükleyip iki cümle yazın.",
      },
      {
        n: "02",
        title: "Nasıl görüneceğini ve duyulacağını seçin",
        body: "Sunucu, ses, altyazı, müzik ve klipler arasındaki geçiş. Video render edilmeden önce baştan sona izleyin. Siz beğenene kadar hiçbir ücret işlemez.",
      },
      {
        n: "03",
        title: "İndirin ve paylaşın",
        body: "Altyazıları videoya gömülmüş tek bir dikey MP4 alırsınız. Aynı dosya Instagram Reels, TikTok, YouTube Shorts ve dikey videonun gittiği her yerde çalışır. İstediğiniz hesaptan, kendiniz paylaşırsınız.",
      },
    ],
  },

  platform: {
    eyebrow: "NE SEÇİYORSUNUZ",
    title: "Dört seçim. Tek bitmiş video.",
    lead: "Aşağıdaki her şey, Sentezy'nin içinden seçtiğiniz gerçek katalog.",
    presenters: {
      eyebrow: "SUNUCU",
      title: "Sizin işinizde çalışıyormuş gibi duran biri.",
      body: "24 iş kolunda, işine göre giyinmiş 126 sunucu. Cinsiyete, yaşa veya tesettüre göre filtreleyin. Ya da hiç yüz göstermeyin.",
    },
    voices: {
      eyebrow: "SES",
      title: "Tek kuruş harcamadan kendi cümlelerinizi dinleyin.",
      body: "Metninizi yazın, oynata basın ve kendi kelimelerinizle okunuşunu dinleyin. İngilizce ve Türkçe, altı ton.",
    },
    music: {
      eyebrow: "MÜZİK",
      title: "Sesin altında kalan müzik.",
      body: "Dört ruh halinde, telifsiz on bir parça, sizin belirlediğiniz seviyede. Sunucu konuşurken müzik kısılır. Sessizlik de olur.",
    },
    captions: {
      eyebrow: "ALTYAZI",
      title: "Ses kapalıyken de okunan altyazılar.",
      body: "Videoya gömülür, böylece paylaştığınız her yerde çalışır. Yirmi stil, on üç yazı tipi, on iki renk. Her kelime söylendiği anda yanar.",
      sample: "BU REEL SATAR",
    },
  },

  faq: {
    eyebrow: "SORULAR",
    title: "Başlamadan önce.",
    items: [
      {
        q: "Denemek ne kadar tutuyor?",
        a: "Hiç, kart da istemiyoruz. Kaydolduğunuzda ücretsiz kredi veriyoruz; ilk videolarınız bizden.",
      },
      {
        q: "Bir video ne kadar sürüyor?",
        a: "Bir linkten ya da birkaç cümleden bitmiş dosyaya yaklaşık beş dakika. Bunun çoğu Sentezy render ederken geçiyor, siz çalışırken değil.",
      },
      {
        q: "Kamera, stüdyo ya da kurgu bilgisi gerekiyor mu?",
        a: "Hayır. Videoyu siz anlatır, nasıl görüneceğini seçersiniz; sesi, altyazıyı, müziği ve kesmeleri Sentezy yapar ve size paylaşıma hazır bir dosya verir.",
      },
      {
        q: "Videoları nerede paylaşabilirim?",
        a: "Dikey videonun gittiği her yerde: Instagram Reels, TikTok, YouTube Shorts, Facebook. Tek bir dikey dosya alır, kendiniz paylaşırsınız; Sentezy hiçbirinin şifresini istemez.",
      },
      {
        q: "Verilerim güvende mi? (KVKK/GDPR)",
        a: "Metinleriniz, yüklemeleriniz ve render edilen videolarınız aktarımda ve saklamada şifrelenir; KVKK ve GDPR'a uygun işlenir. Hesabınızı ve tüm medyasını istediğiniz zaman Ayarlar'dan silebilirsiniz.",
      },
    ],
  },

  finalCta: {
    /* Eski hâli: "Bir tane yapın, görün." — "bir tane" neyin bir tanesi olduğunu
       söylemiyordu. */
    title: "Tek bir videoyla deneyin.",
    lead: "Başlamak ücretsiz, kart yok, geri sayım yok. Daha fazlasını isterseniz ödersiniz.",
    cta: "İlk videonuzu yapın",
    microcopy: "Yaklaşık beş dakika sürer.",
  },

  soon: {
    title: "Çok yakında — Sentezy",
    description: "Sentezy neredeyse hazır. Açıldığında haberdar olmak için takipte kalın.",
    eyebrow: "ÇOK YAKINDA",
    heading: "Neredeyse hazırız.",
    body: "Sentezy henüz herkese açık değil. Takipte kalın; ilk videonuzu ne zaman yapabileceğinizi ilk siz öğrenin.",
    follow: "Instagram'da takip edin",
    back: "← Ana sayfaya dön",
  },
  legal: {
    back: "← Ana sayfaya dön",
    updated: "Son güncelleme",
  },
};
