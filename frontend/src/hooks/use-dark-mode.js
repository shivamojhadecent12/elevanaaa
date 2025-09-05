import { useState, useEffect } from 'react';

export default function useDarkMode() {
  const [isDarkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check local storage for a previously saved theme preference
    const storedTheme = localStorage.getItem('theme');
    const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialMode = storedTheme === 'dark' || (storedTheme === null && systemPreference);

    if (initialMode) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prevMode => {
      const newMode = !prevMode;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newMode;
    });
  };

  return [isDarkMode, toggleDarkMode];
}
