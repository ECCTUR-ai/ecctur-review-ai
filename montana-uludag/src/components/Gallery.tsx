import { useState } from 'react';

export default function Gallery() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const filters = [
    { id: 'all', label: 'TÜMÜ' },
    { id: 'rooms', label: 'ODALARIMIZ' },
    { id: 'social', label: 'LOBİ & SOSYAL ALANLAR' },
    { id: 'cafe', label: 'CAFE & RESTAURANT' },
    { id: 'exterior', label: 'DIŞ CEPHE' }
  ];

  const galleryImages = [
    { url: '/assets/montana/montana-exterior-entrance.jpeg', category: 'exterior', title: 'Montana Dış Cephe Giriş', alt: 'Montana 2543 Uludağ otel girişi' },
    { url: '/assets/montana/montana-lobby-fireplace.jpeg', category: 'social', title: 'Lobi Şömine Salonu', alt: 'Montana 2543 Uludağ lobby' },
    { url: '/assets/montana/montana-reception.jpeg', category: 'social', title: 'Resepsiyon Karşılama', alt: 'Montana 2543 Uludağ lobby' },
    { url: '/assets/montana/montana-room-triple.jpeg', category: 'rooms', title: 'Geniş Üç Kişilik Oda', alt: 'Montana 2543 Uludağ oda' },
    { url: '/assets/montana/montana-room-minibar.jpeg', category: 'rooms', title: 'Makyaj Masası & Minibar', alt: 'Montana 2543 Uludağ minibar ve makyaj masası' },
    { url: '/assets/montana/montana-outdoor-cafe.jpeg', category: 'cafe', title: 'Açık Hava Montana Cafe', alt: 'Montana 2543 Uludağ cafe' },
    { url: '/assets/montana/montana-corridor.jpeg', category: 'social', title: 'Sakin Ahşap Koridor', alt: 'Montana 2543 Uludağ koridor' }
  ];

  const filteredImages = selectedFilter === 'all' 
    ? galleryImages 
    : galleryImages.filter(img => img.category === selectedFilter);

  return (
    <section id="gallery" className="gallery-section section">
      <div className="container">
        <div className="section-header text-center animate-fade-up">
          <span className="subtitle">MONTANA DETAYLARI</span>
          <h2 className="heading-md">Fotoğraf Galerisi</h2>
          <p className="header-desc">
            Sıcak iç mekanlarimizi, kış manzaralarımızı ve şömineli dinlenme köşelerimizi fotoğraflarla keşfedin.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="gallery-filters animate-fade-up">
          {filters.map(filter => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`filter-btn ${selectedFilter === filter.id ? 'active' : ''}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Masonry Grid */}
        <div className="gallery-grid">
          {filteredImages.map((img, index) => (
            <div 
              key={index} 
              className="gallery-item animate-fade-up"
              onClick={() => setLightboxImg(img.url)}
            >
              <div className="gallery-image-wrapper">
                <img src={img.url} alt={img.alt} className="gallery-img" loading="lazy" />
                <div className="gallery-overlay">
                  <div className="gallery-text">
                    <span className="gallery-cat">{img.category.toUpperCase()}</span>
                    <h4 className="gallery-title">{img.title}</h4>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div className="lightbox-modal" onClick={() => setLightboxImg(null)}>
          <span className="lightbox-close" onClick={() => setLightboxImg(null)}>&times;</span>
          <img src={lightboxImg} alt="Enlarged view" className="lightbox-content" />
        </div>
      )}

      <style>{`
        .gallery-section {
          background-color: var(--bg);
          border-bottom: 1px solid var(--border);
        }

        .gallery-filters {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 48px;
        }

        .filter-btn {
          background-color: var(--white);
          color: var(--secondary);
          border: 1px solid var(--border);
          padding: 10px 24px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .filter-btn:hover,
        .filter-btn.active {
          background-color: var(--primary);
          color: var(--white);
          border-color: var(--primary);
        }

        /* Gallery Grid Layout */
        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        @media (max-width: 991px) {
          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
        }

        @media (max-width: 576px) {
          .gallery-grid {
            grid-template-columns: 1fr;
          }
        }

        .gallery-item {
          cursor: pointer;
          border-radius: 2px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--border);
          aspect-ratio: 4 / 3;
        }

        .gallery-image-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .gallery-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gallery-item:hover .gallery-img {
          transform: scale(1.04);
        }

        .gallery-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(to top, rgba(30, 30, 30, 0.8) 0%, rgba(30, 30, 30, 0.2) 60%, transparent 100%);
          opacity: 0;
          transition: opacity 0.4s ease;
          display: flex;
          align-items: flex-end;
          padding: 24px;
        }

        .gallery-item:hover .gallery-overlay {
          opacity: 1;
        }

        .gallery-text {
          color: var(--white);
          transform: translateY(15px);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gallery-item:hover .gallery-text {
          transform: translateY(0);
        }

        .gallery-cat {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--accent);
          letter-spacing: 1.5px;
          display: block;
          margin-bottom: 4px;
        }

        .gallery-title {
          font-family: var(--font-serif);
          font-size: 1.1rem;
          font-weight: 500;
        }

        /* Lightbox CSS */
        .lightbox-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(30, 30, 30, 0.95);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .lightbox-content {
          max-width: 90%;
          max-height: 80%;
          object-fit: contain;
          border-radius: 2px;
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border);
        }

        .lightbox-close {
          position: absolute;
          top: 30px;
          right: 40px;
          color: var(--white);
          font-size: 2.5rem;
          font-weight: 300;
          cursor: pointer;
          transition: transform 0.3s ease;
        }

        .lightbox-close:hover {
          transform: scale(1.1);
        }
      `}</style>
    </section>
  );
}
