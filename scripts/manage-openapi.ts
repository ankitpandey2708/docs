import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Get backend URL from environment
const backendUrl: string =
  process.env.ZUDOKU_PUBLIC_BACKEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://docs.finarkein.com'
    : 'http://localhost:3001');

// Path to the template file
const templatePath = './openapi.template.yaml';
const outputPath = './openapi.yaml';

try {
  
  // Check if template file exists
  if (!fs.existsSync(templatePath)) {
    process.exit(1);
  }

  // Read the template file as string
  let templateContent = fs.readFileSync(templatePath, 'utf8');

  // Replace environment variables in the template
  templateContent = templateContent.replace(/\$\{BACKEND_URL\}/g, backendUrl);
  
  // Get workspace from environment (defaults to tsfsl)
  const workspace = process.env.workspace || 'tsfsl';
  const workspaceLower = workspace.toLowerCase();
  const nervFlowId = process.env[`${workspaceLower}_NERV_FLOW_ID`] || process.env['nerv.flow.id'] || '376b71fe-009b-4154-850c-fa0eb65b4d5a';
  
  console.log(`   Workspace: ${workspace}`);
  console.log(`   Nerv Flow ID: ${nervFlowId}`);
  
  // Replace workspace and flowId defaults in the OpenAPI spec
  // This regex finds the first occurrence of workspace parameter with default
  templateContent = templateContent.replace(
    /(- name: workspace[\s\S]*?schema:[\s\S]*?type: string[\s\S]*?)(default: \w+)([\s\S]*?example: )(\w+)/,
    `$1default: ${workspace}$3${workspace}`
  );
  
  // Replace flowId defaults
  templateContent = templateContent.replace(
    /(- name: flowId[\s\S]*?schema:[\s\S]*?type: string[\s\S]*?)(default: [a-f0-9-]+)([\s\S]*?example: )([a-f0-9-]+)/,
    `$1default: ${nervFlowId}$3${nervFlowId}`
  );

  // Write the processed content directly
  fs.writeFileSync(outputPath, templateContent);

} catch (error) {
  process.exit(1);
}
