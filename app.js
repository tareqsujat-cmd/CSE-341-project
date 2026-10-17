(function () {
    "use strict";

    const app = document.getElementById("app");
    const dialog = document.getElementById("action-dialog");
    const dialogForm = document.getElementById("dialog-form");
    const dialogContent = document.getElementById("dialog-content");
    const toast = document.getElementById("toast");
    const pageLabel = document.getElementById("page-label");
    const labels = {
        dashboard: "Overview",
        accounts: "Accounts",
        activity: "Transactions",
        statements: "Statements"
    };
    const currency = new Intl.NumberFormat("en-BD", {
        style: "currency",
        currency: "BDT",
        maximumFractionDigits: 0
    });
    let store;
    let currentView = "dashboard";
    let toastTimer;
    let activityFilter = "all";

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function money(value) {
        return currency.format(value);
    }

    function initials(name) {
        return String(name).trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
    }

    function accountList() {
        return store.state.accounts;
    }

    function allTransactions() {
        return accountList().flatMap((account) => account.transactions.map((transaction) => ({
            ...transaction,
            accountId: account.id,
            accountName: account.name
        }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    function dateLabel(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "Unknown date";
        }
        return new Intl.DateTimeFormat("en-BD", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function transactionLabel(transaction) {
        return ({
            deposit: "Deposit",
            withdrawal: "Withdrawal",
            "transfer-in": `Transfer from #${transaction.relatedAccountId}`,
            "transfer-out": `Transfer to #${transaction.relatedAccountId}`,
            interest: "Interest"
        })[transaction.type] || "Transaction";
    }

    function transactionAmount(transaction) {
        return ["deposit", "transfer-in", "interest"].includes(transaction.type)
            ? `+${money(transaction.amount)}`
            : `−${money(transaction.amount)}`;
    }

    function transactionClass(transaction) {
        return ["deposit", "transfer-in", "interest"].includes(transaction.type)
            ? "positive"
            : "negative";
    }

    function transactionRows(transactions, showAccount) {
        if (!transactions.length) {
            return `<tr><td colspan="${showAccount ? 5 : 4}" class="table-empty">No transactions yet.</td></tr>`;
        }
        return transactions.map((transaction) => `
            <tr>
                <td><span class="type-pill ${transactionClass(transaction)}">${escapeHtml(transactionLabel(transaction))}</span></td>
                ${showAccount ? `<td>${escapeHtml(transaction.accountName)} <span class="account-id">#${transaction.accountId}</span></td>` : ""}
                <td>${escapeHtml(dateLabel(transaction.createdAt))}</td>
                <td>${escapeHtml(`#${transaction.accountId}`)}</td>
                <td class="${transactionClass(transaction) === "positive" ? "amount-positive" : "amount-negative"}">${escapeHtml(transactionAmount(transaction))}</td>
            </tr>`).join("");
    }

    function activityTable(transactions, showAccount) {
        return `<div class="table-wrap"><table class="data-table">
            <thead><tr><th>Type</th>${showAccount ? "<th>Account</th>" : ""}<th>Date</th><th>Reference</th><th>Amount</th></tr></thead>
            <tbody>${transactionRows(transactions, showAccount)}</tbody>
        </table></div>`;
    }

    function accountRows(accounts) {
        return accounts.map((account, index) => `
            <div class="account-row">
                <div class="account-person">
                    <span class="avatar avatar-${index % 4}">${escapeHtml(initials(account.name))}</span>
                    <span><span class="account-name">${escapeHtml(account.name)}</span><span class="account-id">Account #${account.id}</span></span>
                </div>
                <span class="row-balance">${escapeHtml(money(account.balance))}</span>
                <div class="row-actions">
                    <button class="button-text" data-action="deposit" data-id="${account.id}">Deposit</button>
                    <button class="button-text" data-action="statement" data-id="${account.id}">Details</button>
                </div>
            </div>`).join("");
    }

    function emptyState(title, message, buttonText) {
        return `<div class="empty-state">
            <span class="empty-icon" aria-hidden="true">＋</span>
            <strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>
            ${buttonText ? `<button class="button button-primary button-small" data-action="create-account">${escapeHtml(buttonText)}</button>` : ""}
        </div>`;
    }

    function heading(eyebrow, title, subtitle, action) {
        return `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="page-subtitle">${escapeHtml(subtitle)}</p></div>${action || ""}</div>`;
    }

    function accountOptions(selected) {
        return accountList().map((account) =>
            `<option value="${account.id}" ${account.id === Number(selected) ? "selected" : ""}>${escapeHtml(account.name)} · #${account.id} · ${escapeHtml(money(account.balance))}</option>`
        ).join("");
    }

    function dashboard() {
        const accounts = accountList();
        const total = accounts.reduce((sum, account) => sum + account.balance, 0);
        const transactions = allTransactions();
        const deposits = transactions.filter((item) => item.type === "deposit").reduce((sum, item) => sum + item.amount, 0);
        const withdrawals = transactions.filter((item) => item.type === "withdrawal" || item.type === "transfer-out").reduce((sum, item) => sum + item.amount, 0);
        return `${heading("BANKING AT A GLANCE", "Good day", "Manage accounts and everyday banking in one place.",
            `<button class="button button-primary" data-action="create-account"><span aria-hidden="true">＋</span> Create account</button>`)}
            <section class="overview-grid" aria-label="Banking summary">
                <article class="stat-card"><span class="stat-icon">৳</span><span class="stat-label">Total balance</span><p class="stat-value">${escapeHtml(money(total))}</p><span class="stat-note">Across all active accounts</span></article>
                <article class="stat-card"><span class="stat-icon purple">▤</span><span class="stat-label">Active accounts</span><p class="stat-value">${accounts.length} <span class="stat-note">/ ${BankingModel.MAX_ACCOUNTS}</span></p><span class="stat-note">Available demo account slots</span></article>
                <article class="stat-card"><span class="stat-icon orange">↗</span><span class="stat-label">Deposits recorded</span><p class="stat-value">${escapeHtml(money(deposits))}</p><span class="stat-note">Lifetime deposits</span></article>
            </section>
            <section class="content-grid">
                <article class="panel">
                    <div class="panel-heading"><div><h2 class="panel-title">Your accounts</h2><p class="panel-caption">Balances at a glance</p></div><button class="button-text" data-view="accounts">View all →</button></div>
                    ${accounts.length ? `<div class="account-list">${accountRows(accounts)}</div>` : emptyState("No accounts yet", "Create your first account to get started.", "Create an account")}
                </article>
                <article class="panel">
                    <div class="panel-heading"><div><h2 class="panel-title">Quick actions</h2><p class="panel-caption">Common banking tasks</p></div></div>
                    <div class="quick-actions">
                        <button class="quick-action" data-action="deposit"><span class="quick-icon">＋</span><span>Deposit</span></button>
                        <button class="quick-action" data-action="withdraw"><span class="quick-icon">−</span><span>Withdraw</span></button>
                        <button class="quick-action" data-action="transfer"><span class="quick-icon">⇄</span><span>Transfer</span></button>
                        <button class="quick-action" data-action="interest"><span class="quick-icon">％</span><span>Apply interest</span></button>
                    </div>
                    <p class="bottom-note">${escapeHtml(money(withdrawals))} total withdrawals and outgoing transfers recorded.</p>
                </article>
            </section>
            <section class="panel" style="margin-top:20px">
                <div class="panel-heading"><div><h2 class="panel-title">Recent transactions</h2><p class="panel-caption">The latest activity across your accounts</p></div><button class="button-text" data-view="activity">All activity →</button></div>
                ${activityTable(transactions.slice(0, 5), true)}
            </section>
            <p class="bottom-note">Demo only: balances and PINs are stored in this browser and are not protected like real banking data.</p>`;
    }

    function accountsPage() {
        const accounts = accountList();
        return `${heading("ACCOUNT MANAGEMENT", "Accounts", `${accounts.length} of ${BankingModel.MAX_ACCOUNTS} demo accounts`,
            `<button class="button button-primary" data-action="create-account" ${accounts.length >= BankingModel.MAX_ACCOUNTS ? "disabled" : ""}><span aria-hidden="true">＋</span> New account</button>`)}
            ${accounts.length ? `<section class="account-grid">${accounts.map((account, index) => `
                <article class="account-card">
                    <div class="account-person"><span class="avatar avatar-${index % 4}">${escapeHtml(initials(account.name))}</span>
                        <span><span class="account-name">${escapeHtml(account.name)}</span><span class="account-id">Account #${account.id}</span></span></div>
                    <span class="account-balance-label">Available balance</span><p class="account-balance">${escapeHtml(money(account.balance))}</p>
                    <div class="account-card-actions">
                        <button class="button button-secondary button-small" data-action="deposit" data-id="${account.id}">Deposit</button>
                        <button class="button button-secondary button-small" data-action="withdraw" data-id="${account.id}">Withdraw</button>
                        <button class="button-text" data-action="statement" data-id="${account.id}">Statement</button>
                        <button class="button-text" data-action="undo" data-id="${account.id}">Undo latest</button>
                        <button class="button-text" data-action="delete-account" data-id="${account.id}">Delete</button>
                    </div>
                </article>`).join("")}</section>` : emptyState("Your account list is empty", "Create an account to start managing your demo finances.", "Create an account")}
            <p class="bottom-note">This demo follows the original assembly project's five-account limit. Account balances are limited to BDT 65,535 to match its 16-bit balance storage.</p>`;
    }

    function activityPage() {
        const transactions = allTransactions().filter((item) => activityFilter === "all" || item.accountId === Number(activityFilter));
        return `${heading("ACCOUNT ACTIVITY", "Transactions", "Review deposits, withdrawals, transfers, and interest.",
            `<button class="button button-secondary" data-action="transfer" ${accountList().length < 2 ? "disabled" : ""}>⇄ Transfer funds</button>`)}
            <section class="panel">
                <div class="filter-bar"><label class="field" for="activity-filter"><span class="field-hint">Show activity for</span>
                    <select class="select-control" id="activity-filter"><option value="all">All accounts</option>${accountOptions(activityFilter)}</select>
                </label></div>
                ${activityTable(transactions, true)}
                <p class="bottom-note">For safety, undo is available only for an account's latest transaction. Transfers can be undone only while both sides are still the latest transaction on their respective accounts.</p>
            </section>`;
    }

    function statementsPage() {
        const accounts = accountList();
        return `${heading("ACCOUNT REPORTS", "Statements", "Balance snapshots and transaction histories for each account.")}
            ${accounts.length ? `<section class="account-grid">${accounts.map((account, index) => `
                <article class="account-card">
                    <div class="account-person"><span class="avatar avatar-${index % 4}">${escapeHtml(initials(account.name))}</span>
                        <span><span class="account-name">${escapeHtml(account.name)}</span><span class="account-id">Account #${account.id}</span></span></div>
                    <span class="account-balance-label">Current balance</span><p class="account-balance">${escapeHtml(money(account.balance))}</p>
                    <button class="button button-secondary button-small" data-action="statement" data-id="${account.id}">View statement</button>
                </article>`).join("")}</section>` : emptyState("No statements available", "Create an account to generate its statement.", "Create an account")}
            <p class="bottom-note">Statement interest projections use the rate you enter; they do not change the account balance.</p>`;
    }

    function render() {
        pageLabel.textContent = labels[currentView];
        document.querySelectorAll("[data-view]").forEach((button) => {
            if (button.matches(".nav-link")) {
                button.classList.toggle("is-active", button.dataset.view === currentView);
                if (button.dataset.view === currentView) {
                    button.setAttribute("aria-current", "page");
                } else {
                    button.removeAttribute("aria-current");
                }
            }
        });
        app.innerHTML = ({
            dashboard,
            accounts: accountsPage,
            activity: activityPage,
            statements: statementsPage
        })[currentView]();
        const filter = document.getElementById("activity-filter");
        if (filter) {
            filter.addEventListener("change", () => {
                activityFilter = filter.value;
                render();
            });
        }
    }

    function showToast(message, isError) {
        toast.textContent = message;
        toast.classList.toggle("is-error", Boolean(isError));
        toast.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3000);
    }

    function field(name, label, options) {
        const config = options || {};
        const required = config.required === false ? "" : "required";
        const full = config.full ? " full" : "";
        const hint = config.hint ? `<span class="field-hint">${escapeHtml(config.hint)}</span>` : "";
        let control;
        if (config.options) {
            control = `<select name="${name}" ${required}>${config.options}</select>`;
        } else {
            control = `<input name="${name}" type="${config.type || "text"}" ${config.min !== undefined ? `min="${config.min}"` : ""} ${config.max !== undefined ? `max="${config.max}"` : ""} ${config.maxlength ? `maxlength="${config.maxlength}"` : ""} ${config.pattern ? `pattern="${config.pattern}"` : ""} ${config.inputmode ? `inputmode="${config.inputmode}"` : ""} ${required} ${config.autocomplete ? `autocomplete="${config.autocomplete}"` : ""}>`;
        }
        return `<div class="field${full}"><label for="field-${name}">${escapeHtml(label)}</label>${control.replace(`name="${name}"`, `id="field-${name}" name="${name}"`)}${hint}</div>`;
    }

    function openDialog({ title, subtitle, fields, submitLabel, onSubmit, destructive, successMessage }) {
        dialogContent.innerHTML = `
            <div class="dialog-head"><div><h2 id="dialog-title">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button type="button" class="icon-button" data-close-dialog aria-label="Close dialog">×</button></div>
            <div class="dialog-error" role="alert" hidden></div>
            <div class="form-grid">${fields.join("")}</div>
            <div class="dialog-actions"><button type="button" class="button button-secondary" data-close-dialog>Cancel</button>
            <button type="submit" class="button ${destructive ? "button-danger" : "button-primary"}">${escapeHtml(submitLabel)}</button></div>`;
        dialogForm.onsubmit = (event) => {
            event.preventDefault();
            const submit = dialogForm.querySelector('[type="submit"]');
            submit.disabled = true;
            try {
                onSubmit(Object.fromEntries(new FormData(dialogForm).entries()));
                dialog.close();
                render();
            } catch (error) {
                const errorBox = dialogContent.querySelector(".dialog-error");
                errorBox.textContent = error.message;
                errorBox.hidden = false;
                submit.disabled = false;
                return;
            }
            showToast(successMessage || "Changes saved.");
        };
        dialog.showModal();
        dialogContent.querySelector("input, select")?.focus();
    }

    function createAccountDialog() {
        if (accountList().length >= BankingModel.MAX_ACCOUNTS) {
            showToast(`This demo supports up to ${BankingModel.MAX_ACCOUNTS} accounts.`, true);
            return;
        }
        openDialog({
            title: "Create an account",
            subtitle: "Add an account to your local banking demo.",
            fields: [
                field("name", "Account holder name", { full: true, maxlength: 60, autocomplete: "name" }),
                field("initialBalance", "Opening balance (BDT)", { type: "number", min: 0, max: BankingModel.MAX_BALANCE, inputmode: "numeric" }),
                field("pin", "Create a PIN", { type: "password", min: 4, max: 8, pattern: "\\d{4,8}", inputmode: "numeric", autocomplete: "new-password", hint: "Use 4–8 digits. This demo stores PINs locally and is not secure for real banking." })
            ],
            submitLabel: "Create account",
            onSubmit: (values) => store.createAccount(values)
        });
    }

    function transactionDialog(type, accountId) {
        const title = type === "deposit" ? "Deposit funds" : "Withdraw funds";
        const current = accountId ? findAccountInStore(accountId) : null;
        if (!accountList().length) {
            showToast("Create an account before making a transaction.", true);
            return;
        }
        openDialog({
            title,
            subtitle: current ? `${current.name} · account #${current.id}` : "Choose an account and confirm its PIN.",
            fields: [
                field("accountId", "Account", { full: true, options: accountOptions(accountId) }),
                field("value", "Amount (BDT)", { type: "number", min: 1, max: BankingModel.MAX_BALANCE, inputmode: "numeric" }),
                field("pin", "Account PIN", { type: "password", min: 4, max: 8, pattern: "\\d{4,8}", inputmode: "numeric", autocomplete: "current-password" })
            ],
            submitLabel: title,
            onSubmit: (values) => type === "deposit" ? store.deposit(values) : store.withdraw(values)
        });
    }

    function findAccountInStore(id) {
        return accountList().find((account) => account.id === Number(id));
    }

    function transferDialog() {
        if (accountList().length < 2) {
            showToast("Create at least two accounts to make a transfer.", true);
            return;
        }
        openDialog({
            title: "Transfer funds",
            subtitle: "Move money between your demo accounts.",
            fields: [
                field("fromId", "From account", { full: true, options: accountOptions() }),
                field("toId", "To account", { full: true, options: accountOptions() }),
                field("value", "Amount (BDT)", { type: "number", min: 1, max: BankingModel.MAX_BALANCE, inputmode: "numeric" }),
                field("pin", "Source account PIN", { type: "password", min: 4, max: 8, pattern: "\\d{4,8}", inputmode: "numeric", autocomplete: "current-password" })
            ],
            submitLabel: "Transfer",
            onSubmit: (values) => store.transfer(values)
        });
    }

    function interestDialog() {
        if (!accountList().length) {
            showToast("Create an account before applying interest.", true);
            return;
        }
        openDialog({
            title: "Apply interest",
            subtitle: "Apply a whole-number rate to all active accounts.",
            fields: [field("rate", "Interest rate (%)", { type: "number", min: 0, max: 100, inputmode: "numeric", full: true, hint: "Interest is rounded down to a whole BDT amount." })],
            submitLabel: "Apply interest",
            onSubmit: (values) => store.applyInterest(values.rate)
        });
    }

    function statementDialog(accountId) {
        const account = findAccountInStore(accountId);
        if (!account) {
            showToast("That account could not be found.", true);
            return;
        }
        const recentActivity = account.transactions.slice().reverse().slice(0, 5);
        const activityMarkup = recentActivity.length
            ? recentActivity.map((transaction) => `
                <div class="statement-row">
                    <span class="type-pill ${transactionClass(transaction)}">${escapeHtml(transactionLabel(transaction))}</span>
                    <span class="${transactionClass(transaction) === "positive" ? "amount-positive" : "amount-negative"}">${escapeHtml(transactionAmount(transaction))}</span>
                    <span class="statement-meta">${escapeHtml(dateLabel(transaction.createdAt))}</span>
                </div>`).join("")
            : `<p class="field-hint">No transactions recorded for this account yet.</p>`;
        openDialog({
            title: `${account.name} · statement`,
            subtitle: `Account #${account.id} · ${account.transactions.length} recorded transaction${account.transactions.length === 1 ? "" : "s"}`,
            fields: [
                `<div class="field full statement-summary"><span class="account-balance-label">Current balance</span><p class="account-balance">${escapeHtml(money(account.balance))}</p><p class="statement-meta">Projected yearly interest: <strong id="interest-projection">${escapeHtml(money(0))}</strong></p></div>`,
                field("rate", "Interest rate (%)", { type: "number", min: 0, max: 100, value: 0, inputmode: "numeric", full: true, required: false }),
                `<section class="field full statement-transactions"><h3 class="panel-title">Recent transactions</h3>${activityMarkup}</section>`
            ],
            submitLabel: "Done",
            onSubmit: () => {},
            successMessage: "Statement closed."
        });
        const rateInput = dialogContent.querySelector('[name="rate"]');
        rateInput.value = "0";
        rateInput.addEventListener("input", () => {
            const rate = Number(rateInput.value);
            const projection = Number.isSafeInteger(rate) && rate >= 0 && rate <= 100
                ? Math.floor(account.balance * rate / 100)
                : 0;
            dialogContent.querySelector("#interest-projection").textContent = money(projection);
        });
    }

    function deleteAccountDialog(accountId) {
        const account = findAccountInStore(accountId);
        if (!account) {
            showToast("That account could not be found.", true);
            return;
        }
        openDialog({
            title: "Delete account",
            subtitle: `This permanently removes ${account.name} and its local transaction history.`,
            fields: [
                `<div class="field full"><span class="field-hint">Balance to be removed: <strong>${escapeHtml(money(account.balance))}</strong></span></div>`,
                field("pin", "Confirm account PIN", { type: "password", min: 4, max: 8, pattern: "\\d{4,8}", inputmode: "numeric", autocomplete: "current-password" })
            ],
            submitLabel: "Delete account",
            destructive: true,
            onSubmit: (values) => store.deleteAccount({ accountId: account.id, pin: values.pin })
        });
    }

    function undoDialog(accountId) {
        const account = findAccountInStore(accountId);
        if (!account) {
            showToast("That account could not be found.", true);
            return;
        }
        openDialog({
            title: "Undo latest transaction",
            subtitle: `Restore ${account.name} to the balance before its latest transaction.`,
            fields: [field("pin", "Confirm account PIN", { type: "password", min: 4, max: 8, pattern: "\\d{4,8}", inputmode: "numeric", autocomplete: "current-password" })],
            submitLabel: "Undo transaction",
            onSubmit: (values) => store.undoLast({ accountId: account.id, pin: values.pin })
        });
    }

    function showFatalError(error) {
        app.innerHTML = `<div class="note-banner" role="alert"><span aria-hidden="true">!</span><div><strong>Banking data could not be loaded.</strong>${escapeHtml(error.message)} Your saved data was not reset. Check browser storage permissions or repair/remove the local demo data to continue.</div></div>`;
    }

    document.addEventListener("click", (event) => {
        const viewButton = event.target.closest("[data-view]");
        if (viewButton) {
            event.preventDefault();
            currentView = viewButton.dataset.view;
            render();
            return;
        }
        const closeButton = event.target.closest("[data-close-dialog]");
        if (closeButton) {
            dialog.close();
            return;
        }
        const actionButton = event.target.closest("[data-action]");
        if (!actionButton) {
            return;
        }
        const { action, id } = actionButton.dataset;
        if (action === "create-account") createAccountDialog();
        else if (action === "deposit" || action === "withdraw") transactionDialog(action, id);
        else if (action === "transfer") transferDialog();
        else if (action === "interest") interestDialog();
        else if (action === "statement") statementDialog(id);
        else if (action === "delete-account") deleteAccountDialog(id);
        else if (action === "undo") undoDialog(id);
    });

    try {
        store = new BankingModel.BankingStore(window.localStorage);
        render();
    } catch (error) {
        showFatalError(error);
    }
})();
