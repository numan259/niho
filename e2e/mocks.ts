import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fixture = (name: string) => JSON.parse(readFileSync(join('src', 'test', 'fixtures', 'tmdb', `${name}.json`), 'utf8'))

const trending = fixture('trending')
const movieDetail = fixture('movie-detail')
const tvDetail = fixture('tv-detail')
const season = fixture('season')

// 1×1 transparent PNG for every TMDB image.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

/**
 * Stand-in for YouTube's IFrame API. It renders a plain iframe tagged with the
 * requested video id + start time, and reports the playback position from
 * window.__ytTime so tests can drive progress tracking.
 */
const YT_STUB = `
window.YT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
  Player: function (el, opts) {
    var self = this;
    var frame = document.createElement('iframe');
    frame.src = (opts.host || '') + '/embed/' + opts.videoId;
    frame.setAttribute('data-video-id', opts.videoId);
    frame.setAttribute('data-start', String((opts.playerVars || {}).start || 0));
    el.replaceWith(frame);
    this.playVideo = function () {};
    this.pauseVideo = function () {};
    this.destroy = function () { frame.remove(); };
    this.getDuration = function () { return 150; };
    this.getCurrentTime = function () { return window.__ytTime || 0; };
    setTimeout(function () { opts.events && opts.events.onReady && opts.events.onReady({ target: self, data: -1 }); }, 0);
  },
};
if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
`

export async function mockServices(page: Page) {
  await page.route('https://api.themoviedb.org/3/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/3/, '')
    let body: unknown = trending // lists, search, recommendations
    if (/^\/movie\/\d+$/.test(path)) body = movieDetail
    else if (/^\/tv\/\d+$/.test(path)) body = tvDetail
    else if (/^\/tv\/\d+\/season\/\d+$/.test(path)) body = season
    else if (/\/videos$/.test(path)) body = { results: [] } // no episode clips → falls back to the show trailer
    return route.fulfill({ json: body })
  })
  await page.route('https://image.tmdb.org/**', (route) => route.fulfill({ contentType: 'image/png', body: PNG }))
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ contentType: 'text/javascript', body: YT_STUB }))
  await page.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>trailer</title>' }),
  )
}

export const PROFILE_STATE = JSON.stringify({
  state: { profiles: [{ id: 'me', name: 'Me', color: '#f2b64c', kids: false }], activeId: 'me' },
  version: 1,
})

export async function asProfile(page: Page) {
  await page.addInitScript((state) => {
    if (!localStorage.getItem('niho.profiles')) localStorage.setItem('niho.profiles', state)
  }, PROFILE_STATE)
}
