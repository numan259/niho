import { fileUrl, itemPageUrl, posterUrl } from './archive'
import type { License, TitleDetail } from './types'

/**
 * Blender Foundation open movies (Creative Commons Attribution).
 * HLS streams demonstrate adaptive bitrate; Archive MP4s are the fallback.
 */
const CC_BY_3: License = { url: 'https://creativecommons.org/licenses/by/3.0/', kind: 'cc-by', label: 'CC BY 3.0' }
const CREDIT = '© Blender Foundation | www.blender.org'

function open(t: Omit<TitleDetail, 'key' | 'provider' | 'kind' | 'license' | 'credit' | 'poster'> & { archiveId: string }): TitleDetail {
  const { archiveId, ...rest } = t
  return {
    ...rest,
    key: `open/${t.id}`,
    provider: 'open',
    kind: 'movie',
    poster: posterUrl(archiveId),
    license: CC_BY_3,
    credit: CREDIT,
  }
}

export const OPEN_MOVIES: TitleDetail[] = [
  open({
    id: 'big-buck-bunny',
    archiveId: 'BigBuckBunny_124',
    name: 'Big Buck Bunny',
    year: 2008,
    tags: ['Animation', 'Comedy', 'Family'],
    synopsis:
      'A giant, gentle rabbit just wants to enjoy a sunny day in the meadow — until three bullying rodents push him a little too far.',
    backdrop: fileUrl('BigBuckBunny_124', 'BigBuckBunny_124.thumbs/Content/big_buck_bunny_720p_surround_000105.jpg'),
    sourcePage: itemPageUrl('BigBuckBunny_124'),
    episodes: [
      {
        index: 0,
        name: 'Big Buck Bunny',
        durationSec: 596,
        sources: [
          { url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type: 'hls', quality: 'Auto' },
          { url: fileUrl('BigBuckBunny_124', 'Content/big_buck_bunny_720p_surround.mp4'), type: 'mp4', quality: '720p' },
        ],
      },
    ],
  }),
  open({
    id: 'tears-of-steel',
    archiveId: 'Tears-of-Steel',
    name: 'Tears of Steel',
    year: 2012,
    tags: ['Sci-fi', 'Action', 'Short'],
    synopsis:
      'In a future Amsterdam overrun by robots, a group of scientists stages a last-ditch attempt to rewrite one painful memory.',
    backdrop: fileUrl('Tears-of-Steel', 'Tears-of-Steel.thumbs/tears_of_steel_1080p_000080.jpg'),
    sourcePage: itemPageUrl('Tears-of-Steel'),
    episodes: [
      {
        index: 0,
        name: 'Tears of Steel',
        durationSec: 734,
        sources: [
          {
            url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
            type: 'hls',
            quality: 'Auto',
          },
          { url: fileUrl('Tears-of-Steel', 'tears_of_steel_720p.mp4'), type: 'mp4', quality: '720p' },
          { url: fileUrl('Tears-of-Steel', 'tears_of_steel_1080p.mp4'), type: 'mp4', quality: '1080p' },
        ],
      },
    ],
  }),
  open({
    id: 'sintel',
    archiveId: 'Sintel',
    name: 'Sintel',
    year: 2010,
    tags: ['Fantasy', 'Adventure', 'Animation'],
    synopsis:
      'A lonely young woman searches snow-covered lands for the baby dragon she once rescued — and discovers what the journey has cost her.',
    backdrop: fileUrl('Sintel', 'Sintel.thumbs/sintel-2048-stereo_000090.jpg'),
    sourcePage: itemPageUrl('Sintel'),
    episodes: [
      {
        index: 0,
        name: 'Sintel',
        durationSec: 888,
        sources: [
          { url: fileUrl('Sintel', 'sintel-2048-stereo.mp4'), type: 'mp4', quality: 'Original' },
          { url: fileUrl('Sintel', 'sintel-2048-stereo_512kb.mp4'), type: 'mp4', quality: 'Low' },
        ],
      },
    ],
  }),
  open({
    id: 'elephants-dream',
    archiveId: 'ElephantsDream',
    name: 'Elephants Dream',
    year: 2006,
    tags: ['Sci-fi', 'Surreal', 'Animation'],
    synopsis:
      'Two men wander a vast, impossible machine. One sees wonders everywhere; the other insists none of it is real.',
    backdrop: fileUrl('ElephantsDream', 'ElephantsDream.thumbs/ed_1024_000090.jpg'),
    sourcePage: itemPageUrl('ElephantsDream'),
    episodes: [
      {
        index: 0,
        name: 'Elephants Dream',
        durationSec: 654,
        sources: [
          { url: fileUrl('ElephantsDream', 'ed_hd.mp4'), type: 'mp4', quality: 'HD' },
          { url: fileUrl('ElephantsDream', 'ed_1024.mp4'), type: 'mp4', quality: 'SD' },
        ],
      },
    ],
  }),
]

export function getOpenMovie(id: string): TitleDetail | null {
  return OPEN_MOVIES.find((m) => m.id === id) ?? null
}
