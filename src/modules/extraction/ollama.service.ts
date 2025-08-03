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
  private model: string;
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

  /**
   * Set the model to use for extraction
   * @param model The model name
   */
  setModel(model: string): void {
    this.model = model;
    this.logger.log(`Ollama model set to: ${model}`);
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

YEAR DETECTION - PRIORITY ORDER:
1. FIRST: Look for year patterns in the PDF text content (e.g., "2023", "2024", "September 2022", "January 2016", etc.)
2. SECOND: If no year found in content, use PDF filename year: ${yearFromPdf ? `${yearFromPdf}` : 'None detected'}
3. THIRD: If neither available, use reasonable estimate based on content context
- Common year patterns to look for: "2024", "2023", "2022", "January 2025", "April 2024", etc.
- Year should be between 2000-2030

INTAKE DETECTION - PRIORITY ORDER:
1. FIRST: Look for intake patterns in the PDF text content (e.g., "September 2022", "January 2016", "April 2024", "May exam", etc.)
2. SECOND: If no intake found in content, use PDF filename intake: ${intakeFromPdf ? `${intakeFromPdf}` : 'None detected'}
3. THIRD: If neither available, use reasonable estimate based on content context
- Common intake patterns to look for: "January", "Jan", "April", "May", "September", "Sept", etc.
- Map patterns to valid intakes: January/Jan → "january", April/May → "april-may", September/Sept → "september"
- Valid intakes are: january, april-may, september

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

CONFIDENCE SCORING GUIDELINES:
- 0.9-0.95: Excellent quality, complete question with clear correct answer
- 0.8-0.89: Very good quality, well-formed question with good options
- 0.7-0.79: Good quality, complete question with minor issues
- 0.6-0.69: Acceptable quality, some uncertainty in extraction
- 0.5-0.59: Lower quality, incomplete or unclear elements
- Below 0.5: Poor quality, should be rejected

Always provide a confidence score between 0.5 and 0.95 based on question quality.

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
    const lowerPdfName = pdfName.toLowerCase();

    // If PDF name contains "mrcs-question-bank", return null to extract from PDF content
    if (lowerPdfName.includes('mrcs-question-bank')) {
      return null;
    }

    // Hardcode specific patterns
    // Pattern: "Recall January 2025" -> year: 2025
    if (lowerPdfName.includes('recall') && lowerPdfName.includes('january')) {
      return 2025;
    }

    // Pattern: "RECALL APRIL 2025 Dr Hedaiyat BD" -> year: 2025
    if (
      lowerPdfName.includes('recall') &&
      (lowerPdfName.includes('april') || lowerPdfName.includes('may'))
    ) {
      return 2025;
    }

    // Pattern: "Sept 2024" -> year: 2024
    if (lowerPdfName.includes('sept') || lowerPdfName.includes('september')) {
      return 2024;
    }

    // For other patterns, try to extract year from filename
    const yearPatterns = [
      /\b(20[0-3]\d)\b/, // 2000-2039
      /\b(19[8-9]\d)\b/, // 1980-1999 (for older exams if any)
    ];

    for (const pattern of yearPatterns) {
      const yearMatch = pdfName.match(pattern);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        // Validate year is in reasonable range for MRCS exams
        if (year >= 1990 && year <= 2030) {
          return year;
        }
      }
    }

    return null;
  }

  private extractIntakeFromPdfName(pdfName: string): string | null {
    const lowerPdfName = pdfName.toLowerCase();

    // If PDF name contains "mrcs-question-bank", return null to extract from PDF content
    if (lowerPdfName.includes('mrcs-question-bank')) {
      return null;
    }

    // Hardcode specific patterns
    // Pattern: "Recall January 2025" -> intake: "january"
    if (lowerPdfName.includes('recall') && lowerPdfName.includes('january')) {
      return 'january';
    }

    // Pattern: "RECALL APRIL 2025 Dr Hedaiyat BD" -> intake: "april-may"
    if (
      lowerPdfName.includes('recall') &&
      (lowerPdfName.includes('april') || lowerPdfName.includes('may'))
    ) {
      return 'april-may';
    }

    // Pattern: "Sept 2024" -> intake: "september"
    if (lowerPdfName.includes('sept') || lowerPdfName.includes('september')) {
      return 'september';
    }

    // For other patterns, try to extract intake from filename
    // Check for January intake patterns
    if (lowerPdfName.includes('january') || lowerPdfName.includes('jan')) {
      return 'january';
    }

    // Check for April/May intake patterns
    if (lowerPdfName.includes('april') || lowerPdfName.includes('may')) {
      return 'april-may';
    }

    // Check for September intake patterns
    if (lowerPdfName.includes('september') || lowerPdfName.includes('sept')) {
      return 'september';
    }

    // Additional pattern matching for edge cases
    const intakePatterns = [
      { pattern: /\b(january|jan)\b/i, intake: 'january' },
      { pattern: /\b(april|may)\b/i, intake: 'april-may' },
      { pattern: /\b(september|sept)\b/i, intake: 'september' },
    ];

    for (const { pattern, intake } of intakePatterns) {
      if (pattern.test(pdfName)) {
        return intake;
      }
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
      confidence: this.calculateConfidence(q),
    };
  }

  // Calculate confidence based on question quality and AI-provided confidence
  private calculateConfidence(question: Record<string, unknown>): number {
    // Start with AI-provided confidence if available
    let confidence =
      typeof question.confidence === 'number'
        ? Math.max(0, Math.min(1, question.confidence))
        : 0.7; // Default to 70% if AI doesn't provide confidence

    // Boost confidence based on question quality indicators
    const questionText =
      typeof question.question === 'string' ? question.question.trim() : '';
    const options = question.options as Record<string, unknown>;

    // Quality checks that boost confidence
    let qualityScore = 0;
    const maxQualityScore = 10;

    // Question length (good length = higher confidence)
    if (questionText.length >= 50 && questionText.length <= 500) {
      qualityScore += 2;
    } else if (questionText.length >= 20 && questionText.length <= 1000) {
      qualityScore += 1;
    }

    // Check if all options are present and meaningful
    const optionKeys = ['A', 'B', 'C', 'D', 'E'];
    let validOptions = 0;
    for (const key of optionKeys) {
      const optionValue = options[key];
      const optionText =
        typeof optionValue === 'string' ? optionValue.trim() : '';
      if (optionText.length >= 3 && optionText.length <= 200) {
        validOptions++;
      }
    }
    qualityScore += Math.min(3, validOptions); // Max 3 points for options

    // Check if correct answer is valid
    const correctAnswer = question.correctAnswer as string;
    if (correctAnswer && ['A', 'B', 'C', 'D', 'E'].includes(correctAnswer)) {
      qualityScore += 1;
    }

    // Check if categories are valid
    const categories = question.categories as string[];
    if (categories && categories.length > 0) {
      qualityScore += 1;
    }

    // Check if year is reasonable
    const year = question.examYear as number;
    if (year && year >= 2000 && year <= 2030) {
      qualityScore += 1;
    }

    // Check if intake is valid
    const intake = question.intake as string;
    if (intake && this.intakes.includes(intake)) {
      qualityScore += 1;
    }

    // Check for explanation (bonus point)
    const explanation = question.explanation as string;
    if (explanation && explanation.trim().length > 10) {
      qualityScore += 1;
    }

    // Calculate final confidence
    const qualityMultiplier = qualityScore / maxQualityScore;
    confidence = Math.min(0.95, confidence + qualityMultiplier * 0.25);

    return Math.max(0.3, Math.min(0.95, confidence));
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
