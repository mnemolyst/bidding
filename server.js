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

function queryAll(db, what) {
    var promise = new Promise();

    db.collection(what).find().sort({priority: 1}).toArray(function(err, docs) {
        params[what] = docs;
        promise.callback();
    });

    return promise.promise();
}

function permute(arr) {
    var p = [];

    var gen = function(n, a) {
        if (n == 1) {
            p.push(a.slice(0));
        } else {
            for (var i = 0; i < n-1; i++) {
                gen(n-1, a);
                if (n % 2) {
                    var tmp = a[0];
                    a[0] = a[n - 1];
                    a[n - 1] = tmp;
                } else {
                    var tmp = a[i];
                    a[i] = a[n - 1];
                    a[n - 1] = tmp;
                }
            }
            gen(n-1, a);
        }
    }

    gen(arr.length, arr);
    return p;
}

function nChooseM(list, m) {
    var p = {};

    function gen(a, n) {
        if (n == 1) {
            var f = a.slice(0, m);
            if (! p.hasOwnProperty(f.join())) {
                p[f.join()] = f;
            }
        } else {
            for (var i = 0; i < n-1; i++) {
                gen(a, n-1);
                if (n % 2) {
                    var tmp = a[0];
                    a[0] = a[n - 1];
                    a[n - 1] = tmp;
                } else {
                    var tmp = a[i];
                    a[i] = a[n - 1];
                    a[n - 1] = tmp;
                }
            }
            gen(a, n-1);
        }
    }

    gen(list, list.length);

    var ret = [];
    for (var i in p) {
        ret.push(p[i]);
    }
    return ret;
}

function toteBoard(contest) {
    var board = {};
    for (var type in contest['bids']) {
        if (! contest['bids'].hasOwnProperty(type)) {
            continue;
        }

        board[type] = {};
        var typeTotal = 0;
        var outcomeTotals = {};

        for (var i = 0; i < contest['bids'][type].length; i++) {
            var bid = contest['bids'][type][i];
            typeTotal += bid['amount'];
            if (! outcomeTotals.hasOwnProperty(bid['on'])) {
                outcomeTotals[bid['on']] = 0;
            }
            outcomeTotals[bid['on']] += bid['amount'];
        }

        var afterVig = typeTotal * (1 - contest['vig']);

        switch (type) {
            case 'win': //fallthrough
            case 'place':
            case 'show':
                var opts = contest['contestants'];
                break;
            case 'exacta':
                var opts = nChooseM(contest['contestants'], 2).map(function(a) { return a.join(', ') });
                break;
            case 'trifecta':
                var opts = nChooseM(contest['contestants'], 3).map(function(a) { return a.join(', ') });
                break;
        }
        for (var o in opts) {
            board[type][opts[o]] = afterVig / outcomeTotals[opts[o]];
        }
    }

    console.log(board);

    return board;
}

// Homepage
app.get('/', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        var queries = [
            queryAll(db, 'contests'),
        ];

        // Little experiment with promises
        p.when(queries).then(function() {
            var contests = [], contest, board, bidOn;
            for (var i = 0; i < params['contests'].length; i++) {
                contest = params['contests'][i];
                board = toteBoard(contest);
                for (var j in contest.bids) {
                    for (var k = 0; k < contest.bids[j].length; k++) {
                        bidOn = contest.bids[j][k].on;
                        if (bidOn in board[j]) {
                            contest.bids[j][k].payout = board[j][bidOn] * contest.bids[j][k].amount;
                        } else {
                            contest.bids[j][k].payout = Number.NaN;
                        }
                    }
                }
            }
            res.render('index', {
                contests: params['contests'],
            });
            db.close();
        });
    });
});

app.get('/debbug', function(req, res, next) {
    for (var i in process.env) {
        res.write(i + ': ' + process.env[i] + '\n');
    }
});

// Create new contest
app.post('/contest/new', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').count({}, {}, function(err, count) {
            if (err) throw err;
            db.collection('contests').insertOne(
                {
                    priority: 0,
                    vig: 0.15,
                    contestants: [ ],
                    brackets: [ ],
                    bids: { win: [ ], place: [ ], show: [ ], exacta: [ ], trifecta: [ ], },
                }, {}, function(err, r) {
                    if (err) throw err;

                    if (r.result.ok === 1 && r.ops.length == 1) {
                        res.render('contest', {contest: r.ops[0]})
                    } else {
                        res.sendStatus(500);
                    }

                    db.close();
                }
            );
        });
    });
});

// PUT a contest
app.put('/contest/:id', function(req, res, next) {
    var contestants = new Array();
    for (var i = 0; i < req.body.brackets.length; i++) {
        for (var j = 0; j < req.body.brackets[i].length; j++) {
            for (var k = 0; k < req.body.brackets[i][j].contestants.length; k++) {
                if (contestants.indexOf(req.body.brackets[i][j].contestants[k]) === -1) {
                    contestants.push(req.body.brackets[i][j].contestants[k]);
                }
            }
        }
    }
    req.body.contestants = contestants.sort();

    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').replaceOne(
            {_id: new ObjectId(req.params.id)},
            req.body,
            {},
            function(err, r) {
                if (err) throw err;

                if (r.result.ok === 1) {
                    db.collection('contests').find({_id: new ObjectId(req.params.id)}).limit(1).next(function(err, doc) {
                        if (err) throw err;

                        res.render('contest', {contest: doc});

                        db.close();
                    });
                } else {
                    res.sendStatus(500);
                    db.close();
                }
            }
        );
    });
});

// POST a contest's contestants
//app.post('/contest/:id/contestants', function(req, res, next) {
//    mongo.connect(mongoUrl, function(err, db) {
//        db.collection('contests').findOneAndUpdate(
//            {_id: new ObjectId(req.params.id)},
//            {$set: {
//                vig: req.body.vig,
//                contestants: req.body.contestants,
//            }},
//            {returnOriginal: false},
//            function(err, r) {
//                if (err) throw err;
//
//                if (r.ok === 1) {
//                    // Compute odds for each contestant
//                    //var contest = toteBoard(r.value);
//                    res.render('contest', {contest: r.value});
//                } else {
//                    res.sendStatus(500);
//                }
//
//                db.close();
//            }
//        );
//    });
//});

// Delete a contest
app.post('/contest/:id/delete', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').findOneAndDelete(
            {_id: new ObjectId(req.params.id)},
            {},
            function(err, r) {
                if (err) throw err;

                if (r.ok === 1) {
                    res.sendStatus(200);
                } else {
                    res.sendStatus(500);
                }

                db.close();
            }
        );
    });
});

// Reorder contests (via "priority" property)
app.post('/contests/reorder', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        var queries = [];
        for (var i = 0; i < req.body.length; i++) {
            queries.push((function(rbi) {
                var promise = new Promise();
                db.collection('contests').findOneAndUpdate(
                    {_id: new ObjectId(rbi.id)},
                    {$set: {priority: rbi.priority}},
                    {},
                    function(err, r) {
                        if (err) throw err;
                        if (r.ok === 1) {
                            promise.callback();
                        } else {
                            promise.reject();
                        }
                    }
                );
                return promise.promise();
            })(req.body[i]));
        }

        p.when(queries).then(function() {
            res.sendStatus(200);
            db.close();
        }, function(err) {
            res.sendStatus(500);
        });
    });
});

// Display a contest's tote board
app.get('/contest/:id/tote', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').find({_id: new ObjectId(req.params.id)}).limit(1).next(function(err, doc) {
            if (err) throw err;

            res.render('tote_board', {
                board: toteBoard(doc),
            });

            db.close();
        });
    });
});

app.listen(8080);
