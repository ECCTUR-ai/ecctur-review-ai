

export default function About() {
  const highlights = [
    { title: '2.543m Yükseklik', desc: 'Uludağ Zirve noktasının hemen altında, temiz hava ve sınırsız manzara sunan özel lokasyon.' },
    { title: 'Sıcak Mimari Yapı', desc: 'Bölgeye özgü doğal ahşap ve taş dokuların harmanlandığı sıcak dağ evi konsepti.' },
    { title: 'Şömine & Sosyal Alanlar', desc: 'Ortak oturma alanlarındaki dev şöminelerle günün yorgunluğunu atabileceğiniz dinlendirici lobi.' }
  ];

  return (
    <section id="about" className="about-section section">
      <div className="container">
        <div className="about-layout">
          <div className="about-content">
            <span className="subtitle">HİKAYEMİZ</span>
            <h2 className="heading-md">Montana 2543 Uludağ</h2>
            <p className="about-desc">
              Adını Uludağ'ın büyüleyici zirvelerinden biri olan 2.543 metre yükseklikten alan otelimiz, doğanın kalbinde sıcak ve konforlu bir konaklama sunmak için tasarlandı. Dağ kültürünün samimi dokusunu modern mimari ile birleştirerek kış tatillerinizi unutulmaz bir deneyime dönüştürüyoruz.
            </p>
            <p className="about-desc">
              Misafirlerimize konaklamadan daha fazlasını sunarak kendilerini evlerinde hissettirmeyi amaçlıyoruz. Pist erişiminden lezzetli atıştırmalıklara, şömine başı sıcak sohbetlerden rahat odalara kadar Montana 2543, dağ ruhunu en samimi şekilde hissetmeniz için var.
            </p>

            <div className="about-highlights-list">
              {highlights.map((item, idx) => (
                <div key={idx} className="about-highlight-item">
                  <div className="highlight-bullet">✓</div>
                  <div className="highlight-text">
                    <h4 className="highlight-title">{item.title}</h4>
                    <p className="highlight-desc">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="about-visuals">
            <div className="video-card">
              <img 
                src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop" 
                alt="Fireplace lobby" 
                className="about-img"
              />
              <div className="play-button-overlay">
                <span className="play-icon">▶</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .about-section {
          background-color: var(--krem-dark);
        }

        .about-layout {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 60px;
          align-items: center;
        }

        @media (max-width: 991px) {
          .about-layout {
            grid-template-columns: 1fr;
            gap: 40px;
          }
        }

        .about-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .about-desc {
          font-size: 1.05rem;
          color: var(--koyu-gri-light);
          line-height: 1.7;
        }

        .about-highlights-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 16px;
        }

        .about-highlight-item {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .highlight-bullet {
          color: var(--ahsap);
          font-weight: 900;
          font-size: 1.2rem;
          line-height: 1;
        }

        .highlight-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .highlight-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--bordo);
        }

        .highlight-desc {
          font-size: 0.85rem;
          color: var(--koyu-gri-light);
        }

        /* About Visuals Frame */
        .about-visuals {
          display: flex;
          justify-content: center;
        }

        .video-card {
          position: relative;
          border-radius: 30px;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          border: 4px solid var(--beyaz);
          width: 100%;
          max-width: 440px;
          height: 480px;
          cursor: pointer;
        }

        @media (max-width: 991px) {
          .video-card {
            height: 380px;
            max-width: 500px;
          }
        }

        .about-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s ease;
        }

        .video-card:hover .about-img {
          transform: scale(1.05);
        }

        .play-button-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(91, 30, 40, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.3s ease;
        }

        .video-card:hover .play-button-overlay {
          background-color: rgba(91, 30, 40, 0.35);
        }

        .play-icon {
          width: 70px;
          height: 70px;
          background-color: var(--beyaz);
          color: var(--bordo);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          padding-left: 5px; /* Alignment fix */
          box-shadow: var(--shadow-lg);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .video-card:hover .play-icon {
          transform: scale(1.15);
          background-color: var(--ahsap);
          color: var(--beyaz);
        }
      `}</style>
    </section>
  );
}
