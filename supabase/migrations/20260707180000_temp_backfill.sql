-- Migration: Backfill existing low rating reviews into operational tasks
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
  v_scanned INTEGER := 0;
  v_created INTEGER := 0;
  v_duplicate INTEGER := 0;
BEGIN
  FOR v_rec IN 
    SELECT * FROM public.reviews WHERE rating <= 3
  LOOP
    v_scanned := v_scanned + 1;
    v_text := COALESCE(v_rec.review_text, '');
    v_guest_name := COALESCE(v_rec.guest_name, 'Misafir');
    v_platform := COALESCE(v_rec.platform, 'Google');

    v_requires_action := false;
    IF v_rec.rating = 1 OR v_rec.rating = 2 THEN
      v_requires_action := true;
    ELSIF v_rec.rating = 3 THEN
      IF v_text ~* '(klima|sıcak|soğuk|arıza|bozuk|çalışmıyor|elektrik|su|duş|internet|wifi|temizlik|oda temizliği|havlu|çarşaf|housekeeping|kirli|pis|toz|banyo|yemek|restoran|kahvaltı|servis|garson|bar|içecek|lezzetsiz|soğuktu|resepsiyon|check-in|check out|bekleme|personel|kaba|saygısız|yavaş|ilgisiz|spa|masaj|hamam|sauna|kavga|hakaret|güvenlik|sağlık|yangın|hırsızlık|tehdit)' THEN
        v_requires_action := true;
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
      v_duplicate := v_duplicate + 1;
      CONTINUE;
    END IF;

    -- Department classification
    v_department := 'Misafir İlişkileri';
    IF v_text ~* '(klima|sıcak|soğuk|arıza|bozuk|çalışmıyor|elektrik|su|duş|internet|wifi)' THEN
      v_department := 'Teknik Servis';
    ELSIF v_text ~* '(temizlik|oda temizliği|havlu|çarşaf|housekeeping|kirli|pis|toz|banyo)' THEN
      v_department := 'Housekeeping';
    ELSIF v_text ~* '(yemek|restoran|kahvaltı|servis|garson|bar|içecek|lezzetsiz|soğuktu)' THEN
      v_department := 'Yiyecek & İçecek';
    ELSIF v_text ~* '(resepsiyon|check-in|check out|bekleme|personel|kaba|saygısız|yavaş|ilgisiz)' THEN
      v_department := 'Ön Büro';
    ELSIF v_text ~* '(spa|masaj|hamam|sauna)' THEN
      v_department := 'Spa';
    END IF;

    -- Priority Gating
    IF v_rec.rating = 1 THEN
      v_priority := 'critical';
    ELSIF v_rec.rating = 2 THEN
      v_priority := 'high';
    ELSIF v_rec.rating = 3 THEN
      v_priority := 'medium';
    END IF;

    IF v_text ~* '(kavga|hakaret|güvenlik|sağlık|yangın|hırsızlık|tehdit)' THEN
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

    v_created := v_created + 1;
  END LOOP;

  RAISE NOTICE 'Scanned Reviews: %, Created Tasks: %, Skipped Duplicates: %', v_scanned, v_created, v_duplicate;
END;
$$;
