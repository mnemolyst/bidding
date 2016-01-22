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
    if (list.length === 0) {
        return [];
    }

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
            typeTotal += Number(bid['amount']);
            if (! outcomeTotals.hasOwnProperty(bid['on'])) {
                outcomeTotals[bid['on']] = 0;
            }
            outcomeTotals[bid['on']] += Number(bid['amount']);
        }

        var afterVig = typeTotal * (1 - Number(contest['vig']));

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

    return board;
}

function computePayout(contest) {
    var winning = {
        win: [],
        place: [],
        show: [],
        exacta: [],
        trifecta: [],
    };
    var brackets = contest.brackets.slice(-3);

    // Assemble lists of winning bids, by bid type
    for (var i = 0; i < brackets.length; i++) { // all brackets
        var bracket = brackets[i];
        for (var j = 0; j < bracket.length; j++) { // all matches in a bracket
            var match = bracket[j];
            var winner = match.winner.trim();
            if (winner) {
                if (i == 0) {
                    winning['show'].push(winner);
                    winning['trifecta'].push([winner]);
                } else if (i == 1) {
                    winning['place'].push(winner);
                    if (winning['show'].indexOf(winner) === -1)
                        winning['show'].push(winner);
                    winning['exacta'].push([winner]);
                    winning['trifecta'] = winning['trifecta'].concat(winning['trifecta'].filter(function(val) {
                        return (val.length == 1 && val[0] !== winner);
                    }).map(function(val) {
                        return [val[0], winner];
                    }));
                } else if (i == 2) {
                    winning['win'].push(winner);
                    if (winning['place'].indexOf(winner) === -1)
                        winning['place'].push(winner);
                    if (winning['show'].indexOf(winner) === -1)
                        winning['show'].push(winner);
                    winning['exacta'] = winning['exacta'].concat(winning['exacta'].filter(function(val) {
                        return (val.length == 1 && val[0] !== winner);
                    }).map(function(val) {
                        return [val[0], winner];
                    }));
                    winning['trifecta'] = winning['trifecta'].concat(winning['trifecta'].filter(function(val) {
                        return (val.length == 2 && val[0] !== winner && val[1] !== winner);
                    }).map(function(val) {
                        return [val[0], val[1], winner];
                    }));
                }
            }
        }
    }
    winning['exacta'] = winning['exacta'].filter(function(val) { return val.length == 2; }).map(function(val) { return val.join(', '); });
    winning['trifecta'] = winning['trifecta'].filter(function(val) { return val.length == 3; }).map(function(val) { return val.join(', '); });

    // Sum bids
    for (var bidType in contest.bids) { // each bid type
        var typeTotal = 0;
        var winPool = 0;
        for (var j = 0; j < contest.bids[bidType].length; j++) { // each bid in a type
            var amount = Number(contest.bids[bidType][j].amount);
            var bidOn = contest.bids[bidType][j].on;
            typeTotal += amount;
            if (winning[bidType].indexOf(bidOn) !== -1) {
                contest.bids[bidType][j].won = true;
                winPool += amount;
            } else {
                contest.bids[bidType][j].won = false;
            }
        }
        var afterVig = typeTotal * (1 - Number(contest.vig));

        for (var j = 0; j < contest.bids[bidType].length; j++) {
            var amount = Number(contest.bids[bidType][j].amount);
            if (contest.bids[bidType][j].won) {
                contest.bids[bidType][j].payout = Math.round(100 * afterVig * (amount / winPool)) / 100;
            }
        }
    }

    return contest;
}

//function computePayout(contest) {
//    for (var type in contest['bids']) {
//        var typeTotal = 0;
//        var outcomeTotals = {};
//
//        for (var i = 0; i < contest['bids'][type].length; i++) {
//            var bid = contest['bids'][type][i];
//            typeTotal += Number(bid['amount']);
//            if (! outcomeTotals.hasOwnProperty(bid['on'])) {
//                outcomeTotals[bid['on']] = 0;
//            }
//            outcomeTotals[bid['on']] += Number(bid['amount']);
//        }
//    }
//
//    var board = toteBoard(contest);
//    for (var j in contest.bids) {
//        for (var k = 0; k < contest.bids[j].length; k++) {
//            var bidOn = contest.bids[j][k].on;
//            if (bidOn in board[j]) {
//                contest.bids[j][k].payout = Math.round(100 * board[j][bidOn] * contest.bids[j][k].amount) / 100;
//            } else {
//                contest.bids[j][k].payout = Number.NaN;
//            }
//        }
//    }
//    return contest;
//}

// Homepage
app.get('/', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        var queries = [
            queryAll(db, 'contests'),
        ];

        // Little experiment with promises
        p.when(queries).then(function() {
            var contests = [];
            for (var i = 0; i < params['contests'].length; i++) {
                var contest = computePayout(params['contests'][i]);
                contests.push(contest);
            }
            res.render('index', {
                contests: contests,
            });
            res.end();
            db.close();
        });
    });
});

app.get('/debbug', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        var queries = [
            queryAll(db, 'contests'),
        ];

        // Little experiment with promises
        p.when(queries).then(function() {
            res.write(JSON.stringify(params['contests']));
        });
    });
    //for (var i in process.env) {
    //    res.write(i + ': ' + process.env[i] + '\n');
    //}
});

app.get('/debbbug', function(req, res, next) {
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

// GET a contest
app.get('/contest/:id', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').find({_id: new ObjectId(req.params.id)}).limit(1).next(function(err, doc) {
            if (err) throw err;

            var contest = computePayout(doc);

            res.render('contest', {contest: doc});

            db.close();
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

                        //res.render('contest', {contest: doc});
                        res.send('OK');

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

// Get bids with payouts computed
app.get('/contest/:id/bids', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').find({_id: new ObjectId(req.params.id)}).limit(1).next(function(err, doc) {
            if (err) throw err;

            var contest = computePayout(doc);
            res.render('bids', {bids: contest.bids});

            db.close();
        });
    });
});

// Autocomplete source for contestant names
app.get('/suggest-contestant', function(req, res, next) {
    var suggest = [];
    var terms = req.query.term.split(',').map(function(e){return e.trim()});
    var search = terms.slice(-1)[0].toLowerCase();
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').find().forEach(function(doc) {
            suggest = suggest.concat(doc.contestants.filter(function(e) {
                return e.toLowerCase().indexOf(search) === 0;
            }));
        }, function(err) {
            suggest = suggest.map(function(e){return terms.slice(0,-1).concat([e.trim()]).join(', ')});
            res.send(JSON.stringify(suggest));
            db.close();
        });
    });
});

// Add a new bid to a contest
app.post('/contest/:id/bid', function(req, res, next) {
    mongo.connect(mongoUrl, function(err, db) {
        db.collection('contests').find({_id: new ObjectId(req.params.id)}).limit(1).next(function(err, doc) {
            if (err) throw err;

            switch (req.body.type) {
                case 'win': //fallthrough
                case 'place':
                case 'show':
                    if (req.body.on.split(',').length !== 1) {
                        res.status(400).send(req.body.type + ' bids must include only one name');
                    }
                    break;
                case 'exacta':
                    if (req.body.on.split(',').length !== 2) {
                        res.status(400).send(req.body.type + ' bids must list two comma-separated names');
                    }
                    break;
                case 'trifecta':
                    if (req.body.on.split(',').length !== 3) {
                        res.status(400).send(req.body.type + ' bids must list three comma-separated names');
                    }
                    break;
            }

            var bid = {
                bidder: req.body.bidder,
                amount: req.body.amount,
                on: req.body.on.split(',').map(function(e){return e.trim()}).join(', '),
                won: false,
            };
            var bids = doc.bids;
            bids[req.body.type].push(bid);

            db.collection('contests').findOneAndUpdate(
                {_id: new ObjectId(req.params.id)},
                {$set: {
                    bids: bids,
                }},
                {returnOriginal: false},
                function(err, r) {
                    if (err) throw err;

                    if (r.ok === 1) {
                        var contest = computePayout(r.value);
                        res.render('bids', {bids: contest.bids});
                    } else {
                        res.sendStatus(500);
                    }

                    db.close();
                }
            );
        });
    });
});

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
