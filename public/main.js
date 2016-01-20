(function($) {
    var syncXhr = null;

    function sync($contest) {
        $contest = $contest || $(this).closest('.contest');

        if (syncXhr !== null && syncXhr.readyState !== 4) {
            //$contest.addClass('modified');
            return false;
        }

        var vig = parseFloat($contest.find('.vig').val());
        var data = {
            vig: (vig !== Math.NaN && vig >= 0 && vig <= 1) ? vig : 0.15,
            brackets: [],
            bids: {
                win: [],
                place: [],
                show: [],
                exacta: [],
                trifecta: [],
            },
        };
        $contest.find('.bracket:not(.prototype)').each(function(i, e) {
            var bracket = [];
            $(e).find('.match:not(.prototype)').each(function(j, f) {
                var match = {
                    contestants: $(f).find('.name').map(function(k,g){return $(g).text()}).get().slice(0, 2),
                    winner: $(f).find('.name.winner').first().text(),
                };
                bracket.push(match);
            });
            data['brackets'].push(bracket)
        });
        $contest.find('.bid-type').each(function(i, e) {
            $(e).find('.bid').each(function(j, f) {
                data['bids'][$(e).data('type')].push({
                    bidder: $(f).find('.bidder').data('val'),
                    amount: $(f).find('.amount').data('val'),
                    on: $(f).find('.on').data('val'),
                });
            });
        });

        $.ajax({
            url: '/contest/' + $contest.data('contest-id'),
            data: JSON.stringify(data),
            contentType: 'application/json',
            method: 'PUT',
            xhr: function() {
                //if (syncXhr !== null && syncXhr.readyState !== 4) {
                //    syncXhr.abort();
                //}
                syncXhr = new XMLHttpRequest();
                return syncXhr;
            },
            beforeSend: function() {
                var $img = $('<img src="/loading.gif" class="loading-gif" />');
                $img.css({
                    position: 'absolute',
                    right: '-35px',
                    top: '0px',
                });
                $img.appendTo($contest.find('.brackets'));
            },
            context: $contest,
            success: function(data) {
                $(this).find('.loading-gif').remove();
                //$(this).removeClass('modified');
                //$('.contest.modified').each(function(i, e) {
                //    sync.call(e);
                //});
                //$(this).closest('.contest').replaceWith(data);
                //setupDragging();
            },
        });
    }

    function setupDragging() {
        $('.bracket tbody').sortable({
            axis: 'y',
            handle: '.controls .move',
            items: '.match',
            update: sync,
        });

        $('.contestant .name').draggable({
            revert: 'invalid',
            scope: 'contestants',
        });

        $('.contestant').droppable({
            activate: function(event, ui) {
                if (! $(this).is(':has(.name)')) {
                    $(this).addClass('active-droppable');
                }
            },
            deactivate: function(event, ui) {
                $(this).removeClass('active-droppable');
            },
            drop: function(event, ui) {
                if ($(this).is(':has(.name)')) {
                    ui.draggable.css({left:0,top:0});
                } else if (ui.draggable.closest('.bracket').is($(this).closest('.bracket'))) {
                    ui.draggable.css({left:0,top:0}).appendTo(this);
                    sync.call(this);
                } else {
                    ui.draggable.css({left:0,top:0}).clone().removeClass('winner').appendTo(this);
                    sync.call(this);
                    $('.contestant .name').draggable({
                        revert: 'invalid',
                        scope: 'contestants',
                    });
                }
            },
            scope: 'contestants',
        });

        $('img.delete').droppable({
            activate: function(event, ui) {
                $(this).attr('src', '/delete-box-active.png');
            },
            deactivate: function(event, ui) {
                $(this).attr('src', '/delete-box.png');
            },
            drop: function(event, ui) {
                var $match = ui.draggable.closest('.match');
                ui.draggable.remove();
                sync.call(this);
            },
            scope: 'contestants',
        });
    }

    function evaluateOutcome($contest) {
        var exacta = [];
        var trifecta = [];
        var $brackets = $contest.find('.bracket:not(.prototype)');
        $('.bid').css('color', 'initial');
        $('.payout').hide();

        for (var i = -3; i < 0; i++) {
            var $bracket = $brackets.eq(i);
            $bracket.find('.winner').each(function() {
                var name = $(this).text().trim();

                $contest.find('.bids .bid-type.show .bid').each(function() {
                    if ($(this).find('.on').text().trim() === name) {
                        $(this).css('color', 'green');
                        $(this).find('.payout').show();
                    }
                });
                if (i <= -2) {
                    $contest.find('.bids .bid-type.place .bid').each(function() {
                        if ($(this).find('.on').text().trim() === name) {
                            $(this).css('color', 'green');
                            $(this).find('.payout').show();
                        }
                    });
                }
                if (i == -1) {
                    $contest.find('.bids .bid-type.win .bid').each(function() {
                        if ($(this).find('.on').text().trim() === name) {
                            $(this).css('color', 'green');
                            $(this).find('.payout').show();
                        }
                    });
                }

                if (i == -3) {
                    trifecta.push(name);
                } else if (i == -2) {
                    exacta.push(name);
                    trifecta = trifecta.concat(trifecta.filter(function(val) {
                        return val.length == 1
                    }).map(function(val) {
                        return [val, name];
                    }));
                } else {
                    exacta = exacta.concat(exacta.filter(function(val) {
                        return val.length == 1
                    }).map(function(val) {
                        return [val, name];
                    }));
                    trifecta = trifecta.concat(trifecta.filter(function(val) {
                        return val.length == 2
                    }).map(function(val) {
                        return [val[0], val[1], name];
                    }));
                }
            });
        }
        for // TODO loop over bids and check in winner type lists
    }

    $(document).ready(function() {
        $('div.contests').on('keydown', '.new-contestant', function(event) {
            if (event.which == 13 && $(this).val().trim()) {
                var $newContestant = $('<div class="name">').html($(this).val());

                var $bracket = $(this).closest('.contest').find('.bracket').first();
                var $target = $bracket.find('.match:not(.prototype) .contestant:not(:has(.name))').first();
                if (! $target.length) {
                    var $prototype = $bracket.find('.match.prototype');
                    var $clone = $prototype.clone().removeClass('prototype');
                    $clone.insertBefore($prototype);
                    $target = $clone.find('.contestant:not(:has(.name))').first();
                }
                $target.append($newContestant);
                sync.call(this);
                $(this).val('');
                $('.contestant .name').draggable({
                    revert: 'invalid',
                    scope: 'contestants',
                });
            }
        });

        // New contest
        $('div.contests').on('click', '.contest.new a.new', function() {
            $.ajax({
                url: '/contest/new',
                method: 'POST',
                context: this,
                success: function(data) {
                    $(this).closest('.contest.new').before(data);
                    setupDragging();
                },
            });
        });

        // Delete contest
        $('div.contests').on('click', '.contest > .controls > a.delete', function() {
            if (confirm('Really delete this contest?')) {
                var contestId = $(this).closest('[data-contest-id]').data('contest-id');
                $.ajax({
                    url: '/contest/' + contestId + '/delete',
                    method: 'POST',
                    context: this,
                    success: function(data) {
                        $(this).closest('.contest').remove();
                    },
                });
            }
        });

        // New match
        $('div.contests').on('click', '.bracket a.new-match', function() {
            var $bracket = $(this).closest('.bracket');
            if ($bracket.is('.prototype')) {
                $bracket = $bracket.clone().removeClass('prototype').insertBefore($bracket);
            }
            var $prototype = $bracket.find('.match.prototype');
            var $clone = $prototype.clone().removeClass('prototype');
            $clone.insertBefore($prototype);
            sync.call(this);
            setupDragging();
        });

        // Delete match
        $('div.contests').on('click', '.match > .controls > a.delete', function() {
            var $contest = $(this).closest('.contest');
            var $bracket = $(this).closest('.bracket');
            $(this).closest('.match').remove();
            if ($bracket.is(':not(:has(.match:not(.prototype)))')) {
                $bracket.remove();
            }
            sync.call($contest);
        });

        // Toggle winner
        $('div.contests').on('dblclick', '.contestant .name', function() {
            $(this).parent().siblings().children().removeClass('winner');
            $(this).toggleClass('winner');
            sync.call(this);
            evaluateOutcome($(this).closest('.contest'));
        });

        $('div.contests').sortable({
            items: '.contest:not(.new)',
            axis: 'y',
            handle: '.move',
            update: function(event, ui) {
                var data = [];
                $('div.contests .contest[data-contest-id]').each(function(i, e) {
                    data.push({
                        id: $(e).data('contest-id'),
                        priority: i,
                    });
                });
                $.ajax({
                    url: '/contests/reorder',
                    data: JSON.stringify(data),
                    contentType: 'application/json',
                    method: 'POST',
                });
            },
        });

        setupDragging();
    });
})(jQuery)
