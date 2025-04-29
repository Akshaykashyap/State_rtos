const searchInput = document.getElementById("searchInput");
const rtoResultDiv = document.getElementById("rtoResult");
const addRtoForm = document.getElementById('addRtoForm');
const messageDiv = document.getElementById('message');
const stateSelect = document.getElementById('state');
const districtSelect = document.getElementById('district-select');
const stateMapContainer = document.getElementById('stateMapContainer');

let fullRtoData = null;
let stateMap;

async function fetchFullRtoData() {
    try {
        const response = await fetch('/api/rto/states');
        if (response.ok) {
            fullRtoData = await response.json();
            displayStateMap();
        } else {
            console.error('Failed to fetch full RTO data.');
            displayStateMap();
        }
    } catch (error) {
        console.error('Error fetching full RTO data:', error);
        displayStateMap();
    }
}

fetchFullRtoData();

function handleInputChange() {
    if (searchInput.value.trim() === "") {
        rtoResultDiv.innerHTML = "";
        rtoResultDiv.classList.remove("has-results");
        displayStateMap();
    }
}

async function displayStateMap(stateName = null, districtName = null) {
    if (!stateMapContainer) {
        console.error('State map container element not found in the DOM.');
        return;
    }
    stateMapContainer.innerHTML = '';

    if (stateMap) {
        stateMap.remove();
        stateMap = null;
    }

    let center = [22.5, 79];
    let zoom = 4;

    stateMap = L.map(stateMapContainer).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(stateMap);

    try {
        const response = await fetch('maps/india.geojson');
        if (!response.ok) {
            console.error(`Failed to fetch India districts map data: ${response.status}`);
            stateMapContainer.innerHTML = `<p class="text-danger">Map data not available.</p>`;
            return;
        }
        const districtsData = await response.json();

        function style(feature) {
            return {
                fillColor: '#f03',
                weight: .5,
                opacity: .3,
                color: 'purple',
                fillOpacity: 0.1
            };
        }

        let highlightedLayer = null;

        function highlightFeature(e) {
            const layer = e.target;
            layer.setStyle({ weight: 3, color: '#666', fillOpacity: 0.3 });
            layer.bringToFront();
        }

        function resetHighlight(e) {
            if (highlightedLayer) {
                geojsonLayer.resetStyle(highlightedLayer);
                highlightedLayer = null;
            }
        }

        function onEachFeature(feature, layer) {
            layer.on({ mouseover: highlightFeature, mouseout: resetHighlight });

            const featureDistrict = feature.properties.district?.toLowerCase();
            const featureState = feature.properties.st_nm?.toLowerCase();

            if (districtName && featureDistrict === districtName.toLowerCase()) {
                layer.setStyle({ fillColor: 'yellow', fillOpacity: 0.5 });
                stateMap.fitBounds(layer.getBounds());
                highlightedLayer = layer;
            } else if (stateName && !districtName && featureState === stateName.toLowerCase()) {
                layer.setStyle({ fillColor: 'orange', fillOpacity: 0.3 });
                stateMap.fitBounds(layer.getBounds());
                highlightedLayer = layer;
            }
        }

        const geojsonLayer = L.geoJSON(districtsData, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(stateMap);

    } catch (error) {
        console.error("Error loading map:", error);
        stateMapContainer.innerHTML = `<p class="text-danger">Error loading map.</p>`;
    }
}

async function searchRTO() {
    const query = searchInput.value.trim();

    if (!query) {
        rtoResultDiv.innerHTML = "";
        rtoResultDiv.classList.remove("has-results");
        displayStateMap();
        return;
    }

    document.getElementById("loading").classList.remove("d-none");
    rtoResultDiv.innerHTML = "";
    rtoResultDiv.classList.remove("has-results");

    let stateFound = false;
    let districtFound = false;
    let districtState = null;

    if (fullRtoData) {
        const searchedState = fullRtoData.find(stateObj => stateObj.toLowerCase() === query.toLowerCase());
        if (searchedState) {
            stateFound = true;
            await displayStateMap(searchedState);
            let totalRTOs = 0;
            const stateDetailsResponse = await fetch(`/api/rto/states/${encodeURIComponent(searchedState)}`);
            if (stateDetailsResponse.ok) {
                const stateDetails = await stateDetailsResponse.json();
                if (stateDetails && stateDetails.districts) {
                    totalRTOs = stateDetails.districts.reduce((sum, district) => sum + (district.rtos ? district.rtos.length : 0), 0);
                    rtoResultDiv.innerHTML = `
                        <div class="card p-3 mb-2">
                            <p class="mb-1"><strong>State:</strong> ${stateDetails.state}</p>
                            <p class="mb-1"><strong>Total RTOs:</strong> ${totalRTOs}</p>
                        </div>
                    `;
                    rtoResultDiv.classList.add("has-results");
                } else {
                    rtoResultDiv.innerHTML = `<p class="text-danger">Could not retrieve RTO count for "${query}".</p>`;
                    rtoResultDiv.classList.remove("has-results");
                }
            } else {
                rtoResultDiv.innerHTML = `<p class="text-danger">State "${query}" not found.</p>`;
                rtoResultDiv.classList.remove("has-results");
            }
            document.getElementById("loading").classList.add("d-none");
            return;
        }
    }

    if (fullRtoData) {
        for (const state of fullRtoData) {
            const stateDetailsResponse = await fetch(`/api/rto/states/${encodeURIComponent(state)}`);
            if (stateDetailsResponse.ok) {
                const stateDetails = await stateDetailsResponse.json();
                if (stateDetails && stateDetails.districts) {
                    const foundDistrict = stateDetails.districts.find(district => typeof district === 'string' && district.toLowerCase() === query.toLowerCase());
                    if (foundDistrict) {
                        districtFound = true;
                        districtState = state;
                        await displayStateMap(state, foundDistrict);
                        document.getElementById("loading").classList.remove("d-none");

                        fetch(`/api/rto/search?q=${encodeURIComponent(query)}&state=${encodeURIComponent(state)}`)
                            .then(response => response.json())
                            .then(results => {
                                let resultsHTML = "";
                                const uniqueResults = [];
                                const seenCodes = new Set();

                                results.forEach(rto => {
                                    const code = rto.rto_code;
                                    if (code && !seenCodes.has(code)) {
                                        seenCodes.add(code);
                                        uniqueResults.push(rto);
                                    } else if (!code) {
                                        uniqueResults.push(rto);
                                    }
                                });

                                uniqueResults.forEach(rto => {
                                    resultsHTML += `
                                        <div class="card p-3 mb-2">
                                            ${rto.rto ? `<p class="mb-1"><strong>RTO Name:</strong> ${rto.rto}</p>` : ""}
                                            ${rto.rto_code ? `<p class="mb-1"><strong>RTO Code:</strong> ${rto.rto_code}</p>` : ""}
                                            ${rto.state ? `<p class="mb-1"><strong>State:</strong> ${rto.state}</p>` : ""}
                                            ${rto.district ? `<p class="mb-1"><strong>District:</strong> ${rto.district}</p>` : ""}
                                            ${rto.address ? `<p><strong>Address:</strong> ${rto.address}</p>` : ""}
                                            ${rto.phone ? `<p><strong>Phone No:</strong> ${rto.phone}</p>` : ""}
                                        </div>
                                    `;
                                });

                                if (resultsHTML) {
                                    rtoResultDiv.innerHTML = resultsHTML;
                                    rtoResultDiv.classList.add("has-results");
                                } else {
                                    rtoResultDiv.innerHTML = `<p class="text-danger">No RTO found in ${state} for "${query}".</p>`;
                                    rtoResultDiv.classList.remove("has-results");
                                }
                                document.getElementById("loading").classList.add("d-none");
                            })
                            .catch(error => {
                                console.error("Error during district-specific search:", error);
                                rtoResultDiv.innerHTML = `<p class="text-danger">Error searching RTOs in ${state}.</p>`;
                                rtoResultDiv.classList.remove("has-results");
                                document.getElementById("loading").classList.add("d-none");
                            });
                        return;
                    }
                }
            }
        }
    }

    const queries = query
        .split(",")
        .map((q) => q.trim())
        .filter((q) => q !== "");
    const fetchPromises = [];

    for (const q of queries) {
        const normalizedCodeMatch = q
            .toUpperCase()
            .replace(/[\s\-]+/g, "")
            .match(/^([A-Z]{2})(\d{2})$/);
        if (normalizedCodeMatch) {
            const normalizedCode = `${normalizedCodeMatch[1]}-${normalizedCodeMatch[2]}`;
            fetchPromises.push(
                fetch(`/api/rto/rtocodes/${normalizedCode}`)
                    .then((res) => res.json())
                    .catch(() => null)
            );
        } else if (q && !stateFound && !districtFound) {
            fetchPromises.push(
                fetch(`/api/rto/search?q=${encodeURIComponent(q)}`)
                    .then((res) => res.json())
                    .catch(() => [])
            );
        }
    }

    const allResults = await Promise.all(fetchPromises);
    document.getElementById("loading").classList.add("d-none");

    let resultsHTML = "";
    const uniqueResults = [];
    const seenCodes = new Set();

    allResults.forEach((result) => {
        if (Array.isArray(result)) {
            result.forEach((rto) => {
                const code = rto.rto_code;
                if (code && !seenCodes.has(code)) {
                    seenCodes.add(code);
                    uniqueResults.push(rto);
                } else if (!code) {
                    uniqueResults.push(rto);
                }
            });
        } else if (result && result.rto_code) {
            const code = result.rto_code;
            if (!seenCodes.has(code)) {
                seenCodes.add(code);
                uniqueResults.push(result);
            }
        }
    });

    uniqueResults.forEach(rto => {
        resultsHTML += `
            <div class="card p-3 mb-2">
                ${rto.rto ? `<p class="mb-1"><strong>RTO Name:</strong> ${rto.rto}</p>` : ""}
                ${rto.rto_code ? `<p class="mb-1"><strong>RTO Code:</strong> ${rto.rto_code}</p>` : ""}
                ${rto.state ? `<p class="mb-1"><strong>State:</strong> ${rto.state}</p>` : ""}
                ${rto.district ? `<p class="mb-1"><strong>District:</strong> ${rto.district}</p>` : ""}
                ${rto.address ? `<p><strong>Address:</strong> ${rto.address}</p>` : ""}
                ${rto.phone ? `<p><strong>Phone No:</strong> ${rto.phone}</p>` : ""}
            </div>
        `;
        if (rto.district && rto.state && !districtFound) {
            displayStateMap(rto.state, rto.district);
            districtFound = true;
        } else if (rto.state && !stateFound && !districtFound) {
            displayStateMap(rto.state);
            stateFound = true;
        }
    });

    if (resultsHTML) {
        rtoResultDiv.innerHTML = resultsHTML;
        rtoResultDiv.classList.add("has-results");
    } else if (!stateFound && !districtFound) {
        rtoResultDiv.innerHTML = `<p class="text-danger">No RTO found for "${query}".</p>`;
        rtoResultDiv.classList.remove("has-results");
        displayStateMap();
    }
}

async function addNewRto() {
    const form = document.getElementById('addRtoForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const response = await fetch('/api/add-rto', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    const result = await response.json();
    document.getElementById('message').textContent = result.message;
    if (response.ok) {
        form.reset();
    }
}

async function loadDistricts(selectedState) {
    districtSelect.innerHTML = '<option value="">Loading Districts...</option>';
    if (selectedState) {
        try {
            const response = await fetch(`/api/rto/states/${encodeURIComponent(selectedState)}/districts`);
            if (response.ok) {
                const districts = await response.json();
                districtSelect.innerHTML = '<option value="">Select District</option>';
                districts.forEach(district => {
                    const option = document.createElement('option');
                    option.value = district;
                    option.textContent = district;
                    districtSelect.appendChild(option);
                });
            } else {
                districtSelect.innerHTML = '<option value="">Error loading districts</option>';
                console.error('Failed to load districts for', selectedState);
            }
        } catch (error) {
            districtSelect.innerHTML = '<option value="">Error loading districts</option>';
            console.error('Error loading districts:', error);
        }
    } else {
        districtSelect.innerHTML = '<option value="">Select District</option>';
    }
}

if (stateSelect.value) {
    loadDistricts(stateSelect.value);
}

searchInput.addEventListener('input', async () => {
    const query = searchInput.value.trim();
    rtoResultDiv.innerHTML = "";
    rtoResultDiv.classList.remove("has-results");

    let stateFound = false;
    let districtFound = false;
    let districtState = null;

    if (query) {
        const normalizedCodeMatch = query
            .toUpperCase()
            .replace(/[\s\-]+/g, "")
            .match(/^([A-Z]{2})(\d{2})$/);

        if (normalizedCodeMatch) {
            const normalizedCode = `${normalizedCodeMatch[1]}-${normalizedCodeMatch[2]}`;
            document.getElementById("loading").classList.remove("d-none");
            const response = await fetch(`/api/rto/rtocodes/${normalizedCode}`);
            document.getElementById("loading").classList.add("d-none");
            if (response.ok) {
                const rtoInfo = await response.json();
                if (rtoInfo) {
                    rtoResultDiv.innerHTML = `
                        <div class="card p-3 mb-2">
                            ${rtoInfo.rto ? `<p class="mb-1"><strong>RTO Name:</strong> ${rtoInfo.rto}</p>` : ""}
                            ${rtoInfo.rto_code ? `<p class="mb-1"><strong>RTO Code:</strong> ${rtoInfo.rto_code}</p>` : ""}
                            ${rtoInfo.state ? `<p class="mb-1"><strong>State:</strong> ${rtoInfo.state}</p>` : ""}
                            ${rtoInfo.district ? `<p class="mb-1"><strong>District:</strong> ${rtoInfo.district}</p>` : ""}
                            ${rtoInfo.address ? `<p><strong>Address:</strong> ${rtoInfo.address}</p>` : ""}
                            ${rtoInfo.phone ? `<p class="mb-1"><strong>Phone No:</strong> ${rtoInfo.phone}</p>` : ""}
                        </div>
                    `;
                    rtoResultDiv.classList.add("has-results");
                    if (rtoInfo.district && rtoInfo.state) {
                        await displayStateMap(rtoInfo.state, rtoInfo.district);
                    } else if (rtoInfo.state) {
                        await displayStateMap(rtoInfo.state);
                    } else {
                        await displayStateMap();
                    }
                } else {
                    rtoResultDiv.innerHTML = `<p class="text-danger">No RTO found for code "${normalizedCode}".</p>`;
                    rtoResultDiv.classList.remove("has-results");
                    await displayStateMap();
                }
            } else {
                rtoResultDiv.innerHTML = `<p class="text-danger">Error fetching RTO data for code "${normalizedCode}".</p>`;
                rtoResultDiv.classList.remove("has-results");
                await displayStateMap();
            }
            return;
        }

        if (fullRtoData) {
            for (const state of fullRtoData) {
                const stateDetailsResponse = await fetch(`/api/rto/states/${encodeURIComponent(state)}`);
                if (stateDetailsResponse.ok) {
                    const stateDetails = await stateDetailsResponse.json();
                    if (stateDetails && stateDetails.districts) {
                        const foundDistrict = stateDetails.districts.find(district => typeof district === 'string' && district.toLowerCase() === query.toLowerCase());
                        if (foundDistrict) {
                            districtFound = true;
                            districtState = state;
                            await displayStateMap(state, foundDistrict);
                            document.getElementById("loading").classList.remove("d-none");
                            fetch(`/api/rto/search?q=${encodeURIComponent(query)}&state=${encodeURIComponent(state)}`)
                                .then(response => response.json())
                                .then(results => {
                                    let resultsHTML = "";
                                    const uniqueResults = [];
                                    const seenCodes = new Set();

                                    results.forEach(rto => {
                                        const code = rto.rto_code;
                                        if (code && !seenCodes.has(code)) {
                                            seenCodes.add(code);
                                            uniqueResults.push(rto);
                                        } else if (!code) {
                                            uniqueResults.push(rto);
                                        }
                                    });

                                    uniqueResults.forEach(rto => {
                                        resultsHTML += `
                                            <div class="card p-3 mb.ConcurrentModificationException2">
                                                ${rto.rto ? `<p class="mb-1"><strong>RTO Name:</strong> ${rto.rto}</p>` : ""}
                                                ${rto.rto_code ? `<p class="mb-1"><strong>RTO Code:</strong> ${rto.rto_code}</p>` : ""}
                                                ${rto.state ? `<p class="mb-1"><strong>State:</strong> ${rto.state}</p>` : ""}
                                                ${rto.district ? `<p class="mb-1"><strong>District:</strong> ${rto.district}</p>` : ""}
                                                ${rto.address ? `<p><strong>Address:</strong> ${rto.address}</p>` : ""}
                                                ${rto.phone ? `<p class="mb-1"><strong>Phone No:</strong> ${rto.phone}</p>` : ""}
                                            </div>
                                        `;
                                    });

                                    if (resultsHTML) {
                                        rtoResultDiv.innerHTML = resultsHTML;
                                        rtoResultDiv.classList.add("has-results");
                                    } else {
                                        rtoResultDiv.innerHTML = `<p class="text-danger">No RTO found in ${state} for "${query}".</p>`;
                                        rtoResultDiv.classList.remove("has-results");
                                    }
                                    document.getElementById("loading").classList.add("d-none");
                                })
                                .catch(error => {
                                    console.error("Error during district-specific search:", error);
                                    document.getElementById("loading").classList.add("d-none");
                                    rtoResultDiv.innerHTML = `<p class="text-danger">Error searching RTOs in ${state}.</p>`;
                                    rtoResultDiv.classList.remove("has-results");
                                });
                            return;
                        } else if (state.toLowerCase() === query.toLowerCase()) {
                            stateFound = true;
                            await displayStateMap(state);
                            let totalRTOs = 0;
                            const stateDetailsResponse = await fetch(`/api/rto/states/${encodeURIComponent(state)}`);
                            if (stateDetailsResponse.ok) {
                                const stateDetails = await stateDetailsResponse.json();
                                if (stateDetails && stateDetails.districts) {
                                    totalRTOs = stateDetails.districts.reduce((sum, district) => sum + (district.rtos ? district.rtos.length : 0), 0);
                                    rtoResultDiv.innerHTML = `
                                        <div class="card p-3 mb-2">
                                            <p class="mb-1"><strong>State:</strong> ${stateDetails.state}</p>
                                            <p class="mb-1"><strong>Total RTOs:</strong> ${totalRTOs}</p>
                                        </div>
                                    `;
                                    rtoResultDiv.classList.add("has-results");
                                } else {
                                    rtoResultDiv.innerHTML = `<p class="text-danger">Could not retrieve RTO count for "${query}".</p>`;
                                    rtoResultDiv.classList.remove("has-results");
                                }
                            } else {
                                rtoResultDiv.innerHTML = `<p class="text-danger">State "${query}" not found.</p>`;
                                rtoResultDiv.classList.remove("has-results");
                            }
                            document.getElementById("loading").classList.add("d-none");
                            return;
                        }
                    }
                }
            }
        }

        document.getElementById("loading").classList.remove("d-none");
        fetch(`/api/rto/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(results => {
                document.getElementById("loading").classList.add("d-none");
                let resultsHTML = "";
                const uniqueResults = [];
                const seenCodes = new Set();

                results.forEach(rto => {
                    const code = rto.rto_code;
                    if (code && !seenCodes.has(code)) {
                        seenCodes.add(code);
                        uniqueResults.push(rto);
                    } else if (!code) {
                        uniqueResults.push(rto);
                    }
                });

                uniqueResults.forEach(rto => {
                    resultsHTML += `
                        <div class="card p-3 mb-2">
                            ${rto.rto ? `<p class="mb-1"><strong>RTO Name:</strong> ${rto.rto}</p>` : ""}
                            ${rto.rto_code ? `<p class="mb-1"><strong>RTO Code:</strong> ${rto.rto_code}</p>` : ""}
                            ${rto.state ? `<p class="mb-1"><strong>State:</strong> ${rto.state}</p>` : ""}
                            ${rto.district ? `<p class="mb-1"><strong>District:</strong> ${rto.district}</p>` : ""}
                            ${rto.address ? `<p><strong>Address:</strong> ${rto.address}</p>` : ""}
                            ${rto.phone ? `<p class="mb-1"><strong>Phone No:</strong> ${rto.phone}</p>` : ""}
                        </div>
                    `;
                    if (rto.district && rto.state && !districtFound) {
                        displayStateMap(rto.state, rto.district);
                        districtFound = true;
                    } else if (rto.state && !stateFound && !districtFound) {
                        displayStateMap(rto.state);
                        stateFound = true;
                    }
                });

                if (resultsHTML) {
                    rtoResultDiv.innerHTML = resultsHTML;
                    rtoResultDiv.classList.add("has-results");
                } else if (!stateFound && !districtFound) {
                    rtoResultDiv.innerHTML = `<p class="text-danger">No RTO found for "${query}".</p>`;
                    rtoResultDiv.classList.remove("has-results");
                    displayStateMap();
                }
            })
            .catch(error => {
                console.error("Error during general search:", error);
                document.getElementById("loading").classList.add("d-none");
                rtoResultDiv.innerHTML = `<p class="text-danger">Error searching RTOs.</p>`;
                rtoResultDiv.classList.remove("has-results");
                displayStateMap();
            });
    } else {
        displayStateMap();
    }
});

searchInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchRTO();
    }
});