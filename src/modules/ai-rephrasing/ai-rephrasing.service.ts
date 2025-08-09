import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { OllamaService } from '../extraction/ollama.service';
import {
  AiRephrasingSettingsDto,
  AiRephrasingStatisticsDto,
  AiRephrasingStatusDto,
  QuestionRephrasingDto,
} from './dto/ai-rephrasing.types';

@Injectable()
export class AiRephrasingService {
  private readonly logger = new Logger(AiRephrasingService.name);
  private isProcessing = false;
  private logs: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly ollamaService: OllamaService,
  ) {
    this.addLog('AI rephrasing service initialized');
  }

  private addLog(
    message: string,
    level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' = 'INFO',
  ): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}`;
    this.logs.unshift(logEntry); // Add to beginning for reverse chronological order

    // Keep only last 1000 logs to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }

    this.logger.log(message);
  }

  async getSettings(): Promise<AiRephrasingSettingsDto> {
    const settings = await this.prisma.aiRephrasingSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      // Create default settings
      const newSettings = await this.prisma.aiRephrasingSettings.create({
        data: {
          isActive: false,
          model: 'llama3.1',
          totalQuestions: 0,
          processedQuestions: 0,
          skippedQuestions: 0,
          failedQuestions: 0,
          status: 'idle',
        },
      });

      return {
        id: newSettings.id,
        isActive: newSettings.isActive,
        model: newSettings.model,
        totalQuestions: newSettings.totalQuestions,
        processedQuestions: newSettings.processedQuestions,
        skippedQuestions: newSettings.skippedQuestions,
        failedQuestions: newSettings.failedQuestions,
        lastProcessedQuestion: newSettings.lastProcessedQuestion || undefined,
        lastProcessedAt: newSettings.lastProcessedAt?.toISOString(),
        startedAt: newSettings.startedAt?.toISOString(),
        stoppedAt: newSettings.stoppedAt?.toISOString(),
        status: newSettings.status,
        error: newSettings.error || undefined,
        createdAt: newSettings.createdAt.toISOString(),
        updatedAt: newSettings.updatedAt.toISOString(),
        processedQuestionIds: newSettings.processedQuestionIds || [],
      };
    }

    return {
      id: settings.id,
      isActive: settings.isActive,
      model: settings.model,
      totalQuestions: settings.totalQuestions,
      processedQuestions: settings.processedQuestions,
      skippedQuestions: settings.skippedQuestions,
      failedQuestions: settings.failedQuestions,
      lastProcessedQuestion: settings.lastProcessedQuestion || undefined,
      lastProcessedAt:
        settings.lastProcessedAt && typeof settings.lastProcessedAt !== 'string'
          ? settings.lastProcessedAt.toISOString()
          : settings.lastProcessedAt || undefined,
      startedAt:
        settings.startedAt && typeof settings.startedAt !== 'string'
          ? settings.startedAt.toISOString()
          : settings.startedAt || undefined,
      stoppedAt:
        settings.stoppedAt && typeof settings.stoppedAt !== 'string'
          ? settings.stoppedAt.toISOString()
          : settings.stoppedAt || undefined,
      status: settings.status,
      error: settings.error || undefined,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
      processedQuestionIds: settings.processedQuestionIds || [],
    };
  }

  async getStatus(): Promise<AiRephrasingStatusDto> {
    const settings = await this.getSettings();
    const [totalQuestions, processedQuestions] = await Promise.all([
      this.prisma.question.count({
        where: { isDeleted: false },
      }),
      this.prisma.question.count({
        where: {
          isDeleted: false,
          AND: [
            { aiRephrasedTitle: { not: null } },
            { aiRephrasedTitle: { not: '' } },
          ],
        },
      }),
    ]);

    const progress =
      totalQuestions > 0
        ? Math.round((processedQuestions / totalQuestions) * 100)
        : 0;

    const estimatedTimeRemaining = await this.calculateEstimatedTime(settings);

    return {
      isActive: settings.isActive,
      status: settings.status as
        | 'idle'
        | 'processing'
        | 'completed'
        | 'stopped'
        | 'failed',
      model: settings.model,
      totalQuestions,
      processedQuestions,
      skippedQuestions: settings.skippedQuestions,
      failedQuestions: settings.failedQuestions,
      progress,
      lastProcessedQuestion: settings.lastProcessedQuestion,
      lastProcessedAt: settings.lastProcessedAt,
      startedAt: settings.startedAt,
      stoppedAt: settings.stoppedAt,
      error: settings.error,
      estimatedTimeRemaining,
    };
  }

  async getStatistics(): Promise<AiRephrasingStatisticsDto> {
    const settings = await this.getSettings();
    const [totalQuestions, questionsWithRephrasedTitle] = await Promise.all([
      this.prisma.question.count({ where: { isDeleted: false } }),
      this.prisma.question.count({
        where: {
          isDeleted: false,
          AND: [
            { aiRephrasedTitle: { not: null } },
            { aiRephrasedTitle: { not: '' } },
          ],
        },
      }),
    ]);

    // Calculate questions without rephrasing as Total - Rephrased
    const questionsWithoutRephrasedTitle =
      totalQuestions - questionsWithRephrasedTitle;

    const rephrasingCoverage =
      totalQuestions > 0
        ? (questionsWithRephrasedTitle / totalQuestions) * 100
        : 0;

    // Calculate questions processed today and this week
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - now.getDay(),
    );

    const [questionsProcessedToday, questionsProcessedThisWeek] =
      await Promise.all([
        this.prisma.question.count({
          where: {
            isDeleted: false,
            AND: [
              { aiRephrasedTitle: { not: null } },
              { aiRephrasedTitle: { not: '' } },
            ],
            updatedAt: { gte: startOfDay },
          },
        }),
        this.prisma.question.count({
          where: {
            isDeleted: false,
            AND: [
              { aiRephrasedTitle: { not: null } },
              { aiRephrasedTitle: { not: '' } },
            ],
            updatedAt: { gte: startOfWeek },
          },
        }),
      ]);

    // Get last rephrasing added
    const lastRephrasedQuestion = await this.prisma.question.findFirst({
      where: {
        isDeleted: false,
        AND: [
          { aiRephrasedTitle: { not: null } },
          { aiRephrasedTitle: { not: '' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    const successRate =
      settings.processedQuestions > 0
        ? ((settings.processedQuestions - settings.failedQuestions) /
            settings.processedQuestions) *
          100
        : 100;

    return {
      totalQuestions,
      questionsWithRephrasedTitle,
      questionsWithoutRephrasedTitle,
      rephrasingCoverage,
      questionsProcessedToday,
      questionsProcessedThisWeek,
      successRate,
      lastRephrasingAdded: lastRephrasedQuestion?.updatedAt?.toISOString(),
      modelUsage: { [settings.model]: questionsWithRephrasedTitle }, // Use actual count instead of settings.processedQuestions
    };
  }

  async startRephrasing(
    model: string = 'llama3.1',
  ): Promise<{ message: string; settingsId: string }> {
    if (this.isProcessing) {
      throw new Error('AI rephrasing is already running');
    }

    const settings = await this.getSettings();

    // Update settings to start processing
    const updatedSettings = await this.prisma.aiRephrasingSettings.update({
      where: { id: settings.id },
      data: {
        isActive: true,
        model,
        status: 'processing',
        startedAt: new Date(),
        error: null,
      },
    });

    this.isProcessing = true;
    this.startProcessing();

    this.addLog(`Started AI rephrasing processing with model: ${model}`);
    this.addLog(
      'AI rephrasing service initialized and ready to process questions',
    );

    return {
      message: 'AI rephrasing started successfully',
      settingsId: updatedSettings.id,
    };
  }

  async stopRephrasing(): Promise<{ message: string }> {
    if (!this.isProcessing) {
      throw new Error('AI rephrasing is not running');
    }

    this.stopProcessing();

    const settings = await this.getSettings();
    await this.prisma.aiRephrasingSettings.update({
      where: { id: settings.id },
      data: {
        isActive: false,
        status: 'stopped',
        stoppedAt: new Date(),
      },
    });

    this.addLog('AI rephrasing stopped by user request');

    return {
      message: 'AI rephrasing stopped successfully',
    };
  }

  async getQuestionsForRephrasing(
    params: {
      page?: number;
      limit?: number;
      status?: string;
    } = {},
  ): Promise<{
    questions: QuestionRephrasingDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const whereClause: any = { isDeleted: false };

    if (status === 'with_rephrasing') {
      whereClause.AND = [
        { aiRephrasedTitle: { not: null } },
        { aiRephrasedTitle: { not: '' } },
      ];
    } else if (status === 'without_rephrasing') {
      whereClause.OR = [{ aiRephrasedTitle: null }, { aiRephrasedTitle: '' }];
    } else if (status && status !== 'all') {
      whereClause.status = status;
    }

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          question: true,
          aiRephrasedTitle: true,
          status: true,
          updatedAt: true,
        },
      }),
      this.prisma.question.count({ where: whereClause }),
    ]);

    const questionsWithRephrasing = questions.map((q) => {
      const hasRephrasedTitle =
        q.aiRephrasedTitle && q.aiRephrasedTitle.trim() !== '';

      return {
        id: q.id,
        question: q.question,
        aiRephrasedTitle: q.aiRephrasedTitle || undefined,
        hasAiRephrasedTitle: !!hasRephrasedTitle,
        rephrasingAddedAt: q.updatedAt?.toISOString(),
        rephrasingModel: 'llama3.1',
        status: q.status,
      };
    });

    return {
      questions: questionsWithRephrasing,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateQuestionRephrasing(
    questionId: string,
    aiRephrasedTitle: string,
  ): Promise<{ message: string }> {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new Error('Question not found');
    }

    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        aiRephrasedTitle: aiRephrasedTitle.trim(),
      },
    });

    this.addLog(`Updated rephrased title for question: ${questionId}`);

    return {
      message: 'Question rephrasing updated successfully',
    };
  }

  async testRephrasingGeneration(questionId: string): Promise<{
    message: string;
    rephrasedTitle?: string;
    prompt?: string;
  }> {
    try {
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        throw new Error('Question not found');
      }

      const prompt = this.buildRephrasingPrompt(question);
      const response = await this.ollamaService.generateMedicalExplanation(
        prompt,
        'llama3.1',
      );

      if (response && response.trim()) {
        const cleanedRephrasedTitle = this.cleanRephrasedTitle(response.trim());
        return {
          message: 'Test rephrasing generated successfully',
          rephrasedTitle: cleanedRephrasedTitle,
          prompt,
        };
      } else {
        throw new Error('No response from AI model');
      }
    } catch (error) {
      this.logger.error('Test rephrasing generation failed:', error);
      throw new Error(`Test rephrasing generation failed: ${error.message}`);
    }
  }

  getLogs(): Promise<{ logs: string[] }> {
    return Promise.resolve({ logs: [...this.logs] });
  }

  clearLogs(): { message: string } {
    this.logs = [];
    this.addLog('Logs cleared by user request');
    return { message: 'Logs cleared successfully' };
  }

  async resetSettings(): Promise<{ message: string }> {
    const settings = await this.getSettings();
    await this.prisma.aiRephrasingSettings.update({
      where: { id: settings.id },
      data: {
        isActive: false,
        totalQuestions: 0,
        processedQuestions: 0,
        skippedQuestions: 0,
        failedQuestions: 0,
        processedQuestionIds: [],
        lastProcessedQuestion: null,
        lastProcessedAt: null,
        startedAt: null,
        stoppedAt: null,
        status: 'idle',
        error: null,
      },
    });

    this.addLog('AI rephrasing settings reset');
    return { message: 'AI rephrasing settings reset successfully' };
  }

  async resetQuestionProcessing(
    questionId: string,
  ): Promise<{ message: string }> {
    const settings = await this.getSettings();
    const updatedProcessedIds = settings.processedQuestionIds.filter(
      (id) => id !== questionId,
    );

    await this.prisma.aiRephrasingSettings.update({
      where: { id: settings.id },
      data: {
        processedQuestionIds: updatedProcessedIds,
        // Don't decrement processedQuestions as it's calculated from actual data
      },
    });

    // Remove the rephrased title from the question
    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        aiRephrasedTitle: null,
      },
    });

    this.addLog(`Reset processing for question: ${questionId}`);
    return { message: 'Question processing reset successfully' };
  }

  private startProcessing(): void {
    // Start processing immediately and then continue sequentially
    void this.processNextBatch().catch((error) => {
      this.logger.error('Error processing AI rephrasing:', error);
      this.handleProcessingError(error);
    });
  }

  private stopProcessing(): void {
    // Since we're not using intervals anymore, just set the flag
    this.isProcessing = false;
    this.addLog('AI rephrasing processing stopped');
  }

  private async processNextBatch(): Promise<void> {
    const settings = await this.getSettings();

    // Get next batch of questions that need rephrasing (no rephrased title or empty rephrased title)
    const questions = await this.prisma.question.findMany({
      where: {
        isDeleted: false,
        status: 'APPROVED',
        OR: [{ aiRephrasedTitle: null }, { aiRephrasedTitle: '' }],
      },
      take: 1, // Process one question at a time
      orderBy: { createdAt: 'asc' },
    });

    if (questions.length === 0) {
      // No more questions to process
      this.addLog(
        'No more questions to process - completing AI rephrasing task',
      );

      // Debug: Check how many questions exist and their status
      const totalQuestions = await this.prisma.question.count({
        where: { isDeleted: false, status: 'APPROVED' },
      });

      const questionsWithoutRephrasing = await this.prisma.question.count({
        where: {
          isDeleted: false,
          status: 'APPROVED',
          OR: [{ aiRephrasedTitle: null }, { aiRephrasedTitle: '' }],
        },
      });

      this.addLog(
        `Debug: Total questions: ${totalQuestions}, Questions without rephrasing: ${questionsWithoutRephrasing}`,
      );

      await this.completeProcessing();
      return;
    }

    this.addLog(`Processing batch of ${questions.length} questions`);

    for (const question of questions) {
      try {
        this.addLog(
          `Starting rephrasing generation for question: ${question.id}`,
        );

        // Wait for AI generation to complete
        await this.generateRephrasingForQuestion(question);

        // Update settings after successful generation (don't increment processedQuestions as it's calculated from actual data)
        await this.prisma.aiRephrasingSettings.update({
          where: { id: settings.id },
          data: {
            lastProcessedQuestion: question.id,
            lastProcessedAt: new Date(),
          },
        });

        this.addLog(
          `Successfully completed question: ${question.id}, moving to next...`,
        );

        // Continue with next question after a brief pause
        if (this.isProcessing) {
          // Schedule next question processing
          setTimeout(() => {
            if (this.isProcessing) {
              void this.processNextBatch().catch((error) => {
                this.logger.error('Error in next batch processing:', error);
                this.handleProcessingError(error);
              });
            }
          }, 2000); // 2 second pause between questions
        }
      } catch (error) {
        this.addLog(
          `Failed to generate rephrasing for question ${question.id}: ${error.message}`,
          'ERROR',
        );

        await this.prisma.aiRephrasingSettings.update({
          where: { id: settings.id },
          data: {
            failedQuestions: { increment: 1 },
          },
        });

        // Continue with next question even if this one failed
        if (this.isProcessing) {
          setTimeout(() => {
            if (this.isProcessing) {
              void this.processNextBatch().catch((error) => {
                this.logger.error('Error in next batch processing:', error);
                this.handleProcessingError(error);
              });
            }
          }, 2000);
        }
      }
    }
  }

  private async generateRephrasingForQuestion(question: any): Promise<void> {
    const prompt = this.buildRephrasingPrompt(question);

    this.addLog(`Generating rephrasing for question: ${question.id}`, 'DEBUG');
    this.addLog(`Prompt length: ${prompt.length} characters`, 'DEBUG');

    try {
      const response = await this.ollamaService.generateMedicalExplanation(
        prompt,
        'llama3.1',
      );

      this.addLog(
        `Raw response length: ${response?.length || 0} characters`,
        'DEBUG',
      );

      if (response && response.trim()) {
        this.addLog(
          `Raw response preview: ${response.trim().substring(0, 200)}...`,
          'DEBUG',
        );

        const cleanedRephrasedTitle = this.cleanRephrasedTitle(response.trim());

        // Validate the cleaned rephrased title
        if (cleanedRephrasedTitle && cleanedRephrasedTitle.length > 10) {
          const wordCount = cleanedRephrasedTitle.split(/\s+/).length;

          // Check if the rephrased title is appropriately sized (5-80 words, more flexible for clinical context)
          if (wordCount >= 5 && wordCount <= 80) {
            await this.saveRephrasing(question, cleanedRephrasedTitle);
            this.addLog(
              `Successfully rephrased question: ${question.id} (${wordCount} words)`,
            );
          } else if (wordCount < 5) {
            this.addLog(
              `Generated rephrased title too short (${wordCount} words) for question ${question.id}, rejecting`,
              'WARN',
            );
            throw new Error(
              `Generated rephrased title is too short for exam standards (should be at least 5 words)`,
            );
          } else {
            // For very long questions, try to save a truncated version
            this.addLog(
              `Generated rephrased title very long (${wordCount} words) for question ${question.id}, truncating to reasonable length`,
              'WARN',
            );

            // Simple truncation to first 60 words
            const words = cleanedRephrasedTitle.split(/\s+/);
            const truncatedTitle = words.slice(0, 60).join(' ') + '?';
            const truncatedWordCount = truncatedTitle.split(/\s+/).length;

            if (truncatedWordCount >= 5) {
              await this.saveRephrasing(question, truncatedTitle);
              this.addLog(
                `Successfully rephrased and truncated question: ${question.id} (${truncatedWordCount} words)`,
              );
            } else {
              throw new Error(
                `Generated rephrased title is too long and cannot be reasonably truncated`,
              );
            }
          }
        } else {
          throw new Error('Generated rephrased title is too short or invalid');
        }
      } else {
        throw new Error('No response from AI model');
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate rephrasing for question ${question.id}:`,
        error,
      );
      throw error;
    }
  }

  private async saveRephrasing(
    question: any,
    rephrasedTitle: string,
  ): Promise<void> {
    try {
      await this.prisma.question.update({
        where: { id: question.id },
        data: {
          aiRephrasedTitle: rephrasedTitle,
        },
      });

      this.addLog(`Saved rephrased title for question: ${question.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to save rephrasing for question ${question.id}:`,
        error,
      );
      throw error;
    }
  }

  private buildRephrasingPrompt(question: any): string {
    return `You are an AI assistant specialized in rephrasing medical exam questions for MRCS (Membership of the Royal Colleges of Surgeons) examinations.

TASK: Rephrase the following MRCS exam question to make it more professional, clear, and suitable for a formal surgical examination while maintaining appropriate clinical context and detail.

ORIGINAL QUESTION:
${question.question}

ORIGINAL OPTIONS (for reference only - DO NOT include these in your response):
${question.options || 'No options provided'}

CORRECT ANSWER:
${question.correctAnswer}

CRITICAL REQUIREMENTS:
1. Maintain ALL important clinical context and details from the original
2. Preserve the clinical scenario, patient demographics, and key findings
3. Use proper medical terminology but avoid unnecessary complexity
4. Make it suitable for a professional surgical examination
5. Ensure clarity and precision
6. Do NOT change the core medical concept being tested
7. The rephrased question MUST lead to the same correct answer: ${question.correctAnswer}
8. Use standard MRCS exam question format
9. Maintain the clinical reasoning required to answer the question
10. Keep relevant diagnostic information (e.g., imaging results, physical exam findings)
11. Preserve patient presentation details that are clinically significant
12. STRICT WORD LIMIT: Keep the rephrased question between 5-80 words
13. Be concise and avoid unnecessary verbosity
14. Focus on essential clinical information only
15. Make the question concise but comprehensive - avoid being overly verbose
16. Ensure the question flows naturally and reads like a professional exam question
17. DO NOT include any multiple choice options (A, B, C, D, E) in your response
18. DO NOT include any answer choices or options in your response
19. Return ONLY the question stem/stem question

EXAMPLES OF GOOD REPHRASING:
- "A 24-year-old footballer lands awkwardly after a tackle. He has lateral ankle pain but plain films show no fracture. On inversion stress, he has marked tenderness over the anterolateral capsule. Which ligament is most likely injured?" → "A 24-year-old footballer sustains lateral ankle pain after a tackle with no fracture on plain films but marked tenderness over the anterolateral capsule on inversion stress. Which ligament is most likely injured?"
- "What causes appendicitis?" → "What is the most common cause of acute appendicitis?"
- "Heart attack symptoms?" → "What is the most common presenting symptom of myocardial infarction?"
- "Blood pressure high" → "What is the most likely diagnosis in a patient with elevated blood pressure?"

EXAMPLES OF BAD REPHRASING (TOO SHORT - LOST CONTEXT):
- "A 24-year-old footballer lands awkwardly after a tackle. He has lateral ankle pain but plain films show no fracture. On inversion stress, he has marked tenderness over the anterolateral capsule. Which ligament is most likely injured?" → "A footballer has ankle pain; which ligament is injured?"
- "A 45-year-old patient presents with chest pain and ST elevation on ECG. What is the diagnosis?" → "What causes chest pain?"

EXAMPLES OF BAD REPHRASING (TOO LONG - EXCEEDS 80 WORD LIMIT):
- "What causes appendicitis?" → "In the context of acute abdominal pain in adults, what is the most common underlying pathological process that leads to inflammation of the vermiform appendix requiring surgical intervention?"

EXAMPLES OF BAD REPHRASING (INCLUDING OPTIONS - DO NOT DO THIS):
- "What causes appendicitis?" → "What causes appendicitis? A) Infection B) Trauma C) Cancer D) Autoimmune disease"

EXAMPLES OF BAD REPHRASING (TOO VERBOSE):
- "A patient has chest pain" → "A patient presents to the emergency department with acute onset of severe, crushing chest pain that radiates to the left arm and jaw, accompanied by shortness of breath, diaphoresis, and a sense of impending doom, which is most characteristic of what cardiovascular emergency?"

IMPORTANT: 
- Return ONLY the rephrased question text (the stem question)
- Do NOT include any explanations, notes, or additional text
- Do NOT include any multiple choice options (A, B, C, D, E)
- Do NOT include any answer choices
- The response should be a clean, professional exam question stem that could appear in an MRCS examination
- Ensure the rephrased question leads to the same correct answer: ${question.correctAnswer}
- STRICT: Keep the rephrased question between 5-80 words maximum
- Be concise and professional - avoid unnecessary verbosity`;
  }

  private cleanRephrasedTitle(rephrasedTitle: string): string {
    // Remove any markdown formatting
    let cleaned = rephrasedTitle.replace(/[*_`#]/g, '');

    // Remove any quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '');

    // Remove any numbering or bullet points
    cleaned = cleaned.replace(/^[\d\-.\s]+/, '');

    // Remove any "Rephrased question:" or similar prefixes
    cleaned = cleaned.replace(/^(rephrased question|question|answer):\s*/i, '');

    // Remove explanatory notes in parentheses or brackets (common AI artifacts)
    cleaned = cleaned.replace(/\s*\([^)]*\)/g, ''); // Remove (Note: ...) type text
    cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, ''); // Remove [Note: ...] type text

    // Remove any text after "Note:" or similar explanatory prefixes
    cleaned = cleaned.replace(/\s*[Nn]ote:\s*.*$/g, '');
    cleaned = cleaned.replace(/\s*[Ee]xplanation:\s*.*$/g, '');
    cleaned = cleaned.replace(/\s*[Cc]omment:\s*.*$/g, '');

    // Remove any text that looks like an explanation (starts with common explanation words)
    cleaned = cleaned.replace(
      /\s*(This rephrasing|The rephrased|Rephrased version|Note that|Remember that).*$/g,
      '',
    );

    // CRITICAL: Remove any multiple choice options (A, B, C, D, E) and their content
    // This handles cases where the AI still includes options despite the prompt
    // Only remove if they appear after the main question (more conservative approach)
    const questionMarkIndex = cleaned.indexOf('?');
    if (questionMarkIndex !== -1) {
      const mainQuestion = cleaned.substring(0, questionMarkIndex + 1);
      const afterQuestion = cleaned.substring(questionMarkIndex + 1);

      // Only remove options if they appear after the question mark
      if (afterQuestion.trim()) {
        // Remove options that appear after the question
        const cleanedAfter = afterQuestion
          .replace(/\s*[A-E]\)\s*[^A-E]*/g, '')
          .replace(/\s*[A-E]\.\s*[^A-E]*/g, '')
          .replace(/\s*[A-E]\s*[^A-E]*/g, '')
          .trim();

        cleaned = mainQuestion + (cleanedAfter ? ' ' + cleanedAfter : '');
      }
    } else {
      // If no question mark, be more careful about removing options
      // Only remove if they appear at the end and look like separate options
      cleaned = cleaned.replace(/\s*[A-E]\)\s*[^A-E]*$/g, '');
      cleaned = cleaned.replace(/\s*[A-E]\.\s*[^A-E]*$/g, '');
    }

    // Trim whitespace
    cleaned = cleaned.trim();

    // Ensure it ends with a question mark if it's a question
    if (
      cleaned &&
      !cleaned.endsWith('?') &&
      !cleaned.endsWith('.') &&
      !cleaned.endsWith('!')
    ) {
      cleaned += '?';
    }

    // Additional validation: ensure we didn't accidentally remove too much content
    if (!cleaned || cleaned.length < 10) {
      this.addLog(
        `Cleaning function removed too much content, original: "${rephrasedTitle}", cleaned: "${cleaned}"`,
        'WARN',
      );
      // Fallback: return a minimally cleaned version
      const fallbackCleaned = rephrasedTitle
        .replace(/[*_`#]/g, '')
        .replace(/^["']|["']$/g, '')
        .replace(/^[\d\-.\s]+/, '')
        .trim();

      if (fallbackCleaned && fallbackCleaned.length >= 10) {
        return fallbackCleaned.endsWith('?')
          ? fallbackCleaned
          : fallbackCleaned + '?';
      }

      // If even fallback is too short, return original with minimal cleaning
      return rephrasedTitle.trim();
    }

    // Validate length - allow up to 80 words for clinical context (increased limit)
    const wordCount = cleaned.split(/\s+/).length;
    if (wordCount > 80) {
      this.addLog(
        `Rephrased title too long (${wordCount} words), truncating: ${cleaned.substring(0, 100)}...`,
        'WARN',
      );
      // Try to truncate at a reasonable point
      const words = cleaned.split(/\s+/);
      if (words.length > 80) {
        cleaned = words.slice(0, 80).join(' ') + '?';
      }
    }

    return cleaned;
  }

  private async completeProcessing(): Promise<void> {
    const settings = await this.getSettings();
    await this.prisma.aiRephrasingSettings.update({
      where: { id: settings.id },
      data: {
        isActive: false,
        status: 'completed',
        stoppedAt: new Date(),
      },
    });

    this.isProcessing = false;
    this.addLog('AI rephrasing processing completed successfully');
  }

  private async handleProcessingError(error: any): Promise<void> {
    const settings = await this.getSettings();
    await this.prisma.aiRephrasingSettings.update({
      where: { id: settings.id },
      data: {
        isActive: false,
        status: 'failed',
        error: error.message,
        stoppedAt: new Date(),
      },
    });

    this.isProcessing = false;
    this.addLog(`AI rephrasing processing failed: ${error.message}`, 'ERROR');
  }

  private async calculateEstimatedTime(settings: any): Promise<number> {
    if (!settings.startedAt) {
      return 0;
    }

    // Get actual count of processed questions
    const processedQuestions = await this.prisma.question.count({
      where: {
        isDeleted: false,
        AND: [
          { aiRephrasedTitle: { not: null } },
          { aiRephrasedTitle: { not: '' } },
        ],
      },
    });

    if (processedQuestions === 0) {
      return 0;
    }

    const startTime = new Date(settings.startedAt).getTime();
    const currentTime = new Date().getTime();
    const elapsedSeconds = (currentTime - startTime) / 1000;

    const averageTimePerQuestion = elapsedSeconds / processedQuestions;
    const totalQuestions = await this.prisma.question.count({
      where: { isDeleted: false },
    });
    const remainingQuestions = totalQuestions - processedQuestions;
    const estimatedSeconds = averageTimePerQuestion * remainingQuestions;

    return Math.max(0, Math.round(estimatedSeconds));
  }
}
