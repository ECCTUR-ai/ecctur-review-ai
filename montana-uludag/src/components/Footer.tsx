

interface FooterProps {
  setActivePage: (page: string) => void;
}

export default function Footer({ setActivePage }: FooterProps) {
  const handleNavClick = (id: string) => {
    setActivePage(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="footer">
      <div className="container footer-grid">
        {/* Brand Info */}
        <div className="footer-brand-col">
          <div className="footer-logo" onClick={() => handleNavClick('home')}>
            MONTANA <span className="logo-number">2543</span>
            <span className="logo-sub">ULUDAĞ</span>
          </div>
          <p className="footer-brand-desc">
            Uludağ'ın 2. Gelişim bölgesinde, eşsiz pistlerin ve karın tadını en yüksek konforla çıkarmanız için tasarlanmış samimi dağ oteli.
          </p>
          <div className="social-icons">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="social-link">Instagram</a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" className="social-link">Facebook</a>
            <a href="https://tripadvisor.com" target="_blank" rel="noreferrer" className="social-link">TripAdvisor</a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-links-col">
          <h4 className="footer-title">Hızlı Linkler</h4>
          <ul className="footer-links-list">
            <li><button onClick={() => handleNavClick('home')}>Ana Sayfa</button></li>
            <li><button onClick={() => handleNavClick('rooms')}>Odalarımız</button></li>
            <li><button onClick={() => handleNavClick('restaurant')}>Snack Restaurant</button></li>
            <li><button onClick={() => handleNavClick('gallery')}>Fotoğraf Galerisi</button></li>
            <li><button onClick={() => handleNavClick('about')}>Hakkımızda</button></li>
            <li><button onClick={() => handleNavClick('contact')}>İletişim & Konum</button></li>
          </ul>
        </div>

        {/* Quick Contact info */}
        <div className="footer-contact-col">
          <h4 className="footer-title">Bize Ulaşın</h4>
          <p className="contact-detail-line">📍 2. Gelişim Bölgesi, Oteller Mevkii No: 12, Uludağ / Bursa</p>
          <p className="contact-detail-line">📞 +90XXXXXXXXXX</p>
          <p className="contact-detail-line">✉ info@montana2543.com</p>
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
          background-color: var(--koyu-gri);
          color: var(--beyaz);
          padding: 80px 0 0;
          border-top: 4px solid var(--bordo);
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 1fr;
          gap: 60px;
          padding-bottom: 60px;
        }

        @media (max-width: 991px) {
          .footer-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 40px;
          }
        }

        @media (max-width: 576px) {
          .footer-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }
        }

        /* Brand Column */
        .footer-brand-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .footer-logo {
          font-family: var(--serif);
          font-size: 1.8rem;
          font-weight: 800;
          letter-spacing: 2px;
          color: var(--beyaz);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          line-height: 1;
        }

        .footer-logo .logo-number {
          color: var(--ahsap);
          font-weight: 400;
        }

        .footer-logo .logo-sub {
          font-family: var(--sans);
          font-size: 0.6rem;
          letter-spacing: 4px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 2px;
        }

        .footer-brand-desc {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
        }

        .social-icons {
          display: flex;
          gap: 16px;
        }

        .social-link {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--ahsap);
          transition: color 0.3s ease;
        }

        .social-link:hover {
          color: var(--beyaz);
        }

        /* Quick Links Column */
        .footer-links-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .footer-title {
          font-family: var(--serif);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--ahsap);
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
          color: var(--beyaz);
          transform: translateX(4px);
        }

        /* Contact Details Column */
        .footer-contact-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .contact-detail-line {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
        }

        /* Footer Bottom */
        .footer-bottom {
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding: 24px 0;
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
          color: var(--beyaz);
        }

        .legal-separator {
          opacity: 0.3;
        }
      `}</style>
    </footer>
  );
}
