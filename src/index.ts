#!/usr/bin/env node

/**
 * AGI Prompt Engineering Framework
 * Advanced Multi-Agent Reasoning and Orchestration System
 * 
 * @author Rick Jefferson <rjbizsolution23@gmail.com>
 * @company RJ Business Solutions
 * @version 2.0.0
 */

import express from 'express';
import dotenv from 'dotenv';
import { Logger } from './utils/logger';
import { AGIFramework } from './frameworks/agi-framework';
import { ReasoningEngine } from './frameworks/reasoning/reasoning-engine';
import { MemorySystem } from './frameworks/memory/memory-system';
import { MultiAgentOrchestrator } from './frameworks/multi-agent/orchestrator';
import { PromptTemplateManager } from './prompts/template-manager';
import { ConstitutionalAI } from './agents/constitutional/constitutional-ai';
import { RAGSystem } from './frameworks/rag/rag-system';

// Load environment variables
dotenv.config();

class AGIServer {
  private app: express.Application;
  private framework: AGIFramework;
  private logger: Logger;
  private port: number;

  constructor() {
    this.app = express();
    this.logger = new Logger('AGIServer');
    this.port = parseInt(process.env.PORT || '3000');
    
    this.setupMiddleware();
    this.initializeFramework();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, { 
        ip: req.ip, 
        userAgent: req.get('User-Agent') 
      });
      next();
    });
  }

  private async initializeFramework(): Promise<void> {
    try {
      this.logger.info('Initializing AGI Framework...');

      // Initialize core components
      const reasoningEngine = new ReasoningEngine();
      const memorySystem = new MemorySystem();
      const orchestrator = new MultiAgentOrchestrator();
      const templateManager = new PromptTemplateManager();
      const constitutionalAI = new ConstitutionalAI();
      const ragSystem = new RAGSystem();

      // Initialize main framework
      this.framework = new AGIFramework({
        reasoningEngine,
        memorySystem,
        orchestrator,
        templateManager,
        constitutionalAI,
        ragSystem
      });

      await this.framework.initialize();
      this.logger.info('AGI Framework initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize AGI Framework', error);
      process.exit(1);
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        framework: 'AGI Prompt Engineering'
      });
    });

    // Framework info
    this.app.get('/info', async (req, res) => {
      try {
        const info = await this.framework.getSystemInfo();
        res.json(info);
      } catch (error) {
        this.logger.error('Error getting system info', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Chat completion with reasoning
    this.app.post('/chat/complete', async (req, res) => {
      try {
        const { message, context, reasoning_type = 'chain-of-thought' } = req.body;

        if (!message) {
          return res.status(400).json({ error: 'Message is required' });
        }

        const result = await this.framework.processMessage({
          message,
          context,
          reasoning_type,
          include_reasoning: true,
          max_tokens: 2000
        });

        res.json(result);

      } catch (error) {
        this.logger.error('Error in chat completion', error);
        res.status(500).json({ error: 'Failed to process message' });
      }
    });

    // Multi-agent collaboration
    this.app.post('/agents/collaborate', async (req, res) => {
      try {
        const { task, agents, collaboration_type = 'sequential' } = req.body;

        if (!task || !agents || !Array.isArray(agents)) {
          return res.status(400).json({ 
            error: 'Task and agents array are required' 
          });
        }

        const result = await this.framework.orchestrateAgents({
          task,
          agents,
          collaboration_type,
          include_intermediate_results: true
        });

        res.json(result);

      } catch (error) {
        this.logger.error('Error in agent collaboration', error);
        res.status(500).json({ error: 'Failed to orchestrate agents' });
      }
    });

    // RAG query
    this.app.post('/rag/query', async (req, res) => {
      try {
        const { query, collection, top_k = 5, include_metadata = true } = req.body;

        if (!query) {
          return res.status(400).json({ error: 'Query is required' });
        }

        const result = await this.framework.queryRAG({
          query,
          collection,
          top_k,
          include_metadata
        });

        res.json(result);

      } catch (error) {
        this.logger.error('Error in RAG query', error);
        res.status(500).json({ error: 'Failed to process RAG query' });
      }
    });

    // Constitutional AI validation
    this.app.post('/constitutional/validate', async (req, res) => {
      try {
        const { content, principles, strict_mode = false } = req.body;

        if (!content) {
          return res.status(400).json({ error: 'Content is required' });
        }

        const result = await this.framework.validateContent({
          content,
          principles,
          strict_mode,
          include_explanation: true
        });

        res.json(result);

      } catch (error) {
        this.logger.error('Error in constitutional validation', error);
        res.status(500).json({ error: 'Failed to validate content' });
      }
    });

    // Fine-tuning management
    this.app.post('/fine-tuning/start', async (req, res) => {
      try {
        const { 
          model_name, 
          training_data, 
          validation_data, 
          hyperparameters,
          target_task 
        } = req.body;

        if (!model_name || !training_data) {
          return res.status(400).json({ 
            error: 'Model name and training data are required' 
          });
        }

        const result = await this.framework.startFineTuning({
          model_name,
          training_data,
          validation_data,
          hyperparameters,
          target_task
        });

        res.json(result);

      } catch (error) {
        this.logger.error('Error starting fine-tuning', error);
        res.status(500).json({ error: 'Failed to start fine-tuning' });
      }
    });

    // Analytics and metrics
    this.app.get('/analytics/performance', async (req, res) => {
      try {
        const metrics = await this.framework.getPerformanceMetrics();
        res.json(metrics);
      } catch (error) {
        this.logger.error('Error getting performance metrics', error);
        res.status(500).json({ error: 'Failed to get metrics' });
      }
    });

    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('Unhandled error', error);
      res.status(500).json({ error: 'Internal server error' });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  }

  public async start(): Promise<void> {
    try {
      await new Promise<void>((resolve) => {
        this.app.listen(this.port, () => {
          this.logger.info(`AGI Framework server running on port ${this.port}`);
          this.logger.info(`Health check: http://localhost:${this.port}/health`);
          this.logger.info(`API Documentation: http://localhost:${this.port}/docs`);
          resolve();
        });
      });
    } catch (error) {
      this.logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down AGI Framework...');
    await this.framework.shutdown();
    process.exit(0);
  }
}

// Initialize and start server
async function main() {
  const server = new AGIServer();
  
  // Graceful shutdown handlers
  process.on('SIGINT', () => server.shutdown());
  process.on('SIGTERM', () => server.shutdown());
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  await server.start();
}

// Start the application
if (require.main === module) {
  main().catch(console.error);
}

export { AGIServer };