addEventListener( 'load', e => {
    let xhr = new XMLHttpRequest();
    xhr.open( 'POST', "https://script.google.com/macros/s/AKfycbzfi_2sF4s85Ypb18H1JoFcQgdwUxTV3kampuD2CIQugCOi_yXI/exec" );
    xhr.setRequestHeader( 'Content-Type', 'application/x-www-form-urlencoded' );
    xhr.onreadystatechange = function() {
    let response = JSON.parse( xhr.responseText )
    // console.log( response );

    if( response.result == 'success' ){
        let events = JSON.parse( response.data );
        let agenda = document.querySelector( '.agenda' );
        agenda.innerHTML = '';
        events.forEach( event => {
            agenda.innerHTML += `<tr data-link="#"><td><b>${ event[ 0 ] }</b></td><td>makers' lab ${ event[ 1 ] }</td><td>${ event[ 2 ] } -- ${ event[ 3 ] }</td></tr>`;
        } );
      }
      return;
    };

    xhr.send();
} );
