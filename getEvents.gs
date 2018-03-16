function pad( num, size ) {
    var s = num + '';
    while( s.length < size ) s = '0' + s;
    return s;
}

function doPost( e ) {
    try {
        var calendar = CalendarApp.getCalendarById( 'n6d5h8dh9ojh1l2v1qsllak0tk@group.calendar.google.com' );
        Logger.log('The calendar is named "%s".', calendar.getName() );

        var now = new Date();
        var threeMonthsFromNow = new Date( now.getTime() + ( 3 * 30 * 24 * 60 * 60 * 1000 ) );
        var events = calendar.getEvents( now, threeMonthsFromNow );

        for( var i = 0; i < events.length; i ++ ){
            var title = events[ i ].getTitle().split( '|' )[ 0 ];
            var location = events[ i ].getTitle().split( '|' )[ 1 ];
            var desc = events[ i ].getDescription();

            var startTime = events[ i ].getStartTime();
            var startDate = pad( startTime.getDate(), 2 ) + '/' + pad( startTime.getMonth(), 2 );
            var startHour = pad( startTime.getHours(), 2 ) + ':' + pad( startTime.getMinutes(), 2 );
            var endTime = events[ i ].getEndTime();
            var endDate = pad( endTime.getDate(), 2 ) + '/' + pad( endTime.getMonth(), 2 );
            var endHour = pad( endTime.getHours(), 2 ) + ':' + pad( endTime.getMinutes(), 2 );
            var date = ( startDate == endDate ) ? startDate : startDate + ' > ' + endDate;
            var time = startHour + ' > ' + endHour;

            events[ i ] = [ title, location, date, time, desc ];
        }
        Logger.log( JSON.stringify( events ) );

        return ContentService.createTextOutput( JSON.stringify( {
            'result': 'success',
            'data': JSON.stringify( events )
        } ) ).setMimeType( ContentService.MimeType.JSON );
    } catch( error ) {
        Logger.log( error );
        return ContentService.createTextOutput( JSON.stringify( {
            'result': 'error',
            'error': e
        } ) ).setMimeType( ContentService.MimeType.JSON );
    }
}
