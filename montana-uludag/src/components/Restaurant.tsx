

export default function Restaurant() {
  const menuHighlights = [
    { title: 'Uludağ Sucuk Ekmek', desc: 'Izgarada pişen özel kasap sucuğu, taze çıtır ekmek ve dağ kekikli sosu ile eşsiz kar klasiği.' },
    { title: 'Şömine Başında Sıcak İçecekler', desc: 'Salep, sıcak çikolata, taze demlenmiş dağ çayı ve şifalı bitki çayları ile içinizi ısıtacak seçenekler.' },
    { title: 'Montana Burger', desc: 'Özel baharatlı 200g burger köftesi, karamelize soğan, cheddar peyniri ve el yapımı çıtır patates.' },
    { title: 'Acenta & Grup Menüleri', desc: 'Günübirlik turlar ve acenta grupları için önceden planlanabilen pratik ve doyurucu toplu yemek menüleri.' }
  ];

  return (
    <section id="restaurant" className="restaurant-section section">
      <div className="container">
        <div className="restaurant-layout">
          <div className="restaurant-content">
            <span className="subtitle">LEZZET DURAGI</span>
            <h2 className="heading-md">Montana Snack Restaurant</h2>
            <p className="restaurant-description">
              Pist dönüşünde, günübirlik turlarınızda ya da acenta gruplarınızla sıcak bir mola verin. Şömine başında sucuk ekmek keyfi, içinizi ısıtacak zengin sıcak içecekler ve odun ateşinde pişen lezzetlerimizle hem günübirlik dağ ziyaretçilerimize hem de otel konuklarımıza hizmet vermekteyiz.
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

          <div className="restaurant-images">
            <div className="image-card card-large">
              <img 
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop" 
                alt="Restaurant Interior" 
                className="rest-img"
              />
            </div>
            <div className="image-card card-small">
              <img 
                src="https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=600&auto=format&fit=crop" 
                alt="Hot Drinks Fireside" 
                className="rest-img"
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .restaurant-section {
          background-color: var(--krem-dark);
          position: relative;
          overflow: hidden;
        }

        .restaurant-layout {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 60px;
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
          font-size: 1.05rem;
          color: var(--koyu-gri-light);
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
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--bordo);
        }

        .menu-divider {
          flex-grow: 1;
          height: 1px;
          background-color: rgba(91, 30, 40, 0.15);
        }

        .menu-item-desc {
          font-size: 0.85rem;
          color: var(--koyu-gri-light);
        }

        /* Images Layout Grid */
        .restaurant-images {
          position: relative;
          display: flex;
          height: 520px;
        }

        @media (max-width: 991px) {
          .restaurant-images {
            height: 400px;
            max-width: 600px;
            width: 100%;
            margin: 0 auto;
          }
        }

        .image-card {
          border-radius: 24px;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          border: 4px solid var(--beyaz);
        }

        .rest-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .image-card:hover .rest-img {
          transform: scale(1.05);
        }

        .card-large {
          width: 75%;
          height: 80%;
          z-index: 1;
        }

        .card-small {
          width: 50%;
          height: 55%;
          position: absolute;
          right: 0;
          bottom: 0;
          z-index: 2;
        }
      `}</style>
    </section>
  );
}
