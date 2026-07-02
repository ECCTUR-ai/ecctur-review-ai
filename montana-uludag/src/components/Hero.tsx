

interface HeroProps {
  onBookClick: () => void;
}

export default function Hero({ onBookClick }: HeroProps) {
  const handleWhatsAppClick = () => {
    window.open('https://api.whatsapp.com/send?phone=90XXXXXXXXXX&text=Merhaba%2C%20Montana%202543%20otelinde%20konaklama%20ve%20rezervasyon%20talebi%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum.', '_blank');
  };

  return (
    <section className="hero-section">
      <div className="hero-background-overlay" />
      <div className="hero-content container animate-fade-in">
        <span className="hero-badge">ZİRVEDE SICAK VE SAMİMİ BİR TATİL</span>
        <h1 className="hero-title">MONTANA <span className="title-highlight">2543</span></h1>
        <p className="hero-subtitle">Uludağ'ın Zirvesinde Yeni Bir Deneyim</p>
        
        <div className="hero-buttons">
          <button className="btn-primary" onClick={onBookClick}>
            Rezervasyon Yap
          </button>
          <button className="btn-secondary" onClick={handleWhatsAppClick}>
            <svg className="whatsapp-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.966C16.528 2.016 14.07 1.01 11.516 1.01c-5.44 0-9.866 4.372-9.87 9.802 0 1.714.464 3.391 1.346 4.869l-.969 3.541 3.634-.948zM17.65 14.36c-.327-.162-1.927-.937-2.224-1.044-.298-.109-.516-.162-.731.162-.217.324-.838 1.045-1.028 1.262-.19.217-.38.243-.708.08-.328-.162-1.383-.503-2.635-1.606-.975-.859-1.633-1.922-1.824-2.247-.19-.325-.02-.5-.184-.66-.148-.145-.327-.379-.491-.568-.164-.188-.218-.324-.327-.54-.109-.217-.055-.405-.027-.567.027-.162.217-.513.327-.676.11-.162.163-.27.244-.45.08-.182.04-.34-.014-.486-.054-.148-.516-1.228-.708-1.688-.187-.45-.378-.388-.517-.395-.133-.007-.285-.007-.437-.007-.152 0-.4-.056-.609.168-.21.223-.797.77-.797 1.878 0 1.107.817 2.176.93 2.327.114.152 1.609 2.428 3.899 3.403.545.233.97.371 1.302.475.548.172 1.046.147 1.44.089.44-.065 1.928-.78 2.2-1.493.272-.713.272-1.324.19-1.455-.08-.132-.298-.213-.625-.376z"/>
            </svg>
            WhatsApp
          </button>
        </div>
      </div>

      <style>{`
        .hero-section {
          position: relative;
          height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background-image: url('https://images.unsplash.com/photo-1544860707-c37d9c9db80d?q=80&w=1920&auto=format&fit=crop');
          background-size: cover;
          background-position: center;
          overflow: hidden;
        }

        .hero-background-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to bottom,
            rgba(22, 12, 15, 0.5) 0%,
            rgba(22, 12, 15, 0.4) 50%,
            rgba(91, 30, 40, 0.7) 100%
          );
          z-index: 1;
        }

        .hero-content {
          position: relative;
          z-index: 2;
          color: var(--beyaz);
          padding-top: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .hero-badge {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--ahsap);
          background-color: rgba(255, 255, 255, 0.05);
          padding: 8px 20px;
          border-radius: 50px;
          border: 1px solid rgba(196, 141, 81, 0.2);
          margin-bottom: 24px;
        }

        .hero-title {
          font-family: var(--serif);
          font-size: 5.5rem;
          font-weight: 900;
          letter-spacing: 2px;
          line-height: 1;
          margin-bottom: 16px;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .title-highlight {
          color: var(--ahsap);
          font-weight: 300;
        }

        .hero-subtitle {
          font-family: var(--serif);
          font-size: 1.8rem;
          font-weight: 400;
          font-style: italic;
          color: rgba(255, 255, 255, 0.95);
          margin-bottom: 48px;
          max-width: 600px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        @media (max-width: 768px) {
          .hero-title {
            font-size: 3.5rem;
          }
          .hero-subtitle {
            font-size: 1.3rem;
            margin-bottom: 36px;
          }
        }

        .hero-buttons {
          display: flex;
          gap: 20px;
          justify-content: center;
        }

        @media (max-width: 576px) {
          .hero-buttons {
            flex-direction: column;
            width: 100%;
            max-width: 280px;
            gap: 12px;
          }
        }

        .btn-primary {
          background-color: var(--beyaz);
          color: var(--bordo);
          border: none;
          padding: 16px 36px;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        }

        .btn-primary:hover {
          background-color: var(--ahsap);
          color: var(--beyaz);
          transform: translateY(-3px);
          box-shadow: 0 15px 30px rgba(196, 141, 81, 0.35);
        }

        .btn-secondary {
          background-color: transparent;
          color: var(--beyaz);
          border: 2px solid rgba(255, 255, 255, 0.3);
          padding: 14px 36px;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .btn-secondary:hover {
          border-color: var(--beyaz);
          background-color: rgba(255, 255, 255, 0.05);
          transform: translateY(-3px);
        }

        .whatsapp-icon {
          fill: var(--beyaz);
          transition: transform 0.3s ease;
        }

        .btn-secondary:hover .whatsapp-icon {
          transform: scale(1.15);
        }
      `}</style>
    </section>
  );
}
