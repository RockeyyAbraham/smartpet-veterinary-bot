# SmartPet-HybridRAG-Triage

> **Advanced Veterinary Triage Assistant powered by Hybrid RAG, Graph Retrieval, and a custom fine-tuned embedding model.**

This repository contains the text-processing and Retrieval-Augmented Generation (RAG) backend for **SmartPet AI**, designed to provide highly accurate, breed-specific symptom guidance. 

By combining semantic vector search (FAISS), exact lexical matching (BM25) via Reciprocal Rank Fusion (RRF), and knowledge graph traversals (Neo4j), this system ensures that veterinary advice is grounded in exact medical literature and the specific pet's profile.

---

## 🌟 Key Features & Architecture

* **Hybrid RAG Pipeline (RRF):** Merges dense vector retrieval (FAISS) with sparse lexical retrieval (BM25) to capture both semantic meaning ("wobbly legs") and exact terminology ("Dachshund IVDD").
* **Knowledge Graph Retrieval (GraphRAG):** Uses a Neo4j graph database to map complex relationships between breeds, symptoms, and conditions, acting as an additional high-precision retrieval mechanism.
* **Custom Fine-Tuned Embedding Model:** We utilize a custom-trained `all-MiniLM-L6-v2` model, fine-tuned specifically on canine veterinary data and dog breeds. The model is exported to ONNX format and runs entirely locally/in-memory using `@huggingface/transformers`.
* **Rigorous Evaluation Framework:** Includes a custom, comprehensive evaluation suite measuring Precision@K, Recall@K, MRR, and NDCG@K across 6 different retrieval strategies, backed by the Wilcoxon Signed-Rank Test for statistical significance.
* **LLM Integration:** Utilizes Groq (LLaMA-3) for lightning-fast entity extraction and final response synthesis.

---

## 🏆 Credits & Acknowledgements

While the architecture, RAG pipelines, and evaluation framework were engineered in this repository, the **custom embedding model is the foundation of our semantic search**.

Special thanks and professional credit to **Christo Philip**, who single-handedly researched, curated the veterinary dataset, and trained our custom breed-specific `all-MiniLM-L6-v2` embedding model. The high NDCG scores achieved in semantic retrieval are a direct result of his model fine-tuning.

---

## 📊 Retrieval Evaluation Results

We conducted a rigorous evaluation across 65 ground-truth veterinary queries to determine the optimal retrieval strategy for production.

| Method | Precision@5 | Recall@5 | MRR | NDCG@5 | Latency |
|---|---|---|---|---|---|
| FAISS | 0.2185 | 0.6615 | 0.5992 | 0.5922 | ~9ms |
| BM25 | 0.3169 | 0.9064 | 0.8800 | 0.8782 | ~125ms |
| HNSW | 0.2185 | 0.6615 | 0.5992 | 0.5922 | ~144ms |
| **Hybrid (FAISS+BM25)** | 0.2892 | 0.8538 | 0.8054 | 0.7803 | ~137ms |
| Rerank (FAISS+Cohere)| 0.2185 | 0.6692 | 0.6615 | 0.6159 | ~755ms |
| GraphRAG (Neo4j) | 0.1723 | 0.5590 | 0.6985 | 0.5629 | ~1670ms |

### Evaluation Conclusion
* **BM25** scored exceptionally well due to the dataset's reliance on exact breed names (e.g., "Beagle epilepsy").
* **FAISS** provides crucial fallback semantic understanding for vague, non-breed-specific queries (e.g., "my dog has wobbly legs").
* **Production Decision:** We implemented the **Hybrid (FAISS+BM25)** approach using Reciprocal Rank Fusion (RRF). This provides the most robust real-world performance, seamlessly bridging the gap between exact medical terminology and colloquial user input.
* **GraphRAG** achieved the highest Mean Reciprocal Rank (MRR) among non-keyword methods, proving its ability to position the exact correct diagnosis at Rank 1.

---

## ⚙️ Tech Stack

* **Backend:** Node.js, Express
* **Databases:** Supabase (PostgreSQL + pgvector for BM25/FAISS), Neo4j (Graph DB)
* **Local Inference:** `@huggingface/transformers` (ONNX runtime for embeddings)
* **LLM Provider:** Groq (`llama-3.3-70b-versatile`)
* **Version Control:** Git LFS (for large ONNX and safetensor model weights)

---

## 📂 Repository Structure

* `database/` - SQL scripts for setting up BM25 GIN indexes and pgvector schemas.
* `scripts/` - Ingestion scripts to populate Supabase and Neo4j from JSON datasets.
* `services/all-MiniLM-L6-v2-dog-breed-retriever/` - **Christo Philip's custom fine-tuned embedding model** (tracked via Git LFS).
* `services/evaluation/` - The comprehensive evaluation suite comparing FAISS, BM25, HNSW, Hybrid, Rerank, and GraphRAG.
* `services/retrieval/` - Modules for each individual retrieval algorithm.
* `server.js` - The main Express application serving the production Hybrid RAG endpoint.

---

## 🚀 SmartPet AI Ecosystem Context

SmartPet AI is envisioned as a comprehensive, multi-service pet health platform. This repository houses the standalone **Veterinary Triage Chatbot** component. It is designed with modularity in mind, ensuring seamless integration with future microservices, user profile databases, and broader platform features as the ecosystem expands.
