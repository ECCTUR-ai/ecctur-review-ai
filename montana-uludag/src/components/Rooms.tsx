

interface RoomsProps {
  onBookRoom: (roomType: string) => void;
}

export default function Rooms({ onBookRoom }: RoomsProps) {
  const roomCategories = [
    {
      title: 'Standart Oda',
      price: '₺3.200',
      size: '28 m²',
      capacity: '2 Yetişkin',
      image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=800&auto=format&fit=crop',
      features: ['Orman Manzarası', 'Yerden Isıtma', 'Banyo Ürünleri', 'Çay/Kahve Seti', 'Ücretsiz Wi-Fi']
    },
    {
      title: 'Aile Odası',
      price: '₺4.800',
      size: '45 m²',
      capacity: '3-4 Kişi',
      image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=800&auto=format&fit=crop',
      features: ['Şömine Keyfi', 'Dağ ve Pist Manzarası', 'Geniş Banyo', 'Nespresso Makinesi', 'Yerden Isıtma']
    },
    {
      title: 'Ekonomik Dağ Odası',
      price: '₺2.400',
      size: '22 m²',
      capacity: '2 Kişi',
      image: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=800&auto=format&fit=crop',
      features: ['Sıcak Dekorasyon', 'Merkezi Isıtma', 'Çay/Kahve Seti', 'Dağ Manzarası', 'Ücretsiz Wi-Fi']
    }
  ];

  return (
    <section id="rooms" className="rooms-section section">
      <div className="container">
        <div className="section-header text-center">
          <span className="subtitle">SICAK VE KONFORLU KONAKLAMA</span>
          <h2 className="heading-md">Oda Seçeneklerimiz</h2>
          <p className="header-desc">
            Dağ havasını ve ev sıcaklığını bir araya getiren samimi oda konseptlerimizde, konforlu bir tatil sizi bekliyor.
          </p>
        </div>

        <div className="rooms-grid">
          {roomCategories.map((room, i) => (
            <div key={i} className="room-card">
              <div className="room-image-wrapper">
                <img src={room.image} alt={room.title} className="room-image" />
                <div className="room-price-badge">{room.price} <span className="price-unit">/ gece</span></div>
              </div>
              
              <div className="room-info">
                <h3 className="room-title">{room.title}</h3>
                
                <div className="room-meta">
                  <span>📐 {room.size}</span>
                  <span>👥 {room.capacity}</span>
                </div>

                <div className="room-features">
                  {room.features.map((feat, idx) => (
                    <span key={idx} className="feat-tag">✓ {feat}</span>
                  ))}
                </div>

                <button 
                  className="room-book-btn"
                  onClick={() => onBookRoom(room.title)}
                >
                  Odayı İncele & Rezervasyon
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .rooms-section {
          background-color: var(--krem);
        }

        .section-header {
          max-width: 600px;
          margin: 0 auto 60px;
        }

        .header-desc {
          font-size: 1rem;
          color: var(--koyu-gri-light);
          margin-top: 16px;
        }

        .rooms-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        @media (max-width: 991px) {
          .rooms-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .rooms-grid {
            grid-template-columns: 1fr;
          }
        }

        .room-card {
          background-color: var(--beyaz);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: var(--shadow-md);
          transition: all 0.3s ease;
          border: 1px solid rgba(91, 30, 40, 0.05);
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .room-card:hover {
          transform: translateY(-8px);
          box-shadow: var(--shadow-lg);
          border-color: rgba(196, 141, 81, 0.2);
        }

        .room-image-wrapper {
          position: relative;
          height: 240px;
          overflow: hidden;
        }

        .room-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .room-card:hover .room-image {
          transform: scale(1.08);
        }

        .room-price-badge {
          position: absolute;
          bottom: 20px;
          right: 20px;
          background-color: var(--bordo);
          color: var(--beyaz);
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 1.1rem;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
        }

        .price-unit {
          font-size: 0.7rem;
          font-weight: 400;
          opacity: 0.8;
        }

        .room-info {
          padding: 24px;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        .room-title {
          font-family: var(--serif);
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--bordo);
          margin-bottom: 12px;
        }

        .room-meta {
          display: flex;
          gap: 16px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--ahsap-dark);
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          padding-bottom: 12px;
        }

        .room-features {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
          flex-grow: 1;
        }

        .feat-tag {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--koyu-gri-light);
          background-color: var(--acik-gri);
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid rgba(0, 0, 0, 0.03);
        }

        .room-book-btn {
          background-color: var(--beyaz);
          color: var(--bordo);
          border: 2px solid var(--bordo);
          padding: 12px;
          width: 100%;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.85rem;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .room-card:hover .room-book-btn {
          background-color: var(--bordo);
          color: var(--beyaz);
        }

        .room-book-btn:hover {
          background-color: var(--bordo-light) !important;
          border-color: var(--bordo-light) !important;
        }
      `}</style>
    </section>
  );
}
