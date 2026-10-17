.MODEL SMALL
.STACK 100H

.DATA
    ; ===== CONSTANTS =====
    MAX_ACC EQU 5
    MAX_HIST EQU 5
    
    ; ===== ACCOUNT STORAGE ARRAYS =====
    acc_id      DW 0, 0, 0, 0, 0              ; Account IDs
    acc_balance DW 0, 0, 0, 0, 0              ; Account balances
    acc_active  DB 0, 0, 0, 0, 0              ; Active flags
    acc_pin     DW 0, 0, 0, 0, 0              ; Account PINs (numeric)
    acc_count   DB 0                          ; Number of accounts
    next_id     DW 1001                       ; Next ID to assign
    
    ; ===== TRANSACTION HISTORY ARRAYS =====
    ; Each account can have up to MAX_HIST transactions
    ; history_type[i] stores transaction type for account history
    ; history_amount[i] stores amount
    ; history_before[i] stores balance before transaction
    ; history_relate[i] stores related account ID (for transfers)
    
    history_type    DB 25 DUP(0)              ; Transaction types (0=Dep, 1=Wit, 2=TrOut, 3=TrIn)
    history_amount  DW 25 DUP(0)              ; Amounts
    history_before  DW 25 DUP(0)              ; Balance before
    history_relate  DW 25 DUP(0)              ; Related account
    hist_top        DB 0FFH, 0FFH, 0FFH, 0FFH, 0FFH ; Top index for each account
    
    ; ===== TEMPORARY VARIABLES =====
    temp_acc_idx    DB 0
    temp_amount     DW 0
    temp_old_bal    DW 0
    temp_rate       DW 0
    temp_type       DB 0
    temp_related    DW 0
    
    ; ===== STRINGS =====
    welcome_msg     DB 'WELCOME TO BANKING SYSTEM$'
    main_menu       DB 'MAIN MENU:$'
    opt1            DB '1. Account Management$'
    opt2            DB '2. Transactions$'
    opt3            DB '3. Transaction History$'
    opt4            DB '4. Fund Transfer$'
    opt5            DB '5. Apply Interest$'
    opt6            DB '6. Account Statement$'
    opt0            DB '0. Exit$'
    choice_prompt   DB 'Enter choice: $'
    
    acct_menu       DB 'ACCOUNT MANAGEMENT:$'
    acct_opt1       DB '1. Create Account$'
    acct_opt2       DB '2. View All Accounts$'
    acct_opt3       DB '3. Delete Account$'
    acct_opt0       DB '0. Back$'
    
    trans_menu      DB 'TRANSACTIONS:$'
    trans_opt1      DB '1. Deposit$'
    trans_opt2      DB '2. Withdraw$'
    trans_opt0      DB '0. Back$'
    
    hist_menu       DB 'TRANSACTION HISTORY:$'
    hist_opt1       DB '1. View History$'
    hist_opt2       DB '2. Undo Last Transaction$'
    hist_opt0       DB '0. Back$'
    
    enter_id        DB 'Enter Account ID: $'
    enter_bal       DB 'Enter initial balance: $'
    acct_created    DB 'Account created. ID: $'
    acct_deleted    DB 'Account deleted.$'
    
    enter_amount    DB 'Enter amount: $'
    deposited       DB 'Deposited: BDT $'
    withdrawn       DB 'Withdrawn: BDT $'
    transferred     DB 'Transferred: BDT $'
    new_balance     DB 'New Balance: BDT $'
    
    enter_rate      DB 'Enter interest rate (%): $'
    interest_msg    DB 'Interest applied.$'
    
    acct_not_found  DB 'Account not found!$'
    insuff_balance  DB 'Insufficient balance!$'
    invalid_amount  DB 'Invalid amount!$'
    empty_hist      DB 'No transactions.$'
    
    acct_stmt_msg   DB 'ACCOUNT STATEMENT$'
    curr_balance    DB 'Current Balance: BDT $'
    last_trans      DB 'Last Transactions:$'
    interest_rate   DB 'Interest Rate (%): $'
    yearly_int      DB 'Yearly Interest: BDT $'
    
    sep_line        DB '----------------------------$'
    crlf            DB 0DH, 0AH, '$'
    space           DB ' $'
    from_acc        DB 'From Account ID: $'
    to_acc          DB 'To Account ID: $'
    max_acc_msg     DB 'Max accounts reached!$'
    enter_pin       DB 'Enter PIN: $'
    set_pin_msg     DB 'Set PIN: $'
    wrong_pin       DB 'Wrong PIN!$'
    
.CODE
    ; ===== MACROS =====
    NEWLINE MACRO
        PUSH AX
        PUSH DX
        MOV AH, 09H
        LEA DX, crlf
        INT 21H
        POP DX
        POP AX
    ENDM
    
    PRINT_STR MACRO str_addr
        PUSH AX
        PUSH DX
        MOV AH, 09H
        LEA DX, str_addr
        INT 21H
        POP DX
        POP AX
    ENDM
    
    ; ===== PROCEDURES =====
    
    ; Print number in AX as decimal
    print_num PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        
        MOV BX, 10
        MOV CX, 0
        
    pn_loop:
        MOV DX, 0
        DIV BX              ; AX / 10, remainder in DX
        PUSH DX             ; Push digit
        INC CX
        CMP AX, 0
        JNE pn_loop
        
    pn_print:
        POP AX
        ADD AL, '0'
        MOV DL, AL
        MOV AH, 02H
        INT 21H
        LOOP pn_print
        
        POP DX
        POP CX
        POP BX
        POP AX
        RET
    print_num ENDP
    
    ; Read number from input into AX
    read_num PROC
        PUSH BX
        PUSH CX
        PUSH DX
        
        MOV AX, 0
        MOV BX, 10
        
    rn_loop:
        MOV SI, AX          ; SI = accumulator (save before reading)
        MOV AH, 01H         ; Read character
        INT 21H
        CMP AL, 0DH         ; Check for Enter
        JE rn_done
        
        CMP AL, '0'
        JL rn_loop
        CMP AL, '9'
        JG rn_loop
        
        SUB AL, '0'
        MOV AH, 0           ; Clear AH — INT 21H leaves AH=01H, which corrupts CX
        MOV CX, AX          ; Save digit
        MOV AX, SI          ; AX = accumulator (restore)
        MUL BX              ; Multiply accumulator by 10
        ADD AX, CX          ; Add digit
        JMP rn_loop
        
    rn_done:
        MOV AX, SI          ; Restore accumulated value (AX was overwritten by INT 21H)
        NEWLINE
        POP DX
        POP CX
        POP BX
        RET
    read_num ENDP
    
    ; Find account by ID in AX, return index in BX (or FFFFH if not found)
    find_acc PROC
        PUSH AX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        
        MOV DI, AX         ; DI = account ID to find
        MOV SI, 0          ; SI = current index
        XOR CX, CX
        MOV CL, [acc_count]
        
    fa_loop:
        CMP CX, 0
        JLE fa_not_found
        
        CMP BYTE PTR [acc_active + SI], 1
        JNE fa_next_acc
        
        ; Load the ID from array and compare
        MOV BX, SI
        SHL BX, 1
        MOV AX, [acc_id + BX]
        
        CMP AX, DI         ; Compare with target ID
        JE fa_found
        
    fa_next_acc:
        INC SI
        DEC CX
        JMP fa_loop
        
    fa_found:
        MOV BX, SI         ; Return index in BX
        JMP fa_exit
        
    fa_not_found:
        MOV BX, 0FFFFH
        
    fa_exit:
        POP DI
        POP SI
        POP DX
        POP CX
        POP AX
        RET
    find_acc ENDP
    
    ; Verify PIN for account.
    ; Input:  BX = account index (0-4)
    ; Output: BX = account index if PIN correct
    ;         BX = 0FFFFh if PIN wrong
    verify_pin PROC
        PUSH AX
        PUSH CX
        PUSH DX

        MOV [temp_acc_idx], BL      ; Save account index

        PRINT_STR enter_pin         ; "Enter PIN: "
        CALL read_num               ; AX = entered PIN (BX preserved by read_num)

        MOV DX, AX                  ; DX = entered PIN
        MOV AL, [temp_acc_idx]
        XOR AH, AH
        MOV BX, AX                  ; BX = account index
        SHL BX, 1                   ; BX = word offset into acc_pin
        CMP DX, [acc_pin + BX]      ; Compare entered vs stored PIN
        JE vp_ok

        PRINT_STR wrong_pin
        NEWLINE
        MOV BX, 0FFFFH
        JMP vp_exit

    vp_ok:
        SHR BX, 1                   ; BX = account index

    vp_exit:
        POP DX
        POP CX
        POP AX
        RET
    verify_pin ENDP

    ; Select account - prompt, find, and verify PIN
    select_acc PROC
        PRINT_STR enter_id
        CALL read_num
        CALL find_acc
        CMP BX, 0FFFFH
        JE sa_not_found

        CALL verify_pin             ; BX = account index or 0FFFFh
        RET

    sa_not_found:
        PRINT_STR acct_not_found
        NEWLINE
        MOV BX, 0FFFFH
        RET
    select_acc ENDP
    
    ; Push transaction to history
    ; temp_acc_idx = account index
    ; temp_type = transaction type
    ; temp_amount = amount
    ; temp_old_bal = balance before
    ; temp_related = related account ID
    push_hist PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        
        MOV AL, [temp_acc_idx]
        MOV BL, AL
        XOR BH, BH
        
        MOV AL, [hist_top + BX]
        CMP AL, MAX_HIST - 1
        JGE ph_full
        
        INC AL
        MOV [hist_top + BX], AL
        
        ; Calculate flat index: account * MAX_HIST + position
        MOV CL, MAX_HIST
        MOV AL, [temp_acc_idx]
        MOV AH, 0
        MUL CL              ; AX = account_idx * MAX_HIST
        ADD AL, [hist_top + BX]
        XOR AH, AH
        MOV SI, AX          ; SI = flat index
        
        ; Store transaction data
        MOV AL, [temp_type]
        MOV [history_type + SI], AL
        
        MOV AX, [temp_amount]
        SHL SI, 1           ; SI * 2 for word arrays
        MOV [history_amount + SI], AX
        
        MOV AX, [temp_old_bal]
        MOV [history_before + SI], AX
        
        MOV AX, [temp_related]
        MOV [history_relate + SI], AX
        
    ph_full:
        POP SI
        POP DX
        POP CX
        POP BX
        POP AX
        RET
    push_hist ENDP
    
    ; Create account
    create_acc PROC
        PUSH AX
        PUSH BX
        PUSH DX
        PUSH SI
        
        MOV AL, [acc_count]
        CMP AL, MAX_ACC
        JGE ca_full
        
        PRINT_STR enter_bal
        CALL read_num
        
        MOV SI, AX
        MOV AL, [acc_count]
        MOV BL, AL
        XOR BH, BH
        
        ; Store account
        MOV AX, [next_id]
        SHL BX, 1           ; BX * 2 for word array
        MOV [acc_id + BX], AX
        MOV [acc_balance + BX], SI

        ; Set PIN (BX is still word offset; read_num preserves BX)
        PRINT_STR set_pin_msg
        CALL read_num
        MOV [acc_pin + BX], AX

        SHR BX, 1           ; Back to byte index
        MOV BYTE PTR [acc_active + BX], 1
        MOV BYTE PTR [hist_top + BX], 0FFH
        
        ; Print confirmation
        PRINT_STR acct_created
        MOV AX, [next_id]
        CALL print_num
        NEWLINE
        
        ; Increment counters
        INC [acc_count]
        INC [next_id]
        
        JMP ca_exit
        
    ca_full:
        PRINT_STR max_acc_msg
        NEWLINE
        
    ca_exit:
        POP SI
        POP DX
        POP BX
        POP AX
        RET
    create_acc ENDP
    
    ; View all accounts
    view_all PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        
        NEWLINE
        PRINT_STR sep_line
        NEWLINE
        
        MOV SI, 0
        XOR CX, CX
        MOV CL, [acc_count]
        
    va_loop:
        CMP CX, 0
        JE va_none
        
        CMP BYTE PTR [acc_active + SI], 1
        JNE va_next
        
        MOV BX, SI
        SHL BX, 1
        MOV AX, [acc_id + BX]
        CALL print_num
        PRINT_STR space
        PRINT_STR space
        MOV AX, [acc_balance + BX]
        CALL print_num
        NEWLINE
        
    va_next:
        INC SI
        DEC CX
        JMP va_loop
        
    va_none:
        PRINT_STR sep_line
        NEWLINE
        NEWLINE
        
        POP SI
        POP DX
        POP CX
        POP BX
        POP AX
        RET
    view_all ENDP
    
    ; Delete account
    delete_acc PROC
        PUSH AX
        PUSH BX

        CALL select_acc             ; Handles ID prompt + PIN verification
        CMP BX, 0FFFFH
        JE da_exit                  ; Error already printed by select_acc

        MOV BYTE PTR [acc_active + BX], 0
        PRINT_STR acct_deleted
        NEWLINE

    da_exit:
        POP BX
        POP AX
        RET
    delete_acc ENDP
    
    ; Deposit
    deposit PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        
        PRINT_STR enter_amount
        CALL read_num
        
        MOV [temp_amount], AX
        MOV [temp_type], BYTE PTR 0  ; Type 0 = Deposit
        MOV [temp_related], WORD PTR 0
        
        MOV AL, [temp_acc_idx]
        MOV CL, AL
        MOV BL, AL
        XOR BH, BH
        SHL BX, 1
        
        MOV AX, [acc_balance + BX]
        MOV [temp_old_bal], AX
        
        MOV AX, [temp_amount]
        ADD [acc_balance + BX], AX
        
        CALL push_hist
        
        PRINT_STR deposited
        MOV AX, [temp_amount]
        CALL print_num
        NEWLINE
        
        PRINT_STR new_balance
        MOV AL, CL
        MOV BL, AL
        XOR BH, BH
        SHL BX, 1
        MOV AX, [acc_balance + BX]
        CALL print_num
        NEWLINE
        
        POP DX
        POP CX
        POP BX
        POP AX
        RET
    deposit ENDP
    
    ; Withdraw
    withdraw PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        
        PRINT_STR enter_amount
        CALL read_num
        
        MOV [temp_amount], AX
        
        MOV AL, [temp_acc_idx]
        MOV CL, AL
        MOV BL, AL
        XOR BH, BH
        SHL BX, 1
        
        MOV AX, [temp_amount]
        CMP AX, [acc_balance + BX]
        JG wd_insuff
        
        MOV [temp_type], BYTE PTR 1  ; Type 1 = Withdrawal
        MOV [temp_related], WORD PTR 0
        MOV AX, [acc_balance + BX]
        MOV [temp_old_bal], AX
        
        MOV AX, [temp_amount]
        SUB [acc_balance + BX], AX
        
        CALL push_hist
        
        PRINT_STR withdrawn
        MOV AX, [temp_amount]
        CALL print_num
        NEWLINE
        
        PRINT_STR new_balance
        MOV AL, CL
        MOV BL, AL
        XOR BH, BH
        SHL BX, 1
        MOV AX, [acc_balance + BX]
        CALL print_num
        NEWLINE
        JMP wd_exit
        
    wd_insuff:
        PRINT_STR insuff_balance
        NEWLINE
        
    wd_exit:
        POP DX
        POP CX
        POP BX
        POP AX
        RET
    withdraw ENDP
    
    ; View transaction history
    view_hist PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        PUSH DI
        
        PRINT_STR last_trans
        NEWLINE
        
        MOV AL, [hist_top + BX]
        CMP AL, 0FFH
        JE vh_empty
        
        MOV CL, AL
        XOR CH, CH          ; CX = AL as 16-bit
        INC CX
        MOV SI, 0
        
    vh_loop:
        CMP SI, CX
        JGE vh_done
        
        MOV AL, [temp_acc_idx]
        MOV AH, 0
        MOV DL, MAX_HIST
        MUL DL              ; AX = account_idx * MAX_HIST
        PUSH AX             ; Save account offset
        MOV DL, [hist_top + BX]
        MOV AX, SI
        SUB DL, AL          ; DL = hist_top - SI (iterate backwards)
        POP AX
        ADD AL, DL
        XOR AH, AH
        MOV DI, AX
        
        MOV AL, [history_type + DI]
        CMP AL, 0
        JE vh_dep
        CMP AL, 1
        JE vh_wit
        
        JMP vh_next
        
    vh_dep:
        PRINT_STR deposited
        SHL DI, 1
        MOV AX, [history_amount + DI]
        CALL print_num
        NEWLINE
        JMP vh_next
        
    vh_wit:
        PRINT_STR withdrawn
        SHL DI, 1
        MOV AX, [history_amount + DI]
        CALL print_num
        NEWLINE
        
    vh_next:
        INC SI
        JMP vh_loop
        
    vh_empty:
        PRINT_STR empty_hist
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
    
    ; Undo transaction
    undo_trans PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        
        MOV AL, [hist_top + BX]
        CMP AL, 0FFH
        JE ut_empty
        
        MOV DL, AL
        XOR DH, DH
        MOV AL, [temp_acc_idx]
        MOV AH, 0
        MOV CL, MAX_HIST
        MUL CL
        ADD AL, DL
        MOV SI, AX          ; Use SI instead of DX
        SHL SI, 1
        MOV AX, [history_before + SI]
        MOV [temp_old_bal], AX          ; save old balance before AL gets clobbered

        MOV AL, [temp_acc_idx]
        MOV BL, AL
        XOR BH, BH
        SHL BX, 1
        MOV AX, [temp_old_bal]          ; reload old balance
        MOV [acc_balance + BX], AX

        ; Decrement hist_top for this account
        MOV AL, [temp_acc_idx]
        XOR AH, AH
        MOV SI, AX              ; SI = account index (zero-extended)
        MOV AL, [hist_top + SI]
        DEC AL
        MOV [hist_top + SI], AL

        PRINT_STR new_balance
        MOV AX, [temp_old_bal]          ; reload for printing
        CALL print_num
        NEWLINE
        JMP ut_exit
        
    ut_empty:
        PRINT_STR empty_hist
        NEWLINE
        
    ut_exit:
        POP SI
        POP DX
        POP CX
        POP BX
        POP AX
        RET
    undo_trans ENDP
    
    ; Fund transfer
    transfer PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX

        ; Get SOURCE account
        PRINT_STR from_acc
        CALL read_num
        CALL find_acc
        CMP BX, 0FFFFH
        JE tr_not_found

        CALL verify_pin             ; Verify source account PIN
        CMP BX, 0FFFFH
        JE tr_exit                  ; Wrong PIN already printed

        MOV [temp_acc_idx], BL      ; Store verified source index

        ; Get transfer amount
        PRINT_STR enter_amount
        CALL read_num
        MOV [temp_amount], AX

        ; Check SOURCE balance
        MOV AL, [temp_acc_idx]
        MOV BL, AL
        XOR BH, BH
        SHL BX, 1
        MOV AX, [temp_amount]
        CMP AX, [acc_balance + BX]
        JG tr_insuff

        ; Get DESTINATION account
        PRINT_STR to_acc
        CALL read_num
        CALL find_acc
        CMP BX, 0FFFFH
        JE tr_not_found
        MOV CL, BL                  ; CL = destination index

        ; Deduct from SOURCE
        MOV AL, [temp_acc_idx]
        MOV BL, AL
        XOR BH, BH
        SHL BX, 1
        MOV AX, [temp_amount]
        SUB [acc_balance + BX], AX

        ; Credit DESTINATION
        MOV BL, CL
        XOR BH, BH
        SHL BX, 1
        MOV AX, [temp_amount]
        ADD [acc_balance + BX], AX

        ; Print confirmation
        PRINT_STR transferred
        MOV AX, [temp_amount]
        CALL print_num
        NEWLINE

        ; Print new source balance
        MOV AL, [temp_acc_idx]
        MOV BL, AL
        XOR BH, BH
        SHL BX, 1
        PRINT_STR new_balance
        MOV AX, [acc_balance + BX]
        CALL print_num
        NEWLINE

        JMP tr_exit

    tr_not_found:
        PRINT_STR acct_not_found
        NEWLINE
        JMP tr_exit

    tr_insuff:
        PRINT_STR insuff_balance
        NEWLINE

    tr_exit:
        POP DX
        POP CX
        POP BX
        POP AX
        RET
    transfer ENDP
    
    ; Apply interest
    apply_int PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        PUSH SI
        
        PRINT_STR enter_rate
        CALL read_num
        MOV [temp_rate], AX
        
        MOV SI, 0
        XOR CX, CX
        MOV CL, [acc_count]
        
    ai_loop:
        CMP CX, 0
        JE ai_done
        
        CMP BYTE PTR [acc_active + SI], 1
        JNE ai_next
        
        MOV BX, SI
        SHL BX, 1
        MOV AX, [acc_balance + BX]
        MOV CX, [temp_rate]
        MUL CX
        MOV CX, 100
        DIV CX
        
        MOV [temp_amount], AX
        ADD [acc_balance + BX], AX
        
    ai_next:
        INC SI
        MOV CL, [acc_count]
        CMP SI, CX
        JL ai_loop
        
    ai_done:
        PRINT_STR interest_msg
        NEWLINE
        
        POP SI
        POP DX
        POP CX
        POP BX
        POP AX
        RET
    apply_int ENDP
    
    ; Account statement
    acct_stmt PROC
        PUSH AX
        PUSH BX
        PUSH CX
        PUSH DX
        
        PRINT_STR enter_rate
        CALL read_num
        MOV [temp_rate], AX
        
        NEWLINE
        PRINT_STR acct_stmt_msg
        NEWLINE
        PRINT_STR sep_line
        NEWLINE
        
        MOV AL, [temp_acc_idx]
        XOR AH, AH
        MOV BX, AX
        SHL BX, 1
        
        MOV AX, [acc_balance + BX]
        PRINT_STR curr_balance
        CALL print_num
        NEWLINE
        
        SHR BX, 1           ; Convert back to account index for view_hist
        CALL view_hist
        SHL BX, 1           ; Shift back for balance access
        
        PRINT_STR interest_rate
        MOV AX, [temp_rate]
        CALL print_num
        NEWLINE
        
        PRINT_STR yearly_int
        MOV AX, [acc_balance + BX]
        MOV CX, [temp_rate]
        MUL CX
        MOV BX, 100
        DIV BX
        CALL print_num
        NEWLINE
        
        PRINT_STR sep_line
        NEWLINE
        NEWLINE
        
        POP DX
        POP CX
        POP BX
        POP AX
        RET
    acct_stmt ENDP
    
    ; Menu routines
    menu_acct PROC
    ma_loop:
        NEWLINE
        PRINT_STR acct_menu
        NEWLINE
        PRINT_STR acct_opt1
        NEWLINE
        PRINT_STR acct_opt2
        NEWLINE
        PRINT_STR acct_opt3
        NEWLINE
        PRINT_STR acct_opt0
        NEWLINE
        PRINT_STR choice_prompt
        
        MOV AH, 01H
        INT 21H
        NEWLINE
        
        CMP AL, '1'
        JE ma_create
        CMP AL, '2'
        JE ma_view
        CMP AL, '3'
        JE ma_delete
        CMP AL, '0'
        JE ma_exit
        
        JMP ma_loop
        
    ma_create:
        CALL create_acc
        JMP ma_loop
        
    ma_view:
        CALL view_all
        JMP ma_loop
        
    ma_delete:
        CALL delete_acc
        JMP ma_loop
        
    ma_exit:
        RET
    menu_acct ENDP
    
    menu_trans PROC
        CALL select_acc
        CMP BX, 0FFFFH
        JE mt_exit
        
        MOV [temp_acc_idx], BL
        
    mt_loop:
        NEWLINE
        PRINT_STR trans_menu
        NEWLINE
        PRINT_STR trans_opt1
        NEWLINE
        PRINT_STR trans_opt2
        NEWLINE
        PRINT_STR trans_opt0
        NEWLINE
        PRINT_STR choice_prompt
        
        MOV AH, 01H
        INT 21H
        NEWLINE
        
        CMP AL, '1'
        JE mt_deposit
        CMP AL, '2'
        JE mt_withdraw
        CMP AL, '0'
        JE mt_exit
        
        JMP mt_loop
        
    mt_deposit:
        CALL deposit
        JMP mt_loop
        
    mt_withdraw:
        CALL withdraw
        JMP mt_loop
        
    mt_exit:
        RET
    menu_trans ENDP
    
    menu_hist PROC
        CALL select_acc
        CMP BX, 0FFFFH
        JE mh_exit
        
        MOV [temp_acc_idx], BL
        
    mh_loop:
        NEWLINE
        PRINT_STR hist_menu
        NEWLINE
        PRINT_STR hist_opt1
        NEWLINE
        PRINT_STR hist_opt2
        NEWLINE
        PRINT_STR hist_opt0
        NEWLINE
        PRINT_STR choice_prompt
        
        MOV AH, 01H
        INT 21H
        NEWLINE
        
        CMP AL, '1'
        JE mh_view
        CMP AL, '2'
        JE mh_undo
        CMP AL, '0'
        JE mh_exit
        
        JMP mh_loop
        
    mh_view:
        CALL view_hist
        JMP mh_loop
        
    mh_undo:
        CALL undo_trans
        JMP mh_loop
        
    mh_exit:
        RET
    menu_hist ENDP
    
    ; Main program
    MAIN PROC
        MOV AX, @DATA
        MOV DS, AX
        
        PRINT_STR welcome_msg
        NEWLINE
        NEWLINE
        
    main_loop:
        PRINT_STR main_menu
        NEWLINE
        PRINT_STR opt1
        NEWLINE
        PRINT_STR opt2
        NEWLINE
        PRINT_STR opt3
        NEWLINE
        PRINT_STR opt4
        NEWLINE
        PRINT_STR opt5
        NEWLINE
        PRINT_STR opt6
        NEWLINE
        PRINT_STR opt0
        NEWLINE
        PRINT_STR choice_prompt
        
        MOV AH, 01H
        INT 21H
        NEWLINE
        
        CMP AL, '0'
        JE main_exit
        CMP AL, '1'
        JE main_acct
        CMP AL, '2'
        JE main_trans
        CMP AL, '3'
        JE main_hist
        CMP AL, '4'
        JE main_transfer
        CMP AL, '5'
        JE main_interest
        CMP AL, '6'
        JE main_stmt
        
        JMP main_loop
        
    main_acct:
        CALL menu_acct
        JMP main_loop
        
    main_trans:
        CALL menu_trans
        JMP main_loop
        
    main_hist:
        CALL menu_hist
        JMP main_loop
        
    main_transfer:
        CALL transfer
        JMP main_loop
        
    main_interest:
        CALL apply_int
        JMP main_loop
        
    main_stmt:
        CALL select_acc
        CMP BX, 0FFFFH
        JE main_loop
        MOV [temp_acc_idx], BL
        CALL acct_stmt
        JMP main_loop
        
    main_exit:
        MOV AX, 4C00H
        INT 21H
    MAIN ENDP

END MAIN
