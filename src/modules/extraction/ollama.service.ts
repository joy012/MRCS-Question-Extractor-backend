import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { DEFAULT_CATEGORIES } from '../../common/CONSTANTS/categories.constants';
import { DEFAULT_INTAKES } from '../../common/CONSTANTS/intakes.constants';

export interface ExtractedQuestion {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
  correctAnswer: string;
  categories: string[];
  examYear: number;
  intake: string;
  explanation?: string;
  confidence: number;
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options: {
    temperature: number;
    top_p: number;
    num_predict: number;
  };
}

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
}

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
  }>;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeout: number;

  // Use preseeded categories and intakes
  private readonly categories: string[] = DEFAULT_CATEGORIES.map(
    (cat) => cat.name,
  );
  private readonly intakes: string[] = DEFAULT_INTAKES.map(
    (intake) => intake.name,
  );

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    this.model = this.configService.get<string>('OLLAMA_MODEL', 'llama3.1');
    this.timeout = this.configService.get<number>('OLLAMA_TIMEOUT', 300000);

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
    });
  }

  async extractQuestionsFromText(
    text: string,
    pageNumber: number,
    pdfName?: string,
  ): Promise<ExtractedQuestion[]> {
    try {
      const prompt = this.buildExtractionPrompt(text, pageNumber, pdfName);
      const response = await this.generateResponse(prompt);
      const questions = this.parseQuestionResponse(response);

      // Filter and validate questions
      return questions.filter((question) => this.isQuestionValid(question));
    } catch (error) {
      this.logger.error(
        `Failed to extract questions from page ${pageNumber}:`,
        error,
      );
      return [];
    }
  }

  async categorizeQuestion(
    questionText: string,
  ): Promise<{ categories: string[]; confidence: number }> {
    try {
      const prompt = this.buildCategorizationPrompt(questionText);
      const response = await this.generateResponse(prompt);
      return this.parseCategorizationResponse(response);
    } catch (error) {
      this.logger.error('Failed to categorize question:', error);
      return { categories: [], confidence: 0 };
    }
  }

  private buildExtractionPrompt(
    text: string,
    pageNumber: number,
    pdfName?: string,
  ): string {
    // Extract year from PDF name if available
    const yearFromPdf = pdfName ? this.extractYearFromPdfName(pdfName) : null;
    const intakeFromPdf = pdfName
      ? this.extractIntakeFromPdfName(pdfName)
      : null;

    return `You are an AI assistant specialized in extracting medical exam questions from PDF text.

TASK: Extract all multiple-choice questions from the following text from page ${pageNumber} of an MRCS exam document.

CRITICAL REQUIREMENTS:
1. EVERY question MUST have exactly 5 options (A, B, C, D, E)
2. If a question has fewer than 5 options, add appropriate WRONG answer options based on the topic/subject
3. DO NOT add random options - make them plausible but incorrect
4. Ensure all options are relevant to the question topic
5. DO NOT extract incomplete or meaningless questions
6. Questions must be complete and well-formed
7. Options must be meaningful and relevant to the question

CORRECT ANSWER DETECTION:
- Look for correct answers marked with: ✓, ✅, (correct), (CORRECT), green color, yellow highlight, bold text, or any other indication
- The correct answer can be indicated by:
  * A checkmark (✓ or ✅) next to an option
  * Text like "(correct)" or "(CORRECT)" after an option
  * Green or yellow highlighting/marking
  * Bold text or special formatting
  * Any other clear indication of the correct answer
- If no clear indication is found, use your medical knowledge to determine the most likely correct answer
- Always return a single letter (A, B, C, D, or E) as the correctAnswer

QUALITY REQUIREMENTS:
- Questions must be complete sentences (not fragments)
- Questions must be medically relevant and meaningful
- Options must be distinct and plausible
- Avoid questions with unclear or ambiguous wording
- Skip incomplete or poorly formatted questions
- Ensure all text is properly extracted (no "..." or "???")

CATEGORIES (use only these preseeded categories - you can assign multiple categories if the question covers multiple topics):
${this.categories.map((cat) => `   - ${cat}`).join('\n')}

CATEGORY GUIDELINES:
- Anatomy questions: Use specific anatomy categories (thorax, abdomen, superior extremity, inferior extremity, head-neck-brain)
- Physiology questions: Use "physiology"
- Pathology questions: Use "pathology"
- Microbiology questions: Use "microbiology"
- Biostatistics questions: Use "biostatistics"
- Clinical questions: Use appropriate clinical categories based on the medical specialty
- If a question covers multiple topics, assign multiple categories
- Be specific and accurate in categorization

INTAKES (use only these preseeded intakes):
${this.intakes.map((intake) => `   - ${intake}`).join('\n')}

YEAR DETECTION:
- Extract year from PDF content or PDF name: ${yearFromPdf ? `Detected year: ${yearFromPdf}` : 'Extract from content'}
- Look for year patterns in the text (e.g., "2023", "2024", etc.)
- If no year found, use reasonable estimate based on content

INTAKE DETECTION:
- Extract intake from PDF content or PDF name: ${intakeFromPdf ? `Detected intake: ${intakeFromPdf}` : 'Extract from content'}
- Look for intake patterns in the text
- If no intake found, use reasonable estimate based on content

OUTPUT FORMAT: Return a JSON array with this exact structure:
[
  {
    "question": "The complete question text here",
    "options": {
      "A": "Complete option A text",
      "B": "Complete option B text", 
      "C": "Complete option C text",
      "D": "Complete option D text",
      "E": "Complete option E text"
    },
    "correctAnswer": "A",
    "categories": ["anatomy-thorax", "physiology"],
    "examYear": 2023,
    "intake": "january",
    "explanation": "Explanation if available",
    "confidence": 0.85
  }
]

TEXT TO ANALYZE:
${text}

Return only the JSON array, no additional text.`;
  }

  private buildCategorizationPrompt(questionText: string): string {
    return `Categorize this medical question into one or more of these preseeded categories:

CATEGORIES:
${this.categories.map((cat) => `- ${cat}`).join('\n')}

CATEGORY GUIDELINES:
- Anatomy questions: Use specific anatomy categories (thorax, abdomen, superior extremity, inferior extremity, head-neck-brain)
- Physiology questions: Use "physiology"
- Pathology questions: Use "pathology"
- Microbiology questions: Use "microbiology"
- Biostatistics questions: Use "biostatistics"
- Clinical questions: Use appropriate clinical categories based on the medical specialty
- If a question covers multiple topics, assign multiple categories
- Be specific and accurate in categorization

QUESTION:
${questionText}

Return JSON format:
{
  "categories": ["category1", "category2"],
  "confidence": 0.85
}

Provide only the JSON response.`;
  }

  private extractYearFromPdfName(pdfName: string): number | null {
    const yearMatch = pdfName.match(/\b(20[12]\d)\b/);
    return yearMatch ? parseInt(yearMatch[1]) : null;
  }

  private extractIntakeFromPdfName(pdfName: string): string | null {
    const lowerPdfName = pdfName.toLowerCase();

    if (lowerPdfName.includes('january') || lowerPdfName.includes('jan')) {
      return 'january';
    }
    if (lowerPdfName.includes('april') || lowerPdfName.includes('may')) {
      return 'april-may';
    }
    if (lowerPdfName.includes('september') || lowerPdfName.includes('sep')) {
      return 'september';
    }

    return null;
  }

  private async generateResponse(prompt: string): Promise<string> {
    try {
      const requestData: OllamaGenerateRequest = {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          num_predict: 2048,
        },
      };

      const response: AxiosResponse<OllamaGenerateResponse> =
        await this.axiosInstance.post('/api/generate', requestData);

      if (!response.data?.response) {
        throw new Error('Invalid response from Ollama API');
      }

      return response.data.response;
    } catch (error) {
      this.logger.error('Ollama API request failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Ollama generation failed: ${errorMessage}`);
    }
  }

  private parseQuestionResponse(response: string): ExtractedQuestion[] {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('No JSON array found in response');
        return [];
      }

      const parsedResponse: unknown = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsedResponse)) {
        this.logger.warn('Parsed response is not an array');
        return [];
      }

      // Validate and clean each question
      return parsedResponse
        .filter((q: unknown) => this.validateQuestion(q))
        .map((q: unknown) => this.cleanQuestion(q));
    } catch (error) {
      this.logger.error('Failed to parse question response:', error);
      return [];
    }
  }

  private parseCategorizationResponse(response: string): {
    categories: string[];
    confidence: number;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { categories: [], confidence: 0 };
      }

      const parsedResult: unknown = JSON.parse(jsonMatch[0]);

      if (typeof parsedResult !== 'object' || parsedResult === null) {
        return { categories: [], confidence: 0 };
      }

      const result = parsedResult as Record<string, unknown>;

      return {
        categories: Array.isArray(result.categories)
          ? result.categories.filter(
              (cat): cat is string =>
                typeof cat === 'string' && this.categories.includes(cat),
            )
          : [],
        confidence:
          typeof result.confidence === 'number' ? result.confidence : 0,
      };
    } catch (error) {
      this.logger.error('Failed to parse categorization response:', error);
      return { categories: [], confidence: 0 };
    }
  }

  private validateQuestion(
    question: unknown,
  ): question is Record<string, unknown> {
    if (typeof question !== 'object' || question === null) {
      return false;
    }

    const q = question as Record<string, unknown>;

    return (
      typeof q.question === 'string' &&
      q.question.length > 10 &&
      typeof q.options === 'object' &&
      q.options !== null &&
      typeof (q.options as Record<string, unknown>).A === 'string' &&
      typeof (q.options as Record<string, unknown>).B === 'string' &&
      typeof (q.options as Record<string, unknown>).C === 'string' &&
      typeof (q.options as Record<string, unknown>).D === 'string' &&
      typeof (q.options as Record<string, unknown>).E === 'string' &&
      ['A', 'B', 'C', 'D', 'E'].includes(q.correctAnswer as string) &&
      Array.isArray(q.categories) &&
      q.categories.length > 0 &&
      q.categories.every(
        (cat: unknown) =>
          typeof cat === 'string' && this.categories.includes(cat),
      ) &&
      typeof q.examYear === 'number' &&
      q.examYear >= 2000 &&
      q.examYear <= 2030 &&
      typeof q.intake === 'string' &&
      this.intakes.includes(q.intake)
    );
  }

  private cleanQuestion(question: unknown): ExtractedQuestion {
    const q = question as Record<string, unknown>;
    const options = q.options as Record<string, unknown>;

    return {
      question: String(q.question).trim(),
      options: {
        A: String(options.A).trim(),
        B: String(options.B).trim(),
        C: String(options.C).trim(),
        D: String(options.D).trim(),
        E: String(options.E).trim(),
      },
      correctAnswer: q.correctAnswer as string,
      categories: (q.categories as string[]).filter((cat) =>
        this.categories.includes(cat),
      ),
      examYear: q.examYear as number,
      intake: q.intake as string,
      explanation:
        q.explanation && typeof q.explanation === 'string'
          ? q.explanation.trim()
          : '',
      confidence:
        typeof q.confidence === 'number'
          ? Math.max(0, Math.min(1, q.confidence))
          : 0.5,
    };
  }

  // Additional validation for question quality
  private isQuestionValid(question: ExtractedQuestion): boolean {
    // Check if question text is meaningful
    if (
      !question.question ||
      question.question.length < 20 ||
      question.question.length > 2000 ||
      question.question.includes('...') ||
      question.question.includes('???') ||
      question.question.includes('incomplete') ||
      question.question.includes('fragment')
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
        optionText.includes('???') ||
        optionText.includes('incomplete') ||
        optionText.includes('fragment')
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

    // Check confidence level
    if (question.confidence < 0.3) {
      return false;
    }

    return true;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response: AxiosResponse<OllamaTagsResponse> =
        await this.axiosInstance.get('/api/tags');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Ollama health check failed:', error);
      return false;
    }
  }
}
