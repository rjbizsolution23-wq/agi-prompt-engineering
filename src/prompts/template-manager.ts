/**
 * Prompt Template Manager
 * Manages and organizes prompt templates for various AI tasks
 */

import { Logger } from '../utils/logger';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'reasoning' | 'creative' | 'analytical' | 'conversational' | 'system';
  template: string;
  variables: TemplateVariable[];
  examples: PromptExample[];
  metadata: {
    created_at: Date;
    updated_at: Date;
    version: string;
    author?: string;
    tags: string[];
  };
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default_value?: any;
  validation?: {
    min_length?: number;
    max_length?: number;
    pattern?: string;
    enum_values?: any[];
  };
}

export interface PromptExample {
  input: Record<string, any>;
  expected_output: string;
  description: string;
}

export class PromptTemplateManager {
  private logger: Logger;
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.logger = new Logger('PromptTemplateManager');
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Prompt Template Manager...');
    
    // Load default templates
    await this.loadDefaultTemplates();
    
    this.logger.info('Prompt Template Manager initialized successfully');
  }

  private async loadDefaultTemplates(): Promise<void> {
    const defaultTemplates: PromptTemplate[] = [
      {
        id: 'chain_of_thought',
        name: 'Chain-of-Thought Reasoning',
        description: 'Template for systematic step-by-step reasoning',
        category: 'reasoning',
        template: `Problem: {problem}

Please solve this step by step:

1. First, let me understand what is being asked:
{problem_analysis}

2. Let me identify the key information:
{key_information}

3. Now I'll work through this systematically:
{step_by_step_reasoning}

4. Therefore, the answer is:
{conclusion}`,
        variables: [
          {
            name: 'problem',
            type: 'string',
            description: 'The problem or question to solve',
            required: true
          },
          {
            name: 'problem_analysis',
            type: 'string', 
            description: 'Analysis of what the problem is asking',
            required: false,
            default_value: 'Let me break down this problem...'
          },
          {
            name: 'key_information',
            type: 'string',
            description: 'Key facts and information needed',
            required: false
          },
          {
            name: 'step_by_step_reasoning',
            type: 'string',
            description: 'Step-by-step reasoning process',
            required: false
          },
          {
            name: 'conclusion',
            type: 'string',
            description: 'Final conclusion or answer',
            required: false
          }
        ],
        examples: [
          {
            input: {
              problem: 'What is 15% of 240?'
            },
            expected_output: 'Step 1: Understanding - I need to calculate 15% of 240\nStep 2: Method - Convert percentage to decimal: 15% = 0.15\nStep 3: Calculate - 240 × 0.15 = 36\nTherefore: 15% of 240 is 36',
            description: 'Basic percentage calculation'
          }
        ],
        metadata: {
          created_at: new Date(),
          updated_at: new Date(),
          version: '1.0.0',
          author: 'RJ Business Solutions',
          tags: ['reasoning', 'math', 'analysis']
        }
      },
      {
        id: 'react_agent',
        name: 'ReAct Agent Template',
        description: 'Template for Reasoning and Acting methodology',
        category: 'reasoning',
        template: `Task: {task}

I need to approach this systematically using reasoning and actions.

Thought 1: {initial_thought}
Action 1: {action_1}
Observation 1: {observation_1}

Thought 2: {follow_up_thought}
Action 2: {action_2} 
Observation 2: {observation_2}

Final Answer: {final_answer}`,
        variables: [
          {
            name: 'task',
            type: 'string',
            description: 'The task to complete',
            required: true
          },
          {
            name: 'initial_thought',
            type: 'string',
            description: 'First reasoning step',
            required: false
          },
          {
            name: 'action_1',
            type: 'string',
            description: 'First action to take',
            required: false
          },
          {
            name: 'observation_1',
            type: 'string',
            description: 'Result of first action',
            required: false
          }
        ],
        examples: [],
        metadata: {
          created_at: new Date(),
          updated_at: new Date(),
          version: '1.0.0',
          author: 'RJ Business Solutions',
          tags: ['reasoning', 'action', 'agent']
        }
      },
      {
        id: 'creative_writing',
        name: 'Creative Writing Assistant',
        description: 'Template for creative writing tasks',
        category: 'creative',
        template: `Creative Writing Task: {writing_type}

Theme: {theme}
Style: {style}
Tone: {tone}
Target Audience: {audience}

{additional_requirements}

Please create engaging content that:
- Captures the reader's attention from the start
- Maintains consistent {tone} throughout
- Appeals to {audience}
- Incorporates the theme of {theme}
- Uses {style} writing style

Content:
{content_placeholder}`,
        variables: [
          {
            name: 'writing_type',
            type: 'string',
            description: 'Type of creative writing (story, poem, script, etc.)',
            required: true,
            validation: {
              enum_values: ['story', 'poem', 'script', 'article', 'blog_post', 'marketing_copy']
            }
          },
          {
            name: 'theme',
            type: 'string',
            description: 'Main theme or topic',
            required: true
          },
          {
            name: 'style',
            type: 'string',
            description: 'Writing style',
            required: false,
            default_value: 'conversational'
          },
          {
            name: 'tone',
            type: 'string', 
            description: 'Desired tone',
            required: false,
            default_value: 'friendly'
          },
          {
            name: 'audience',
            type: 'string',
            description: 'Target audience',
            required: false,
            default_value: 'general audience'
          }
        ],
        examples: [],
        metadata: {
          created_at: new Date(),
          updated_at: new Date(),
          version: '1.0.0',
          author: 'RJ Business Solutions',
          tags: ['creative', 'writing', 'content']
        }
      }
    ];

    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }

    this.logger.info(`Loaded ${defaultTemplates.length} default templates`);
  }

  public renderTemplate(templateId: string, variables: Record<string, any>): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    this.validateVariables(template, variables);

    // Fill in default values for missing variables
    const filledVariables = this.fillDefaults(template, variables);

    // Render template
    let rendered = template.template;
    
    for (const [key, value] of Object.entries(filledVariables)) {
      const placeholder = `{${key}}`;
      rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
    }

    return rendered;
  }

  private validateVariables(template: PromptTemplate, variables: Record<string, any>): void {
    const errors: string[] = [];

    for (const templateVar of template.variables) {
      const value = variables[templateVar.name];

      // Check required variables
      if (templateVar.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable missing: ${templateVar.name}`);
        continue;
      }

      // Skip validation if variable is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (templateVar.type === 'string' && typeof value !== 'string') {
        errors.push(`Variable ${templateVar.name} must be a string`);
      } else if (templateVar.type === 'number' && typeof value !== 'number') {
        errors.push(`Variable ${templateVar.name} must be a number`);
      } else if (templateVar.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Variable ${templateVar.name} must be a boolean`);
      } else if (templateVar.type === 'array' && !Array.isArray(value)) {
        errors.push(`Variable ${templateVar.name} must be an array`);
      }

      // Validation rules
      if (templateVar.validation) {
        const validation = templateVar.validation;
        
        if (validation.min_length && typeof value === 'string' && value.length < validation.min_length) {
          errors.push(`Variable ${templateVar.name} must be at least ${validation.min_length} characters`);
        }
        
        if (validation.max_length && typeof value === 'string' && value.length > validation.max_length) {
          errors.push(`Variable ${templateVar.name} must be no more than ${validation.max_length} characters`);
        }
        
        if (validation.enum_values && !validation.enum_values.includes(value)) {
          errors.push(`Variable ${templateVar.name} must be one of: ${validation.enum_values.join(', ')}`);
        }
        
        if (validation.pattern && typeof value === 'string' && !new RegExp(validation.pattern).test(value)) {
          errors.push(`Variable ${templateVar.name} does not match required pattern`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join('; ')}`);
    }
  }

  private fillDefaults(template: PromptTemplate, variables: Record<string, any>): Record<string, any> {
    const filled = { ...variables };

    for (const templateVar of template.variables) {
      if (filled[templateVar.name] === undefined && templateVar.default_value !== undefined) {
        filled[templateVar.name] = templateVar.default_value;
      }
    }

    return filled;
  }

  public createTemplate(template: Omit<PromptTemplate, 'metadata'>): string {
    const id = template.id || this.generateTemplateId(template.name);
    
    const fullTemplate: PromptTemplate = {
      ...template,
      id,
      metadata: {
        created_at: new Date(),
        updated_at: new Date(),
        version: '1.0.0',
        tags: []
      }
    };

    this.templates.set(id, fullTemplate);
    
    this.logger.info('Template created', { 
      id, 
      name: template.name, 
      category: template.category 
    });

    return id;
  }

  public updateTemplate(id: string, updates: Partial<PromptTemplate>): void {
    const existing = this.templates.get(id);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }

    const updated: PromptTemplate = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        updated_at: new Date(),
        version: this.incrementVersion(existing.metadata.version)
      }
    };

    this.templates.set(id, updated);
    
    this.logger.info('Template updated', { 
      id, 
      version: updated.metadata.version 
    });
  }

  public deleteTemplate(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.logger.info('Template deleted', { id });
    }
    return deleted;
  }

  public getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  public listTemplates(category?: string): PromptTemplate[] {
    const templates = Array.from(this.templates.values());
    
    if (category) {
      return templates.filter(t => t.category === category);
    }
    
    return templates;
  }

  public searchTemplates(query: string): PromptTemplate[] {
    const searchTerm = query.toLowerCase();
    
    return Array.from(this.templates.values()).filter(template => 
      template.name.toLowerCase().includes(searchTerm) ||
      template.description.toLowerCase().includes(searchTerm) ||
      template.metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  public validateTemplate(template: PromptTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!template.id || template.id.trim() === '') {
      errors.push('Template ID is required');
    }

    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required');
    }

    if (!template.template || template.template.trim() === '') {
      errors.push('Template content is required');
    }

    // Variable validation
    for (const variable of template.variables) {
      if (!variable.name || variable.name.trim() === '') {
        errors.push('Variable name is required');
      }

      if (!variable.type) {
        errors.push(`Variable ${variable.name} must have a type`);
      }

      // Check if variable is used in template
      const placeholder = `{${variable.name}}`;
      if (!template.template.includes(placeholder)) {
        errors.push(`Variable ${variable.name} is defined but not used in template`);
      }
    }

    // Check for undefined variables in template
    const variablePattern = /{([^}]+)}/g;
    let match;
    while ((match = variablePattern.exec(template.template)) !== null) {
      const varName = match[1];
      if (!template.variables.some(v => v.name === varName)) {
        errors.push(`Undefined variable in template: {${varName}}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private generateTemplateId(name: string): string {
    const base = name.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    let id = base;
    let counter = 1;
    
    while (this.templates.has(id)) {
      id = `${base}_${counter}`;
      counter++;
    }
    
    return id;
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    if (parts.length >= 3) {
      const patch = parseInt(parts[2]) + 1;
      return `${parts[0]}.${parts[1]}.${patch}`;
    }
    return '1.0.1';
  }

  public async getInfo(): Promise<any> {
    const categories = [...new Set(Array.from(this.templates.values()).map(t => t.category))];
    
    return {
      component: 'PromptTemplateManager',
      version: '2.0.0',
      templates_count: this.templates.size,
      categories: categories,
      template_summary: categories.map(category => ({
        category,
        count: Array.from(this.templates.values()).filter(t => t.category === category).length
      })),
      capabilities: [
        'Template Creation',
        'Variable Substitution',
        'Template Validation',
        'Search and Filtering',
        'Version Management',
        'Category Organization'
      ],
      status: 'active'
    };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Prompt Template Manager...');
    this.templates.clear();
    this.logger.info('Prompt Template Manager shutdown complete');
  }
}