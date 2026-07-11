# Otelpuan.com Scraper Teknik Analiz Raporu

Bu rapor, GuestReview.ai projesine deneysel olarak entegre edilen Otelpuan.com yorum scraper servisiyle ilgili teknik detayları, veri yapısını ve karşılaşılan riskleri açıklamaktadır.

## 1. Veri Kaynağı & Bağlantı
- **Kaynak**: `otelpuan.com` ve `www.otelpuan.com` herkese açık otel ve yorum sayfaları.
- **Yöntem**: 
  1. Sunucu taraflı Next.js data script bloğu (`__NEXT_DATA__`) kontrol edilerek, varsa ham JSON verisi direkt ayrıştırılır.
  2. JSON bloğu bulunamazsa, HTML içindeki yorum kartları regular expressions (regex) ve lookahead sınırlandırmaları kullanılarak ayrıştırılır.

## 2. Sayfalama (Pagination)
- **Yöntem**: URL sonuna `?page=X` ve `?p=X` parametreleri eklenerek sayfalarda gezilir.
- **Kısıtlamalar & Korumalar**:
  - `maxReviews` (varsayılan 50) limitine ulaşılınca durur.
  - Sayfa içeriği boş dönerse veya bir önceki sayfayla tamamen aynı HTML hash'ine sahipse işlem sonlandırılır (sonsuz döngü koruması).
  - Sayfada hiçbir yeni yorum kalmadığında (hepsi mükerrer ise) durdurulur.

## 3. Alan Analizi

### Bulunan ve Ayrıştırılan Alanlar
- `platform`: "otelpuan"
- `externalReviewId`: Benzersiz yorum kimliği.
- `hotelName`: Tesis adı.
- `reviewerName`: Yorumu yazan misafir adı.
- `rating`: Normalize edilmiş 5'lik puan (1.0 - 5.0).
- `reviewTitle`: Yorum başlığı.
- `reviewText`: Yorum metni.
- `reviewDate`: Normalize edilmiş yorum tarihi (ISO: YYYY-MM-DD).
- `stayDate`: Konaklama tarihi (varsa ISO formatında, sadece ay/yıl varsa `null`).
- `roomScore` / `serviceScore` / `foodScore` / `cleanlinessScore` / `locationScore`: Tesis alt departman puanları.
- `verified`: Misafirin doğrulanmış rezervasyonla kalıp kalmadığı bilgisi.
- `sourceUrl`: Yorumun çekildiği kaynak otel URL'si.
- `metadata`:
  - `originalRating`: Otelpuan'daki 10'luk orijinal puan.
  - `originalDateText`: Sitedeki orijinal Türkçe tarih metni.
  - `originalStayDateText`: Sitedeki orijinal Türkçe konaklama tarihi metni.

### Bulunamayan Alanlar
- `travelerType` / `reviewType` / `recommendationStatus`: HTML fallback modelinde genellikle bulunmaz ancak `__NEXT_DATA__` JSON modelinde mevcutsa otomatik metadata içine alınır.

## 4. Normalizasyonlar
- **Puan Normalizasyonu**: Otelpuan puanları 10 üzerindendir. `normalizedRating = originalRating / 2` formülü ile 5'lik sisteme çevrilir ve en yakın tek ondalıklı basamağa yuvarlanır.
- **Tarih Normalizasyonu**: Türkçe ay isimleri (Ocak, Şubat vb.) tespit edilerek ISO `YYYY-MM-DD` formatına çevrilir. Eğer gün bilgisi yoksa (örn: "Haziran 2026") uydurma gün yazılmadan `null` bırakılır ve orijinal metin metadata içine kaydedilir.

## 5. Mükerrer Yorum (Duplicate) Önleme Yöntemi
Eğer yorum nesnesinden açık bir ID alınamıyorsa, deterministik bir `externalReviewId` üretilir:
```
SHA-256(
  normalizedHotelUrl +
  normalizedReviewerName +
  normalizedReviewDate +
  normalizedReviewText
)
```
- Metinler hash öncesinde trim edilir.
- Birden fazla boşluk tek boşluğa indirgenir.
- Büyük/küçük harfler normalize edilir (lowercase).

## 6. Karşılaşılan Riskler & Önlemler
- **Anti-Bot & 403 Forbidden**: Otelpuan.com üzerinde bot korumaları aktiftir. İstekler arasında 1-2 saniye bekleme, gerçekçi bir User-Agent kullanımı ve exponential backoff (retry) mekanizmaları eklenmiştir.
- **SSRF Güvenliği**: URL hostname'inin sadece `otelpuan.com` ve `www.otelpuan.com` olmasına izin verilir. DNS çözümlemesi yapılarak localhost, loopback (`127.0.0.0/8`) ve özel IP blokları (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`) kesinlikle engellenir.

## 7. Production Entegrasyonu İçin Sonraki Adımlar
1. Deneysel `/api/reviews/otelpuan/test` endpoint çıktısı kontrol edildikten sonra, verilerin veri tabanına yazılması için `reviewRepository` ve `reviewImportService` üzerinde Otelpuan entegrasyonu aktifleştirilmelidir.
2. IP engellemesini önlemek amacıyla, scraper isteklerinin proxy havuzu üzerinden geçmesi sağlanabilir.
