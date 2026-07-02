export interface ReviewLike {
  comment?: string;
  rating: number;
  sentiment?: string;
  department_analysis?: string;
  tags?: string[];
  date: string;
}

export const DEPT_KEYWORDS: Record<string, string[]> = {
  reception: ['resepsiyon', 'reception', 'check', 'giriş', 'personel', 'staff', 'lobby', 'lobi', 'karşılama'],
  housekeeping: ['temiz', 'kirli', 'havlu', 'çarşaf', 'oda temizliği', 'clean', 'dirty', 'towel', 'sheet', 'dust', 'hijyen'],
  fb: ['yemek', 'kahvaltı', 'restoran', 'garson', 'açık büfe', 'food', 'breakfast', 'dinner', 'restaurant', 'buffet', 'drink', 'bar'],
  technical: ['klima', 'tv', 'bozuk', 'çalışmıyor', 'kırık', 'su', 'wifi', 'wi-fi', 'internet', 'shower', 'ac', 'broken', 'hot water'],
  spa: ['spa', 'havuz', 'masaj', 'hamam', 'sauna', 'pool', 'massage', 'wellness']
};

export function matchesDepartment(review: ReviewLike, departmentKey: string): boolean {
  const text = (review.comment || '').toLowerCase();
  const deptAnalysis = (review.department_analysis || '').toLowerCase();

  // A. Check department_analysis field
  if (deptAnalysis.includes(departmentKey.toLowerCase())) {
    return true;
  }
  if (departmentKey === 'fb' && (deptAnalysis.includes('yiyecek') || deptAnalysis.includes('içecek') || deptAnalysis.includes('restaurant') || deptAnalysis.includes('food'))) {
    return true;
  }
  if (departmentKey === 'technical' && (deptAnalysis.includes('teknik') || deptAnalysis.includes('technical') || deptAnalysis.includes('klima') || deptAnalysis.includes('wifi') || deptAnalysis.includes('internet'))) {
    return true;
  }
  if (departmentKey === 'housekeeping' && (deptAnalysis.includes('kat hizmetleri') || deptAnalysis.includes('temizlik') || deptAnalysis.includes('housekeeping') || deptAnalysis.includes('hijyen'))) {
    return true;
  }
  if (departmentKey === 'reception' && (deptAnalysis.includes('resepsiyon') || deptAnalysis.includes('reception') || deptAnalysis.includes('check-in') || deptAnalysis.includes('check in'))) {
    return true;
  }

  // B. Check tag arrays if they exist
  if (Array.isArray(review.tags) && review.tags.some(t => t.toLowerCase() === departmentKey.toLowerCase())) {
    return true;
  }

  // C. Match keywords
  const keywords = DEPT_KEYWORDS[departmentKey] || [];
  if (keywords.length > 0 && keywords.some(k => text.includes(k))) {
    return true;
  }

  // D. General category fallback (if review does not match any specific category)
  if (departmentKey === 'general') {
    const matchedAnyOther = Object.keys(DEPT_KEYWORDS).some(key => {
      const otherKeywords = DEPT_KEYWORDS[key];
      const matchesOtherKeywords = otherKeywords.some(k => text.includes(k));
      const matchesOtherAnalysis = deptAnalysis.includes(key.toLowerCase()) ||
        (key === 'fb' && (deptAnalysis.includes('yiyecek') || deptAnalysis.includes('içecek') || deptAnalysis.includes('restaurant') || deptAnalysis.includes('food'))) ||
        (key === 'technical' && (deptAnalysis.includes('teknik') || deptAnalysis.includes('technical') || deptAnalysis.includes('klima') || deptAnalysis.includes('wifi') || deptAnalysis.includes('internet'))) ||
        (key === 'housekeeping' && (deptAnalysis.includes('kat hizmetleri') || deptAnalysis.includes('temizlik') || deptAnalysis.includes('housekeeping') || deptAnalysis.includes('hijyen'))) ||
        (key === 'reception' && (deptAnalysis.includes('resepsiyon') || deptAnalysis.includes('reception') || deptAnalysis.includes('check-in') || deptAnalysis.includes('check in')));
      
      return matchesOtherKeywords || matchesOtherAnalysis;
    });
    return !matchedAnyOther;
  }

  return false;
}

export function getDepartmentKey(review: ReviewLike): string {
  for (const key of Object.keys(DEPT_KEYWORDS)) {
    if (matchesDepartment(review, key)) {
      return key;
    }
  }
  return 'general';
}

export interface DepartmentStat {
  id: string;
  name: string;
  Yorum: number;
  Puan: number;
}

export function getDepartmentStats(reviews: ReviewLike[], isTr: boolean): DepartmentStat[] {
  const depts = [
    { id: 'reception', name: isTr ? 'Resepsiyon' : 'Reception', count: 0, sumRating: 0 },
    { id: 'housekeeping', name: isTr ? 'Kat Hizmetleri' : 'Housekeeping', count: 0, sumRating: 0 },
    { id: 'fb', name: isTr ? 'Yiyecek & İçecek' : 'Food & Beverage', count: 0, sumRating: 0 },
    { id: 'technical', name: isTr ? 'Teknik Servis' : 'Technical Service', count: 0, sumRating: 0 },
    { id: 'spa', name: 'Spa & Havuz', count: 0, sumRating: 0 },
    { id: 'general', name: isTr ? 'Genel / Tesis' : 'General / Facility', count: 0, sumRating: 0 }
  ];

  reviews.forEach(r => {
    let matched = false;
    for (const d of depts) {
      if (d.id === 'general') continue;
      if (matchesDepartment(r, d.id)) {
        d.count++;
        d.sumRating += r.rating;
        matched = true;
      }
    }
    if (!matched) {
      const generalDept = depts.find(d => d.id === 'general')!;
      generalDept.count++;
      generalDept.sumRating += r.rating;
    }
  });

  return depts
    .map(d => ({
      id: d.id,
      name: d.name,
      Yorum: d.count,
      Puan: d.count > 0 ? Number((d.sumRating / d.count).toFixed(1)) : 0
    }))
    .filter(d => d.Yorum > 0);
}
