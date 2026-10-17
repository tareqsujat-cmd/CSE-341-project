"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { BankingStore, MAX_ACCOUNTS, MAX_BALANCE, STORAGE_KEY } = require("../banking.js");

class MemoryStorage {
    constructor() {
        this.values = new Map();
        this.failWrites = false;
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        if (this.failWrites) {
            throw new Error("Storage quota exceeded.");
        }
        this.values.set(key, value);
    }
}

function setup() {
    const storage = new MemoryStorage();
    const store = new BankingStore(storage);
    const firstId = store.createAccount({ name: "Amina Rahman", pin: "1234", initialBalance: 1000 });
    const secondId = store.createAccount({ name: "Tareq Sujat", pin: "5678", initialBalance: 250 });
    return { storage, store, firstId, secondId };
}

test("creates accounts and persists them between store instances", () => {
    const { storage, store, firstId } = setup();
    assert.equal(firstId, 1001);
    assert.equal(store.state.accounts.length, 2);
    assert.equal(new BankingStore(storage).state.accounts[0].name, "Amina Rahman");
    assert.ok(storage.getItem(STORAGE_KEY));
});

test("enforces account limits and validates account details", () => {
    const { store } = setup();
    for (let index = 2; index < MAX_ACCOUNTS; index += 1) {
        store.createAccount({ name: `Account ${index + 1}`, pin: "1234", initialBalance: 0 });
    }
    assert.throws(() => store.createAccount({ name: "Overflow", pin: "1234", initialBalance: 0 }), /up to 5 accounts/);
    assert.throws(() => store.createAccount({ name: "Bad PIN", pin: "12", initialBalance: 0 }), /4 to 8 digits/);
});

test("deposit and withdraw validate PIN, amount, and available funds", () => {
    const { store, firstId } = setup();
    assert.equal(store.deposit({ accountId: firstId, pin: "1234", value: 50 }), 1050);
    assert.equal(store.withdraw({ accountId: firstId, pin: "1234", value: 30 }), 1020);
    assert.throws(() => store.deposit({ accountId: firstId, pin: "0000", value: 50 }), /Incorrect PIN/);
    assert.throws(() => store.withdraw({ accountId: firstId, pin: "1234", value: 2000 }), /Insufficient balance/);
    assert.throws(() => store.deposit({ accountId: firstId, pin: "1234", value: 0 }), /whole BDT amount/);
});

test("transfers record both sides and undo atomically", () => {
    const { store, firstId, secondId } = setup();
    store.transfer({ fromId: firstId, toId: secondId, pin: "1234", value: 300 });
    assert.equal(store.state.accounts[0].balance, 700);
    assert.equal(store.state.accounts[1].balance, 550);
    assert.equal(store.state.accounts[0].transactions[0].type, "transfer-out");
    assert.equal(store.state.accounts[1].transactions[0].type, "transfer-in");
    store.undoLast({ accountId: firstId, pin: "1234" });
    assert.equal(store.state.accounts[0].balance, 1000);
    assert.equal(store.state.accounts[1].balance, 250);
    assert.equal(store.state.accounts[1].transactions.length, 0);
});

test("prevents transfer undo when either account has newer activity", () => {
    const { store, firstId, secondId } = setup();
    store.transfer({ fromId: firstId, toId: secondId, pin: "1234", value: 100 });
    store.deposit({ accountId: secondId, pin: "5678", value: 10 });
    assert.throws(() => store.undoLast({ accountId: firstId, pin: "1234" }), /newer transactions/);
    assert.equal(store.state.accounts[0].balance, 900);
    assert.equal(store.state.accounts[1].balance, 360);
});

test("interest is applied to all accounts and rejects overflow without partial changes", () => {
    const { store, firstId } = setup();
    store.applyInterest(10);
    assert.equal(store.state.accounts[0].balance, 1100);
    assert.equal(store.state.accounts[1].balance, 275);
    const fullStore = new BankingStore(new MemoryStorage());
    fullStore.createAccount({ name: "Near maximum", pin: "1234", initialBalance: MAX_BALANCE - 1 });
    fullStore.createAccount({ name: "Other", pin: "1234", initialBalance: 100 });
    assert.throws(() => fullStore.applyInterest(10), /No accounts were changed/);
    assert.equal(fullStore.state.accounts[0].balance, MAX_BALANCE - 1);
    assert.equal(fullStore.state.accounts[1].balance, 100);
});

test("does not change in-memory state if local persistence fails", () => {
    const { storage, store, firstId } = setup();
    const previousBalance = store.state.accounts[0].balance;
    storage.failWrites = true;
    assert.throws(() => store.deposit({ accountId: firstId, pin: "1234", value: 10 }), /Storage quota exceeded/);
    assert.equal(store.state.accounts[0].balance, previousBalance);
});

test("rejects corrupt saved data instead of silently resetting it", () => {
    const storage = new MemoryStorage();
    storage.values.set(STORAGE_KEY, "{broken");
    assert.throws(() => new BankingStore(storage), /could not be read/);
});
