export interface Achievement {
  id: string;
  title: string;
  description: string;
  symbol: string; // Cooler short text/symbol
  color: string;
  requirement: (stats: any) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_commit',
    title: 'First Contact',
    description: 'Make your first commit recorded in the app.',
    symbol: 'INIT',
    color: '#f1e05a',
    requirement: (stats) => (stats?.total || 0) > 0,
  },
  {
    id: 'streak_3',
    title: 'Consistent',
    description: 'Maintain a 3-day commit streak.',
    symbol: 'STK3',
    color: '#3fb950',
    requirement: (stats) => (stats?.streak || 0) >= 3,
  },
  {
    id: 'streak_7',
    title: 'Weekly Warrior',
    description: 'Maintain a 7-day commit streak.',
    symbol: 'STK7',
    color: '#238636',
    requirement: (stats) => (stats?.streak || 0) >= 7,
  },
  {
    id: 'century',
    title: 'Century Club',
    description: 'Reach 100 total contributions this year.',
    symbol: '100C',
    color: '#bc8cff',
    requirement: (stats) => (stats?.total || 0) >= 100,
  },
  {
    id: 'workhorse',
    title: 'Workhorse',
    description: 'Over 10 commits in a single day.',
    symbol: 'WRKH',
    color: '#ff7b72',
    requirement: (stats) => (stats?.day || 0) >= 10,
  },
];

