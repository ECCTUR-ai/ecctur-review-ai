import { getHotelOperationsAnalysisPrompt } from '../api/utils/operationsAnalysisPrompt.js';
import { OperationsAnalysisV2Schema, normalizeDistribution } from '../api/utils/operationsAnalysisSchema.js';
import { getLocalFallback } from '../api/utils/operationsAnalysis.js';

// Setup environment mock
process.env.AI_OPERATIONS_MODEL = 'gpt-4o';

const SCENARIOS = [
  {
    name: 'Scenario 1: Front Office (Ön Büro) Complaint',
    text: 'Resepsiyona geldiğimizde yarım saat giriş işlemlerinin tamamlanmasını bekledik. Bize karşı son derece ilgisiz ve kaba davrandılar, oda hazır dediler ama gidince temizlenmediğini gördük.',
    rating: 2
  },
  {
    name: 'Scenario 2: Housekeeping (Kat Hizmetleri) Complaint',
    text: 'Oda genel olarak kirliydi. Çarşaflarda lekeler vardı ve havlular 3 gün boyunca hiç değiştirilmedi. Temizlik talep etmemize rağmen gelen giden olmadı.',
    rating: 1
  },
  {
    name: 'Scenario 3: Food & Beverage (Yiyecek & İçecek) Complaint',
    text: 'Açık büfe yemekler soğuktu ve lezzetsizdi. Restaurant bölümündeki garsonlar çok yavaştı, içecek sipariş etmek için 20 dakika bekledik.',
    rating: 2
  },
  {
    name: 'Scenario 4: Beach Operations (Plaj) Complaint',
    text: 'Sabah saat 8de gitmemize rağmen plajda hiç şezlong bulamadık. Havuz kenarı da çok kalabalıktı ve şezlong kapasitesi otel nüfusuna göre yetersiz.',
    rating: 3
  },
  {
    name: 'Scenario 5: Mixed (Karma) Complaint',
    text: 'Otelde oda temizliği güzeldi ancak yemekler çok kötüydü. Ayrıca giriş yaparken resepsiyonda çok beklettiler, check-in süreci berbattı.',
    rating: 2
  },
  {
    name: 'Scenario 6: Positive / Praise (Pozitif/Övgü) Review',
    text: 'Her şey mükemmeldi! Çalışanların güler yüzlülüğü, yemeklerin lezzeti ve odaların temizliği bizi hayran bıraktı. Seneye kesinlikle tekrar geleceğiz.',
    rating: 5
  }
];

// Mock OpenAI Responses for V2 Validation Test
const MOCK_OPENAI_RESPONSES = {
  'Scenario 1: Front Office (Ön Büro) Complaint': {
    version: "2.0",
    executive_summary: "Misafir resepsiyonda uzun bekleme süresi ve personelin kaba davranışından şikayetçi.",
    overall_sentiment: "negative",
    emotion: "Kızgın",
    confidence: 95,
    main_problem: {
      title: "Giriş Bekleme Süresi ve Personel Kabalığı",
      category: "Resepsiyon & Giriş",
      department: "Front Office",
      impact: 80,
      evidence: ["yarım saat giriş işlemlerinin tamamlanmasını bekledik", "ilgisiz ve kaba davrandılar"]
    },
    secondary_problems: [
      {
        title: "Oda Temizlik Koordinasyonu",
        category: "Oda Hazırlığı",
        department: "Housekeeping",
        impact: 20,
        evidence: ["oda hazır dediler ama gidince temizlenmediğini gördük"]
      }
    ],
    problem_distribution: [
      { title: "Giriş Bekleme Süresi", category: "Resepsiyon & Giriş", department: "Front Office", impact: 80 },
      { title: "Oda Temizlik Koordinasyonu", category: "Oda Hazırlığı", department: "Housekeeping", impact: 20 }
    ],
    department_distribution: [
      { department: "Front Office", impact: 80 },
      { department: "Housekeeping", impact: 20 }
    ],
    root_cause_chain: [
      { step: 1, title: "Yoğunluk Yönetimi Eksikliği", description: "Giriş saatlerinde resepsiyonda personel yetersizliği." },
      { step: 2, title: "İletişim Eksikliği", description: "Oda temizlik durumunun Ön Büro ve Kat Hizmetleri arasında koordine edilememesi." }
    ],
    risk_analysis: [
      { risk: "google_rating", label: "Puan Riski", level: "high", reason: "Kötü karşılama deneyimi düşük Google puanına yol açabilir." }
    ],
    affected_kpis: [
      { name: "Check-in Speed", impact: "high" },
      { name: "Staff Hospitality", impact: "high" }
    ],
    recommended_actions: [
      {
        department: "Front Office",
        action: "Giriş yoğun saatlerinde resepsiyona ek personel desteği sağlanması.",
        priority: "high",
        expected_impact: "high",
        estimated_time: "24 Saat",
        auto_task_eligible: true
      }
    ],
    tags: ["Front Office", "Bekleme Süresi", "Personel İletişimi"]
  },
  'Scenario 2: Housekeeping (Kat Hizmetleri) Complaint': {
    version: "2.0",
    executive_summary: "Oda temizliği yetersizliği ve havlu değişimi taleplerinin karşılanmaması şikayeti.",
    overall_sentiment: "negative",
    emotion: "Hüsran",
    confidence: 98,
    main_problem: {
      title: "Oda Temizliği ve Havlu Değişimi Eksikliği",
      category: "Oda Temizliği",
      department: "Housekeeping",
      impact: 100,
      evidence: ["Oda genel olarak kirliydi", "havlular 3 gün boyunca hiç değiştirilmedi"]
    },
    secondary_problems: [],
    problem_distribution: [
      { title: "Oda Temizliği", category: "Oda Temizliği", department: "Housekeeping", impact: 60 },
      { title: "Havlu Değişimi", category: "Kişisel Bakım Ürünleri", department: "Housekeeping", impact: 40 }
    ],
    department_distribution: [
      { department: "Housekeeping", impact: 100 }
    ],
    root_cause_chain: [
      { step: 1, title: "Kat Görevlisi Denetim Eksikliği", description: "Odalarda standart temizlik kontrol listesinin uygulanmaması." }
    ],
    risk_analysis: [
      { risk: "guest_retention", label: "Geri Dönüş Kaybı", level: "high", reason: "Hijyen şikayetleri misafir kaybına sebep olur." }
    ],
    affected_kpis: [
      { name: "Room Cleanliness", impact: "critical" }
    ],
    recommended_actions: [
      {
        department: "Housekeeping",
        action: "Kat şeflerinin odaları teslim almadan önce detaylı denetim yapması.",
        priority: "critical",
        expected_impact: "very_high",
        estimated_time: "12 Saat",
        auto_task_eligible: true
      }
    ],
    tags: ["Temizlik", "Havlu Değişimi", "Hijyen"]
  },
  'Scenario 3: Food & Beverage (Yiyecek & İçecek) Complaint': {
    version: "2.0",
    executive_summary: "Açık büfe yemeklerin soğuk/lezzetsiz olması ve servis elemanlarının aşırı yavaşlığı.",
    overall_sentiment: "negative",
    emotion: "Memnuniyetsiz",
    confidence: 96,
    main_problem: {
      title: "Yemek Sıcaklığı ve Kalitesi",
      category: "Yemek Lezzeti & Sıcaklığı",
      department: "Food & Beverage",
      impact: 70,
      evidence: ["soğuktu ve lezzetsizdi"]
    },
    secondary_problems: [
      {
        title: "Servis Hızı Yetersizliği",
        category: "Servis Kalitesi",
        department: "Food & Beverage",
        impact: 30,
        evidence: ["garsonlar çok yavaştı, içecek sipariş etmek için 20 dakika bekledik"]
      }
    ],
    problem_distribution: [
      { title: "Yemek Sıcaklığı ve Kalitesi", category: "Yemek Lezzeti & Sıcaklığı", department: "Food & Beverage", impact: 70 },
      { title: "Servis Hızı Yetersizliği", category: "Servis Kalitesi", department: "Food & Beverage", impact: 30 }
    ],
    department_distribution: [
      { department: "Food & Beverage", impact: 100 }
    ],
    root_cause_chain: [
      { step: 1, title: "Büfe Ekipman Arızası", description: "Büfe reşolarının yemekleri sıcak tutacak ısıya ulaşamaması." }
    ],
    risk_analysis: [
      { risk: "negative_word_of_mouth", label: "Kötü Kulaktan Kulağa Pazarlama", level: "medium", reason: "Yemek memnuniyetsizliği aile konaklamalarında tavsiye edilmeme sebebi." }
    ],
    affected_kpis: [
      { name: "Food Quality", impact: "high" },
      { name: "Service Speed", impact: "medium" }
    ],
    recommended_actions: [
      {
        department: "Food & Beverage",
        action: "Açık büfedeki sıcaklık zincirinin mutfak ekibiyle saatlik kontrol edilmesi.",
        priority: "high",
        expected_impact: "high",
        estimated_time: "24 Saat",
        auto_task_eligible: true
      }
    ],
    tags: ["Yemekler", "Restoran Servisi", "Yavaş Servis"]
  },
  'Scenario 4: Beach Operations (Plaj) Complaint': {
    version: "2.0",
    executive_summary: "Plaj ve havuz alanında şezlong yetersizliği ve aşırı kalabalık sorunu.",
    overall_sentiment: "neutral",
    emotion: "Nötr/Hafif Memnuniyetsiz",
    confidence: 92,
    main_problem: {
      title: "Şezlong Kapasite Yetersizliği",
      category: "Plaj ve Havuz Ekipmanı",
      department: "Beach Operations",
      impact: 100,
      evidence: ["plajda hiç şezlong bulamadık", "şezlong kapasitesi otel nüfusuna göre yetersiz"]
    },
    secondary_problems: [],
    problem_distribution: [
      { title: "Şezlong Kapasitesi", category: "Plaj ve Havuz Ekipmanı", department: "Beach Operations", impact: 100 }
    ],
    department_distribution: [
      { department: "Beach Operations", impact: 100 }
    ],
    root_cause_chain: [
      { step: 1, title: "Ekipman Envanter Yetersizliği", description: "Misafir doluluk oranına kıyasla plajdaki şezlong adedinin az olması." }
    ],
    risk_analysis: [
      { risk: "google_rating", label: "Düşük Puan Riski", level: "medium", reason: "Plaj şezlong kavgası sosyal medyada kötü yorumlara yol açar." }
    ],
    affected_kpis: [
      { name: "Beach Experience", impact: "high" }
    ],
    recommended_actions: [
      {
        department: "Beach Operations",
        action: "Plaj alanına acil olarak 50 adet yeni şezlong siparişi verilmesi ve yerleştirilmesi.",
        priority: "medium",
        expected_impact: "high",
        estimated_time: "3 Gün",
        auto_task_eligible: true
      }
    ],
    tags: ["Şezlong", "Plaj", "Kapasite Sorunu"]
  },
  'Scenario 5: Mixed (Karma) Complaint': {
    version: "2.0",
    executive_summary: "Girişte uzun bekleme süresi ve yemeklerin kalitesizliği şikayetleri mevcutken oda temizliği beğenilmiştir.",
    overall_sentiment: "mixed",
    emotion: "Karışık",
    confidence: 94,
    main_problem: {
      title: "Check-in Süreci Bekleme Süresi",
      category: "Resepsiyon & Giriş",
      department: "Front Office",
      impact: 50,
      evidence: ["resepsiyonda çok beklettiler", "check-in süreci berbattı"]
    },
    secondary_problems: [
      {
        title: "Yemek Kalitesi Sorunları",
        category: "Yemek Lezzeti",
        department: "Food & Beverage",
        impact: 50,
        evidence: ["yemekler çok kötüydü"]
      }
    ],
    problem_distribution: [
      { title: "Resepsiyon Giriş Sorunu", category: "Resepsiyon & Giriş", department: "Front Office", impact: 50 },
      { title: "Yemek Kalitesi Sorunları", category: "Yemek Lezzeti", department: "Food & Beverage", impact: 50 }
    ],
    department_distribution: [
      { department: "Front Office", impact: 50 },
      { department: "Food & Beverage", impact: 50 }
    ],
    root_cause_chain: [
      { step: 1, title: "Çift Departman Aksaklığı", description: "Ön Büro giriş süreçlerinde yığılma, Mutfak ekibinde büfe lezzet takibi eksikliği." }
    ],
    risk_analysis: [
      { risk: "google_rating", label: "Puan Düşüşü", level: "medium", reason: "İki kritik alandaki aksaklıklar puanı 2ye düşürüyor." }
    ],
    affected_kpis: [
      { name: "Front Desk Service", impact: "high" },
      { name: "Food & Beverage Satisfaction", impact: "high" }
    ],
    recommended_actions: [
      {
        department: "Front Office",
        action: "Giriş işlemlerini hızlandırmak için check-in formlarının dijitalleştirilmesi.",
        priority: "medium",
        expected_impact: "medium",
        estimated_time: "7 Gün",
        auto_task_eligible: true
      }
    ],
    tags: ["Karma Değerlendirme", "Ön Büro", "Yemekler"]
  },
  'Scenario 6: Positive / Praise (Pozitif/Övgü) Review': {
    version: "2.0",
    executive_summary: "Misafir otel personeli, yemek lezzeti ve oda temizliğinden son derece memnun kalmış.",
    overall_sentiment: "positive",
    emotion: "Çok Memnun",
    confidence: 97,
    main_problem: null,
    secondary_problems: [],
    problem_distribution: [],
    department_distribution: [
      { department: "Guest Relations", impact: 40 },
      { department: "Food & Beverage", impact: 30 },
      { department: "Housekeeping", impact: 30 }
    ],
    root_cause_chain: [],
    risk_analysis: [],
    affected_kpis: [
      { name: "Guest NPS", impact: "high" }
    ],
    recommended_actions: [
      {
        department: "Guest Relations",
        action: "Misafire teşekkür maili atılması ve sonraki rezervasyonu için özel bir teklif sunulması.",
        priority: "low",
        expected_impact: "medium",
        estimated_time: "24 Saat",
        auto_task_eligible: false
      }
    ],
    tags: ["Mükemmel Konaklama", "Güler Yüzlü Hizmet", "Tavsiye Edilir"]
  }
};

async function runTests() {
  console.log("==================================================");
  console.log("STARTING OPERATIONS V2 ARCHITECTURE VERIFICATION TEST");
  console.log("==================================================\n");

  let passedTests = 0;

  for (const scenario of SCENARIOS) {
    console.log(`--------------------------------------------------`);
    console.log(`[TESTING] ${scenario.name}`);
    console.log(`Comment: "${scenario.text}"`);
    console.log(`Rating: ${scenario.rating}`);
    console.log(`--------------------------------------------------`);

    // Test 1: Fallback heuristic resolution
    const fallback = getLocalFallback(scenario.text, scenario.rating);
    console.log(`✅ Fallback Department Detected: ${fallback.department_distribution[0]?.department}`);
    console.log(`✅ Fallback Summary: ${fallback.executive_summary}`);
    
    // Validate Fallback format matches V2 schema
    try {
      OperationsAnalysisV2Schema.parse(fallback);
      console.log(`✅ Local fallback successfully validated against OperationsAnalysisV2 Zod Schema.`);
    } catch (err) {
      console.error(`❌ Fallback Schema Validation failed:`, err);
    }

    // Test 2: Prompt compilation check
    const prompt = getHotelOperationsAnalysisPrompt(scenario.text, scenario.rating);
    if (prompt.includes("GUEST REVIEW TEXT TO ANALYZE") && prompt.includes("confidence")) {
      console.log(`✅ AI operations prompt built correctly with role and guidelines.`);
    } else {
      console.error(`❌ Prompt building error!`);
    }

    // Test 3: Validate mock OpenAI response & normalize distributions
    const mockResponse = MOCK_OPENAI_RESPONSES[scenario.name];
    if (mockResponse) {
      try {
        const validated = OperationsAnalysisV2Schema.parse(mockResponse);
        
        // Check normalization
        const normalizedProbs = normalizeDistribution(validated.problem_distribution);
        const normalizedDepts = normalizeDistribution(validated.department_distribution);
        
        // Sum weights
        const probSum = normalizedProbs.reduce((acc, p) => acc + p.impact, 0);
        const deptSum = normalizedDepts.reduce((acc, d) => acc + d.impact, 0);

        console.log(`✅ Mock Response validated against Schema.`);
        console.log(`✅ Normalized problem distribution sum: ${probSum}% (Target: 100% or 0% if empty)`);
        console.log(`✅ Normalized department distribution sum: ${deptSum}% (Target: 100% or 0% if empty)`);
        
        if (probSum === 100 || validated.problem_distribution.length === 0) {
          console.log(`✅ Problem distribution sums to exactly 100% (or empty).`);
        } else {
          console.error(`❌ Problem distribution sum is invalid: ${probSum}`);
        }
        
        if (deptSum === 100 || validated.department_distribution.length === 0) {
          console.log(`✅ Department distribution sums to exactly 100% (or empty).`);
          passedTests++;
        } else {
          console.error(`❌ Department distribution sum is invalid: ${deptSum}`);
        }
      } catch (err) {
        console.error(`❌ Validation failed for mock response:`, err);
      }
    } else {
      console.log(`⚠️ Mock OpenAI response missing for scenario`);
    }
    console.log();
  }

  console.log("==================================================");
  console.log(`VERIFICATION RESULT: ${passedTests} / ${SCENARIOS.length} SCENARIOS FULLY VERIFIED`);
  console.log("==================================================");
}

runTests().catch(console.error);
