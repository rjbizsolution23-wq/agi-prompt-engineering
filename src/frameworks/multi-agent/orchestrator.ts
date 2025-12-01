/**
 * Multi-Agent Orchestrator
 * Coordinates multiple AI agents for complex task collaboration
 */

import { Logger } from '../../utils/logger';
import { OpenAI } from 'openai';

export interface Agent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  tools?: string[];
}

export interface CollaborationRequest {
  task: string;
  agents: string[];
  type: 'sequential' | 'parallel' | 'hierarchical';
  include_intermediate?: boolean;
  max_iterations?: number;
}

export interface CollaborationResult {
  task: string;
  type: string;
  agents_used: Agent[];
  steps: CollaborationStep[];
  final_result: string;
  execution_time: number;
  success: boolean;
}

export interface CollaborationStep {
  step_number: number;
  agent: Agent;
  input: string;
  output: string;
  timestamp: Date;
  execution_time: number;
  success: boolean;
  metadata?: any;
}

export class MultiAgentOrchestrator {
  private logger: Logger;
  private openai: OpenAI;
  private agents: Map<string, Agent> = new Map();
  private stats: {
    total_collaborations: number;
    avg_agents_per_task: number;
    success_rate: number;
    avg_execution_time: number;
  };

  constructor() {
    this.logger = new Logger('MultiAgentOrchestrator');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.stats = {
      total_collaborations: 0,
      avg_agents_per_task: 2.5,
      success_rate: 0.95,
      avg_execution_time: 5000
    };
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Multi-Agent Orchestrator...');

    // Initialize predefined agents
    await this.initializePredefinedAgents();

    this.logger.info('Multi-Agent Orchestrator initialized successfully');
  }

  private async initializePredefinedAgents(): Promise<void> {
    const predefinedAgents: Agent[] = [
      {
        id: 'analyst',
        name: 'Data Analyst',
        role: 'Analysis and Research',
        capabilities: ['data_analysis', 'research', 'pattern_recognition', 'statistical_analysis'],
        model: 'gpt-4',
        temperature: 0.3,
        max_tokens: 1000,
        system_prompt: 'You are an expert data analyst. Analyze information objectively, identify patterns, and provide evidence-based insights. Focus on accuracy and statistical significance.',
        tools: ['calculator', 'data_visualization', 'statistical_tests']
      },
      {
        id: 'creative',
        name: 'Creative Designer',
        role: 'Creative and Design',
        capabilities: ['creative_writing', 'design_thinking', 'brainstorming', 'visual_concepts'],
        model: 'gpt-4',
        temperature: 0.8,
        max_tokens: 1200,
        system_prompt: 'You are a creative professional specializing in innovative thinking and design. Generate original ideas, think outside the box, and create engaging content.',
        tools: ['image_generation', 'color_palette', 'typography']
      },
      {
        id: 'technical',
        name: 'Technical Architect',
        role: 'Technical Implementation',
        capabilities: ['software_architecture', 'code_review', 'system_design', 'performance_optimization'],
        model: 'gpt-4',
        temperature: 0.2,
        max_tokens: 1500,
        system_prompt: 'You are a senior technical architect. Focus on scalable solutions, best practices, security, and performance. Provide detailed technical specifications.',
        tools: ['code_analysis', 'architecture_diagrams', 'performance_testing']
      },
      {
        id: 'strategist',
        name: 'Business Strategist',
        role: 'Strategic Planning',
        capabilities: ['strategic_planning', 'business_analysis', 'market_research', 'risk_assessment'],
        model: 'gpt-4',
        temperature: 0.4,
        max_tokens: 1000,
        system_prompt: 'You are a business strategist with extensive experience in planning and execution. Focus on ROI, market opportunities, and strategic alignment.',
        tools: ['market_analysis', 'financial_modeling', 'swot_analysis']
      },
      {
        id: 'reviewer',
        name: 'Quality Reviewer',
        role: 'Quality Assurance',
        capabilities: ['quality_review', 'error_detection', 'compliance_check', 'process_improvement'],
        model: 'gpt-4',
        temperature: 0.1,
        max_tokens: 800,
        system_prompt: 'You are a quality assurance specialist. Review work for accuracy, completeness, and compliance. Identify potential issues and suggest improvements.',
        tools: ['checklist_validation', 'compliance_scanner', 'quality_metrics']
      },
      {
        id: 'communicator',
        name: 'Communications Expert',
        role: 'Communication and Presentation',
        capabilities: ['clear_communication', 'presentation_skills', 'audience_adaptation', 'storytelling'],
        model: 'gpt-4',
        temperature: 0.6,
        max_tokens: 1000,
        system_prompt: 'You are a communications expert. Transform complex information into clear, engaging content tailored to the target audience.',
        tools: ['presentation_builder', 'audience_analyzer', 'content_optimizer']
      }
    ];

    for (const agent of predefinedAgents) {
      this.agents.set(agent.id, agent);
      this.logger.debug('Registered agent', { 
        id: agent.id, 
        name: agent.name, 
        role: agent.role 
      });
    }

    this.logger.info(`Initialized ${predefinedAgents.length} predefined agents`);
  }

  public async collaborate(request: CollaborationRequest): Promise<CollaborationResult> {
    const startTime = Date.now();
    this.stats.total_collaborations++;

    try {
      this.logger.info('Starting multi-agent collaboration', {
        task: request.task.substring(0, 100),
        agents: request.agents,
        type: request.type
      });

      // Validate and get agents
      const selectedAgents = this.validateAndGetAgents(request.agents);
      
      let result: CollaborationResult;

      switch (request.type) {
        case 'sequential':
          result = await this.sequentialCollaboration(request, selectedAgents);
          break;
        case 'parallel':
          result = await this.parallelCollaboration(request, selectedAgents);
          break;
        case 'hierarchical':
          result = await this.hierarchicalCollaboration(request, selectedAgents);
          break;
        default:
          throw new Error(`Unknown collaboration type: ${request.type}`);
      }

      const executionTime = Date.now() - startTime;
      result.execution_time = executionTime;

      // Update statistics
      this.updateStats(executionTime, selectedAgents.length, result.success);

      this.logger.info('Multi-agent collaboration completed', {
        success: result.success,
        execution_time: executionTime,
        agents_used: selectedAgents.length
      });

      return result;

    } catch (error) {
      this.updateStats(Date.now() - startTime, request.agents.length, false);
      this.logger.error('Multi-agent collaboration failed', error);
      throw error;
    }
  }

  private async sequentialCollaboration(
    request: CollaborationRequest, 
    agents: Agent[]
  ): Promise<CollaborationResult> {
    const steps: CollaborationStep[] = [];
    let currentInput = request.task;
    let success = true;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const stepStart = Date.now();

      try {
        this.logger.debug('Executing sequential step', {
          step: i + 1,
          agent: agent.name,
          input_length: currentInput.length
        });

        const prompt = this.buildAgentPrompt(agent, currentInput, i, agents.length);
        const response = await this.executeAgentTask(agent, prompt);

        const step: CollaborationStep = {
          step_number: i + 1,
          agent: agent,
          input: currentInput,
          output: response,
          timestamp: new Date(),
          execution_time: Date.now() - stepStart,
          success: true
        };

        steps.push(step);
        currentInput = response; // Use output as input for next agent

      } catch (error) {
        this.logger.error('Sequential step failed', error, {
          step: i + 1,
          agent: agent.name
        });

        steps.push({
          step_number: i + 1,
          agent: agent,
          input: currentInput,
          output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          execution_time: Date.now() - stepStart,
          success: false
        });

        success = false;
        break;
      }
    }

    return {
      task: request.task,
      type: 'sequential',
      agents_used: agents,
      steps: steps,
      final_result: steps[steps.length - 1]?.output || 'No result',
      execution_time: 0, // Will be set by caller
      success: success
    };
  }

  private async parallelCollaboration(
    request: CollaborationRequest, 
    agents: Agent[]
  ): Promise<CollaborationResult> {
    const steps: CollaborationStep[] = [];
    let success = true;

    // Execute all agents in parallel
    const agentPromises = agents.map(async (agent, index) => {
      const stepStart = Date.now();

      try {
        this.logger.debug('Executing parallel task', {
          agent: agent.name,
          index: index + 1
        });

        const prompt = this.buildAgentPrompt(agent, request.task, index, agents.length, 'parallel');
        const response = await this.executeAgentTask(agent, prompt);

        return {
          step_number: index + 1,
          agent: agent,
          input: request.task,
          output: response,
          timestamp: new Date(),
          execution_time: Date.now() - stepStart,
          success: true
        };

      } catch (error) {
        this.logger.error('Parallel task failed', error, {
          agent: agent.name
        });

        return {
          step_number: index + 1,
          agent: agent,
          input: request.task,
          output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          execution_time: Date.now() - stepStart,
          success: false
        };
      }
    });

    const results = await Promise.all(agentPromises);
    steps.push(...results);

    // Check if any failed
    success = results.every(result => result.success);

    // Synthesize results
    const synthesizedResult = await this.synthesizeParallelResults(request.task, results);

    return {
      task: request.task,
      type: 'parallel',
      agents_used: agents,
      steps: steps,
      final_result: synthesizedResult,
      execution_time: 0, // Will be set by caller
      success: success
    };
  }

  private async hierarchicalCollaboration(
    request: CollaborationRequest, 
    agents: Agent[]
  ): Promise<CollaborationResult> {
    const steps: CollaborationStep[] = [];
    let success = true;

    // First agent (leader) breaks down the task
    const leader = agents[0];
    const stepStart = Date.now();

    try {
      const leaderPrompt = this.buildLeaderPrompt(leader, request.task, agents.slice(1));
      const taskBreakdown = await this.executeAgentTask(leader, leaderPrompt);

      steps.push({
        step_number: 1,
        agent: leader,
        input: request.task,
        output: taskBreakdown,
        timestamp: new Date(),
        execution_time: Date.now() - stepStart,
        success: true
      });

      // Extract subtasks (simplified parsing)
      const subtasks = this.parseSubtasks(taskBreakdown);
      const workers = agents.slice(1);

      // Assign subtasks to workers
      const workerPromises = subtasks.slice(0, workers.length).map(async (subtask, index) => {
        const worker = workers[index];
        const workerStart = Date.now();

        try {
          const workerPrompt = this.buildWorkerPrompt(worker, subtask, request.task);
          const result = await this.executeAgentTask(worker, workerPrompt);

          return {
            step_number: index + 2,
            agent: worker,
            input: subtask,
            output: result,
            timestamp: new Date(),
            execution_time: Date.now() - workerStart,
            success: true
          };

        } catch (error) {
          return {
            step_number: index + 2,
            agent: worker,
            input: subtask,
            output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            execution_time: Date.now() - workerStart,
            success: false
          };
        }
      });

      const workerResults = await Promise.all(workerPromises);
      steps.push(...workerResults);

      // Leader synthesizes final result
      const finalSynthesis = await this.synthesizeHierarchicalResults(
        request.task, 
        taskBreakdown, 
        workerResults
      );

      steps.push({
        step_number: steps.length + 1,
        agent: leader,
        input: 'Synthesis of worker results',
        output: finalSynthesis,
        timestamp: new Date(),
        execution_time: Date.now() - stepStart,
        success: true
      });

      success = workerResults.every(result => result.success);

      return {
        task: request.task,
        type: 'hierarchical',
        agents_used: agents,
        steps: steps,
        final_result: finalSynthesis,
        execution_time: 0,
        success: success
      };

    } catch (error) {
      this.logger.error('Hierarchical collaboration failed', error);
      throw error;
    }
  }

  private async executeAgentTask(agent: Agent, prompt: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: agent.model,
      messages: [
        {
          role: 'system',
          content: agent.system_prompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: agent.max_tokens,
      temperature: agent.temperature
    });

    return completion.choices[0].message.content || '';
  }

  private buildAgentPrompt(
    agent: Agent, 
    input: string, 
    stepIndex: number, 
    totalSteps: number, 
    type: string = 'sequential'
  ): string {
    let prompt = `Task: ${input}\n\n`;
    
    if (type === 'sequential') {
      prompt += `You are agent ${stepIndex + 1} of ${totalSteps} in a sequential workflow.\n`;
      prompt += `Your role: ${agent.role}\n`;
      prompt += `Your capabilities: ${agent.capabilities.join(', ')}\n\n`;
      
      if (stepIndex > 0) {
        prompt += `This input is the output from the previous agent. Build upon their work.\n`;
      }
      
      if (stepIndex < totalSteps - 1) {
        prompt += `Your output will be passed to the next agent, so be clear and comprehensive.\n`;
      } else {
        prompt += `You are the final agent. Provide a complete, polished result.\n`;
      }
    } else if (type === 'parallel') {
      prompt += `You are working in parallel with ${totalSteps - 1} other agents on this task.\n`;
      prompt += `Focus on your expertise area: ${agent.role}\n`;
      prompt += `Your unique capabilities: ${agent.capabilities.join(', ')}\n`;
      prompt += `Provide your perspective and recommendations based on your specialization.\n`;
    }

    return prompt;
  }

  private buildLeaderPrompt(leader: Agent, task: string, workers: Agent[]): string {
    return `As the lead coordinator, break down this complex task into smaller, manageable subtasks.

Main Task: ${task}

Available team members and their capabilities:
${workers.map(agent => `- ${agent.name} (${agent.role}): ${agent.capabilities.join(', ')}`).join('\n')}

Please:
1. Analyze the main task
2. Break it into 2-${workers.length} specific subtasks
3. Suggest which team member should handle each subtask
4. Provide clear, actionable instructions for each subtask

Format your response as:
SUBTASK 1: [Description]
ASSIGNED TO: [Agent name]
INSTRUCTIONS: [Specific instructions]

SUBTASK 2: [Description]
...`;
  }

  private buildWorkerPrompt(worker: Agent, subtask: string, originalTask: string): string {
    return `You have been assigned a specific subtask as part of a larger project.

Original Task: ${originalTask}

Your Subtask: ${subtask}

Your Role: ${worker.role}
Your Capabilities: ${worker.capabilities.join(', ')}

Please complete this subtask thoroughly, keeping in mind how it contributes to the overall project goal. Provide detailed results that can be integrated with other team members' work.`;
  }

  private async synthesizeParallelResults(task: string, results: CollaborationStep[]): Promise<string> {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return 'All parallel tasks failed. Unable to synthesize results.';
    }

    const synthesisPrompt = `Synthesize the following parallel agent results into a comprehensive response.

Original Task: ${task}

Agent Results:
${successfulResults.map(r => `${r.agent.name} (${r.agent.role}):\n${r.output}`).join('\n\n---\n\n')}

Please create a unified, coherent response that incorporates insights from all agents while avoiding redundancy.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at synthesizing multiple perspectives into coherent, comprehensive responses.'
        },
        {
          role: 'user',
          content: synthesisPrompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.4
    });

    return completion.choices[0].message.content || 'Failed to synthesize results';
  }

  private async synthesizeHierarchicalResults(
    originalTask: string, 
    breakdown: string, 
    workerResults: CollaborationStep[]
  ): Promise<string> {
    const synthesisPrompt = `As the project leader, provide a final comprehensive result.

Original Task: ${originalTask}

Task Breakdown: ${breakdown}

Team Results:
${workerResults.map(r => `${r.agent.name}: ${r.output}`).join('\n\n')}

Please provide a final, integrated solution that addresses the original task completely.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a project leader synthesizing team results into a final deliverable.'
        },
        {
          role: 'user',
          content: synthesisPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    return completion.choices[0].message.content || 'Failed to synthesize final result';
  }

  private parseSubtasks(breakdown: string): string[] {
    // Simple parsing - look for "SUBTASK" markers
    const lines = breakdown.split('\n');
    const subtasks: string[] = [];

    for (const line of lines) {
      if (line.toUpperCase().includes('SUBTASK')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > -1) {
          subtasks.push(line.substring(colonIndex + 1).trim());
        }
      }
    }

    // Fallback: split by paragraphs if no subtasks found
    if (subtasks.length === 0) {
      const paragraphs = breakdown.split('\n\n').filter(p => p.trim().length > 50);
      return paragraphs.slice(0, 3); // Limit to 3 subtasks
    }

    return subtasks;
  }

  private validateAndGetAgents(agentIds: string[]): Agent[] {
    const agents: Agent[] = [];

    for (const id of agentIds) {
      const agent = this.agents.get(id);
      if (!agent) {
        throw new Error(`Agent not found: ${id}`);
      }
      agents.push(agent);
    }

    if (agents.length === 0) {
      throw new Error('No valid agents provided');
    }

    return agents;
  }

  private updateStats(executionTime: number, agentCount: number, success: boolean): void {
    const total = this.stats.total_collaborations;
    
    // Update success rate
    this.stats.success_rate = ((this.stats.success_rate * (total - 1)) + (success ? 1 : 0)) / total;
    
    // Update average execution time
    this.stats.avg_execution_time = ((this.stats.avg_execution_time * (total - 1)) + executionTime) / total;
    
    // Update average agents per task
    this.stats.avg_agents_per_task = ((this.stats.avg_agents_per_task * (total - 1)) + agentCount) / total;
  }

  public getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.logger.info('Agent registered', { 
      id: agent.id, 
      name: agent.name, 
      role: agent.role 
    });
  }

  public async getInfo(): Promise<any> {
    return {
      component: 'MultiAgentOrchestrator',
      version: '2.0.0',
      registered_agents: this.agents.size,
      collaboration_types: ['sequential', 'parallel', 'hierarchical'],
      available_agents: Array.from(this.agents.values()).map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        capabilities: a.capabilities
      })),
      status: 'active'
    };
  }

  public async getStats(): Promise<any> {
    return { ...this.stats };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Multi-Agent Orchestrator...');
    this.agents.clear();
    this.logger.info('Multi-Agent Orchestrator shutdown complete');
  }
}