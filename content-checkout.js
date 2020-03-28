init()

function init () {
  // Remove provided styling
  document.querySelectorAll('link').forEach((el) => {
    el.remove()
  })

  const iconLink = document.createElement('link')
  iconLink.href = chrome.runtime.getURL('icon128.png')
  iconLink.rel = 'icon'
  iconLink.type = 'image/png'
  document.head.appendChild(iconLink)

  const params = (new URL(document.location)).searchParams
  const command = params.get('command')
  const term = params.get('term')
  const props = { command, term }

  if (isScanCardPage()) {
    return renderScanCard(props)
  }

  if (command === 'checkout') {
    return renderPatron(props)
  }

  if (command === 'checkin') {
    return renderCheckIn(props)
  }
}

function isScanCardPage () {
  try {
    return document.querySelector('form').childNodes[0].textContent.trim() === 'Enter Patron Number:'
  } catch {
    return false
  }
}

function render ({ title, content, hasError = false, alertMessage = '' }) {
  const name = 'ECC Library'

  document.title = `${hasError ? 'Error: ' : ''}${title} - ${name}`

  const container = document.createElement('div')
  container.innerHTML = `
    <header>
      <a href="${chrome.runtime.getURL('blank.html')}" class="logo">
        <img src="${chrome.runtime.getURL('ecc-logo-white.png')}" alt="${name}" />
        <span>Library</span>
      </a>
    </header>
    <main>
      ${renderAlert(alertMessage)}
      <h1>${title}</h1>
      ${content}
    </main>
  `
  document.body.appendChild(container)
}

function renderScanCard () {
  const error = document.querySelector('font[color="#ff0000"]')
  const errorMessage = error ? error.textContent.toLowerCase() : ''
  const isInvalid = errorMessage.includes('patron verification')
  const hasError = isInvalid

  const alertMessage = [
    isInvalid ? '😱 Library card number not found' : ''
  ]
    .filter((message) => message.length)[0] || ''

  const title = 'Scan your library card'
  const content = `
    <form method="GET" action="/cgi-bin/selfservice.pl" autocomplete="off">
      <div>
        <label for="library-card-number">
          Library card number
          <small>2000XXXX</small>
        </label>
        <input type="text" name="term" id="library-card-number" pattern="2\\d{7}" maxlength="8" />
      </div>
      <button type="submit">Continue</button>
      <input type="hidden" name="goodpatron" value="">
      <input type="hidden" name="command" value="checkout">
    </form>
    <hr />
    <h2>
      <span class="icon" aria-hidden="true">🗃</span>
      Find your card
    </h2>
    <ol>
      <li>Cards are sorted alphabetically by last name in the filing box</li>
      <li>Scan the barcode on your card to continue</li>
      <li>Return the card to the filing box</li>
    </ol>
    <h2>
      <span class="icon" aria-hidden="true">🔫</span>
      Scanner not working?
    </h2>
    <ol>
      <li>Confirm the <a href="#library-card-number">library card number field</a> is in focus before scanning</li>
      <li>Position the scanner 6 to 12 inches away from the barcode</li>
      <li>The scanner will emit a green light when it detects a barcode</li>
    </ol>
    <h2>
      <span class="icon" aria-hidden="true">👻</span>
      Cannot find your card?
    </h2>
    <ol>
      <li>Write down a note informing the librarian of the missing card</li>
      <li>Find your card number in the patron booklet</li>
      <li>Enter the number in the <a href="#library-card-number">library card number field</a></li>
    </ol>
    <h2>
      <span class="icon" aria-hidden="true">🖊️</span>
      Need to sign up for a card?
    </h2>
    <p>Fill out either the online <a href="https://docs.google.com/forms/d/e/1FAIpQLSdoM9GqJE4YglUEOQdWIfeLyvxV6oOt8DuQ9fgOHOXT8zcsGw/viewform">Library Card Signup Form</a> or the paper form.</p>
    <p>Expect the card to be printed and placed in the filing box within a week. If you want to check out items today, ask a <b>library helper</b> for assistance. If no one is available, write down:</p>
    <ol>
      <li>Your name, email, and phone number</li>
      <li>Current date</li>
      <li>Titles and barcode numbers (located in the upper left back corner, in the format of <b>3000XXXX</b>) of any items you are borrowing</li>
    </ol>
  `
  render({ title, content, hasError, alertMessage })
  document.getElementById('library-card-number').focus()
}

function renderPatron () {
  const error = document.querySelector('font[color="#ff0000"]')
  const errorMessage = error ? error.textContent.toLowerCase() : ''
  const isInvalid = errorMessage.includes('invalid')
  const isNotAvailable = errorMessage.includes('not available')
  const hasError = isInvalid || isNotAvailable

  const success = document.querySelector('font[color="#347c17"]')
  const successMessage = success ? success.textContent.toLowerCase() : ''
  const isCheckedOut = successMessage.includes('checked out')

  const alertMessage = [
    isInvalid ? '😱 Item not found' : '',
    isNotAvailable ? '🤔 Item already checked out' : '',
    isCheckedOut ? '✅ Item successfully checked out' : ''
  ]
    .filter((message) => message.length)[0] || ''

  const goodpatron = document.querySelector('input[name="goodpatron"]').value

  const patronData = document.querySelector('td[width="400"]').childNodes
  const libraryCardNumber = patronData[1].textContent.trim()
  const [ lastName = '', firstName = '' ] = patronData[13].textContent.trim().split(', ')
  const name = `${firstName} ${lastName}`
  const email = patronData[15].textContent.trim()

  const today = (new Date()).toJSON().substring(0, 10)
  const checkouts = [ ...document.getElementById('checkout_table').querySelectorAll('tr') ]
    .filter((row, index) => index > 0)
    .map((row) => {
      const [ status, barcode, titleRaw, callNumber, outDateRaw, dueDateRaw ] = [ ...row.childNodes ]
        .map((el) => el.textContent.trim())
        const title = displayTitle(titleRaw)
      const outDate = displayDate(outDateRaw)
      const dueDate = displayDate(dueDateRaw)
      const isOverdue = dueDateRaw < today
      return { barcode, title, callNumber, outDate, dueDate, isOverdue }
    })

  const title = 'Check out'
  const content = `
    <form method="GET" action="/cgi-bin/selfservice.pl" autocomplete="off">
      ${renderBookBarcodeField()}
      <button type="submit">Check out</button>
      <input type="hidden" name="goodpatron" value="${goodpatron}" />
      <input type="hidden" name="command" value="checkout" />
    </form>
    <hr />
    <h2>
      <span class="icon" aria-hidden="true">🧑</span>
      ${name}
    </h2>
    <dl>
      <div>
        <dt>Email</dt>
        <dd>${email}</dd>
      </div>
      <div>
        <dt>Library card number</dt>
        <dd>${libraryCardNumber}</dd>
      </div>
    </dl>
    <p>
      <a href="${chrome.runtime.getURL('blank.html')}">Log out</a>
    </p>
    <h2>
      <span class="icon" aria-hidden="true">📚</span>
      Checkouts
    </h2>
    ${renderCheckouts(checkouts)}
  `
  render({ title, content, hasError, alertMessage })
  document.getElementById('item-number').focus()
}

function renderCheckouts (checkouts) {
  if (!checkouts.length) {
    return `<p>No checkouts</p>`
  }
  return checkouts.map(renderCheckout).join('')
}

function renderCheckout (checkout) {
  const { title, outDate, dueDate, barcode, isOverdue } = checkout
  return `
    <h3>${title}</h3>
    <dl>
      <div>
        <dt>Out date</dt>
        <dd>${outDate}</dd>
      </div>
      <div>
        <dt>Due date</dt>
        <dd>${dueDate}</dd>
        ${isOverdue ? '<dd class="highlight">⌛ Overdue!</dd>' : ''}
      </div>
      <div>
        <dt>Barcode</dt>
        <dd>${barcode}</dd>
      </div>
    </dl>
  `
}

function renderCheckIn () {
  const error = document.querySelector('font[color="#ff0000"]')
  const errorMessage = error ? error.textContent.toLowerCase() : ''
  const isInvalid = errorMessage.includes('invalid')
  const isNotCheckedOut = errorMessage.includes('not checked out')
  const hasError = isInvalid || isNotCheckedOut

  const success = document.querySelector('font[color="#347c17"]')
  const successMessage = success ? success.textContent.toLowerCase() : ''
  const isCheckedIn = successMessage.includes('checked in')

  const alertMessage = [
    isInvalid ? '😱 Item not found' : '',
    isNotCheckedOut ? '🤔 Item already checked in' : '',
    isCheckedIn ? '✅ Item successfully checked in' : ''
  ]
    .filter((message) => message.length)[0] || ''

  const today = (new Date()).toJSON().substring(0, 10)
  const checkins = [ ...document.querySelectorAll('form ~ table tr') ]
    .filter((row, index) => index > 0)
    .map((row) => {
      const [ barcode, titleRaw, outDateRaw, dueDateRaw, libaryCardNumber, patronName, type, code ] = [ ...row.childNodes ]
        .map((el) => el.textContent.trim())
      const title = displayTitle(titleRaw)
      const outDate = displayDate(outDateRaw)
      const dueDate = displayDate(dueDateRaw)
      const inDate = displayDate(today)
      const isOverdue = dueDateRaw < today
      return { barcode, title, outDate, dueDate, inDate, isOverdue, libaryCardNumber, patronName, type, code }
    })

  const title = 'Check in'
  const content = `
    <form method="GET" action="/cgi-bin/selfservice.pl" autocomplete="off">
      ${renderBookBarcodeField()}
      <button type="submit">Check in</button>
      <input type="hidden" name="command" value="checkin" />
    </form>
    ${renderCheckins(checkins)}
  `
  render({ title, content, hasError, alertMessage })
  document.getElementById('item-number').focus()
}

function renderCheckins (checkins) {
  if (!checkins.length) {
    return ''
  }
  return `
    <hr />
    <h2>
      <span class="icon" aria-hidden="true">📚</span>
      Checkins
    </h2>
    ${checkins.map(renderCheckin).join('')}
  `
}

function renderCheckin (checkin) {
  const { barcode, title, outDate, inDate, isOverdue, libaryCardNumber, patronName } = checkin
  return `
    <h3>${title}</h3>
    <dl>
      <div>
        <dt>Patron</dt>
        <dd>${patronName}</dd>
        <dd>${libaryCardNumber}</dd>
      </div>
      <div>
        <dt>Out date</dt>
        <dd>${outDate}</dd>
      </div>
      <div>
        <dt>In date</dt>
        <dd>${inDate}</dd>
        ${isOverdue ? '<dd class="highlight">⌛ Overdue!</dd>' : ''}
      </div>
      <div>
        <dt>Barcode</dt>
        <dd>${barcode}</dd>
      </div>
    </dl>
  `
}

function renderAlert (message) {
  if (!message) {
    return ''
  }
  return `
    <h1 class="alert">${message}</h1>
  `
}

function renderBookBarcodeField () {
  return `
    <div>
      <label for="item-number">
        Book barcode
        <small>3000XXXX</small>
        <small>Located in the upper left back corner</small>
      </label>
      <input type="text" name="term" id="item-number" pattern="3\\d{7}" maxlength="8" />
    </div>
  `
}

function displayTitle (value) {
  return value.replace(' : ', ': ').replace(' /', '').replace("'", '&rsquo;')
}

function displayDate (value) {
  const date = new Date(`${value}T00:00`)
  const [ weekday, month, day, year ] = date.toDateString().split(' ')
  return `${month} ${parseInt(day)}, ${year}`
}
