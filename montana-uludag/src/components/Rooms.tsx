import { useState } from 'react';

interface RoomsProps {
  onBookRoom: (roomType: string) => void;
}

export default function Rooms({ onBookRoom }: RoomsProps) {
  const [selectedRoomDetails, setSelectedRoomDetails] = useState<string | null>(null);

  const roomCategories = [
    {
      title: 'Standart Oda',
      price: '₺3.200',
      size: '28 m²',
      capacity: '2 Yetişkin',
      image: '/assets/montana/montana-room-triple.jpeg',
      alt: 'Montana 2543 Uludağ oda',
      features: ['Yerden Isıtma', 'Orman Manzarası', 'Özel Banyo Ürünleri', 'Çay/Kahve İkramı', 'Hızlı Wi-Fi']
    },
    {
      title: 'Aile Odası',
      price: '₺4.800',
      size: '45 m²',
      capacity: '3-4 Kişi',
      image: '/assets/montana/montana-room-minibar.jpeg',
      alt: 'Montana 2543 Uludağ minibar ve makyaj masası',
      features: ['Şömine Köşesi', 'Geniş Yatak Grubu', 'Pist Manzaralı Balkon', 'Minibar ve Çay Seti', 'Yerden Isıtma']
    },
    {
      title: 'Ekonomik Dağ Odası',
      price: '₺2.400',
      size: '22 m²',
      capacity: '2 Kişi',
      image: '/assets/montana/montana-room-wall-art.jpeg',
      alt: 'Montana 2543 Uludağ oda',
      features: ['Sade & Sıcak Tasarım', 'Merkezi Isıtma', 'Banyo Ürünleri', 'Çay/Kahve İkramı', 'Hızlı Wi-Fi']
    }
  ];

  return (
    <section id="rooms" className="rooms-section section">
      <div className="container">
        <div className="section-header text-center animate-fade-up">
          <span className="subtitle">KONAKLAMA</span>
          <h2 className="heading-md">Oda Seçeneklerimiz</h2>
          <p className="header-desc">
            Sıcak ışıklar, ahşap detaylar ve konforlu yataklarla hazırlanan dağ odalarımızda huzurlu bir uyku sizi bekliyor.
          </p>
        </div>

        <div className="rooms-grid">
          {roomCategories.map((room, i) => (
            <div key={i} className="room-card animate-fade-up">
              <div className="room-image-wrapper">
                <img src={room.image} alt={room.alt} className="room-image" loading="lazy" />
                <div className="room-price-badge">{room.price} <span className="price-unit">/ gece</span></div>
              </div>
              
              <div className="room-info">
                <h3 className="room-title">{room.title}</h3>
                
                <div className="room-meta">
                  <span>📐 {room.size}</span>
                  <span>👥 {room.capacity}</span>
                </div>

                <div className="room-features">
                  {room.features.slice(0, 3).map((feat, idx) => (
                    <span key={idx} className="feat-tag">{feat}</span>
                  ))}
                </div>

                <div className="room-actions-row">
                  <button 
                    className="room-detail-trigger-btn"
                    onClick={() => setSelectedRoomDetails(room.title)}
                  >
                    View Details
                  </button>
                  <button 
                    className="room-book-btn"
                    onClick={() => onBookRoom(room.title)}
                  >
                    Hemen Kirala
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Room Details Modal */}
      {selectedRoomDetails && (
        <div className="room-modal-overlay" onClick={() => setSelectedRoomDetails(null)}>
          <div className="room-modal-card animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <span className="room-modal-close" onClick={() => setSelectedRoomDetails(null)}>&times;</span>
            
            {roomCategories.filter(r => r.title === selectedRoomDetails).map((room, i) => (
              <div key={i} className="room-modal-content">
                <div className="room-modal-image">
                  <img src={room.image} alt={room.title} />
                </div>
                <div className="room-modal-text">
                  <span className="subtitle">ODA DETAYI</span>
                  <h3 className="heading-md">{room.title}</h3>
                  <div className="modal-price-line">
                    <span className="price-bold">{room.price}</span> / gece
                  </div>
                  
                  <div className="room-meta-modal">
                    <span>📐 Genişlik: {room.size}</span>
                    <span>👥 Kapasite: {room.capacity}</span>
                  </div>

                  <p className="modal-room-desc">
                    Montana 2543'ün İskandinav minimalizmiyle tasarlanan bu odası, sıcak meşe paneller, özenle seçilmiş taş kaplamalar ve kar manzaralı pencereleriyle benzersiz bir dağ atmosferi sunar.
                  </p>

                  <h5 className="modal-sub-title">Öne Çıkan Özellikler:</h5>
                  <ul className="modal-features-list">
                    {room.features.map((f, idx) => (
                      <li key={idx}>• {f}</li>
                    ))}
                    <li>• Premium Nevresim Takımı</li>
                    <li>• Dağ Atmosferi</li>
                  </ul>

                  <button 
                    className="modal-book-action-btn"
                    onClick={() => {
                      onBookRoom(room.title);
                      setSelectedRoomDetails(null);
                    }}
                  >
                    Bu Oda İçin Talebi Başlat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .rooms-section {
          background-color: var(--bg);
        }

        .section-header {
          max-width: 600px;
          margin: 0 auto 60px;
        }

        .header-desc {
          font-size: 1rem;
          color: var(--text);
          margin-top: 12px;
        }

        .rooms-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
        }

        @media (max-width: 991px) {
          .rooms-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }
        }

        @media (max-width: 768px) {
          .rooms-grid {
            grid-template-columns: 1fr;
          }
        }

        .room-card {
          background-color: var(--white);
          border-radius: 2px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .room-card:hover {
          transform: translateY(-8px);
          box-shadow: var(--shadow-lg);
          border-color: var(--accent);
        }

        .room-image-wrapper {
          position: relative;
          height: 260px;
          overflow: hidden;
        }

        .room-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .room-card:hover .room-image {
          transform: scale(1.04);
        }

        .room-price-badge {
          position: absolute;
          bottom: 20px;
          right: 20px;
          background-color: var(--primary);
          color: var(--white);
          padding: 8px 16px;
          font-weight: 600;
          font-size: 1rem;
          letter-spacing: 0.5px;
          border-radius: 2px;
        }

        .price-unit {
          font-size: 0.7rem;
          opacity: 0.7;
        }

        .room-info {
          padding: 28px;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        .room-title {
          font-family: var(--font-serif);
          font-size: 1.4rem;
          font-weight: 500;
          color: var(--primary);
          margin-bottom: 12px;
        }

        .room-meta {
          display: flex;
          gap: 16px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--secondary);
          margin-bottom: 20px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
        }

        .room-features {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 28px;
          flex-grow: 1;
        }

        .feat-tag {
          font-size: 0.75rem;
          color: var(--text);
          background-color: var(--bg);
          padding: 4px 10px;
          border-radius: 2px;
          border: 1px solid var(--border);
        }

        .room-actions-row {
          display: flex;
          gap: 12px;
        }

        .room-detail-trigger-btn {
          flex: 1;
          border: 1px solid var(--border);
          color: var(--primary);
          padding: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          border-radius: 2px;
        }

        .room-detail-trigger-btn:hover {
          border-color: var(--primary);
          background-color: var(--bg);
        }

        .room-book-btn {
          flex: 1.2;
          background-color: var(--primary);
          color: var(--white);
          border: none;
          padding: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          border-radius: 2px;
        }

        .room-book-btn:hover {
          background-color: var(--accent);
          color: var(--white);
        }

        /* Modal styling */
        .room-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(30, 30, 30, 0.8);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .room-modal-card {
          background-color: var(--bg);
          width: 100%;
          max-width: 900px;
          position: relative;
          border-radius: 2px;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          border: 1px solid var(--border);
        }

        .room-modal-close {
          position: absolute;
          top: 15px;
          right: 20px;
          font-size: 2.2rem;
          color: var(--primary);
          cursor: pointer;
          z-index: 10;
        }

        .room-modal-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          max-height: 85vh;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .room-modal-content {
            grid-template-columns: 1fr;
          }
        }

        .room-modal-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          min-height: 350px;
        }

        .room-modal-text {
          padding: 40px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .modal-price-line {
          font-size: 0.95rem;
          color: var(--secondary);
        }

        .price-bold {
          font-size: 1.6rem;
          font-weight: 600;
          color: var(--primary);
        }

        .room-meta-modal {
          display: flex;
          gap: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--secondary);
          border-bottom: 1px solid var(--border);
          padding-bottom: 12px;
        }

        .modal-room-desc {
          font-size: 0.9rem;
          color: var(--text);
          line-height: 1.6;
        }

        .modal-sub-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--primary);
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .modal-features-list {
          list-style: none;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .modal-features-list li {
          font-size: 0.85rem;
          color: var(--text);
        }

        .modal-book-action-btn {
          background-color: var(--primary);
          color: var(--white);
          padding: 16px;
          font-weight: 600;
          font-size: 0.8rem;
          letter-spacing: 2px;
          text-transform: uppercase;
          border-radius: 2px;
          margin-top: 12px;
        }

        .modal-book-action-btn:hover {
          background-color: var(--accent);
          color: var(--white);
        }
      `}</style>
    </section>
  );
}
