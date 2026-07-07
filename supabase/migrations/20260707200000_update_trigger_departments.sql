-- Migration: Upgrade automated task creator trigger function with full department and keyword rulesets
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

  v_ai_action_recommended := 'Misafir ile iletişime geç, ' || lower(v_department) || ' ekibiyle konuyu koordine et, çözüm sonrası geri bildirim al.';

  v_description := 'Misafir Yorumu: "' || v_text || '"' || chr(10) ||
                   'Platform: ' || v_platform || chr(10) ||
                   'Misafir: ' || v_guest_name || chr(10) ||
                   'Puan: ' || NEW.rating || ' Yıldız' || chr(10) ||
                   'Yapay Zeka Aksiyon Önerisi: ' || v_ai_action_recommended;

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
      'ai_recommended_action', v_ai_action_recommended,
      'detected_department', v_department
    ),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger trigger_auto_create_task to target the updated function signature
DROP TRIGGER IF EXISTS trigger_auto_create_task ON public.reviews;
CREATE TRIGGER trigger_auto_create_task
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_task_from_low_rating_review();

-- Execute incremental backfill for any missed reviews using the upgraded rulesets
DO $$
DECLARE
  v_rec RECORD;
  v_department TEXT;
  v_priority TEXT;
  v_title TEXT;
  v_description TEXT;
  v_ai_action_recommended TEXT;
  v_requires_action BOOLEAN;
  v_duplicate_exists BOOLEAN;
  v_text TEXT;
  v_guest_name TEXT;
  v_platform TEXT;
  v_due_date DATE;
BEGIN
  FOR v_rec IN 
    SELECT * FROM public.reviews WHERE rating <= 3
  LOOP
    v_text := COALESCE(v_rec.review_text, '');
    v_guest_name := COALESCE(v_rec.guest_name, 'Misafir');
    v_platform := COALESCE(v_rec.platform, 'Google');

    v_requires_action := false;
    IF v_rec.rating = 1 OR v_rec.rating = 2 THEN
      v_requires_action := true;
    ELSIF v_rec.rating = 3 THEN
      IF v_text ~* '(klima|sıcak|soğuk|arıza|bozuk|çalışmıyor|elektrik|su|duş|internet|wifi|temizlik|oda temizliği|havlu|çarşaf|housekeeping|kirli|pis|toz|banyo|yemek|restoran|kahvaltı|servis|garson|bar|içecek|lezzetsiz|soğuktu|resepsiyon|check-in|check out|bekleme|personel|kaba|saygısız|yavaş|ilgisiz|spa|masaj|hamam|sauna|kavga|hakaret|güvenlik|sağlık|yangın|hırsızlık|tehdit|animasyon|müzik|gürültü|eğlence|şov|fatura|ödeme|rezervasyon|fiyat|pahalı|ucuz)' THEN
        v_requires_action := true;
        IF v_text ~* '(genel olarak güzel|otel güzel ama fiyat|fiyat biraz pahalı|tekrar gelebiliriz|gelecek yıl tekrar)' AND NOT v_text ~* '(klima|arıza|bozuk|kirli|pis|kaba|saygısız|yavaş|bekledik)' THEN
          v_requires_action := false;
        END IF;
      END IF;
    END IF;

    IF NOT v_requires_action THEN
      CONTINUE;
    END IF;

    -- Check duplicate task (review_id + ai_action_required)
    SELECT EXISTS(
      SELECT 1 FROM public.tasks 
      WHERE review_id = v_rec.id AND (metadata->>'ai_action_required')::boolean = true
    ) INTO v_duplicate_exists;

    IF v_duplicate_exists THEN
      CONTINUE;
    END IF;

    -- Department Detection
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

    -- Priority Gating
    IF v_rec.rating = 1 THEN
      v_priority := 'critical';
    ELSIF v_rec.rating = 2 THEN
      v_priority := 'high';
    ELSIF v_rec.rating = 3 THEN
      v_priority := 'medium';
    END IF;

    IF v_text ~* '(yangın|güvenlik|yaralanma|kavga|tehdit|hırsızlık|sağlık|zehirlenme)' THEN
      v_priority := 'critical';
    END IF;

    -- Prepare Task details
    IF v_priority = 'critical' THEN
      v_title := 'Kritik Misafir Şikayeti: ' || v_department;
    ELSE
      v_title := 'Misafir Yorumu Takip Görevi: ' || v_department;
    END IF;

    v_ai_action_recommended := 'Misafir ile iletişime geç, ' || lower(v_department) || ' ekibiyle konuyu koordine et, çözüm sonrası geri bildirim al.';

    v_description := 'Misafir Yorumu: "' || v_text || '"' || chr(10) ||
                     'Platform: ' || v_platform || chr(10) ||
                     'Misafir: ' || v_guest_name || chr(10) ||
                     'Puan: ' || v_rec.rating || ' Yıldız' || chr(10) ||
                     'Yapay Zeka Aksiyon Önerisi: ' || v_ai_action_recommended;

    v_due_date := (CURRENT_DATE + INTERVAL '2 days')::date;

    -- Insert task
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
      v_rec.hotel_id,
      v_rec.organization_id,
      v_rec.id,
      v_title,
      v_description,
      v_department,
      v_priority,
      'open',
      v_platform,
      v_due_date,
      jsonb_build_object(
        'rating', v_rec.rating,
        'guest_name', v_guest_name,
        'platform', v_platform,
        'review_date', v_rec.created_at,
        'ai_action_required', true,
        'ai_recommended_action', v_ai_action_recommended,
        'detected_department', v_department
      ),
      now()
    );
  END LOOP;
END;
$$;
