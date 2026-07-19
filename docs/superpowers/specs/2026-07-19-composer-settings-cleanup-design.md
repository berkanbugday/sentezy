# Ek ayarlar temizliği + ayarların gerçekten çalışması

**Tarih:** 2026-07-19
**Durum:** onaylandı, uygulanmayı bekliyor

## Amaç

"Ek ayarlar" çekmecesi bugün sekiz alan gösteriyor. Bunların bir kısmı gereksiz, bir
kısmı hiç çalışmıyor. Hedef: çekmeceyi dört gerçekten işleyen ayara indirmek, müziği
ses seçici kalitesinde ayrı bir seçiciye taşımak, ve kalan her ayarın **hem önizlemede
hem gerçek render'da** aynı sonucu vermesini garanti etmek.

## Kapsam

| Ayar | Karar |
|---|---|
| En / boy | Kaldır — her video 9:16 |
| Avatar yerleşimi + Avatar tarafı | Tek alana birleştir: Sol / Orta / Sağ |
| Altyazı konumu | Kalır — **bozuk, düzeltilecek** |
| Ses tonu | Kalır — render'da çalışıyor, doğrulanacak |
| Müzik | Çekmeceden çıkar → composer'da `MusicPicker` |
| Geçiş efekti sesi | Kalır — **yanıltıcı, düzeltilecek** |
| Yapay zekâ ses efektleri | Tamamen kaldır (UI + API + worker + varlıklar) |

Çekmecede kalan dört alan: Avatar yerleşimi, Altyazı konumu, Ses tonu, Geçiş efekti sesi.

## Kararlar (kullanıcı onaylı)

1. **aspectRatio** yalnızca UI + payload'dan kalkar. `videos.aspect_ratio` kolonu,
   Prisma enum'u ve worker'ın `RATIO_DIMS` haritası olduğu gibi kalır (default `9:16`).
   Migration yok, mevcut videoların metadata'sı korunur.
2. **AI ses efektleri** tam temizlik — arka uçta ölü kod bırakılmaz.
3. **Müzik kataloğu** mevcut Cloudflare R2 üzerinde kalır; katalog Postgres'te
   `music_catalog` tablosunda tutulur (`avatar_catalog` deseni). Supabase Storage'a
   ikinci bir depolama yolu açılmaz.
4. **Ses tonu önizlemede duyulmaz.** Önizleme sessiz kalır; ton yalnızca gerçek
   render'ı ve VoicePicker'ın kendi ses örneğini etkiler. (Önizlemede TTS üretmek her
   önizlemeye bir ElevenLabs çağrısı maliyeti getirirdi.)
5. **Geçiş efekti sesi** mevcut anlamıyla ("klipler arası geçiş sesi") doğrudur;
   düzeltme UI tarafında — 2'den az medya varken toggle devre dışı bırakılır.

## Doğrulanmış kök nedenler

### Altyazı konumu hiç çalışmıyor

Değer boru hattı boyunca sağlam ilerliyor
(`SettingsDrawer.tsx:97` → `MediaComposer.tsx:267`/`:585` → `pipeline.py:206` →
`reel_remotion.py:42` → `CaptionOverlay.tsx:55`) ve `packages/remotion/src/layout.ts:24`
içinde ölüyor:

```ts
const centerPct = position === "top" ? 26 : 40;
```

`captionBox` `height`, `layout`, `avatarSide` parametrelerini alıp kullanmadan atıyor;
her iki dal da ekran ortasına yakın. libass yolu artık yok (`compose.py` silinmiş), tek
render motoru Remotion — yani düzeltme tek dosyada, önizleme ve render'ı aynı anda
düzeltiyor.

### Geçiş efekti sesi duyulmuyor

Bayrak iki tarafta da doğru okunuyor, `.wav` dosyalarının hepsi yerinde. Sorun kapı
koşulu: `sfxPreview.ts:39` (`broll.length < 2`) ve `audio.py:127`
(`range(1, len(broll))`) aynı şeyi söylüyor — geçiş sesi **klip geçişlerine** bağlı.
Avatar + metin videosunda yüklenen medya olmadığı için hiç geçiş yok, toggle görünürde
ölü. Tek klipte de sessiz (0. klibin gelen geçişi yok).

## Tasarım

### 1. `ComposerSettings` yeni hali

`ComposerSettings` tam olarak çekmecedeki dört kontrole eşitlenir:

```ts
export type ComposerSettings = {
  avatarPosition: "left" | "center" | "right";
  captionPosition: "top" | "bottom";
  voiceEmotion: string;
  transitionSfx: boolean;
};
```

`aspectRatio`, `avatarLayout`, `avatarSide`, `sfxEnabled` alanları kalkar.
Varsayılanlar: `avatarPosition: "right"`, `captionPosition: "bottom"`,
`voiceEmotion: ""`, `transitionSfx: true`.

`musicTrackKey`/`musicVolume` de `ComposerSettings`'ten çıkar: müzik artık çekmecede
değil, composer'da kendi çipiyle yaşıyor — seçili parça ve seviye `MediaComposer`'ın
kendi state'inde durur (`selectedAvatar`/`selectedVoice` ile aynı desen).

### 2. Avatar yerleşimi birleştirme

`options.layout` artık `{ avatarPosition, captionPosition }`.

| Seçim | Avatar hizası | Boş kalan alan |
|---|---|---|
| Sol | sol kenar | sağ yarı |
| Orta | alt-orta (eski "Alt") | üst bant |
| Sağ | sağ kenar | sol yarı |

`AvatarLayer` zaten `avatarLayout === "bottom" ? center : avatarSide` mantığını
yapıyordu; tek prop'a iner.

**Geriye uyum** — worker ve zod şeması eski `options` blob'larını okurken:

```
avatarPosition ?? (avatarLayout === "bottom" ? "center" : (avatarSide ?? "right"))
```

Bu eşleme yalnızca okuma tarafında yaşar; yeni yazılan hiçbir kayıt eski alanları
içermez.

### 3. Altyazı konumu düzeltmesi

`captionBox` gerçek üst/alt bantlarına oturur ve `avatarPosition`'ı dikkate alır:

- **Üst** → blok merkezi kare yüksekliğinin ~%20'sinde.
- **Alt** → avatar yanda (Sol/Sağ) iken ~%78; avatar **Orta** iken avatar alt bandı
  kapladığı için ~%62'ye yükselir.

Altyazı **tam genişlikte ve ortalanmış kalır** — mevcut bilinçli tasarım (`layout.ts`
yorumu: "Big, centred captions: full width"). `captionBoxWidth` değişmez. Bildirilen hata
yalnızca dikey konum; yatay düzeni değiştirmek kapsam dışı bir görsel karar olurdu.

Davranış `packages/remotion/src/layout.test.ts` ile kilitlenir: üst ile alt arasında
belirgin fark, Orta-avatar + alt kombinasyonunda yükselme, hiçbir kutunun kare dışına
taşmaması.

### 4. Ses tonu

Render yolu zaten işliyor (`pipeline.py:147-165` → `emotion.py` LLM etiketleme veya tek
baştaki etiket). Yapılacak: uçtan uca doğrulama ve `applyEmotionTag`'in altı tonun
hepsinde doğru ElevenLabs v3 etiketini ürettiğini gösteren birim testi. Önizleme,
karar 4 gereği sessiz kalır; VoicePicker örneği seçili tonu kullanmaya devam eder.

### 5. Müzik seçici

**Veri.** `apps/api/src/data/music.json` — her kayıt: `slug`, `name`, `mood`,
`moodLabel`, `r2Key`, `durationSec`, `source`, `license`. `avatar_catalog` deseninin
aynısı.

**Şema.** Yeni `music_catalog` tablosu + migration:

```prisma
model CatalogMusic {
  id          String   @id @default(uuid())
  slug        String   @unique
  name        String
  mood        String
  moodLabel   String   @map("mood_label")
  r2Key       String   @map("r2_key")
  durationSec Int      @map("duration_sec")
  source      String
  license     String
  createdAt   DateTime @default(now()) @map("created_at")
  @@index([mood])
  @@map("music_catalog")
}
```

`seed.ts` içine `seedMusicCatalog()` — slug üzerinden idempotent upsert.

**Parça temini.** Telifsiz (CC0 / Pixabay) parçalar bir betikle indirilip R2'ye
`music/*.mp3` olarak yüklenir; lisans künyeleri `music.json` içinde ve bir
`LICENSES.md` dosyasında tutulur. Betik tekrar çalıştırılabilir olacak.

**API.** `GET /music` artık DB'den okur, opsiyonel `mood` filtresi alır ve
`{ music: [{ key, name, mood, moodLabel, durationSec, previewUrl }], moods: [...] }`
döner. Signed URL üretimi aynı kalır, worker `_resolve_music` değişmez.

**UI.** Yeni `apps/web/src/components/composer/MusicPicker.tsx` — `VoicePicker` ile
aynı iskelet: modal, arama kutusu, mood filtre çipleri, satır başına ▶/⏸ önizleme,
"Yok" seçeneği ve seçim yapıldığında müzik seviyesi slider'ı. Composer çip sırası:

```
Avatar seç · Ses seç · Müzik seç · Aa · Önizle
```

**Önizleme paritesi.** `Reel` kompozisyonu `musicUrl` + `musicVolume` propları alır ve
`previewAudio` açıkken müzik bedini de çalar. Böylece önizlemede duyulan miks, worker'ın
`mux_audio` çıktısıyla aynı bileşenlere sahip olur (ducking yalnızca render'da; önizlemede
sabit seviye — bu fark dokümante edilir).

### 6. AI ses efektleri temizliği

Silinecekler:

- `SettingsDrawer` alanı, `ComposerSettings.sfxEnabled`
- `MediaComposer`'daki `sfxCues` state'i, `useSuggestSfx` çağrıları, cue ön-getirme
- `apps/web/src/lib/queries.ts` → `useSuggestSfx`
- `apps/web/src/lib/sfxPreview.ts` → `sfxSrc`, `resolvePreviewSfx`
- `POST /videos/suggest-sfx` (`apps/api/src/routes/videos.ts`), `apps/api/src/lib/sfx.ts`
- `packages/types` → `SFX_META`, `SfxId`, `SFX_IDS`, `SfxCue`, `ReelOptions.sfx`
- `apps/worker/sentezy_worker/sfx.py` ve `pipeline.py`'deki cue çözümleme bloğu
- `apps/web/public/sfx/*.mp3` (13 dosya) — `transitions/` **kalır**

Kalacaklar: `SfxTrack.tsx`, `ResolvedSfxCue`, `brollSfxStem`, `BROLL_SFX_MAP`,
`tokenizeScript`, `transitions/*.wav` — geçiş sesleri bunları kullanıyor.

`SfxPreviewModal.tsx` → `PreviewModal.tsx` olarak yeniden adlandırılır (artık AI SFX
önizlemesi değil, reklamın önizlemesi).

### 7. Geçiş efekti sesi toggle'ı

Toggle, yüklenen medya sayısı 2'den azken devre dışı olur ve altında "En az 2 medya
gerekli" notu görünür. Medya sayısı `MediaComposer` içinde yaşadığı ve `SettingsDrawer`
`DashboardHome` altında durduğu için sayı `DashboardHome`'a kaldırılır
(`MediaComposer` `onMediaCountChange` ile bildirir). `EffectPicker` zaten aynı
`items.length > 1` koşuluyla kapılı — davranış tutarlı hale gelir.

## Değişecek dosyalar

**Web**
`lib/composerSettings.ts` · `components/composer/SettingsDrawer.tsx` ·
`components/composer/MusicPicker.tsx` (yeni) ·
`components/composer/SfxPreviewModal.tsx` → `PreviewModal.tsx` ·
`components/MediaComposer.tsx` · `components/DashboardHome.tsx` · `lib/queries.ts` ·
`lib/sfxPreview.ts` · `lib/schemas.ts` · `public/sfx/`

**Types**
`packages/types/src/index.ts` — `ReelOptions.layout`, `ReelOptions.sfx` kaldırma,
SFX palet tipleri

**Remotion**
`src/layout.ts` (+ yeni `layout.test.ts`) · `src/types.ts` · `src/CaptionOverlay.tsx` ·
`src/reel/types.ts` · `src/reel/Reel.tsx` · `src/reel/AvatarLayer.tsx`

**API**
`routes/music.ts` · `routes/videos.ts` · `lib/sfx.ts` (sil) · `data/music.json` (yeni)

**DB**
`prisma/schema.prisma` · yeni migration · `prisma/seed.ts`

**Worker**
`pipeline.py` · `sfx.py` (sil) · `providers/reel_remotion.py`

**Infra**
`infra/cloudflare/reel-renderer/container/server.mjs`

## Doğrulama

- `packages/remotion` — yeni `layout.test.ts` yeşil
- API birim testi — `applyEmotionTag` altı ton için doğru v3 etiketi
- Types birim testi — eski `options` blob'ları (`avatarLayout`/`avatarSide`) yeni
  `avatarPosition`'a doğru eşleniyor
- Tüm paketlerde typecheck + lint + build
- Manuel: önizlemede dört ayarın da görünür etkisi; ardından gerçek kuyruk render'ı ile
  aynı sonucun çıktığının doğrulanması (avatar Sol/Orta/Sağ, altyazı Üst/Alt, müzik
  bedi, 2+ klipli videoda geçiş sesi açık/kapalı)

## Kapsam dışı

- `aspect_ratio` kolonunun/enum'unun DB'den kaldırılması
- Ayarların oturumlar arası kalıcılığı (bugün `useState`, sayfa yenilenince sıfırlanır)
- Önizlemede gerçek TTS
- Önizlemede müzik ducking'i (render'da var, önizlemede sabit seviye)
