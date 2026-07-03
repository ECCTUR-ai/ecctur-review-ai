export default function Reviews() {
  const testimonials = [
    {
      name: 'Buse T.',
      role: 'Aile Konaklaması',
      comment: 'İskandinav sıcaklığındaki odaları ve şömineli lobisiyle kendimizi evimizde hissettik. Çocuklarla geçirdiğimiz en huzurlu kış tatiliydi.',
      rating: 5
    },
    {
      name: 'Caner K.',
      role: 'Günübirlik Ziyaretçi',
      comment: 'Pist dönüşünde Montana Cafe terasında yediğimiz sucuk ekmek ve taze salep harikaydı. Acenta grubumuzla çok keyifli vakit geçirdik.',
      rating: 5
    },
    {
      name: 'Merve A.',
      role: 'Standart Oda Konuğu',
      comment: 'Odaların meşe kaplamaları, sade tasarımı ve temizliği mükemmeldi. Zirve manzarasının ve sessizliğin tadını çıkardık.',
      rating: 5
    }
  ];

  return (
    <section id="reviews" className="reviews-section section">
      <div className="container">
        <div className="section-header text-center animate-fade-up">
          <span className="subtitle">MİSAFİR YORUMLARI</span>
          <h2 className="heading-md">Montana Deneyimleri</h2>
          <p className="header-desc">
            Sıcak atmosferimiz ve samimi hizmet kalitemiz hakkında konuklarımızın paylaştığı yorumlar.
          </p>
        </div>

        <div className="reviews-grid">
          {testimonials.map((t, idx) => (
            <div key={idx} className="review-card animate-fade-up">
              <div className="stars">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <span key={i} className="star-icon">★</span>
                ))}
              </div>
              <p className="review-comment">"{t.comment}"</p>
              <div className="review-author">
                <h5 className="author-name">{t.name}</h5>
                <span className="author-role">{t.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .reviews-section {
          background-color: var(--bg);
          border-bottom: 1px solid var(--border);
        }

        .reviews-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          margin-top: 20px;
        }

        @media (max-width: 991px) {
          .reviews-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }

        .review-card {
          background-color: var(--white);
          padding: 40px;
          border-radius: 2px;
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 20px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .review-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--shadow-md);
          border-color: var(--accent);
        }

        .stars {
          color: var(--accent);
          font-size: 1.1rem;
          display: flex;
          gap: 4px;
        }

        .review-comment {
          font-size: 0.95rem;
          color: var(--text);
          line-height: 1.7;
          font-style: italic;
          flex-grow: 1;
        }

        .review-author {
          display: flex;
          flex-direction: column;
          gap: 2px;
          border-top: 1px solid var(--border);
          padding-top: 16px;
        }

        .author-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--primary);
        }

        .author-role {
          font-size: 0.75rem;
          color: var(--secondary);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
      `}</style>
    </section>
  );
}
