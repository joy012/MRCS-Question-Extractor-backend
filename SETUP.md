# MRCS Question Extractor Backend Setup

## 🚀 Quick Start

### Prerequisites
1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **pnpm** - Install with `npm install -g pnpm`
3. **MongoDB** - [Download here](https://www.mongodb.com/try/download/community) or use Docker
4. **Ollama** - [Install for macOS](https://ollama.ai/download)

### Installation

1. **Install dependencies** (from project root):
```bash
cd mrcs-question-extractor
pnpm install
```

2. **Setup data directory and PDF**:
```bash
cd apps/backend
pnpm run setup
```

3. **Place your PDF file**:
   - Put your MRCS question bank PDF in: `apps/backend/data/mrcs-question-bank.pdf`
   - The file should be ~300MB and contain pages 1-1896
   - We'll extract from page 3 to 1896 (1894 pages total)

4. **Start MongoDB** (choose one option):

   **Option A: Docker (Recommended)**
   ```bash
   cd apps/backend
   docker-compose up -d mongodb
   ```

   **Option B: Local MongoDB**
   ```bash
   mongod
   ```

5. **Setup Ollama**:
   ```bash
   # Start Ollama service
   ollama serve
   
   # In another terminal, pull the model
   ollama pull llama3.1
   ```

6. **Configure Environment**:
   ```bash
   cd apps/backend
   # .env file is auto-created by setup script
   # Review and modify if needed
   ```

### Running the Backend

```bash
# From project root
pnpm dev --filter=backend

# Or from backend directory
cd apps/backend
pnpm run start:dev
```

The API will be available at: `http://localhost:3001/api`

### API Documentation

Once running, visit: `http://localhost:3001/api/docs` for interactive Swagger documentation.

## 🔧 Incremental Extraction System

### How It Works

- **Batch Processing**: Extracts 10 pages at a time
- **Progress Tracking**: MongoDB stores current progress
- **Smart Resume**: Continues from where it left off
- **No Overwrite**: Re-running won't duplicate questions

### Extraction Process

1. **Frontend Button**: Triggers batch extraction via API
2. **10-Page Batch**: Processes pages 3-12, then 13-22, etc.
3. **AI Processing**: Uses Ollama to extract questions and categorize
4. **Database Storage**: Saves to MongoDB with progress tracking
5. **Real-time Updates**: WebSocket sends live progress to frontend

### Key Endpoints

```bash
# Start next batch (10 pages)
POST /api/extraction/start-batch

# Get current progress
GET /api/extraction/status

# Reset to start over
POST /api/extraction/reset

# Validate PDF and services
GET /api/extraction/validate
```

## 📊 Extraction Configuration

```env
# PDF Processing
PDF_PATH=./data/mrcs-question-bank.pdf
START_PAGE=3
END_PAGE=1896
EXTRACTION_BATCH_SIZE=10

# Database
MONGODB_URI=mongodb://localhost:27017/mrcs-questions

# Ollama AI
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

## 🧪 Health Checks

```bash
# Check if API is running
curl http://localhost:3001/api

# Check PDF and Ollama status
curl http://localhost:3001/api/extraction/validate

# Get extraction progress
curl http://localhost:3001/api/extraction/status
```

## 🔍 Troubleshooting

### Common Issues

1. **PDF Not Found**
   - Place PDF at: `apps/backend/data/mrcs-question-bank.pdf`
   - Run: `pnpm run setup` to verify

2. **MongoDB Connection Failed**
   - Start MongoDB: `docker-compose up -d mongodb`
   - Check connection string in `.env`

3. **Ollama Not Accessible**
   - Start Ollama: `ollama serve`
   - Pull model: `ollama pull llama3.1`

4. **Extraction Stuck**
   - Check status: `GET /api/extraction/status`
   - Reset if needed: `POST /api/extraction/reset`

### Progress Tracking

The system tracks:
- Current page number
- Total pages processed
- Questions extracted per batch
- Failed pages for retry
- Overall completion percentage

## 📊 Expected Performance

- **Total Pages**: 1894 (pages 3-1896)
- **Batch Size**: 10 pages
- **Total Batches**: ~190 batches
- **Time per Batch**: 5-10 minutes
- **Total Time**: 15-30 hours (spread over multiple sessions)

## 🏗️ Project Structure

```
apps/backend/
├── data/
│   └── mrcs-question-bank.pdf    # Your PDF file (300MB)
├── src/
│   ├── modules/
│   │   ├── extraction/           # PDF processing & AI
│   │   ├── questions/           # Question CRUD
│   │   └── websocket/           # Real-time updates
│   └── schemas/                 # MongoDB schemas
├── docker-compose.yml           # MongoDB setup
├── setup-data.js               # Setup script
└── SETUP.md                    # This file
```

## 🚦 Next Steps

1. **Run Setup**: `pnpm run setup`
2. **Place PDF**: Copy to `data/mrcs-question-bank.pdf`
3. **Start Services**: MongoDB + Ollama + Backend
4. **Validate**: Check `/api/extraction/validate`
5. **Ready for Frontend**: Backend ready for React integration

---

**Status**: ✅ Incremental extraction system ready for frontend integration! 