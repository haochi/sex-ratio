class FusionTableResult {
    constructor(result) {
        var columnsLookup = _.invert(result.columns);
        this.rows = result.rows.map(row => new FusionTableRow(row, columnsLookup));
    }

    getData() {
        return this.rows;
    }
}

class FusionTableRow {
    constructor(row, columnsLookup) {
        this.row = row;
        this.columnsLookup = columnsLookup;
    }

    get (column) {
        return this.row[this.columnsLookup[column]];
    }

    set(column, value) {
        this.row[this.columnsLookup[column]] = value;
    }
}

angular.module("app", ['rzModule', 'ihaochi'])
.constant("MAX_AGE", 85)
.constant("MIN_AGE", 0)
.config(($sceDelegateProvider) => {
    $sceDelegateProvider.resourceUrlWhitelist([
        "self",
        "https://www.googleapis.com/**"
    ]);
})
.service("fusionTableService", class {
    constructor($http) {
        this.$http = $http;
    }

    loadFromFile(url) {
        return this.$http.get(url).then(this.responseToResult);
    }

    responseToResult(response) {
        return new FusionTableResult(response.data);
    }
})
.service("mapsService", class {
    geometryToArray(geometry) {
        return geometry.coordinates.map(coordinate => {
            return coordinate.map(([lng, lat]) => ({ lat, lng}));
        });
    }

    getLatlngBoundsFromLatLngs(latlngs) {
        const bounds = new google.maps.LatLngBounds();
        latlngs.forEach(latlng => bounds.extend(latlng));

        return bounds;
    }

    kmlToPaths(kml) {
        var geometries = [];

        if (kml.geometry) {
            geometries = [kml.geometry];
        } else if (kml.geometries) {
            geometries = kml.geometries;
        }

        return _.chain(geometries)
            .map(this.geometryToArray)
            .flatten()
            .value();
    }
})
.service("popAgeSexService", class {
    constructor(MAX_AGE) {
        this.MAX_AGE = MAX_AGE;
    }

    generateRangeKey(sex, from, to) {
        var prefix = "est72015sex";
        var withoutTo = prefix + sex + "_age" + from;
         if (to) {
            return withoutTo + "to" + to;
         } else {
            return withoutTo + "plus"
         }
    }

    generateAgeGroup(from, to) {
        return {
            male: this.generateRangeKey(1, from, to),
            female: this.generateRangeKey(2, from, to)
        };
    };

    getAgeGroups(min, max) {
        const groups = [];
        for(let i=min; i<max;i+=5) {
            groups.push(this.generateAgeGroup(i, i + 4));
        }

        if (this.MAX_AGE === max) {
            groups.push(this.generateAgeGroup(max));
        }

        return groups;
    }

    getAgeGroupsLabel(min, max) {
        const groups = [];
        for(let i=min; i<max;i+=5) {
            groups.push(`${i} to ${i + 4}`);
        }

        if (this.MAX_AGE === max) {
            groups.push(`${this.MAX_AGE}+`);
        }

        return groups;
    }

    displayMaxAge(age) {
        if (age === this.MAX_AGE) {
            return age + "+";
        }
        return age - 1;
    }

    calculatePopulationChart([minAge, maxAge], counties) {
        return this.getAgeGroups(minAge, maxAge).map(({male, female}) => {
            let totalMalePop = 0;
            let totalFemalePop = 0;
            counties.forEach(county => {
                totalMalePop += county.get(male);
                totalFemalePop += county.get(female);
            });
            return [totalMalePop, totalFemalePop];
        });
    };
})
.service('chartService', class {
    constructor($sce) {
        const legend = [{
            display: "&le; 0.93",
            test: (ratio) => ratio <= 0.93
        }, {
            display: "&le; 0.95",
            test: (ratio) => ratio <= 0.95
        }, {
            display: "&le; 0.97",
            test: (ratio) => ratio <= 0.97
        }, {
            display: "&le; 0.99",
            test: (ratio) => ratio <= 0.99
        }, {
            display: "1",
            test: (ratio) => Math.abs(1 - ratio) < 0.009,
            color: "#fff"
        }, {
            display: "&le; 1.01",
            test: (ratio) => ratio <= 1.01
        }, {
            display: "&le; 1.03",
            test: (ratio) => ratio <= 1.03
        }, {
            display: "&le; 1.05",
            test: (ratio) => ratio <= 1.05
        }, {
            display: "> 1.05",
            test: (ratio) => ratio > 1.05
        }];

        const color = chroma.scale(["red", "white", "blue"]).domain([0, legend.length]);

        this.legend = legend.map((label, i) => {
            label.display = $sce.trustAsHtml(label.display);
            if (!label.color) {
                label.color = color(i).hex();
            }
            return label;
        });
    }

    colorizeLegend(ratio) {
        for (let label of this.legend) {
            if (label.test(ratio)) {
                return label.color;
            }
        }
    }
})
.service("dataManipulationService", class {
    join([s1, s2]) {
        const [s1Table, s1JoinKey, s1Columns] = s1;
        const [s2Table, s2JoinKey, s2Columns] = s2;

        const s2Map = new Map(s2Table.getData().map(record => [record.get(s2JoinKey), record]));
        const result = [];

        s1Table.getData().forEach(s1Record => {
            const id = s1Record.get(s1JoinKey);
            if (s2Map.has(id)) {
                const record = new Map();
                const s2Record = s2Map.get(id);
                s1Columns.forEach(column => record.set(column, s1Record.get(column)));
                s2Columns.forEach(column => record.set(column, s2Record.get(column)));

                result.push(record);
            }
        });

        return result;
    }
})
.controller("AppController", function ($timeout, $q, $sce, $location, dataManipulationService, mapsService, fusionTableService, popAgeSexService, chartService, MIN_AGE, MAX_AGE) {
    // constants
    const ctrl = this;
    const chart = document.querySelector('.chart');
    const map = new google.maps.Map(document.querySelector(".map"), {
        center: {lat: 39.828175, lng: -98.5795},
        zoom: 4,
        styles: [
            {
                "featureType": "landscape",
                "stylers": [
                    { "visibility": "off" }
                ]
            },
            {
                "featureType": "road",
                "stylers": [
                    { "visibility": "off" }
                ]
            },
            {
                "featureType": "poi",
                "stylers": [
                    { "visibility": "off" }
                ]
            },
            {
                "stylers": [
                    {saturation: -100}
                ]
            }
        ]
    });
    const marker = new google.maps.Marker({ map });
    const allAgeGroups = popAgeSexService.getAgeGroups(MIN_AGE, MAX_AGE);
    const allAgeGroupsArray = _.chain(allAgeGroups).map(ageGroup => [ageGroup.male, ageGroup.female]).flatten().value();
    const defaultChartTitleTemplate = _.template(`<%- location %> Population By Age Group <% if (range) { %> (Ages: <%- range %>) <% } %>`);
    const STEP = 5;
    const OPACITY = 0.5;
    const DEFAULT_COUNTY_OPTIONS = { strokeWeight: 0.1, fillOpacity: OPACITY };
    const HIGHLIGHT_COUNTY_OPTIONS = { strokeWeight: 1, fillOpacity: 0.9 };

    // variables
    ctrl.LEGEND_OPACITY = OPACITY;

    ctrl.minAge = MIN_AGE;
    ctrl.maxAge = MAX_AGE;
    ctrl.highlightRatio = 20;
    ctrl.selectedCounty = null;

    ctrl.legend = chartService.legend;
    ctrl.counties = [];
    ctrl.loading = false;

    ctrl.ageSliderOptions = {
        step: STEP,
        floor: MIN_AGE,
        ceil: MAX_AGE,
        onEnd() {
            ctrl.updateUI(ctrl.minAge, ctrl.maxAge, null, ctrl.highlightRatio);
        },
        translate(value, sliderId, label) {
            if (["ceil", "high"].includes(label)) {
                return popAgeSexService.displayMaxAge(value);
            }
            return value;
        }
    };

    ctrl.ratioSliderOptions = {
        floor: 10,
        ceil: 200,
        onEnd() {
            ctrl.updateUI(ctrl.minAge, ctrl.maxAge, null, ctrl.highlightRatio);
        },
        translate(value) {
            return value + '%';
        }
    };

    ctrl.selectCounty = (county) => {
        ctrl.selectedCounty = county;

        if (county) {
            const bounds = mapsService.getLatlngBoundsFromLatLngs(_.flatten(county.get('shape').getPaths().getArray().map(array => array.getArray())));
            marker.setPosition(bounds.getCenter());
        }

        marker.setVisible(!!county);
    };

    ctrl.calculateRatio = (left, right) => {
        if (left === right) { // resolve 0 / 0
            return 1;
        }

        if (right === 0) { // resolve left / 0
            return 9000;
        }

        return left / right;
    };

    ctrl.updateAge = () => {
        const ageGroups = popAgeSexService.getAgeGroups(ctrl.minAge, ctrl.maxAge);

        ctrl.counties.forEach(county => {
            let totalMalePop = 0;
            let totalFemalePop = 0;

            ageGroups.map(({male, female}) => {
                totalMalePop += county.get(male);
                totalFemalePop += county.get(female);
            });

            const ratio = ctrl.calculateRatio(totalMalePop, totalFemalePop);

            county.set('male', totalMalePop);
            county.set('female', totalFemalePop);
            county.set('ratio', ratio);

            county.get('shape').setOptions({
                fillColor: chartService.colorizeLegend(ratio)
            });
        });
    };

    ctrl.updateHighlight = () => {
        ctrl.counties.forEach(county => {
            const ratio = county.get('ratio');
            const greaterThanHighlightThreshold = Math.abs(1 - ratio) > (ctrl.highlightRatio / 100);

            county.get('shape').setOptions(greaterThanHighlightThreshold ? HIGHLIGHT_COUNTY_OPTIONS : DEFAULT_COUNTY_OPTIONS);
        });
    };

    ctrl.updateUI = (minAge, maxAge, county, highlightRatio) => {
        ctrl.selectCounty(county);
        ctrl.updateAge(); // sets the ratio
        ctrl.updateChart();
        ctrl.updateHighlight();

        $location.search('county', county && county.get("GEO_ID2"));
        $location.search('ratio', highlightRatio);
        $location.search('minAge', minAge);
        $location.search('maxAge', maxAge);

    };

    ctrl.setupChart = () => {
        const chartXLabels = popAgeSexService.getAgeGroupsLabel(MIN_AGE, MAX_AGE);
        Plotly.newPlot(chart, [{
            x: chartXLabels,
            y: [],
            name: 'Male',
            type: 'bar',
            marker: { color: chroma(_.last(ctrl.legend).color).alpha(ctrl.LEGEND_OPACITY).css() }
        }, {
            x: chartXLabels,
            y: [],
            name: 'Female',
            type: 'bar',
            marker: { color: chroma(_.first(ctrl.legend).color).alpha(ctrl.LEGEND_OPACITY).css()}
        }], {
            xaxis: {title: 'Age Group'},
            yaxis: {title: 'Population'},
            barmode: 'group'
        });

        window.addEventListener("resize", _.debounce(() => {
            Plotly.Plots.resize(chart);
        }, 500));
    };

    ctrl.updateChart = () => {
        let minAge;
        let maxAge;
        let counties = [];
        let location = '';
        let selectedCounty = ctrl.selectedCounty;

        if (selectedCounty) {
            counties = [selectedCounty];
            location = `${selectedCounty.get('County Name')}, ${selectedCounty.get('State Abbr')}`;
            minAge = MIN_AGE;
            maxAge = MAX_AGE;
        } else {
            counties = ctrl.counties;
            location = "US";
            minAge = ctrl.minAge;
            maxAge = ctrl.maxAge;
        }

        const chartXLabels = popAgeSexService.getAgeGroupsLabel(minAge, maxAge);
        const popPyramidSeries = popAgeSexService.calculatePopulationChart([minAge, maxAge], counties);
        const data = { location, range: null };

        if (minAge !== MIN_AGE || maxAge !== MAX_AGE) {
            data.range = `${minAge} to ${popAgeSexService.displayMaxAge(maxAge)}`;
        }

        chart.layout.title = defaultChartTitleTemplate(data);
        chart.data.forEach((bar, i) => {
            bar.x = chartXLabels;
            bar.y = popPyramidSeries.map(set => set[i]);
        });

        Plotly.redraw(chart);
    };

    ctrl.setupSearchVariables = () => {
        const { minAge, maxAge, ratio, county } = $location.search();
        const resolvedMinAge = parseInt(minAge, 10);
        const resolveMaxAge = parseInt(maxAge, 10);
        const resolveRatio = parseInt(ratio, 10);
        const resolveCounty = _.find(ctrl.counties, c => c.get('GEO_ID2') === county);

        if (Number.isFinite(resolvedMinAge)) {
            ctrl.minAge = resolvedMinAge;
        }

        if (Number.isFinite(resolveMaxAge)) {
            ctrl.maxAge = resolveMaxAge;
        }

        if (Number.isFinite(resolveRatio)) {
            ctrl.highlightRatio = resolveRatio;
        }

        if (resolveCounty) {
            ctrl.selectedCounty = resolveCounty;
        }
    };

    // init
    ctrl.loading = true;
    $q.all([
        fusionTableService.loadFromFile("./data/population.json"),
        fusionTableService.loadFromFile("./data/county-shapes.json"),
        fusionTableService.loadFromFile("./data/state-shapes.json")
    ]).then(function ([populationResult, countyShapeResult, stateShapeResult]) {
        ctrl.counties = dataManipulationService.join([
            [populationResult, "GEO.id2", allAgeGroupsArray],
            [countyShapeResult, "GEO_ID2", ["geometry", "State Abbr", "County Name", "GEO_ID2"]]
        ]);

        ctrl.counties.forEach(county => {
            const paths = mapsService.kmlToPaths(county.get("geometry"));

            const shape = new google.maps.Polygon(_.assign({
                map,
                paths
            }, DEFAULT_COUNTY_OPTIONS));

            shape.addListener("click", () => {
                $timeout(() => ctrl.updateUI(ctrl.minAge, ctrl.maxAge, county, ctrl.highlightRatio));
            });

            shape.addListener("mouseover", () => {
                $timeout(() => ctrl.hoverCounty = county);
            });

            shape.addListener("mouseout", () => {
                $timeout(() => ctrl.hoverCounty = null);
            });

            county.set("shape", shape);

            allAgeGroupsArray.forEach(ageGroup => {
                county.set(ageGroup, parseInt(county.get(ageGroup), 10));
            });
        });

        stateShapeResult.getData().forEach(state => {
            const paths = mapsService.kmlToPaths(state.get("geometry"));

            paths.forEach(path => {
                new google.maps.Polyline({
                    map,
                    path,
                    strokeColor: "#555",
                    strokeWeight: 1.5
                });
            });
        });

        ctrl.setupSearchVariables();
        ctrl.setupChart();

        ctrl.updateUI(ctrl.minAge, ctrl.maxAge, ctrl.selectedCounty, ctrl.highlightRatio);

        ctrl.loading = false;
    });
});