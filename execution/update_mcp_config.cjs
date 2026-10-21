const fs = require('fs');

const ideConfigPath = 'C:\\Users\\Abhinav\\.gemini\\antigravity-ide\\mcp_config.json';
const appConfigPath = 'C:\\Users\\Abhinav\\.gemini\\antigravity\\mcp_config.json';
const token = process.env.SUPABASE_ACCESS_TOKEN || '';

function updateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist:', filePath);
    return;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);
    if (!json.mcpServers) json.mcpServers = {};
    json.mcpServers.supabase = {
      serverUrl: 'https://mcp.supabase.com/mcp',
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
    console.log('Successfully updated:', filePath);
  } catch (err) {
    console.error('Error updating ' + filePath + ':', err.message);
  }
}

updateFile(ideConfigPath);
updateFile(appConfigPath);
