

export default function SkiExperience() {
  const skiFeatures = [
    { title: 'Doğrudan Pist Bağlantısı', desc: 'Otel kapısından çıkıp hemen kayak takımlarınızı takarak pistlere kayarak ulaşın (Ski-in / Ski-out).' },
    { title: 'Ekipman Kiralama & Oda Hizmeti', desc: 'Son teknoloji kayak ve snowboard ekipmanlarını otel bünyesindeki odamızdan kolayca kiralayın.' },
    { title: 'Profesyonel Eğitmen Kadrosu', desc: 'Milli sporculardan oluşan eğitmenlerimiz ile her yaş ve seviyeye uygun birebir kayak dersleri.' },
    { title: 'Kar Safarisi & Kızak', desc: 'Kar motosikletleri ile dağ turları veya çocuklarınızla keyifli kızak etkinlikleri.' }
  ];

  return (
    <section className="ski-experience-section section">
      <div className="container">
        <div className="ski-layout">
          <div className="ski-image-card">
            <img 
              src="https://images.unsplash.com/photo-1551698618-1ffdfe079820?q=80&w=800&auto=format&fit=crop" 
              alt="Ski Slope Experience" 
              className="ski-img"
            />
            <div className="ski-badge-info">
              <span className="badge-title">Rakım</span>
              <span className="badge-val">2.543m</span>
            </div>
          </div>

          <div className="ski-content">
            <span className="subtitle">MACERA & AKTİVİTE</span>
            <h2 className="heading-md">Uludağ'ın Eşsiz Pistleri Kapınızda</h2>
            <p className="ski-desc">
              Türkiye'nin en popüler kayak merkezi Uludağ'ın 2. Gelişim bölgesinde yer alan Montana 2543, doğrudan pist erişimi sunmaktadır. Kristal kar yapısı ve modern teleferik sistemleriyle kış sporlarının keyfini maksimum konforla sürün.
            </p>

            <div className="ski-features-grid">
              {skiFeatures.map((feat, idx) => (
                <div key={idx} className="ski-feature-item">
                  <div className="feat-number">{idx + 1}</div>
                  <div className="feat-info">
                    <h4 className="feat-title">{feat.title}</h4>
                    <p className="feat-desc">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .ski-experience-section {
          background-color: var(--krem);
        }

        .ski-layout {
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: 60px;
          align-items: center;
        }

        @media (max-width: 991px) {
          .ski-layout {
            grid-template-columns: 1fr;
            gap: 40px;
          }
        }

        .ski-image-card {
          position: relative;
          border-radius: 30px;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          height: 540px;
        }

        @media (max-width: 991px) {
          .ski-image-card {
            height: 380px;
            max-width: 600px;
            margin: 0 auto;
            width: 100%;
          }
        }

        .ski-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s ease;
        }

        .ski-image-card:hover .ski-img {
          transform: scale(1.04);
        }

        .ski-badge-info {
          position: absolute;
          top: 30px;
          left: 30px;
          background-color: rgba(91, 30, 40, 0.9);
          backdrop-filter: blur(8px);
          color: var(--beyaz);
          padding: 12px 24px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .badge-title {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--ahsap);
        }

        .badge-val {
          font-family: var(--serif);
          font-size: 1.6rem;
          font-weight: 700;
        }

        .ski-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .ski-desc {
          font-size: 1.05rem;
          color: var(--koyu-gri-light);
          line-height: 1.7;
        }

        .ski-features-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          margin-top: 12px;
        }

        .ski-feature-item {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }

        .feat-number {
          background-color: var(--bordo);
          color: var(--beyaz);
          font-family: var(--serif);
          font-size: 1.25rem;
          font-weight: 700;
          min-width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(91, 30, 40, 0.2);
        }

        .feat-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .feat-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--bordo);
        }

        .feat-desc {
          font-size: 0.85rem;
          color: var(--koyu-gri-light);
        }
      `}</style>
    </section>
  );
}
