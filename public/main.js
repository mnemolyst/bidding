(function($) {
    function sync() {
        var $contest = $(this).closest('.contest');
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
                    winner: $(f).find('.contestant.winner').first().text(),
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
            context: this,
            success: function(data) {
                $(this).closest('.contest').replaceWith(data);
                setupDragging();
            },
        });
    }

    function setupDragging() {
        $('.bracket tbody').sortable({
            axis: 'y',
            handle: '.handle',
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
                } else {
                    ui.draggable.css({left:0,top:0}).clone().appendTo(this);
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
                if ($match.is(':not(:has(.name))')) {
                    $match.remove();
                }
            },
            scope: 'contestants',
        });
    }

    $(document).ready(function() {
        $('div.contests').on('keydown', '.new-contestant', function(event) {
            if (event.which == 13 && $(this).val().trim()) {
                $newContestant = $('<div class="name">').html($(this).val());

                $bracket = $(this).closest('.contest').find('.bracket').first();
                $target = $bracket.find('.match:not(.prototype) .contestant:not(:has(.name))').first();
                if (! $target.length) {
                    $prototype = $bracket.find('.match.prototype');
                    $clone = $prototype.clone().removeClass('prototype');
                    $clone.insertBefore($prototype);
                    $target = $clone.find('.contestant:not(:has(.name))').first();
                }
                $target.append($newContestant);
                $(this).val('');
                $('.contestant .name').draggable({
                    revert: 'invalid',
                    scope: 'contestants',
                });
            }
        });

        //$('div.contests').on('keydown', 'input', function(event) {
        //    if (event.which == 13) {
        //        var vig = parseFloat($(this).closest('.vig').val());
        //        var data = {
        //            vig: (vig !== Math.NaN && vig >= 0 && vig <= 1) ? vig : 0.15,
        //            contestants: [],
        //        };
        //        $(this).closest('.contest').find('.contestant').each(function(i, e) {
        //            var name = $(e).find('.name').val().trim();
        //            var bids = [];
        //            $(e).find('.bids .bid').each(function(j, f) {
        //                var bidder = $(f).find('.bidder').val().trim();
        //                var amount = parseFloat($(f).find('.amount').val());
        //                if (bidder && amount) {
        //                    bids.push({
        //                        bidder: bidder,
        //                        amount: amount,
        //                    })
        //                }
        //            });
        //            if (name) {
        //                data['contestants'].push({
        //                    name: name,
        //                    bids: bids,
        //                });
        //            }
        //        });

        //        var contestId = $(this).closest('[data-contest-id]').data('contest-id');
        //        var inputIdx = $('input').index(this);
        //        $.ajax({
        //            url: '/contest/' + contestId + '/contestants',
        //            data: JSON.stringify(data),
        //            contentType: 'application/json',
        //            method: 'POST',
        //            context: this,
        //            success: function(data) {
        //                $(this).closest('.contest').replaceWith(data);
        //                $('input:eq(' + (inputIdx + 1) + ')').focus();
        //            },
        //        });
        //    } else {
        //        //alert(event.which);
        //    }
        //});

        $('div.contests').on('click', '.contest.new a.new', function() {
            $.ajax({
                url: '/contest/new',
                context: this,
                success: function(data) {
                    $(this).closest('.contest.new').before(data);
                },
            });
        });

        $('div.contests').on('click', 'a.delete', function() {
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

        $('div.contests').on('click', '.bracket a.new-match', function() {
            $prototype = $(this).closest('.bracket').find('.match.prototype');
            $clone = $prototype.clone().removeClass('prototype');
            $clone.insertBefore($prototype);
        });

        $('div.contests').on('dblclick', '.contestant', function() {
            $(this).siblings().removeClass('winner');
            $(this).toggleClass('winner');
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
