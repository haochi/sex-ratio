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

class County {
    constructor() {
        this.county = null;
        this.shape = null;
        this.ratio = 1;
    }

    setRatio(ratio) {
        this.ratio = ratio;
    }

    getRatio() {
        return this.ratio;
    }

    setCounty(county) {
        this.county = county;
    }

    setShape(shape) {
        this.shape = shape;
    }

    isValid() {
        return this.county && this.shape;
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
.service("fusionTableService", function ($http, GOOGLE_API_KEY) {
    const geometryToArray = geometry => {
        return geometry.coordinates.map(coordinate => {
            return coordinate.map(([lng, lat]) => ({ lat, lng}));
        });
    };

    this.query = function (sql) {
        return $http.jsonp( "https://www.googleapis.com/fusiontables/v2/query", {
            params: {
                sql: sql,
                key: GOOGLE_API_KEY
            }
        }).then(function (response) {
            return new FusionTableResult(response.data);
        });
    };

    this.kmlToPaths = function (kml) {
        var geometries = [];

        if (kml.geometry) {
            geometries = [kml.geometry];
        } else if (kml.geometries) {
            geometries = kml.geometries;
        }

        return _.chain(geometries)
            .map(geometryToArray)
            .flatten()
            .value();
    }
})
.service("countyService", function () {
    var counties = new Map();

    this.getCounties = function () {
        return Array.from(counties.values()).filter(county => county.isValid())
    };

    this.set = function (id, county) {
        counties.set(id, county);
    };

    this.get = function (id) {
        return counties.get(id);
    };

    this.has = function (id) {
        return counties.has(id);
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
        var groups = [];
        for(let i=min; i<max;i+=5) {
            groups.push(this.generateAgeGroup(i, i + 4));
        }

        if (this.MAX_AGE === max) {
            groups.push(this.generateAgeGroup(max));
        }

        return groups;
    }
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
.controller("AppController", function ($q, $sce, fusionTableService, countyService, popAgeSexService, chartService, MIN_AGE, MAX_AGE) {
    const ctrl = this;

    const map = new google.maps.Map(document.getElementById("map"), {
        center: {lat: 39.828175, lng: -98.5795},
        zoom: 4
    });

    const allAgeGroups = popAgeSexService.getAgeGroups(MIN_AGE, MAX_AGE);

    const allAgeGroupsArray = _.chain(allAgeGroups).map(function (ageGroup) {
        return [ageGroup.male, ageGroup.female];
    }).flatten().value();

    ctrl.MIN_AGE = MIN_AGE;
    ctrl.MAX_AGE = MAX_AGE;

    ctrl.minAge = ctrl.MIN_AGE;
    ctrl.maxAge = ctrl.MAX_AGE;
    ctrl.step = 5;

    ctrl.legend = chartService.legend;

    ctrl.updateAge = function () {
        const ageGroups = popAgeSexService.getAgeGroups(ctrl.minAge, ctrl.maxAge);
        countyService.getCounties().forEach(county => {
            let totalMalePop = 0;
            let totalFemalePop = 0;

            ageGroups.map(({ male, female }) => {
                totalMalePop += county.county.get(male);
                totalFemalePop += county.county.get(female);
            });

            let ratio = totalMalePop / totalFemalePop;

            county.shape.setOptions({
                fillColor: chartService.colorizeLegend(ratio)
            });

            county.setRatio(ratio);
        });

    };

    $q.all([
        fusionTableService.query("SELECT 'GEO.id2', " + allAgeGroupsArray.join(", ") + " FROM 1w7FtanoT1rUm7h10Uj2-UyKMuWDMcSfvFhMUVjY6"),
        fusionTableService.query("SELECT GEO_ID2, geometry FROM 1xdysxZ94uUFIit9eXmnw1fYc6VcQiXhceFd_CVKa")
    ]).then(function ([populationResult, shapeResult]) {
        shapeResult.getData().forEach(county => {
            const paths = fusionTableService.kmlToPaths(county.get("geometry"));

            const shape = new google.maps.Polygon({
                paths: paths,
                strokeWeight: 0.2,
                fillColor: "#FF0000",
                fillOpacity: 0.7
            });

            const c = new County();
            c.setShape(shape);
            shape.setMap(map);
            shape.addListener("click", () => {
                console.log(c.getRatio(), _.zip(allAgeGroupsArray, allAgeGroupsArray.map(ageGroup => c.county.get(ageGroup))));
            });
            countyService.set(county.get("GEO_ID2"), c);
        });

        populationResult.getData().forEach(county => {
            const id = county.get("GEO.id2");
            allAgeGroupsArray.forEach(ageGroup => {
                county.set(ageGroup, parseInt(county.get(ageGroup), 10));
            });
            if (countyService.has(id)) {
                countyService.get(id).setCounty(county);
            }
        });

        ctrl.updateAge();
    });
});