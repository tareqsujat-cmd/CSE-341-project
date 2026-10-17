(function (root) {
    "use strict";

    const MAX_ACCOUNTS = 5;
    const MAX_BALANCE = 65535;
    const STORAGE_KEY = "cse341-banking-demo-v1";

    function fail(message) {
        throw new Error(message);
    }

    function amount(value, label, allowZero) {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < (allowZero ? 0 : 1) || parsed > MAX_BALANCE) {
            fail(`${label} must be a whole BDT amount between ${allowZero ? 0 : 1} and ${MAX_BALANCE}.`);
        }
        return parsed;
    }

    function findAccount(state, id) {
        const account = state.accounts.find((item) => item.id === Number(id));
        if (!account) {
            fail("That account could not be found.");
        }
        return account;
    }

    function requirePin(account, pin) {
        if (!/^\d{4,8}$/.test(String(pin)) || account.pin !== String(pin)) {
            fail("Incorrect PIN. Please check it and try again.");
        }
    }

    function record(account, type, value, balanceBefore, relatedAccountId, groupId) {
        account.transactions.push({
            id: cryptoId(),
            type,
            amount: value,
            balanceBefore,
            relatedAccountId: relatedAccountId || null,
            groupId: groupId || null,
            createdAt: new Date().toISOString()
        });
    }

    function cryptoId() {
        if (root.crypto && typeof root.crypto.randomUUID === "function") {
            return root.crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function validateState(state) {
        if (!state || !Array.isArray(state.accounts) || !Number.isSafeInteger(state.nextAccountId)) {
            fail("Saved banking data has an invalid format. It was not changed.");
        }
        if (state.accounts.length > MAX_ACCOUNTS) {
            fail("Saved data contains more accounts than this demo supports.");
        }
        const ids = new Set();
        for (const account of state.accounts) {
            if (!Number.isSafeInteger(account.id) || ids.has(account.id) ||
                typeof account.name !== "string" || typeof account.pin !== "string" ||
                !/^\d{4,8}$/.test(account.pin) ||
                !Number.isSafeInteger(account.balance) || account.balance < 0 ||
                account.balance > MAX_BALANCE || !Array.isArray(account.transactions)) {
                fail("Saved banking data contains an invalid account. It was not changed.");
            }
            ids.add(account.id);
            for (const transaction of account.transactions) {
                if (typeof transaction.id !== "string" ||
                    !Number.isSafeInteger(transaction.amount) || transaction.amount < 0 ||
                    !Number.isSafeInteger(transaction.balanceBefore) ||
                    typeof transaction.createdAt !== "string") {
                    fail("Saved banking data contains an invalid transaction. It was not changed.");
                }
            }
        }
        if (state.accounts.some((account) => account.id >= state.nextAccountId)) {
            fail("Saved banking data contains an invalid next account number.");
        }
    }

    class BankingStore {
        constructor(storage) {
            this.storage = storage || null;
            this.state = { nextAccountId: 1001, accounts: [] };
            if (this.storage) {
                const saved = this.storage.getItem(STORAGE_KEY);
                if (saved !== null) {
                    try {
                        this.state = JSON.parse(saved);
                    } catch (error) {
                        fail(`Saved banking data could not be read: ${error.message}`);
                    }
                }
            }
            validateState(this.state);
        }

        snapshot() {
            return JSON.parse(JSON.stringify(this.state));
        }

        update(change) {
            const next = this.snapshot();
            const result = change(next);
            validateState(next);
            if (this.storage) {
                this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
            }
            this.state = next;
            return result;
        }

        createAccount({ name, pin, initialBalance }) {
            const normalizedName = String(name || "").trim();
            const normalizedPin = String(pin || "");
            if (!normalizedName || normalizedName.length > 60) {
                fail("Enter an account holder name of 1 to 60 characters.");
            }
            if (!/^\d{4,8}$/.test(normalizedPin)) {
                fail("PIN must contain 4 to 8 digits.");
            }
            const openingBalance = amount(initialBalance, "Opening balance", true);
            return this.update((state) => {
                if (state.accounts.length >= MAX_ACCOUNTS) {
                    fail(`This demo supports up to ${MAX_ACCOUNTS} accounts.`);
                }
                const account = {
                    id: state.nextAccountId,
                    name: normalizedName,
                    pin: normalizedPin,
                    balance: openingBalance,
                    transactions: []
                };
                state.accounts.push(account);
                state.nextAccountId += 1;
                return account.id;
            });
        }

        deposit({ accountId, pin, value }) {
            const depositAmount = amount(value, "Deposit amount", false);
            return this.update((state) => {
                const account = findAccount(state, accountId);
                requirePin(account, pin);
                if (account.balance + depositAmount > MAX_BALANCE) {
                    fail(`The resulting balance cannot exceed ${MAX_BALANCE} BDT.`);
                }
                const before = account.balance;
                account.balance += depositAmount;
                record(account, "deposit", depositAmount, before);
                return account.balance;
            });
        }

        withdraw({ accountId, pin, value }) {
            const withdrawal = amount(value, "Withdrawal amount", false);
            return this.update((state) => {
                const account = findAccount(state, accountId);
                requirePin(account, pin);
                if (withdrawal > account.balance) {
                    fail("Insufficient balance for this withdrawal.");
                }
                const before = account.balance;
                account.balance -= withdrawal;
                record(account, "withdrawal", withdrawal, before);
                return account.balance;
            });
        }

        transfer({ fromId, toId, pin, value }) {
            const transferAmount = amount(value, "Transfer amount", false);
            return this.update((state) => {
                const source = findAccount(state, fromId);
                const destination = findAccount(state, toId);
                if (source.id === destination.id) {
                    fail("Choose a different destination account.");
                }
                requirePin(source, pin);
                if (transferAmount > source.balance) {
                    fail("Insufficient balance for this transfer.");
                }
                if (destination.balance + transferAmount > MAX_BALANCE) {
                    fail(`The destination balance cannot exceed ${MAX_BALANCE} BDT.`);
                }
                const sourceBefore = source.balance;
                const destinationBefore = destination.balance;
                source.balance -= transferAmount;
                destination.balance += transferAmount;
                const groupId = cryptoId();
                record(source, "transfer-out", transferAmount, sourceBefore, destination.id, groupId);
                record(destination, "transfer-in", transferAmount, destinationBefore, source.id, groupId);
            });
        }

        applyInterest(rate) {
            const percentage = Number(rate);
            if (!Number.isSafeInteger(percentage) || percentage < 0 || percentage > 100) {
                fail("Interest rate must be a whole percentage between 0 and 100.");
            }
            return this.update((state) => {
                const changes = state.accounts.map((account) => ({
                    account,
                    value: Math.floor(account.balance * percentage / 100)
                }));
                const overflowing = changes.find(({ account, value }) => account.balance + value > MAX_BALANCE);
                if (overflowing) {
                    fail(`Applying interest would exceed the maximum balance for ${overflowing.account.name}. No accounts were changed.`);
                }
                for (const { account, value } of changes) {
                    if (value === 0) {
                        continue;
                    }
                    const before = account.balance;
                    account.balance += value;
                    record(account, "interest", value, before);
                }
                return changes.length;
            });
        }

        deleteAccount({ accountId, pin }) {
            return this.update((state) => {
                const account = findAccount(state, accountId);
                requirePin(account, pin);
                state.accounts = state.accounts.filter((item) => item.id !== account.id);
                return account.id;
            });
        }

        undoLast({ accountId, pin }) {
            return this.update((state) => {
                const account = findAccount(state, accountId);
                requirePin(account, pin);
                const last = account.transactions[account.transactions.length - 1];
                if (!last) {
                    fail("There are no transactions to undo for this account.");
                }
                if (last.type.startsWith("transfer-")) {
                    const related = findAccount(state, last.relatedAccountId);
                    const counterpart = related.transactions[related.transactions.length - 1];
                    if (!counterpart || counterpart.groupId !== last.groupId) {
                        fail("This transfer cannot be undone because the other account has newer transactions.");
                    }
                    related.balance = counterpart.balanceBefore;
                    related.transactions.pop();
                }
                account.balance = last.balanceBefore;
                account.transactions.pop();
                return account.balance;
            });
        }
    }

    const api = { BankingStore, MAX_ACCOUNTS, MAX_BALANCE, STORAGE_KEY };
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        root.BankingModel = api;
    }
})(typeof globalThis === "undefined" ? this : globalThis);
