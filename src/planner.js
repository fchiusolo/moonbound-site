// The app's Today and Upcoming planner, ported line for line from Moonbound's Planner folder
// (ObservingNight.swift, MoonPass.swift, BestTonightRanker.swift, DayMoonEvents.swift), so the
// website picks the same sights for the same night and place.
import { moonAltitude, sunAltitude, lunarState, MOON_RISE_SET_ALTITUDE } from './sky.js'
import { startOfDay, atHour, addDays, hour } from './zone.js'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// ObservingNight
const MINIMUM_MOON_ALTITUDE = 5
const DARK_SKY_SUN_ALTITUDE = -6
const LUNAR_PARALLAX = 0.95
const STEP = 10 * MINUTE
const LOOK_AHEAD_DAYS = 7

// BestTonightRanker
export const MAXIMUM_PICKS = 6
const LIBRATION_LEAD_NIGHTS = 3
const LIBRATION_RUN_REACH = 10
const LIBRATION_MINIMUM_GAIN = 5
const LIBRATION_MINIMUM_LONGITUDE = 3
const LIBRATION_MAXIMUM_SUN_ALTITUDE = 45
const TERMINATOR_WINDOW = 15
const NEAR_FULL_ILLUMINATION = 0.85
const HIGH_SUN_MINIMUM_ALTITUDE = 30
const TERMINATOR_SWEET_SPOT = 6
const DIFFICULTIES = ['binoculars', 'smallTelescope', 'largerTelescope']

/** The Moon's altitude as the planner judges it, corrected for parallax. */
function plannerMoonAltitude (time, place) {
  return moonAltitude(time, place) - LUNAR_PARALLAX
}

/** `start`, then every 10 minutes on the clock before `end`. */
function samples (start, end) {
  const first = Math.ceil(start / STEP) * STEP
  const grid = []
  for (let t = first; t < end; t += STEP) grid.push(t)
  return grid[0] === start ? grid : [start, ...grid]
}

function scan (start, end, place, stopsAfterFirstWindow) {
  let best = null
  let bestWindow = null
  let windowStart = null
  let risesAt = null
  let highestDarkAltitude = null
  let previousAltitude = null
  for (const instant of samples(start, end)) {
    const moon = plannerMoonAltitude(instant, place)
    const sun = sunAltitude(instant, place)
    if (previousAltitude !== null && previousAltitude < 0 && moon >= 0 && risesAt === null) risesAt = instant
    previousAltitude = moon

    const isDark = sun < DARK_SKY_SUN_ALTITUDE
    if (isDark) highestDarkAltitude = Math.max(highestDarkAltitude ?? -Infinity, moon)
    if (!(isDark && moon > MINIMUM_MOON_ALTITUDE)) {
      if (windowStart !== null && stopsAfterFirstWindow) break
      windowStart = null
      continue
    }

    const spellStart = windowStart ?? instant
    windowStart = spellStart
    if (moon > (best ? best.altitude : -Infinity)) {
      best = { date: instant, altitude: moon }
      bestWindow = { start: spellStart, end: instant }
    } else if (bestWindow && bestWindow.start === spellStart) {
      bestWindow = { start: spellStart, end: instant }
    }
  }

  if (!best) return { start, moment: { up: false, risesAt, highestDarkAltitude }, window: null }
  return { start, moment: { up: true, date: best.date, moonAltitude: best.altitude, state: lunarState(best.date) }, window: bestWindow }
}

/** One calendar day as Upcoming lists it (`ObservingNight(day:location:calendar:)`). */
export function dayNight (date, place) {
  const tz = place.timeZone
  const midnight = startOfDay(date, tz).getTime()
  const rise = dayMoonEvents(midnight, place).find((event) => event.kind === 'rise')
  const pass = moonPass(rise ? rise.date : midnight, place)
  const span = pass ? { start: pass.rise, end: pass.set } : { start: midnight, end: addDays(new Date(midnight), 1, tz).getTime() }
  const night = scan(span.start, span.end, place, false)
  if (!night.moment.up && night.moment.highestDarkAltitude === null) {
    const nextMidnight = addDays(new Date(midnight), 1, tz).getTime()
    const skyGetsDark = samples(midnight, nextMidnight).some((t) => sunAltitude(t, place) < DARK_SKY_SUN_ALTITUDE)
    return { start: midnight, moment: { up: false, risesAt: night.moment.risesAt, highestDarkAltitude: skyGetsDark ? -90 : null }, window: null }
  }
  return { start: midnight, moment: night.moment, window: night.window }
}

/** From `now` up to the end of the next spell when the Moon can be seen (`lookingAheadFrom`). */
export function lookAheadNight (now, place) {
  return scan(now, now + LOOK_AHEAD_DAYS * DAY, place, true)
}

/** The moment Today-style screens centre on (`ObservingNight.focusDate`). */
function focusDate (night) {
  if (night.moment.up) return night.moment.date
  return lunarState(night.start).isWaxing ? night.start : night.moment.risesAt ?? night.start
}

// Moon events (DayMoonEvents, MoonBoundaryEventFinder): rise and set where the Moon crosses
// SwiftAA's rise-set altitude, culmination at its highest, found by sampling and refining.

const EVENT_STEP = 5 * MINUTE

function moonEvents (from, to, place) {
  const first = Math.floor(from / EVENT_STEP) * EVENT_STEP
  const points = []
  for (let t = first; t <= to + EVENT_STEP; t += EVENT_STEP) points.push({ t, a: moonAltitude(t, place) })
  const events = []
  const h = MOON_RISE_SET_ALTITUDE
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a.a < h && b.a >= h) events.push({ kind: 'rise', date: bisect(a, b, place) })
    else if (a.a >= h && b.a < h) events.push({ kind: 'set', date: bisect(a, b, place) })
  }
  for (let i = 1; i < points.length - 1; i++) {
    const [p, q, r] = [points[i - 1], points[i], points[i + 1]]
    if (q.a > p.a && q.a > r.a) {
      const denominator = p.a - 2 * q.a + r.a
      const offset = denominator === 0 ? 0 : 0.5 * (p.a - r.a) / denominator * EVENT_STEP
      events.push({ kind: 'culmination', date: Math.round(q.t + offset) })
    }
  }
  return events.filter((e) => e.date >= from && e.date < to).sort((x, y) => x.date - y.date)
}

function bisect (a, b, place) {
  let lo = a
  let hi = b
  const loBelow = lo.a < MOON_RISE_SET_ALTITUDE
  for (let i = 0; i < 12; i++) {
    const t = Math.round((lo.t + hi.t) / 2)
    const point = { t, a: moonAltitude(t, place) }
    if ((point.a < MOON_RISE_SET_ALTITUDE) === loBelow) lo = point
    else hi = point
  }
  return Math.round((lo.t + hi.t) / 2)
}

/** The Moon's rise, culmination and set within the local calendar day starting at `midnight`. */
function dayMoonEvents (midnight, place) {
  const end = addDays(new Date(midnight), 1, place.timeZone).getTime()
  return moonEvents(midnight, end, place)
}

/** The pass the Moon is in at `date`, or the next one (`MoonPass(around:at:)`). */
export function moonPass (date, place) {
  const tz = place.timeZone
  const day = startOfDay(new Date(date), tz)
  const events = moonEvents(addDays(day, -1, tz).getTime(), addDays(day, 3, tz).getTime(), place)
  const horizon = events.filter((e) => e.kind !== 'culmination')
  const lastBefore = horizon.filter((e) => e.date <= date).pop()
  const isUp = lastBefore && lastBefore.kind === 'rise'
  const rise = isUp
    ? events.filter((e) => e.kind === 'rise' && e.date <= date).pop()
    : events.find((e) => e.kind === 'rise' && e.date > date)
  if (!rise) return null
  const set = events.find((e) => e.kind === 'set' && e.date > rise.date)
  if (!set) return null
  const culmination = events.find((e) => e.kind === 'culmination' && e.date > rise.date && e.date < set.date)
  if (!culmination) return null
  return { rise: rise.date, culmination: culmination.date, set: set.date }
}

// BestTonightRanker

function positiveRemainder (degrees) {
  const remainder = degrees % 360
  return remainder < 0 ? remainder + 360 : remainder
}

/** Why a feature makes a night's list, or null (`BestTonightRanker.reason(for:state:)`). */
export function reason (feature, state) {
  const sunAltitude = state.sunAltitude(feature.latitude, feature.longitude)
  const earthAngle = state.earthAngle(feature.latitude, feature.longitude)
  if (earthAngle > 90) return null

  if (feature.isLimbFeature) {
    const meanEarthAngle = Math.acos(Math.cos(feature.latitude * Math.PI / 180) * Math.cos(feature.longitude * Math.PI / 180)) * 180 / Math.PI
    const gain = meanEarthAngle - earthAngle
    const wobbleTowardFeature = (feature.longitude < 0 ? -1 : 1) * state.librationLongitude
    if (gain >= LIBRATION_MINIMUM_GAIN && wobbleTowardFeature >= LIBRATION_MINIMUM_LONGITUDE &&
        sunAltitude > 0 && sunAltitude <= LIBRATION_MAXIMUM_SUN_ALTITUDE) {
      return { kind: 'libration', gain }
    }
    return null
  }

  const afterSunrise = positiveRemainder(state.colongitude - feature.sunriseColongitude)
  const beforeSunset = positiveRemainder(feature.sunsetColongitude - state.colongitude)
  if (sunAltitude <= 0 && !(afterSunrise < TERMINATOR_WINDOW)) return null
  if (afterSunrise <= TERMINATOR_WINDOW) return { kind: 'terminator', isSunrise: true, distance: afterSunrise }
  if (beforeSunset <= TERMINATOR_WINDOW) return { kind: 'terminator', isSunrise: false, distance: beforeSunset }
  const showsUnderHighSun = feature.isRaySystem || feature.isBestAtFullMoon
  if (state.illuminatedFraction >= NEAR_FULL_ILLUMINATION && showsUnderHighSun && sunAltitude >= HIGH_SUN_MINIMUM_ALTITUDE) {
    return { kind: 'illumination', sunAltitude }
  }
  return null
}

function sortKey (pick) {
  const r = pick.reason
  const [tier, placement] = r.kind === 'libration'
    ? [0, -r.gain]
    : r.kind === 'terminator' ? [1, Math.abs(r.distance - TERMINATOR_SWEET_SPOT)] : [2, -r.sunAltitude]
  return [tier, -pick.feature.showpieceScore, DIFFICULTIES.indexOf(pick.feature.difficulty), placement]
}

function compareKeys (a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

function sortedPicks (catalog, night) {
  if (!night.moment.up) return []
  const state = night.moment.state
  return catalog
    .map((feature) => ({ feature, reason: reason(feature, state) }))
    .filter((pick) => pick.reason)
    .map((pick) => ({ pick, key: sortKey(pick) }))
    .sort((x, y) => compareKeys(x.key, y.key))
    .map(({ pick }) => pick)
}

/** Rankings for consecutive nights, with limb features demoted off their best libration nights. */
export function rankings (catalog, nights) {
  const lists = nights.map((night) => sortedPicks(catalog, night))
  for (const feature of catalog.filter((f) => f.isLimbFeature)) {
    let run = []
    for (let index = 0; index <= lists.length; index++) {
      if (index < lists.length) {
        const pick = lists[index].find((p) => p.feature === feature)
        if (pick && pick.reason.kind === 'libration') {
          run.push({ gain: pick.reason.gain, night: index })
          continue
        }
      }
      const demoted = run.slice().sort((a, b) => b.gain - a.gain).slice(LIBRATION_LEAD_NIGHTS)
      for (const { night } of demoted) {
        const position = lists[night].findIndex((p) => p.feature === feature)
        lists[night].push(lists[night].splice(position, 1)[0])
      }
      run = []
    }
  }
  return nights.map((night, i) => ({ night, picks: lists[i].slice(0, MAXIMUM_PICKS), qualifyingCount: lists[i].length }))
}

function dayNights (date, from, to, place) {
  const nights = []
  for (let offset = from; offset < to; offset++) nights.push(dayNight(addDays(new Date(date), offset, place.timeZone), place))
  return nights
}

/** Today's ranking (`ranking(lookingAheadFrom:location:)`). */
export function rankingLookingAhead (catalog, now, place) {
  const ahead = lookAheadNight(now, place)
  const pass = moonPass(focusDate(ahead), place)
  const day = pass ? pass.rise : focusDate(ahead)
  const reach = LIBRATION_RUN_REACH
  const days = dayNights(day, -reach, reach + 1, place)
  days[reach] = ahead
  return rankings(catalog, days)[reach]
}

/** Upcoming's rankings for `count` calendar days from `date`'s (`rankings(forDaysStarting:)`). */
export function rankingsForDays (catalog, date, count, place) {
  const reach = LIBRATION_RUN_REACH
  return rankings(catalog, dayNights(date, -reach, count + reach, place)).slice(reach, reach + count)
}

/** A whole night from noon on `date` (`ObservingNight(date:location:calendar:)`). */
export function wholeNight (date, place) {
  const noon = atHour(new Date(date), 12, place.timeZone).getTime()
  return scan(noon, addDays(new Date(noon), 1, place.timeZone).getTime(), place, false)
}

/** Why a ranking is empty, or null (`NightRanking.emptyReason`). */
export function emptyReason (ranking) {
  if (ranking.picks.length) return null
  if (ranking.night.moment.up) return 'noFeatureStandsOut'
  const highest = ranking.night.moment.highestDarkAltitude
  if (highest === null) return 'noDarkSky'
  return highest > 0 ? 'tooLow' : 'upOnlyInDaylight'
}

export { hour }
