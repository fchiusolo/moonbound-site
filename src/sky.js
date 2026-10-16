// The Moon's and Sun's positions, ported from the app's SwiftAA calls (Meeus, Astronomical
// Algorithms) to astronomia, the JavaScript port of the same book. Like the app, Julian days
// are taken straight from the clock, without a ΔT correction.
import { base, julian, moonposition, nutation, sidereal, solar, planetposition, coord, moonillum, moon as physicalMoon } from 'astronomia'
import earthData from 'astronomia/data/vsop87Bearth'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI
const KM_PER_AU = 149597870.7
const earth = new planetposition.Planet(earthData)

/** The Moon's geocentric altitude where it crosses the horizon at rise and set (SwiftAA's
 *  `Moon.apparentRiseSetAltitude`). */
export const MOON_RISE_SET_ALTITUDE = 0.125

const cache = new Map()

function remember (key, compute) {
  let value = cache.get(key)
  if (value === undefined) {
    if (cache.size > 200000) cache.clear()
    value = compute()
    cache.set(key, value)
  }
  return value
}

function jd (time) {
  return julian.DateToJD(new Date(time))
}

function moonEquatorial (time) {
  return remember('m' + time, () => {
    const j = jd(time)
    const { lon, lat, range } = moonposition.position(j)
    const [Δψ, Δε] = nutation.nutation(j)
    const ε = nutation.meanObliquity(j) + Δε
    const eq = new coord.Ecliptic(lon + Δψ, lat).toEquatorial(ε)
    return { ra: eq.ra, dec: eq.dec, range, lon: lon + Δψ, j }
  })
}

function sunEquatorial (time) {
  return remember('s' + time, () => {
    const j = jd(time)
    const eq = solar.apparentEquatorialVSOP87(earth, j)
    const { lon, range } = solar.apparentVSOP87(earth, j)
    return { ra: eq.ra, dec: eq.dec, range, lon, j }
  })
}

function altitude ({ ra, dec, j }, latitude, longitude) {
  const hourAngle = sidereal.apparent(j) * 15 / 3600 * D2R + longitude * D2R - ra
  const φ = latitude * D2R
  return Math.asin(Math.sin(φ) * Math.sin(dec) + Math.cos(φ) * Math.cos(dec) * Math.cos(hourAngle)) * R2D
}

/** The Moon's geocentric apparent altitude, in degrees (SwiftAA's `MoonAltitudeSampler`). */
export function moonAltitude (time, { latitude, longitude }) {
  return remember(`a${time},${latitude},${longitude}`, () => altitude(moonEquatorial(time), latitude, longitude))
}

/** The Sun's apparent altitude, in degrees (`LunarEphemeris.sunAltitude(at:coordinate:)`). */
export function sunAltitude (time, { latitude, longitude }) {
  return remember(`b${time},${latitude},${longitude}`, () => altitude(sunEquatorial(time), latitude, longitude))
}

function normalized (degrees) {
  const remainder = degrees % 360
  return remainder < 0 ? remainder + 360 : remainder
}

const sinDeg = (d) => Math.sin(d * D2R)
const cosDeg = (d) => Math.cos(d * D2R)

/** What is lit and how the Moon is turned toward Earth (`LunarEphemeris.State`). */
export class LunarState {
  constructor (fields) {
    Object.assign(this, fields)
  }

  sunAltitude (latitude, longitude) {
    return Math.asin(sinDeg(this.subsolarLatitude) * sinDeg(latitude) +
      cosDeg(this.subsolarLatitude) * cosDeg(latitude) * sinDeg(this.colongitude + longitude)) * R2D
  }

  earthAngle (latitude, longitude) {
    const cosine = sinDeg(this.librationLatitude) * sinDeg(latitude) +
      cosDeg(this.librationLatitude) * cosDeg(latitude) * cosDeg(longitude - this.librationLongitude)
    return Math.acos(Math.min(1, Math.max(-1, cosine))) * R2D
  }
}

/** `LunarEphemeris.state(at:)`. */
export function lunarState (time) {
  return remember('l' + time, () => {
    const j = jd(time)
    const { lon, lat, range } = moonposition.position(j)
    const m = new physicalMoon.Moon(j)
    // Optical libration, as SwiftAA's geocentricOpticalLibration.
    const [l, b] = m.optical(lon, lat)
    // The Sun's selenographic position, as SwiftAA's selenographicPositionOfTheSun: the optical
    // libration of the heliocentric Moon (Meeus 53, AA+'s W = λ − Δψ − Ω), with no physical term.
    const sun = solar.apparentVSOP87(earth, j)
    const ΔR = range / (sun.range * KM_PER_AU)
    const λH = sun.lon + Math.PI + 57.296 * D2R * ΔR * Math.cos(lat) * Math.sin(sun.lon - lon) - nutation.nutation(j)[0]
    const [l0, b0] = m.optical(λH, ΔR * lat)
    const librationLongitude = l > Math.PI ? (l - 2 * Math.PI) * R2D : l * R2D

    const moonEq = moonEquatorial(time)
    const sunEq = sunEquatorial(time)
    const phaseAngle = moonillum.phaseAngleEquatorial(
      { ra: moonEq.ra, dec: moonEq.dec, range: moonEq.range },
      { ra: sunEq.ra, dec: sunEq.dec, range: sunEq.range * KM_PER_AU })
    const elongation = normalized((moonEq.lon - sunEq.lon) * R2D)

    return new LunarState({
      librationLongitude,
      librationLatitude: b * R2D,
      colongitude: normalized(90 - l0 * R2D),
      subsolarLatitude: b0 * R2D,
      illuminatedFraction: (1 + Math.cos(phaseAngle)) / 2,
      isWaxing: elongation < 180
    })
  })
}

export { base }
