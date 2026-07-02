import { useState, useEffect } from 'react';

interface ContactProps {
  preselectedRoom?: string;
  clearPreselectedRoom?: () => void;
}

export default function Contact({ preselectedRoom, clearPreselectedRoom }: ContactProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dates: '',
    roomType: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (preselectedRoom) {
      setFormData(prev => ({ ...prev, roomType: preselectedRoom }));
    }
  }, [preselectedRoom]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const messageText = `Merhaba Montana 2543,\n\nRezervasyon/Bilgi Talebi:\n` +
      `- İsim: ${formData.name}\n` +
      `- E-Posta: ${formData.email}\n` +
      `- Telefon: ${formData.phone}\n` +
      `- Tarihler: ${formData.dates}\n` +
      `- Oda Konsepti: ${formData.roomType || 'Belirtilmedi'}\n` +
      `- Özel Not: ${formData.message || 'Yok'}`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=90XXXXXXXXXX&text=${encodeURIComponent(messageText)}`;
    window.open(whatsappUrl, '_blank');

    setSubmitted(true);
    setFormData({
      name: '',
      email: '',
      phone: '',
      dates: '',
      roomType: '',
      message: ''
    });

    if (clearPreselectedRoom) clearPreselectedRoom();

    setTimeout(() => {
      setSubmitted(false);
    }, 5000);
  };

  return (
    <section id="contact" className="contact-section section">
      <div className="container">
        <div className="section-header text-center">
          <span className="subtitle">İLETİŞİM & REZERVASYON</span>
          <h2 className="heading-md">Zirvede Yerinizi Ayırtın</h2>
          <p className="header-desc">
            Aşağıdaki form üzerinden rezervasyon talebinizi gönderebilir veya iletişim kanallarımızdan bize doğrudan ulaşabilirsiniz.
          </p>
        </div>

        <div className="contact-layout">
          {/* Contact Details & Map */}
          <div className="contact-details-col">
            <div className="info-cards-grid">
              <div className="info-card">
                <span className="info-icon">📍</span>
                <div className="info-text">
                  <h5>Adres</h5>
                  <p>2. Gelişim Bölgesi, Oteller Mevkii No: 12, Uludağ / Bursa</p>
                </div>
              </div>

              <div className="info-card">
                <span className="info-icon">📞</span>
                <div className="info-text">
                  <h5>Telefon / WhatsApp</h5>
                  <p>+90XXXXXXXXXX</p>
                  <p>+90XXXXXXXXXX</p>
                </div>
              </div>

              <div className="info-card">
                <span className="info-icon">✉</span>
                <div className="info-text">
                  <h5>E-Posta</h5>
                  <p>info@montana2543.com</p>
                  <p>reservation@montana2543.com</p>
                </div>
              </div>
            </div>

            {/* Map Iframe */}
            <div className="map-wrapper">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d12217.473523777526!2d29.12741121083984!3d40.10065470000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14caf3ab9db8f725%3A0xe5a3cbe7694f4a3e!2sUluda%C4%9F%20Kayak%20Merkezi!5e0!3m2!1str!2str!4v1719940000000!5m2!1str!2str" 
                width="100%" 
                height="280" 
                style={{ border: 0 }} 
                allowFullScreen={false} 
                loading="lazy"
                title="Montana 2543 Location Map"
              ></iframe>
            </div>
          </div>

          {/* Contact Form */}
          <div className="contact-form-col">
            <div className="form-container-card">
              {submitted ? (
                <div className="success-message">
                  <span className="success-icon">✓</span>
                  <h4>Talebiniz Alındı!</h4>
                  <p>Rezervasyon ekibimiz en kısa sürede telefon veya e-posta yoluyla sizinle iletişime geçecektir.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="booking-form">
                  <div className="form-group">
                    <label htmlFor="name">Adınız Soyadınız</label>
                    <input 
                      type="text" 
                      id="name" 
                      name="name" 
                      required 
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Örn: Ahmet Yılmaz" 
                      className="form-control"
                    />
                  </div>

                  <div className="form-row-grid">
                    <div className="form-group">
                      <label htmlFor="email">E-Posta Adresi</label>
                      <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        required 
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="ahmet@example.com" 
                        className="form-control"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">Telefon Numarası</label>
                      <input 
                        type="tel" 
                        id="phone" 
                        name="phone" 
                        required 
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="0555 123 4567" 
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div className="form-row-grid">
                    <div className="form-group">
                      <label htmlFor="dates">Giriş / Çıkış Tarihleri</label>
                      <input 
                        type="text" 
                        id="dates" 
                        name="dates" 
                        required 
                        value={formData.dates}
                        onChange={handleChange}
                        placeholder="12 Jan - 18 Jan 2027" 
                        className="form-control"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="roomType">Oda Seçimi</label>
                      <select 
                        id="roomType" 
                        name="roomType" 
                        value={formData.roomType}
                        onChange={handleChange}
                        className="form-control"
                      >
                        <option value="">Oda Konsepti Seçin</option>
                        <option value="Standart Oda">Standart Oda</option>
                        <option value="Aile Odası">Aile Odası</option>
                        <option value="Ekonomik Dağ Odası">Ekonomik Dağ Odası</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="message">Özel Talepleriniz / Mesajınız</label>
                    <textarea 
                      id="message" 
                      name="message" 
                      rows={4}
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Varsa özel yatak, diyet veya transfer taleplerinizi belirtiniz..." 
                      className="form-control"
                    ></textarea>
                  </div>

                  <button type="submit" className="form-submit-btn">
                    Rezervasyon Talebi Gönder
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .contact-section {
          background-color: var(--krem);
        }

        .contact-layout {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 60px;
        }

        @media (max-width: 991px) {
          .contact-layout {
            grid-template-columns: 1fr;
            gap: 40px;
          }
        }

        .contact-details-col {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .info-cards-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .info-card {
          background-color: var(--beyaz);
          padding: 20px;
          border-radius: 16px;
          display: flex;
          gap: 16px;
          box-shadow: var(--shadow-sm);
          border: 1px solid rgba(91, 30, 40, 0.03);
        }

        .info-icon {
          font-size: 1.5rem;
          color: var(--ahsap);
          line-height: 1;
        }

        .info-text h5 {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--bordo);
          margin-bottom: 4px;
        }

        .info-text p {
          font-size: 0.85rem;
          color: var(--koyu-gri-light);
        }

        .map-wrapper {
          border-radius: 20px;
          overflow: hidden;
          box-shadow: var(--shadow-md);
          border: 4px solid var(--beyaz);
        }

        /* Form Container Column styling */
        .contact-form-col {
          display: flex;
        }

        .form-container-card {
          background-color: var(--beyaz);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          box-shadow: var(--shadow-lg);
          border: 1px solid rgba(91, 30, 40, 0.05);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        @media (max-width: 576px) {
          .form-container-card {
            padding: 24px;
          }
        }

        .form-row-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        @media (max-width: 576px) {
          .form-row-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }
        }

        .form-submit-btn {
          width: 100%;
          background-color: var(--bordo);
          color: var(--beyaz);
          border: none;
          padding: 16px;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 14px rgba(91, 30, 40, 0.25);
        }

        .form-submit-btn:hover {
          background-color: var(--bordo-light);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(91, 30, 40, 0.35);
        }

        /* Success Message styling */
        .success-message {
          text-align: center;
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          animation: fadeIn 0.5s ease;
        }

        .success-icon {
          width: 60px;
          height: 60px;
          background-color: rgba(16, 185, 129, 0.1);
          color: rgb(16, 185, 129);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.8rem;
          font-weight: bold;
        }

        .success-message h4 {
          font-family: var(--serif);
          font-size: 1.5rem;
          color: var(--bordo);
        }

        .success-message p {
          font-size: 0.95rem;
          color: var(--koyu-gri-light);
          max-width: 320px;
        }
      `}</style>
    </section>
  );
}
