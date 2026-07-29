# Turkish legal pages — handoff for legal review

**Status: NOT REVIEWED. Do not launch the Turkish site until a Turkish lawyer has read this.**

Date: 2026-07-28
Pages: `/tr/terms`, `/tr/privacy`, `/tr/kvkk`
Sources: `apps/landing/src/pages/tr/{terms,privacy,kvkk}.astro`

Each of those three files carries an `AWAITING LEGAL REVIEW` marker in its frontmatter. Do not
remove a marker without a reviewed replacement.

## The headline finding

Most of the substantive problems below are **not translation errors**. The Turkish is a
faithful rendering of the English. The problems are in the **English source**, and they only
become visible once the document is in Turkish and reads as a Turkish `aydınlatma metni`
rather than as an English summary of one.

Put plainly: `/kvkk` in English may not conform to KVKK as a data-controller notice, and
translating it faithfully produced a Turkish page that inherits every gap. Fixing the Turkish
alone would leave the English wrong; these need deciding at the source.

This means the review below is worth doing **even if you decide not to launch Turkish**.

## Priority 1 — KVKK conformity (affects the English page too)

1. **The Article 11 rights list is incomplete.** The page enumerates five bullets under a
   heading naming Article 11. KVKK Art. 11 has eight subparagraphs. Missing:
   - **(ç)** the right to know the third parties, in Türkiye *or abroad*, to whom data has
     been transferred
   - **(f)** the right to have corrections and erasures notified to those third parties

   In English, "Your rights under Article 11" reads as a summary. In Turkish, a heading citing
   the article reads as *the statutory list*. The omission of (ç) is conspicuous because the
   page asserts cross-border transfer three headings earlier.

2. **The application procedure and response period are absent.** The page gives plain e-mail
   as the only route. The *Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ*
   prescribes written application, KEP, secure e-signature, mobile signature, or an e-mail
   address previously registered with the controller — and requires the **30-day** response
   period to be stated. A user following the page's instructions may not start the clock.

3. **The data controller is not identified.** The page says "Sentezy" acts as controller.
   Sentezy is a brand, not a legal entity. The *Aydınlatma Yükümlülüğü* tebliği requires the
   controller's `unvan` and, where applicable, its representative. Cheapest gap to close.

4. **No Article 9 transfer mechanism is named.** The page says data may be processed outside
   Türkiye "only as far as providing the service requires". Necessity is **not** a cross-border
   transfer basis under KVKK Art. 9 — explicit consent, an adequacy decision, an undertaking,
   or standard contractual clauses are. In English this reads as description; in Turkish it
   reads as an assertion of lawfulness the sentence does not support.

5. **Legal bases are not mapped to Art. 5(2).** The page describes bases in plain language
   rather than citing subparagraphs. An `aydınlatma metni` is expected to state the
   `hukuki sebep` by reference — e.g. the contract basis is Art. 5(2)(c).

## Priority 2 — consumer-law exposure in the Terms

6. **`Kullanılmış krediler iade edilmez`** (blanket no-refund) runs into the
   *Mesafeli Sözleşmeler Yönetmeliği* withdrawal right and its digital-content exception.
   Arguably more likely to be struck than the "as is" clause.

7. **`Hukukun izin verdiği ölçüde`** (the "to the extent permitted by law" savings clause).
   Under **TBK m.115**, an exclusion of liability for intent or gross negligence is void
   regardless of such a wrapper. This formula does less work in Turkish than a common-law
   reader expects — the same substantive problem as "as is".

## Priority 3 — terminology with legal weight

8. **`render edildiğinde`** as the charging trigger. An unassimilated English verb sitting in
   the operative sentence that determines *when money is taken*, and undefined in Turkish.
   Every other technical term got a Turkish rendering; this one did not.

9. **`kredi`** for prepaid units. In Turkish this first reads as *banking credit*; the settled
   term is `kontör`. Consistency with the marketing copy is defensible, but a payment clause
   should define the unit — including whether the balance expires, which **neither** language
   currently addresses.

10. **`marka` / `yazılım` ownership.** `marka` is the trademark-*registration* term; the
    English "brand" asserts nothing about registration. Software ownership would normally be
    framed through FSEK `mali haklar`.

## Also on the pile

- **16 items the translator flagged as uncertain** — full list with English original, Turkish
  rendering and reasoning reproduced in the appendix at the end of this document. The
  heaviest three are the
  "as is" warranty disclaimer, "indirect or consequential loss", and the Art. 11 rights
  wording (where the English narrows the statute and the translation followed the English
  rather than restoring it).
- Six of those carry the English term in parentheses on the live page, e.g.
  `olduğu gibi (as is)`. That is deliberate — a flagged uncertainty rather than a confident
  guess. One of them, `bir ödeme hizmeti sağlayıcısı (payment processor)`, reads as
  translator's residue and should probably just be dropped.

## What was verified, so you don't re-check it

- Section structure is identical to the English: terms 11/11, privacy 9/9, kvkk 7/7 `<h2>`
  headings, same subject matter, same order — checked pair by pair, not just by count.
- No clause was invented and none dropped, other than the one deliberate deletion: the English
  sentence offering the notice "in Turkish on request" is removed from `/tr/kvkk` (that page
  *is* the provision) and left intact on `/kvkk`.
- `hello@sentezy.ai` and every proper noun are unchanged.
- The statute is cited exactly: `6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK)`.
- Revision date unchanged (23 July 2026), rendered `23 Temmuz 2026` on the Turkish pages.
- Register is formal Turkish legal register; orthography checked and clean.

## Appendix — the translator's 16 flagged uncertainties

Reproduced verbatim so this document stands alone; the working notes it came from are
git-ignored scratch and will not survive a fresh checkout.

Sixteen items I could not render with full confidence. Where the brief's rule applied I left the
English term in parentheses in the page itself; those are marked **[in page]**. The rest are
choices that read naturally in Turkish but carry a legal judgement I was not qualified to make, so
they are flagged here only.

1. **"The service is provided as is."** → `Hizmet olduğu gibi (as is) sunulmaktadır.` **[in page]**
   `olduğu gibi` is the usual rendering, but "as is" is a common-law warranty disclaimer with no
   settled Turkish contractual equivalent. More seriously: against a consumer, a blanket "as is"
   disclaimer is of doubtful effect under Turkish consumer protection law. This is a substantive
   question, not a wording one — the clause may need rewriting for Türkiye rather than translating.

2. **"indirect or consequential loss"** → `dolaylı zararlardan veya dolaylı sonuç niteliğindeki
   zararlardan (indirect or consequential loss)` **[in page]** Turkish law distinguishes
   `doğrudan` / `dolaylı zarar` but has no clean counterpart to the two-term common-law pair;
   "consequential loss" in particular does not map onto a Turkish category. I rendered it
   descriptively and kept the English. The scope of the exclusion could differ from what the
   English achieves.

3. **"a payment processor"** → `bir ödeme hizmeti sağlayıcısı (payment processor)` **[in page]**
   (privacy + kvkk). The Turkish regulated term `ödeme kuruluşu` carries a specific licensing
   status under Turkish payments law that the English sentence does not assert, so I avoided it.
   `ödeme hizmeti sağlayıcısı` is the safer descriptive phrase. Note the English uses *processor*
   here and *provider* elsewhere; I kept that distinction (`ödeme sağlayıcımız` for the latter)
   rather than harmonising it, but a reviewer may want to know the two are the same entity.

4. **"Settings"** → `Ayarlar (Settings)` **[in page]** (all three files). This is a UI label, and
   the web app itself is in English, so a Turkish reader looking for "Ayarlar" in the product will
   see "Settings". I kept both. If the app is ever localised, drop the parenthetical.

5. **"KVKK Notice"** (page title) → `KVKK Aydınlatma Metni`. `Aydınlatma metni` is the established
   Turkish name for a data-controller disclosure under KVKK Art. 10 — but it is *more specific*
   than the English "Notice", and it asserts that this document satisfies the Art. 10 obligation.
   If the reviewer thinks it does not yet, the title should be weakened to `KVKK Bilgilendirmesi`.

6. **"Your rights under Article 11"** → `11. madde kapsamındaki haklarınız`. Kept literal. Turkish
   convention would name the statute in the heading (`Kanun'un 11. maddesi kapsamındaki
   haklarınız`); I did not add it, because the English does not. Standing alone, "11. madde" has no
   stated referent until the reader connects it to the 6698 reference in the intro.

7. **"Object to results reached solely by automated analysis."** → `Münhasıran otomatik analiz
   yoluyla ulaşılan sonuçlara itiraz etme.` The statutory text of KVKK Art. 11(1)(g) is
   *"münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle kişinin kendisi aleyhine
   bir sonucun ortaya çıkmasına itiraz etme"* — note **aleyhine** (adverse to the person), which the
   English drops. I followed the English rather than restoring the statutory wording. **A reviewer
   will probably want the statutory wording restored**, since this section purports to enumerate
   Art. 11 rights.

8. **"Have inaccurate data corrected, and request that it be deleted."** → `Yanlış verilerin
   düzeltilmesini ve silinmesini talep etme.` Same issue as (7). The statute covers data processed
   *eksik veya yanlış* (incomplete **or** inaccurate) and the right to have it *silinmesini veya yok
   edilmesini* (erased **or** destroyed). The English narrows both; I did not widen it back.

9. **"on the basis of your consent"** → `açık rızanıza dayanarak`. KVKK's operative concept is
   **açık rıza** (explicit consent), which is a stronger and narrower thing than bare "consent".
   Using it is right for a KVKK notice but commits Sentezy to a higher standard than the English
   sentence does. The alternative, plain `rızanıza`, would be legally meaningless under KVKK.

10. **"for our legitimate interests"** → `meşru menfaatlerimiz kapsamında`. `Meşru menfaat` is the
    KVKK Art. 5(2)(f) term, but its Turkish scope is narrower than the GDPR concept the English
    phrasing evokes (KVKK conditions it on the data subject's fundamental rights not being harmed).
    The Turkish therefore claims a slightly different basis than the English reader would infer.

11. **"synthetic presenter" / "presenter library"** → `sentetik sunucu` / `sunucu kütüphanesi`.
    `sunucu` matches the term already used throughout the project's Turkish marketing copy
    (`src/i18n/copy.tr.ts`), so I kept it for consistency. But `sunucu` also means **server** in
    Turkish IT usage, and this is a legal document about software — in "Sentezy, yazılımı, sunucu
    kütüphanesi ve markası bize aittir" the ambiguity is real and unhelpful. A reviewer may prefer
    `sanal sunum yapan` or the English `presenter`.

12. **"to imply a real person's endorsement"** → `gerçek bir kişinin desteğini ima etmek`.
    "Endorsement" has no settled Turkish legal equivalent in the advertising sense. `destek`
    (support) is weaker than the commercial-endorsement meaning; `onayı` (approval) or `tavsiyesi`
    (recommendation) are alternatives that shift the meaning differently. This clause is doing real
    work — it is the deepfake/impersonation prohibition — so the wording matters.

13. **"You must be old enough to enter a contract where you live."** → `Yaşadığınız yerde sözleşme
    kurmaya yetecek yaşta olmanız gerekir.` Turkish law frames this as **fiil ehliyeti** (capacity
    to act), not as an age threshold. I deliberately did *not* import `ehliyet`, because that would
    introduce a legal concept the English does not state. The Turkish consequently reads as a
    plain age statement, which is what the English says but not how a Turkish lawyer would draft it.

14. **"These terms are governed by the laws of Türkiye."** → `İşbu koşullar Türkiye Cumhuriyeti
    kanunlarına tabidir.` Two flags. (a) `kanunları` = statutes; `hukuku` = law generally — I chose
    the literal `kanunları`. (b) A Turkish governing-law clause normally pairs with a competent
    court / jurisdiction clause (`yetkili mahkeme`). The English has none and **I added none** — I
    am not the drafter — but its absence is more conspicuous in Turkish.

15. **"Availability"** (h2) → `Erişilebilirlik`. In Turkish web usage `erişilebilirlik` most often
    means **accessibility** (a11y), not uptime. The section is about uptime. `Hizmetin sürekliliği`
    would be clearer, but it is a different word from the English heading, so I stayed literal.

16. **"we cannot promise"** → `taahhüt edemeyiz`. `Taahhüt` is a formal legal undertaking —
    stronger than the everyday "promise" of the English. Disclaiming a *taahhüt* is arguably a
    narrower disclaimer than disclaiming a *promise*. `söz veremeyiz` is the softer literal option.

### Non-translation observation (out of scope, worth knowing)

`Legal.astro` renders two hard-coded English strings that now appear on all three Turkish pages:
`Last updated {updated}` and `← Back to home`. The task explicitly scoped the layout out, so I did
not touch it. Also, per instruction, the `updated` prop is unchanged on all three pages and
therefore renders as `Last updated 23 July 2026` — an English date on a Turkish page. Both are
deliberate, both are visible to a Turkish reader, and both would be a one-line fix in a follow-up
if the owner wants them localised.

---

# Task 10 fix — Step 1b: localise the `Legal.astro` chrome

Follow-up requested by the coordinator after this implementer surfaced the leak in the
"Non-translation observation" of the report above. The brief was regenerated with a **Step 1b**
and the fix is now in scope. Chrome and date only — no body text, marker, `<h2>` or
flagged-uncertainty parenthetical was touched.
