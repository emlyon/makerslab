function doPost( e ) {
    try {
        record_data( e );

        return ContentService.createTextOutput( JSON.stringify( {
            'result': 'success',
            'data': JSON.stringify( e.parameter )
        } ) ).setMimeType( ContentService.MimeType.JSON );
    } catch ( error ) {
        return ContentService.createTextOutput( JSON.stringify( {
            'result': 'error',
            'error': error,
            'e': e
        } ) ).setMimeType( ContentService.MimeType.JSON );
    }
}

function record_data( e ) {
    var doc = SpreadsheetApp.openById( '1v6IlPhTR3LfztV33UJ9LHdxymGywtQSzlw1UlQN9FnE' ),
        sheets = doc.getSheets(),
        sheet = null;

    for( var i = 0; i < sheets.length; i ++ ) {
        if( e.parameter[ 'sheet' ] == sheets[ i ].getName() ){
            sheet = sheets[ i ];
            break;
        }
    }

    if( sheet == null ) {
        doc.insertSheet( e.parameter[ 'sheet' ], 0 );
        sheet = doc.getSheetByName( e.parameter[ 'sheet' ] );
    }

    var nextRow = sheet.getLastRow() + 1;
    var values = [
        new Date(),
        e.parameter[ 'name' ],
        e.parameter[ 'phone' ],
        e.parameter[ 'mail' ]
    ];

    sheet.getRange( nextRow, 1, 1, values.length ).setValues( [ values ] );
}
