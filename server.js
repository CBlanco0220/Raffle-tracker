const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Load current manager data from JSON
let managers = require('./managersData.json');

/**
 * Raffle logic:
 *   First Entry: after 16 Integrations + 25 Graduations
 *   Second Entry: if both thresholds are met => total 2 entries
 *   Additional Entries: +1 for every integration >16 or graduation >25
 */
function calculateRaffleEntries(integrations, graduations) {
  let entries = 0;
  const meetsIntegration = integrations >= 16;
  const meetsGraduation = graduations >= 25;

  // Base entries
  if (meetsIntegration && meetsGraduation) {
    entries = 2;
  } else if (meetsIntegration || meetsGraduation) {
    entries = 1;
  }

  // Additional
  if (integrations > 16) {
    entries += (integrations - 16);
  }
  if (graduations > 25) {
    entries += (graduations - 25);
  }
  return entries;
}

/**
 * Save data to managersData.json
 */
function saveDataToFile() {
  fs.writeFileSync(
    path.join(__dirname, 'managersData.json'),
    JSON.stringify(managers, null, 2),
    'utf8'
  );
}

// Serve static files from ./public
app.use(express.static(path.join(__dirname, 'public')));

/**
 * GET /api/managers
 * Return array of managers, computing "entries" unless manually overridden
 */
app.get('/api/managers', (req, res) => {
  const result = managers.map(m => {
    // if manager has 'entries' as a number, that's a manual override
    if (typeof m.entries === 'number') {
      return {
        name: m.name,
        graduations: m.graduations,
        integrations: m.integrations,
        entries: m.entries
      };
    }
    // otherwise compute from the logic
    const computedEntries = calculateRaffleEntries(m.integrations, m.graduations);
    return {
      name: m.name,
      graduations: m.graduations,
      integrations: m.integrations,
      entries: computedEntries
    };
  });
  res.json(result);
});

/**
 * POST /api/managers/:name/graduations
 * Body: { quantity }
 * Increments that manager's graduations
 */
app.post('/api/managers/:name/graduations', (req, res) => {
  const managerName = req.params.name.toLowerCase();
  const { quantity } = req.body;

  if (typeof quantity !== 'number' || quantity < 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  const manager = managers.find(m => m.name.toLowerCase() === managerName);
  if (!manager) {
    return res.status(404).json({ error: 'Manager not found' });
  }

  manager.graduations += quantity;

  // If there's a manual entries override, remove it so we recalc
  if ('entries' in manager) {
    delete manager.entries;
  }

  saveDataToFile();
  res.json({ message: `Added ${quantity} Graduations to ${manager.name}`, manager });
});

/**
 * POST /api/managers/:name/integrations
 * Body: { quantity }
 * Increments that manager's integrations
 */
app.post('/api/managers/:name/integrations', (req, res) => {
  const managerName = req.params.name.toLowerCase();
  const { quantity } = req.body;

  if (typeof quantity !== 'number' || quantity < 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  const manager = managers.find(m => m.name.toLowerCase() === managerName);
  if (!manager) {
    return res.status(404).json({ error: 'Manager not found' });
  }

  manager.integrations += quantity;

  // Remove manual override if present
  if ('entries' in manager) {
    delete manager.entries;
  }

  saveDataToFile();
  res.json({ message: `Added ${quantity} Integrations to ${manager.name}`, manager });
});

/**
 * POST /api/managers/:name/set
 * Body: { field: "graduations"|"integrations"|"entries", newValue: number }
 * Manually set a manager's data field
 */
app.post('/api/managers/:name/set', (req, res) => {
  const managerName = req.params.name.toLowerCase();
  const { field, newValue } = req.body;

  if (!['graduations','integrations','entries'].includes(field)) {
    return res.status(400).json({ error: 'Field must be graduations, integrations, or entries' });
  }
  if (typeof newValue !== 'number' || newValue < 0) {
    return res.status(400).json({ error: 'newValue must be a non-negative number' });
  }

  const manager = managers.find(m => m.name.toLowerCase() === managerName);
  if (!manager) {
    return res.status(404).json({ error: 'Manager not found' });
  }

  manager[field] = newValue;

  // If user changed graduations or integrations, remove any manual entries override
  if ((field === 'graduations' || field === 'integrations') && ('entries' in manager)) {
    delete manager.entries;
  }

  saveDataToFile();
  res.json({
    message: `Set ${manager.name}'s ${field} to ${newValue}`,
    manager
  });
});

/**
 * POST /api/reset
 * Zero out all data: graduations, integrations, and remove manual 'entries'.
 */
app.post('/api/reset', (req, res) => {
  managers.forEach(m => {
    m.graduations = 0;
    m.integrations = 0;
    if ('entries' in m) {
      delete m.entries;
    }
  });

  saveDataToFile();
  res.json({ message: 'All manager data has been RESET to zeros!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Raffle Tracker server is running at http://localhost:${PORT}`);
});
