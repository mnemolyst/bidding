var mongo = require('mongodb').MongoClient;

mongo.connect('mongodb://localhost:27017/thumbdurrdome', function(err, db) {
    db.collection('matches').remove({}, {}, function(err, r) {
        db.collection('matches').insertMany([
            {
                a: 'Alice',
                b: 'Bob',
                bracket: 0,
            },
            {
                a: 'Cecil',
                b: 'Denise',
                bracket: 0,
            },
            {
                a: 'Alice',
                b: '',
                bracket: 1,
            },
        ], function(err, r) {
            if (err) throw err;
            db.close();
        });
    });
});
