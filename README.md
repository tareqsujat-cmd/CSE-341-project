# Banking System

A small banking-management project implemented in 8086 assembly, with a browser-based interface for trying the banking workflows interactively.

## Live demo

Open the deployed app at [cse-341-banking-demo.vercel.app](https://cse-341-banking-demo.vercel.app/).

## Run the browser app

No package installation or build step is required. From the project folder, start a local static web server:

```powershell
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in a browser. To stop the server, press `Ctrl+C` in PowerShell.

The app supports account creation, deposits, withdrawals, transfers, transaction history, undoing the latest transaction, interest, and account statements. It stores accounts in the browser's `localStorage`, so data remains after reloads in the same browser profile. Use the browser's site-data controls to clear the demo.

## Important demo limitations

- This is a local educational demo, not real banking software. It has no server, encryption, authentication system, or multi-user access.
- PINs and balances are stored in browser-local storage. Do not use real financial information or a PIN used elsewhere.
- The app keeps the original five-account limit and 16-bit maximum balance of BDT 65,535. Transaction history is retained locally so the browser version can support undo.
- The 8086 assembly sources are separate and still intended for an 8086 assembler/emulator.

## Test the banking rules

With Node.js installed, run the built-in tests without installing dependencies:

```powershell
node --test tests\banking.test.cjs
```

See [BANKING_SYSTEM_DOCUMENTATION.md](./BANKING_SYSTEM_DOCUMENTATION.md) for the assembly project documentation.
