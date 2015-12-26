var path =          require('path');
var express =       require('express');
var mongo =         require('mongodb').MongoClient;
var ObjectId =      require('mongodb').ObjectID;
var bodyparser =    require('body-parser');
var cookies =       require('cookie-parser');
var p =             require('promise-extended');
var Promise = p.Promise;

var app = express();

app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'jade');

app.use(cookies());
app.use(bodyparser.json());
//app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

var mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/thumbdurrdome';

var params = [];

var queryAll = function(db, what) {
    var promise = new Promise();

    db.collection(what).find().sort({_id: 1}).toArray(function(err, docs) {
        params[what] = docs;
        promise.callback();
    });

    return promise.promise();
}

var computeOdds = function(contest) {
    var contestBid = 0;

    for (var i = 0; i < contest['contestants'].length; i++) {
        var contestantBid = 0;
        for (var j = 0; j < contest['contestants'][i]['bids'].length; j++) {
            contestantBid += contest['contestants'][i]['bids'][j]['amount'];
        }
        contest['contestants'][i]['totalBid'] = contestantBid;
        contestBid += contestantBid;
    }
    contest['totalBid'] = contestBid;

    for (var i = 0; i < contest['contestants'].length; i++) {
        contest['contestants'][i]['odds'] = contestBid * (1 - contest['vig']) / contest['contestants'][i]['totalBid'];
    }

    return contest;
}

app.get('/', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        var queries = [
            queryAll(db, 'contests'),
            //queryAll(db, 'contestants'),
            //queryAll(db, 'bidders')
        ];

        p.when(queries).then(function() {
            var contests = [];
            for (var i = 0; i < params['contests'].length; i++) {
                contests.push(computeOdds(params['contests'][i]));
            }
            res.render('index', {
                contests: contests,
                //contestants: params['contestants'],
                //bidders: params['bidders'],
            });
            res.end();
            db.close();
        });
    });
});

app.get('/contest/new', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').count({}, {}, function(err, count) {
            if (err) throw err;
            db.collection('contests').insertOne(
                {
                    priority: count,
                    vig: 0.15,
                    contestants: [],
                    outcome: null,
                }, {}, function(err, r) {
                    if (err) throw err;

                    if (r.result.ok === 1 && r.ops.length == 1) {
                        res.render('contest', {contest: r.ops[0]})
                    } else {
                        res.status(500).send('no good');
                    }

                    res.end();
                    db.close();
                }
            );
        });
    });
});

app.post('/contest/:id/contestants', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').findOneAndUpdate(
            {_id: new ObjectId(req.params.id)},
            {$set: {
                vig: req.body.vig,
                contestants: req.body.contestants,
            }},
            {returnOriginal: false},
            function(err, r) {
                if (err) throw err;

                if (r.ok === 1) {
                    // Compute odds for each contestant
                    var contest = computeOdds(r.value);
                    res.render('contest', {contest: contest});
                } else {
                    res.status(500).send('no good');
                }

                res.end();
                db.close();
            }
        );
    });
});

app.post('/contest/:id/delete', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').findOneAndDelete(
            {_id: new ObjectId(req.params.id)},
            {},
            function(err, r) {
                if (err) throw err;

                if (r.ok === 1) {
                    res.send('OK');
                } else {
                    res.status(500).send('no good');
                }

                res.end();
                db.close();
            }
        );
    });
});

app.listen(8080);