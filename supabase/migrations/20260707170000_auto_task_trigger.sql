-- Migration: Create automated task creation trigger for low rating reviews
CREATE OR REPLACE FUNCTION public.auto_create_task_from_low_rating_review()
RETURNS TRIGGER AS $$
DECLARE
  v_department TEXT := 'Misafir İlişkileri';
  v_priority TEXT := 'medium';
  v_title TEXT;
  v_description TEXT;
  v_ai_action_recommended TEXT;
  v_detected_keywords TEXT[] := '{}';
  v_requires_action BOOLEAN := false;
  v_duplicate_exists BOOLEAN := false;
  v_text TEXT;
  v_guest_name TEXT;
  v_platform TEXT;
  v_due_date DATE;
BEGIN
  -- Rule 1: check rating
  IF NEW.rating > 3 OR NEW.rating IS NULL THEN
    RETURN NEW;
  END IF;

  v_text := COALESCE(NEW.review_text, '');
  v_guest_name := COALESCE(NEW.guest_name, 'Misafir');
  v_platform := COALESCE(NEW.platform, 'Google');

  -- Rule 2: AI / Rule Based Evaluation for 3 stars
  IF NEW.rating = 1 OR NEW.rating = 2 THEN
    v_requires_action := true;
  ELSIF NEW.rating = 3 THEN
    -- Check if text contains operational keywords
    IF v_text ~* '(klima|sıcak|soğuk|arıza|bozuk|çalışmıyor|elektrik|su|duş|internet|wifi|temizlik|oda temizliği|havlu|çarşaf|housekeeping|kirli|pis|toz|banyo|yemek|restoran|kahvaltı|servis|garson|bar|içecek|lezzetsiz|soğuktu|resepsiyon|check-in|check out|bekleme|personel|kaba|saygısız|yavaş|ilgisiz|spa|masaj|hamam|sauna|kavga|hakaret|güvenlik|sağlık|yangın|hırsızlık|tehdit)' THEN
      v_requires_action := true;
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

  -- Rule 3: Department Assignment Rules
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

  -- Rule 4: Priority Rules
  IF NEW.rating = 1 THEN
    v_priority := 'critical';
  ELSIF NEW.rating = 2 THEN
    v_priority := 'high';
  ELSIF NEW.rating = 3 THEN
    v_priority := 'medium';
  END IF;

  -- Overwrite if contains extreme critical keywords
  IF v_text ~* '(kavga|hakaret|güvenlik|sağlık|yangın|hırsızlık|tehdit)' THEN
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

-- Trigger definition
DROP TRIGGER IF EXISTS trigger_auto_create_task ON public.reviews;
CREATE TRIGGER trigger_auto_create_task
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_task_from_low_rating_review();
