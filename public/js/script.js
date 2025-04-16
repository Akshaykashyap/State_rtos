
      const searchInput = document.getElementById("searchInput");
      const rtoResultDiv = document.getElementById("rtoResult");
      const addRtoForm = document.getElementById('addRtoForm');
      const messageDiv = document.getElementById('message');
      const stateSelect = document.getElementById('state');
      const districtSelect = document.getElementById('district-select');

      // Store the full RTO data fetched once
      let fullRtoData = null;

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

      async function searchRTO() {
        const query = searchInput.value.trim();

        if (!query) {
          rtoResultDiv.innerHTML = "";
          rtoResultDiv.classList.remove("has-results");
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

        // Check if the search query matches a state name
        if (fullRtoData) {
          const searchedState = fullRtoData.find(
            (stateObj) => stateObj.toLowerCase() === query.toLowerCase()
          );
          if (searchedState) {
            let totalRTOs = 0;
            // You'll need to fetch the full details of the state to count RTOs
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
        } else {
          rtoResultDiv.innerHTML = `<p class="text-danger">No RTO found for "${query}".</p>`;
          rtoResultDiv.classList.remove("has-results");
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