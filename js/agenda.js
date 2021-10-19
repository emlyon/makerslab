const formatEvent = ( event, i ) => {
    let [title, campus, date, hour, desc, img, soldout] = event;
    // console.log({title, campus, date, hour, desc, img, soldout});
    campus = campus.toUpperCase();

    const [day, month, year] = date.split('/');
    const ddate = new Date(`${month}/${day}/${year}`);
    const now = new Date();
    const comingsoon = ddate - now > 1000 * 3600 * 24 * 14; // more than 2 weeks

    return `
        ${ i % 3 === 0 ? '<div class="row">': '' }
        <div class="col s12 m4">
            <div class="card">
                <div class="card-image waves-effect waves-block waves-light">
                    <img class="activator" style="object-fit:cover;" src="${ event[ 5 ] }">
                </div>

                <div class="card-content">
                    <span class="card-title activator grey-text text-darken-4">${ title }${ (soldout|| comingsoon) ? '' : '<i class="material-icons right">more_vert</i>'}</span>
                    <div class="divider"></div>

                    <p>
                        <span class="red-text darken-4">WHAT:</span> ${ desc }<br>
                        <span class="red-text darken-4">WHERE:</span> makers' lab <b class="red-text">${ campus == 'ECU' ? 'Écully' : campus == 'PAR' ? 'Paris' : campus == 'STE' ? 'Saint-Étienne' : 'room Zoom' }</b><br>
                        <span class="red-text darken-4">WHEN:</span> ${ date } -- ${ hour }
                    </p>

                    <div style="margin-top:15px;">
                        <a class="waves-effect waves-light btn activator ${ (soldout|| comingsoon) ? 'disabled' : ''}">${ soldout ? 'SOLD OUT' : comingsoon ? 'COMING SOON' : 'register'}</a>
                    </div>
                </div>

                ${ (soldout|| comingsoon) ? '' : `<div class="card-reveal">
                    <span class="card-title grey-text text-darken-4">${ title }<i class="material-icons right">close</i></span>
                    <div class="divider"></div>

                    <p>
                        <span class="red-text darken-4">WHERE:</span> makers' lab <b class="red-text">${ campus == 'ECU' ? 'Écully' : campus == 'PAR' ? 'Paris' : campus == 'STE' ? 'Saint-Étienne' : 'room Zoom' }</b><br>
                        <span class="red-text darken-4">WHEN:</span> ${ date } -- ${ hour }
                    </p>
                    <div class="divider"></div>

                    <form data-event="${ title + '_' + campus + '_' + date }">
                        <div class="row">
                            <div class="input-field col l12">
                                <i class="material-icons prefix">account_circle</i>
                                <input id="name" type="text" class="validate">
                                <label for="name">Name</label>
                            </div>

                            <div class="input-field col l12">
                                <i class="material-icons prefix">phone</i>
                                <input id="phone" type="tel" class="validate">
                                <label for="phone">Telephone</label>
                            </div>

                            <div class="input-field col s12">
                                <i class="material-icons prefix">mail</i>
                                <input id="mail" type="email" class="validate">
                                <label for="mail" data-error="wrong" data-success="right">Email</label>
                            </div>
                        </div>

                        <a class="waves-effect waves-light btn right register"><i class="material-icons left">send</i>register</a>

                        <h5 class="on-success hide red-text">
                            We have received your registration.<br>
                            Thank you!
                        </h5>

                        <h5 class="on-error hide red-text">
                            A problem happened during registration.<br>
                            Please try again later!
                        </h5>
                    </form>
                </div>` }
            </div>
        </div>
        ${ i % 3 === 2 ? '</div>': '' }
    `;
};

const slugify = text =>
    text.toString().toLowerCase()
        .replace( /\s+/g, '-' )           // Replace spaces with -
        .replace( /[^\w\-]+/g, '' )       // Remove all non-word chars
        .replace( /\-\-+/g, '-' )         // Replace multiple - with single -
        .replace( /^-+/, '' )             // Trim - from start of text
        .replace( /-+$/, '' );            // Trim - from end of text

const formSubmission = () => {
    [].forEach.call( document.querySelectorAll( 'form' ), form => {
        form.querySelector( '.register' ).addEventListener( 'click', e => {
            e.preventDefault();

            let nameEl = form.querySelector( '#name' ),
                name = nameEl.value,
                phoneEl = form.querySelector( '#phone' ),
                phone = phoneEl.value,
                mailEl = form.querySelector( '#mail' ),
                mail = mailEl.value;

            nameEl.classList.remove( 'invalid' );
            phoneEl.classList.remove( 'invalid' );

            let invalid = false;
            if( name == '' ){
                nameEl.classList.add( 'invalid' );
                invalid = true;
            }
            if( phone == '' ){
                phoneEl.classList.add( 'invalid' );
                invalid = true;
            }
            if( mail == '' || mailEl.classList.contains( 'invalid' ) ){
                mailEl.classList.add( 'invalid' );
                invalid = true;
            }
            if( invalid ) return;

            let params = {
                sheet: slugify( form.dataset.event ),
                name: name,
                phone: phone,
                mail: mail
            };

            let submission = new Request( 'https://script.google.com/macros/s/AKfycbyxVc_cSZ5SNGUDUIJeKYnc0M3VMOuy2eeTjNcEzPqygj64-n9t/exec', {
                method: 'POST',
                headers: new Headers( {
                    'Content-Type' : 'application/x-www-form-urlencoded'
                } ),
                body: Object.keys( params ).map( k => encodeURIComponent( k ) + '=' + encodeURIComponent( params[ k ] ) ).join( '&' )
            } );

            fetch( submission )
                .then( response => {
                    return response.json();
                } )
                .then( json => {
                    // console.log( json );

                    form.querySelector( '.row' ).classList.add( 'hide' );
                    form.querySelector( '.btn' ).classList.add( 'hide' );

                    if( json.result == 'success' ) {
                        form.querySelector( '.on-success' ).classList.remove( 'hide' );
                    }
                    else {
                        form.querySelector( '.on-error' ).classList.remove( 'hide' );

                    }
                } )
                .catch( e => console.warn( e ) );
        } );
    } );
};

let request = new Request( 'https://script.google.com/macros/s/AKfycbwj6NFquoYdm-Qn_ykGOhytjqBN9qowlYqJ3e_-05y8XrqZs0xDoE1ncK4whust_jB5WA/exec', {
    method: 'POST',
    headers: new Headers( {
        'Content-Type' : 'application/x-www-form-urlencoded'
    } )
} );

fetch( request )
    .then( response => {
        return response.json();
    } )
    .then( json => {
        if( json.result == 'success' ){
            let events = JSON.parse( json.data );
            let agenda = document.querySelector( '.agenda' );
            let html = '';

            events.forEach( ( event, i ) => {
                html += formatEvent( event, i );
            } );
            agenda.innerHTML = html;

            formSubmission();

            // set height auto
            setTimeout( () => {
                $( '.agenda .card-content>p' ).height( [].map.call( $( '.agenda .card-content>p' ), d => $( d ).height() ).sort( ( a, b ) => b - a )[ 0 ] )
                $( '.agenda .card-image>img' ).css( 'min-height', [].map.call( $( '.agenda .card-image>img' ), d => $( d ).height() ).sort( ( a, b ) => b - a )[ 0 ] )
            }, 100 );
        }
    } )
    .catch( e => console.warn( e ) );
