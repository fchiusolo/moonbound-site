// "Tonight on the Moon": the app's Today picks for the visitor's city, free sights only.
import catalog from './catalog.js'
import { rankingLookingAhead, rankingsForDays } from './planner.js'
import { addDays, daysBetween, hour, weekday } from './zone.js'

const KINDS = { mare: 'Sea', crater: 'Crater', raySystem: 'Ray system', mountains: 'Mountains', valleyOrRille: 'Valley', landingSite: 'Landing site' }
const DIFFICULTIES = { binoculars: 'Binoculars', smallTelescope: 'Small telescope', largerTelescope: 'Larger telescope' }
const UPCOMING_DAYS = 7

/** The short reason on a card (`FeaturePick.localizedReason`). */
function reasonText ({ feature, reason }) {
  switch (reason.kind) {
    case 'libration': return 'Tilted into view'
    case 'terminator': return reason.isSunrise ? 'Sun rising over it' : 'Sun setting over it'
    default: return feature.isRaySystem ? 'Rays at their brightest' : 'Bright under a high Sun'
  }
}

/** When the spell is, as the app's Today heading names it (`BestHeading`). */
function spellTitle (window, now, timeZone) {
  if (window.start <= now) return 'Right now on the Moon'
  const days = daysBetween(new Date(now), new Date(window.start), timeZone)
  const day = weekday(new Date(window.start), timeZone)
  if (hour(new Date(window.start), timeZone) >= 12) {
    if (days === 0) return 'Tonight on the Moon'
    if (days === 1) return 'Tomorrow night on the Moon'
    return `${day} night on the Moon`
  }
  // Once it's evening, the coming small hours are still tonight.
  if (days === 0 || (days === 1 && hour(new Date(now), timeZone) >= 18)) return 'Tonight on the Moon'
  if (days === 1) return 'Tomorrow morning on the Moon'
  return `${day} morning on the Moon`
}

/** What to show for a city: tonight's free picks, or the next day that has some. */
export function plan (place, now = Date.now()) {
  const free = (picks) => picks.filter((pick) => pick.feature.free)
  const ahead = rankingLookingAhead(catalog, now, place)
  const picks = free(ahead.picks)
  if (picks.length && ahead.night.window) {
    return { title: spellTitle(ahead.night.window, now, place.timeZone), note: null, picks }
  }
  const tomorrow = addDays(new Date(now), 1, place.timeZone)
  for (const ranking of rankingsForDays(catalog, tomorrow, UPCOMING_DAYS, place)) {
    const dayPicks = free(ranking.picks)
    if (dayPicks.length) {
      return { title: `${weekday(new Date(ranking.night.start), place.timeZone)} on the Moon`, note: 'Nothing to see tonight.', picks: dayPicks }
    }
  }
  return { title: 'Tonight on the Moon', note: 'Nothing to see this week.', picks: [] }
}

// Cities

let cities = []

function fold (text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function label (city) {
  return `${city[0]}, ${city[1]}`
}

/** The best match for what was typed: "Rome", "rome, italy", "São Paulo"... */
function findCity (text) {
  const [name, country] = fold(text).split(',').map((s) => s.trim())
  if (!name) return null
  const matches = cities.filter((c) => fold(c[0]) === name && (!country || fold(c[1]).startsWith(country)))
  if (matches.length) return matches[0]
  return cities.find((c) => fold(c[0]).startsWith(name) && (!country || fold(c[1]).startsWith(country))) ?? null
}

/** A first guess from the browser's time zone, with no permission prompt. */
function guessCity () {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  const zoneCity = fold((zone.split('/').pop() || '').replace(/_/g, ' '))
  return cities.find((c) => c[4] === zone && fold(c[0]) === zoneCity) ??
    cities.find((c) => c[4] === zone) ??
    cities.find((c) => c[0] === 'London')
}

// Page

const el = (id) => document.getElementById(id)

function render (result) {
  el('tonight-title').textContent = result.title
  el('tonight-note').textContent = result.note ?? ''
  el('tonight-note').hidden = !result.note
  const list = el('sights')
  list.replaceChildren()
  el('story').hidden = true
  for (const pick of result.picks) {
    const { feature } = pick
    const item = document.createElement('li')
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'sight'
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('aria-controls', 'story')
    button.innerHTML = `<span class="sight-ring"><img alt="" width="166" height="166" loading="lazy"></span>
      <span class="sight-text"><span class="sight-name"></span><span class="sight-why"></span><span class="sight-tags"></span></span>`
    button.querySelector('img').src = `assets/sights/${feature.slug}.jpg`
    button.querySelector('.sight-name').textContent = feature.name
    button.querySelector('.sight-why').textContent = reasonText(pick)
    button.querySelector('.sight-tags').textContent = `${KINDS[feature.kind]} · ${DIFFICULTIES[feature.difficulty]}`
    button.addEventListener('click', () => toggleStory(button, feature))
    item.append(button)
    list.append(item)
  }
}

function toggleStory (button, feature) {
  const open = button.getAttribute('aria-expanded') === 'true'
  for (const other of document.querySelectorAll('.sight')) other.setAttribute('aria-expanded', 'false')
  const story = el('story')
  if (open) {
    story.hidden = true
    return
  }
  button.setAttribute('aria-expanded', 'true')
  el('story-name').textContent = feature.name
  el('story-text').textContent = feature.story
  story.hidden = false
}

function status (text) {
  const list = el('sights')
  const item = document.createElement('li')
  item.className = 'sights-status'
  item.textContent = text
  list.replaceChildren(item)
  el('story').hidden = true
}

function show (city) {
  status('Looking at the Moon…')
  // Let the message paint before the few hundred milliseconds of astronomy.
  setTimeout(() => {
    render(plan({ latitude: city[2], longitude: city[3], timeZone: city[4] }))
  }, 30)
}

async function start () {
  const input = el('city')
  try {
    const response = await fetch('assets/data/cities.json')
    cities = await response.json()
  } catch {
    status('Tonight’s sights couldn’t load. Please try again later.')
    return
  }
  const options = el('city-options')
  options.replaceChildren(...cities.map((c) => {
    const option = document.createElement('option')
    option.value = label(c)
    return option
  }))
  const guess = guessCity()
  input.value = guess[0]
  show(guess)

  el('city-form').addEventListener('submit', (event) => {
    event.preventDefault()
    const city = findCity(input.value)
    if (!city) {
      status('We don’t know that city. Try the nearest big city.')
      return
    }
    input.value = city[0]
    show(city)
  })
}

if (typeof document !== 'undefined') start()
