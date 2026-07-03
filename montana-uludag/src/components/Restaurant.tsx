export default function Restaurant() {
  const menuHighlights = [
    { title: 'Uludağ Kasap Sucuk', desc: 'Izgarada pişen özel kasap sucuğu, taze dağ kekikli soslar ve sıcak ekmek eşliğinde klasik lezzet.' },
    { title: 'Şömine Başında Sıcak Çay', desc: 'Salep, sıcak çikolata, taze demlenmiş dağ çayı ve şifalı bitki çayları seçenekleri.' },
    { title: 'Montana Burger', desc: 'Özel baharatlı 200g köfte, karamelize soğan, cheddar peyniri ve el yapımı çıtır patates.' },
    { title: 'Grup & Acenta Menüleri', desc: 'Günübirlik turlar ve acenta grupları için önceden rezerve edilebilen toplu yemek menüleri.' }
  ];

  return (
    <section id="restaurant" className="restaurant-section section">
      <div className="container">
        <div className="restaurant-layout">
          <div className="restaurant-content animate-fade-up">
            <span className="subtitle">LEZZET DURAGI</span>
            <h2 className="heading-md">Mountain Flavors. <br />Warm Moments.</h2>
            <p className="restaurant-description">
              Pist dönüşünde, günübirlik turlarınızda ya da acenta gruplarınızla sıcak bir mola verin. Şömine başında sıcak içecekler, taze lezzetlerimiz ve Montana Cafe terasının karlı atmosferiyle hem günübirlik ziyaretçilerimize hem de otel konuklarımıza hizmet vermekteyiz.
            </p>
            
            <div className="menu-list">
              {menuHighlights.map((item, idx) => (
                <div key={idx} className="menu-item">
                  <div className="menu-item-header">
                    <h4 className="menu-item-title">{item.title}</h4>
                    <span className="menu-divider"></span>
                  </div>
                  <p className="menu-item-desc">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="restaurant-images animate-fade-up">
            <div className="image-card">
              <img 
                src="/assets/montana/montana-outdoor-cafe.jpeg" 
                alt="Montana 2543 Uludağ cafe" 
                className="rest-img"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .restaurant-section {
          background-color: var(--bg);
          border-bottom: 1px solid var(--border);
        }

        .restaurant-layout {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 64px;
          align-items: center;
        }

        @media (max-width: 991px) {
          .restaurant-layout {
            grid-template-columns: 1fr;
            gap: 48px;
          }
        }

        .restaurant-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .restaurant-description {
          font-size: 1rem;
          color: var(--text);
          line-height: 1.7;
        }

        .menu-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-top: 16px;
        }

        .menu-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .menu-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .menu-item-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--primary);
        }

        .menu-divider {
          flex-grow: 1;
          height: 1px;
          background-color: var(--border);
        }

        .menu-item-desc {
          font-size: 0.85rem;
          color: var(--secondary);
        }

        /* Images Layout Grid */
        .restaurant-images {
          position: relative;
          display: flex;
          height: 520px;
          width: 100%;
        }

        @media (max-width: 991px) {
          .restaurant-images {
            height: 400px;
            max-width: 600px;
            margin: 0 auto;
          }
        }

        .image-card {
          border-radius: 2px;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border);
          width: 100%;
          height: 100%;
        }

        .rest-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .image-card:hover .rest-img {
          transform: scale(1.03);
        }
      `}</style>
    </section>
  );
}
