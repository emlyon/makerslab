addEventListener( 'load', e => {
    const formatEvent = ( event, i ) => {
        return `
            <div class="col s12 m6">
                <div class="card">
                    <div class="card-image waves-effect waves-block waves-light">
                        <img class="activator" src="https://loremflickr.com/640/280?random=${ i }">
                    </div>

                    <div class="card-content">
                        <span class="card-title activator grey-text text-darken-4">${ event[ 0 ] }<i class="material-icons right">more_vert</i></span>
                        <div class="divider"></div>

                        <p>
                            <span class="red-text darken-4">WHAT:</span> ${ event[ 4 ] }<br>
                            <span class="red-text darken-4">WHERE:</span> makers' lab ${ event[ 1 ] == 'ECU' ? 'Écully' : event[ 1 ] == 'PAR' ? 'Paris' : 'Saint-Étienne' }<br>
                            <span class="red-text darken-4">WHEN:</span> ${ event[ 2 ] } -- ${ event[ 3 ] }
                        </p>
                    </div>

                    <div class="card-reveal">
                        <span class="card-title grey-text text-darken-4">${ event[ 0 ] }<i class="material-icons right">close</i></span>
                        <div class="divider"></div>

                        <p>
                            <span class="red-text darken-4">WHAT:</span> ${ event[ 4 ] }<br>
                            <span class="red-text darken-4">WHERE:</span> makers' lab ${ event[ 1 ] == 'ECU' ? 'Écully' : event[ 1 ] == 'PAR' ? 'Paris' : 'Saint-Étienne' }<br>
                            <span class="red-text darken-4">WHEN:</span> ${ event[ 2 ] } -- ${ event[ 3 ] }
                        </p>
                        <div class="divider"></div>

                        <form data-event="${ event[ 0 ] }">
                            <div class="row">
                                <div class="input-field col m12 l6">
                                    <i class="material-icons prefix">account_circle</i>
                                    <input id="icon_prefix" type="text" class="validate">
                                    <label for="icon_prefix">Name</label>
                                </div>

                                <div class="input-field col m12 l6">
                                    <i class="material-icons prefix">phone</i>
                                    <input id="telephone" type="tel" class="validate">
                                    <label for="telephone">Telephone</label>
                                </div>
                            </div>

                            <div class="row">
                                <div class="input-field col s12">
                                    <i class="material-icons prefix">mail</i>
                                    <input id="email" type="email" class="validate">
                                    <label for="email" data-error="wrong" data-success="right">Email</label>
                                </div>
                            </div>

                            <a class="waves-effect waves-light btn right"><i class="material-icons left">send</i>register</a>
                        </form>
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
