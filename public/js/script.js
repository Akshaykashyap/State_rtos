
const searchInput = document.getElementById("searchInput");
const rtoResultDiv = document.getElementById("rtoResult");
const addRtoForm = document.getElementById('addRtoForm');
const messageDiv = document.getElementById('message');
const stateSelect = document.getElementById('state');
const districtSelect = document.getElementById('district-select');

// Store the full RTO data fetched once
let fullRtoData = null;
let stateMap; 

async function fetchFullRtoData() {
  try {
    const response = await fetch('/api/rto/states'); // Assuming this returns an array of state objects
    if (response.ok) {
      fullRtoData = await response.json();
    } else {
      console.error('Failed to fetch full RTO data.');
    }
  } catch (error) {
    console.error('Error fetching full RTO data:', error);
  }
}

// Fetch full RTO data when the page loads
fetchFullRtoData();

function handleInputChange() {
  if (searchInput.value.trim() === "") {
    rtoResultDiv.innerHTML = "";
    rtoResultDiv.classList.remove("has-results");
  }
}

async function displayStateMap(stateName, districtToHighlight = null) {
  const mapContainer = document.getElementById('stateMapContainer');
  mapContainer.innerHTML = ''; 

  if (stateMap) {
      stateMap.remove(); 
      stateMap = null;
  }

  // Set view to Himachal Pradesh coordinates and zoom level
  stateMap = L.map(mapContainer).setView([31.1048, 77.1734], 7);

  // Add OpenStreetMap tiles as the base layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(stateMap);

  try {
      const response = await fetch('maps/india_states.geojson'); // Assuming GeoJSON is in the public root for now
      if (!response.ok) {
          console.error(`Failed to fetch map data for Himachal Pradesh`);
          mapContainer.innerHTML = `<p class="text-danger">Map data not available for Himachal Pradesh.</p>`;
          return;
      }
      const districtData = await response.json();

      L.geoJSON(districtData, {
          style: {
              color: 'black',
              weight: 1,
              fillOpacity: 0.1
          }
      }).addTo(stateMap);

  } catch (error) {
      console.error("Error loading map:", error);
      mapContainer.innerHTML = `<p class="text-danger">Error loading map for Himachal Pradesh.</p>`;
  }
}

async function searchRTO() {
  const query = searchInput.value.trim();

  if (!query) {
      rtoResultDiv.innerHTML = "";
      rtoResultDiv.classList.remove("has-results");
      const mapContainer = document.getElementById('stateMapContainer');
      if (mapContainer) mapContainer.innerHTML = ''; // Clear map if search is cleared
      return;
  }

  document.getElementById("loading").classList.remove("d-none");
  rtoResultDiv.innerHTML = "";
  rtoResultDiv.classList.remove("has-results");

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
      } else if (q) {
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
  let stateRtoCount = {};

  // Check if the search query matches "himachal pradesh" (case-insensitive)
  if (query.toLowerCase() === 'himachal pradesh') {
      displayStateMap(query);
  } else if (fullRtoData) {
      const searchedState = fullRtoData.find(
          (stateObj) => stateObj.toLowerCase() === query.toLowerCase()
      );
      if (searchedState) {
          let totalRTOs = 0;
          const stateDetailsResponse = await fetch(`/api/rto/states/${encodeURIComponent(searchedState)}`);
          if (stateDetailsResponse.ok) {
              const stateDetails = await stateDetailsResponse.json();
              if (stateDetails && stateDetails.districts) {
                  totalRTOs = stateDetails.districts.reduce((sum, district) => sum + (district.rtos ? district.rtos.length : 0), 0);
                  resultsHTML = `
                      <div class="card p-3 mb-2">
                          <p class="mb-1"><strong>State:</strong> ${stateDetails.state}</p>
                          <p class="mb-1"><strong>Total RTOs:</strong> ${totalRTOs}</p>
                      </div>
                  `;
              } else {
                  resultsHTML = `<p class="text-danger">Could not retrieve RTO count for "${query}".</p>`;
              }
          } else {
              resultsHTML = `<p class="text-danger">State "${query}" not found.</p>`;
          }
          rtoResultDiv.innerHTML = resultsHTML;
          rtoResultDiv.classList.add("has-results");
          const mapContainer = document.getElementById('stateMapContainer');
          if (mapContainer) mapContainer.innerHTML = ''; // Clear map when showing state RTO count
          return;
      }
  }

  // Process results for RTO codes or district/name search
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

  uniqueResults.forEach((rto) => {
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
      const mapContainer = document.getElementById('stateMapContainer');
      if (mapContainer) mapContainer.innerHTML = ''; // Clear map when showing RTO details
  } else if (!/himachal pradesh/i.test(query)) {
      rtoResultDiv.innerHTML = `<p class="text-danger">No RTO found for "${query}".</p>`;
      rtoResultDiv.classList.remove("has-results");
      const mapContainer = document.getElementById('stateMapContainer');
      if (mapContainer) mapContainer.innerHTML = ''; // Clear map if no RTO found and not Himachal search
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

// Initialize the district dropdown on page load (optional, if a default state is selected)
if (stateSelect.value) {
  loadDistricts(stateSelect.value);
}
