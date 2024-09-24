const fs = require('fs');

// Use dynamic import for node-fetch
(async () => {
  const fetch = (await import('node-fetch')).default;

  // Read config.json file
  const config = JSON.parse(fs.readFileSync('workshops-data/eventbrite-config.json', 'utf8'));

  const ORGANIZATION_ID = config.ORGANIZATION_ID;
  const TOKEN = config.TOKEN;

  const baseUrl = `https://www.eventbriteapi.com/v3/organizations/${ORGANIZATION_ID}/events/?time_filter=current_future&status=live`;
  // const baseUrl = `https://www.eventbriteapi.com/v3/organizations/${ORGANIZATION_ID}/events/`;
  const options = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${TOKEN}`
    }
  };

  // Il y a plein de paramètres disponibles pour filtrer les évènements : https://www.eventbrite.com/platform/api#/reference/event/list/list-events-by-organization
  const params = {
    status: 'live'
  };

  const url = new URL(baseUrl);
  url.search = new URLSearchParams(params).toString();

  fetch(url, options)
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      const events = data.events;
      console.log(events);
      console.log("Nombre d'évènements : " + events.length);
      // Clear existing events in events.json
      // fs.writeFileSync('workshops-data/events.json', JSON.stringify([]));

      // Map events to the desired format
      // const formattedEvents = events.map(event => ({
      //   title: event.name.text,
      //   desc: event.description.text,
      //   campus: event.venue.name,
      //   date: new Date(event.start.utc).toLocaleDateString(),
      //   hour: new Date(event.start.utc).toLocaleTimeString(),
      //   img: event.logo ? event.logo.url : '',
      //   status: event.status
      // }));

      // Write formatted events to events.json
      fs.writeFileSync(
        'workshops-data/events.json',
        JSON.stringify(
          events.map((e) => e.id),
          null,
          2
        )
      );

      // events.forEach((event, i) => {
      // console.log(event);
      // html += formatEvent(event.eventData, i, event.url);
      // });
      //   agenda.innerHTML = html;

      // set height auto
      // setTimeout(() => {
      //   $('.agenda .card-content>p').height(
      //     [].map.call($('.agenda .card-content>p'), (d) => $(d).height()).sort((a, b) => b - a)[0]
      //   );
      //   $('.agenda .card-image>img').css(
      //     'min-height',
      //     [].map.call($('.agenda .card-image>img'), (d) => $(d).height()).sort((a, b) => b - a)[0]
      //   );
      // }, 100);
    })
    .catch((e) => console.warn(e));
})();
