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
  console.log(`📝 Processing OpenAPI template...`);
  console.log(`   Backend URL: ${backendUrl}`);
  
  // Check if template file exists
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template file not found: ${templatePath}`);
    process.exit(1);
  }

  // Read the template file as string
  let templateContent = fs.readFileSync(templatePath, 'utf8');

  // Replace environment variables in the template
  templateContent = templateContent.replace(/\$\{BACKEND_URL\}/g, backendUrl);

  // Write the processed content directly
  fs.writeFileSync(outputPath, templateContent);

  console.log(`✅ OpenAPI spec generated successfully at ${outputPath}`);
} catch (error) {
  console.error('❌ Error processing OpenAPI template:', error);
  process.exit(1);
}
