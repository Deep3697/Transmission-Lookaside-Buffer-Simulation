# Operating System Memory Management - Visual Simulations

This repository contains a suite of interactive simulations designed to teach core Operating System memory management concepts. The simulations provide a step-by-step visual walkthrough of hardware and software interactions, performance calculations, and replacement algorithms.

## 🚀 Simulations Included

### 🧠 1. Translation Lookaside Buffer (TLB)
Visualizes how the CPU uses a high-speed hardware cache (TLB) to accelerate virtual-to-physical address translation.
- **Core Functionality**:
    - **Step-by-Step Translation**: Watch the CPU split a logical address into Page Number and Offset.
    - **TLB Hit/Miss Logic**: Simulates the initial search in the TLB followed by a fallback to the Page Table in RAM on a miss.
    - **TLB Persistence**: Uses LRU (Least Recently Used) replacement to maintain hot translations across simulation runs.
    - **Performance Analysis**: Calculates the **Effective Access Time (EAT)** using hit ratio, TLB speed (C), and RAM speed (M).

### 📋 2. Paging & Demand Paging
Demonstrates how the OS manages memory as fixed-size pages and frames, including the process of handling page faults.
- **Core Functionality**:
    - **Logical to Physical Mapping**: Shows the exact mathematical split of an address and its resolution through the Page Table.
    - **Page Fault Handling**: Simulates the OS detecting an invalid page and retrieving it from the **Hard Drive** to place it into **RAM**.
    - **Replacement Algorithms**: Allows users to choose between **FIFO** (First-In, First-Out) and **LRU** (Least Recently Used) for evicting pages when RAM is full.
    - **Hardware Visualization**: Features a dedicated Hard Drive component and a persistent Page Table that updates dynamically.

### ⚡ 3. Cache Memory
Explores the fundamental speed gap between the CPU and Main RAM by introducing a tiny, ultra-fast Cache layer.
- **Core Functionality**:
    - **Cache Hit/Miss Cycles**: Visualizes the CPU checking the cache spice rack before walking to the RAM basement pantry.
    - **Dynamic Slot Reordering**: Watch cache slots shift in real-time based on the selected eviction policy.
    - **Eviction Policies**: Choose between **LRU** (recency-based) and **FIFO** (load-time-based) to manage limited cache slots.
    - **Statistics & Summary**: Provides a clear performance summary including Hit Ratio and Average Access time calculation at the end of every run.

## 🛠️ Tech Stack
- **Frontend**: React (Hooks, Refs, SVG for dynamic routing)
- **Styling**: Vanilla CSS (Sci-Fi / Diagnostic UI theme)
- **State Management**: React State + SessionStorage for cross-run persistence.

## 🏃 How to Run
1. Clone the repository.
2. Navigate to the `Client` directory.
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`
5. Switch between simulations using the **⋮ Menu** in the top-right corner.
