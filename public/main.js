(function($) {
    $(document).ready(function() {
        $('div.contests').on('keydown', 'input', function(event) {
            if (event.which == 13) {
                var vig = parseFloat($(this).closest('.vig').val());
                var data = {
                    vig: (vig !== Math.NaN && vig >= 0 && vig <= 1) ? vig : 0.15,
                    contestants: [],
                };
                $(this).closest('.contest').find('.contestant').each(function(i, e) {
                    var name = $(e).find('.name').val().trim();
                    var bids = [];
                    $(e).find('.bids .bid').each(function(j, f) {
                        var bidder = $(f).find('.bidder').val().trim();
                        var amount = parseFloat($(f).find('.amount').val());
                        if (bidder && amount) {
                            bids.push({
                                bidder: bidder,
                                amount: amount,
                            })
                        }
                    });
                    if (name) {
                        data['contestants'].push({
                            name: name,
                            bids: bids,
                        });
                    }
                });

                var contestId = $(this).closest('[data-contest-id]').data('contest-id');
                var inputIdx = $('input').index(this);
                $.ajax({
                    url: '/contest/' + contestId + '/contestants',
                    data: JSON.stringify(data),
                    contentType: 'application/json',
                    method: 'POST',
                    context: this,
                    success: function(data) {
                        $(this).closest('.contest').replaceWith(data);
                        $('input:eq(' + (inputIdx + 1) + ')').focus();
                    },
                });
            } else {
                //alert(event.which);
            }
        });

        $('div.contests').on('click', '.contest.new a', function() {
            $.ajax({
                url: '/contest/new',
                context: this,
                success: function(data) {
                    $(this).closest('.contest.new').before(data);
                },
            });
        });

        $('div.contests').on('click', 'a.delete', function() {
            var contestId = $(this).closest('[data-contest-id]').data('contest-id');
            $.ajax({
                url: '/contest/' + contestId + '/delete',
                method: 'POST',
                context: this,
                success: function(data) {
                    $(this).closest('.contest').remove();
                },
            });
        });

        $('div.contests').sortable({
            items: '.contest:not(.new)',
            axis: 'y',
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

        $('.match').draggable({
        });

        $('.brackets .bracket').droppable({
            drop: function(event, ui) {
                ui.draggable.appendTo(this);
            },
        });

        //$('.brackets
    });
})(jQuery)
