🌾 AgroMart: Weather-Aware Agricultural E-commerce Database with Data Provenance

📌 Project Overview
**AgroMart** is an advanced, active database system designed for an agricultural supply chain e-commerce platform. Built with PostgreSQL, this project focuses heavily on **Data Provenance**, enabling the system to automatically track the *Why*, *Where*, and *How* of data evolution. 

Unlike traditional e-commerce databases, AgroMart dynamically responds to real-world variables such as **weather events** (cyclones, floods) and **cold-chain logistics** (IoT sensor data) to autonomously manage pricing, track financial losses, and record a complete audit trail.

## 🚀 Key Innovations & Features

* **🌪️ Weather-Aware Dynamic Pricing:** Uses Event-Condition-Action (ECA) triggers to automatically adjust product prices and calculate delays based on local weather severity.
* **⛓️ Data Provenance Tracking:** Fully implements data lineage using recursive relationships to track exactly why a change happened, where a product originated, and how an order evolved.
* **🌡️ IoT Cold-Chain Monitoring:** Includes a `monitoring_sensor` table with PL/pgSQL functions to calculate heat loads, detect temperature breaches, and predict food spoilage in transit.
* **📉 Automated Financial Loss Recovery:** Dynamically calculates loss amounts from spoiled goods and suggests new price percentages to recover the deficit.
* **🛡️ Robust Audit Logging:** Append-only audit tables that capture every state transition and price manipulation with automated metadata injection.

## 🔍 The Provenance Architecture

This database is engineered to answer three core provenance questions:

1.  **Why-Provenance (`audit_price_change`):** Why did the price of rice increase? The database links the price hike directly to specific weather events or spoilage records, logging the exact rationale.
2.  **Where-Provenance (`order_item` & `farmer`):** Where did this specific batch of tomatoes come from? The schema traces every item back to its origin district and specific farmer.
3.  **How-Provenance (`audit_order_history` & `provenance_event`):** How did an order reach its final state? A Directed Acyclic Graph (DAG) is maintained using a self-referencing `caused_by_event_id` to build a chain of events (e.g., *Weather Alert -> Shipment Delayed -> Goods Spoiled -> Price Increased*).

## 🗄️ Core Database Schema

The system consists of **15 interconnected tables** categorized into three layers:
* **Entity Layer:** `farmer`, `product`, `district`, `warehouse`, `vehicle`
* **Transactional Layer:** `purchase_order`, `order_item`, `shipment`, `food_spoilage`, `monitoring_sensor`
* **Provenance & Audit Layer:** `weather_event`, `audit_price_change`, `audit_order_history`, `provenance_event`

## 💻 Tech Stack
* **Database Engine:** PostgreSQL 14+
* **Scripting:** PL/pgSQL (Complex Functions, Triggers, Recursive Queries)
* **Extensions:** `uuid-ossp` (for robust primary key generation)

## 🛠️ How to Run / Installation

1. Ensure you have **PostgreSQL** installed and running.
2. Create a new empty database (e.g., `agromart_db`).
3. Clone this repository:
   ```bash
   git clone [https://github.com/your-username/agromart-database.git](https://github.com/your-username/agromart-database.git)
