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

* n8n
* Supabase Vector Store
* Google Gemini Embeddings
* Groq LLM
* Node.js (planned implementation)

## Current Workflow

```text
User Message
      ↓
AI Agent
      ↓
Supabase Vector Search
      ↓
Pet Profile Retrieval
      ↓
LLM Response
```

The chatbot retrieves relevant pet profile information and uses it as context when responding to user-reported symptoms.

## Current Status

### Completed

* Pet profile ingestion
* Vector embedding generation
* Supabase vector storage
* Retrieval pipeline
* AI agent integration
* Memory integration
* End-to-end RAG workflow

### In Progress

* Prompt refinement
* Context handling improvements
* Model evaluation
* Node.js implementation

## Future Improvements

* Improved symptom reasoning
* Better context management
* Veterinary knowledge base integration
* Express.js API implementation
* Production deployment

## Notes

This repository represents the veterinary chatbot component only and is intended to integrate with the larger SmartPet AI ecosystem.
