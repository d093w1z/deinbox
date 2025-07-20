'use client';
import React from 'react';
import {useMantineColorScheme, ActionIcon} from '@mantine/core';
import {FaSun, FaMoon} from 'react-icons/fa';
import {FaGear} from 'react-icons/fa6';

export type ColorScheme = 'light' | 'dark' | 'auto';

let currentScheme: ColorScheme = 'auto'; // Default value

export function toggleColorScheme(): ColorScheme {
  const next: Record<ColorScheme, ColorScheme> = {
    auto: 'light',
    light: 'dark',
    dark: 'auto',
  };

  currentScheme = next[currentScheme];
  return currentScheme;
}

export function ThemeToggle() {
  const {setColorScheme, colorScheme} = useMantineColorScheme({
    keepTransitions: true,
  });
  return (
    <ActionIcon
      variant='outline'
      onClick={() => setColorScheme(toggleColorScheme())}
      title='Toggle color scheme'
    >
      {colorScheme === 'dark' ? (
        <FaGear style={{width: 18, height: 18}} />
      ) : colorScheme === 'light' ? (
        <FaMoon style={{width: 18, height: 18}} />
      ) : (
        <FaSun style={{width: 18, height: 18}} />
      )}
    </ActionIcon>
  );
}
