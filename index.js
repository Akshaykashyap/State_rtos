const express = require('express');
const fs = require('fs');
const app = express();
const port = 3000;

let rto_data = []; // Initialize as an array

// Load RTO data from JSON file
try {
  const data = fs.readFileSync('rto_data.json', 'utf8');
  rto_data = JSON.parse(data);
} catch (err) {
  console.error(err);
}

app.get('/api/rto/states', (req, res) => {
  if (rto_data.length > 0) {
    const states = rto_data.map(item => item.state); // Access state from the array
    res.json(states);
  } else {
    res.json([]); // Return an empty array if no data
  }
});

app.get('/api/rto/states/:stateName', (req, res) => {
  const stateName = req.params.stateName;
  const stateData = rto_data.find(item => item.state === stateName); // Find the state

  if (stateData) {
    res.json(stateData);
  } else {
    res.status(404).json({ message: 'State not found' });
  }
});

app.get('/api/rto/states/:stateName/districts', (req, res) => {
  const stateName = req.params.stateName;
  const stateData = rto_data.find(item => item.state === stateName);

  if (stateData) {
    const districts = stateData.districts.map(d => d.district);
    res.json(districts);
  } else {
    res.status(404).json({ message: 'State not found' });
  }
});

app.get('/api/rto/states/:stateName/districts/:districtName', (req, res) => {
  const stateName = req.params.stateName;
  const districtName = req.params.districtName;
  const stateData = rto_data.find(item => item.state === stateName);

  if (stateData) {
    const district = stateData.districts.find(d => d.district === districtName);
    if (district) {
      res.json(district);
    } else {
      res.status(404).json({ message: 'District not found' });
    }
  } else {
    res.status(404).json({ message: 'State not found' });
  }
});

// New endpoint to get all RTO codes for a particular state
app.get('/api/rto/states/:stateName/rtocodes', (req, res) => {
    console.log("rtocodes route hit!"); 
    const stateName = req.params.stateName;
    console.log("stateName from URL:", stateName); 
    const stateData = rto_data.find(item => item.state === stateName);
    console.log("stateData:", stateData); 
    if (stateData) {
        let allRtos = [];
        for (const district of stateData.districts) {
            if (district.rtos) {
                for (const rto of district.rtos) {
                    allRtos.push({
                        rto: rto.rto,
                        rto_code: rto.rto_code,
                        address: rto.address,
                        phone: rto.phone
                    });
                }
            }
        }
        console.log("allRtos:", allRtos); 
        res.json(allRtos);
    } else {
        res.status(404).json({ message: 'State RTO Code not found' });
    }
});

// Example: Get RTO by RTO code (if your JSON structure supports it)
app.get('/api/rto/rtocodes/:rtoCode', (req, res) => {
  const rtoCode = req.params.rtoCode;
  let foundRto = null;

  for (const stateData of rto_data) {
    for (const districtData of stateData.districts) {
      if (districtData.rtos) {
        for (const rto of districtData.rtos) {
          if (rto.rto_code === rtoCode) {
            foundRto = rto;
            break;
          }
        }
      }
      if (foundRto) break;
    }
    if (foundRto) break;
  }

  if (foundRto) {
    res.json(foundRto);
  } else {
    res.status(404).json({ message: 'RTO code not found' });
  }
});

app.listen(port, () => {
  console.log(`RTO API listening on port ${port}`);
});

module.exports = app;