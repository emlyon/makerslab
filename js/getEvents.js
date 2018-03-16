addEventListener( 'load', e => {
    const formatEvent = ( event, i ) => {
        return `
            <div class="col s12 m6">
                <div class="card">
                    <div class="card-image waves-effect waves-block waves-light">
                        <img class="activator" src="https://loremflickr.com/640/480?random=${ i }">
                    </div>

                    <div class="card-content">
                        <span class="card-title activator grey-text text-darken-4">${ event[ 0 ] }<i class="material-icons right">more_vert</i></span>
                        <p>
                            WHERE: <span class="red-text">makers' lab ${ event[ 1 ] }</span><br>
                            WHEN: <span class="red-text">${ event[ 2 ] } -- ${ event[ 3 ] }</span>
                        </p>
                    </div>

                    <div class="card-reveal">
                        <span class="card-title grey-text text-darken-4">${ event[ 0 ] }<i class="material-icons right">close</i></span>
                        <p>${ event[ 4 ] }</p>
                    </div>
                </div>
            </div>
        `;
    };

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
            events.forEach( ( event, i ) => {
                agenda.innerHTML += formatEvent( event, i );
            } );
          }
    } ).catch( e => console.warn( e ) );
} );
