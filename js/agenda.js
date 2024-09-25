// Main function to fetch and display events
const pageLanguage = document.documentElement.lang;

async function main() {
  try {
    const events = await fetchEvents();
    appendEvents(events);
    initializeEventbriteWidgets(events);
    equalizeCardsHeight();
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Fetch events.json file
async function fetchEvents() {
  try {
    const response = await fetch('/workshops-data/events.json');
    return await response.json();
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
}

// Create event card
function createEventCard(event) {
  const card = document.createElement('div');
  card.classList.add('card');

  const cardImage = document.createElement('div');
  cardImage.classList.add('card-image');
  cardImage.innerHTML = `<img style="object-fit:cover;" src="${event.logo?.url}">`;
  card.appendChild(cardImage);

  const cardContent = document.createElement('div');
  cardContent.classList.add('card-content');
  cardContent.innerHTML = `<span class="card-title grey-text text-darken-4">${event.name.text}</span>`;
  cardContent.innerHTML += `<div class="divider"></div>`;
  cardContent.innerHTML += `<p>${event.description.text}</p>`;
  // We could use ${event.venue.name} instead of 'makers' lab emlyon', but the city is also mentioned in the name, so we avoid redundancy.
  cardContent.innerHTML += `<span class="red-text darken-4">📍</span> <strong class="red-text">${event.venue.address.city}</strong> - <strong>makers' lab emlyon</strong> <br>`;

  // Display user friendly date and time
  const startDate = new Date(event.start.local);
  const endDate = new Date(event.end.local);
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  const dateCode = pageLanguage === 'fr' ? 'fr-FR' : 'en-EN';
  let toText = pageLanguage === 'fr' ? 'à' : 'to';
  const formatStartDate = startDate.toLocaleDateString(dateCode, options);
  const formatEndDate = endDate.toLocaleDateString(dateCode, options);
  const startHour = startDate.toLocaleTimeString(dateCode, { hour: '2-digit', minute: '2-digit' });
  const endHour = endDate.toLocaleTimeString(dateCode, { hour: '2-digit', minute: '2-digit' });
  // If an event is on a single day, we display the date and the time separately.
  if (formatStartDate === formatEndDate) {
    cardContent.innerHTML += `<p><span class="red-text darken-4">🗓️</span> ${formatStartDate}</p>`;
    cardContent.innerHTML += `<p><span class="red-text darken-4">🕒</span> ${startHour} ${toText} ${endHour}</p>`;
  } else {
    toText = pageLanguage === 'fr' ? 'au' : 'to';
    cardContent.innerHTML += `<span class="red-text darken-4">🗓️</span> ${formatStartDate} - ${startHour} ${toText} ${formatEndDate} - ${endHour}`;
  }

  const cta = document.createElement('div');
  cta.classList.add('cta');
  const ctaText = pageLanguage === 'fr' ? 'Inscription' : 'Register';
  cta.innerHTML = `<a class="waves-effect waves-light btn" id="triggerWidget${event.id}">${ctaText}</a>`;

  card.appendChild(cardContent);
  card.appendChild(cta);

  return card;
}

// Append events to the DOM
function appendEvents(events) {
  const eventsList = document.getElementById('eventsList');
  let eventRow;
  events.forEach((event, index) => {
    const card = createEventCard(event);

    const eventCol = document.createElement('div');
    eventCol.classList.add('col', 's12', 'm4');

    if (index % 3 === 0) {
      eventRow = document.createElement('div');
      eventRow.classList.add('row');
    }

    eventCol.appendChild(card);
    eventRow.appendChild(eventCol);
    if (index % 3 === 2) {
      eventsList.appendChild(eventRow);
    }
  });
}

// Initialize Eventbrite widgets
function initializeEventbriteWidgets(events) {
  events.forEach((event) => {
    initializeEventbriteWidget(event);
  });
}

// Initialize Eventbrite widget
function initializeEventbriteWidget(event) {
  window.EBWidgets.createWidget({
    widgetType: 'checkout',
    eventId: event.id,
    modal: true,
    modalTriggerElementId: `triggerWidget${event.id}`
  });
}

function equalizeCardsHeight() {
  setTimeout(() => {
    const rows = document.querySelectorAll('#eventsList .row');
    rows.forEach((row) => {
      const cardContents = row.querySelectorAll('.card-content');
      const cardImages = row.querySelectorAll('.card-image>img');
      const cardContentsMaxHeight = Math.max(...Array.from(cardContents).map((p) => p.clientHeight));
      const cardImagesHeights = Math.max(...Array.from(cardImages).map((img) => img.clientHeight));
      Array.from(cardContents).forEach((p) => (p.style.height = `${cardContentsMaxHeight}px`));
      Array.from(cardImages).forEach((img) => (img.style.minHeight = `${cardImagesHeights}px`));
    });
  }, 100);
}

// Run the main function
main();
