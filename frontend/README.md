# CSNU Sanctions Checker

A web app that lets users verify whether a name appears in the UN Security Council Consolidated Sanctions List (CSNU). Each search is paid with 0.1 USDC via an ERC-8183 escrow job on Arc Testnet.

Built with [Arc Studio](https://studio.arc.io)

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion
- Web3: wagmi v2, viem v2, ConnectKit
- Backend: Python FastAPI + Uvicorn
- Data: CSNU list in Parquet format (pandas + pyarrow)
- Payments: ERC-8183 Agentic Commerce on Arc Testnet (USDC escrow)
- Chain: Arc Testnet (Chain ID: 5042002)
- Token: USDC (6 decimals, Address: 0x3600000000000000000000000000000000000000)

## How It Works

1. Connect a wallet (MetaMask or injected)
2. Pay 0.1 USDC — creates and funds an ERC-8183 escrow job on Arc Testnet
3. Enter names (one per line) and verify against the CSNU sanctions list
4. Each name shows a clear sanctioned / not found status

## Environment Variables

None required. All chain addresses are public constants in source.

## Development

### Prerequisites

- Bun (JavaScript)
- Python 3.13+

### Install

```bash
bun install
pip install fastapi uvicorn pandas pyarrow --break-system-packages
```

### Run

Start the Python backend (port 3001):
```bash
cd sancoes-csnu-arc && python3 -m uvicorn main:app --host 127.0.0.1 --port 3001
```

Start the frontend (port 5173, proxies /api to port 3001):
```bash
bun run dev
```

### Check (lint + typecheck)

```bash
bun run check
```
