interface ReservationCTAProps {
  onReserveClick: () => void;
}

export default function ReservationCTA({ onReserveClick }: ReservationCTAProps) {
  return (
    <section className="reservation-cta-section">
      <div className="cta-background-image" />
      <div className="cta-background-overlay" />
      <div className="cta-content container animate-fade-up">
        <h2 className="cta-heading">Experience Montana.</h2>
        <p className="cta-subheading">Uludağ'ın kalbinde huzurlu ve samimi bir kış tatili için yerinizi ayırtın.</p>
        <button className="cta-btn" onClick={onReserveClick}>
          Reserve Now
        </button>
      </div>

      <style>{`
        .reservation-cta-section {
          position: relative;
          height: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
          background-color: var(--primary);
        }

        .cta-background-image {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url('/assets/montana/montana-exterior-entrance.jpeg');
          background-size: cover;
          background-position: center;
          transition: transform 1.5s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 1;
        }

        .reservation-cta-section:hover .cta-background-image {
          transform: scale(1.03);
        }

        .cta-background-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(30, 30, 30, 0.45);
          z-index: 2;
        }

        .cta-content {
          position: relative;
          z-index: 3;
          color: var(--white);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .cta-heading {
          font-family: var(--font-serif);
          font-size: 3.5rem;
          font-weight: 500;
          letter-spacing: 1px;
          line-height: 1.1;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .cta-subheading {
          font-size: 1.1rem;
          font-weight: 300;
          color: var(--bg);
          max-width: 500px;
          margin-bottom: 24px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 768px) {
          .reservation-cta-section {
            height: 400px;
          }
          .cta-heading {
            font-size: 2.5rem;
          }
          .cta-subheading {
            font-size: 0.95rem;
          }
        }

        .cta-btn {
          background-color: var(--accent);
          color: var(--white);
          border: none;
          padding: 16px 48px;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          border-radius: 2px;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: all 0.3s ease;
        }

        .cta-btn:hover {
          background-color: var(--white);
          color: var(--primary);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </section>
  );
}
