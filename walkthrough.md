# GuestReview.ai – Dashboard Data Integrity Audit & Walkthrough Report

This document reports the technical modifications made to the GuestReview.ai Dashboard data architecture, unifying the repository layers, introducing DB-level date filtering, and integrating realtime updates.

---

## 1. Yeni Veri Akışı ve Mimari Yapısı

### Dashboard Hangi Repository Üzerinden Çalışıyor?
Dashboard artık yeni oluşturulan **[dashboardRepository.ts](file:///Users/cemilsezgin/Desktop/ecctur-review-ai/src/repositories/dashboardRepository.ts)** üzerinden çalışmaktadır. 
- Bu repository, seçilen `hotel_id` ve `timeFilter`'a (tarih aralığı) göre doğrudan Supabase `reviews` ve `review_sync_states` tablolarından veri çekmektedir.
- Reviews ekranı da aynı Supabase tablolarını (`reviews`) okumaktadır; böylece her iki ekran da tamamen senkronize olmuştur.

### Hangi Service Kullanılıyor?
Dashboard veri akışı için yeni oluşturulan **[dashboardService.ts](file:///Users/cemilsezgin/Desktop/ecctur-review-ai/src/services/dashboardService.ts)** kullanılmaktadır. 
- Bu servis, gelen `timeFilter` (bugün, 7 gün, 30 gün, vb.) değerine göre bir limit tarih belirler ve veritabanı sorgusuna iletir.
- Dashboard bileşeni (`Dashboard.tsx`) tek bir hook çağrısı (`dashboardService.getDashboardData`) ile hem reviews hem de sync states verisini yükler.

---

## 2. Supabase ve Veritabanı Değişiklikleri

### Hangi Supabase Sorguları Değiştirildi?
Daha önce Dashboard üzerindeki metrikler için 5-6 farklı tekil sorgu atılmaktaydı. Bunlar kaldırıldı ve yerine veritabanı seviyesinde tarih ve otel izolasyonunu sağlayan tek bir birleşik sorgu getirildi:

```typescript
// 1. reviews tablosu için DB seviyesinde tarih ve otel filtresi (dashboardRepository)
let reviewsQuery = supabase
  .from('reviews')
  .select('id, platform, rating, review_date, status, review_text, created_at, guest_name, sentiment')
  .eq('hotel_id', hotelId);

if (limitDate) {
  const isoStr = limitDate.toISOString();
  reviewsQuery = reviewsQuery.or(`review_date.gte.${isoStr},created_at.gte.${isoStr}`);
}

// 2. review_sync_states tablosu için otel filtresi (dashboardRepository)
const syncStatesQuery = supabase
  .from('review_sync_states')
  .select('*')
  .eq('hotel_id', hotelId);
```

### Dashboard ile Reviews Ekranı Artık Hangi Ortak Veri Kaynağını Paylaşıyor?
Her iki ekran da doğrudan Supabase üzerindeki **`reviews`** tablosunu temel alan repository modellerini kullanır:
- Dashboard, `dashboardService` aracılığıyla `reviews` tablosunu okur.
- Reviews ekranı, `reviewService` aracılığıyla `reviews` tablosunu okur.
- Arşivlenen yorumlar (`status === 'archived'`) filtreleme yapılarak her iki ekranda da hesaplama dışı bırakılmıştır. Bu sayede "Toplam Yorum" vb. metrikler iki sayfada da birebir eşleşmektedir.

---

## 3. Kod Temizliği ve Kaldırılan Yapılar

### Eski Kaldırılan Kodlar Neler?
- **`analyticsService.ts`**: Tamamen silindi.
- **`analyticsRepository.ts`**: Tamamen silindi.
- **Dashboard.tsx İçerisindeki 5 Adet Redundant Hook**:
  - `analyticsService.getMetrics`
  - `analyticsService.getTrends`
  - `analyticsService.getPlatformShare`
  - `ratingsDistributionRaw` doğrudan SQL sorgusu
  - `reviewService.getReviews` (Son Yorumlar için atılan ayrı sorgu)
  Bu sorguların tamamı kaldırılmış, yerine tek bir birleşik `dashboardService.getDashboardData` getirilmiştir. Tüm grafik ve KPI hesaplamaları client tarafında bu tekil array üzerinden saniyeler içinde hesaplanır.

---

## 4. Entegrasyonlar ve Realtime Akışı

### Google ve Booking Aggregator Entegrasyonu Dashboard ile Nasıl Bağlandı?
- Google ve Booking entegrasyonları, Apify Aggregator üzerinden import edilmeye devam eder. 
- İçe aktarma (import) işlemi tamamlandığında veriler doğrudan `reviews` tablosuna yazılır ve platform durumları `review_sync_states` tablosunda güncellenir.
- Dashboard doğrudan `reviews` ve `review_sync_states` tablolarını izlediği için aggregator'dan veri geldikçe otomatik olarak beslenir.

### Legacy Providerlar Nasıl Çalışmaya Devam Ediyor?
- TripAdvisor, Hotels.com ve HolidayCheck legacy providerları (eski import akışı) aynen korunmuştur.
- Ancak bu platformlar da içe aktarım işlemi sonunda kayıtlarını doğrudan ortak **`reviews`** tablosuna yazar. Dashboard platform ayrımı yapmaksızın tek bu tablodan beslendiği için bu kayıtlar da anında Dashboard'a yansır.

---

## 5. Booking Entegrasyonu Casing & Duplicate Analizi

### Karşılaşılan Uyuşmazlık
- Booking.com import akışlarından bir kısmı veritabanına platform adını **`'booking'`** (küçük harfle) olarak yazmaktayken, Aggregator import akışı platform adını **`'Booking'`** (büyük harfle) olarak yazmaktaydı.
- Bu durum, veritabanında mükerrer (duplicate) kontrollerini yapan `checkIsDuplicate` fonksiyonunda PostgreSQL'in case-sensitive yapısından dolayı kontrol uyuşmazlığına yol açmaktaydı.

### Çözüm ve Yapılan İyileştirmeler
1. **İlklendirme & Normalizasyon**: `api/reviews.ts` içerisindeki tekil Booking import akışında (`import-booking`) veritabanına yazılan platform değeri **`'Booking'`** (büyük harfle) olacak şekilde normalize edilmiştir.
2. **Case-Insensitive Duplicate Kontrolü**: `api/reviews.ts` içerisindeki `checkIsDuplicate` fonksiyonundaki platform sorguları `.eq('platform', platform)` yerine **`.ilike('platform', platform)`** kullanacak şekilde güncellenmiştir. Bu sayede veritabanında küçük/büyük harfle kayıtlı tüm eski Booking verileri de duplicate kontrolüne dahil edilmiştir.
3. **Veri Eşleşme Doğrulaması**:
   - `Jura Hotels Ada Beach` oteli için veritabanında **20 adet** Booking yorumu olduğu ve bunların son 30 gün içinde yapılan aramada Dashboard'un veri kaynağına başarıyla dahil edildiği doğrulanmıştır.
   - 30 günden eski yorumların Dashboard KPI'larında görünmesi için "Tüm Zamanlar" (All Time) tarih filtresinin seçilmesi gerekmektedir.
