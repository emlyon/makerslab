addEventListener( 'load', e => {
    let request = new Request( 'https://script.google.com/macros/s/AKfycbzfi_2sF4s85Ypb18H1JoFcQgdwUxTV3kampuD2CIQugCOi_yXI/exec', {
        method: 'POST',
        headers: new Headers( {
            'Content-Type' : 'application/x-www-form-urlencoded'
        } )
    } );

    fetch( request ).then( response => {
        return response.text();
    } ).then( txt => {
        let json = JSON.parse( txt );
        // console.log( json );

        if( json.result == 'success' ){
            let events = JSON.parse( json.data );
            let agenda = document.querySelector( '.agenda' );
            agenda.innerHTML = '';
            events.forEach( event => {
                agenda.innerHTML += `<p><b>${ event[ 0 ] }</b><br>makers' lab ${ event[ 1 ] }<br>${ event[ 2 ] } -- ${ event[ 3 ] }<br>${ event[ 4 ] }</p>`;
                console.log( event[ 4 ] );
            } );
          }
    } ).catch( e => console.warn( e ) );
} );
