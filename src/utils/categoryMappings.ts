export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  yemek: ['yemek', 'restoran', 'kahvaltı', 'buffet', 'açık büfe', 'food', 'breakfast', 'dinner', 'lezzet', 'açıkbüfe', 'mutfak', 'aşçı', 'cafe'],
  oda: ['oda', 'room', 'yatak', 'banyo', 'minibar', 'gürültü', 'yastık', 'çarşaf', 'havlu', 'televizyon', 'duş', 'küvet', 'balkon'],
  personel: ['personel', 'staff', 'çalışan', 'hizmet', 'service', 'resepsiyon', 'ilgi', 'güler yüz', 'garson', 'bellboy', 'temizlikçi', 'yönetici', 'ekip', 'güler yüzlü'],
  otopark: ['otopark', 'parking', 'park', 'vale', 'araba', 'araç'],
  havuz: ['havuz', 'pool', 'aqua', 'kaydırak', 'şezlong', 'klor', 'aquapark', 'su parkı'],
  plaj: ['plaj', 'beach', 'deniz', 'şezlong', 'kum', 'sahil', 'şemsiye', 'kıyı', 'iskele', 'deniz suyu'],
  temizlik: ['temizlik', 'clean', 'hijyen', 'housekeeping', 'kirli', 'toz', 'çarşaf', 'havlu', 'pis', 'hijyenik', 'paspas', 'süpürge', 'pırıl pırıl'],
  konum: ['konum', 'location', 'ulaşım', 'yakın', 'uzak', 'merkez', 'metro', 'otobüs', 'dolmuş', 'taksi', 'yol', 'mesafe'],
  manzara: ['manzara', 'view', 'sea view', 'deniz manzarası', 'balkon manzarası', 'doğa manzarası'],
  fiyat: ['fiyat', 'price', 'performance', 'value', 'ücret', 'pahalı', 'ucuz', 'maliyet', 'ödeme', 'f/p', 'fp', 'değer'],
  klima: ['klima', 'air condition', 'air conditioning', 'A/C', 'cooling', 'heater', 'heating', 'ısıtma', 'soğutma', 'ventilation', 'hvac', 'maintenance', 'teknik servis', 'teknik', 'sıcak su', 'klima çalışmıyor', 'arıza', 'bozuk', 'elektrik', 'jeneratör', 'priz', 'asansör']
};

export function matchesCategory(review: any, categoryKey: string): boolean {
  if (!review || !categoryKey) return false;
  const keywords = CATEGORY_KEYWORDS[categoryKey.toLowerCase()];
  if (!keywords) return false;

  const stringify = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val.toLowerCase();
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val).toLowerCase();
      } catch (_) {
        return '';
      }
    }
    return String(val).toLowerCase();
  };

  const comment = stringify(review.comment || review.review_text);
  const dept = stringify(review.department_analysis || review.departments);
  const qual = stringify(review.quality_analysis);
  const prio = stringify(review.priority_analysis);
  const summary = stringify(review.summary || review.aiAnalysis?.summary || (review.ai_analysis && review.ai_analysis.summary));
  const meta = stringify(review.metadata);
  const ai = stringify(review.aiAnalysis || review.ai_analysis || review.review_analysis);

  const combined = `${comment} ${dept} ${qual} ${prio} ${summary} ${meta} ${ai}`;

  return keywords.some(kw => combined.includes(kw.toLowerCase()));
}
