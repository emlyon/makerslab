// Assuming you have a <ul> element with id 'eventsList' in your HTML
const eventsList = document.getElementById('eventsList');

// Fetch events.json file
fetch('workshops-data/events.json')
  .then((response) => response.json())
  .then((eventIds) => {
    eventIds.forEach((eventId) => {
      const li = document.createElement('li');
      const div = document.createElement('div');
      div.id = `eventbrite-widget-container-${eventId}`;
      div.innerText = `Event ${eventId}`;
      const buttonHtml = `<button id="triggerWidget${eventId}" type="button">
        Register
      </button>;`;
      div.innerHTML = buttonHtml;
      li.appendChild(div);
      eventsList.appendChild(li);

      var exampleCallback = function () {
        console.log('Order complete!');
      };

      window.EBWidgets.createWidget({
        widgetType: 'checkout',
        eventId: eventId,
        modal: true,
        modalTriggerElementId: `triggerWidget${eventId}`,
        onOrderComplete: exampleCallback
      });

      // window.EBWidgets.createWidget({
      //   widgetType: 'checkout',
      //   eventId: eventId,
      //   iframeContainerId: `eventbrite-widget-container-${eventId}`,
      //   iframeContainerHeight: 425
      // });
    });
  })
  .catch((error) => console.error('Error fetching events:', error));

// const parseEventData = (eventDataArray) => {
//   let [title, campus, date, hour, desc, img, status, url] = eventDataArray;
//   eventData = { title, campus, date, hour, desc, img, status };
//   return { eventData };
// };

// const formatEvent = (event, i, eventBriteUrl) => {
//   let { title, campus, date, hour, desc, img, status } = event;
//   console.log({ title, campus, date, hour, desc, img, status });
//   campus = campus.toUpperCase();
//   status = status ? status.toUpperCase() : '';

//   const soldout = status === 'SOLDOUT';
//   const comingsoon = status === 'COMINGSOON';

//   let cta;
//   if (url) {
//     cta = `<div style="margin-top:15px;">
//             <a href="${url}" target="_blank" class="waves-effect waves-light btn activator">register</a>
//         </div>`;
//   } else {
//     cta = `<div style="margin-top:15px;">
//             <a class="waves-effect waves-light btn activator ${soldout || comingsoon ? 'disabled' : ''}">${
//       soldout ? 'SOLD OUT' : comingsoon ? 'COMING SOON' : 'register'
//     }</a>
//         </div>`;
//   }
//   const includeForm = !eventBriteUrl;
//   const htmlForm = `<form data-event="${title + '_' + campus + '_' + date}">
//         <div class="row">
//             <div class="input-field col l12">
//                 <i class="material-icons prefix">account_circle</i>
//                 <input id="name" type="text" class="validate">
//                 <label for="name">Name</label>
//             </div>

//             <div class="input-field col l12">
//                 <i class="material-icons prefix">phone</i>
//                 <input id="phone" type="tel" class="validate">
//                 <label for="phone">Telephone</label>
//             </div>

//             <div class="input-field col s12">
//                 <i class="material-icons prefix">mail</i>
//                 <input id="mail" type="email" class="validate">
//                 <label for="mail" data-error="wrong" data-success="right">Email</label>
//             </div>
//         </div>

//         <a class="waves-effect waves-light btn right register"><i class="material-icons left">send</i>register</a>

//         <h5 class="on-success hide red-text">
//             We have received your registration.<br>
//             Thank you!
//         </h5>

//         <h5 class="on-error hide red-text">
//             A problem happened during registration.<br>
//             Please try again later!
//         </h5>
//     </form>`;

//   return `
//         ${i % 3 === 0 ? '<div class="row">' : ''}
//         <div class="col s12 m4">
//             <div class="card">
//                 <div class="card-image waves-effect waves-block waves-light">
//                     <img class="activator" style="object-fit:cover;" src="${img}">
//                 </div>

//                 <div class="card-content">
//                     <span class="card-title activator grey-text text-darken-4">${title}${
//     soldout || comingsoon ? '' : '<i class="material-icons right">more_vert</i>'
//   }</span>
//                     <div class="divider"></div>

//                     <p>
//                         <span class="red-text darken-4">ℹ️ :</span> ${desc}<br>
//                         <span class="red-text darken-4">📍 :</span> makers' lab <b class="red-text">${
//                           campus == 'ECU'
//                             ? 'Écully'
//                             : campus == 'PAR'
//                             ? 'Paris'
//                             : campus == 'STE'
//                             ? 'Saint-Étienne'
//                             : 'room Zoom'
//                         }</b><br>
//                         <span class="red-text darken-4">🗓️ :</span> ${date} -- ${hour}
//                     </p>

//                     ${cta}
//                 </div>

//                 ${
//                   soldout || comingsoon
//                     ? ''
//                     : `<div class="card-reveal">
//                     <span class="card-title grey-text text-darken-4">${title}<i class="material-icons right">close</i></span>
//                     <div class="divider"></div>

//                     <p>
//                         <span class="red-text darken-4">WHERE:</span> makers' lab <b class="red-text">${
//                           campus == 'ECU'
//                             ? 'Écully'
//                             : campus == 'PAR'
//                             ? 'Paris'
//                             : campus == 'STE'
//                             ? 'Saint-Étienne'
//                             : 'room Zoom'
//                         }</b><br>
//                         <span class="red-text darken-4">WHEN:</span> ${date} -- ${hour}
//                     </p>
//                     <div class="divider"></div>

//                     ${includeForm ? htmlForm : ''}
//                 </div>`
//                 }
//             </div>
//         </div>
//         ${i % 3 === 2 ? '</div>' : ''}
//     `;
// };
