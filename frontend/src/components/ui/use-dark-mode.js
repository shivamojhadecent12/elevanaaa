import React from 'react';
import useDarkMode from '../hooks/use-dark-mode';
import { FaSun, FaMoon } from 'react-icons/fa';
import { Button } from './ui/button';

const ThemeToggle = () => {
  const [isDarkMode, toggleDarkMode] = useDarkMode();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleDarkMode}
      aria-label="Toggle dark mode"
      className="text-gray-400 hover:text-white dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors duration-300"
    >
      {isDarkMode ? (
        <FaSun className="h-5 w-5" />
      ) : (
        <FaMoon className="h-5 w-5" />
      )}
    </Button>
  );
};

export default ThemeToggle;
