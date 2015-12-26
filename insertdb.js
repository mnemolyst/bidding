var mongo =         require('mongodb').MongoClient;

mongo.connect('mongodb://localhost:27017/thumbdurrdome', function(err, db) {
    db.collection('contests').remove({}, {}, function(err, r) {
        db.collection('contests').insertMany([
            {
                priority: 0,
                vig: 0.15,
                contestants: [
                    {
                        name: 'Bob',
                        bids: [
                            {
                                bidder: 'Joe',
                                amount: 1,
                            }, {
                                bidder: 'Sally',
                                amount: 2,
                            },
                        ],
                    },
                    {
                        name: 'Cecil',
                        bids: [
                            {
                                bidder: 'James',
                                amount: 1,
                            },
                        ],
                    },
                ],
                outcome: null,
            }
        ], function(err, r) {
            if (err) throw err;
            db.close();
        });
    });
});
