/**
 * Constitutional AI Implementation
 * Ensures AI responses follow ethical principles and safety guidelines
 */

import { Logger } from '../../utils/logger';
import { OpenAI } from 'openai';

export interface ValidationRequest {
  content: string;
  principles?: string[];
  strict_mode?: boolean;
  include_explanation?: boolean;
  context?: any;
}

export interface ValidationResult {
  is_valid: boolean;
  confidence: number;
  violations: Violation[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  explanation?: string;
  suggested_revision?: string;
}

export interface Violation {
  principle: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  suggestion?: string;
}

export interface ConstitutionalPrinciple {
  id: string;
  name: string;
  description: string;
  category: 'safety' | 'ethics' | 'helpfulness' | 'accuracy' | 'privacy';
  weight: number; // 0-1, importance weight
  examples: {
    good: string[];
    bad: string[];
  };
}

export class ConstitutionalAI {
  private logger: Logger;
  private openai: OpenAI;
  private principles: Map<string, ConstitutionalPrinciple> = new Map();
  private stats: {
    total_validations: number;
    violations_detected: number;
    avg_confidence: number;
    severity_distribution: Record<string, number>;
  };

  constructor() {
    this.logger = new Logger('ConstitutionalAI');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.stats = {
      total_validations: 0,
      violations_detected: 0,
      avg_confidence: 0.85,
      severity_distribution: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      }
    };
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Constitutional AI...');

    // Initialize core constitutional principles
    await this.initializeCorePrinciples();

    this.logger.info('Constitutional AI initialized successfully');
  }

  private async initializeCorePrinciples(): Promise<void> {
    const corePrinciples: ConstitutionalPrinciple[] = [
      {
        id: 'helpfulness',
        name: 'Be Helpful',
        description: 'Provide useful, relevant, and constructive responses that genuinely help the user',
        category: 'helpfulness',
        weight: 0.9,
        examples: {
          good: [
            'Providing step-by-step instructions',
            'Offering multiple solutions to a problem',
            'Explaining concepts clearly with examples'
          ],
          bad: [
            'Refusing to help with legitimate requests',
            'Providing vague or unhelpful responses',
            'Ignoring the user\'s actual question'
          ]
        }
      },
      {
        id: 'harmlessness',
        name: 'Be Harmless',
        description: 'Avoid generating content that could cause physical, emotional, or social harm',
        category: 'safety',
        weight: 1.0,
        examples: {
          good: [
            'Declining to provide dangerous instructions',
            'Warning about potential risks',
            'Suggesting safer alternatives'
          ],
          bad: [
            'Instructions for dangerous activities',
            'Content that promotes violence',
            'Information that could harm vulnerable individuals'
          ]
        }
      },
      {
        id: 'honesty',
        name: 'Be Honest and Truthful',
        description: 'Provide accurate information and admit uncertainty when appropriate',
        category: 'accuracy',
        weight: 0.95,
        examples: {
          good: [
            'Citing reliable sources',
            'Acknowledging limitations in knowledge',
            'Correcting mistakes when identified'
          ],
          bad: [
            'Making up false information',
            'Presenting opinions as facts',
            'Misleading or deceiving users'
          ]
        }
      },
      {
        id: 'respect',
        name: 'Show Respect for All People',
        description: 'Treat all individuals with dignity regardless of their background, identity, or beliefs',
        category: 'ethics',
        weight: 0.9,
        examples: {
          good: [
            'Using inclusive language',
            'Respecting diverse perspectives',
            'Avoiding stereotypes and bias'
          ],
          bad: [
            'Discriminatory language or content',
            'Perpetuating harmful stereotypes',
            'Dismissing valid concerns'
          ]
        }
      },
      {
        id: 'privacy',
        name: 'Respect Privacy and Confidentiality',
        description: 'Protect personal information and respect privacy boundaries',
        category: 'privacy',
        weight: 0.85,
        examples: {
          good: [
            'Refusing to share personal information',
            'Explaining privacy protection measures',
            'Respecting confidentiality requests'
          ],
          bad: [
            'Requesting unnecessary personal information',
            'Sharing confidential details',
            'Violating privacy expectations'
          ]
        }
      },
      {
        id: 'transparency',
        name: 'Be Transparent About Limitations',
        description: 'Clearly communicate capabilities, limitations, and uncertainty',
        category: 'accuracy',
        weight: 0.7,
        examples: {
          good: [
            'Explaining AI capabilities and limitations',
            'Acknowledging uncertainty in responses',
            'Being clear about what the AI can and cannot do'
          ],
          bad: [
            'Claiming abilities the AI doesn\'t have',
            'Presenting uncertain information as definitive',
            'Misleading users about AI capabilities'
          ]
        }
      },
      {
        id: 'autonomy',
        name: 'Respect Human Autonomy',
        description: 'Support human decision-making without being manipulative or coercive',
        category: 'ethics',
        weight: 0.8,
        examples: {
          good: [
            'Providing balanced information for decisions',
            'Respecting user choices',
            'Encouraging critical thinking'
          ],
          bad: [
            'Using manipulative persuasion techniques',
            'Pressuring users into specific decisions',
            'Undermining user agency'
          ]
        }
      },
      {
        id: 'lawfulness',
        name: 'Comply with Legal and Ethical Standards',
        description: 'Avoid assisting with illegal activities or unethical behavior',
        category: 'safety',
        weight: 1.0,
        examples: {
          good: [
            'Declining illegal requests politely',
            'Suggesting legal alternatives',
            'Explaining relevant laws when appropriate'
          ],
          bad: [
            'Providing instructions for illegal activities',
            'Helping circumvent laws or regulations',
            'Encouraging unethical behavior'
          ]
        }
      }
    ];

    for (const principle of corePrinciples) {
      this.principles.set(principle.id, principle);
    }

    this.logger.info(`Initialized ${corePrinciples.length} constitutional principles`);
  }

  public async validate(request: ValidationRequest): Promise<ValidationResult> {
    const startTime = Date.now();
    this.stats.total_validations++;

    try {
      this.logger.debug('Validating content', {
        content_length: request.content.length,
        principles_count: request.principles?.length || this.principles.size,
        strict_mode: request.strict_mode
      });

      // Use specified principles or all principles
      const principleIds = request.principles || Array.from(this.principles.keys());
      const selectedPrinciples = principleIds
        .map(id => this.principles.get(id))
        .filter(p => p !== undefined) as ConstitutionalPrinciple[];

      if (selectedPrinciples.length === 0) {
        throw new Error('No valid principles found for validation');
      }

      // Perform validation checks
      const violations = await this.detectViolations(
        request.content,
        selectedPrinciples,
        request.strict_mode || false,
        request.context
      );

      // Calculate overall result
      const result = this.calculateValidationResult(
        violations,
        request.include_explanation || false,
        request.content
      );

      // Update statistics
      this.updateStats(result);

      const processingTime = Date.now() - startTime;
      this.logger.info('Content validation completed', {
        is_valid: result.is_valid,
        violations_found: violations.length,
        severity: result.severity,
        confidence: result.confidence,
        processing_time: processingTime
      });

      return result;

    } catch (error) {
      this.logger.error('Content validation failed', error);
      throw error;
    }
  }

  private async detectViolations(
    content: string,
    principles: ConstitutionalPrinciple[],
    strictMode: boolean,
    context?: any
  ): Promise<Violation[]> {
    const violations: Violation[] = [];

    // Check each principle
    for (const principle of principles) {
      try {
        const principleViolations = await this.checkPrinciple(
          content,
          principle,
          strictMode,
          context
        );
        violations.push(...principleViolations);

      } catch (error) {
        this.logger.warn(`Failed to check principle ${principle.id}`, error);
      }
    }

    return violations;
  }

  private async checkPrinciple(
    content: string,
    principle: ConstitutionalPrinciple,
    strictMode: boolean,
    context?: any
  ): Promise<Violation[]> {
    
    const checkPrompt = this.buildPrincipleCheckPrompt(content, principle, strictMode, context);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert constitutional AI validator. Analyze content for violations of specific principles. Be thorough but fair in your assessment.'
        },
        {
          role: 'user',
          content: checkPrompt
        }
      ],
      max_tokens: 800,
      temperature: 0.1 // Low temperature for consistency
    });

    const response = completion.choices[0].message.content || '';
    return this.parsePrincipleCheckResponse(response, principle);
  }

  private buildPrincipleCheckPrompt(
    content: string,
    principle: ConstitutionalPrinciple,
    strictMode: boolean,
    context?: any
  ): string {
    let prompt = `Analyze the following content for violations of this constitutional principle:

PRINCIPLE: ${principle.name}
DESCRIPTION: ${principle.description}
CATEGORY: ${principle.category}
IMPORTANCE: ${principle.weight}

GOOD EXAMPLES:
${principle.examples.good.map(ex => `- ${ex}`).join('\n')}

BAD EXAMPLES:
${principle.examples.bad.map(ex => `- ${ex}`).join('\n')}

CONTENT TO ANALYZE:
"${content}"

MODE: ${strictMode ? 'STRICT' : 'NORMAL'} (${strictMode ? 'flag potential issues' : 'flag clear violations'})`;

    if (context) {
      prompt += `\n\nCONTEXT: ${JSON.stringify(context, null, 2)}`;
    }

    prompt += `\n\nPlease respond in this format:
VIOLATION_FOUND: [YES/NO]
SEVERITY: [low/medium/high/critical]
DESCRIPTION: [Brief description of the issue, if any]
SUGGESTION: [How to fix the issue, if applicable]
CONFIDENCE: [0-100]`;

    return prompt;
  }

  private parsePrincipleCheckResponse(response: string, principle: ConstitutionalPrinciple): Violation[] {
    const violations: Violation[] = [];

    try {
      const lines = response.split('\n');
      const data: any = {};

      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          data[key.trim().toLowerCase().replace('_', '')] = valueParts.join(':').trim();
        }
      }

      const violationFound = data.violationfound?.toLowerCase() === 'yes';
      
      if (violationFound) {
        const severity = this.parseSeverity(data.severity || 'medium');
        
        violations.push({
          principle: principle.name,
          description: data.description || `Potential violation of ${principle.name}`,
          severity: severity,
          suggestion: data.suggestion || `Review content against ${principle.name} principle`
        });
      }

    } catch (error) {
      this.logger.warn('Failed to parse principle check response', error, {
        principle: principle.id,
        response: response.substring(0, 200)
      });
    }

    return violations;
  }

  private parseSeverity(severityStr: string): 'low' | 'medium' | 'high' | 'critical' {
    const severity = severityStr.toLowerCase();
    if (['critical', 'severe'].includes(severity)) return 'critical';
    if (['high', 'major'].includes(severity)) return 'high';
    if (['medium', 'moderate'].includes(severity)) return 'medium';
    return 'low';
  }

  private calculateValidationResult(
    violations: Violation[],
    includeExplanation: boolean,
    originalContent: string
  ): ValidationResult {
    
    const isValid = violations.length === 0;
    const severity = this.calculateOverallSeverity(violations);
    const confidence = this.calculateConfidence(violations);

    let explanation: string | undefined;
    let suggestedRevision: string | undefined;

    if (includeExplanation && violations.length > 0) {
      explanation = this.generateExplanation(violations);
      if (severity !== 'low') {
        suggestedRevision = this.generateSuggestedRevision(originalContent, violations);
      }
    }

    return {
      is_valid: isValid,
      confidence,
      violations,
      severity,
      explanation,
      suggested_revision: suggestedRevision
    };
  }

  private calculateOverallSeverity(violations: Violation[]): 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length === 0) return 'low';

    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const maxSeverity = Math.max(...violations.map(v => severityLevels[v.severity]));

    const severityMap: Record<number, 'low' | 'medium' | 'high' | 'critical'> = {
      1: 'low',
      2: 'medium', 
      3: 'high',
      4: 'critical'
    };

    return severityMap[maxSeverity] || 'medium';
  }

  private calculateConfidence(violations: Violation[]): number {
    if (violations.length === 0) {
      return 0.95; // High confidence when no violations found
    }

    // Lower confidence with more violations or higher severity
    const severityPenalty = violations.reduce((sum, v) => {
      const penalties = { low: 0.05, medium: 0.1, high: 0.2, critical: 0.3 };
      return sum + penalties[v.severity];
    }, 0);

    const volumePenalty = Math.min(violations.length * 0.05, 0.3);
    const confidence = Math.max(0.5, 0.9 - severityPenalty - volumePenalty);

    return Math.round(confidence * 100) / 100;
  }

  private generateExplanation(violations: Violation[]): string {
    if (violations.length === 0) {
      return 'Content passed all constitutional checks.';
    }

    const explanationParts = [
      `Found ${violations.length} potential ${violations.length === 1 ? 'issue' : 'issues'}:`
    ];

    violations.forEach((violation, index) => {
      explanationParts.push(
        `${index + 1}. **${violation.principle}** (${violation.severity}): ${violation.description}`
      );

      if (violation.suggestion) {
        explanationParts.push(`   Suggestion: ${violation.suggestion}`);
      }
    });

    return explanationParts.join('\n');
  }

  private async generateSuggestedRevision(content: string, violations: Violation[]): Promise<string> {
    const revisionPrompt = `The following content has constitutional violations that need to be addressed:

ORIGINAL CONTENT:
${content}

VIOLATIONS:
${violations.map(v => `- ${v.principle}: ${v.description}`).join('\n')}

Please provide a revised version that addresses these violations while maintaining the core intent and helpfulness of the original content. Make minimal changes necessary to resolve the issues.

REVISED CONTENT:`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content editor specializing in constitutional AI compliance. Revise content to address violations while preserving helpfulness and intent.'
          },
          {
            role: 'user',
            content: revisionPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      return completion.choices[0].message.content || 'Unable to generate revision';

    } catch (error) {
      this.logger.error('Failed to generate suggested revision', error);
      return 'Unable to generate revision due to processing error';
    }
  }

  private updateStats(result: ValidationResult): void {
    if (result.violations.length > 0) {
      this.stats.violations_detected++;
    }

    // Update severity distribution
    this.stats.severity_distribution[result.severity]++;

    // Update average confidence
    const total = this.stats.total_validations;
    this.stats.avg_confidence = ((this.stats.avg_confidence * (total - 1)) + result.confidence) / total;
  }

  public addCustomPrinciple(principle: ConstitutionalPrinciple): void {
    this.principles.set(principle.id, principle);
    this.logger.info('Custom principle added', { 
      id: principle.id, 
      name: principle.name, 
      category: principle.category 
    });
  }

  public removePrinciple(principleId: string): boolean {
    const removed = this.principles.delete(principleId);
    if (removed) {
      this.logger.info('Principle removed', { id: principleId });
    }
    return removed;
  }

  public getPrinciples(): ConstitutionalPrinciple[] {
    return Array.from(this.principles.values());
  }

  public async getInfo(): Promise<any> {
    return {
      component: 'ConstitutionalAI',
      version: '2.0.0',
      principles_count: this.principles.size,
      principles: Array.from(this.principles.values()).map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        weight: p.weight
      })),
      categories: [...new Set(Array.from(this.principles.values()).map(p => p.category))],
      capabilities: [
        'Content Validation',
        'Principle Violation Detection',
        'Severity Assessment',
        'Suggested Revisions',
        'Custom Principle Support',
        'Multi-Category Analysis'
      ],
      status: 'active'
    };
  }

  public async getStats(): Promise<any> {
    return { 
      ...this.stats,
      violation_rate: this.stats.total_validations > 0 ? 
        this.stats.violations_detected / this.stats.total_validations : 0
    };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Constitutional AI...');
    // Clean up resources if needed
    this.logger.info('Constitutional AI shutdown complete');
  }
}