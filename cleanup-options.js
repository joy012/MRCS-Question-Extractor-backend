const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/mrcs-questions', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const questionSchema = new mongoose.Schema({
  question: String,
  options: {
    A: String,
    B: String,
    C: String,
    D: String,
  },
  correctAnswer: String,
  categories: [String],
  examYear: Number,
  explanation: String,
  pageNumber: Number,
  extractionMetadata: {
    method: String,
    confidence: Number,
    extractedBy: String,
    sourceFile: String,
    extractedAt: Date,
    extractionVersion: Number,
    manuallyVerified: Boolean,
    verifiedBy: String,
    verifiedAt: Date,
  },
  metrics: {
    difficulty: String,
    viewCount: Number,
    correctAttempts: Number,
    totalAttempts: Number,
    averageTime: Number,
    tags: [String],
  },
  isDeleted: Boolean,
  deletedAt: Date,
  deletedBy: String,
  version: Number,
  lastModifiedBy: String,
  revisionHistory: [String],
}, { timestamps: true });

const Question = mongoose.model('Question', questionSchema);

async function cleanupOptions() {
  try {
    console.log('Starting cleanup of options _id fields...');

    // Find all questions
    const questions = await Question.find({});
    console.log(`Found ${questions.length} questions to process`);

    let updatedCount = 0;

    for (const question of questions) {
      let needsUpdate = false;

      // Check if options has _id field
      if (question.options && question.options._id) {
        console.log(`Removing _id from options for question ${question._id}`);
        delete question.options._id;
        needsUpdate = true;
      }

      // Check if extractionMetadata has _id field
      if (question.extractionMetadata && question.extractionMetadata._id) {
        console.log(`Removing _id from extractionMetadata for question ${question._id}`);
        delete question.extractionMetadata._id;
        needsUpdate = true;
      }

      // Check if metrics has _id field
      if (question.metrics && question.metrics._id) {
        console.log(`Removing _id from metrics for question ${question._id}`);
        delete question.metrics._id;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await question.save();
        updatedCount++;
      }
    }

    console.log(`Cleanup completed. Updated ${updatedCount} questions.`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    mongoose.connection.close();
  }
}

cleanupOptions(); 