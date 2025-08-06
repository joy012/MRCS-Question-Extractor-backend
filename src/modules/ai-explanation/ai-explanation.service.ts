import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { OllamaService } from '../extraction/ollama.service';
import {
  AiExplanationSettingsDto,
  AiExplanationStatisticsDto,
  AiExplanationStatusDto,
  QuestionExplanationDto,
} from './dto/ai-explanation.types';

@Injectable()
export class AiExplanationService {
  private readonly logger = new Logger(AiExplanationService.name);
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private logs: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly ollamaService: OllamaService,
  ) {
    this.addLog('AI explanation service initialized');
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

  async getSettings(): Promise<AiExplanationSettingsDto> {
    const settings = await this.prisma.aiExplanationSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      // Create default settings
      const newSettings = await this.prisma.aiExplanationSettings.create({
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
      createdAt:
        settings.createdAt && typeof settings.createdAt !== 'string'
          ? settings.createdAt.toISOString()
          : settings.createdAt,
      updatedAt:
        settings.updatedAt && typeof settings.updatedAt !== 'string'
          ? settings.updatedAt.toISOString()
          : settings.updatedAt,
      processedQuestionIds: settings.processedQuestionIds || [],
    };
  }

  async getStatus(): Promise<AiExplanationStatusDto> {
    const settings = await this.getSettings();
    const totalQuestions = await this.prisma.question.count({
      where: { isDeleted: false },
    });

    const progress =
      totalQuestions > 0
        ? Math.round((settings.processedQuestions / totalQuestions) * 100)
        : 0;

    // Calculate estimated time remaining (rough estimate)
    const estimatedTimeRemaining = this.calculateEstimatedTime(settings);

    return {
      isActive: settings.isActive,
      status: settings.status as any,
      model: settings.model,
      totalQuestions,
      processedQuestions: settings.processedQuestions,
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

  async getStatistics(): Promise<AiExplanationStatisticsDto> {
    const totalQuestions = await this.prisma.question.count({
      where: { isDeleted: false },
    });

    // Get questions that have explanations
    const questionsWithExplanations = await this.prisma.question.count({
      where: {
        isDeleted: false,
        AND: [{ explanation: { not: null } }, { explanation: { not: '' } }],
      },
    });

    // Calculate success rate (questions with explanations vs total processed)
    const settings = await this.getSettings();
    const totalProcessed =
      settings.processedQuestions + settings.failedQuestions;
    const successRate =
      totalProcessed > 0
        ? ((settings.processedQuestions - settings.failedQuestions) /
            totalProcessed) *
          100
        : 0;

    // Get last explanation added (only for valid explanations)
    const lastExplanation = await this.prisma.question.findFirst({
      where: {
        isDeleted: false,
        AND: [{ explanation: { not: null } }, { explanation: { not: '' } }],
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    // Simplified model usage statistics
    const modelUsage = { llama31: questionsWithExplanations };

    return {
      totalQuestions,
      questionsWithExplanation: questionsWithExplanations,
      questionsWithoutExplanation: totalQuestions - questionsWithExplanations,
      explanationCoverage:
        totalQuestions > 0
          ? (questionsWithExplanations / totalQuestions) * 100
          : 0,
      questionsProcessedToday: 0, // This will need to be calculated based on actual processing
      questionsProcessedThisWeek: 0, // This will need to be calculated based on actual processing
      successRate: totalProcessed > 0 ? successRate : 0,
      lastExplanationAdded: lastExplanation?.updatedAt?.toISOString(),
      modelUsage,
    };
  }

  async startExplanation(
    model: string = 'llama3.1',
  ): Promise<{ message: string; settingsId: string }> {
    if (this.isProcessing) {
      throw new Error('AI explanation is already running');
    }

    const settings = await this.getSettings();

    // Update settings to start processing
    const updatedSettings = await this.prisma.aiExplanationSettings.update({
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

    this.addLog(`Started AI explanation processing with model: ${model}`);
    this.addLog(
      'AI explanation service initialized and ready to process questions',
    );

    return {
      message: 'AI explanation started successfully',
      settingsId: updatedSettings.id,
    };
  }

  async stopExplanation(): Promise<{ message: string }> {
    if (!this.isProcessing) {
      throw new Error('AI explanation is not running');
    }

    const settings = await this.getSettings();

    // Update settings to stop processing
    await this.prisma.aiExplanationSettings.update({
      where: { id: settings.id },
      data: {
        isActive: false,
        status: 'stopped',
        stoppedAt: new Date(),
      },
    });

    this.isProcessing = false;
    this.stopProcessing();

    this.addLog('AI explanation processing stopped by user request');

    return {
      message: 'AI explanation stopped successfully',
    };
  }

  async getQuestionsForExplanation(
    params: {
      page?: number;
      limit?: number;
      status?: string;
    } = {},
  ): Promise<{
    questions: QuestionExplanationDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const whereClause: any = { isDeleted: false };

    if (status === 'with_explanation') {
      whereClause.AND = [
        { explanation: { not: null } },
        { explanation: { not: '' } },
      ];
    } else if (status === 'without_explanation') {
      whereClause.OR = [{ explanation: null }, { explanation: '' }];
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
          explanation: true,
          status: true,
          updatedAt: true,
        },
      }),
      this.prisma.question.count({ where: whereClause }),
    ]);

    const questionsWithExplanation = questions.map((q) => {
      const hasExplanation = q.explanation && q.explanation.trim() !== '';

      return {
        id: q.id,
        question: q.question,
        explanation: q.explanation || undefined,
        hasAiExplanation: !!hasExplanation,
        explanationAddedAt: q.updatedAt?.toISOString(),
        explanationModel: 'llama3.1',
        status: q.status,
      };
    });

    return {
      questions: questionsWithExplanation,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateQuestionExplanation(
    questionId: string,
    explanation: string,
  ): Promise<{ message: string }> {
    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        explanation,
      },
    });

    this.logger.log(`Updated explanation for question: ${questionId}`);

    return {
      message: 'Question explanation updated successfully',
    };
  }

  async testExplanationGeneration(questionId: string): Promise<{
    message: string;
    explanation?: string;
    prompt?: string;
  }> {
    try {
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
      });

      if (!question) {
        throw new Error('Question not found');
      }

      const prompt = this.buildExplanationPrompt(question);
      const response = await this.ollamaService.generateMedicalExplanation(
        prompt,
        'llama3.1',
      );

      if (response && response.trim()) {
        const cleanedExplanation = this.cleanExplanation(response.trim());
        return {
          message: 'Test explanation generated successfully',
          explanation: cleanedExplanation,
          prompt,
        };
      } else {
        throw new Error('No response from AI model');
      }
    } catch (error) {
      this.logger.error('Test explanation generation failed:', error);
      throw new Error(`Test explanation generation failed: ${error.message}`);
    }
  }

  getLogs(): Promise<{ logs: string[] }> {
    return Promise.resolve({ logs: this.logs });
  }

  clearLogs(): Promise<{ message: string }> {
    this.logs = [];
    this.addLog('Logs cleared by user request');
    return Promise.resolve({ message: 'Logs cleared successfully' });
  }

  async resetSettings(): Promise<{ message: string }> {
    const settings = await this.getSettings();

    await this.prisma.aiExplanationSettings.update({
      where: { id: settings.id },
      data: {
        isActive: false,
        processedQuestions: 0,
        skippedQuestions: 0,
        failedQuestions: 0,
        lastProcessedQuestion: null,
        lastProcessedAt: null,
        startedAt: null,
        stoppedAt: null,
        status: 'idle',
        error: null,
      },
    });

    // Clear logs when resetting
    this.logs = [];
    this.addLog('AI explanation settings reset to default values');

    return {
      message: 'AI explanation settings reset successfully.',
    };
  }

  async resetQuestionProcessing(
    questionId: string,
  ): Promise<{ message: string }> {
    // Check if question exists
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new Error('Question not found');
    }

    // Clear the explanation to allow reprocessing
    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        explanation: null,
      },
    });

    this.addLog(
      `Cleared explanation for question: ${questionId} to allow reprocessing`,
    );

    return {
      message:
        'Question explanation cleared successfully. The question can now be reprocessed.',
    };
  }

  private startProcessing(): void {
    // Start processing immediately and then continue sequentially
    void this.processNextBatch().catch((error) => {
      this.logger.error('Error processing AI explanations:', error);
      this.handleProcessingError(error);
    });
  }

  private stopProcessing(): void {
    // Since we're not using intervals anymore, just set the flag
    this.isProcessing = false;
    this.addLog('AI explanation processing stopped');
  }

  private async processNextBatch(): Promise<void> {
    const settings = await this.getSettings();

    // Get next batch of questions that need explanations (no explanation or empty explanation)
    const questions = await this.prisma.question.findMany({
      where: {
        isDeleted: false,
        status: 'APPROVED',
        OR: [{ explanation: null }, { explanation: '' }],
      },
      take: 1, // Process one question at a time
      orderBy: { createdAt: 'asc' },
    });

    if (questions.length === 0) {
      // No more questions to process
      this.addLog(
        'No more questions to process - completing AI explanation task',
      );

      // Debug: Check how many questions exist and their status
      const totalQuestions = await this.prisma.question.count({
        where: { isDeleted: false, status: 'APPROVED' },
      });

      const questionsWithoutExplanation = await this.prisma.question.count({
        where: {
          isDeleted: false,
          status: 'APPROVED',
          OR: [{ explanation: null }, { explanation: '' }],
        },
      });

      this.addLog(
        `Debug: Total questions: ${totalQuestions}, Questions without explanation: ${questionsWithoutExplanation}`,
      );

      await this.completeProcessing();
      return;
    }

    this.addLog(`Processing batch of ${questions.length} questions`);

    for (const question of questions) {
      try {
        this.addLog(
          `Starting explanation generation for question: ${question.id}`,
        );

        // Wait for AI generation to complete
        await this.generateExplanationForQuestion(question);

        // Update settings after successful generation
        await this.prisma.aiExplanationSettings.update({
          where: { id: settings.id },
          data: {
            processedQuestions: { increment: 1 },
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
          `Failed to generate explanation for question ${question.id}: ${error.message}`,
          'ERROR',
        );

        await this.prisma.aiExplanationSettings.update({
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

  private async generateExplanationForQuestion(question: any): Promise<void> {
    const prompt = this.buildExplanationPrompt(question);

    // Log the prompt for debugging
    this.addLog(`Generating explanation for question: ${question.id}`, 'DEBUG');
    this.addLog(`Prompt length: ${prompt.length} characters`, 'DEBUG');

    try {
      // Try with llama3.1 first (the model used for extraction)
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

        // Check if the response is just the prompt (indicates model issue)
        if (
          response.trim().includes('You are a senior medical consultant') &&
          response.trim().includes('REQUIRED MARKDOWN STRUCTURE')
        ) {
          this.addLog(
            `Model returned prompt instead of explanation for question ${question.id}, trying alternative approach`,
            'WARN',
          );

          // Try with a simpler prompt
          const simplePrompt = this.buildSimpleExplanationPrompt(question);
          const simpleResponse =
            await this.ollamaService.generateMedicalExplanation(
              simplePrompt,
              'llama3.1',
            );

          if (
            simpleResponse &&
            simpleResponse.trim() &&
            !simpleResponse
              .trim()
              .includes('You are a senior medical consultant')
          ) {
            const cleanedExplanation = this.cleanExplanation(
              simpleResponse.trim(),
            );
            this.addLog(
              `Cleaned explanation length: ${cleanedExplanation.length} characters`,
              'DEBUG',
            );
            await this.saveExplanation(
              question,
              cleanedExplanation,
              'llama3.1',
            );
          } else {
            this.addLog(
              `Failed to generate explanation for question ${question.id} - model not responding properly`,
              'ERROR',
            );
            // Save a minimal explanation to prevent infinite loop
            await this.saveExplanation(
              question,
              'Explanation generation failed - please add manually.',
              'llama3.1',
            );
          }
        } else {
          // Normal response processing
          const cleanedExplanation = this.cleanExplanation(response.trim());
          this.addLog(
            `Cleaned explanation length: ${cleanedExplanation.length} characters`,
            'DEBUG',
          );

          if (cleanedExplanation && cleanedExplanation.length > 0) {
            await this.saveExplanation(
              question,
              cleanedExplanation,
              'llama3.1',
            );
          } else {
            this.addLog(
              `Cleaned explanation was empty for question ${question.id}, saving raw response`,
              'WARN',
            );
            // Save raw response if cleaning resulted in empty string
            await this.saveExplanation(question, response.trim(), 'llama3.1');
          }
        }
      } else {
        this.addLog(
          `Failed to generate explanation for question ${question.id} - no response from AI model`,
          'WARN',
        );
        // Save a placeholder to prevent infinite loop
        await this.saveExplanation(
          question,
          'Explanation generation failed - please add manually.',
          'llama3.1',
        );
      }
    } catch (error) {
      this.addLog(
        `Error generating explanation for question ${question.id}: ${error.message}`,
        'ERROR',
      );
      // Save a placeholder to prevent infinite loop
      await this.saveExplanation(
        question,
        'Explanation generation failed - please add manually.',
        'llama3.1',
      );
    }
  }

  private async saveExplanation(
    question: any,
    explanation: string,
    model: string,
  ): Promise<void> {
    if (explanation && explanation.length > 10) {
      // Update the question with explanation
      await this.prisma.question.update({
        where: { id: question.id },
        data: {
          explanation,
        },
      });
      this.addLog(
        `Successfully saved explanation for question: ${question.id} using ${model} (${explanation.length} characters)`,
      );
    } else {
      this.addLog(
        `Generated explanation for question ${question.id} was too short or invalid (${explanation?.length || 0} characters)`,
        'WARN',
      );
      // Save a placeholder anyway to prevent infinite loop
      await this.prisma.question.update({
        where: { id: question.id },
        data: {
          explanation: 'Explanation generation failed - please add manually.',
        },
      });
    }
  }

  private buildSimpleExplanationPrompt(question: any): string {
    return `You are a senior medical consultant and MRCS examiner. Provide a detailed, well-formatted explanation using Markdown for this MRCS exam question.

Question: ${question.question}

Options:
A: ${question.options.A}
B: ${question.options.B}
C: ${question.options.C}
D: ${question.options.D}
E: ${question.options.E}

Correct Answer: ${question.correctAnswer}

Provide a comprehensive explanation with the following Markdown structure:

## **TOPIC OVERVIEW**
- Briefly introduce the medical topic and its importance for MRCS candidates
- Identify the medical specialty or system involved

## **CORRECT ANSWER EXPLANATION**
**Option ${question.correctAnswer} is correct because:**
- Explain the primary medical reasoning
- Provide the underlying **scientific basis** and **clinical evidence**
- Include relevant **anatomical**, **physiological**, or **pathological** principles

## **KEY MEDICAL CONCEPTS**
- **Primary principle:** Main medical concept being tested
- **Anatomical structures:** Relevant anatomy and relationships
- **Clinical significance:** Why this knowledge matters in practice

## **CLINICAL RELEVANCE**
- **Surgical implications:** How this applies to surgical practice
- **Diagnostic considerations:** Relevance to patient assessment
- **Real-world applications:** Examples from clinical practice

Use proper Markdown syntax with **bold** for emphasis, *italic* for emphasis, ## for headings, and - for bullet points. Use double line breaks between paragraphs and single line breaks within bullet points for better readability. Make the explanation educational and engaging for doctors preparing for MRCS.`;
  }

  private cleanExplanation(explanation: string): string {
    const originalLength = explanation.length;

    // Remove any markdown code blocks or formatting artifacts
    let cleaned = explanation
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/^```\s*/, '') // Remove leading ```
      .replace(/\s*```$/, '') // Remove trailing ```
      .trim();

    // Remove any JSON formatting artifacts (only if the entire response is JSON)
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      cleaned = cleaned.replace(/^\{[\s\S]*?\}$/g, '');
    }
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      cleaned = cleaned.replace(/^\[[\s\S]*?\]$/g, '');
    }
    cleaned = cleaned.trim();

    // Remove any "Assistant:" or "AI:" prefixes
    cleaned = cleaned.replace(/^(Assistant|AI|Bot):\s*/i, '').trim();

    // Clean up any extra whitespace while preserving formatting
    cleaned = cleaned
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .replace(/^\s+/, '') // Remove leading whitespace
      .replace(/\s+$/, '') // Remove trailing whitespace
      .trim();

    // Ensure proper formatting for bullet points
    cleaned = cleaned.replace(/^\s*[-*]\s*/gm, '- '); // Keep markdown dash format

    this.addLog(
      `Explanation cleaning: ${originalLength} -> ${cleaned.length} characters`,
      'DEBUG',
    );

    // Relaxed minimum length check - if we have any meaningful content, keep it
    if (cleaned.length < 50) {
      this.addLog(
        `Cleaned explanation too short (${cleaned.length} chars), returning empty`,
        'DEBUG',
      );
      return '';
    }

    return cleaned;
  }

  private buildExplanationPrompt(question: any): string {
    // Get question categories for better context
    const categories = question.categories || [];
    const categoryContext =
      categories.length > 0 ? `\nTOPIC AREAS: ${categories.join(', ')}` : '';

    return `You are a senior medical consultant and MRCS examiner with extensive experience in medical education. You are helping a doctor prepare for the MRCS exam by providing detailed, well-formatted explanations.

TASK: Provide a comprehensive medical explanation using proper Markdown formatting for the following MRCS exam question.

QUESTION: ${question.question}${categoryContext}

OPTIONS:
A: ${question.options.A}
B: ${question.options.B}
C: ${question.options.C}
D: ${question.options.D}
E: ${question.options.E}

CORRECT ANSWER: ${question.correctAnswer}

REQUIRED MARKDOWN STRUCTURE:

## **TOPIC OVERVIEW**
- Briefly introduce the medical topic/concept being tested
- Identify the relevant medical specialty or anatomical system

## **CORRECT ANSWER EXPLANATION**
**Option ${question.correctAnswer} is correct because:**
- Provide the primary medical reasoning
- Include relevant **anatomical**, **physiological**, or **pathological** principles
- Reference key **medical concepts** and terminology
- Explain the **scientific basis** with supporting evidence

## **KEY MEDICAL CONCEPTS**
- **Primary concept:** Main medical principle being tested
- **Anatomical considerations:** Relevant structures and their relationships
- **Physiological mechanisms:** How normal/abnormal processes relate to the question
- **Pathological correlations:** Disease processes or conditions involved
- **Clinical significance:** Why this knowledge matters in practice

## **CLINICAL RELEVANCE**
- **Surgical implications:** How this applies to surgical practice
- **Diagnostic considerations:** Relevance to patient assessment
- **Treatment applications:** Impact on clinical decision-making
- **Real-world scenarios:** Examples from clinical practice

FORMAT REQUIREMENTS:
- Use proper Markdown syntax with ## for headings, **bold** for emphasis, *italic* for emphasis, and - for bullet points
- Include medical terminology with brief explanations in parentheses when needed
- Structure content logically with clear hierarchy and proper spacing
- Make explanations detailed but concise with good paragraph breaks
- Focus on exam-relevant information that helps with understanding and retention
- Use **bold formatting** for key medical terms, anatomical structures, and important concepts
- Use *italic* for emphasis on important points
- Ensure proper line breaks between sections for readability
- Use double line breaks (\\n\\n) between paragraphs for proper spacing
- Use single line breaks (\\n) within bullet points for better readability
- Ensure explanations are thorough enough for a doctor preparing for MRCS

Provide a comprehensive, well-formatted explanation that will help the doctor understand the underlying medical principles and succeed in the MRCS exam.`;
  }

  private getWrongOptions(correctAnswer: string): string {
    const allOptions = ['A', 'B', 'C', 'D', 'E'];
    return allOptions.filter((option) => option !== correctAnswer).join(', ');
  }

  private async completeProcessing(): Promise<void> {
    const settings = await this.getSettings();

    await this.prisma.aiExplanationSettings.update({
      where: { id: settings.id },
      data: {
        isActive: false,
        status: 'completed',
        stoppedAt: new Date(),
      },
    });

    this.isProcessing = false;
    this.addLog('AI explanation processing completed successfully');
  }

  private async handleProcessingError(error: any): Promise<void> {
    const settings = await this.getSettings();

    await this.prisma.aiExplanationSettings.update({
      where: { id: settings.id },
      data: {
        isActive: false,
        status: 'failed',
        error: error.message,
        stoppedAt: new Date(),
      },
    });

    this.isProcessing = false;
    this.addLog(`AI explanation processing failed: ${error.message}`, 'ERROR');
  }

  private calculateEstimatedTime(settings: any): number {
    if (settings.processedQuestions === 0) return 0;

    const totalQuestions = settings.totalQuestions;
    const processedQuestions = settings.processedQuestions;
    const remainingQuestions = totalQuestions - processedQuestions;

    // Rough estimate: 10 seconds per question
    return remainingQuestions * 10;
  }
}
