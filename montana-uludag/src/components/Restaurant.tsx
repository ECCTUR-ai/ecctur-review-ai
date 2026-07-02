

export default function Restaurant() {
  const menuHighlights = [
    { title: 'Montana Burger', desc: 'Özel dağ baharatlı 200g burger köftesi, karamelize soğan, cheddar peyniri ve el yapımı sos.' },
    { title: 'Şömine Ateşinde Sıcak Şarap', desc: 'Karanfil, tarçın ve taze meyve kabukları ile demlenmiş Montana klasik dağ lezzeti.' },
    { title: 'Kestane Çorbası', desc: 'Uludağ kestanelerinden taze krema ve dağ kekiği eşliğinde hazırlanan özel kış başlangıcı.' },
    { title: 'Fırınlanmış Dağ Armudu', desc: 'Fırında odun ateşinde karamelize edilmiş armut, keçi sütlü dondurma ve yaban mersini sosu.' }
  ];

  return (
    <section id="restaurant" className="restaurant-section section">
      <div className="container">
        <div className="restaurant-layout">
          <div className="restaurant-content">
            <span className="subtitle">GASTRONOMİ DENEYİMİ</span>
            <h2 className="heading-md">Montana Snack Restaurant</h2>
            <p className="restaurant-description">
              Pist dönüşünde ya da şömine başında, içinizi ısıtacak lezzetlerle buluşun. Odun ateşinde pişen taze pizzalardan gurme burgerlere, zengin sıcak içecek menümüzden özel dağ tatlılarına uzanan geniş seçkimizle hizmetinizdeyiz.
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
