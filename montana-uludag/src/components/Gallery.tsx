import { useState } from 'react';

export default function Gallery() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const filters = [
    { id: 'all', label: 'TÜMÜ' },
    { id: 'rooms', label: 'ODALARIMIZ' },
    { id: 'restaurant', label: 'RESTAURANT & BAR' },
    { id: 'ski', label: 'KAYAK & DAĞ' },
    { id: 'social', label: 'SOSYAL ALANLAR' }
  ];

  const galleryImages = [
    { url: 'https://images.unsplash.com/photo-1544860707-c37d9c9db80d?q=80&w=600&auto=format&fit=crop', category: 'ski', title: 'Montana 2543 Yamaçları' },
    { url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600&auto=format&fit=crop', category: 'restaurant', title: 'Snack Restaurant Salonu' },
    { url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=600&auto=format&fit=crop', category: 'rooms', title: 'Standart Orman Odası' },
    { url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=600&auto=format&fit=crop', category: 'rooms', title: 'Deluxe Şömineli Süit' },
    { url: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=600&auto=format&fit=crop', category: 'restaurant', title: 'Sıcak İçecek Köşesi' },
    { url: 'https://images.unsplash.com/photo-1551698618-1ffdfe079820?q=80&w=600&auto=format&fit=crop', category: 'ski', title: 'Pist Kayak Keyfi' },
    { url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=600&auto=format&fit=crop', category: 'social', title: 'Açık Ateş Şömine Alanı' },
    { url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=600&auto=format&fit=crop', category: 'rooms', title: 'Loft Süit Asma Kat' },
    { url: 'https://images.unsplash.com/photo-1482862549707-f63cb32c5fd9?q=80&w=600&auto=format&fit=crop', category: 'social', title: 'Lobi Oturma Alanları' }
  ];

  const filteredImages = selectedFilter === 'all' 
    ? galleryImages 
    : galleryImages.filter(img => img.category === selectedFilter);

  return (
    <section id="gallery" className="gallery-section section">
      <div className="container">
        <div className="section-header text-center">
          <span className="subtitle">MONTANA KARELERİ</span>
          <h2 className="heading-md">Fotoğraf Galerisi</h2>
          <p className="header-desc">
            Otelimizin büyüleyici manzaralarını, sıcacık iç mekanlarını ve kış sporlarının coşkusunu fotoğraflarla keşfedin.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="gallery-filters">
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
              className="gallery-item animate-fade-in"
              onClick={() => setLightboxImg(img.url)}
            >
              <div className="gallery-image-wrapper">
                <img src={img.url} alt={img.title} className="gallery-img" />
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
          <span className="lightbox-close">&times;</span>
          <img src={lightboxImg} alt="Enlarged view" className="lightbox-content" />
        </div>
      )}

      <style>{`
        .gallery-section {
          background-color: var(--krem);
        }

        .gallery-filters {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 48px;
        }

        .filter-btn {
          background-color: var(--beyaz);
          color: var(--koyu-gri-light);
          border: 1px solid rgba(91, 30, 40, 0.1);
          padding: 10px 24px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 1px;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: var(--shadow-sm);
        }

        .filter-btn:hover,
        .filter-btn.active {
          background-color: var(--bordo);
          color: var(--beyaz);
          border-color: var(--bordo);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
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
          border-radius: 20px;
          overflow: hidden;
          box-shadow: var(--shadow-md);
          border: 1px solid rgba(91, 30, 40, 0.03);
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
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gallery-item:hover .gallery-img {
          transform: scale(1.08);
        }

        .gallery-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(to top, rgba(91, 30, 40, 0.85) 0%, rgba(91, 30, 40, 0.2) 60%, transparent 100%);
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
          color: var(--beyaz);
          transform: translateY(15px);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .gallery-item:hover .gallery-text {
          transform: translateY(0);
        }

        .gallery-cat {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--ahsap);
          letter-spacing: 1.5px;
          display: block;
          margin-bottom: 4px;
        }

        .gallery-title {
          font-family: var(--serif);
          font-size: 1.15rem;
          font-weight: 600;
        }

        /* Lightbox CSS */
        .lightbox-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(22, 12, 15, 0.95);
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
          border-radius: 16px;
          box-shadow: var(--shadow-xl);
          animation: fadeIn 0.4s ease;
        }

        .lightbox-close {
          position: absolute;
          top: 30px;
          right: 40px;
          color: var(--beyaz);
          font-size: 2.5rem;
          font-weight: 300;
          cursor: pointer;
          transition: transform 0.3s ease;
        }

        .lightbox-close:hover {
          transform: scale(1.2);
        }
      `}</style>
    </section>
  );
}
