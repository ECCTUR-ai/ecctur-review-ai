interface HeroProps {
  onBookClick: () => void;
}

export default function Hero({ onBookClick }: HeroProps) {
  const handleExploreClick = () => {
    document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero-section">
      <div className="hero-background-image" />
      <div className="hero-background-overlay" />
      <div className="hero-content container animate-fade-up">
        <span className="hero-badge">A BOUTIQUE MOUNTAIN EXPERIENCE</span>
        <h1 className="hero-title">Montana 2543 Uludağ</h1>
        <p className="hero-subtitle">Zirvenin En Samimi Hali</p>
        
        <div className="hero-buttons">
          <button className="btn-primary" onClick={onBookClick}>
            Book Your Stay
          </button>
          <button className="btn-secondary" onClick={handleExploreClick}>
            Explore Rooms
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
          overflow: hidden;
          background-color: var(--primary);
        }

        .hero-background-image {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url('/assets/montana/montana-exterior-entrance.jpeg');
          background-size: cover;
          background-position: center;
          animation: heroZoom 25s infinite alternate ease-in-out;
          z-index: 1;
        }

        .hero-background-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(30, 30, 30, 0.4);
          z-index: 2;
        }

        .hero-content {
          position: relative;
          z-index: 3;
          color: var(--white);
          padding-top: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .hero-badge {
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 24px;
        }

        .hero-title {
          font-family: var(--font-serif);
          font-size: 5rem;
          font-weight: 500;
          letter-spacing: 1px;
          line-height: 1.1;
          margin-bottom: 16px;
          text-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
        }

        .hero-subtitle {
          font-family: var(--font-serif);
          font-size: 1.8rem;
          font-weight: 300;
          font-style: italic;
          color: var(--bg);
          margin-bottom: 48px;
          max-width: 600px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 768px) {
          .hero-title {
            font-size: 3rem;
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
          background-color: var(--accent);
          color: var(--white);
          border: none;
          padding: 16px 40px;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          border-radius: 2px;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
        }

        .btn-primary:hover {
          background-color: var(--white);
          color: var(--primary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .btn-secondary {
          background-color: transparent;
          color: var(--white);
          border: 1px solid rgba(255, 255, 255, 0.4);
          padding: 15px 40px;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          border-radius: 2px;
          cursor: pointer;
        }

        .btn-secondary:hover {
          border-color: var(--white);
          background-color: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
        }
      `}</style>
    </section>
  );
}
