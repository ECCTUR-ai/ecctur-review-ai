// src/services/reviewService.ts
import { supabase } from '@/lib/supabase';
import { Review, ReviewSource, Sentiment, ReviewStatus, ReviewPriority } from '@/types';
import { reviewRepository } from '@/repositories/reviewRepository';
import { settingsService } from './settingsService';

export const reviewService = {
  async getReviews(params?: {
    hotelId?: string;
    source?: ReviewSource;
    sentiment?: Sentiment;
    status?: ReviewStatus;
    priority?: ReviewPriority;
    search?: string;
    rating?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ reviews: Review[]; total: number }> {
    return await reviewRepository.getReviews(params);
  },

  async getReviewById(id: string): Promise<Review> {
    return await reviewRepository.getReviewById(id);
  },

  async generateAiResponse(id: string): Promise<{ response: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: { reviewId: id }
      });
      if (error) throw new Error(error.message);
      return data;
    } catch (e) {
      // In case edge function isn't deployed on Supabase, compute a professional reply client-side
      const reviewObj = await this.getReviewById(id);
      
      // Fetch recent replies from same hotel to prevent repetition
      let recentReplies: string[] = [];
      try {
        const recent = await reviewRepository.getReviews({ hotelId: reviewObj.hotelId, limit: 10 });
        if (recent && recent.reviews) {
          recentReplies = recent.reviews
            .map(r => r.response || '')
            .filter(res => res.trim().length > 0);
        }
      } catch (err) {
        console.warn('Failed to fetch recent replies for similarity check:', err);
      }

      // Fetch AI settings (tone)
      let tone: 'professional' | 'warm' | 'luxury' | 'concise' = 'professional';
      try {
        const settings = await settingsService.getSettings();
        if (settings && settings.tone) {
          const tVal = settings.tone as any;
          if (tVal === 'formal' || tVal === 'professional') tone = 'professional';
          else if (tVal === 'warm') tone = 'warm';
          else if (tVal === 'luxury') tone = 'luxury';
          else if (tVal === 'concise') tone = 'concise';
        }
      } catch (err) {
        // Fallback to professional
      }

      // 1. Detect Guest Language
      const detectLanguage = (text: string): 'tr' | 'en' | 'de' | 'ru' => {
        const trWords = ["çok", "iyi", "otel", "personel", "harika", "oda", "temiz", "güzel", "yemek", "konum", "memnun", "tavsiye", "değil", "ama", "ancak", "servis", "memnuniyet"];
        const deWords = ["sehr", "gut", "hotel", "zimmer", "freundlich", "sauber", "schön", "essen", "lage", "zufrieden", "empfehlen", "nicht", "aber", "service", "frühstück"];
        const ruWords = ["очень", "хорошо", "отель", "номер", "персонал", "чисто", "красиво", "еда", "расположение", "доволен", "рекомендую", "не", "но", "сервис"];
        
        const commentLower = text.toLowerCase();
        let trCount = 0;
        let deCount = 0;
        let ruCount = 0;
        
        trWords.forEach(w => { if (commentLower.includes(w)) trCount++; });
        deWords.forEach(w => { if (commentLower.includes(w)) deCount++; });
        ruWords.forEach(w => { if (commentLower.includes(w)) ruCount++; });
        
        if (trCount > deCount && trCount > ruCount && trCount > 0) return 'tr';
        if (deCount > trCount && deCount > ruCount && deCount > 0) return 'de';
        if (ruCount > trCount && ruCount > deCount && ruCount > 0) return 'ru';
        
        return 'en';
      };
      
      const guestLang = detectLanguage(reviewObj.comment || '');

      // 2. Extract specific praises or complaints from comment keywords
      const extractDetails = (comment: string, lang: 'tr' | 'en' | 'de' | 'ru', rating: number) => {
        const commentLower = comment.toLowerCase();
        const praise: string[] = [];
        const complaint: string[] = [];

        const trKeywords = {
          yemek: {
            words: ["yemek", "kahvaltı", "lezzet", "açık büfe", "tatlar", "aşçı", "mutfak", "restoran"],
            praise: "lezzetli yemeklerimiz ve açık büfe çeşitlerimiz",
            complaint: "yemek kalitesi ve çeşitliliği"
          },
          personel: {
            words: ["personel", "çalışan", "ilgi", "güler yüz", "yardımsever", "ekip", "recep", "resepsiyon", "garson"],
            praise: "ekibimizin güler yüzlü ve özverili yaklaşımı",
            complaint: "servis hızı ve hizmet sırasındaki aksaklıklar"
          },
          oda: {
            words: ["oda", "yatak", "temiz", "manzara", "banyo", "konfor", "modern", "dekorasyon"],
            praise: "odalarımızın hijyeni, temizliği ve konforu",
            complaint: "odaların genel konforu ve teknik eksiklikleri"
          },
          konum: {
            words: ["konum", "yakın", "ulaşım", "merkez", "plaj", "doğa", "manzara"],
            praise: "otelimizi tercih etmenizde büyük rol oynayan harika konumumuz",
            complaint: "otelin konumu ve ulaşımla ilgili yaşanan zorluklar"
          },
          spa: {
            words: ["spa", "havuz", "masaj", "sauna", "dinlenme"],
            praise: "spa ve havuz alanlarımızın kalitesi",
            complaint: "spa/havuz alanındaki hizmet yetersizlikleri"
          }
        };

        const enKeywords = {
          food: {
            words: ["food", "breakfast", "dinner", "delicious", "buffet", "restaurant", "chef", "taste"],
            praise: "the delicious culinary offerings at our restaurant",
            complaint: "the food variety and dining temperature"
          },
          staff: {
            words: ["staff", "personnel", "friendly", "helpful", "service", "welcome", "hospitality", "reception", "team"],
            praise: "the warm hospitality and helpfulness of our staff members",
            complaint: "the service speed and staff responsiveness"
          },
          room: {
            words: ["room", "bed", "clean", "view", "comfort", "modern", "bathroom", "decor"],
            praise: "the comfort and cleanliness of your room",
            complaint: "the room maintenance or noise levels"
          },
          location: {
            words: ["location", "close", "beach", "center", "view", "scenery"],
            praise: "our hotel's convenient location and surroundings",
            complaint: "the local access or transport convenience"
          },
          spa: {
            words: ["spa", "pool", "massage", "sauna", "poolside"],
            praise: "the relaxing environment of our pool and spa areas",
            complaint: "the maintenance of the wellness and pool facilities"
          }
        };

        const deKeywords = {
          essen: {
            words: ["essen", "frühstück", "lecker", "buffet", "restaurant", "küche", "geschmeckt"],
            praise: "die kulinarischen Spezialitäten unseres Hauses",
            complaint: "die Qualität und Temperatur unseres Speisenangebots"
          },
          personal: {
            words: ["personal", "mitarbeiter", "freundlich", "hilfsbereit", "service", "empfang", "team"],
            praise: "die herzliche Gastfreundschaft unseres Teams",
            complaint: "die Servicegeschwindigkeit und Betreuung"
          },
          zimmer: {
            words: ["zimmer", "bett", "sauber", "aussicht", "komfort", "modern", "bad"],
            praise: "die Sauberkeit und den Komfort Ihres Zimmers",
            complaint: "die Instandhaltung und den Zustand des Zimmers"
          },
          lage: {
            words: ["lage", "nah", "strand", "zentrum", "aussicht", "umgebung"],
            praise: "unsere hervorragende Lage und die schöne Umgebung",
            complaint: "die Erreichbarkeit unseres Hotels"
          },
          spa: {
            words: ["spa", "pool", "massage", "sauna", "wellness"],
            praise: "die entspannende Atmosphäre unseres Wellnessbereichs",
            complaint: "die Pool- und Wellnesseinrichtungen"
          }
        };

        const ruKeywords = {
          food: {
            words: ["еда", "завтрак", "ужин", "вкусно", "буфет", "ресторан", "шеф", "вкус"],
            praise: "кулинарные изыски и разнообразие нашего шведского стола",
            complaint: "разнообразие блюд и работу ресторана"
          },
          staff: {
            words: ["персонал", "сотрудники", "дружелюбный", "помогли", "сервис", "прием", "команда"],
            praise: "искреннее гостеприимство и отзывчивость нашей команды",
            complaint: "оперативность обслуживания и отношение персонала"
          },
          room: {
            words: ["номер", "кровать", "чисто", "вид", "комфорт", "модерн", "ванная"],
            praise: "чистоту, удобство и вид из вашего номера",
            complaint: "техническое состояние или уровень шума в номере"
          },
          location: {
            words: ["расположение", "близко", "пляж", "центр", "вид", "окрестности"],
            praise: "удобное расположение нашего отеля",
            complaint: "удаленность отеля и транспортные вопросы"
          },
          spa: {
            words: ["спа", "бассейн", "массаж", "сауна", "велнес"],
            praise: "расслабляющую атмосферу нашего спа-центра и бассейна",
            complaint: "чистоту и температуру воды в велнес-зоне"
          }
        };

        const map = lang === 'tr' ? trKeywords :
                    lang === 'de' ? deKeywords :
                    lang === 'ru' ? ruKeywords : enKeywords;

        Object.values(map).forEach(category => {
          let matched = false;
          category.words.forEach(w => {
            if (commentLower.includes(w)) matched = true;
          });
          if (matched) {
            if (rating >= 4) praise.push(category.praise);
            else if (rating <= 2) complaint.push(category.complaint);
            else {
              praise.push(category.praise);
              complaint.push(category.complaint);
            }
          }
        });

        return { praise, complaint };
      };

      const { praise: praisedDetails, complaint: complainedDetails } = extractDetails(
        reviewObj.comment || '',
        guestLang,
        reviewObj.rating
      );

      const formatDetailsList = (details: string[], lang: 'tr' | 'en' | 'de' | 'ru', type: 'praise' | 'complaint'): string => {
        if (details.length === 0) {
          if (lang === 'tr') return type === 'praise' ? "hizmet kalitemiz" : "hizmet standartlarımız";
          if (lang === 'de') return type === 'praise' ? "unseren Service" : "unseren Servicestandard";
          if (lang === 'ru') return type === 'praise' ? "наш сервис" : "наши стандарты обслуживания";
          return type === 'praise' ? "our service quality" : "our service standards";
        }
        if (details.length === 1) return details[0];
        if (details.length === 2) {
          const conjunction = lang === 'tr' ? ' ve ' : lang === 'de' ? ' und ' : lang === 'ru' ? ' и ' : ' and ';
          return details[0] + conjunction + details[1];
        }
        const conjunction = lang === 'tr' ? ' ve ' : lang === 'de' ? ' und ' : lang === 'ru' ? ' и ' : ', and ';
        return details.slice(0, details.length - 1).join(', ') + conjunction + details[details.length - 1];
      };

      const praiseStr = formatDetailsList(praisedDetails, guestLang, 'praise');
      const complaintStr = formatDetailsList(complainedDetails, guestLang, 'complaint');

      // 3. Define components for each language and sentiment
      const templates: Record<string, Record<string, Record<string, { greetings: string[], openings: string[], details: string[], closings: string[], signatures: string[] }>>> = {
        tr: {
          positive: {
            professional: {
              greetings: ["Değerli [GuestName],", "Sayın [GuestName],"],
              openings: [
                "Otelimizde gerçekleştirdiğiniz konaklamanın ardından görüşlerinizi paylaştığınız için teşekkür ederiz.",
                "Deneyimlerinizi detaylandırarak bizlerle paylaştığınız için memnuniyet duyduk."
              ],
              details: [
                "Geri bildiriminizde özellikle [PraiseDetails] gibi konulara olumlu değinmeniz bizleri memnun etmiştir.",
                "Hizmet kalitemizin bir parçası olan [PraiseDetails] hakkında yazdığınız güzel yorumlar için teşekkür ederiz."
              ],
              closings: [
                "Standartlarımızı sürekli korumak adına geri bildirimleriniz yönetimimiz tarafından değerlendirilmektedir. Bir sonraki ziyaretinizde sizi tekrar ağırlamaktan mutluluk duyacağız.",
                "Görüşleriniz hizmet standartlarımızı korumak adına titizlikle incelenmektedir. Bir sonraki konaklamanızda sizlere yeniden hizmet vermeyi dileriz."
              ],
              signatures: ["Saygılarımızla,\nMisafir İlişkileri Müdürlüğü", "Saygılarımızla,\nOtel Yönetimi"]
            },
            warm: {
              greetings: ["Sevgili [GuestName],", "Değerli Misafirimiz [GuestName],"],
              openings: [
                "Otelimizden böylesine harika anılarla ayrıldığınızı öğrenmek tüm ekibimizi çok mutlu etti!",
                "Zaman ayırıp konaklamanız hakkındaki bu samimi yorumları bizimle paylaştığınız için çok teşekkür ederiz."
              ],
              details: [
                "Özellikle [PraiseDetails] detayını beğenmiş olmanız bizi çok heyecanlandırdı. Ekibimiz misafirlerimizin tatillerini güzelleştirmek için canla başla çalışıyor.",
                "Tatiliniz boyunca [PraiseDetails] ile mutlu olmanız bizim için en büyük ödül oldu."
              ],
              closings: [
                "Sizi en kısa zamanda yeniden evinizde hissettirecek yeni bir tatilde ağırlamayı sabırsızlıkla bekliyoruz.",
                "Yeniden buluşmak ve size aynı samimiyetle hizmet sunabilmek için sabırsızlanıyoruz!"
              ],
              signatures: ["İçten sevgilerimizle,\nMisafir İlişkileri Ekibi", "En sıcak saygılarımızla,\nGuest Relations Ekibi"]
            },
            luxury: {
              greetings: ["Saygıdeğer [GuestName],", "Sayın [GuestName] Bey/Hanım,"],
              openings: [
                "Sizleri seçkin otelimizde ağırlamaktan ve konaklamanız hakkındaki değerli izlenimlerinizi okumaktan onur duyduk.",
                "Tesisimizde gerçekleştirdiğiniz konaklama sonrasında paylaştığınız yüksek kaliteli görüşleriniz için şükranlarımızı sunarız."
              ],
              details: [
                "Sunmuş olduğumuz yüksek standartlardaki hizmetlerimizden [PraiseDetails] beklentilerinizi karşılamış olması gurur verici.",
                "Konaklamanız süresince [PraiseDetails] gibi özel ayrıntıların memnuniyetinize katkıda bulunmasından mutluluk duyuyoruz."
              ],
              closings: [
                "Sizlere gelecekte de benzersiz ve lüks bir konaklama deneyimi sunmak adına en kısa sürede yeniden ağırlamayı dileriz.",
                "Siz seçkin konuğumuzu tesisimizde yeniden ağırlamak ve kusursuz bir hizmet sunmak bizler için bir ayrıcalık olacaktır."
              ],
              signatures: ["En derin saygılarımızla,\nGenel Müdürlük ve Misafir İlişkileri", "Saygılarımızla,\nÜst Düzey Yönetici"]
            },
            concise: {
              greetings: ["Sayın [GuestName],", "Merhaba [GuestName],"],
              openings: ["Değerli yorumunuz için teşekkür ederiz. Otelimizde güzel bir deneyim yaşamanız bizi mutlu etti."],
              details: ["Özellikle [PraiseDetails] hakkındaki memnuniyetiniz için teşekkür ederiz."],
              closings: ["Sizleri tekrar otelimizde ağırlamaktan memnuniyet duyacağız.", "Bir sonraki konaklamanızda görüşmek üzere."],
              signatures: ["Saygılarımızla,\nOtel Yönetimi"]
            }
          },
          negative: {
            professional: {
              greetings: ["Değerli [GuestName],", "Sayın [GuestName],"],
              openings: [
                "Görüşlerinizle otelimizin hizmetlerini geliştirmemize yardımcı olduğunuz için teşekkür ederiz. Konaklamanızda beklentilerinizi karşılayamamış olmaktan üzüntü duyuyoruz.",
                "Hizmet kalitemizin hedeflenen standartların gerisinde kaldığı konulardaki geri bildirimleriniz için teşekkür ederiz."
              ],
              details: [
                "Geri bildiriminizde belirttiğiniz [ComplaintDetails] ile ilgili konular departman yöneticilerimizle paylaşılmış olup gerekli aksiyonlar başlatılmıştır.",
                "Yaşanan [ComplaintDetails] aksaklıkları hakkında ilgili ekiplerimizle görüşmeler sağlanmış ve gerekli denetimler artırılmıştır."
              ],
              closings: [
                "Deneyiminizi telafi etmek ve süreçlerimiz hakkında sizi bilgilendirmek isteriz. Lütfen bizimle guestrelations@hotel.com adresinden doğrudan iletişime geçiniz.",
                "Sorunları çözmek ve size daha iyi hizmet sunabilmek adına bizimle guestrelations@hotel.com adresinden bağlantıya geçmenizi rica ederiz."
              ],
              signatures: ["Saygılarımızla,\nMisafir İlişkileri Müdürlüğü", "Saygılarımızla,\nOtel Yönetimi"]
            },
            warm: {
              greetings: ["Sevgili [GuestName],", "Değerli [GuestName],"],
              openings: [
                "Otelimizde geçirdiğiniz süre boyunca sizi tamamen mutlu edemediğimizi öğrenmek tüm ekibimizi gerçekten çok üzdü.",
                "Lütfen bu tatiliniz sırasında yaşadığınız olumsuz deneyim için en içten özürlerimizi kabul edin."
              ],
              details: [
                "Özellikle [ComplaintDetails] konusunda sizi hayal kırıklığına uğrattığımız için çok üzgünüz. Hak ettiğiniz samimi ve kaliteli tatili sunabilmek için konuyu hemen ekibimizle inceliyoruz.",
                "[ComplaintDetails] hakkındaki şikayetlerinizi çok ciddiye alıyoruz ve bunları düzeltmek için hemen çalışmalara başladık."
              ],
              closings: [
                "Size kendimizi affettirmek ve sizinle doğrudan ilgilenmek için lütfen guestrelations@hotel.com adresinden bizimle iletişime geçin. Sizden haber almayı çok isteriz.",
                "Yaşanan olumsuzlukları ayrıntılı görüşebilmek ve size yardımcı olabilmek adına bizimle guestrelations@hotel.com üzerinden iletişime geçmenizi rica ederiz."
              ],
              signatures: ["İçten sevgilerimizle,\nMisafir İlişkileri Ekibi", "En sıcak saygılarımızla,\nGuest Relations Ekibi"]
            },
            luxury: {
              greetings: ["Saygıdeğer [GuestName],", "Sayın [GuestName] Bey/Hanım,"],
              openings: [
                "Tesisimizde lüks ve kusursuz bir deneyim sunma hedefimizin gerisinde kalan konaklamanız nedeniyle derin endişe duymaktayız.",
                "Paylaştığınız geri bildirimler ışığında, konaklama deneyiminizin seçkin standartlarımıza ulaşamamış olmasından ötürü üzgünüz."
              ],
              details: [
                "Özellikle [ComplaintDetails] gibi detayların prestijli beklentilerinizi karşılamamış olması sebebiyle en derin özürlerimizi sunarız. Konu üst düzey yönetimimizce ele alınmıştır.",
                "İşletmemizin sunduğu özel hizmetlerin bir parçası olan [ComplaintDetails] konusunda yaşadığınız aksaklıkların giderilmesi için gerekli süreçler başlatılmıştır."
              ],
              closings: [
                "Siz seçkin konuğumuzun memnuniyetini üst düzeyde tutmak adına, detayları doğrudan görüşmek üzere bizlerle guestrelations@hotel.com adresinden iletişime geçmenizi rica ederiz.",
                "Deneyiminizi yöneticilerimizle şahsen değerlendirmek ve size uygun çözümler sunabilmek adına guestrelations@hotel.com üzerinden bağlantıya geçmenizi dileriz."
              ],
              signatures: ["En derin saygılarımızla,\nGenel Müdürlük ve Misafir İlişkileri", "Saygılarımızla,\nÜst Düzey Yönetici"]
            },
            concise: {
              greetings: ["Sayın [GuestName],", "Merhaba [GuestName],"],
              openings: ["Otelimizdeki konaklamanız sırasında beklentilerinizi karşılayamadığımız için üzgünüz."],
              details: ["Özellikle [ComplaintDetails] ile ilgili şikayetiniz hakkında gerekli departmanlarla görüşülerek aksiyon alınmıştır."],
              closings: ["Konuyu daha detaylı görüşmek üzere bizimle guestrelations@hotel.com adresinden iletişime geçebilirsiniz."],
              signatures: ["Saygılarımızla,\nOtel Yönetimi"]
            }
          },
          mixed: {
            professional: {
              greetings: ["Değerli [GuestName],", "Sayın [GuestName],"],
              openings: ["Otelimiz hakkındaki dengeli geri bildiriminiz için teşekkür ederiz. Konaklamanızın hem olumlu hem de olumsuz yönlerini bizimle paylaşmanız önemlidir."],
              details: ["Hizmetlerimizden [PraiseDetails] konusunda memnun kaldığınızı duymak sevindirici, ancak [ComplaintDetails] konusunda yaşadığınız aksaklıklar için üzgünüz."],
              closings: [
                "Belirttiğiniz eksiklikleri gidermek adına süreçlerimizi optimize ediyoruz. Bir sonraki konaklamanızda size daha iyi bir standart sunmayı dileriz.",
                "Geri bildirimleriniz doğrultusunda hizmet kalitemizi artırmak için çalışıyoruz. Sizleri gelecekte tekrar ağırlamaktan mutluluk duyacağız."
              ],
              signatures: ["Saygılarımızla,\nMisafir İlişkileri Müdürlüğü", "Saygılarımızla,\nOtel Yönetimi"]
            },
            warm: {
              greetings: ["Sevgili [GuestName],", "Değerli Misafirimiz [GuestName],"],
              openings: ["Bizimle hem beğendiğiniz detayları hem de önerilerinizi samimiyetle paylaştığınız için çok teşekkür ederiz."],
              details: ["Tatildeyken [PraiseDetails] ile keyif almanıza çok sevindik! Ancak [ComplaintDetails] konusundaki eksikliklerimizi gördük ve bunları düzeltmek için sabırsızlanıyoruz."],
              closings: [
                "Bir sonraki tatilinizde sizi tüm beklentilerinizi karşılayan kusursuz bir deneyimle ağırlamak için sabırsızlanıyoruz.",
                "Önerileriniz sayesinde kendimizi geliştiriyoruz. Sizi tekrar aramızda görmeyi ve size mükemmel bir konaklama sunmayı çok isteriz."
              ],
              signatures: ["İçten sevgilerimizle,\nMisafir İlişkileri Ekibi", "En sıcak saygılarımızla,\nGuest Relations Ekibi"]
            },
            luxury: {
              greetings: ["Saygıdeğer [GuestName],", "Sayın [GuestName] Bey/Hanım,"],
              openings: ["Seçkin tesisimizdeki konaklamanıza dair değerli değerlendirmelerinizi ve önerilerinizi paylaştığınız için teşekkür ederiz."],
              details: ["Tesisimizin sunduğu benzersiz hizmetlerden [PraiseDetails] detayını takdir etmiş olmanızdan memnuniyet duyduk. Diğer yandan [ComplaintDetails] ile ilgili beklentilerinizin gerisinde kaldığı noktalar için özür dileriz."],
              closings: [
                "Hizmet kalitemizin her aşamada kusursuz olmasını sağlamak amacıyla gerekli iyileştirmeleri gerçekleştiriyoruz. Sizleri tekrar tesisimizde ağırlamaktan şeref duyacağız.",
                "Değerli konuğumuz, bir sonraki seyahatinizde sizlere hak ettiğiniz eksiksiz lüks konaklama deneyimini sunmayı sabırsızlıkla diliyoruz."
              ],
              signatures: ["En derin saygılarımızla,\nGenel Müdürlük ve Misafir İlişkileri", "Saygılarımızla,\nÜst Düzey Yönetici"]
            },
            concise: {
              greetings: ["Sayın [GuestName],", "Merhaba [GuestName],"],
              openings: ["Dengeli geri bildirimleriniz için teşekkür ederiz."],
              details: ["Otelimizde [PraiseDetails] detayını beğenmenize sevinirken, [ComplaintDetails] konusundaki aksaklıklar için üzüntü duyuyoruz."],
              closings: ["Gerekli iyileştirmeleri yaparak bir sonraki ziyaretinizde daha iyi bir deneyim sunmayı amaçlıyoruz."],
              signatures: ["Saygılarımızla,\nOtel Yönetimi"]
            }
          }
        },
        en: {
          positive: {
            professional: {
              greetings: ["Dear [GuestName],", "Greetings [GuestName],"],
              openings: [
                "Thank you for sharing your experience at our resort.",
                "We appreciate you taking the time to write about your stay with us."
              ],
              details: [
                "We are pleased to hear that you liked [PraiseDetails].",
                "It is gratifying to know that [PraiseDetails] enhanced your visit."
              ],
              closings: [
                "Your constructive feedback is highly valued by our management as we strive to maintain our high standards. We look forward to hosting you again.",
                "We will share your comments with our departments to ensure we continue delivering quality. We look forward to welcoming you back."
              ],
              signatures: ["Best regards,\nGuest Relations Team", "Sincerely,\nHotel Management"]
            },
            warm: {
              greetings: ["Dear [GuestName],", "Hello [GuestName],"],
              openings: [
                "Hearing about your wonderful experience brings immense joy to our entire team!",
                "Thank you so much for your kind words and for choosing to stay with us."
              ],
              details: [
                "We are absolutely thrilled that you enjoyed [PraiseDetails], as we love making our guests smile.",
                "It is wonderful to know that [PraiseDetails] made your vacation special and memorable."
              ],
              closings: [
                "It would be an absolute pleasure to welcome you back for another great stay in the near future.",
                "We are already looking forward to hosting you again for another warm and friendly experience!"
              ],
              signatures: ["Warmly,\nThe Guest Relations Team", "With warm regards,\nYour Friends at the Resort"]
            },
            luxury: {
              greetings: ["Distinguished [GuestName],", "Dear [GuestName],"],
              openings: [
                "We are deeply honored that you selected our premium resort and shared your magnificent experience.",
                "It was an absolute privilege to host you, and we are thrilled by your generous impressions."
              ],
              details: [
                "We are delighted to learn that [PraiseDetails] met your refined expectations.",
                "Knowing that [PraiseDetails] contributed to a satisfying residency is a great reward for us."
              ],
              closings: [
                "It would be our distinct honor to welcome you back for another exquisite experience in the near future.",
                "We look forward to the privilege of hosting you again at our property."
              ],
              signatures: ["With our highest regards,\nExecutive Guest Relations Manager", "Sincerely,\nPrestige Services Management"]
            },
            concise: {
              greetings: ["Dear [GuestName],"],
              openings: ["Thank you for your feedback. We are glad you enjoyed your stay with us."],
              details: ["It is great to hear you liked [PraiseDetails]."],
              closings: ["We look forward to hosting you again.", "We look forward to welcoming you back."],
              signatures: ["Best regards,\nHotel Management"]
            }
          },
          negative: {
            professional: {
              greetings: ["Dear [GuestName],", "Greetings [GuestName],"],
              openings: [
                "Thank you for sharing your feedback regarding your stay. We regret that your experience did not meet our standard quality.",
                "We appreciate you detailing your stay, as it helps us identify areas for operational improvement."
              ],
              details: [
                "We apologize for the issues you experienced with [ComplaintDetails]. We have shared your feedback with our department heads.",
                "We regret that [ComplaintDetails] did not meet your expectations, and we are investigating this with the team."
              ],
              closings: [
                "To discuss how we can improve your impression, please contact us directly at guestrelations@hotel.com.",
                "We would value the opportunity to speak with you personally. Please feel free to reach us at guestrelations@hotel.com."
              ],
              signatures: ["Best regards,\nGuest Relations Team", "Sincerely,\nHotel Management"]
            },
            warm: {
              greetings: ["Dear [GuestName],", "Hello [GuestName],"],
              openings: [
                "Please accept our sincere apologies that we fell short of your expectations during your visit.",
                "We are deeply saddened to learn that your stay did not reflect the warm hospitality we aim to provide."
              ],
              details: [
                "We are truly sorry that [ComplaintDetails] disrupted your comfort. We always want our guests to feel completely taken care of.",
                "It is disappointing to know that you faced issues with [ComplaintDetails], and we are working hard to correct this."
              ],
              closings: [
                "We would love to connect with you and make things right. Please reach out to our team at guestrelations@hotel.com at your convenience.",
                "We hope to address this with you personally. Please write to us at guestrelations@hotel.com so we can listen to your thoughts."
              ],
              signatures: ["Warmly,\nThe Guest Relations Team", "With our best regards,\nThe Resort Family"]
            },
            luxury: {
              greetings: ["Distinguished [GuestName],", "Dear [GuestName],"],
              openings: [
                "We are deeply concerned to hear that your experience did not meet the high standards of luxury we set at our resort.",
                "Please accept our sincere apologies for any shortcomings that affected the prestige of your residency."
              ],
              details: [
                "We regret that [ComplaintDetails] fell short of our dedication to excellence. Our executive management has initiated a full audit.",
                "It is of great concern that [ComplaintDetails] did not meet your expectations. We are taking immediate steps to rectify this."
              ],
              closings: [
                "We value your distinguished feedback and invite you to reach out to our Executive Management at guestrelations@hotel.com.",
                "To address your residency details personally, we would be honored if you contacted us at guestrelations@hotel.com."
              ],
              signatures: ["With our highest regards,\nExecutive Guest Relations Manager", "Sincerely,\nPrestige Services Management"]
            },
            concise: {
              greetings: ["Dear [GuestName],"],
              openings: ["We apologize that your stay did not meet expectations."],
              details: ["We are addressing the issues you mentioned regarding [ComplaintDetails] with our operational teams."],
              closings: ["Please contact our management at guestrelations@hotel.com to discuss this further."],
              signatures: ["Best regards,\nHotel Management"]
            }
          },
          mixed: {
            professional: {
              greetings: ["Dear [GuestName],", "Greetings [GuestName],"],
              openings: [
                "Thank you for providing your balanced review of our property.",
                "We appreciate your objective feedback regarding your stay."
              ],
              details: [
                "We are pleased you appreciated [PraiseDetails], though we regret the issues you encountered with [ComplaintDetails].",
                "It is gratifying to hear you enjoyed [PraiseDetails], while we apologize for the shortcomings in [ComplaintDetails]."
              ],
              closings: [
                "Your comments are shared with our managers to refine our service quality. We look forward to hosting you again.",
                "We evaluate your notes to make key operational updates. We look forward to welcoming you back."
              ],
              signatures: ["Best regards,\nGuest Relations Team", "Sincerely,\nHotel Management"]
            },
            warm: {
              greetings: ["Dear [GuestName],", "Hello [GuestName],"],
              openings: [
                "Thank you so much for sharing your honest review. We appreciate both your compliments and constructive suggestions!",
                "We love hearing from our guests and thank you for taking the time to share your feedback."
              ],
              details: [
                "It is great to know you liked [PraiseDetails]! However, we are sorry that [ComplaintDetails] did not go smoothly, and we are working to fix this.",
                "We are happy you found some warm highlights like [PraiseDetails], but we regret the frustrations with [ComplaintDetails]."
              ],
              closings: [
                "We are always learning and improving. We look forward to hosting you again and giving you the perfect vacation you deserve.",
                "Your insights help us grow. We hope to welcome you back soon and exceed your expectations next time!"
              ],
              signatures: ["Warmly,\nThe Guest Relations Team", "With warm regards,\nYour Friends at the Resort"]
            },
            luxury: {
              greetings: ["Distinguished [GuestName],", "Dear [GuestName],"],
              openings: [
                "Thank you for sharing your valuable impressions and suggestions regarding your residency.",
                "We appreciate your comprehensive perspective on our resort services."
              ],
              details: [
                "We are delighted that [PraiseDetails] met your refined expectations, although we regret that [ComplaintDetails] fell short of our luxury standards.",
                "It is pleasing that [PraiseDetails] added comfort to your stay, while we apologize that [ComplaintDetails] did not reflect our commitment to excellence."
              ],
              closings: [
                "We will utilize your notes to elevate our luxury experiences. We look forward to welcoming you back for a flawless stay.",
                "We hope to welcome you back for a perfect experience that fully reflects our premium reputation."
              ],
              signatures: ["With our highest regards,\nExecutive Guest Relations Manager", "Sincerely,\nPrestige Services Management"]
            },
            concise: {
              greetings: ["Dear [GuestName],"],
              openings: ["Thank you for your feedback."],
              details: ["We are glad you liked [PraiseDetails], but we apologize for the issues with [ComplaintDetails]."],
              closings: ["We are addressing these points to improve your future stays.", "We look forward to welcoming you back."],
              signatures: ["Best regards,\nHotel Management"]
            }
          }
        },
        de: {
          positive: {
            professional: {
              greetings: ["Sehr geehrte/r [GuestName],"],
              openings: [
                "Vielen Dank für Ihre Bewertung und das Feedback zu Ihrem Aufenthalt.",
                "Wir freuen uns, dass Sie sich die Zeit genommen haben, uns Ihre Eindrücke mitzuteilen."
              ],
              details: [
                "Es freut uns sehr, dass Sie [PraiseDetails] positiv hervorheben.",
                "Wir sind froh zu hören, dass [PraiseDetails] zu Ihrem angenehmen Aufenthalt beigetragen hat."
              ],
              closings: [
                "Wir schätzen Ihre Kommentare sehr, um unsere Standards zu wahren, und würden uns freuen, Sie wieder bei uns begrüßen zu dürfen.",
                "Wir hoffen, Sie bei Ihrem nächsten Besuch in der Region wieder bei uns willkommen heißen zu dürfen."
              ],
              signatures: ["Mit freundlichen Grüßen,\nIhr Gästeservice-Team", "Mit freundlichen Grüßen,\nHotelmanagement"]
            },
            warm: {
              greetings: ["Hallo [GuestName],", "Liebe/r [GuestName],"],
              openings: [
                "Es bringt unserem gesamten Team unglaublich große Freude zu hören, wie schön Ihr Aufenthalt war!",
                "Herzlichen Dank für Ihre lieben Worte und dass Sie sich für unser Hotel entschieden haben."
              ],
              details: [
                "Es ist wunderbar zu hören, dass Sie [PraiseDetails] so genossen haben. Unser Team tut alles, um unseren Gästen ein Lächeln ins Gesicht zu zaubern.",
                "Dass [PraiseDetails] Ihren Urlaub so besonders gemacht hat, ist für uns das schönste Feedback."
              ],
              closings: [
                "Wir freuen uns schon riesig darauf, Sie bald wieder bei uns willkommen heißen zu dürfen!",
                "Es wäre uns eine absolute Freude, Sie bald wieder für ein tolles Erlebnis bei uns zu begrüßen."
              ],
              signatures: ["Herzliche Grüße,\nIhr Gästeservice-Team", "Herzliche Grüße,\nIhre Freunde vom Resort"]
            },
            luxury: {
              greetings: ["Sehr geehrte/r [GuestName],", "Sehr geehrter Gast [GuestName],"],
              openings: [
                "Es war uns ein Privileg, Sie in unserem Resort zu beherbergen, und wir danken Ihnen für Ihre großzügigen Worte.",
                "Wir fühlen uns geehrt, dass Sie sich für unser Premium-Resort entschieden und Ihre exzellenten Erfahrungen geteilt haben."
              ],
              details: [
                "Wir freuen uns sehr, dass [PraiseDetails] Ihren hohen Erwartungen entsprochen hat.",
                "Es erfüllt uns mit Zufriedenheit zu wissen, dass [PraiseDetails] zu einer unvergesslichen Zeit bei uns beigetragen hat."
              ],
              closings: [
                "Es wäre uns eine Ehre, Sie bald wieder für einen exquisiten Aufenthalt bei uns begrüßen zu dürfen.",
                "Wir freuen uns darauf, Sie bald wieder in unserem Hause verwöhnen zu dürfen."
              ],
              signatures: ["Mit vorzüglicher Hochachtung,\nLeitung des Gästeservice", "Mit freundlichen Grüßen,\nExecutive Management Team"]
            },
            concise: {
              greetings: ["Sehr geehrte/r [GuestName],"],
              openings: ["Vielen Dank für Ihre Bewertung. Wir freuen uns, dass Sie einen schönen Aufenthalt hatten."],
              details: ["Schön zu hören, dass Ihnen [PraiseDetails] gefallen hat."],
              closings: ["Wir freuen uns auf Ihren nächsten Besuch.", "Wir hoffen, Sie bald wieder bei uns zu begrüßen."],
              signatures: ["Mit freundlichen Grüßen,\nHotelmanagement"]
            }
          },
          negative: {
            professional: {
              greetings: ["Sehr geehrte/r [GuestName],"],
              openings: [
                "Vielen Dank für Ihre Rückmeldung. Wir bedauern aufrichtig, dass Ihr Aufenthalt nicht unseren Qualitätsstandards entsprochen hat.",
                "Wir schätzen Ihre Kommentare, da sie uns helfen, unsere betrieblichen Abläufe zu verbessern."
              ],
              details: [
                "Wir entschuldigen sich für die Unannehmlichkeiten mit [ComplaintDetails]. Wir haben dies an unsere Abteilungsleiter weitergeleitet.",
                "Es tut uns leid, dass [ComplaintDetails] nicht Ihren Erwartungen entsprach. Wir prüfen dies intern mit dem Team."
              ],
              closings: [
                "Um Ihre Erfahrungen genauer zu besprechen, kontaktieren Sie uns bitte direkt unter guestrelations@hotel.com.",
                "Wir würden uns über die Möglichkeit freuen, persönlich mit Ihnen zu sprechen. Schreiben Sie uns bitte an guestrelations@hotel.com."
              ],
              signatures: ["Mit freundlichen Grüßen,\nIhr Gästeservice-Team", "Mit freundlichen Grüßen,\nHotelmanagement"]
            },
            warm: {
              greetings: ["Liebe/r [GuestName],", "Hallo [GuestName],"],
              openings: [
                "Bitte entschuldigen Sie vielmals, dass wir Ihre Erwartungen diesmal nicht erfüllen konnten. Es tut uns im Herzen leid.",
                "Es macht uns traurig zu hören, dass Sie sich während Ihres Aufenthalts bei uns nicht rundum wohlgefühlt haben."
              ],
              details: [
                "Es tut uns unendlich leid, dass [ComplaintDetails] Ihren Komfort beeinträchtigt hat. Wir möchten, dass sich jeder Gast geborgen fühlt.",
                "Wir nehmen Ihre Sorgen bezüglich [ComplaintDetails] sehr ernst und arbeiten eng mit dem Team daran, dies zu verbessern."
              ],
              closings: [
                "Wir würden gerne persönlich mit Ihnen sprechen, um dies wiedergutzumachen. Bitte schreiben Sie uns unter guestrelations@hotel.com.",
                "Bitte kontaktieren Sie uns unter guestrelations@hotel.com, damit wir uns persönlich um Ihre Anliegen kümmern können."
              ],
              signatures: ["Herzliche Grüße,\nIhr Gästeservice-Team", "Mit den besten Grüßen,\nIhre Resort-Familie"]
            },
            luxury: {
              greetings: ["Sehr geehrte/r [GuestName],", "Sehr geehrter Gast [GuestName],"],
              openings: [
                "Wir sind zutiefst besorgt zu hören, dass Ihr Aufenthalt nicht den hohen Luxusstandards unseres Resorts entsprochen hat.",
                "Bitte akzeptieren Sie unsere aufrichtige Entschuldigung für jegliche Mängel, die das Prestige Ihres Aufenthalts beeinträchtigt haben."
              ],
              details: [
                "Wir bedauern zutiefst, dass [ComplaintDetails] nicht unserem Anspruch an Exzellenz entsprach. Unsere Geschäftsführung hat eine Überprüfung eingeleitet.",
                "Es ist bedauerlich, dass [ComplaintDetails] Ihre Erwartungen nicht erfüllt hat. Wir ergreifen sofortige Maßnahmen."
              ],
              closings: [
                "Wir schätzen Ihre Rückmeldung und bitten Sie, sich direkt mit unserer Geschäftsleitung unter guestrelations@hotel.com in Verbindung zu setzen.",
                "Um die Details Ihres Aufenthalts persönlich zu besprechen, bitten wir Sie, uns unter guestrelations@hotel.com zu kontaktieren."
              ],
              signatures: ["Mit vorzüglicher Hochachtung,\nLeitung des Gästeservice", "Mit freundlichen Grüßen,\nExecutive Management Team"]
            },
            concise: {
              greetings: ["Sehr geehrte/r [GuestName],"],
              openings: ["Wir entschuldigen uns dafür, dass Ihr Aufenthalt nicht Ihren Erwartungen entsprochen hat."],
              details: ["Wir arbeiten daran, die Probleme mit [ComplaintDetails] mit unserem Team zu beheben."],
              closings: ["Bitte kontaktieren Sie uns unter guestrelations@hotel.com für ein persönliches Gespräch."],
              signatures: ["Mit freundlichen Grüßen,\nHotelmanagement"]
            }
          },
          mixed: {
            professional: {
              greetings: ["Sehr geehrte/r [GuestName],"],
              openings: ["Haben Sie vielen Dank für Ihr ausgewogenes Feedback zu unserem Hotel."],
              details: [
                "Wir freuen uns, dass Sie [PraiseDetails] geschätzt haben, bedauern jedoch die Probleme mit [ComplaintDetails].",
                "Es ist erfreulich, dass Ihnen [PraiseDetails] gefallen hat, während wir uns für die Mängel bei [ComplaintDetails] entschuldigen."
              ],
              closings: [
                "Wir nutzen Ihre Anmerkungen zur Optimierung unserer Qualität und leiten Ihre Rückmeldung an das Team weiter. Wir hoffen, Sie wiederzusehen.",
                "Wir leiten Ihre Rückmeldung an das Team weiter, um Verbesserungen vorzunehmen. Wir hoffen, Sie wiederzusehen."
              ],
              signatures: ["Mit freundlichen Grüßen,\nIhr Gästeservice-Team", "Mit freundlichen Grüßen,\nHotelmanagement"]
            },
            warm: {
              greetings: ["Liebe/r [GuestName],", "Hallo [GuestName],"],
              openings: ["Herzlichen Dank für Ihre ehrliche Rückmeldung. Wir freuen uns über jedes Lob und nehmen uns Ihre Anregungen zu Herzen!"],
              details: [
                "Toll, dass Sie [PraiseDetails] genossen haben! Es tut uns leid, dass es bei [ComplaintDetails] Probleme gab, und wir arbeiten an einer Lösung.",
                "Wir freuen uns über die schönen Aspekte Ihres Besuchs wie [PraiseDetails], bedauern aber die Unannehmlichkeiten mit [ComplaintDetails]."
              ],
              closings: [
                "Wir lernen ständig dazu. Wir hoffen, Sie bald wieder für einen rundum perfekten Aufenthalt bei uns begrüßen zu dürfen.",
                "Wir möchten uns weiter verbessern und würden uns freuen, Sie bald wieder bei uns verwöhnen zu dürfen."
              ],
              signatures: ["Herzliche Grüße,\nIhr Gästeservice-Team", "Herzliche Grüße,\nIhre Freunde vom Resort"]
            },
            luxury: {
              greetings: ["Sehr geehrte/r [GuestName],", "Sehr geehrter Gast [GuestName],"],
              openings: ["Wir danken Ihnen für Ihre wertvollen Eindrücke und konstruktiven Vorschläge zu Ihrem Aufenthalt."],
              details: [
                "Es freut uns, dass [PraiseDetails] Ihren Erwartungen entsprach, bedauern jedoch, dass [ComplaintDetails] nicht unseren Standards gerecht wurde.",
                "Wir schätzen Ihre Anerkennung für [PraiseDetails], entschuldigen uns jedoch für die Mängel bezüglich [ComplaintDetails]."
              ],
              closings: [
                "Wir werden Ihre Rückmeldungen nutzen, um unsere Servicequalität weiter zu verfeinern. Wir hoffen, Sie bald wieder begrüßen zu dürfen.",
                "Wir freuen uns auf Ihren nächsten Besuch, bei dem wir Ihnen einen rundum makellosen Aufenthalt bieten möchten."
              ],
              signatures: ["Mit vorzüglicher Hochachtung,\nLeitung des Gästeservice", "Mit freundlichen Grüßen,\nExecutive Management Team"]
            },
            concise: {
              greetings: ["Sehr geehrte/r [GuestName],"],
              openings: ["Vielen Dank für Ihre Rückmeldung."],
              details: ["Wir freuen uns über Ihr Lob für [PraiseDetails], entschuldigen uns jedoch für die Probleme mit [ComplaintDetails]."],
              closings: ["Wir gehen diesen Punkten nach, um unsere Qualität für die Zukunft zu sichern."],
              signatures: ["Mit freundlichen Grüßen,\nHotelmanagement"]
            }
          }
        },
        ru: {
          positive: {
            professional: {
              greetings: ["Уважаемый(ая) [GuestName],"],
              openings: [
                "Благодарим Вас за то, что поделились отзывом о Вашем пребывании в нашем отеле.",
                "Мы ценим время, которое Вы уделили, чтобы подробно описать свой опыт."
              ],
              details: [
                "Нам приятно узнать, что Вы положительно отметили [PraiseDetails].",
                "Рады слышать, что [PraiseDetails] оставил у Вас хорошее впечатление."
              ],
              closings: [
                "Ваши комментарии помогают нам поддерживать высокие стандарты обслуживания. Будем рады видеть Вас снова.",
                "Мы передадим Ваш отзыв руководству подразделений и будем рады новой встрече с Вами."
              ],
              signatures: ["С уважением,\nСлужба по работе с гостями", "С уважением,\nАдминистрация отеля"]
            },
            warm: {
              greetings: ["Здравствуйте, [GuestName]!", "Дорогой(ая) [GuestName],"],
              openings: [
                "Мы искренне рады узнать, что Ваше пребывание оставило такие теплые воспоминания у всей нашей команды!",
                "Огромное спасибо за такие добрые слова и за то, что выбрали наш отель."
              ],
              details: [
                "Мы очень рады, что Вам так понравилась(о) [PraiseDetails], ведь мы стараемся дарить нашим гостям только улыбки.",
                "Приятно слышать, что [PraiseDetails] помог сделать Ваш отдых особенным и запоминающимся."
              ],
              closings: [
                "Мы с нетерпением ждем возможности снова встретить Вас для нового замечательного отдыха!",
                "Будем рады снова приветствовать Вас в нашем отель в самом ближайшем будущем."
              ],
              signatures: ["С теплыми пожеланиями,\nКоманда по работе с гостями", "Искренне Ваши,\nДрузья из отеля"]
            },
            luxury: {
              greetings: ["Уважаемый(ая) [GuestName],", "Глубокоуважаемый гость [GuestName],"],
              openings: [
                "Для нас было честью принимать Вас в нашем курортном отеле, и мы благодарим Вас за столь благородные слова.",
                "Мы признательны за Ваш выбор нашего премиум-отеля и за то, что Вы поделились своими великолепными впечатлениями."
              ],
              details: [
                "Мы искренне рады, что [PraiseDetails] оправдал Ваши изысканные ожидания.",
                "Приятно знать, что [PraiseDetails] способствовал(о) Вашему безупречному и комфортному отдыху."
              ],
              closings: [
                "Для нас будет честью снова приветствовать Вас для изысканного отдыха в ближайшем будущем.",
                "Мы с нетерпением ждем возможности снова предоставить Вам безукоризненный сервис в нашем отеле."
              ],
              signatures: ["С глубоким уважением,\nРуководитель службы приема и обслуживания гостей", "С уважением,\nКоманда исполнительного руководства"]
            },
            concise: {
              greetings: ["Уважаемый(ая) [GuestName],"],
              openings: ["Благодарим за отзыв. Рады, что Вы хорошо провели время у нас."],
              details: ["Приятно слышать, что Вам понравилось(о) [PraiseDetails]."],
              closings: ["Будем рады видеть Вас снова.", "До новых встреч."],
              signatures: ["С уважением,\nАдминистрация отеля"]
            }
          },
          negative: {
            professional: {
              greetings: ["Уважаемый(ая) [GuestName],"],
              openings: [
                "Благодарим Вас за обратную связь. Мы искренне сожалеем, что Ваше пребывание не соответствовало нашим стандартам качества.",
                "Мы ценим Ваши замечания, так как они помогают нам улучшать операционные процессы."
              ],
              details: [
                "Приносим извинения за неудобства, вызванные [ComplaintDetails]. Мы передали информацию руководителям отделов.",
                "Нам жаль, что [ComplaintDetails] не оправдал Ваши ожидания. Мы проводим проверку с коллегами."
              ],
              closings: [
                "Чтобы более подробно обсудить Ваш отзыв, пожалуйста, свяжитесь с нами по адресу guestrelations@hotel.com.",
                "Мы были бы рады пообщаться с Вами лично. Пожалуйста, напишите нам на guestrelations@hotel.com."
              ],
              signatures: ["С уважением,\nСлужба по работе с гостями", "С уважением,\nАдминистрация отеля"]
            },
            warm: {
              greetings: ["Дорогой(ая) [GuestName],", "Здравствуйте, [GuestName]!"],
              openings: [
                "Пожалуйста, примите наши искренние извинения за то, что мы не смогли оправдать Ваши ожидания во время этого визита.",
                "Нам очень грустно слышать, что Вы столкнулись с неудобствами во время проживания у нас."
              ],
              details: [
                "Нам очень жаль, что [ComplaintDetails] нарушил(о) Ваш комфорт. Мы хотим, чтобы каждый наш гость чувствовал себя окруженным заботой.",
                "Мы крайне серьезно относимся к жалобам на [ComplaintDetails] и уже работаем над улучшением ситуации."
              ],
              closings: [
                "Мы бы очень хотели исправить впечатление. Пожалуйста, напишите нам на guestrelations@hotel.com в удобное для Вас время.",
                "Пожалуйста, свяжитесь с нами по адресу guestrelations@hotel.com, чтобы мы могли лично разобраться в ситуации."
              ],
              signatures: ["С теплыми пожеланиями,\nКоманда по работе с гостями", "С наилучшими пожеланиями,\nСемья отеля"]
            },
            luxury: {
              greetings: ["Уважаемый(ая) [GuestName],", "Глубокоуважаемый гость [GuestName],"],
              openings: [
                "Мы крайне обеспокоены тем, что Ваш отдых не соответствовал высоким стандартам роскоши, установленным в нашем отеле.",
                "Примите наши искренние извинения за любые недостатки, которые повлияли на престиж Вашего проживания."
              ],
              details: [
                "Сожалеем, что [ComplaintDetails] не соответствовал(о) нашему стремлению к совершенству. Руководство инициировало полный аудит.",
                "Нам крайне жаль, что [ComplaintDetails] разочаровал(о) Вас. Мы принимаем немедленные меры по улучшению."
              ],
              closings: [
                "Мы высоко ценим Ваши отзывы и просим Вас связаться напрямую с руководством по адресу guestrelations@hotel.com.",
                "Чтобы лично обсудить детали Вашего визита, будем признательны, если Вы напишете нам на guestrelations@hotel.com."
              ],
              signatures: ["С глубоким уважением,\nРуководитель службы приема и обслуживания гостей", "С уважением,\nКоманда исполнительного руководства"]
            },
            concise: {
              greetings: ["Уважаемый(ая) [GuestName],"],
              openings: ["Приносим извинения за то, что отдых у нас не оправдал Ваших ожиданий."],
              details: ["Мы прорабатываем вопросы, касающиеся [ComplaintDetails], с нашими сотрудниками."],
              closings: ["Пожалуйста, свяжитесь с администрацией по адресу guestrelations@hotel.com для уточнения деталей."],
              signatures: ["С уважением,\nАдминистрация отеля"]
            }
          },
          mixed: {
            professional: {
              greetings: ["Уважаемый(ая) [GuestName],"],
              openings: ["Благодарим Вас за сбалансированный отзыв о нашем отеле."],
              details: [
                "Мы рады, что Вы оценили [PraiseDetails], однако сожалеем о неудобствах, возникших в связи с [ComplaintDetails].",
                "Нам приятно, что Вам понравилось(о) [PraiseDetails], в то время как мы просим прощения за недостатки в [ComplaintDetails]."
              ],
              closings: [
                "Мы передадим Ваши замечания менеджерам для повышения качества услуг. Надеемся принять Вас вновь.",
                "Ваши отзывы важны для оптимизации наших процессов. Надеемся принять Вас вновь."
              ],
              signatures: ["С уважением,\nСлужба по работе с гостями", "С уважением,\nАдминистрация отеля"]
            },
            warm: {
              greetings: ["Дорогой(ая) [GuestName],", "Здравствуйте, [GuestName]!"],
              openings: ["Большое спасибо за Ваш честный отзыв. Мы рады похвале и обязательно учтем все Ваши замечания!"],
              details: [
                "Здорово, что Вам понравилось(о) [PraiseDetails]! Но нам очень жаль, что с [ComplaintDetails] возникли сложности, и мы сделаем все, чтобы это исправить.",
                "Рады, что Вы отметили такие приятные моменты отдыха, как [PraiseDetails], но при этом искренне сожалеем о трудностях с [ComplaintDetails]."
              ],
              closings: [
                "Мы постоянно учимся и развиваемся. Надеемся снова встретить Вас у нас и подарить тот отдых, которого Вы заслуживаете.",
                "Ваши комментарии помогают нам становиться лучше. Надеемся увидеть Вас снова и превзойти все ожидания!"
              ],
              signatures: ["С теплыми пожеланиями,\nКоманда по работе с гостями", "Искренне Ваши,\nДрузья из отеля"]
            },
            luxury: {
              greetings: ["Уважаемый(ая) [GuestName],", "Глубокоуважаемый гость [GuestName],"],
              openings: ["Благодарим Вас за то, что поделились своими ценными впечатлениями и предложениями о проживании у нас."],
              details: [
                "We are delighted that [PraiseDetails] met your expectations, although we regret that [ComplaintDetails] fell short of our luxury standards.",
                "Нам приятно получить Ваше признание касательно [PraiseDetails], но мы приносим извинения за упущения в [ComplaintDetails]."
              ],
              closings: [
                "Мы используем Ваши замечания для дальнейшего совершенствования наших услуг. Надеемся на новую встречу с Вами.",
                "Мы с нетерпением ждем возможности приветствовать Вас вновь, чтобы предложить безупречный отдых класса люкс."
              ],
              signatures: ["С глубоким уважением,\nРуководитель службы приема и обслуживания гостей", "С уважением,\nКоманда исполнительного руководства"]
            },
            concise: {
              greetings: ["Уважаемый(ая) [GuestName],"],
              openings: ["Благодарим за Вашу обратную связь."],
              details: ["Мы рады, что Вы остались довольны [PraiseDetails], но приносим свои извинения за проблемы с [ComplaintDetails]."],
              closings: ["Мы примем меры по этим пунктам, чтобы улучшить Ваши будущие визиты."],
              signatures: ["С уважением,\nАдминистрация отеля"]
            }
          }
        }
      };

      // 4. Determine Sentiment category
      let sentiment: 'positive' | 'negative' | 'mixed' = 'mixed';
      if (reviewObj.rating >= 4) sentiment = 'positive';
      else if (reviewObj.rating <= 2) sentiment = 'negative';

      // 5. Generate and check for uniqueness using Jaccard Similarity index
      const calculateSimilarity = (text1: string, text2: string): number => {
        const getTokens = (text: string) => {
          return new Set(
            text
              .toLowerCase()
              .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
              .split(/\s+/)
              .filter(t => t.length > 2)
          );
        };
        const set1 = getTokens(text1);
        const set2 = getTokens(text2);
        if (set1.size === 0 || set2.size === 0) return 0;
        
        let intersection = 0;
        set1.forEach(token => {
          if (set2.has(token)) intersection++;
        });
        
        const union = set1.size + set2.size - intersection;
        return intersection / union;
      };

      const langTemplates = templates[guestLang] || templates.en;
      const sentimentTemplates = langTemplates[sentiment] || langTemplates.mixed;
      const toneTemplates = sentimentTemplates[tone] || sentimentTemplates.professional;

      let finalResponse = '';
      let bestResponse = '';
      let lowestSimilarity = 1.0;

      const commentWordCount = (reviewObj.comment || '').split(/\s+/).filter(Boolean).length;
      const isShortReview = commentWordCount < 10;

      for (let attempt = 0; attempt < 10; attempt++) {
        const greet = toneTemplates.greetings[Math.floor(Math.random() * toneTemplates.greetings.length)];
        const open = toneTemplates.openings[Math.floor(Math.random() * toneTemplates.openings.length)];
        const signature = toneTemplates.signatures[Math.floor(Math.random() * toneTemplates.signatures.length)];
        
        let detail = '';
        if (!isShortReview) {
          detail = toneTemplates.details[Math.floor(Math.random() * toneTemplates.details.length)];
        }
        
        const close = toneTemplates.closings[Math.floor(Math.random() * toneTemplates.closings.length)];

        // Assemble paragraphs
        let body = '';
        if (isShortReview) {
          body = open + ' ' + close;
        } else {
          body = open + ' ' + detail + '\n\n' + close;
        }

        let reply = greet + '\n\n' + body + '\n\n' + signature;

        // Replace placeholders
        reply = reply
          .replace(/\[GuestName\]/g, reviewObj.guestName || 'Guest')
          .replace(/\[HotelName\]/g, reviewObj.hotel || 'our resort')
          .replace(/\[PraiseDetails\]/g, praiseStr)
          .replace(/\[ComplaintDetails\]/g, complaintStr);

        // Similarity check
        let maxSim = 0;
        recentReplies.forEach(recent => {
          const sim = calculateSimilarity(reply, recent);
          if (sim > maxSim) maxSim = sim;
        });

        if (maxSim < lowestSimilarity) {
          lowestSimilarity = maxSim;
          bestResponse = reply;
        }

        if (maxSim < 0.45) {
          finalResponse = reply;
          break;
        }
      }

      if (!finalResponse) {
        finalResponse = bestResponse;
      }

      return { response: finalResponse };
    }
  },

  async submitResponse(id: string, responseText: string): Promise<Review> {
    return await reviewRepository.submitResponse(id, responseText);
  },

  async saveResponseDraft(id: string, responseText: string): Promise<Review> {
    return await reviewRepository.saveResponseDraft(id, responseText);
  },

  async updateReviewNotes(id: string, managerNotes: string, internalNotes: string): Promise<Review> {
    return await reviewRepository.updateReviewNotes(id, managerNotes, internalNotes);
  },

  async updateReviewStatus(id: string, status: ReviewStatus): Promise<Review> {
    const updatedReview = await reviewRepository.updateReviewStatus(id, status);

    if (status === 'waiting_approval') {
      try {
        const { notificationService } = await import('./notificationService');
        await notificationService.createNotification({
          type: 'approval_needed',
          title: 'Approval Needed',
          message: `Draft reply for review from ${updatedReview.guestName} needs manager approval.`,
          hotelId: updatedReview.hotelId
        });
      } catch (e) {
        console.warn('Realtime notification trigger failed:', e);
      }
    }

    return updatedReview;
  },

  async importLast30DaysReviews(hotelId: string, range: string = '365'): Promise<{
    importedCount: number;
    duplicateCount: number;
    failedCount: number;
    totalFetched: number;
    detailedErrors?: any[];
    importDetails?: any[];
  }> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Missing token');

    const endpointUrl = '/api/admin-import-reviews';
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ hotelId, range })
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();

    let result: any;
    let parseErrorOccurred = false;
    try {
      result = JSON.parse(rawText);
    } catch (parseError: any) {
      parseErrorOccurred = true;
      console.error('Import Response JSON Parse Failure Log:', {
        endpointUrl,
        status: response.status,
        contentType,
        rawText,
        parseError: parseError.message || String(parseError)
      });
    }

    if (!response.ok) {
      if (parseErrorOccurred) {
        throw new Error(`Server Error (${response.status}): ${rawText}`);
      } else {
        throw new Error(result?.error || result?.message || `Import failed with status ${response.status}`);
      }
    }

    if (parseErrorOccurred) {
      throw new Error(`Server Error (${response.status}): Unexpected plain text response. Text: ${rawText}`);
    }

    return result;
  }
};
