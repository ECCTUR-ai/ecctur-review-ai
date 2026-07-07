// src/utils/taskMetadata.ts

export function generateTaskMetadata(
  reviewText: string,
  rating: number,
  guestName: string,
  platform: string,
  createdAt: string
) {
  const text = (reviewText || '').toLowerCase();
  
  // 1. Detect Category
  let category = 'Genel Memnuniyetsizlik';
  let categoryEn = 'General Dissatisfaction';
  let categoryRu = 'Общее недовольство';
  let categoryDe = 'Allgemeine Unzufriedenheit';

  if (/temizlik|oda temizliği|havlu|çarşaf|housekeeping|kirli|pis|toz|banyo/i.test(text)) {
    category = 'Temizlik';
    categoryEn = 'Cleanliness';
    categoryRu = 'Уборка';
    categoryDe = 'Sauberkeit';
  } else if (/klima|arıza|bozuk|elektrik|su|duş|internet|wifi|tv|priz/i.test(text)) {
    category = 'Teknik Arıza';
    categoryEn = 'Technical Issue';
    categoryRu = 'Технические неполадки';
    categoryDe = 'Technische Störung';
  } else if (/yemek|restoran|kahvaltı|bar|içecek|açlık|lezzet/i.test(text)) {
    category = 'Yiyecek & İçecek';
    categoryEn = 'Food & Beverage';
    categoryRu = 'Еда и напитки';
    categoryDe = 'Essen & Trinken';
  } else if (/personel|resepsiyon|kaba|ilgisiz|yavaş|çalışan/i.test(text)) {
    category = 'Personel Davranışı';
    categoryEn = 'Staff Behavior';
    categoryRu = 'Поведение персонала';
    categoryDe = 'Verhalten des Personals';
  } else if (/güvenlik|kilit|kasa|kayıp/i.test(text)) {
    category = 'Güvenlik';
    categoryEn = 'Security';
    categoryRu = 'Безопасность';
    categoryDe = 'Sicherheit';
  } else if (/fiyat|pahalı|para/i.test(text)) {
    category = 'Fiyat/Değer';
    categoryEn = 'Value for Money';
    categoryRu = 'Соотношение цена/качество';
    categoryDe = 'Preis-Leistungs-Verhältnis';
  }

  // 2. Detect Language
  let lang = 'Türkçe';
  if (/the|check-in|check out|hotel|room|stay|breakfast|nice|clean|bad|service|friendly|staff/i.test(text)) {
    lang = 'İngilizce';
  } else if (/отель|комната|уборка|завтрак|персонал|плохо|грязный|хорошо/i.test(text)) {
    lang = 'Rusça';
  } else if (/das|ist|zimmer|sauber|schmutzig|fruhstuck|personal/i.test(text)) {
    lang = 'Almanca';
  }

  // 3. Detect Sentiment
  let sentiment = 'Nötr';
  if (rating === 1) sentiment = 'Çok kızgın';
  else if (rating === 2) sentiment = 'Hayal kırıklığı';
  else if (rating === 3) sentiment = 'Memnun ama eleştirili';

  // 4. Risk Level
  let riskLevel = 'Orta';
  if (rating <= 1) riskLevel = 'Kritik';
  else if (rating === 2) riskLevel = 'Yüksek';
  else if (rating >= 4) riskLevel = 'Düşük';

  // 5. Generate translations object
  const translations = {
    TR: {
      review_summary: `Misafir, ${category.toLowerCase()} konusundaki aksaklıklardan dolayı memnuniyetsizliğini dile getiriyor.`,
      complaint_category: category,
      complaint_focus: `Bu yorum ağırlıklı olarak ${category} problemi içeriyor.`,
      recommended_actions: [
        'Misafir ilişkileri misafirle iletişime geçsin.',
        `${category} ekibi ilgili şikayet kaydını inceleyip düzeltsin.`,
        'Çözüm sonrasında misafire bilgi verilip geri bildirim alınsın.'
      ]
    },
    EN: {
      review_summary: `The guest expresses dissatisfaction regarding ${categoryEn.toLowerCase()} issues.`,
      complaint_category: categoryEn,
      complaint_focus: `This review primarily concerns ${categoryEn} issues.`,
      recommended_actions: [
        'Guest relations should contact the guest.',
        `The ${categoryEn} team should inspect and resolve the reported issue.`,
        'Follow up with the guest after resolving the issue.'
      ]
    },
    RU: {
      review_summary: `Гость выражает недовольство по поводу проблем с ${categoryRu.toLowerCase()}.`,
      complaint_category: categoryRu,
      complaint_focus: `Этот отзыв в основном касается проблем с ${categoryRu}.`,
      recommended_actions: [
        'Службе по работе с гостями связаться с гостем.',
        `Команде ${categoryRu} проверить и устранить проблему.`,
        'Предоставить обратную связь после разрешения ситуации.'
      ]
    },
    DE: {
      review_summary: `Der Gast äußert Unzufriedenheit bezüglich ${categoryDe.toLowerCase()}-Problemen.`,
      complaint_category: categoryDe,
      complaint_focus: `Diese Bewertung betrifft hauptsächlich Fragen der ${categoryDe}.`,
      recommended_actions: [
        'Gästebetreuung sollte den Gast kontaktieren.',
        `Das Team für ${categoryDe} sollte das gemeldete Problem prüfen.`,
        'Nach Behebung Feedback beim Gast einholen.'
      ]
    }
  };

  return {
    rating,
    guest_name: guestName || 'Misafir',
    platform: platform || 'Google',
    review_date: createdAt,
    ai_action_required: true,
    ai_recommended_action: translations.TR.recommended_actions.join(' '),
    detected_department: category,
    review_summary: translations.TR.review_summary,
    complaint_category: category,
    complaint_focus: translations.TR.complaint_focus,
    guest_sentiment: sentiment,
    risk_level: riskLevel,
    recommended_actions: translations.TR.recommended_actions,
    detected_language: lang,
    translations
  };
}
