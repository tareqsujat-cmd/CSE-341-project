# Banking System Assembly Code Documentation

## Project Overview

This is a **Banking Management System** written in x86 Assembly Language (8086). It's a menu-driven application that allows users to perform basic banking operations including account management, deposits, withdrawals, fund transfers, interest calculations, and transaction history tracking.

The system runs on **EMU8086** emulator and supports up to 5 accounts, each with a transaction history of up to 5 transactions.

---

## System Architecture

### Memory Organization

The program uses the **SMALL memory model** with a 256-byte stack.

```
.MODEL SMALL    ; Small memory model (code + data < 64KB)
.STACK 100H     ; Stack of 256 bytes (100H = 256 in decimal)
```

### Data Structures

#### Account Arrays (5 accounts maximum)
- **acc_id**: Stores account identification numbers (words - 2 bytes each)
- **acc_balance**: Stores current balance for each account (words)
- **acc_active**: Tracks if account is active/deleted (bytes: 0=inactive, 1=active)
- **acc_count**: Total number of accounts created (byte)
- **next_id**: Next account ID to assign, starting from 1001 (word)

#### Transaction History Arrays (25 total transactions: 5 accounts × 5 transactions each)
- **history_type**: Type of transaction (byte: 0=Deposit, 1=Withdrawal, 2=Transfer Out, 3=Transfer In)
- **history_amount**: Amount of transaction (word)
- **history_before**: Balance before transaction occurred (word)
- **history_relate**: Related account ID for transfers (word)
- **hist_top**: Top index pointer for each account's history (byte, range 0-4 or 0FFH for empty)

#### Temporary Variables (Used during operations)
- **temp_acc_idx**: Current account index being operated on (byte, range 0-4)
- **temp_amount**: Amount being processed (word)
- **temp_old_bal**: Old balance before operation (word)
- **temp_rate**: Interest rate percentage (word)
- **temp_type**: Transaction type code (byte)
- **temp_related**: Related account ID (word)

#### String Constants (Menu messages and prompts)
All text strings used for user interface, stored in memory with `$` terminator for DOS INT 21H function 09H.

---

## Main Procedures Explained

### 1. **MACRO: NEWLINE**
```asm
NEWLINE MACRO
    PUSH AX
    PUSH DX
    MOV AH, 09H          ; DOS function to print string
    LEA DX, crlf         ; Load address of carriage return + line feed
    INT 21H              ; Call DOS interrupt
    POP DX
    POP AX
ENDM
```
**Purpose**: Prints a newline (enters next line on console). Used after every output for formatting.

---

### 2. **MACRO: PRINT_STR**
```asm
PRINT_STR MACRO str_addr
    PUSH AX
    PUSH DX
    MOV AH, 09H          ; DOS print string function
    LEA DX, str_addr     ; Load address of string to print
    INT 21H              ; Call DOS
    POP DX
    POP AX
ENDM
```
**Purpose**: Prints any string message to the console. Preserves registers.

---

### 3. **PROCEDURE: print_num**

```asm
print_num PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX              ; Save all registers
    
    MOV BX, 10           ; Divisor = 10 (for decimal conversion)
    MOV CX, 0            ; Digit counter = 0
    
pn_loop:
    MOV DX, 0            ; Clear DX (required for division)
    DIV BX               ; AX ÷ 10, quotient→AX, remainder→DX
    PUSH DX              ; Push remainder (digit) onto stack
    INC CX               ; Increment digit count
    CMP AX, 0            ; Check if quotient is 0
    JNE pn_loop          ; If not, continue dividing
    
pn_print:
    POP AX               ; Pop digit from stack
    ADD AL, '0'          ; Convert digit to ASCII (0-9)
    MOV DL, AL           ; Move to DL for printing
    MOV AH, 02H          ; DOS function to print single character
    INT 21H              ; Call DOS
    LOOP pn_print        ; Loop CX times (print all digits)
    
    POP DX
    POP CX
    POP BX
    POP AX               ; Restore all registers
    RET
print_num ENDP
```

**Purpose**: Converts a 16-bit number in AX to decimal and prints it on console.

**Algorithm**:
1. Repeatedly divide AX by 10, collecting remainders (digits) on stack
2. Push digits onto stack to reverse their order
3. Pop and convert each digit to ASCII character
4. Print each digit using DOS interrupt

---

### 4. **PROCEDURE: read_num**

```asm
read_num PROC
    PUSH BX
    PUSH CX
    PUSH DX
    
    MOV AX, 0            ; Accumulator = 0 (result starts at 0)
    MOV BX, 10           ; Multiplier = 10
    
rn_loop:
    MOV SI, AX           ; SI = current accumulator (save it)
    MOV AH, 01H          ; DOS function to read single character
    INT 21H              ; Read one character from keyboard
    CMP AL, 0DH          ; Is it Enter (carriage return)?
    JE rn_done           ; If yes, done reading
    
    CMP AL, '0'          ; Is it less than '0'?
    JL rn_loop           ; If yes, ignore and read next
    CMP AL, '9'          ; Is it greater than '9'?
    JG rn_loop           ; If yes, ignore and read next
    
    SUB AL, '0'          ; Convert ASCII digit to numeric value (0-9)
    MOV CX, AX           ; Save digit in CX
    MOV AX, SI           ; AX = restored accumulator
    MUL BX               ; AX = AX × 10 (multiply by 10)
    ADD AX, CX           ; AX = AX + digit (add new digit)
    JMP rn_loop          ; Read next character
    
rn_done:
    NEWLINE              ; Print newline
    POP DX
    POP CX
    POP BX
    RET                  ; Return with number in AX
read_num ENDP
```

**Purpose**: Reads a multi-digit decimal number from keyboard input and returns it in AX.

**Algorithm**: Builds the number digit by digit:
- For each digit: `result = result × 10 + digit`
- Stops when Enter key is pressed
- Ignores non-numeric characters

---

### 5. **PROCEDURE: find_acc**

```asm
find_acc PROC
    PUSH AX
    PUSH CX
    PUSH DX
    PUSH SI
    PUSH DI
    
    MOV SI, 0            ; SI = account index (start at 0)
    XOR CX, CX
    MOV CL, [acc_count]  ; CX = total accounts created
    
fa_loop:
    CMP CX, 0            ; Any accounts left to check?
    JE fa_not_found      ; If no, account not found
    
    CMP AX, [acc_id + SI*2]  ; Does AX (search ID) match current account ID?
    JE fa_check_active       ; If yes, check if account is active
    
    INC SI               ; Move to next account
    DEC CX               ; Decrement counter
    JMP fa_loop          ; Continue looping
    
fa_check_active:
    MOV DL, [acc_active + SI]  ; Get active flag
    CMP DL, 1                  ; Is account active?
    JE fa_found                ; If yes, found it!
    
    INC SI               ; Move to next account
    DEC CX               ; Decrement counter
    JMP fa_loop          ; Continue looping
    
fa_found:
    MOV BX, SI           ; Return account index in BX
    JMP fa_exit
    
fa_not_found:
    MOV BX, 0FFFFH       ; Return FFFFFFFF (invalid index)
    
fa_exit:
    POP DI
    POP SI
    POP DX
    POP CX
    POP AX
    RET                  ; BX contains index or 0FFFFFFFF if not found
find_acc ENDP
```

**Purpose**: Searches for an account by ID (in AX) and returns its index in BX.

**Returns**: 
- BX = account index (0-4) if found and active
- BX = 0FFFFFFFF if not found or inactive

---

### 6. **PROCEDURE: select_acc**

```asm
select_acc PROC
    PRINT_STR enter_id       ; Print "Enter Account ID: "
    CALL read_num            ; Read account ID from user
    CALL find_acc            ; Find the account (index returned in BX)
    CMP BX, 0FFFFH           ; Was account found?
    JNE sa_found             ; If yes, go to sa_found
    
    PRINT_STR acct_not_found ; Print error message
    NEWLINE
    MOV BX, 0FFFFH           ; Set BX to invalid
    
sa_found:
    RET                      ; Return with BX = account index or 0FFFFFFFF
select_acc ENDP
```

**Purpose**: Prompts user to enter account ID and finds that account.

---

### 7. **PROCEDURE: push_hist**

```asm
push_hist PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX
    PUSH SI
    
    MOV AL, [temp_acc_idx]   ; AL = account index (0-4)
    MOV BL, AL
    XOR BH, BH               ; BX = account index (zero-extend)
    
    MOV AL, [hist_top + BX]  ; AL = current history top for this account
    CMP AL, MAX_HIST - 1     ; Is history full (at limit 4)?
    JGE ph_full              ; If yes, don't add more
    
    INC AL                   ; Increment history counter
    MOV [hist_top + BX], AL  ; Save new counter
    
    ; Calculate flat index: account * MAX_HIST + position
    MOV CL, MAX_HIST         ; CL = 5
    MOV AL, [temp_acc_idx]
    MOV AH, 0
    MUL CL                   ; AX = account_index × 5
    ADD AL, [hist_top + BX]  ; AX = base + position
    XOR AH, AH
    MOV SI, AX               ; SI = flat index in history arrays
    
    ; Store transaction data
    MOV AL, [temp_type]      ; Get transaction type
    MOV [history_type + SI], AL
    
    MOV AX, [temp_amount]    ; Get transaction amount
    SHL SI, 1                ; SI = SI × 2 (convert to byte offset for word array)
    MOV [history_amount + SI], AX
    
    MOV AX, [temp_old_bal]   ; Get balance before transaction
    MOV [history_before + SI], AX
    
    MOV AX, [temp_related]   ; Get related account ID
    MOV [history_relate + SI], AX
    
ph_full:
    POP SI
    POP DX
    POP CX
    POP BX
    POP AX
    RET
push_hist ENDP
```

**Purpose**: Records a transaction in the account's history. Called after deposits, withdrawals, and transfers.

**Stores**: Type, amount, balance before, and related account ID.

---

### 8. **PROCEDURE: create_acc**

```asm
create_acc PROC
    PUSH AX
    PUSH BX
    PUSH DX
    PUSH SI
    
    MOV AL, [acc_count]      ; AL = current number of accounts
    CMP AL, MAX_ACC          ; Have we reached maximum (5)?
    JGE ca_full              ; If yes, can't create more
    
    PRINT_STR enter_bal      ; Prompt for initial balance
    CALL read_num            ; Read balance from user
    
    MOV SI, AX               ; SI = initial balance
    MOV AL, [acc_count]      ; AL = current account count
    MOV BL, AL
    XOR BH, BH               ; BX = account count (zero-extend)
    
    ; Store account info in arrays
    MOV AX, [next_id]        ; AX = next ID to assign
    SHL BX, 1                ; BX = BX × 2 (word offset)
    MOV [acc_id + BX], AX    ; Store account ID
    MOV [acc_balance + BX], SI  ; Store initial balance
    
    SHR BX, 1                ; BX = BX ÷ 2 (back to byte index)
    MOV BYTE PTR [acc_active + BX], 1    ; Mark as active
    MOV BYTE PTR [hist_top + BX], 0FFH   ; Initialize history (empty = 0xFF)
    
    ; Print confirmation
    PRINT_STR acct_created   ; Print "Account created. ID: "
    MOV AX, [next_id]
    CALL print_num           ; Print the ID
    NEWLINE
    
    ; Increment counters
    INC [acc_count]          ; Increment account count
    INC [next_id]            ; Increment next ID (for next account)
    
    JMP ca_exit
    
ca_full:
    PRINT_STR sep_line       ; Print error (max accounts reached)
    NEWLINE
    
ca_exit:
    POP SI
    POP DX
    POP BX
    POP AX
    RET
create_acc ENDP
```

**Purpose**: Creates a new account with a unique ID and initial balance.

**Process**:
1. Check if account limit reached
2. Read initial balance from user
3. Assign next available ID
4. Store account data in arrays
5. Mark as active and initialize transaction history

---

### 9. **PROCEDURE: view_all**

```asm
view_all PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX
    PUSH SI
    
    NEWLINE
    PRINT_STR sep_line       ; Print separator line
    NEWLINE
    
    MOV SI, 0               ; SI = index (start at 0)
    XOR CX, CX
    MOV CL, [acc_count]     ; CX = total accounts
    
va_loop:
    CMP CX, 0               ; Any accounts left?
    JE va_none              ; If no, skip to end message
    
    CMP BYTE PTR [acc_active + SI], 1  ; Is account active?
    JNE va_next                        ; If not, skip it
    
    ; Print account ID and balance
    MOV AX, SI
    SHL AX, 1
    MOV AX, [acc_id + SI*2]  ; Get account ID
    CALL print_num            ; Print ID
    PRINT_STR space           ; Print space
    PRINT_STR space
    MOV AX, [acc_balance + SI*2]  ; Get balance
    CALL print_num                 ; Print balance
    NEWLINE
    
va_next:
    INC SI                  ; Move to next account
    DEC CX                  ; Decrement counter
    JMP va_loop
    
va_none:
    PRINT_STR sep_line      ; Print separator line
    NEWLINE
    NEWLINE
    
    POP SI
    POP DX
    POP CX
    POP BX
    POP AX
    RET
view_all ENDP
```

**Purpose**: Displays all active accounts with their IDs and current balances.

---

### 10. **PROCEDURE: delete_acc**

```asm
delete_acc PROC
    PUSH AX
    PUSH BX
    
    PRINT_STR enter_id       ; Prompt for account ID
    CALL read_num            ; Read ID
    CALL find_acc            ; Find the account
    
    CMP BX, 0FFFFH           ; Found?
    JE da_not_found          ; If not, show error
    
    MOV [acc_active + BX], BYTE PTR 0  ; Mark as inactive (0)
    PRINT_STR acct_deleted              ; Print success message
    NEWLINE
    JMP da_exit
    
da_not_found:
    PRINT_STR acct_not_found ; Print error
    NEWLINE
    
da_exit:
    POP BX
    POP AX
    RET
delete_acc ENDP
```

**Purpose**: Deletes (deactivates) an account by marking it as inactive.

---

### 11. **PROCEDURE: deposit**

```asm
deposit PROC
    PUSH AX
    PUSH BX
    PUSH DX
    
    PRINT_STR enter_amount       ; Prompt for amount
    CALL read_num                ; Read amount
    
    MOV [temp_amount], AX        ; Store amount
    MOV [temp_type], BYTE PTR 0  ; Type = 0 (Deposit)
    MOV [temp_related], WORD PTR 0
    
    ; Get current balance
    MOV AL, [temp_acc_idx]
    MOV BL, AL
    XOR BH, BH
    SHL BX, 1
    MOV AX, [acc_balance + BX]
    MOV [temp_old_bal], AX       ; Save old balance
    
    ; Add deposit amount
    MOV AX, [temp_amount]
    ADD [acc_balance + BX], AX   ; balance = balance + amount
    
    CALL push_hist               ; Record in history
    
    ; Print results
    PRINT_STR deposited          ; Print "Deposited: BDT "
    MOV AX, [temp_amount]
    CALL print_num               ; Print amount
    NEWLINE
    PRINT_STR new_balance        ; Print "New Balance: BDT "
    MOV AL, [temp_acc_idx]
    MOV BL, AL
    XOR BH, BH
    SHL BX, 1
    MOV AX, [acc_balance + BX]
    CALL print_num               ; Print new balance
    NEWLINE
    
    POP DX
    POP BX
    POP AX
    RET
deposit ENDP
```

**Purpose**: Adds money to an account and records the transaction.

---

### 12. **PROCEDURE: withdraw**

```asm
withdraw PROC
    PUSH AX
    PUSH BX
    PUSH DX
    
    PRINT_STR enter_amount   ; Prompt for amount
    CALL read_num            ; Read amount
    
    MOV [temp_amount], AX    ; Store amount
    
    ; Get account balance
    MOV AL, [temp_acc_idx]
    MOV BL, AL
    XOR BH, BH
    SHL BX, 1
    
    ; Check if sufficient balance
    CMP AX, [acc_balance + BX]  ; Is amount > balance?
    JG wd_insuff                ; If yes, jump to error
    
    MOV [temp_type], BYTE PTR 1     ; Type = 1 (Withdrawal)
    MOV [temp_related], WORD PTR 0
    MOV AX, [acc_balance + BX]
    MOV [temp_old_bal], AX          ; Save old balance
    
    ; Subtract amount
    MOV AX, [temp_amount]
    SUB [acc_balance + BX], AX      ; balance = balance - amount
    
    CALL push_hist                  ; Record in history
    
    ; Print results
    PRINT_STR withdrawn             ; Print "Withdrawn: BDT "
    MOV AX, [temp_amount]
    CALL print_num                  ; Print amount
    NEWLINE
    PRINT_STR new_balance           ; Print "New Balance: BDT "
    MOV AX, [acc_balance + BX]
    CALL print_num                  ; Print new balance
    NEWLINE
    JMP wd_exit
    
wd_insuff:
    PRINT_STR insuff_balance        ; Print error message
    NEWLINE
    
wd_exit:
    POP DX
    POP BX
    POP AX
    RET
withdraw ENDP
```

**Purpose**: Withdraws money from an account (with balance check) and records the transaction.

---

### 13. **PROCEDURE: view_hist**

```asm
view_hist PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX
    PUSH SI
    PUSH DI
    
    PRINT_STR last_trans        ; Print "Last Transactions:"
    NEWLINE
    
    MOV AL, [hist_top + BX]     ; AL = last transaction index
    CMP AL, 0FFH                ; Is history empty (0xFF)?
    JE vh_empty                 ; If yes, skip
    
    MOV CL, AL
    XOR CH, CH                  ; CX = number of transactions
    INC CX
    MOV SI, 0                   ; SI = counter
    
vh_loop:
    CMP SI, CX                  ; Printed all transactions?
    JGE vh_done                 ; If yes, done
    
    ; Calculate history index
    MOV AL, [temp_acc_idx]
    MOV AH, 0
    MOV DL, MAX_HIST
    MUL DL                      ; AX = account_idx × MAX_HIST
    PUSH AX                     ; Save account offset
    MOV DL, [hist_top + BX]
    MOV AX, SI
    SUB DL, AL                  ; DL = hist_top - SI (iterate backwards)
    POP AX
    ADD AL, DL
    XOR AH, AH
    MOV DI, AX                  ; DI = final history index
    
    ; Get transaction type
    MOV AL, [history_type + DI]
    CMP AL, 0
    JE vh_dep                   ; If type = 0, it's a deposit
    CMP AL, 1
    JE vh_wit                   ; If type = 1, it's a withdrawal
    
    JMP vh_next
    
vh_dep:
    PRINT_STR deposited         ; Print "Deposited: BDT "
    SHL DI, 1
    MOV AX, [history_amount + DI]
    CALL print_num
    NEWLINE
    JMP vh_next
    
vh_wit:
    PRINT_STR withdrawn         ; Print "Withdrawn: BDT "
    SHL DI, 1
    MOV AX, [history_amount + DI]
    CALL print_num
    NEWLINE
    
vh_next:
    INC SI
    JMP vh_loop
    
vh_empty:
    PRINT_STR empty_hist        ; Print "No transactions."
    NEWLINE
    
vh_done:
    POP DI
    POP SI
    POP DX
    POP CX
    POP BX
    POP AX
    RET
view_hist ENDP
```

**Purpose**: Displays recent transactions for an account in reverse chronological order.

---

### 14. **PROCEDURE: undo_trans**

```asm
undo_trans PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX
    PUSH SI
    
    MOV AL, [hist_top + BX]     ; AL = last transaction index
    CMP AL, 0FFH                ; Is history empty?
    JE ut_empty                 ; If yes, error
    
    MOV DL, AL
    XOR DH, DH
    MOV AL, [temp_acc_idx]
    MOV AH, 0
    MOV CL, MAX_HIST
    MUL CL                      ; AX = account_idx × MAX_HIST
    ADD AL, DL
    MOV SI, AX                  ; SI = history index
    SHL SI, 1
    MOV AX, [history_before + SI]  ; AX = balance before transaction
    
    ; Restore balance
    MOV AL, [temp_acc_idx]
    MOV BL, AL
    XOR BH, BH
    SHL BX, 1
    MOV [acc_balance + BX], AX      ; Restore old balance
    
    ; Decrement history counter
    MOV AL, [temp_acc_idx]
    XOR AH, AH
    MOV SI, AX
    MOV AL, [hist_top + SI]
    DEC AL
    MOV [hist_top + SI], AL
    
    PRINT_STR new_balance           ; Print new balance
    CALL print_num
    NEWLINE
    JMP ut_exit
    
ut_empty:
    PRINT_STR empty_hist            ; Print error
    NEWLINE
    
ut_exit:
    POP SI
    POP DX
    POP CX
    POP BX
    POP AX
    RET
undo_trans ENDP
```

**Purpose**: Reverts the last transaction by restoring the previous balance.

---

### 15. **PROCEDURE: transfer**

```asm
transfer PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX
    
    ; Get destination account ID
    PRINT_STR enter_id          ; Prompt for destination account ID
    CALL read_num
    CALL find_acc               ; Find destination account
    
    CMP BX, 0FFFFH              ; Found?
    JE tr_not_found             ; If not, error
    
    MOV [temp_acc_idx], BL      ; temp_acc_idx = destination index
    
    ; Get transfer amount
    PRINT_STR enter_amount
    CALL read_num
    MOV [temp_amount], AX
    
    ; Check source balance (current account is in BX already from select_acc)
    MOV AL, [temp_acc_idx]
    MOV BL, AL
    XOR BH, BH
    SHL BX, 1
    
    CMP AX, [acc_balance + BX]  ; amount > balance?
    JG tr_insuff                ; If yes, error
    
    SUB [acc_balance + BX], AX  ; Deduct from source (destination is in BX)
    
    PRINT_STR transferred       ; Print "Transferred: BDT "
    MOV AX, [temp_amount]
    CALL print_num
    NEWLINE
    PRINT_STR new_balance
    MOV AX, [acc_balance + BX]
    CALL print_num
    NEWLINE
    
    JMP tr_exit
    
tr_not_found:
    PRINT_STR acct_not_found    ; Error: account not found
    NEWLINE
    JMP tr_exit
    
tr_insuff:
    PRINT_STR insuff_balance    ; Error: insufficient balance
    NEWLINE
    
tr_exit:
    POP DX
    POP CX
    POP BX
    POP AX
    RET
transfer ENDP
```

**Purpose**: Transfers money from one account to another.

**Note**: This is a simplified version. A complete implementation should add money to destination and record in both accounts' history.

---

### 16. **PROCEDURE: apply_int**

```asm
apply_int PROC
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DX
    PUSH SI
    
    ; Get interest rate
    PRINT_STR enter_rate        ; Prompt for rate
    CALL read_num
    MOV [temp_rate], AX
    
    MOV SI, 0                   ; SI = account index
    XOR CX, CX
    MOV CL, [acc_count]         ; CX = total accounts
    
ai_loop:
    CMP CX, 0                   ; Any accounts left?
    JE ai_done                  ; If not, done
    
    CMP BYTE PTR [acc_active + SI], 1  ; Account active?
    JNE ai_next                        ; If not, skip
    
    ; Calculate interest: interest = balance × rate ÷ 100
    MOV AX, [acc_balance + SI*2]
    MOV BX, [temp_rate]
    MUL BX                      ; AX = balance × rate
    MOV BX, 100
    DIV BX                      ; AX = (balance × rate) ÷ 100
    
    MOV [temp_amount], AX
    ADD [acc_balance + SI*2], AX    ; balance = balance + interest
    
ai_next:
    INC SI
    DEC CX
    JMP ai_loop
    
ai_done:
    PRINT_STR interest_msg      ; Print "Interest applied."
    NEWLINE
    
    POP SI
    POP DX
    POP CX
    POP BX
    POP AX
    RET
apply_int ENDP
```

**Purpose**: Applies interest to all active accounts and updates their balances.

**Formula**: `Interest = (Balance × Rate) ÷ 100`

---

### 17. **PROCEDURE: acct_stmt**

```asm
acct_stmt PROC
    PUSH AX
    PUSH BX
    PUSH DX
    
    ; Get interest rate for display
    PRINT_STR enter_rate        ; Prompt for interest rate
    CALL read_num
    MOV [temp_rate], AX
    
    ; Print statement header
    NEWLINE
    PRINT_STR acct_stmt_msg     ; Print "ACCOUNT STATEMENT"
    NEWLINE
    PRINT_STR sep_line          ; Print separator
    NEWLINE
    
    ; Print current balance
    MOV AL, [temp_acc_idx]
    XOR AH, AH
    MOV BX, AX
    SHL BX, 1
    
    MOV AX, [acc_balance + BX]
    PRINT_STR curr_balance      ; Print "Current Balance: BDT "
    CALL print_num
    NEWLINE
    
    ; Print transaction history
    PRINT_STR last_trans        ; Print "Last Transactions:"
    NEWLINE
    
    SHR BX, 1                   ; Convert back to account index
    CALL view_hist              ; Display history
    SHL BX, 1                   ; Shift back for balance access
    
    ; Print interest rate
    PRINT_STR interest_rate     ; Print "Interest Rate (%): "
    MOV AX, [temp_rate]
    CALL print_num
    NEWLINE
    
    ; Calculate and print yearly interest
    PRINT_STR yearly_int        ; Print "Yearly Interest: BDT "
    MOV AX, [acc_balance + BX]
    MOV CX, [temp_rate]
    MUL CX                      ; AX = balance × rate
    MOV BX, 100
    DIV BX                      ; AX = (balance × rate) ÷ 100
    CALL print_num
    NEWLINE
    
    ; Print footer
    PRINT_STR sep_line          ; Print separator
    NEWLINE
    NEWLINE
    
    POP DX
    POP BX
    POP AX
    RET
acct_stmt ENDP
```

**Purpose**: Displays a complete account statement showing:
- Current balance
- Recent transactions
- Applied interest rate
- Projected yearly interest

---

### 18. **MAIN PROGRAM**

```asm
MAIN PROC
    MOV AX, @DATA               ; AX = address of data segment
    MOV DS, AX                  ; Set DS (data segment register)
    
    ; Display welcome message
    PRINT_STR welcome_msg       ; Print "WELCOME TO BANKING SYSTEM"
    NEWLINE
    NEWLINE
    
main_loop:
    ; Display main menu
    PRINT_STR main_menu
    NEWLINE
    PRINT_STR opt1              ; 1. Account Management
    NEWLINE
    PRINT_STR opt2              ; 2. Transactions
    NEWLINE
    PRINT_STR opt3              ; 3. Transaction History
    NEWLINE
    PRINT_STR opt4              ; 4. Fund Transfer
    NEWLINE
    PRINT_STR opt5              ; 5. Apply Interest
    NEWLINE
    PRINT_STR opt6              ; 6. Account Statement
    NEWLINE
    PRINT_STR opt0              ; 0. Exit
    NEWLINE
    PRINT_STR choice_prompt     ; Print "Enter choice: "
    
    ; Read user choice
    MOV AH, 01H                 ; DOS function to read single character
    INT 21H
    NEWLINE
    
    ; Process choice
    CMP AL, '0'
    JE main_exit                ; If '0', exit
    CMP AL, '1'
    JE main_acct                ; If '1', go to account management
    CMP AL, '2'
    JE main_trans               ; If '2', go to transactions
    CMP AL, '3'
    JE main_hist                ; If '3', go to transaction history
    CMP AL, '4'
    JE main_transfer            ; If '4', go to fund transfer
    CMP AL, '5'
    JE main_interest            ; If '5', go to apply interest
    CMP AL, '6'
    JE main_stmt                ; If '6', go to account statement
    
    JMP main_loop               ; If invalid choice, show menu again
    
main_acct:
    CALL menu_acct              ; Call account management menu
    JMP main_loop
    
main_trans:
    CALL menu_trans             ; Call transactions menu
    JMP main_loop
    
main_hist:
    CALL menu_hist              ; Call transaction history menu
    JMP main_loop
    
main_transfer:
    CALL transfer               ; Call fund transfer
    JMP main_loop
    
main_interest:
    CALL apply_int              ; Call apply interest
    JMP main_loop
    
main_stmt:
    CALL select_acc             ; Select account
    CMP BX, 0FFFFH              ; Account found?
    JE main_loop                ; If not, return to menu
    MOV [temp_acc_idx], BL      ; Store selected account index
    CALL acct_stmt              ; Display statement
    JMP main_loop
    
main_exit:
    MOV AX, 4C00H               ; DOS function to exit program
    INT 21H                     ; Return to DOS
MAIN ENDP

END MAIN                        ; End of program, MAIN is entry point
```

**Purpose**: Main program loop that:
1. Initializes the data segment
2. Shows the main menu
3. Handles user choices
4. Calls appropriate procedures
5. Exits when user selects '0'

---

## System Features Summary

| Feature | Capability |
|---------|-----------|
| **Accounts** | Create, view, and delete (up to 5) |
| **Transactions** | Deposit and withdraw with balance checks |
| **History** | Track up to 5 transactions per account, with undo capability |
| **Interest** | Apply percentage-based interest to all accounts |
| **Statements** | View complete account summary with calculations |
| **ID System** | Auto-generated account IDs starting from 1001 |

---

## Memory Layout

```
.DATA SEGMENT (64KB)
├─ Account Arrays (5 accounts)
│  ├─ acc_id (10 bytes)
│  ├─ acc_balance (10 bytes)
│  ├─ acc_active (5 bytes)
│  ├─ acc_count (1 byte)
│  └─ next_id (2 bytes)
│
├─ Transaction History (25 max transactions)
│  ├─ history_type (25 bytes)
│  ├─ history_amount (50 bytes)
│  ├─ history_before (50 bytes)
│  ├─ history_relate (50 bytes)
│  └─ hist_top (5 bytes)
│
├─ Temporary Variables
│  ├─ temp_acc_idx (1 byte)
│  ├─ temp_amount (2 bytes)
│  ├─ temp_old_bal (2 bytes)
│  ├─ temp_rate (2 bytes)
│  ├─ temp_type (1 byte)
│  └─ temp_related (2 bytes)
│
└─ Strings (various sizes)
   └─ All UI messages and prompts

.CODE SEGMENT
├─ Macros (NEWLINE, PRINT_STR)
├─ Utility Procedures (print_num, read_num)
├─ Account Procedures (find_acc, create_acc, etc.)
├─ Transaction Procedures (deposit, withdraw, etc.)
└─ Main Program
```

---

## Keyboard Input/Output

- **Input**: Uses DOS INT 21H, AH=01H to read single characters and build multi-digit numbers
- **Output**: Uses DOS INT 21H, AH=02H for single characters and AH=09H for strings
- **Number Conversion**: Manual conversion between decimal and ASCII representations

---

## Assembly Notes

- **Model**: SMALL (near code and data pointers)
- **Calling Convention**: Pass parameters via registers and memory
- **Return Values**: Results in AX or BX depending on procedure
- **Register Usage**: Each procedure preserves all registers it modifies
- **Addressing**: Uses base register + index notation for array access

---

This banking system demonstrates fundamental assembly language concepts including loops, conditionals, array manipulation, and DOS interrupt usage in a practical banking application.
