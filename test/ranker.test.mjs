// The app's own fixture (MoonboundTests/Planner/BestTonightRankerTests.swift): the picks for
// Rome, 9 October to 8 November 2026, night by night.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankings, wholeNight, rankingLookingAhead, emptyReason } from '../src/planner.js'
import { zoned, addDays } from '../src/zone.js'
import catalog from '../src/catalog.js'

const rome = { latitude: 41.9, longitude: 12.5, timeZone: 'Europe/Rome' }

const expected = {
  '2026-10-09': [], '2026-10-10': [], '2026-10-11': [], '2026-10-12': [], '2026-10-13': [],
  '2026-10-14': [4, 5, 27, 34], '2026-10-15': [6, 27], '2026-10-16': [20, 3, 30, 6, 35, 40],
  '2026-10-17': [2, 30, 39, 35], '2026-10-18': [28, 24, 29, 31, 9, 38], '2026-10-19': [25, 16, 24, 32, 21, 1],
  '2026-10-20': [15, 16, 1, 7, 36, 37], '2026-10-21': [11, 26, 8, 18], '2026-10-22': [17, 33, 18, 15, 25, 3],
  '2026-10-23': [33, 10, 15, 25, 3, 2], '2026-10-24': [22, 15, 25, 3, 2, 26], '2026-10-25': [15, 25, 3, 2, 26, 17],
  '2026-10-26': [12, 15, 25, 26, 17, 2], '2026-10-27': [4, 19, 23, 5, 34, 15], '2026-10-28': [27, 15, 25, 26, 17, 21],
  '2026-10-29': [20, 3, 6, 30, 40, 35], '2026-10-30': [2, 30, 39, 35], '2026-10-31': [28, 24, 29, 31, 9, 38],
  '2026-11-01': [24, 25, 32, 21], '2026-11-02': [15, 16, 1, 7, 37, 36], '2026-11-03': [11, 26, 8],
  '2026-11-04': [8, 26, 17, 18], '2026-11-05': [33, 10], '2026-11-06': [22], '2026-11-07': [], '2026-11-08': []
}

test('matches the app month night by night in Rome', () => {
  const start = zoned(2026, 10, 9, 12, 0, 0, rome.timeZone)
  const nights = Array.from({ length: 31 }, (_, i) => wholeNight(addDays(start, i, rome.timeZone).getTime(), rome))
  const keys = Object.keys(expected)
  rankings(catalog, nights).forEach((ranking, i) => {
    assert.deepEqual(ranking.picks.map((p) => p.feature.id), expected[keys[i]], keys[i])
  })
})

test('empty nights say why', () => {
  for (const [day, reason] of [[10, 'upOnlyInDaylight'], [12, 'upOnlyInDaylight'], [13, 'tooLow']]) {
    const night = wholeNight(zoned(2026, 10, day, 12, 0, 0, rome.timeZone).getTime(), rome)
    assert.equal(emptyReason(rankings(catalog, [night])[0]), reason, `day ${day}`)
  }
})

test('looking ahead finds a spell and ranks it', () => {
  const ranking = rankingLookingAhead(catalog, zoned(2026, 10, 19, 14, 0, 0, rome.timeZone).getTime(), rome)
  assert.ok(ranking.night.window)
  assert.ok(ranking.picks.length > 0)
})
