$.fn.repeaterVal = function () {
    var parse = function (raw) {
        var parsed = [];

        foreach(raw, function (val, key) {
            var parsedKey = [];
            if(key !== "undefined") {
                // Parse ["units", "0", "name"] from "units[0].name"
                const prefix = key.match(/^[^\[]*/)[0];
                parsedKey.push(prefix);
                const indicesAndAttributes = key
                    .match(/\[[^\]]*\]/g)
                    .concat(key.match(/[^.]+$/g));
                parsedKey = parsedKey.concat(
                    map(indicesAndAttributes, function(bracketed) {
                        return bracketed.replace(/[\[\]]/g, "");
                    })
                );

                parsed.push({
                    val: val,
                    key: parsedKey
                });
            }
        });

        return parsed;
    };

    var build = function (parsed) {
        if(
            parsed.length === 1 &&
            (parsed[0].key.length === 0 || parsed[0].key.length === 1 && !parsed[0].key[0])
        ) {
            return parsed[0].val;
        }

        foreach(parsed, function (p) {
            p.head = p.key.shift();
        });

        var grouped = (function () {
            var grouped = {};

            foreach(parsed, function (p) {
                if(!grouped[p.head]) {
                    grouped[p.head] = [];
                }
                grouped[p.head].push(p);
            });

            return grouped;
        }());

        var built;

        if(/^[0-9]+$/.test(parsed[0].head)) {
            built = [];
            foreach(grouped, function (group) {
                built.push(build(group));
            });
        }
        else {
            built = {};
            foreach(grouped, function (group, key) {
                built[key] = build(group);
            });
        }

        return built;
    };

    return build(parse($(this).inputVal()));
};

$.fn.repeater = function (fig) {
    fig = fig || {};

    var setList;

    $(this).each(function () {

        var $self = $(this);

        var show = fig.show || function () {
            $(this).show();
        };

        var hide = fig.hide || function (removeElement) {
            removeElement();
        };

        var $list = $self.find('[data-repeater-list]').first();

        var $filterNested = function ($items, repeaters) {
            return $items.filter(function () {
                return repeaters ?
                    $(this).closest(
                        pluck(repeaters, 'selector').join(',')
                    ).length === 0 : true;
            });
        };

        var $items = function () {
            return $filterNested($list.find('[data-repeater-item]'), fig.repeaters);
        };

        var $itemTemplate = $list.find('[data-repeater-item]')
                                 .first().clone().hide();

        var $firstDeleteButton = $filterNested(
            $filterNested($(this).find('[data-repeater-item]'), fig.repeaters)
            .first().find('[data-repeater-delete]'),
            fig.repeaters
        );

        if(fig.isFirstItemUndeletable && $firstDeleteButton) {
            $firstDeleteButton.remove();
        }

        var getGroupName = function () {
            var groupName = $list.data('repeater-list');
            return fig.$parent ?
                fig.$parent.data('item-name') + '[' + groupName + ']' :
                groupName;
        };

        var initNested = function ($listItems) {
            if(fig.repeaters) {
                $listItems.each(function () {
                    var $item = $(this);
                    foreach(fig.repeaters, function (nestedFig) {
                        $item.find(nestedFig.selector).repeater(extend(
                            nestedFig, { $parent: $item }
                        ));
                    });
                });
            }
        };

        var $foreachRepeaterInItem = function (repeaters, $item, cb) {
            if(repeaters) {
                foreach(repeaters, function (nestedFig) {
                    cb.call($item.find(nestedFig.selector)[0], nestedFig);
                });
            }
        };

        const setIndexes = function($items, groupName, repeaters) {
            $items.each(function(index) {
                const $item = $(this);
                $item.data("item-name", groupName + "[" + index + "]");
                $filterNested($item.find("[name]"), repeaters).each(function() {
                    const $input = $(this);

                    // supports nested attributes (ie a[0].b.c), does NOT support nested repeating attributes
                    // (ie a[0].b[0].c)
                    const name = $input
                        .attr("name")
                        .split(/(\[[^\]]+]\.)/g)
                        .slice(-1)[0];

                    // THIS OVERWRITES THE PARAMETER BINDING
                    const newName =
                        groupName +
                        "[" +
                        index +
                        "]" +
                        "." +
                        name +
                        ($input.is(":checkbox[data-repeater-boolean!='true']") ||
                            $input.attr("multiple")
                            ? "[]"
                            : "");

                    $input.attr("name", newName);

                    $foreachRepeaterInItem(repeaters, $item, function(nestedFig) {
                        const $repeater = $(this);
                        setIndexes(
                            $filterNested(
                                $repeater.find("[data-repeater-item]"),
                                nestedFig.repeaters || []
                            ),
                            // THIS OVERWRITES THE PARAMETER BINDING
                            groupName +
                            "[" +
                            index +
                            "]" +
                            "." +
                            $repeater
                            .find("[data-repeater-list]")
                            .first()
                            .data("repeater-list"),
                            nestedFig.repeaters
                        );
                    });
                });
            });

            $list
                .find("input[name][checked]")
                .removeAttr("checked")
                .prop("checked", true);
        };


        setIndexes($items(), getGroupName(), fig.repeaters);
        initNested($items());
        if(fig.initEmpty) {
            $items().remove();
        }

        if(fig.ready) {
            fig.ready(function () {
                setIndexes($items(), getGroupName(), fig.repeaters);
            });
        }

        const appendItem = (function() {
            const setItemsValues = function($item, data, repeaters) {
                if (data || fig.defaultValues) {
                    const inputNames = {};
                    $filterNested($item.find("[name]"), repeaters).each(function() {
                        // EDITED FROM ORIGINAL: parse "name" from "units[0].name"
                        const key = $(this)
                            .attr("name")
                            .match(/[^.]+$/)[0];
                        inputNames[key] = $(this).attr("name");
                    });

                    $item.inputVal(
                        map(
                            filter(data || fig.defaultValues, function(val, name) {
                                return inputNames[name];
                            }),
                            identity,
                            function(name) {
                                return inputNames[name];
                            }
                        )
                    );
                }

                $foreachRepeaterInItem(repeaters, $item, function(nestedFig) {
                    const $repeater = $(this);
                    $filterNested(
                        $repeater.find("[data-repeater-item]"),
                        nestedFig.repeaters
                    ).each(function() {
                        const fieldName = $repeater
                            .find("[data-repeater-list]")
                            .data("repeater-list");
                        if (data && data[fieldName]) {
                            const $template = $(this).clone();
                            $repeater.find("[data-repeater-item]").remove();
                            foreach(data[fieldName], function(data) {
                                const $item = $template.clone();
                                setItemsValues($item, data, nestedFig.repeaters || []);
                                $repeater.find("[data-repeater-list]").append($item);
                            });
                        } else {
                            setItemsValues(
                                $(this),
                                nestedFig.defaultValues,
                                nestedFig.repeaters || []
                            );
                        }
                    });
                });
            };

            return function($item, data) {
                $list.append($item);
                setIndexes($items(), getGroupName(), fig.repeaters);
                $item.find("[name]").each(function() {
                    $(this).inputClear();
                });
                setItemsValues($item, data || fig.defaultValues, fig.repeaters);
            };
        })();

        var addItem = function (data) {
            var $item = $itemTemplate.clone();
            appendItem($item, data);
            if(fig.repeaters) {
                initNested($item);
            }
            show.call($item.get(0));
        };

        setList = function (rows) {
            $items().remove();
            foreach(rows, addItem);
        };

        $filterNested($self.find('[data-repeater-create]'), fig.repeaters).click(function () {
            addItem();
        });

        $list.on('click', '[data-repeater-delete]', function () {
            var self = $(this).closest('[data-repeater-item]').get(0);
            hide.call(self, function () {
                $(self).remove();
                setIndexes($items(), getGroupName(), fig.repeaters);
            });
        });
    });

    this.setList = setList;

    return this;
};
