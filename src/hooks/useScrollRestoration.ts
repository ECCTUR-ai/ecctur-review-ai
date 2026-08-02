import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useScrollRestoration() {
  const location = useLocation();

  useEffect(() => {
    const key = `scroll_pos_${location.pathname}${location.search}`;
    const savedPos = sessionStorage.getItem(key);

    if (savedPos !== null) {
      window.scrollTo(0, parseInt(savedPos, 10));
    } else {
      window.scrollTo(0, 0);
    }

    const handleScroll = () => {
      sessionStorage.setItem(key, window.scrollY.toString());
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [location.pathname, location.search]);
}
