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

class FusionTableQuery {
    constructor() {
        this.columns = [];
        this.table = null;
    }

    select(columns) {
        this.columns = columns;
        return this;
    }

    from(table) {
        this.table = table;
        return this;
    }

    toString() {
        const columns = this.columns.map(column => `'${column}'`).join(", ");
        return `SELECT ${columns} FROM ${this.table}`;
    }
}

angular.module("app", [])
.constant("GOOGLE_API_KEY", "AIzaSyDsduO715MGz0asWUbZfkqGo3EyObWpY-0")
.constant("MAX_AGE", 85)
.constant("MIN_AGE", 0)
.config(($sceDelegateProvider) => {
    $sceDelegateProvider.resourceUrlWhitelist([
        "self",
        "https://www.googleapis.com/**"
    ]);
})
.service("fusionTableService", class {
    constructor($http, GOOGLE_API_KEY) {
        this.$http = $http;
        this.GOOGLE_API_KEY = GOOGLE_API_KEY;
    }

    query(sql) {
        return this.$http.jsonp( "https://www.googleapis.com/fusiontables/v2/query", {
            params: {
                sql: sql,
                key: this.GOOGLE_API_KEY
            }
        }).then(this.responseToResult);
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
        this.legend = [{
            ratio: 0.95,
            color: "#c51b7e",
            label: $sce.trustAsHtml("&le; 0.95")
        }, {
            ratio: 0.97,
            color: "#e9a3c9",
            label: $sce.trustAsHtml("&le; 0.97")
        }, {
            ratio: 0.99,
            color: "#fde0ef",
            label: $sce.trustAsHtml("&le; 0.99")
        }, {
            ratio: 1,
            color: "#d1e5f0",
            label: $sce.trustAsHtml("&le; 1")
        }, {
            ratio: 1.03,
            color: "#67a9cf",
            label: $sce.trustAsHtml("&le; 1.03")
        }, {
            ratio: Infinity,
            color: "#2167ac",
            label: $sce.trustAsHtml("> 1.03")
        }];
    }

    colorizeLegend(ratio) {
        for (let label of this.legend) {
            if (ratio <= label.ratio) {
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
.controller("AppController", function ($scope, $q, $sce, dataManipulationService, mapsService, fusionTableService, popAgeSexService, chartService, MIN_AGE, MAX_AGE) {
    // constants
    const ctrl = this;
    const chart = document.querySelector('#chart');
    const map = new google.maps.Map(document.querySelector(".map"), {
        center: {lat: 39.828175, lng: -98.5795},
        zoom: 4
    });
    const allAgeGroups = popAgeSexService.getAgeGroups(MIN_AGE, MAX_AGE);
    const allAgeGroupsArray = _.chain(allAgeGroups).map(function (ageGroup) {
        return [ageGroup.male, ageGroup.female];
    }).flatten().value();
    const defaultChartTitleTemplate = _.template("<%= location %> Population By Age Group");

    // variables
    ctrl.MIN_AGE = MIN_AGE;
    ctrl.MAX_AGE = MAX_AGE;
    ctrl.STEP = 5;

    ctrl.minAge = ctrl.MIN_AGE;
    ctrl.maxAge = ctrl.MAX_AGE;

    ctrl.legend = chartService.legend;
    ctrl.selectedCounty = null;
    ctrl.counties = [];

    // methods
    ctrl.enforceMinMaxAge = () => {
        ctrl.minAge = Math.min(ctrl.minAge, ctrl.maxAge);
        ctrl.maxAge = Math.max(ctrl.minAge, ctrl.maxAge);

        if (ctrl.minAge === MAX_AGE) {
            ctrl.minAge -= ctrl.STEP;
        }

        if (ctrl.minAge === ctrl.maxAge) {
            ctrl.maxAge += ctrl.STEP;
        }
    };

    ctrl.selectCounty = (county) => {
        ctrl.selectedCounty = county;
        ctrl.updateChart(`${county.get('County Name')}, ${county.get('State Abbr')}`, [county]);
    };

    ctrl.updateAge = () => {
        ctrl.enforceMinMaxAge();

        const ageGroups = popAgeSexService.getAgeGroups(ctrl.minAge, ctrl.maxAge);

        ctrl.counties.forEach(county => {
            let totalMalePop = 0;
            let totalFemalePop = 0;

            ageGroups.map(({male, female}) => {
                totalMalePop += county.get(male);
                totalFemalePop += county.get(female);
            });

            let ratio = totalMalePop / totalFemalePop;

            county.get('shape').setOptions({
                fillColor: chartService.colorizeLegend(ratio)
            });
        });

        ctrl.updateChart("US", ctrl.counties);
    };

    ctrl.setupChart = () => {
        const chartXLabels = popAgeSexService.getAgeGroupsLabel(MIN_AGE, MAX_AGE);
        Plotly.newPlot(chart, [{
            x: chartXLabels,
            y: [],
            name: 'Male',
            type: 'bar'
        }, {
            x: chartXLabels,
            y: [],
            name: 'Female',
            type: 'bar'
        }], {
            xaxis: {title: 'Age Group'},
            yaxis: {title: 'Population'},
            barmode: 'group'
        });

        window.addEventListener("resize", _.debounce(() => {
            Plotly.Plots.resize(chart);
        }, 500));
    };

    ctrl.updateChart = (location, counties) => {
        const chartXLabels = popAgeSexService.getAgeGroupsLabel(MIN_AGE, MAX_AGE);
        const popPyramidSeries = popAgeSexService.calculatePopulationChart([MIN_AGE, MAX_AGE], counties);

        chart.layout.title = defaultChartTitleTemplate({ location });
        chart.data.forEach((bar, i) => {
            bar.x = chartXLabels;
            bar.y = popPyramidSeries.map(set => set[i]);
        });

        Plotly.redraw(chart);
    };

    // init
    $q.all([
        fusionTableService.loadFromFile("./data/population.json"), // fusionTableService.query(new FusionTableQuery().select(["GEO.id2"].concat(allAgeGroupsArray)).from("1w7FtanoT1rUm7h10Uj2-UyKMuWDMcSfvFhMUVjY6").toString()),
        fusionTableService.loadFromFile("./data/county-shapes.json"), // fusionTableService.query(new FusionTableQuery().select(["GEO_ID2", "geometry", "State Abbr", "County Name"]).from("1xdysxZ94uUFIit9eXmnw1fYc6VcQiXhceFd_CVKa").toString()),
        fusionTableService.loadFromFile("./data/state-shapes.json") // fusionTableService.query(new FusionTableQuery().select(["geometry"]).from("17aT9Ud-YnGiXdXEJUyycH2ocUqreOeKGbzCkUw").toString())
    ]).then(function ([populationResult, countyShapeResult, stateShapeResult]) {
        ctrl.counties = dataManipulationService.join([
            [populationResult, "GEO.id2", allAgeGroupsArray],
            [countyShapeResult, "GEO_ID2", ["geometry", "State Abbr", "County Name", "GEO_ID2"]]
        ]);

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

        ctrl.counties.forEach(county => {
            const paths = mapsService.kmlToPaths(county.get("geometry"));

            const shape = new google.maps.Polygon({
                map,
                paths,
                strokeWeight: 0.2,
                fillColor: "#FF0000",
                fillOpacity: 0.5
            });

            shape.addListener("click", () => {
                ctrl.selectCounty(county);
                $scope.$digest();
            });

            county.set("shape", shape);

            allAgeGroupsArray.forEach(ageGroup => {
                county.set(ageGroup, parseInt(county.get(ageGroup), 10));
            });
        });

        ctrl.setupChart();

        ctrl.updateAge();
    });
});