import { useState, useEffect } from 'react';

interface NavbarProps {
  activePage: string;
  setActivePage: (page: string) => void;
}

export default function Navbar({ activePage, setActivePage }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'home', label: 'Ana Sayfa' },
    { id: 'rooms', label: 'Odalarımız' },
    { id: 'restaurant', label: 'Snack Restaurant' },
    { id: 'gallery', label: 'Galeri' },
    { id: 'about', label: 'Hakkımızda' },
    { id: 'contact', label: 'İletişim' }
  ];

  const handleNavClick = (id: string) => {
    setActivePage(id);
    setMobileMenuOpen(false);
    
    // Smooth scroll to top or specific section if applicable
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className={`navbar-header ${scrolled ? 'navbar-scrolled' : 'navbar-transparent'}`}>
        <div className="navbar-container">
          <div className="navbar-logo" onClick={() => handleNavClick('home')}>
            <img src="/assets/montana/logo.png" alt="Montana 2543 Logo" className="logo-img" />
          </div>

          <nav className="navbar-desktop-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`nav-link-btn ${activePage === item.id ? 'active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="navbar-actions">
            <button className="nav-book-btn" onClick={() => handleNavClick('contact')}>
              Rezervasyon Yap
            </button>
            
            <button 
              className={`mobile-toggle-btn ${mobileMenuOpen ? 'open' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Overlay Menu */}
      <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-content">
          <div className="mobile-nav-logo">
            <img src="/assets/montana/logo.png" alt="Montana 2543 Logo" className="logo-img mobile-logo-img" />
          </div>
          <div className="mobile-links-container">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`mobile-link-btn ${activePage === item.id ? 'active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button 
            className="mobile-book-action-btn"
            onClick={() => handleNavClick('contact')}
          >
            Rezervasyon Yap
          </button>
        </div>
      </div>

      <style>{`
        .navbar-header {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 1000;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          padding: 24px 0;
        }

        .navbar-scrolled {
          background-color: rgba(248, 246, 242, 0.95);
          backdrop-filter: blur(10px);
          padding: 16px 0;
          box-shadow: var(--shadow-sm);
          border-bottom: 1px solid var(--border);
        }

        .navbar-transparent {
          background-color: transparent;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .navbar-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .navbar-logo {
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        .logo-img {
          height: 44px;
          width: auto;
          object-fit: contain;
          display: block;
          transition: all 0.3s ease;
          filter: none;
        }

        .navbar-scrolled .logo-img {
          height: 38px;
        }

        .mobile-logo-img {
          height: 60px;
          margin: 0 auto;
        }

        .navbar-desktop-nav {
          display: flex;
          gap: 32px;
        }

        @media (max-width: 991px) {
          .navbar-desktop-nav {
            display: none;
          }
        }

        .nav-link-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 8px 0;
          position: relative;
        }

        .navbar-scrolled .nav-link-btn {
          color: var(--text);
        }

        .nav-link-btn::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 1px;
          background-color: var(--accent);
          transition: width 0.3s ease;
        }

        .nav-link-btn:hover {
          color: var(--white);
        }

        .navbar-scrolled .nav-link-btn:hover {
          color: var(--primary);
        }

        .nav-link-btn:hover::after,
        .nav-link-btn.active::after {
          width: 100%;
        }

        .nav-link-btn.active {
          color: var(--accent);
        }

        .navbar-scrolled .nav-link-btn.active {
          color: var(--accent);
        }

        .navbar-actions {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .nav-book-btn {
          background-color: var(--accent);
          color: var(--white);
          border: none;
          padding: 10px 24px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: var(--shadow-sm);
        }

        .nav-book-btn:hover {
          background-color: var(--primary);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        @media (max-width: 576px) {
          .nav-book-btn {
            display: none;
          }
        }

        /* Mobile Toggle Button */
        .mobile-toggle-btn {
          display: none;
          flex-direction: column;
          justify-content: space-between;
          width: 20px;
          height: 14px;
          background: none;
          border: none;
          cursor: pointer;
          z-index: 1100;
        }

        @media (max-width: 991px) {
          .mobile-toggle-btn {
            display: flex;
          }
        }

        .mobile-toggle-btn span {
          width: 100%;
          height: 2px;
          background-color: var(--white);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .navbar-scrolled .mobile-toggle-btn span {
          background-color: var(--primary);
        }

        .mobile-toggle-btn.open span {
          background-color: var(--white) !important;
        }

        .mobile-toggle-btn.open span:nth-child(1) {
          transform: translateY(6px) rotate(45deg);
        }

        .mobile-toggle-btn.open span:nth-child(2) {
          opacity: 0;
        }

        .mobile-toggle-btn.open span:nth-child(3) {
          transform: translateY(-6px) rotate(-45deg);
        }

        /* Mobile Menu Overlay */
        .mobile-nav-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background-color: var(--primary);
          z-index: 999;
          transform: translateX(100%);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .mobile-nav-overlay.open {
          transform: translateX(0);
        }

        .mobile-nav-content {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 40px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
        }

        .mobile-nav-logo {
          font-family: var(--font-serif);
          font-size: 2rem;
          font-weight: 500;
          color: var(--white);
          letter-spacing: 2px;
        }

        .mobile-nav-logo span {
          color: var(--accent);
        }

        .mobile-links-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .mobile-link-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-size: 1.15rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 8px 0;
        }

        .mobile-link-btn:hover,
        .mobile-link-btn.active {
          color: var(--accent);
        }

        .mobile-book-action-btn {
          background-color: var(--accent);
          color: var(--white);
          border: none;
          padding: 14px 28px;
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 10px;
        }

        .mobile-book-action-btn:hover {
          background-color: var(--white);
          color: var(--primary);
        }
      `}</style>
    </>
  );
}
