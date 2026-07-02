import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Stats from './components/Stats';
import Rooms from './components/Rooms';
import Restaurant from './components/Restaurant';
import SkiExperience from './components/SkiExperience';
import Gallery from './components/Gallery';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [preselectedRoom, setPreselectedRoom] = useState<string>('');

  const handleBookClick = () => {
    setActivePage('contact');
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleBookRoom = (roomType: string) => {
    setPreselectedRoom(roomType);
    setActivePage('contact');
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePageChange = (pageId: string) => {
    setActivePage(pageId);
    
    // Smooth scroll to section
    setTimeout(() => {
      const section = document.getElementById(pageId);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div className="app-wrapper">
      {/* Sticky Navigation Header */}
      <Navbar activePage={activePage} setActivePage={handlePageChange} />

      {/* Main Sections (Single Page Application Flow) */}
      <main>
        {/* Home Section / Hero intro */}
        <div id="home">
          <Hero onBookClick={handleBookClick} />
        </div>

        {/* Stats Panel */}
        <Stats />

        {/* Rooms showcase */}
        <Rooms onBookRoom={handleBookRoom} />

        {/* Dining */}
        <Restaurant />

        {/* Slopes & Sports */}
        <SkiExperience />

        {/* Image Showcase */}
        <Gallery />

        {/* Story */}
        <About />

        {/* Reservations Form & Map */}
        <Contact 
          preselectedRoom={preselectedRoom} 
          clearPreselectedRoom={() => setPreselectedRoom('')} 
        />
      </main>

      {/* Footer details */}
      <Footer setActivePage={handlePageChange} />

      <style>{`
        .app-wrapper {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          overflow-x: hidden;
          background-color: var(--krem);
        }

        main {
          flex-grow: 1;
        }

        /* Adjust sections to have scroll margin for header spacing */
        section {
          scroll-margin-top: 80px;
        }

        @media (max-width: 768px) {
          section {
            scroll-margin-top: 60px;
          }
        }
      `}</style>
    </div>
  );
}
