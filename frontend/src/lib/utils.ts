import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ADJECTIVES = [
  'swift', 'calm', 'bold', 'warm', 'cool', 'keen', 'mild', 'vast', 'pure', 'soft',
  'wild', 'dark', 'fair', 'deep', 'pale', 'rare', 'wise', 'fond', 'glad', 'hazy',
  'icy', 'lazy', 'neat', 'rosy', 'tiny', 'cozy', 'grim', 'lush', 'slim', 'snug',
  'brisk', 'crisp', 'dense', 'dusty', 'faint', 'foggy', 'grand', 'harsh', 'jolly',
  'vivid', 'rusty', 'shiny', 'steep', 'stout', 'sunny', 'tidy', 'witty', 'zesty',
];

const NOUNS = [
  'pine', 'wave', 'stone', 'fern', 'cloud', 'brook', 'flame', 'ridge', 'frost', 'bloom',
  'dune', 'peak', 'reef', 'moss', 'glen', 'vale', 'cove', 'marsh', 'cliff', 'grove',
  'creek', 'bluff', 'shoal', 'knoll', 'flint', 'ember', 'spark', 'drift', 'thorn', 'cedar',
  'birch', 'slate', 'coral', 'amber', 'ivory', 'maple', 'aspen', 'delta', 'fjord', 'oasis',
  'prism', 'quartz', 'plume', 'hedge', 'haven', 'crest', 'basin', 'forge', 'vault', 'trail',
];

export function generateTabName(existingNames: Set<string>): string {
  const maxAttempts = 200;
  for (let i = 0; i < maxAttempts; i++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const name = `${adj}-${noun}`;
    if (!existingNames.has(name)) return name;
  }
  // Fallback: append a number
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}-${Date.now() % 1000}`;
}
