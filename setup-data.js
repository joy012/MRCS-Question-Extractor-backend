#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PDF_NAME = 'mrcs-question-bank.pdf';
const PDF_PATH = path.join(DATA_DIR, PDF_NAME);

async function setupDataDirectory() {
  console.log('🔧 Setting up MRCS Question Extractor data directory...\n');

  try {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log('✅ Created data directory:', DATA_DIR);
    } else {
      console.log('📁 Data directory already exists:', DATA_DIR);
    }

    // Check if PDF file exists
    if (fs.existsSync(PDF_PATH)) {
      const stats = fs.statSync(PDF_PATH);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log('✅ PDF file found!');
      console.log(`   📄 File: ${PDF_NAME}`);
      console.log(`   📊 Size: ${fileSizeMB} MB`);
      console.log(`   📍 Location: ${PDF_PATH}`);

      if (stats.size > 100 * 1024 * 1024) { // > 100MB
        console.log('✅ PDF file size looks good for a large question bank');
      } else {
        console.log('⚠️  PDF file seems small - please verify it\'s the complete question bank');
      }
    } else {
      console.log('❌ PDF file not found!');
      console.log(`\n📋 Please follow these steps:`);
      console.log(`1. Place your MRCS question bank PDF file at:`);
      console.log(`   ${PDF_PATH}`);
      console.log(`2. Make sure the file is named: ${PDF_NAME}`);
      console.log(`3. Verify the PDF contains pages 1-1896 (we'll extract pages 3-1896)`);
      console.log(`4. Run this setup script again to verify`);

      process.exit(1);
    }

    // Create environment file if it doesn't exist
    const envPath = path.join(__dirname, '.env');
    const envExamplePath = path.join(__dirname, 'env.example');

    if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ Created .env file from template');
      console.log('📝 You may want to review and update the .env file with your settings');
    }

    console.log('\n🎉 Setup complete! Your backend is ready for PDF extraction.');
    console.log('\n📋 Next steps:');
    console.log('1. Start MongoDB: docker-compose up -d mongodb');
    console.log('2. Start Ollama: ollama serve');
    console.log('3. Pull Ollama model: ollama pull llama3.1');
    console.log('4. Start backend: pnpm run start:dev');
    console.log('5. Test extraction: pnpm run test:backend');

    console.log('\n📊 Extraction Configuration:');
    console.log(`   📄 PDF: ${PDF_NAME} (300MB expected)`);
    console.log(`   📖 Pages: 3 to 1896 (1894 pages total)`);
    console.log(`   📦 Batch size: 10 pages per extraction`);
    console.log(`   🔄 Total batches: ~190 batches`);
    console.log(`   ⏱️  Estimated time: 5-10 minutes per batch`);

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setupDataDirectory();
} 