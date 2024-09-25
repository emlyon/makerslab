// Assuming you have a <ul> element with id 'eventsList' in your HTML
const eventsList = document.getElementById('eventsList');

// Fetch events.json file
fetch('workshops-data/events.json')
  .then((response) => response.json())
  .then((events) => {
    let eventRow;
    events.forEach((event, index) => {
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
      const formatStartDate = startDate.toLocaleDateString('en-UK', options);
      const formatEndDate = endDate.toLocaleDateString('en-UK', options);
      const startHour = startDate.toLocaleTimeString('en-UK', { hour: '2-digit', minute: '2-digit' });
      const endHour = endDate.toLocaleTimeString('en-UK', { hour: '2-digit', minute: '2-digit' });
      // If an event is on a single day, we display the date and the time separately.
      if (formatStartDate === formatEndDate) {
        const dateInfo = formatStartDate;
        cardContent.innerHTML += `<p><span class="red-text darken-4">🗓️</span> ${dateInfo}</p>`;
        const timeInfo = `${startHour} to ${endHour}`;
        cardContent.innerHTML += `<p><span class="red-text darken-4">🕒</span> ${timeInfo}</p>`;
      } else {
        // If an event is on different days, we display the date and time for start and end date.
        const dateAndTimeInfo = `${formatStartDate} - ${startHour} to ${formatEndDate} - ${endHour}`;
        cardContent.innerHTML += `<span class="red-text darken-4">🗓️</span> ${dateAndTimeInfo}`;
      }

      const cta = document.createElement('div');
      cta.style.marginTop = '15px';
      cta.innerHTML = `<a class="waves-effect waves-light btn" id="triggerWidget${event.id}">Register</a>`;

      cardContent.appendChild(cta);
      card.appendChild(cardContent);

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

      window.EBWidgets.createWidget({
        widgetType: 'checkout',
        eventId: event.id,
        modal: true,
        modalTriggerElementId: `triggerWidget${event.id}`
      });
    });
  })
  .catch((error) => console.error('Error fetching events:', error));
