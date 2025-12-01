/**
 * RAG (Retrieval-Augmented Generation) System
 * Advanced document retrieval and knowledge integration
 */

import { Logger } from '../../utils/logger';
import { OpenAI } from 'openai';

export interface Document {
  id: string;
  content: string;
  metadata: {
    title?: string;
    source?: string;
    author?: string;
    created_at?: Date;
    tags?: string[];
    chunk_index?: number;
    total_chunks?: number;
  };
  embedding?: number[];
}

export interface QueryRequest {
  query: string;
  collection?: string;
  top_k?: number;
  include_metadata?: boolean;
  filter?: Record<string, any>;
  rerank?: boolean;
}

export interface QueryResult {
  query: string;
  documents: Document[];
  scores: number[];
  generated_response: string;
  sources: string[];
  processing_time: number;
  retrieval_time: number;
  generation_time: number;
}

export interface IndexingRequest {
  documents: Document[];
  collection: string;
  chunk_size?: number;
  chunk_overlap?: number;
  update_existing?: boolean;
}

export class RAGSystem {
  private logger: Logger;
  private openai: OpenAI;
  private vectorStore: Map<string, Document[]> = new Map(); // Simple in-memory store
  private embeddings: Map<string, number[]> = new Map();
  private stats: {
    total_documents: number;
    total_queries: number;
    avg_retrieval_time: number;
    avg_generation_time: number;
  };

  constructor() {
    this.logger = new Logger('RAGSystem');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.stats = {
      total_documents: 0,
      total_queries: 0,
      avg_retrieval_time: 100,
      avg_generation_time: 2000
    };
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing RAG System...');

    try {
      // Test OpenAI embeddings API
      await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'test embedding'
      });

      // Initialize default collections
      await this.initializeDefaultCollections();

      this.logger.info('RAG System initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize RAG System', error);
      throw error;
    }
  }

  private async initializeDefaultCollections(): Promise<void> {
    const collections = ['general', 'technical', 'business'];
    
    for (const collection of collections) {
      this.vectorStore.set(collection, []);
    }

    // Add some sample documents
    await this.indexSampleDocuments();
  }

  private async indexSampleDocuments(): Promise<void> {
    const sampleDocs: Document[] = [
      {
        id: 'doc_1',
        content: 'Artificial General Intelligence (AGI) represents the theoretical ability of an AI system to understand, learn, and apply knowledge across a wide range of domains at a level comparable to human intelligence.',
        metadata: {
          title: 'Introduction to AGI',
          source: 'AI Research Papers',
          tags: ['AGI', 'artificial intelligence', 'machine learning']
        }
      },
      {
        id: 'doc_2',
        content: 'Chain-of-Thought prompting is a technique that enables large language models to perform complex reasoning by breaking down problems into intermediate steps.',
        metadata: {
          title: 'Chain-of-Thought Reasoning',
          source: 'Prompt Engineering Guide',
          tags: ['prompting', 'reasoning', 'LLM']
        }
      },
      {
        id: 'doc_3',
        content: 'Multi-agent systems coordinate multiple autonomous agents to solve complex problems that are beyond the capability of individual agents.',
        metadata: {
          title: 'Multi-Agent Systems',
          source: 'Distributed AI',
          tags: ['multi-agent', 'coordination', 'distributed systems']
        }
      },
      {
        id: 'doc_4',
        content: 'Constitutional AI involves training AI systems to follow a set of principles or constitution to ensure helpful, harmless, and honest behavior.',
        metadata: {
          title: 'Constitutional AI Principles',
          source: 'AI Safety Research',
          tags: ['constitutional AI', 'safety', 'alignment']
        }
      }
    ];

    await this.indexDocuments({
      documents: sampleDocs,
      collection: 'general'
    });

    this.logger.info('Sample documents indexed', { count: sampleDocs.length });
  }

  public async indexDocuments(request: IndexingRequest): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info('Indexing documents', {
        collection: request.collection,
        document_count: request.documents.length
      });

      const collection = request.collection || 'general';
      
      // Get or create collection
      let documents = this.vectorStore.get(collection) || [];

      for (const doc of request.documents) {
        // Chunk document if needed
        const chunks = request.chunk_size ? 
          this.chunkDocument(doc, request.chunk_size, request.chunk_overlap || 0) : 
          [doc];

        for (const chunk of chunks) {
          // Generate embedding
          chunk.embedding = await this.generateEmbedding(chunk.content);
          
          // Store embedding separately for efficient retrieval
          this.embeddings.set(chunk.id, chunk.embedding);

          // Add to collection (or update if exists)
          if (request.update_existing) {
            const existingIndex = documents.findIndex(d => d.id === chunk.id);
            if (existingIndex >= 0) {
              documents[existingIndex] = chunk;
            } else {
              documents.push(chunk);
            }
          } else {
            documents.push(chunk);
          }

          this.stats.total_documents++;
        }
      }

      this.vectorStore.set(collection, documents);

      const processingTime = Date.now() - startTime;
      this.logger.info('Documents indexed successfully', {
        collection,
        documents_processed: request.documents.length,
        processing_time: processingTime
      });

    } catch (error) {
      this.logger.error('Failed to index documents', error);
      throw error;
    }
  }

  public async query(request: QueryRequest): Promise<QueryResult> {
    const startTime = Date.now();
    this.stats.total_queries++;

    try {
      this.logger.debug('Processing RAG query', {
        query: request.query.substring(0, 100),
        collection: request.collection,
        top_k: request.top_k
      });

      // Step 1: Generate query embedding
      const queryEmbedding = await this.generateEmbedding(request.query);
      const retrievalStart = Date.now();

      // Step 2: Retrieve relevant documents
      const retrievedDocs = await this.retrieveDocuments(
        queryEmbedding,
        request.collection || 'general',
        request.top_k || 5,
        request.filter
      );

      const retrievalTime = Date.now() - retrievalStart;

      // Step 3: Rerank if requested
      const finalDocs = request.rerank ? 
        await this.rerankDocuments(request.query, retrievedDocs.documents) :
        retrievedDocs.documents;

      // Step 4: Generate response
      const generationStart = Date.now();
      const generatedResponse = await this.generateResponse(request.query, finalDocs);
      const generationTime = Date.now() - generationStart;

      // Step 5: Extract sources
      const sources = this.extractSources(finalDocs);

      const totalTime = Date.now() - startTime;

      // Update statistics
      this.updateStats(retrievalTime, generationTime);

      const result: QueryResult = {
        query: request.query,
        documents: request.include_metadata ? finalDocs : finalDocs.map(d => ({ ...d, metadata: {} })),
        scores: retrievedDocs.scores,
        generated_response: generatedResponse,
        sources,
        processing_time: totalTime,
        retrieval_time: retrievalTime,
        generation_time: generationTime
      };

      this.logger.info('RAG query completed', {
        retrieval_time: retrievalTime,
        generation_time: generationTime,
        total_time: totalTime,
        documents_retrieved: finalDocs.length
      });

      return result;

    } catch (error) {
      this.logger.error('RAG query failed', error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000) // Truncate to avoid token limits
      });

      return response.data[0].embedding;

    } catch (error) {
      this.logger.error('Failed to generate embedding', error);
      throw error;
    }
  }

  private async retrieveDocuments(
    queryEmbedding: number[],
    collection: string,
    topK: number,
    filter?: Record<string, any>
  ): Promise<{ documents: Document[], scores: number[] }> {
    
    const documents = this.vectorStore.get(collection) || [];
    
    if (documents.length === 0) {
      return { documents: [], scores: [] };
    }

    // Calculate similarity scores
    const similarities: { document: Document, score: number }[] = [];

    for (const doc of documents) {
      // Apply filters if provided
      if (filter && !this.matchesFilter(doc, filter)) {
        continue;
      }

      if (doc.embedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
        similarities.push({ document: doc, score: similarity });
      }
    }

    // Sort by similarity and take top K
    similarities.sort((a, b) => b.score - a.score);
    const topSimilarities = similarities.slice(0, topK);

    return {
      documents: topSimilarities.map(s => s.document),
      scores: topSimilarities.map(s => s.score)
    };
  }

  private async rerankDocuments(query: string, documents: Document[]): Promise<Document[]> {
    // Simple reranking based on keyword overlap
    // In production, this would use a more sophisticated reranking model
    
    const queryTokens = query.toLowerCase().split(/\s+/);
    
    const rankedDocs = documents.map(doc => {
      const docTokens = doc.content.toLowerCase().split(/\s+/);
      const overlap = queryTokens.filter(token => docTokens.includes(token)).length;
      const score = overlap / queryTokens.length;
      
      return { document: doc, score };
    });

    rankedDocs.sort((a, b) => b.score - a.score);
    return rankedDocs.map(item => item.document);
  }

  private async generateResponse(query: string, documents: Document[]): Promise<string> {
    if (documents.length === 0) {
      return "I don't have enough information to answer your question accurately.";
    }

    const context = documents
      .map((doc, index) => `[${index + 1}] ${doc.content}`)
      .join('\n\n');

    const prompt = `Based on the following context documents, please provide a comprehensive and accurate answer to the user's question. If the context doesn't contain enough information to fully answer the question, please say so.

Context Documents:
${context}

Question: ${query}

Please provide a detailed answer based on the context above, and cite the relevant document numbers [1], [2], etc. when appropriate.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant that provides accurate answers based on the provided context documents. Always cite your sources using document numbers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    return completion.choices[0].message.content || 'Unable to generate response';
  }

  private chunkDocument(doc: Document, chunkSize: number, overlap: number): Document[] {
    const words = doc.content.split(/\s+/);
    const chunks: Document[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkContent = chunkWords.join(' ');
      
      const chunk: Document = {
        id: `${doc.id}_chunk_${Math.floor(i / (chunkSize - overlap))}`,
        content: chunkContent,
        metadata: {
          ...doc.metadata,
          chunk_index: Math.floor(i / (chunkSize - overlap)),
          total_chunks: Math.ceil(words.length / (chunkSize - overlap))
        }
      };
      
      chunks.push(chunk);
    }

    return chunks;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private matchesFilter(doc: Document, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const docValue = (doc.metadata as any)[key];
      
      if (Array.isArray(value)) {
        if (!value.includes(docValue)) return false;
      } else if (typeof value === 'string') {
        if (docValue !== value) return false;
      } else if (typeof value === 'object' && value.$in) {
        if (!value.$in.includes(docValue)) return false;
      }
    }
    
    return true;
  }

  private extractSources(documents: Document[]): string[] {
    const sources = new Set<string>();
    
    for (const doc of documents) {
      if (doc.metadata.source) {
        sources.add(doc.metadata.source);
      }
      if (doc.metadata.title) {
        sources.add(doc.metadata.title);
      }
    }

    return Array.from(sources);
  }

  private updateStats(retrievalTime: number, generationTime: number): void {
    const total = this.stats.total_queries;
    
    this.stats.avg_retrieval_time = ((this.stats.avg_retrieval_time * (total - 1)) + retrievalTime) / total;
    this.stats.avg_generation_time = ((this.stats.avg_generation_time * (total - 1)) + generationTime) / total;
  }

  public async getCollections(): Promise<string[]> {
    return Array.from(this.vectorStore.keys());
  }

  public async getCollectionStats(collection: string): Promise<any> {
    const documents = this.vectorStore.get(collection) || [];
    
    return {
      collection,
      document_count: documents.length,
      total_chunks: documents.filter(d => d.metadata.chunk_index !== undefined).length,
      sources: new Set(documents.map(d => d.metadata.source).filter(Boolean)).size,
      avg_content_length: documents.length > 0 ? 
        documents.reduce((sum, d) => sum + d.content.length, 0) / documents.length : 0
    };
  }

  public async deleteCollection(collection: string): Promise<void> {
    if (this.vectorStore.has(collection)) {
      const documents = this.vectorStore.get(collection) || [];
      
      // Remove embeddings
      for (const doc of documents) {
        this.embeddings.delete(doc.id);
      }
      
      // Remove collection
      this.vectorStore.delete(collection);
      
      this.logger.info('Collection deleted', { 
        collection, 
        documents_removed: documents.length 
      });
    }
  }

  public async getInfo(): Promise<any> {
    const collections = await this.getCollections();
    const collectionStats = await Promise.all(
      collections.map(c => this.getCollectionStats(c))
    );

    return {
      component: 'RAGSystem',
      version: '2.0.0',
      embedding_model: 'text-embedding-3-small',
      generation_model: 'gpt-4',
      collections: collections.length,
      collection_details: collectionStats,
      capabilities: [
        'Document Indexing',
        'Semantic Search',
        'Context-Aware Generation',
        'Source Citation',
        'Document Reranking',
        'Multi-Collection Support'
      ],
      status: 'active'
    };
  }

  public async getStats(): Promise<any> {
    return { ...this.stats };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down RAG System...');
    
    // Clear in-memory stores
    this.vectorStore.clear();
    this.embeddings.clear();
    
    this.logger.info('RAG System shutdown complete');
  }
}