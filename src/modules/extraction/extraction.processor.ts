import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CategoriesService } from '../categories/categories.service';
import { IntakesService } from '../intakes/intakes.service';
import { QuestionsService } from '../questions/questions.service';
import { ExtractionStateDto, ExtractionStatus } from '../settings/dto';
import { SettingsService } from '../settings/settings.service';
import { ExtractedQuestion, OllamaService } from './ollama.service';
import { PdfService } from './pdf.service';

export interface ExtractionJobData {
  extractionId: string;
  filename: string;
  model?: string;
  startPage?: number;
  maxPages?: number;
  overwrite?: boolean;
}

@Processor('extraction')
export class ExtractionProcessor {
  private readonly logger = new Logger(ExtractionProcessor.name);

  constructor(
    private readonly ollamaService: OllamaService,
    private readonly pdfService: PdfService,
    private readonly questionsService: QuestionsService,
    private readonly categoriesService: CategoriesService,
    private readonly intakesService: IntakesService,
    private readonly settingsService: SettingsService,
  ) {}

  @Process('extract')
  async handleExtraction(job: Job<ExtractionJobData>) {
    const { extractionId, filename, model, startPage, maxPages, overwrite } =
      job.data;

    this.logger.log(`Starting extraction job ${extractionId} for ${filename}`);

    try {
      // Set the current PDF in the PDF service
      this.pdfService.setCurrentPdf(filename);

      // Set the model in the Ollama service if provided
      if (model) {
        this.ollamaService.setModel(model);
      }

      // Initialize extraction state
      const initialState: ExtractionStateDto = {
        status: ExtractionStatus.PROCESSING,
        selectedPdf: filename,
        progress: 0,
        totalPages: 0,
        processedPages: 0,
        failedPages: [],
        logs: [
          `[${new Date().toISOString()}] Starting extraction for ${filename}`,
        ],
        startTime: new Date().toISOString(),
        extractedQuestions: 0,
        questionsPerPage: {},
        verifiedQuestions: 0,
        updatedQuestions: 0,
        skippedQuestions: 0,
        extractionId,
        model,
        startPage,
        maxPages,
        overwrite,
      };

      await this.settingsService.saveExtractionState(initialState);

      // Get PDF information
      const pdfInfo = await this.pdfService.getPdfInfo();
      const updatedState = {
        ...initialState,
        totalPages: pdfInfo.totalPages,
      };
      updatedState.logs.push(
        `[${new Date().toISOString()}] PDF loaded: ${pdfInfo.totalPages} pages`,
      );
      await this.settingsService.saveExtractionState(updatedState);

      // Determine start and end pages
      const actualStartPage = startPage || 1;
      const actualMaxPages = maxPages || pdfInfo.totalPages;
      const endPage = Math.min(
        actualStartPage + actualMaxPages - 1,
        pdfInfo.totalPages,
      );

      updatedState.logs.push(
        `[${new Date().toISOString()}] Processing pages ${actualStartPage}-${endPage} of ${pdfInfo.totalPages}`,
      );
      await this.settingsService.saveExtractionState(updatedState);

      // Process pages sequentially
      for (
        let pageNumber = actualStartPage;
        pageNumber <= endPage;
        pageNumber++
      ) {
        await this.processPage(pageNumber, filename, updatedState, overwrite);
      }

      // Mark extraction as completed
      await this.updateExtractionState({
        ...updatedState,
        status: ExtractionStatus.COMPLETED,
        endTime: new Date().toISOString(),
        logs: [
          ...updatedState.logs,
          `[${new Date().toISOString()}] Extraction completed successfully`,
          `[${new Date().toISOString()}] Total questions extracted: ${updatedState.extractedQuestions}`,
          `[${new Date().toISOString()}] Verified questions skipped: ${updatedState.verifiedQuestions}`,
          `[${new Date().toISOString()}] Questions updated: ${updatedState.updatedQuestions}`,
          `[${new Date().toISOString()}] Questions skipped: ${updatedState.skippedQuestions}`,
        ],
      });

      this.logger.log(`Extraction job ${extractionId} completed successfully`);
    } catch (error) {
      this.logger.error(`Extraction job ${extractionId} failed:`, error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.updateExtractionState({
        status: ExtractionStatus.FAILED,
        selectedPdf: filename,
        progress: 0,
        totalPages: 0,
        processedPages: 0,
        failedPages: [],
        logs: [
          `[${new Date().toISOString()}] Extraction failed: ${errorMessage}`,
        ],
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        error: errorMessage,
        extractedQuestions: 0,
        questionsPerPage: {},
        verifiedQuestions: 0,
        updatedQuestions: 0,
        skippedQuestions: 0,
        extractionId,
      });
    }
  }

  private async processPage(
    pageNumber: number,
    pdf: string,
    state: any,
    overwrite: boolean = false,
  ) {
    try {
      state.logs.push(
        `[${new Date().toISOString()}] Processing page ${pageNumber}/${state.totalPages}`,
      );
      await this.settingsService.saveExtractionState(state);

      // Extract text from PDF page
      let pageText: string;
      try {
        pageText = await this.pdfService.extractTextFromPage(pageNumber);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        state.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: Failed to extract text - ${errorMessage}`,
        );
        this.updateProgress(pageNumber, state);
        return;
      }

      if (!pageText || pageText.trim().length === 0) {
        state.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: No text found, skipping`,
        );
        this.updateProgress(pageNumber, state);
        return;
      }

      // Extract questions using Ollama
      const extractedQuestions =
        await this.ollamaService.extractQuestionsFromText(
          pageText,
          pageNumber,
          pdf,
        );

      // Process and store questions
      const processedQuestions = await this.processExtractedQuestions(
        extractedQuestions,
        pageNumber,
        overwrite,
      );

      // Log extraction results
      if (processedQuestions.length > 0) {
        state.extractedQuestions += processedQuestions.length;
        state.questionsPerPage[pageNumber] = processedQuestions.length;

        state.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: Processed ${processedQuestions.length} questions`,
        );

        // Log details for each question
        processedQuestions.forEach((question, index) => {
          state.logs.push(
            `[${new Date().toISOString()}] Page ${pageNumber}, Q${index + 1}: "${question.question.substring(0, 100)}..." (${question.categories.join(', ')})`,
          );
        });
      } else {
        state.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: No valid questions found`,
        );
      }

      this.updateProgress(pageNumber, state);
    } catch (error) {
      state.failedPages.push(pageNumber);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      state.logs.push(
        `[${new Date().toISOString()}] Page ${pageNumber}: Error - ${errorMessage}`,
      );
      this.logger.error(`Failed to process page ${pageNumber}:`, error);
    }
  }

  private async processExtractedQuestions(
    extractedQuestions: ExtractedQuestion[],
    pageNumber: number,
    overwrite: boolean = false,
  ): Promise<ExtractedQuestion[]> {
    const processedQuestions: ExtractedQuestion[] = [];

    for (const extractedQuestion of extractedQuestions) {
      try {
        // Validate question quality
        if (!this.isQuestionValid(extractedQuestion)) {
          this.logger.log(`Page ${pageNumber}: Skipping invalid question`);
          continue;
        }

        // Check if question already exists and is verified
        const existingQuestion =
          await this.findExistingQuestion(extractedQuestion);

        if (existingQuestion) {
          // If overwrite is enabled, update regardless of status
          if (overwrite) {
            await this.updateExistingQuestion(
              existingQuestion.id,
              extractedQuestion,
            );
            this.logger.log(
              `Page ${pageNumber}: Updated existing question (overwrite mode)`,
            );
            continue;
          }

          if (existingQuestion.status === 'APPROVED') {
            // Skip verified questions
            this.logger.log(`Page ${pageNumber}: Skipping verified question`);
            continue;
          } else {
            // Update existing unverified question if new one is better
            const shouldUpdate = this.shouldUpdateQuestion(
              existingQuestion,
              extractedQuestion,
            );

            if (shouldUpdate) {
              await this.updateExistingQuestion(
                existingQuestion.id,
                extractedQuestion,
              );
              this.logger.log(`Page ${pageNumber}: Updated existing question`);
            } else {
              this.logger.log(
                `Page ${pageNumber}: Skipping - existing question is better`,
              );
            }
            continue;
          }
        }

        // Create new question
        await this.createNewQuestion(extractedQuestion);
        processedQuestions.push(extractedQuestion);
        this.logger.log(`Page ${pageNumber}: Created new question`);
      } catch (error) {
        this.logger.error(
          `Page ${pageNumber}: Error processing question:`,
          error,
        );
      }
    }

    return processedQuestions;
  }

  private isQuestionValid(question: ExtractedQuestion): boolean {
    // Check if question text is meaningful
    if (
      !question.question ||
      question.question.length < 20 ||
      question.question.length > 2000 ||
      question.question.includes('...') ||
      question.question.includes('???')
    ) {
      return false;
    }

    // Check if all options are meaningful
    const options = ['A', 'B', 'C', 'D', 'E'];
    for (const option of options) {
      const optionText = question.options[option];
      if (
        !optionText ||
        optionText.length < 3 ||
        optionText.length > 1000 ||
        optionText.includes('...') ||
        optionText.includes('???')
      ) {
        return false;
      }
    }

    // Check if correct answer is valid
    if (
      !question.correctAnswer ||
      !['A', 'B', 'C', 'D', 'E'].includes(question.correctAnswer)
    ) {
      return false;
    }

    // Check if categories are valid
    if (!question.categories || question.categories.length === 0) {
      return false;
    }

    // Check if year is reasonable
    if (
      !question.examYear ||
      question.examYear < 2000 ||
      question.examYear > 2030
    ) {
      return false;
    }

    // Check if intake is valid
    if (!question.intake) {
      return false;
    }

    return true;
  }

  private async findExistingQuestion(
    extractedQuestion: ExtractedQuestion,
  ): Promise<any> {
    try {
      // Simple similarity check - could be improved with more sophisticated matching
      const similarQuestions = await this.questionsService.findAll({
        search: extractedQuestion.question.substring(0, 100),
        limit: 10,
      });

      for (const question of similarQuestions.data) {
        if (
          this.calculateSimilarity(
            question.question,
            extractedQuestion.question,
          ) > 0.8
        ) {
          return question;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error finding existing question:', error);
      return null;
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter((word) => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;

    return commonWords.length / totalWords;
  }

  private shouldUpdateQuestion(
    existingQuestion: any,
    newQuestion: ExtractedQuestion,
  ): boolean {
    // If existing question has higher confidence, don't update
    if (existingQuestion.aiMetadata?.confidence > newQuestion.confidence) {
      return false;
    }

    // If new question has significantly higher confidence, update
    if (
      newQuestion.confidence >
      (existingQuestion.aiMetadata?.confidence || 0) + 0.1
    ) {
      return true;
    }

    // If new question has better quality (longer, more complete), update
    if (newQuestion.question.length > existingQuestion.question.length * 1.2) {
      return true;
    }

    return false;
  }

  private async updateExistingQuestion(
    questionId: string,
    extractedQuestion: any,
  ): Promise<void> {
    try {
      // Convert category names to IDs
      const categoryIds = await this.convertCategoryNamesToIds(
        extractedQuestion.categories,
      );

      // Convert intake name to ID
      const intakeId = await this.convertIntakeNameToId(
        extractedQuestion.intake,
      );

      await this.questionsService.update(questionId, {
        question: extractedQuestion.question,
        options: extractedQuestion.options,
        correctAnswer: extractedQuestion.correctAnswer,
        categories: categoryIds,
        year: extractedQuestion.examYear,
        intake: intakeId,
        explanation: extractedQuestion.explanation,
        aiMetadata: {
          confidence: extractedQuestion.confidence,
          extractedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error updating existing question:', error);
      throw error;
    }
  }

  private async createNewQuestion(extractedQuestion: any): Promise<void> {
    try {
      // Convert category names to IDs
      const categoryIds = await this.convertCategoryNamesToIds(
        extractedQuestion.categories,
      );

      // Convert intake name to ID
      const intakeId = await this.convertIntakeNameToId(
        extractedQuestion.intake,
      );

      await this.questionsService.create({
        question: extractedQuestion.question,
        options: extractedQuestion.options,
        correctAnswer: extractedQuestion.correctAnswer,
        categories: categoryIds,
        year: extractedQuestion.examYear,
        intake: intakeId,
        explanation: extractedQuestion.explanation,
        aiMetadata: {
          confidence: extractedQuestion.confidence,
          extractedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error creating new question:', error);
      throw error;
    }
  }

  private async convertCategoryNamesToIds(
    categoryNames: string[],
  ): Promise<string[]> {
    const categoryIds: string[] = [];

    for (const categoryName of categoryNames) {
      const category = await this.categoriesService.findByName(categoryName);
      if (category) {
        categoryIds.push(category.id);
      } else {
        this.logger.warn(`Category not found: ${categoryName}`);
      }
    }

    // If no categories were found, use a default category
    if (categoryIds.length === 0) {
      const activeCategories = await this.categoriesService.findAllActive();
      if (activeCategories.length > 0) {
        this.logger.warn(
          `No valid categories found, using default category: ${activeCategories[0].name}`,
        );
        categoryIds.push(activeCategories[0].id);
      } else {
        throw new Error('No active categories found in database');
      }
    }

    return categoryIds;
  }

  private async convertIntakeNameToId(intakeName: string): Promise<string> {
    // First try to find existing intake by name
    const intake = await this.intakesService.findByName(intakeName);

    if (intake) {
      return intake.id;
    }

    // If intake doesn't exist, use the first active intake as fallback
    const activeIntakes = await this.intakesService.findAllActive();
    if (activeIntakes.length > 0) {
      this.logger.warn(
        `Intake "${intakeName}" not found, using fallback intake: ${activeIntakes[0].name}`,
      );
      return activeIntakes[0].id;
    }

    // If no active intakes exist, throw an error
    throw new Error(
      `No active intakes found in database. Cannot process question with intake: ${intakeName}`,
    );
  }

  private updateProgress(pageNumber: number, state: any): void {
    state.processedPages = pageNumber;
    state.progress = Math.round((pageNumber / state.totalPages) * 100);
  }

  private async updateExtractionState(state: any): Promise<void> {
    await this.settingsService.saveExtractionState(state);
  }
}
