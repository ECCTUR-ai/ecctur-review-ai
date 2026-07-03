export default function About() {
  const highlights = [
    { title: '2.543m Rakım', desc: 'Uludağ Zirve noktası yamaçlarında, eşsiz kar kalitesi ve tertemiz dağ havası.' },
    { title: 'Doğal Malzemeler', desc: 'Doğal ahşap ve taş dokuların harmanlandığı sıcak dağ evi mimarisi.' },
    { title: 'Sosyal Alanlar', desc: 'Dev şöminelerle donatılmış lobi ve dinlenme alanlarında huzurlu dağ atmosferi.' }
  ];

  return (
    <section id="about" className="about-section section">
      <div className="container about-layout">
        {/* Left: Image block */}
        <div className="about-visuals animate-fade-up">
          <div className="image-frame">
            <img 
              src="/assets/montana/montana-lobby-fireplace.jpeg" 
              alt="Montana 2543 Uludağ lobby" 
              className="about-img"
              loading="lazy"
            />
          </div>
        </div>

        {/* Right: Story content block */}
        <div className="about-content animate-fade-up">
          <span className="subtitle">HİKAYEMİZ</span>
          <h2 className="heading-md about-title">The Legacy of Fahri, Reimagined.</h2>
          
          <p className="about-desc">
            Uludağ'ın köklü dağ kültürü mirasını modern ve samimi bir dokunuşla yeniden hayal ettik. Montana 2543, adını zirvenin hemen altındaki benzersiz rakımından alırken, köklü misafirperverlik geleneğini günümüzün sade konforuyla buluşturuyor.
          </p>
          <p className="about-desc">
            Sakinlik, samimiyet ve doğallığı merkezimize koyarak, dağ ruhunu en saf haliyle hissedebileceğiniz bir dinlenme köşesi yarattık. Pist erişiminden şömine başı sıcak sohbetlere kadar her detay, huzur dolu anlar paylaşmanız için düşünüldü.
          </p>

          <div className="about-highlights-list">
            {highlights.map((item, idx) => (
              <div key={idx} className="about-highlight-item">
                <span className="highlight-bullet">✓</span>
                <div className="highlight-text">
                  <h4 className="highlight-title">{item.title}</h4>
                  <p className="highlight-desc">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .about-section {
          background-color: var(--bg);
        }

        .about-layout {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 64px;
          align-items: center;
        }

        @media (max-width: 991px) {
          .about-layout {
            grid-template-columns: 1fr;
            gap: 48px;
          }
        }

        .about-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .about-title {
          margin-bottom: 8px;
        }

        .about-desc {
          font-size: 1rem;
          color: var(--text);
          line-height: 1.7;
          font-weight: 400;
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
          color: var(--accent);
          font-weight: 700;
          font-size: 1.1rem;
          line-height: 1;
        }

        .highlight-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .highlight-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--primary);
        }

        .highlight-desc {
          font-size: 0.85rem;
          color: var(--secondary);
        }

        /* About Visuals Frame */
        .about-visuals {
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .image-frame {
          position: relative;
          border-radius: 2px;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border);
          width: 100%;
          height: 520px;
        }

        @media (max-width: 991px) {
          .image-frame {
            height: 400px;
            max-width: 600px;
          }
        }

        .about-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .image-frame:hover .about-img {
          transform: scale(1.03);
        }
      `}</style>
    </section>
  );
}
