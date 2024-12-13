function loadMap(year){
    document.querySelector(".header h2").textContent = `Violent Crimes Statistics in the United States for ${year}`;

    d3.json("usstates.geojson").then((geojson,err)=> {
        console.log(geojson);
        d3.dsv(",", "crime_and_incarceration_by_state.csv", d => {
            const toProperCase = str => {
                return str.toLowerCase()
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            };
            if (d.year == year && d.jurisdiction!="FEDERAL"){
                return {
                    state: toProperCase(d.jurisdiction),
                    violent_crime_total: +d.violent_crime_total,
                    murder_manslaughter: +d.murder_manslaughter,
                    rape: year <= 2012 ? +d.rape_legacy : +d.rape_revised,
                    robbery: +d.robbery,
                    agg_assault: +d.agg_assault,
                    prisoner_count: +d.prisoner_count,
                };
            }
        }).then((data2, err)  =>{
            for (var i=0; i<geojson.features.length; i++) {
                for (var j=0; j<data2.length; j++) {
                    if (geojson.features[i].properties["name"]==data2[j]["state"]){
                        geojson.features[i].properties["violent_crime_total"] = data2[j].violent_crime_total;
                        geojson.features[i].properties["murder_manslaughter"] = data2[j].murder_manslaughter;
                        geojson.features[i].properties["rape"] = data2[j].rape;
                        geojson.features[i].properties["robbery"] = data2[j].robbery;
                        geojson.features[i].properties["agg_assault"] = data2[j].agg_assault;
                        geojson.features[i].properties["prisoner_count"] = data2[j].prisoner_count;
                    }
                }
            }
            console.log(geojson);
            // Remove the old map layer before adding a new one
            map.eachLayer(layer => {
                if (layer instanceof L.GeoJSON || layer instanceof L.TileLayer) {
                    map.removeLayer(layer);
                }
            });
            // Remove old legend and floating info box
            document.querySelector('.info')?.remove();
            document.querySelector('.legend')?.remove();
            // Clear the pie chart when a new year is selected
            d3.select("#pie-chart").html("<h2>Click on a State</h2>\n" +
                "        <h3>to show Violent crimes breakdown</h3>");

            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 15,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);

            function getColor(d) {
                return d < 2000 ? '#4fb80e' :
                    d < 5000  ? '#6dda2a' :
                        d < 10000  ? '#c3e157' :
                            d < 20000  ? '#eaf58a' :
                                d < 40000   ? '#fab733' :
                                    d < 80000   ? '#ff8e15' :
                                        d < 100000   ? '#ff4e11' :
                                            '#ff0d0d';
            }

            function state_style(feature) {
                return {
                    fillColor: getColor(feature.properties.violent_crime_total),
                    weight: 2,
                    opacity: 1.5,
                    color: 'white',
                    dashArray: '3',
                    fillOpacity: 0.9
                };
            }

            function highlightFeature(e) {
                var layer = e.target;
                layer.setStyle({
                    weight: 3,
                    color: '#0a120d',
                    dashArray: '',
                    fillOpacity: 0.9
                });
                layer.bringToFront();
                info.update(layer.feature.properties);
            }

            function resetHighlight(e) {
                geojson.resetStyle(e.target);
                info.update();
            }

            function onEachFeature(feature, layer) {
                layer.on({
                    mouseover: highlightFeature,
                    mouseout: resetHighlight,
                    click: function (e) {
                        createPieChart(feature.properties);
                    }
                });
            }

            function createPieChart(properties) {
                d3.select("#pie-chart").html(""); // Clear previous chart
                // Clear the pie chart container and show the loading GIF
                d3.select("#pie-chart")
                    .html('<div style="display:flex;align-items:center;justify-content:center;height:100%;">' +
                        '<img src="gif.gif" alt="Loading..." style="width:100px;height:100px;">' +
                        '</div>');

                // Simulate a small delay to allow the user to notice the loading GIF
                setTimeout(() => {
                    d3.select("#pie-chart").html("")
                const data = [
                    // { label: "Violent Crime", value: properties.violent_crime_total },
                    { label: "Homicide", value: properties.murder_manslaughter },
                    { label: "Rape", value: properties.rape },
                    { label: "Robbery", value: properties.robbery },
                    { label: "Assault", value: properties.agg_assault }
                ];

                const width = 400, height = 500, radius = (Math.min(width, height)-100) / 2;
                const svg = d3.select("#pie-chart")
                    .append("svg")
                    .attr("width", width + 150)
                    .attr("height", height)
                    .append("g")
                    .attr("transform", `translate(${width / 2}, ${height / 2 })`);

                // Create the color scale.
                const color = d3.scaleOrdinal()
                    .domain(data.map(d => d.label))
                    .range(d3.quantize(t => d3.interpolateSpectral(t * 0.8 + 0.1), data.length).reverse())

                // Create the pie layout and arc generator.
                const pie = d3.pie()
                    .sort(null)
                    .value(d => d.value);

                const arc = d3.arc()
                    .innerRadius(0)
                    .outerRadius(Math.min(width, height) / 2 - 1);

                const labelRadius = arc.outerRadius()() * 0.8;

                // A separate arc generator for labels.
                const arcLabel = d3.arc()
                    .innerRadius(labelRadius)
                    .outerRadius(labelRadius);
                const arcs = pie(data);

                // Add a sector path for each value.
                svg.append("g")
                    .attr("stroke", "white")
                    .selectAll()
                    .data(arcs)
                    .join("path")
                    .attr("fill", d => color(d.data.label))
                    .attr("d", arc)
                    .append("title")
                    .text(d => `${d.data.label}: ${d.data.value.toLocaleString("en-US")}`);

                // Create a new arc generator to place a label close to the edge.
                // The label shows the value if there is enough room.
                svg.append("g")
                    .attr("text-anchor", "middle")
                    .selectAll()
                    .data(arcs)
                    .join("text")
                    .attr("transform", d => `translate(${arcLabel.centroid(d)})`)
                    // .call(text => text.append("tspan")
                    //     .attr("y", "-0.4em")
                    //     .attr("font-weight", "bold")
                    //     .text(d => d.data.label))
                    .call(text => text.filter(d => (d.endAngle - d.startAngle) > 0.25).append("tspan")
                    .attr("x", 0)
                    .attr("y", "0.7em")
                    .attr("fill-opacity", 0.7)
                        .style("font-weight", "bold")
                    .text(d => d.data.value.toLocaleString("en-US")));

                // Add the title
                const title = d3.select("#pie-chart svg")
                    .append("text")
                    .attr("x", width / 2) // Center the title
                    .attr("y", 20) // Position the first line
                    .attr("text-anchor", "middle")
                    // .style("font-size", "20px")
                    .style("font-weight", "bold");

                // Add the state name as the first line
                title.append("tspan")
                    .attr("x", width / 2)
                    .attr("dy", "0em")
                    .style("font-size", "30px")
                    .text(properties.name);

                // Add the subtitle as the second line
                title.append("tspan")
                    .attr("x", width / 2)
                    .style("font-size", "20px")
                    .attr("dy", "1.2em") // Move it below the first line
                    .text("Violent Crime Statistics");

                // Add the legend next to the pie chart.
                const legend = d3.select("#pie-chart svg")
                    .append("g")
                    .attr("transform", `translate(${width / 2 + radius + 50}, ${radius-60})`); // Position to the right of the pie chart

                // Add background and border to the legend.
                const legendItems = data.map((d, i) => ({ label: d.label, color: color(d.label) }));
                const legendBox = legend.append("rect")
                    .attr("x", -10)
                    .attr("y", -10)
                    .attr("width", 120)
                    .attr("height", legendItems.length * 20 + 20)
                    .attr("fill", "#f9f9f9") // Light background color
                    .attr("stroke", "#fe727d") // Border color
                    .attr("stroke-width", 2)
                    .attr("rx", 5) // Rounded corners
                    .attr("ry", 5);

                legend.selectAll()
                    .data(data)
                    .join("g")
                    .attr("transform", (d, i) => `translate(0, ${i * 20})`) // Space legend items vertically
                    .call(group => {
                        // Add color boxes
                        group.append("rect")
                            .attr("width", 15)
                            .attr("height", 15)
                            .attr("fill", d => color(d.label));

                        // Add labels
                        group.append("text")
                            .attr("x", 20)
                            .attr("y", 12)
                            .text(d => d.label)
                            .style("font-size", "14px")
                            .style("font-weight", "bold")
                            .attr("alignment-baseline", "middle");
                    });
                }, 1000); // Clear the loading GIF
            }

            geojson = L.geoJson(geojson, {
                style: state_style,
                onEachFeature: onEachFeature
            }).addTo(map);

            var info = L.control();

            info.onAdd = function (map) {
                this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
                this.update();
                return this._div;
            };

    // method that we will use to update the control based on feature properties passed
            info.update = function (props) {
                this._div.innerHTML = '<b>Total Violent Crimes</b></br>' +  (props ?
                    '<b>' + props.name + '</b>: '+ props.violent_crime_total.toLocaleString()
                    : 'Hover over a State');
            };
            var legend = L.control({position: 'bottomright'});
            legend.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'info legend'),
                    grades = [0, 2000, 5000, 10000, 20000, 40000,80000, 100000 ],
                    labels = [];
                // loop through our density intervals and generate a label with a colored square for each interval
                for (var i = 0; i < grades.length; i++) {
                    div.innerHTML +=
                        '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
                        grades[i].toLocaleString() + (grades[i + 1] ? '&ndash;' + grades[i + 1].toLocaleString() + '<br>' : '+');
                }
                return div;
            };
            //Fix this
            //L.geoJson(statesData, {style: town_style}).addTo(map);
            legend.addTo(map);
            info.addTo(map);
            L.geoJSON(geojson,{
                style:state_style
            }).addTo(map);
        })
    })
}

// Add event listeners to buttons
document.querySelectorAll('.header button').forEach(button => {
    button.addEventListener('click', function () {
        const year = parseInt(this.textContent);
        document.querySelectorAll('.header button').forEach(btn => {
            btn.classList.remove('selected')});
        this.classList.add('selected');
        loadMap(year);
    });
});

var map = L.map('map').setView([39.5259077638924, -96.2205677240396], 4);
document.querySelector('.header button:last-child').classList.add('selected');
loadMap(2016);