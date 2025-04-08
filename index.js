const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
// const port = 3000;

let rto_data = []; 

app.use(express.static(path.join(__dirname, 'public')));
// Load RTO data from JSON file
try {
  const data = fs.readFileSync(path.join(__dirname, 'rto_data.json'), 'utf8');
  rto_data = JSON.parse(data);
} catch (err) {
  console.error('Failed to load RTO data:', err);
}

app.get('/api/rto/states', (req, res) => {
  if (rto_data.length > 0) {
    const states = rto_data.map(item => item.state); 
    res.json(states);
  } else {
    res.json([]); 
  }
});

app.get('/api/rto/states/:stateName', (req, res) => {
  const stateName = req.params.stateName.toLowerCase();
  const stateData = rto_data.find(item => item.state.toLowerCase() === stateName); 

  if (stateData) {
    res.json(stateData);
  } else {
    res.status(404).json({ message: 'State not found' });
  }
});

app.get('/api/rto/states/:stateName/districts', (req, res) => {
  const stateName = req.params.stateName.toLowerCase();
  const stateData = rto_data.find(item => item.state.toLowerCase() === stateName);

  if (stateData) {
    const districts = stateData.districts.map(d => d.district);
    res.json(districts);
  } else {
    res.status(404).json({ message: 'State not found' });
  }
});

app.get('/api/rto/states/:stateName/districts/:districtName', (req, res) => {
  const stateName = req.params.stateName.toLowerCase();
  const districtName = req.params.districtName.toLowerCase();
  const stateData = rto_data.find(item => item.state.toLowerCase() === stateName);

  if (stateData) {
    const district = stateData.districts.find(d => d.district.toLowerCase() === districtName);
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
    const stateName = req.params.stateName.toLowerCase();
    const stateData = rto_data.find(item => item.state.toLowerCase() === stateName);
    if (stateData) {
        let allRtos = [];
        for (const district of stateData.districts) {
            if (district.rtos) {
                for (const rto of district.rtos) {
                    allRtos.push({
                        rto: rto.rto,
                        rto_code: rto.rto_code,
                        address: rto.address && rto.address !== '-' ? rto.address : 'Not Available',
                        phone: rto.phone && rto.phone !== '-' ? rto.phone : null
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

app.get('/api/rto/rtocodes/:rtoCode', (req, res) => {
  const rtoCode = req.params.rtoCode.toLowerCase(); // make it case-insensitive
  let foundRto = null;

  for (const stateData of rto_data) {
    for (const districtData of stateData.districts) {
      if (districtData.rtos) {
        for (const rto of districtData.rtos) {
          if (rto.rto_code && rto.rto_code.toLowerCase() === rtoCode) {
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

// GET /api/rto/states/:stateName/districts/:districtName/rtos
app.get('/api/rto/states/:stateName/districts/:districtName/rtos', (req, res) => {
  const stateName = req.params.stateName.toLowerCase();
  const districtName = req.params.districtName.toLowerCase();

  const stateData = rto_data.find(item => item.state.toLowerCase() === stateName);

  if (stateData) {
    const districtData = stateData.districts.find(d => d.district.toLowerCase() === districtName);
    if (districtData) {
      res.json(districtData.rtos || []);
    } else {
      res.status(404).json({ message: 'District not found' });
    }
  } else {
    res.status(404).json({ message: 'State not found' });
  }
});

// GET /api/rto/search?q=thane
app.get('/api/rto/search', (req, res) => {
  const query = req.query.q?.toLowerCase();
  if (!query) return res.status(400).json({ message: 'Query is required' });

  let matches = [];

  for (const state of rto_data) {
    for (const district of state.districts) {
      for (const rto of district.rtos || []) {
        if (rto.rto.toLowerCase().includes(query)) {
          matches.push({
            state: state.state,
            district: district.district,
            rto: rto.rto,
            rto_code: rto.rto_code,
            address: rto.address && rto.address !== '-' ? rto.address : 'Not Available',
            phone: rto.phone && rto.phone !== '-' ? rto.phone : null
          });
        }
      }
    }
  }

  res.json(matches);
});

// Optional: Route for root if not using index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// app.listen(port, () => {
//   console.log(`RTO API listening on port ${port}`);
// });

module.exports = app;
