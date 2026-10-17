import { describe, expect, it } from 'vitest'
import { classifyLicense } from './license'

describe('classifyLicense', () => {
  it.each([
    ['http://creativecommons.org/licenses/publicdomain/', 'public-domain', 'Public domain'],
    ['http://creativecommons.org/publicdomain/mark/1.0/', 'public-domain', 'Public domain'],
    ['https://creativecommons.org/publicdomain/zero/1.0/', 'public-domain', 'Public domain'],
    ['http://creativecommons.org/licenses/by/3.0/', 'cc-by', 'CC BY 3.0'],
    ['http://creativecommons.org/licenses/by/3.0/us/', 'cc-by', 'CC BY 3.0'],
    ['http://creativecommons.org/licenses/by-sa/4.0/', 'cc-by-sa', 'CC BY-SA 4.0'],
    ['http://creativecommons.org/licenses/by-nc-nd/2.5/', 'cc-other', 'CC BY-NC-ND 2.5'],
  ])('accepts %s', (url, kind, label) => {
    expect(classifyLicense(url)).toEqual({ url, kind, label })
  })

  it.each([undefined, null, '', 'all rights reserved', 'https://example.com/licenses/by/3.0/', 'http://creativecommons.org/'])(
    'rejects %s',
    (url) => {
      expect(classifyLicense(url)).toBeNull()
    },
  )
})
