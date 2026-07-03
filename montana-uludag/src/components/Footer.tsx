import { useState } from 'react';

interface FooterProps {
  setActivePage: (page: string) => void;
}

export default function Footer({ setActivePage }: FooterProps) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubsubscribed] = useState(false);

  const handleNavClick = (id: string) => {
    setActivePage(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubsubscribed(true);
      setEmail('');
      setTimeout(() => setSubsubscribed(false), 5000);
    }
  };

  return (
    <footer className="footer">
      <div className="container footer-grid">
        {/* Brand Info */}
        <div className="footer-brand-col">
          <div className="footer-logo" onClick={() => handleNavClick('home')}>
            <img src="/assets/montana/logo.png" alt="Montana 2543 Logo" className="footer-logo-img" />
            <span className="logo-sub">A FAHRI HERITAGE HOTEL</span>
          </div>
          <p className="footer-brand-desc">
            Uludağ'ın yamaçlarında, doğallığı ve sadeliği İskandinav minimalizmiyle buluşturan samimi dağ oteli deneyimi.
          </p>
          <div className="social-links">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="social-link">Instagram</a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" className="social-link">Facebook</a>
            <a href="https://tripadvisor.com" target="_blank" rel="noreferrer" className="social-link">TripAdvisor</a>
            <a href="https://api.whatsapp.com/send?phone=90XXXXXXXXXX" target="_blank" rel="noreferrer" className="social-link">WhatsApp</a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-links-col">
          <h4 className="footer-title">Hızlı Linkler</h4>
          <ul className="footer-links-list">
            <li><button onClick={() => handleNavClick('home')}>Ana Sayfa</button></li>
            <li><button onClick={() => handleNavClick('rooms')}>Odalarımız</button></li>
            <li><button onClick={() => handleNavClick('facilities')}>Olanaklar</button></li>
            <li><button onClick={() => handleNavClick('gallery')}>Galeri</button></li>
            <li><button onClick={() => handleNavClick('about')}>Hakkımızda</button></li>
            <li><button onClick={() => handleNavClick('contact')}>İletişim</button></li>
          </ul>
        </div>

        {/* Newsletter Signup */}
        <div className="footer-newsletter-col">
          <h4 className="footer-title">Bültene Katılın</h4>
          <p className="newsletter-desc">Montana 2543'ten özel haberler ve kış teklifleri almak için kaydolun.</p>
          
          {subscribed ? (
            <p className="subscribe-success">Kaydınız başarıyla tamamlandı.</p>
          ) : (
            <form onSubmit={handleSubscribe} className="newsletter-form">
              <input 
                type="email" 
                required 
                placeholder="E-posta adresiniz" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="newsletter-input"
              />
              <button type="submit" className="newsletter-btn">
                Gönder
              </button>
            </form>
          )}

          <div className="footer-contact-details">
            <p>📍 2. Gelişim Bölgesi, Uludağ / Bursa</p>
            <p>📞 +90XXXXXXXXXX</p>
            <p>✉ info@montanauludag.com</p>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-layout">
          <p className="copyright-text">© {new Date().getFullYear()} Montana 2543 Uludağ. Tüm Hakları Saklıdır.</p>
          <div className="footer-legal-links">
            <a href="#privacy">Gizlilik Sözleşmesi</a>
            <span className="legal-separator">•</span>
            <a href="#terms">Kullanım Şartları</a>
          </div>
        </div>
      </div>

      <style>{`
        .footer {
          background-color: var(--primary);
          color: var(--white);
          padding: 80px 0 0;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 1fr;
          gap: 64px;
          padding-bottom: 60px;
        }

        @media (max-width: 991px) {
          .footer-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 40px;
          }
        }

        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }

        /* Brand Column */
        .footer-brand-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .footer-logo {
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .footer-logo-img {
          height: 60px;
          width: auto;
          object-fit: contain;
          display: block;
          align-self: flex-start;
          filter: none;
        }

        .footer-logo .logo-sub {
          font-family: var(--font-sans);
          font-size: 0.55rem;
          letter-spacing: 2px;
          font-weight: 600;
          color: var(--accent);
          margin-top: 2px;
        }

        .footer-brand-desc {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
        }

        .social-links {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .social-link {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--accent);
          transition: color 0.3s ease;
        }

        .social-link:hover {
          color: var(--white);
        }

        /* Quick Links Column */
        .footer-links-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .footer-title {
          font-family: var(--font-serif);
          font-size: 1.15rem;
          font-weight: 500;
          color: var(--accent);
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .footer-links-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .footer-links-list button {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          text-align: left;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 0;
        }

        .footer-links-list button:hover {
          color: var(--white);
          transform: translateX(4px);
        }

        /* Newsletter Column */
        .footer-newsletter-col {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .newsletter-desc {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
        }

        .newsletter-form {
          display: flex;
          width: 100%;
        }

        .newsletter-input {
          flex-grow: 1;
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 16px;
          font-size: 0.85rem;
          color: var(--white);
          border-radius: 2px 0 0 2px;
          outline: none;
        }

        .newsletter-input:focus {
          border-color: var(--accent);
        }

        .newsletter-btn {
          background-color: var(--accent);
          color: var(--white);
          border: none;
          padding: 0 24px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          border-radius: 0 2px 2px 0;
          cursor: pointer;
        }

        .newsletter-btn:hover {
          background-color: var(--white);
          color: var(--primary);
        }

        .subscribe-success {
          font-size: 0.85rem;
          color: var(--accent);
        }

        .footer-contact-details {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Footer Bottom */
        .footer-bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding: 24px 0;
          margin-top: 60px;
          background-color: #161616;
        }

        .footer-bottom-layout {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        @media (max-width: 576px) {
          .footer-bottom-layout {
            flex-direction: column;
            text-align: center;
          }
        }

        .copyright-text {
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.4);
        }

        .footer-legal-links {
          display: flex;
          gap: 12px;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.4);
        }

        .footer-legal-links a:hover {
          color: var(--white);
        }

        .legal-separator {
          opacity: 0.3;
        }
      `}</style>
    </footer>
  );
}
