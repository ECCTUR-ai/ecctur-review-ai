

export default function Stats() {
  const statList = [
    { number: '64', label: 'KONFORLU ODA', desc: 'Sıcak & Dağ Manzaralı' },
    { number: '180', label: 'YATAK KAPASİTESİ', desc: 'Geniş Aile & Oda Seçenekleri' },
    { number: '6', label: 'KAT', desc: 'Sosyal Alanlar & Dinlenme Salonu' }
  ];

  return (
    <section className="stats-section">
      <div className="container">
        <div className="stats-grid">
          {statList.map((stat, i) => (
            <div key={i} className="stat-card">
              <span className="stat-number">{stat.number}</span>
              <span className="stat-label">{stat.label}</span>
              <p className="stat-desc">{stat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .stats-section {
          background-color: var(--bordo);
          padding: 60px 0;
          position: relative;
          z-index: 10;
          margin-top: -40px;
          border-radius: 40px 40px 0 0;
          box-shadow: 0 -20px 40px rgba(0, 0, 0, 0.1);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
          text-align: center;
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }
          .stats-section {
            border-radius: 24px 24px 0 0;
            padding: 40px 0;
          }
        }

        .stat-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .stats-grid > .stat-card:not(:last-child)::after {
          content: '';
          position: absolute;
          right: -20px;
          top: 25%;
          height: 50%;
          width: 1px;
          background-color: rgba(255, 255, 255, 0.15);
        }

        @media (max-width: 768px) {
          .stats-grid > .stat-card:not(:last-child)::after {
            display: none;
          }
        }

        .stat-number {
          font-family: var(--serif);
          font-size: 4rem;
          font-weight: 800;
          color: var(--ahsap);
          line-height: 1;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--beyaz);
          letter-spacing: 2px;
          margin-bottom: 6px;
        }

        .stat-desc {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.6);
        }
      `}</style>
    </section>
  );
}
