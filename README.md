# SmartPet Veterinary Bot

A veterinary triage assistant developed as part of the SmartPet AI project.

This repository contains the text-processing and RAG component responsible for generating personalized symptom guidance based on a pet's profile and user-reported symptoms.

## Project Context

SmartPet AI is a multi-service pet health platform consisting of:

* Veterinary Triage Chatbot (Text/RAG)
* Skin & Eye Scanner (Image Analysis)
* Motion Scanner (Video Analysis)
* Personalized Nutrition Engine
* E-Commerce Integration

This repository focuses only on the Veterinary Triage Chatbot component.

## My Responsibility

Role: ML Engineer – Text/RAG

Responsibilities:

* Design and implement the veterinary chatbot workflow.
* Build the Retrieval-Augmented Generation (RAG) pipeline.
* Integrate pet profile retrieval.
* Connect vector search with LLM-based responses.
* Provide symptom-focused guidance using pet-specific context.

## Current Stack

* Node.js + Express
* Supabase pgvector (vector database)
* Google Gemini gemini-embedding-001 (embeddings)
* Groq llama-3.3-70b-versatile (LLM)
* n8n (used for prototyping, workflow exported as flow.json)

## Current Workflow

```text
POST /api/chat
      ↓
Input Validation
      ↓
Load Conversation History
      ↓
Gemini Embedding
      ↓
Supabase Vector Search (filtered by petId)
      ↓
Build Prompt
      ↓
Groq LLM
      ↓
Save to Memory
      ↓
Return Response
```

The chatbot retrieves relevant pet profile information and uses it as context when responding to user-reported symptoms.

## Current Status

### Completed

* Pet profile ingestion via POST /api/ingest
* Vector embedding generation
* Supabase vector storage with pgvector
* Retrieval pipeline with petId filtering
* Conversation memory (in-memory, per sessionId)
* Input validation with 400 error responses
* Full error handling with 500 responses
* Service separation (supabaseService, llmService, memoryService, ingestionService)
* Node.js Express implementation

### In Progress

* Testing
* Integration with Richard's MongoDB backend
* Prompt refinement based on real user testing

## Future Improvements

* Persistent conversation history (Redis/MongoDB)
* Auto-ingest from MongoDB on pet profile creation
* Veterinary knowledge base integration
* Production deployment

## Notes

This repository represents the veterinary chatbot component only and is intended to integrate with the larger SmartPet AI ecosystem.
