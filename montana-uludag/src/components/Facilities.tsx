export default function Facilities() {
  const facilityList = [
    {
      title: 'Hızlı WiFi',
      desc: 'Tüm oda ve ortak alanlarda kesintisiz yüksek hızlı internet.',
      icon: (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856a9.75 9.75 0 0113.788 0M1.924 8.674a14.25 14.25 0 0120.152 0M12.53 18.22a1.5 1.5 0 11-1.06 0" />
        </svg>
      )
    },
    {
      title: 'Snack Restaurant',
      desc: 'Lezzetli dağ yemekleri ve zengin kahvaltı seçenekleri.',
      icon: (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21V3m0 18a9 9 0 000-18m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.905 0-5.54-1.033-7.593-2.753m15.686 0a9.005 9.005 0 01-15.686 0" />
        </svg>
      )
    },
    {
      title: 'Lobi Şöminesi',
      desc: 'Şömine ateşinin karşısında, günün yorgunluğunu atabileceğiniz alan.',
      icon: (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
        </svg>
      )
    },
    {
      title: 'Montana Cafe',
      desc: 'Dağ manzaralı terasıyla kahve ve sucuk-ekmek keyfi.',
      icon: (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5m-4.5 2.25h4.5M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      )
    },
    {
      title: 'Kayak Odası',
      desc: 'Pistlere doğrudan bağlanan, güvenli kayak depolama alanı.',
      icon: (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.746 3.746 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
      )
    },
    {
      title: '24 Saat Resepsiyon',
      desc: 'İhtiyaç duyduğunuz her an güler yüzlü ve hızlı hizmet.',
      icon: (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      title: 'Ücretsiz Otopark',
      desc: 'Aracınız için otelimize özel, güvenli ve ücretsiz park alanı.',
      icon: (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124l-.847-13.486c-.035-.557-.497-.99-1.055-.99h-5.07a1.875 1.875 0 00-1.502.748L10.5 7.5H5.25A2.25 2.25 0 003 9.75v5.25" />
        </svg>
      )
    },
    {
      title: 'Geniş Aile Odaları',
      desc: 'Kalabalık gruplar ve aileler için ferah yerleşim planı.',
      icon: (
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      )
    }
  ];

  return (
    <section id="facilities" className="facilities-section section">
      <div className="container">
        <div className="section-header text-center animate-fade-up">
          <span className="subtitle">KONFORUNUZ İÇİN</span>
          <h2 className="heading-md">Montana Ayrıcalıkları</h2>
          <p className="header-desc">
            Uludağ tatilinizi kolaylaştıracak ve keyfe dönüştürecek tüm hizmetleri kapınızın önüne seriyoruz.
          </p>
        </div>

        <div className="facilities-grid">
          {facilityList.map((item, idx) => (
            <div key={idx} className="facility-card animate-fade-up">
              <div className="facility-icon-wrapper">
                {item.icon}
              </div>
              <h4 className="facility-title">{item.title}</h4>
              <p className="facility-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .facilities-section {
          background-color: var(--white);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .facilities-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 40px;
          margin-top: 20px;
        }

        @media (max-width: 991px) {
          .facilities-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 30px;
          }
        }

        @media (max-width: 576px) {
          .facilities-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }

        .facility-card {
          padding: 32px;
          background-color: var(--bg);
          border: 1px solid var(--border);
          border-radius: 2px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .facility-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--shadow-md);
          border-color: var(--accent);
        }

        .facility-icon-wrapper {
          color: var(--accent);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease;
        }

        .facility-card:hover .facility-icon-wrapper {
          transform: scale(1.1);
        }

        .facility-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--primary);
          margin-bottom: 10px;
        }

        .facility-desc {
          font-size: 0.85rem;
          color: var(--secondary);
          line-height: 1.5;
        }
      `}</style>
    </section>
  );
}
