"use strict";function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}var _slicedToArray=function(){function e(e,t){var n=[],r=!0,a=!1,i=void 0;try{for(var o,l=e[Symbol.iterator]();!(r=(o=l.next()).done)&&(n.push(o.value),!t||n.length!==t);r=!0);}catch(e){a=!0,i=e}finally{try{!r&&l.return&&l.return()}finally{if(a)throw i}}return n}return function(t,n){if(Array.isArray(t))return t;if(Symbol.iterator in Object(t))return e(t,n);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),_createClass=function(){function e(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}return function(t,n,r){return n&&e(t.prototype,n),r&&e(t,r),t}}(),FusionTableResult=function(){function e(t){_classCallCheck(this,e);var n=_.invert(t.columns);this.rows=t.rows.map(function(e){return new FusionTableRow(e,n)})}return _createClass(e,[{key:"getData",value:function(){return this.rows}}]),e}(),FusionTableRow=function(){function e(t,n){_classCallCheck(this,e),this.row=t,this.columnsLookup=n}return _createClass(e,[{key:"get",value:function(e){return this.row[this.columnsLookup[e]]}},{key:"set",value:function(e,t){this.row[this.columnsLookup[e]]=t}}]),e}();angular.module("app",["rzModule","ihaochi"]).constant("MAX_AGE",85).constant("MIN_AGE",0).config(["$sceDelegateProvider",function(e){e.resourceUrlWhitelist(["self","https://www.googleapis.com/**"])}]).service("fusionTableService",function(){function e(t){_classCallCheck(this,e),this.$http=t}return e.$inject=["$http"],_createClass(e,[{key:"loadFromFile",value:function(e){return this.$http.get(e).then(this.responseToResult)}},{key:"responseToResult",value:function(e){return new FusionTableResult(e.data)}}]),e}()).service("mapsService",function(){function e(t){_classCallCheck(this,e),this.map=new google.maps.Map(t[0].querySelector(".map"),{center:{lat:39.828175,lng:-98.5795},zoom:4,disableDefaultUI:!0,zoomControl:!0,styles:[{featureType:"landscape",stylers:[{visibility:"off"}]},{featureType:"road",stylers:[{visibility:"off"}]},{featureType:"poi",stylers:[{visibility:"off"}]},{stylers:[{saturation:-100}]}]}),this.marker=new google.maps.Marker({map:this.map})}return e.$inject=["$document"],_createClass(e,[{key:"geometryToArray",value:function(e){return e.coordinates.map(function(e){return e.map(function(e){var t=_slicedToArray(e,2),n=t[0],r=t[1];return{lat:r,lng:n}})})}},{key:"getLatlngBoundsFromLatLngs",value:function(e){var t=new google.maps.LatLngBounds;return e.forEach(function(e){return t.extend(e)}),t}},{key:"kmlToPaths",value:function(e){var t=[];return e.geometry?t=[e.geometry]:e.geometries&&(t=e.geometries),_.chain(t).map(this.geometryToArray).flatten().value()}}]),e}()).service("popAgeSexService",function(){function e(t){_classCallCheck(this,e),this.MAX_AGE=t}return e.$inject=["MAX_AGE"],_createClass(e,[{key:"generateRangeKey",value:function(e,t,n){var r="est72015sex",a=r+e+"_age"+t;return n?a+"to"+n:a+"plus"}},{key:"generateAgeGroup",value:function(e,t){return{male:this.generateRangeKey(1,e,t),female:this.generateRangeKey(2,e,t)}}},{key:"getAgeGroups",value:function(e,t){for(var n=[],r=e;r<t;r+=5)n.push(this.generateAgeGroup(r,r+4));return this.MAX_AGE===t&&n.push(this.generateAgeGroup(t)),n}},{key:"getAgeGroupsLabel",value:function(e,t){for(var n=[],r=e;r<t;r+=5)n.push(r+" to "+(r+4));return this.MAX_AGE===t&&n.push(this.MAX_AGE+"+"),n}},{key:"displayMaxAge",value:function(e){return e===this.MAX_AGE?e+"+":e-1}},{key:"calculatePopulationChart",value:function(e,t){var n=_slicedToArray(e,2),r=n[0],a=n[1];return this.getAgeGroups(r,a).map(function(e){var n=e.male,r=e.female,a=0,i=0;return t.forEach(function(e){a+=e.get(n),i+=e.get(r)}),[a,i]})}}]),e}()).service("chartService",function(){function e(t,n,r){_classCallCheck(this,e);var a=[{display:"&le; 0.93",test:function(e){return e<=.93}},{display:"&le; 0.95",test:function(e){return e<=.95}},{display:"&le; 0.97",test:function(e){return e<=.97}},{display:"&le; 0.99",test:function(e){return e<=.99}},{display:"1",test:function(e){return Math.abs(1-e)<.009},color:"#fff"},{display:"&le; 1.01",test:function(e){return e<=1.01}},{display:"&le; 1.03",test:function(e){return e<=1.03}},{display:"&le; 1.05",test:function(e){return e<=1.05}},{display:"> 1.05",test:function(e){return e>1.05}}],i=chroma.scale(["red","white","blue"]).domain([0,a.length]);this.legend=a.map(function(e,n){return e.display=t.trustAsHtml(e.display),e.color||(e.color=i(n).hex()),e}),this.chart=r[0].querySelector(".chart"),this.$window=n}return e.$inject=["$sce","$window","$document"],_createClass(e,[{key:"getChart",value:function(){return this.chart}},{key:"setupChart",value:function(e,t){var n=this.getChart();Plotly.newPlot(n,[{x:e,y:[],name:"Male",type:"bar",marker:{color:chroma(_.last(this.legend).color).alpha(t).css()}},{x:e,y:[],name:"Female",type:"bar",marker:{color:chroma(_.first(this.legend).color).alpha(t).css()}}],{xaxis:{title:"Age Group"},yaxis:{title:"Population"},barmode:"group",legend:{orientation:"h"}}),this.$window.addEventListener("resize",_.debounce(function(){Plotly.Plots.resize(n)},500))}},{key:"redrawChart",value:function(e,t,n){var r=this.getChart();r.layout.title=e,r.data.forEach(function(e,r){e.x=t,e.y=n.map(function(e){return e[r]})}),Plotly.redraw(r)}},{key:"colorizeLegend",value:function(e){var t=!0,n=!1,r=void 0;try{for(var a,i=this.legend[Symbol.iterator]();!(t=(a=i.next()).done);t=!0){var o=a.value;if(o.test(e))return o.color}}catch(e){n=!0,r=e}finally{try{!t&&i.return&&i.return()}finally{if(n)throw r}}}}]),e}()).service("dataManipulationService",function(){function e(){_classCallCheck(this,e)}return _createClass(e,[{key:"join",value:function(e){var t=_slicedToArray(e,2),n=t[0],r=t[1],a=_slicedToArray(n,3),i=a[0],o=a[1],l=a[2],u=_slicedToArray(r,3),s=u[0],c=u[1],h=u[2],g=new Map(s.getData().map(function(e){return[e.get(c),e]})),f=[];return i.getData().forEach(function(e){var t=e.get(o);g.has(t)&&!function(){var n=new Map,r=g.get(t);l.forEach(function(t){return n.set(t,e.get(t))}),h.forEach(function(e){return n.set(e,r.get(e))}),f.push(n)}()}),f}}]),e}()).controller("AppController",["$timeout","$q","$sce","$location","dataManipulationService","mapsService","fusionTableService","popAgeSexService","chartService","MIN_AGE","MAX_AGE",function(e,t,n,r,a,i,o,l,u,s,c){var h=this,g=l.getAgeGroups(s,c),f=_.chain(g).map(function(e){return[e.male,e.female]}).flatten().value(),p=_.template("<%- location %> Population By Age Group <% if (range) { %> (Ages: <%- range %>) <% } %>"),y=5,m=.5,d=15e6,v=200,A={strokeWeight:.1,fillOpacity:m},C={strokeWeight:1,fillOpacity:.9};h.LEGEND_OPACITY=m,h.minAge=s,h.maxAge=c,h.highlightRatioMin=20,h.highlightRatioMax=v,h.highlightPopulationMin=1e5,h.highlightPopulationMax=d,h.selectedCounty=null,h.legend=u.legend,h.counties=[],h.loading=!1,h.ageSliderOptions={step:y,floor:s,ceil:c,onEnd:function(){h.refreshUI(null)},translate:function(e,t,n){return["ceil","high"].includes(n)?l.displayMaxAge(e):e}},h.ratioSliderOptions={floor:10,ceil:v,onEnd:function(){h.refreshUI(null)},translate:function(e){return e+"%"}},h.populationSliderOptions={floor:1e4,ceil:d,stepsArray:_.flatten([2,3,4,5,6].map(function(e){return[1,2,3,4,5,6,7,8,9].map(function(t){return t*Math.pow(10,e)})})).concat(d),onEnd:function(){h.refreshUI(null)},translate:function(e){var t=[[6,"M"],[3,"K"]],n=!0,r=!1,a=void 0;try{for(var i,o=t[Symbol.iterator]();!(n=(i=o.next()).done);n=!0){var l=_slicedToArray(i.value,2),u=l[0],s=l[1],c=e/Math.pow(10,u);if(c>=1)return c.toFixed(0)+s}}catch(e){r=!0,a=e}finally{try{!n&&o.return&&o.return()}finally{if(r)throw a}}return e}},h.selectCounty=function(e){if(h.selectedCounty=e,e){var t=i.getLatlngBoundsFromLatLngs(_.flatten(e.get("shape").getPaths().getArray().map(function(e){return e.getArray()})));i.marker.setPosition(t.getCenter())}i.marker.setVisible(!!e)},h.calculateRatio=function(e,t){return e===t?1:0===t?9e3:e/t},h.updateAge=function(){var e=l.getAgeGroups(h.minAge,h.maxAge);h.counties.forEach(function(t){var n=0,r=0;e.map(function(e){var a=e.male,i=e.female;n+=t.get(a),r+=t.get(i)});var a=h.calculateRatio(n,r);t.set("male",n),t.set("female",r),t.set("ratio",a),t.get("shape").setOptions({fillColor:u.colorizeLegend(a)})})},h.updateHighlight=function(){h.counties.forEach(function(e){var t=e.get("ratio"),n=e.get("totalPopulation"),r=Math.abs(1-t),a=h.highlightRatioMax===v?Number.POSITIVE_INFINITY:h.highlightRatioMax,i=h.highlightRatioMin/100<r&&t<a,o=h.highlightPopulationMin<=n&&n<=h.highlightPopulationMax,l=i&&o;e.get("shape").setOptions(l?C:A)})},h.updateUI=function(e,t,n,a){var i=_slicedToArray(e,2),o=i[0],l=i[1],u=_slicedToArray(n,2),s=u[0],c=u[1],g=_slicedToArray(a,2),f=g[0],p=g[1];h.selectCounty(t),h.updateAge(),h.updateChart(),h.updateHighlight(),r.search("county",t&&t.get("GEO_ID2")),r.search("minRatio",s),r.search("maxRatio",c),r.search("minAge",o),r.search("maxAge",l),r.search("minPopulation",f),r.search("maxPopulation",p)},h.setupChart=function(){var e=l.getAgeGroupsLabel(s,c);u.setupChart(e,h.LEGEND_OPACITY)},h.updateChart=function(){var e=void 0,t=void 0,n=[],r="",a=h.selectedCounty;a?(n=[a],r=a.get("County Name")+", "+a.get("State Abbr"),e=s,t=c):(n=h.counties,r="US",e=h.minAge,t=h.maxAge);var i=l.getAgeGroupsLabel(e,t),o=l.calculatePopulationChart([e,t],n),g={location:r,range:null};e===s&&t===c||(g.range=e+" to "+l.displayMaxAge(t)),u.redrawChart(p(g),i,o)},h.setupSearchVariables=function(){var e=r.search(),t=e.minAge,n=e.maxAge,a=e.minRatio,i=e.maxRatio,o=e.minPopulation,l=e.maxPopulation,u=e.county,s=parseInt(t,10),c=parseInt(n,10),g=parseInt(a,10),f=parseInt(i,10),p=parseInt(o,10),y=parseInt(l,10),m=_.find(h.counties,function(e){return e.get("GEO_ID2")===u});Number.isFinite(s)&&(h.minAge=s),Number.isFinite(c)&&(h.maxAge=c),Number.isFinite(g)&&(h.highlightRatioMin=g),Number.isFinite(f)&&(h.highlightRatioMax=f),Number.isFinite(p)&&(h.highlightPopulationMin=p),Number.isFinite(y)&&(h.highlightPopulationMax=y),m&&(h.selectedCounty=m)},h.refreshUI=function(e){h.updateUI([h.minAge,h.maxAge],e,[h.highlightRatioMin,h.highlightRatioMax],[h.highlightPopulationMin,h.highlightPopulationMax])},h.loading=!0,t.all([o.loadFromFile("./dist/population.json"),o.loadFromFile("./dist/county-shapes.json"),o.loadFromFile("./dist/state-shapes.json")]).then(function(t){var n=_slicedToArray(t,3),r=n[0],o=n[1],l=n[2];h.counties=a.join([[r,"GEO.id2",f],[o,"GEO_ID2",["geometry","State Abbr","County Name","GEO_ID2"]]]),h.counties.forEach(function(t){var n=i.kmlToPaths(t.get("geometry")),r=new google.maps.Polygon(_.assign({map:i.map,paths:n},A));r.addListener("click",function(){e(function(){return h.refreshUI(t)})}),r.addListener("mouseover",function(){e(function(){return h.hoverCounty=t})}),r.addListener("mouseout",function(){e(function(){return h.hoverCounty=null})}),t.set("shape",r);var a=0;f.forEach(function(e){var n=parseInt(t.get(e),10);t.set(e,n),a+=n}),t.set("totalPopulation",a)}),l.getData().forEach(function(e){var t=i.kmlToPaths(e.get("geometry"));t.forEach(function(e){new google.maps.Polyline({map:i.map,path:e,strokeColor:"#555",strokeWeight:1.5})})}),h.setupSearchVariables(),h.setupChart(),h.refreshUI(h.selectedCounty),h.loading=!1})}]);