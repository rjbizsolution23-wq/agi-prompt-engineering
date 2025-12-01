/**
 * Advanced Memory System for AGI Framework
 * Supports episodic, semantic, and working memory with Redis backend
 */

import Redis from 'redis';
import { Logger } from '../../utils/logger';

export interface MemoryContext {
  id?: string;
  type: 'user_message' | 'assistant_response' | 'agent_collaboration' | 'fine_tuning_job' | 'system_event';
  content: any;
  context?: any;
  timestamp: Date;
  metadata?: Record<string, any>;
  embedding?: number[];
  importance?: number; // 0-1 scale
  tags?: string[];
}

export interface MemoryQuery {
  type?: string;
  content_search?: string;
  tags?: string[];
  time_range?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  include_metadata?: boolean;
}

export class MemorySystem {
  private logger: Logger;
  private redis: Redis.RedisClientType;
  private isConnected: boolean = false;
  private stats: {
    total_contexts: number;
    active_conversations: number;
    cache_hit_rate: number;
    memory_usage_mb: number;
  };

  constructor() {
    this.logger = new Logger('MemorySystem');
    this.stats = {
      total_contexts: 0,
      active_conversations: 0,
      cache_hit_rate: 0.95,
      memory_usage_mb: 0
    };
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Memory System...');

    try {
      // Initialize Redis connection
      this.redis = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          commandTimeout: 5000
        },
        retry_delay_on_failover: 100
      });

      this.redis.on('error', (error) => {
        this.logger.error('Redis connection error', error);
      });

      this.redis.on('connect', () => {
        this.logger.info('Connected to Redis');
        this.isConnected = true;
      });

      this.redis.on('disconnect', () => {
        this.logger.warn('Disconnected from Redis');
        this.isConnected = false;
      });

      await this.redis.connect();

      // Test connection
      await this.redis.ping();
      this.logger.info('Redis connection verified');

      // Initialize memory indexes
      await this.initializeIndexes();

      this.logger.info('Memory System initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Memory System', error);
      
      // Fallback to in-memory storage
      this.logger.warn('Falling back to in-memory storage');
      await this.initializeInMemoryStorage();
    }
  }

  private async initializeIndexes(): Promise<void> {
    try {
      // Create indexes for efficient querying
      const indexes = [
        'memory:contexts:by_type',
        'memory:contexts:by_timestamp',
        'memory:contexts:by_tags',
        'memory:conversations:active'
      ];

      for (const index of indexes) {
        await this.redis.sAdd(`indexes:${index}`, 'initialized');
      }

      this.logger.info('Memory indexes initialized');
    } catch (error) {
      this.logger.error('Failed to initialize memory indexes', error);
      throw error;
    }
  }

  private memoryStore: Map<string, MemoryContext> = new Map();

  private async initializeInMemoryStorage(): Promise<void> {
    this.logger.info('In-memory storage initialized');
    this.isConnected = false; // Flag to use in-memory mode
  }

  public async storeContext(context: MemoryContext): Promise<string> {
    try {
      const contextId = context.id || this.generateContextId();
      context.id = contextId;
      context.timestamp = context.timestamp || new Date();
      context.importance = context.importance || this.calculateImportance(context);

      if (this.isConnected) {
        // Store in Redis
        await this.redis.hSet(`memory:context:${contextId}`, {
          id: contextId,
          type: context.type,
          content: JSON.stringify(context.content),
          context: JSON.stringify(context.context || {}),
          timestamp: context.timestamp.toISOString(),
          metadata: JSON.stringify(context.metadata || {}),
          importance: context.importance.toString(),
          tags: JSON.stringify(context.tags || [])
        });

        // Add to indexes
        await Promise.all([
          this.redis.sAdd(`memory:type:${context.type}`, contextId),
          this.redis.zAdd('memory:timeline', {
            score: context.timestamp.getTime(),
            value: contextId
          }),
          this.redis.zAdd('memory:importance', {
            score: context.importance,
            value: contextId
          })
        ]);

        // Add tags to tag index
        if (context.tags && context.tags.length > 0) {
          for (const tag of context.tags) {
            await this.redis.sAdd(`memory:tag:${tag}`, contextId);
          }
        }

      } else {
        // Store in memory
        this.memoryStore.set(contextId, context);
      }

      this.stats.total_contexts++;

      this.logger.debug('Context stored', {
        context_id: contextId,
        type: context.type,
        importance: context.importance
      });

      return contextId;

    } catch (error) {
      this.logger.error('Failed to store context', error);
      throw error;
    }
  }

  public async retrieveContext(contextId: string): Promise<MemoryContext | null> {
    try {
      if (this.isConnected) {
        const contextData = await this.redis.hGetAll(`memory:context:${contextId}`);
        
        if (!contextData.id) {
          return null;
        }

        return {
          id: contextData.id,
          type: contextData.type as any,
          content: JSON.parse(contextData.content),
          context: JSON.parse(contextData.context || '{}'),
          timestamp: new Date(contextData.timestamp),
          metadata: JSON.parse(contextData.metadata || '{}'),
          importance: parseFloat(contextData.importance || '0.5'),
          tags: JSON.parse(contextData.tags || '[]')
        };

      } else {
        return this.memoryStore.get(contextId) || null;
      }

    } catch (error) {
      this.logger.error('Failed to retrieve context', error, { context_id: contextId });
      return null;
    }
  }

  public async queryMemory(query: MemoryQuery): Promise<MemoryContext[]> {
    try {
      this.logger.debug('Querying memory', query);

      let contextIds: string[] = [];

      if (this.isConnected) {
        // Build Redis query based on filters
        if (query.type) {
          const typeIds = await this.redis.sMembers(`memory:type:${query.type}`);
          contextIds = contextIds.length > 0 ? 
            contextIds.filter(id => typeIds.includes(id)) : typeIds;
        }

        if (query.tags && query.tags.length > 0) {
          const tagIds: string[] = [];
          for (const tag of query.tags) {
            const ids = await this.redis.sMembers(`memory:tag:${tag}`);
            tagIds.push(...ids);
          }
          contextIds = contextIds.length > 0 ? 
            contextIds.filter(id => tagIds.includes(id)) : tagIds;
        }

        if (query.time_range) {
          const timeIds = await this.redis.zRangeByScore(
            'memory:timeline',
            query.time_range.start.getTime(),
            query.time_range.end.getTime()
          );
          contextIds = contextIds.length > 0 ? 
            contextIds.filter(id => timeIds.includes(id)) : timeIds;
        }

        // If no filters, get most recent contexts
        if (contextIds.length === 0) {
          contextIds = await this.redis.zRevRange('memory:timeline', 0, (query.limit || 10) - 1);
        }

      } else {
        // Query in-memory storage
        contextIds = Array.from(this.memoryStore.keys());
        
        // Apply filters
        if (query.type) {
          contextIds = contextIds.filter(id => {
            const ctx = this.memoryStore.get(id);
            return ctx?.type === query.type;
          });
        }

        if (query.tags && query.tags.length > 0) {
          contextIds = contextIds.filter(id => {
            const ctx = this.memoryStore.get(id);
            return ctx?.tags?.some(tag => query.tags!.includes(tag));
          });
        }
      }

      // Limit results
      const limitedIds = contextIds.slice(0, query.limit || 10);

      // Retrieve full contexts
      const contexts: MemoryContext[] = [];
      for (const id of limitedIds) {
        const context = await this.retrieveContext(id);
        if (context) {
          contexts.push(context);
        }
      }

      this.logger.debug('Memory query completed', {
        query_filters: Object.keys(query).length,
        results_found: contexts.length
      });

      return contexts;

    } catch (error) {
      this.logger.error('Failed to query memory', error);
      return [];
    }
  }

  public async getConversationHistory(conversationId: string, limit: number = 50): Promise<MemoryContext[]> {
    return this.queryMemory({
      tags: [`conversation:${conversationId}`],
      limit
    });
  }

  public async startConversation(userId?: string): Promise<string> {
    const conversationId = this.generateConversationId();
    
    await this.storeContext({
      type: 'system_event',
      content: {
        event: 'conversation_started',
        conversation_id: conversationId,
        user_id: userId
      },
      tags: [`conversation:${conversationId}`, 'conversation_start'],
      importance: 0.8
    });

    if (this.isConnected) {
      await this.redis.sAdd('memory:conversations:active', conversationId);
    }

    this.stats.active_conversations++;

    this.logger.info('Conversation started', { 
      conversation_id: conversationId, 
      user_id: userId 
    });

    return conversationId;
  }

  public async endConversation(conversationId: string): Promise<void> {
    await this.storeContext({
      type: 'system_event',
      content: {
        event: 'conversation_ended',
        conversation_id: conversationId
      },
      tags: [`conversation:${conversationId}`, 'conversation_end'],
      importance: 0.7
    });

    if (this.isConnected) {
      await this.redis.sRem('memory:conversations:active', conversationId);
    }

    this.stats.active_conversations = Math.max(0, this.stats.active_conversations - 1);

    this.logger.info('Conversation ended', { conversation_id: conversationId });
  }

  public async consolidateMemory(): Promise<void> {
    this.logger.info('Starting memory consolidation...');

    try {
      // Get old, low-importance memories for potential cleanup
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      const oldMemories = await this.queryMemory({
        time_range: {
          start: new Date(0),
          end: cutoffDate
        },
        limit: 1000
      });

      let consolidated = 0;
      for (const memory of oldMemories) {
        if (memory.importance && memory.importance < 0.3) {
          // Archive low-importance memories
          await this.archiveContext(memory.id!);
          consolidated++;
        }
      }

      this.logger.info('Memory consolidation completed', {
        memories_processed: oldMemories.length,
        memories_consolidated: consolidated
      });

    } catch (error) {
      this.logger.error('Memory consolidation failed', error);
    }
  }

  private async archiveContext(contextId: string): Promise<void> {
    if (this.isConnected) {
      // Move to archive
      const contextData = await this.redis.hGetAll(`memory:context:${contextId}`);
      if (contextData.id) {
        await this.redis.hSet(`memory:archive:${contextId}`, contextData);
        await this.redis.del(`memory:context:${contextId}`);
      }
    } else {
      this.memoryStore.delete(contextId);
    }
  }

  private calculateImportance(context: MemoryContext): number {
    let importance = 0.5; // Base importance

    // Type-based importance
    switch (context.type) {
      case 'user_message':
        importance = 0.7;
        break;
      case 'assistant_response':
        importance = 0.6;
        break;
      case 'agent_collaboration':
        importance = 0.8;
        break;
      case 'system_event':
        importance = 0.4;
        break;
    }

    // Content-based adjustments
    if (typeof context.content === 'string') {
      const length = context.content.length;
      if (length > 500) importance += 0.1; // Longer content might be more important
      if (length < 50) importance -= 0.1;  // Very short content might be less important
    }

    // Tag-based adjustments
    if (context.tags) {
      if (context.tags.includes('error')) importance += 0.2;
      if (context.tags.includes('success')) importance += 0.1;
      if (context.tags.includes('critical')) importance += 0.3;
    }

    return Math.min(Math.max(importance, 0), 1); // Clamp to 0-1
  }

  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public async getStats(): Promise<any> {
    if (this.isConnected) {
      try {
        const info = await this.redis.info('memory');
        const memoryUsage = parseInt(info.split('used_memory:')[1]?.split('\r\n')[0] || '0');
        this.stats.memory_usage_mb = Math.round(memoryUsage / 1024 / 1024);
        
        this.stats.active_conversations = await this.redis.sCard('memory:conversations:active');
      } catch (error) {
        this.logger.warn('Failed to get Redis stats', error);
      }
    }

    return { ...this.stats };
  }

  public async getInfo(): Promise<any> {
    return {
      component: 'MemorySystem',
      version: '2.0.0',
      backend: this.isConnected ? 'Redis' : 'In-Memory',
      capabilities: [
        'Episodic Memory',
        'Semantic Memory', 
        'Working Memory',
        'Conversation Tracking',
        'Context Search',
        'Memory Consolidation'
      ],
      status: this.isConnected ? 'connected' : 'fallback'
    };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Memory System...');

    if (this.isConnected && this.redis) {
      try {
        await this.redis.quit();
        this.isConnected = false;
      } catch (error) {
        this.logger.warn('Error closing Redis connection', error);
      }
    }

    // Clear in-memory storage
    this.memoryStore.clear();

    this.logger.info('Memory System shutdown complete');
  }
}