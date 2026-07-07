-- Migration: Upgrade automated task creator trigger function with comprehensive AI operational metadata
CREATE OR REPLACE FUNCTION public.auto_create_task_from_low_rating_review()
RETURNS TRIGGER AS $$
DECLARE
  v_department TEXT := 'Misafir İlişkileri';
  v_priority TEXT := 'medium';
  v_title TEXT;
  v_description TEXT;
  v_ai_action_recommended TEXT;
  v_requires_action BOOLEAN := false;
  v_duplicate_exists BOOLEAN := false;
  v_text TEXT;
  v_guest_name TEXT;
  v_platform TEXT;
  v_due_date DATE;

  -- Analysis fields
  v_category_tr TEXT;
  v_category_en TEXT;
  v_category_ru TEXT;
  v_category_de TEXT;
  v_detected_lang TEXT;
  v_sentiment TEXT;
  v_risk TEXT;
  v_summary_tr TEXT;
  v_summary_en TEXT;
  v_summary_ru TEXT;
  v_summary_de TEXT;
  v_focus_tr TEXT;
  v_focus_en TEXT;
  v_focus_ru TEXT;
  v_focus_de TEXT;
  v_action1_tr TEXT; v_action2_tr TEXT; v_action3_tr TEXT;
  v_action1_en TEXT; v_action2_en TEXT; v_action3_en TEXT;
  v_action1_ru TEXT; v_action2_ru TEXT; v_action3_ru TEXT;
  v_action1_de TEXT; v_action2_de TEXT; v_action3_de TEXT;
BEGIN
  -- Rule 1: Gating for low rating reviews
  IF NEW.rating > 3 OR NEW.rating IS NULL THEN
    RETURN NEW;
  END IF;

  v_text := COALESCE(NEW.review_text, '');
  v_guest_name := COALESCE(NEW.guest_name, 'Misafir');
  v_platform := COALESCE(NEW.platform, 'Google');

  -- Rule 2: AI / Rule Based Gating for 3 stars
  IF NEW.rating = 1 OR NEW.rating = 2 THEN
    v_requires_action := true;
  ELSIF NEW.rating = 3 THEN
    -- Check if text contains operational keywords
    IF v_text ~* '(klima|sıcak|soğuk|arıza|bozuk|çalışmıyor|elektrik|su|duş|internet|wifi|temizlik|oda temizliği|havlu|çarşaf|housekeeping|kirli|pis|toz|banyo|yemek|restoran|kahvaltı|servis|garson|bar|içecek|lezzetsiz|soğuktu|resepsiyon|check-in|check out|bekleme|personel|kaba|saygısız|yavaş|ilgisiz|spa|masaj|hamam|sauna|kavga|hakaret|güvenlik|sağlık|yangın|hırsızlık|tehdit|animasyon|müzik|gürültü|eğlence|şov|fatura|ödeme|rezervasyon|fiyat|pahalı|ucuz)' THEN
      v_requires_action := true;
      -- Exclude non-complaint general remarks
      IF v_text ~* '(genel olarak güzel|otel güzel ama fiyat|fiyat biraz pahalı|tekrar gelebiliriz|gelecek yıl tekrar)' AND NOT v_text ~* '(klima|arıza|bozuk|kirli|pis|kaba|saygısız|yavaş|bekledik)' THEN
        v_requires_action := false;
      END IF;
    END IF;
  END IF;

  IF NOT v_requires_action THEN
    RETURN NEW;
  END IF;

  -- Rule 6: Duplicate task check (review_id + ai_action_required)
  SELECT EXISTS(
    SELECT 1 FROM public.tasks 
    WHERE review_id = NEW.id AND (metadata->>'ai_action_required')::boolean = true
  ) INTO v_duplicate_exists;

  IF v_duplicate_exists THEN
    RETURN NEW;
  END IF;

  -- Rule 3: Department Detection Rules
  IF v_text ~* '(temizlik|oda temizliği|havlu|çarşaf|housekeeping|kirli|pis|toz|banyo)' THEN
    v_department := 'Housekeeping';
  ELSIF v_text ~* '(resepsiyon|check-in|check out|bekleme|giriş|çıkış|valiz|bagaj)' THEN
    v_department := 'Ön Büro';
  ELSIF v_text ~* '(yemek|restoran|kahvaltı|servis|garson|bar|içecek|lezzetsiz|soğuktu|çay|kahve|büfe)' THEN
    v_department := 'Yiyecek & İçecek';
  ELSIF v_text ~* '(klima|sıcak|soğuk|arıza|bozuk|çalışmıyor|elektrik|su|duş|internet|wifi|tv|televizyon|kumanda)' THEN
    v_department := 'Teknik Servis';
  ELSIF v_text ~* '(spa|masaj|hamam|sauna|havuz|şezlong)' THEN
    v_department := 'Spa';
  ELSIF v_text ~* '(güvenlik|kart|anahtar|kilit|kayıp|çalındı|kavga|hırsızlık|tehdit)' THEN
    v_department := 'Güvenlik';
  ELSIF v_text ~* '(fiyat|pahalı|ucuz|rezervasyon|satış|acente|tur)' THEN
    v_department := 'Satış';
  ELSIF v_text ~* '(fatura|fiş|slip|pos|iade|para)' THEN
    v_department := 'Muhasebe';
  ELSIF v_text ~* '(animasyon|müzik|gürültü|eğlence|şov|show|çocuk kulübü|mini club)' THEN
    v_department := 'Animasyon';
  ELSIF v_text ~* '(personel|kaba|saygısız|yavaş|ilgisiz|şikayet|yardım)' THEN
    v_department := 'Misafir İlişkileri';
  ELSE
    v_department := 'Misafir İlişkileri';
  END IF;

  -- Rule 4: Priority Rules
  IF NEW.rating = 1 THEN
    v_priority := 'critical';
  ELSIF NEW.rating = 2 THEN
    v_priority := 'high';
  ELSIF NEW.rating = 3 THEN
    v_priority := 'medium';
  END IF;

  -- Overwrite priority if contains extreme critical keyword
  IF v_text ~* '(yangın|güvenlik|yaralanma|kavga|tehdit|hırsızlık|sağlık|zehirlenme)' THEN
    v_priority := 'critical';
  END IF;

  -- Prepare Task attributes
  IF v_priority = 'critical' THEN
    v_title := 'Kritik Misafir Şikayeti: ' || v_department;
  ELSE
    v_title := 'Misafir Yorumu Takip Görevi: ' || v_department;
  END IF;

  -- Set Category variables based on v_department
  IF v_department = 'Housekeeping' THEN
    v_category_tr := 'Temizlik';
    v_category_en := 'Cleanliness';
    v_category_ru := 'Уборка';
    v_category_de := 'Sauberkeit';
  ELSIF v_department = 'Ön Büro' THEN
    v_category_tr := 'Ön Büro';
    v_category_en := 'Front Office';
    v_category_ru := 'Ресепшн';
    v_category_de := 'Rezeption';
  ELSIF v_department = 'Yiyecek & İçecek' THEN
    v_category_tr := 'Yiyecek & İçecek';
    v_category_en := 'Food & Beverage';
    v_category_ru := 'Еда и напитки';
    v_category_de := 'Essen & Trinken';
  ELSIF v_department = 'Teknik Servis' THEN
    v_category_tr := 'Teknik Arıza';
    v_category_en := 'Technical Issue';
    v_category_ru := 'Технические неполадки';
    v_category_de := 'Technische Störung';
  ELSIF v_department = 'Spa' THEN
    v_category_tr := 'Spa & Havuz';
    v_category_en := 'Spa & Pool';
    v_category_ru := 'Спа и бассейн';
    v_category_de := 'Spa & Pool';
  ELSIF v_department = 'Güvenlik' THEN
    v_category_tr := 'Güvenlik';
    v_category_en := 'Security';
    v_category_ru := 'Безопасность';
    v_category_de := 'Sicherheit';
  ELSIF v_department = 'Satış' THEN
    v_category_tr := 'Fiyat/Değer';
    v_category_en := 'Value for Money';
    v_category_ru := 'Соотношение цена/качество';
    v_category_de := 'Preis-Leistungs-Verhältnis';
  ELSIF v_department = 'Muhasebe' THEN
    v_category_tr := 'Muhasebe';
    v_category_en := 'Accounting';
    v_category_ru := 'Бухгалтерия';
    v_category_de := 'Buchhaltung';
  ELSIF v_department = 'Animasyon' THEN
    v_category_tr := 'Animasyon';
    v_category_en := 'Animation';
    v_category_ru := 'Анимация';
    v_category_de := 'Animation';
  ELSE
    v_category_tr := 'Genel Memnuniyetsizlik';
    v_category_en := 'General Dissatisfaction';
    v_category_ru := 'Общее недовольство';
    v_category_de := 'Allgemeine Unzufriedenheit';
  END IF;

  -- Language Detection
  IF v_text ~* '(the|check-in|check out|hotel|room|stay|breakfast|nice|clean|bad|service|friendly|staff)' THEN
    v_detected_lang := 'İngilizce';
  ELSIF v_text ~* '(отель|комната|уборка|завтрак|персонал|плохо|грязный|хорошо|был|были)' THEN
    v_detected_lang := 'Rusça';
  ELSIF v_text ~* '(das|ist|zimmer|sauber|schmutzig|fruhstuck|personal)' THEN
    v_detected_lang := 'Almanca';
  ELSE
    v_detected_lang := 'Türkçe';
  END IF;

  -- Sentiment Detection
  IF NEW.rating = 1 THEN
    v_sentiment := 'Çok kızgın';
  ELSIF NEW.rating = 2 THEN
    v_sentiment := 'Hayal kırıklığı';
  ELSIF NEW.rating = 3 THEN
    v_sentiment := 'Memnun ama eleştirili';
  ELSE
    v_sentiment := 'Nötr';
  END IF;

  -- Risk Level
  IF v_priority = 'critical' THEN
    v_risk := 'Kritik';
  ELSIF v_priority = 'high' THEN
    v_risk := 'Yüksek';
  ELSIF v_priority = 'medium' THEN
    v_risk := 'Orta';
  ELSE
    v_risk := 'Düşük';
  END IF;

  -- Template Summaries
  v_summary_tr := 'Misafir, ' || lower(v_category_tr) || ' konusundaki aksaklıklardan dolayı memnuniyetsizliğini dile getiriyor.';
  v_summary_en := 'The guest expresses dissatisfaction regarding ' || lower(v_category_en) || ' issues.';
  v_summary_ru := 'Гость выражает недовольство по поводу проблем с ' || lower(v_category_ru) || '.';
  v_summary_de := 'Der Gast äußert Unzufriedenheit bezüglich ' || lower(v_category_de) || '-Problemen.';

  -- Focus Strings
  v_focus_tr := 'Bu yorum ağırlıklı olarak ' || v_category_tr || ' problemi içeriyor.';
  v_focus_en := 'This review primarily concerns ' || v_category_en || ' issues.';
  v_focus_ru := 'Этот отзыв в основном касается проблем с ' || v_category_ru || '.';
  v_focus_de := 'Diese Bewertung betrifft hauptsächlich Fragen der ' || v_category_de || '.';

  -- TR Action items
  v_action1_tr := 'Misafir ilişkileri misafirle iletişime geçsin.';
  v_action2_tr := v_category_tr || ' ekibi ilgili şikayet kaydını inceleyip düzeltsin.';
  v_action3_tr := 'Çözüm sonrasında misafire bilgi verilip geri bildirim alınsın.';

  -- EN Action items
  v_action1_en := 'Guest relations should contact the guest.';
  v_action2_en := 'The ' || v_category_en || ' team should inspect and resolve the reported issue.';
  v_action3_en := 'Follow up with the guest after resolving the issue.';

  -- RU Action items
  v_action1_ru := 'Службе по работе с гостями связаться с гостем.';
  v_action2_ru := 'Команде ' || v_category_ru || ' проверить и устранить проблему.';
  v_action3_ru := 'Предоставить обратную связь после разрешения ситуации.';

  -- DE Action items
  v_action1_de := 'Gästebetreuung sollte den Gast kontaktieren.';
  v_action2_de := 'Das Team für ' || v_category_de || ' sollte das gemeldete Problem prüfen.';
  v_action3_de := 'Nach Behebung Feedback beim Gast einholen.';

  v_description := 'Misafir Yorumu: "' || v_text || '"' || chr(10) ||
                   'Platform: ' || v_platform || chr(10) ||
                   'Misafir: ' || v_guest_name || chr(10) ||
                   'Puan: ' || NEW.rating || ' Yıldız' || chr(10) ||
                   'Yapay Zeka Aksiyon Önerisi: ' || v_action1_tr || ' ' || v_action2_tr || ' ' || v_action3_tr;

  v_due_date := (CURRENT_DATE + INTERVAL '2 days')::date;

  -- Insert automated task
  INSERT INTO public.tasks (
    hotel_id,
    organization_id,
    review_id,
    title,
    description,
    department,
    priority,
    status,
    source_platform,
    due_date,
    metadata,
    created_at
  ) VALUES (
    NEW.hotel_id,
    NEW.organization_id,
    NEW.id,
    v_title,
    v_description,
    v_department,
    v_priority,
    'open',
    v_platform,
    v_due_date,
    jsonb_build_object(
      'rating', NEW.rating,
      'guest_name', v_guest_name,
      'platform', v_platform,
      'review_date', NEW.created_at,
      'ai_action_required', true,
      'ai_recommended_action', v_action1_tr || ' ' || v_action2_tr || ' ' || v_action3_tr,
      'detected_department', v_department,
      'review_summary', v_summary_tr,
      'complaint_category', v_category_tr,
      'complaint_focus', v_focus_tr,
      'guest_sentiment', v_sentiment,
      'risk_level', v_risk,
      'detected_language', v_detected_lang,
      'recommended_actions', jsonb_build_array(v_action1_tr, v_action2_tr, v_action3_tr),
      'translations', jsonb_build_object(
        'TR', jsonb_build_object(
          'review_summary', v_summary_tr,
          'complaint_category', v_category_tr,
          'complaint_focus', v_focus_tr,
          'recommended_actions', jsonb_build_array(v_action1_tr, v_action2_tr, v_action3_tr)
        ),
        'EN', jsonb_build_object(
          'review_summary', v_summary_en,
          'complaint_category', v_category_en,
          'complaint_focus', v_focus_en,
          'recommended_actions', jsonb_build_array(v_action1_en, v_action2_en, v_action3_en)
        ),
        'RU', jsonb_build_object(
          'review_summary', v_summary_ru,
          'complaint_category', v_category_ru,
          'complaint_focus', v_focus_ru,
          'recommended_actions', jsonb_build_array(v_action1_ru, v_action2_ru, v_action3_ru)
        ),
        'DE', jsonb_build_object(
          'review_summary', v_summary_de,
          'complaint_category', v_category_de,
          'complaint_focus', v_focus_de,
          'recommended_actions', jsonb_build_array(v_action1_de, v_action2_de, v_action3_de)
        )
      )
    ),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
