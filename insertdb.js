var mongo = require('mongodb').MongoClient;

mongo.connect('mongodb://localhost:27017/thumbdurrdome', function(err, db) {
    db.collection('matches').remove({}, {}, function(err, r) {
        db.collection('matches').insertMany([
            {
                a: 'Alice',
                b: 'Bob',
                outcome: null,
                left: 0,
                top: 0,
            },
            {
                a: 'Cecil',
                b: 'Denise',
                outcome: null,
                left: 0,
                top: 40,
            },
            {
                a: 'Alice',
                b: '',
                outcome: null,
                left: 0,
                top: 80,
            },
        ], function(err, r) {
            if (err) throw err;
            db.close();
        });
    });
});
