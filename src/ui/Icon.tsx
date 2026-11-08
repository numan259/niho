const PATHS = {
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  play: 'M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  plus: 'M12 4v16M4 12h16',
  check: 'M4.5 12.5l5 5 10-11',
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
  clips: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 6v6l5-3z',
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm4.75 11.25L20 20',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8a7.5 7.5 0 0 1 15 0',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 5l7 7-7 7',
  share: 'M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
  thumb:
    'M7 10v10H4V10zm0 0 4-7c1.5 0 2.5 1.2 2.2 2.7L12.6 9H18a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 16.8 20H7',
  volume: 'M4 9v6h4l5 4V5L8 9zm12.5-1.5a6 6 0 0 1 0 9M15 10a2.5 2.5 0 0 1 0 4',
  mute: 'M4 9v6h4l5 4V5L8 9zm12 0 5 6m0-6-5 6',
  audio: 'M4 10v4h3l5 4V6l-5 4zm12.5-1.5a5 5 0 0 1 0 7M15 10.5a2 2 0 0 1 0 3',
  captions: 'M4 6h16v12H4zM7 10h4M13 10h4M7 14h3M12 14h5',
  lock: 'M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3M12 14v3',
  episodes: 'M4 4h16v12H4zM7 20h13M9 8v5l5-2.5z',
  fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  exitFullscreen: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
  rewind: 'M11 7 6 12l5 5M18 7l-5 5 5 5',
  forward: 'M13 7l5 5-5 5M6 7l5 5-5 5',
  next: 'M5 5v14l10-7zM16 5h3v14h-3z',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.1.1-1.4-.1-1.4 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.4-1.4L14.2 2h-4l-.4 2.7a7.6 7.6 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.6L5 12l.1 1.4-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.4 1.4l.4 2.7h4l.4-2.7a7.6 7.6 0 0 0 2.4-1.4l2.4 1 2-3.4z',
  edit: 'M4 20h4L19 9l-4-4L4 16zm9-13 4 4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9h.01',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 24, filled = false, className }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  const solid = filled || name === 'play' || name === 'pause' || name === 'next'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
