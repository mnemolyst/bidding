var mongo =         require('mongodb').MongoClient;

mongo.connect('mongodb://localhost:27017/thumbdurrdome', function(err, db) {
    db.collection('contests').remove({}, {}, function(err, r) {
        db.collection('contests').insertMany([
            {
                priority: 0,
                vig: 0.15,
                contestants: [
                    'Alice',
                    'Bob',
                    'Cecil',
                    'Desmond',
                    'Elliot',
                    'Frankie',
                    'Geoff',
                    'Hattie',
                ],
                brackets: [
                    [
                        {
                            contestants: ['Alice', 'Bob'],
                            winner: 'Alice',
                        },
                        {
                            contestants: ['Cecil', 'Desmond'],
                            winner: 'Desmond',
                        },
                        {
                            contestants: ['Elliot', 'Frankie'],
                            winner: 'Elliot',
                        },
                        {
                            contestants: ['Geoff'],
                            winner: '',
                        },
                    ],
                    [
                        {
                            contestants: ['Alice', 'Desmond'],
                            winner: 'Desmond',
                        },
                        {
                            contestants: ['Elliot', 'Hattie'],
                            winner: 'Hattie',
                        },
                    ],
                    [
                        {
                            contestants: ['Desmond'],
                            winner: '',
                        },
                    ],
                ],
                bids: {
                    win: [
                        {
                            bidder: 'Nick',
                            amount: 10,
                            on: 'Alice',
                        },
                    ],
                    place: [
                    ],
                    show: [
                    ],
                    exacta: [
                        {
                            bidder: 'Oliver',
                            amount: 15,
                            on: 'Bob, Alice',
                        },
                    ],
                    trifecta: [
                    ],
                },
            },
            {
                priority: 0,
                vig: 0.15,
                contestants: [
                    'Alice',
                    'Bob',
                    'Cecil',
                    'Desmond',
                    'Elliot',
                    'Frankie',
                    'Geoff',
                    'Hattie',
                ],
                brackets: [
                    [
                        {
                            contestants: ['Alice', 'Bob'],
                            winner: 'Alice',
                        },
                        {
                            contestants: ['Cecil', 'Desmond'],
                            winner: 'Desmond',
                        },
                        {
                            contestants: ['Elliot', 'Frankie'],
                            winner: 'Elliot',
                        },
                        {
                            contestants: ['Geoff', 'Hattie'],
                            winner: 'Hattie',
                        },
                    ],
                    [
                        {
                            contestants: ['Alice', 'Desmond'],
                            winner: 'Desmond',
                        },
                        {
                            contestants: ['Elliot', 'Hattie'],
                            winner: 'Hattie',
                        },
                    ],
                ],
                bids: {
                    win: [
                        {
                            bidder: 'Nick',
                            amount: 10,
                            on: 'Alice',
                        },
                    ],
                    place: [
                    ],
                    show: [
                    ],
                    exacta: [
                        {
                            bidder: 'Oliver',
                            amount: 15,
                            on: 'Alice, Cecil',
                        },
                        {
                            bidder: 'Peter',
                            amount: 15,
                            on: 'Alice, Bob',
                        },
                    ],
                    trifecta: [
                    ],
                },
            },
        ], function(err, r) {
            if (err) throw err;
            db.close();
        });
    });
});
