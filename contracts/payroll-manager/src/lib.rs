use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, BytesN, Env, String, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Company {
    pub admin: Address,
    pub signers: Vec<Address>,
    pub min_signers: u32,
    pub token: Address,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Contractor {
    pub wallet: Address,
    pub name: String,
    pub email: String,
    pub active: bool,
    pub total_paid: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayrollRun {
    pub id: u64,
    pub company: Address,
    pub period_start: u64,
    pub period_end: u64,
    pub status: PayrollStatus,
    pub total_amount: i128,
    pub payment_count: u32,
    pub approvals: Vec<Address>,
    pub created_at: u64,
    pub executed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PayrollStatus {
    Pending,
    Approved,
    Executing,
    Completed,
    Failed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentEntry {
    pub contractor: Address,
    pub amount: i128,
    pub currency: Address,
    pub memo: String,
    pub paid: bool,
    pub tx_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Company(Address),
    Contractor(Address, Address),
    PayrollRun(u64),
    Payment(u64, Address),
    NextRunId,
    CompanyContractors(Address),
    Escrow(Address, Address),
}

fn company_key(addr: &Address) -> DataKey {
    DataKey::Company(addr.clone())
}

fn contractor_key(company: &Address, contractor: &Address) -> DataKey {
    DataKey::Contractor(company.clone(), contractor.clone())
}

fn payroll_key(id: u64) -> DataKey {
    DataKey::PayrollRun(id)
}

fn payment_key(run_id: u64, contractor: &Address) -> DataKey {
    DataKey::Payment(run_id, contractor.clone())
}

fn escrow_key(company: &Address, token: &Address) -> DataKey {
    DataKey::Escrow(company.clone(), token.clone())
}

fn require_active(company: &Company) {
    if !company.active {
        panic!("company is deactivated");
    }
}

fn require_authorized_signer(company: &Company, addr: &Address) {
    if addr == &company.admin || company.signers.iter().any(|s| s == *addr) {
        return;
    }
    panic!("not authorized signer");
}

fn event_symbol(env: &Env, name: &str) -> Symbol {
    Symbol::new(env, name)
}

#[contract]
pub struct PayrollManager;

#[contractimpl]
impl PayrollManager {
    pub fn register_company(
        env: Env,
        admin: Address,
        signers: Vec<Address>,
        min_signers: u32,
        token: Address,
    ) {
        admin.require_auth();
        if min_signers == 0 || min_signers > signers.len() {
            panic!("invalid signer threshold");
        }
        if env.storage().instance().has(&company_key(&admin)) {
            panic!("company already registered");
        }
        // The run-id counter is global (each run id must be unique on-chain).
        // Only initialize it once so a newly registered company cannot reset
        // the counter and overwrite another company's runs.
        if !env.storage().instance().has(&DataKey::NextRunId) {
            env.storage().instance().set(&DataKey::NextRunId, &0u64);
        }
        let company = Company {
            admin: admin.clone(),
            signers,
            min_signers,
            token: token.clone(),
            active: true,
        };
        env.storage().instance().set(&company_key(&admin), &company);

        env.events()
            .publish((event_symbol(&env, "company_registered"), admin.clone(), min_signers), token);
    }

    pub fn update_company(
        env: Env,
        admin: Address,
        signers: Vec<Address>,
        min_signers: u32,
        token: Address,
    ) {
        admin.require_auth();
        let mut company: Company = env.storage().instance().get(&company_key(&admin)).unwrap();
        require_active(&company);
        if min_signers == 0 || min_signers > signers.len() {
            panic!("invalid signer threshold");
        }
        company.signers = signers;
        company.min_signers = min_signers;
        company.token = token;
        env.storage().instance().set(&company_key(&admin), &company);
    }

    pub fn deactivate_company(env: Env, admin: Address) {
        admin.require_auth();
        let mut company: Company = env.storage().instance().get(&company_key(&admin)).unwrap();
        require_active(&company);
        company.active = false;
        env.storage().instance().set(&company_key(&admin), &company);
    }

    pub fn add_contractor(
        env: Env,
        company_addr: Address,
        contractor_addr: Address,
        name: String,
        email: String,
    ) {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);
        company.admin.require_auth();

        if name.is_empty() {
            panic!("name must not be empty");
        }
        if name.len() > 64 {
            panic!("name is too long");
        }
        if email.is_empty() {
            panic!("email must not be empty");
        }
        if email.len() > 128 {
            panic!("email is too long");
        }
        if env.storage().instance().has(&contractor_key(&company_addr, &contractor_addr)) {
            panic!("contractor already exists");
        }

        let contractor = Contractor {
            wallet: contractor_addr.clone(),
            name: name.clone(),
            email,
            active: true,
            total_paid: 0,
        };
        env.storage().instance().set(&contractor_key(&company_addr, &contractor_addr), &contractor);

        let mut list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::CompanyContractors(company_addr.clone()))
            .unwrap_or(Vec::new(&env));
        list.push_back(contractor_addr.clone());
        env.storage().instance().set(&DataKey::CompanyContractors(company_addr.clone()), &list);

        env.events()
            .publish((event_symbol(&env, "contractor_added"), company_addr, contractor_addr), name);
    }

    pub fn remove_contractor(env: Env, company_addr: Address, contractor_addr: Address) {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);
        company.admin.require_auth();

        let mut contractor: Contractor =
            env.storage().instance().get(&contractor_key(&company_addr, &contractor_addr)).unwrap();
        if !contractor.active {
            panic!("contractor already removed");
        }
        contractor.active = false;
        env.storage().instance().set(&contractor_key(&company_addr, &contractor_addr), &contractor);

        // Drop the contractor from the company's list so pending runs no
        // longer iterate over them at execution time.
        let list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::CompanyContractors(company_addr.clone()))
            .unwrap_or(Vec::new(&env));
        let mut retained: Vec<Address> = Vec::new(&env);
        for addr in list.iter() {
            if addr != contractor_addr {
                retained.push_back(addr);
            }
        }
        env.storage().instance().set(&DataKey::CompanyContractors(company_addr.clone()), &retained);

        env.events().publish(
            (event_symbol(&env, "contractor_removed"), company_addr, contractor_addr),
            0u32,
        );
    }

    pub fn get_contractor(env: Env, company_addr: Address, contractor_addr: Address) -> Contractor {
        env.storage().instance().get(&contractor_key(&company_addr, &contractor_addr)).unwrap()
    }

    pub fn get_company_contractors(env: Env, company_addr: Address) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::CompanyContractors(company_addr))
            .unwrap_or(Vec::new(&env))
    }

    pub fn create_payroll_run(
        env: Env,
        company_addr: Address,
        period_start: u64,
        period_end: u64,
    ) -> u64 {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);
        company.admin.require_auth();

        if period_start == 0 {
            panic!("period_start must be set");
        }
        if period_end <= period_start {
            panic!("period_end must be after period_start");
        }

        let mut next_id: u64 = env.storage().instance().get(&DataKey::NextRunId).unwrap();

        let payroll_run = PayrollRun {
            id: next_id,
            company: company_addr.clone(),
            period_start,
            period_end,
            status: PayrollStatus::Pending,
            total_amount: 0,
            payment_count: 0,
            approvals: Vec::new(&env),
            created_at: env.ledger().timestamp(),
            executed_at: 0,
        };

        env.storage().instance().set(&payroll_key(next_id), &payroll_run);

        let id = next_id;
        next_id += 1;
        env.storage().instance().set(&DataKey::NextRunId, &next_id);

        env.events().publish(
            (event_symbol(&env, "payroll_run_created"), company_addr, id, period_start),
            period_end,
        );

        id
    }

    pub fn add_payment(
        env: Env,
        company_addr: Address,
        run_id: u64,
        contractor_addr: Address,
        amount: i128,
        currency: Address,
        memo: String,
    ) {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);
        company.admin.require_auth();

        // Only roster contractors may be paid. A payment to an unknown
        // address would otherwise inflate the run's total_amount (raising
        // its escrow requirement) while never being paid out, because
        // execute_payroll_run iterates the roster only.
        let contractor: Contractor =
            env.storage().instance().get(&contractor_key(&company_addr, &contractor_addr)).unwrap();
        if !contractor.active {
            panic!("contractor is not active");
        }

        let mut run: PayrollRun = env.storage().instance().get(&payroll_key(run_id)).unwrap();

        if run.company != company_addr {
            panic!("run does not belong to company");
        }
        if run.status != PayrollStatus::Pending {
            panic!("payroll run not in pending state");
        }
        if amount <= 0 {
            panic!("payment amount must be positive");
        }
        if currency != company.token {
            panic!("payment currency must match company token");
        }
        if memo.len() > 256 {
            panic!("memo is too long");
        }
        // A contractor can be paid at most once per run. Guard against
        // duplicate entries silently overwriting the stored payment while
        // inflating the run total.
        if env.storage().instance().has(&payment_key(run_id, &contractor_addr)) {
            panic!("payment already exists for contractor in this run");
        }

        let payment = PaymentEntry {
            contractor: contractor_addr.clone(),
            amount,
            currency: currency.clone(),
            memo,
            paid: false,
            tx_hash: BytesN::from_array(&env, &[0u8; 32]),
        };

        env.storage().instance().set(&payment_key(run_id, &contractor_addr), &payment);

        run.total_amount += amount;
        run.payment_count += 1;

        env.storage().instance().set(&payroll_key(run_id), &run);

        env.events().publish(
            (event_symbol(&env, "payment_added"), company_addr, run_id, contractor_addr),
            amount,
        );
    }

    pub fn approve_payroll_run(env: Env, company_addr: Address, run_id: u64, signer: Address) {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);

        signer.require_auth();
        require_authorized_signer(&company, &signer);

        let mut run: PayrollRun = env.storage().instance().get(&payroll_key(run_id)).unwrap();

        if run.company != company_addr {
            panic!("run does not belong to company");
        }
        if run.status != PayrollStatus::Pending {
            panic!("payroll run not pending");
        }

        let mut already_approved = false;
        for a in run.approvals.iter() {
            if a == signer {
                already_approved = true;
                break;
            }
        }
        if already_approved {
            panic!("already approved by this signer");
        }

        run.approvals.push_back(signer.clone());

        if run.approvals.len() >= company.min_signers {
            run.status = PayrollStatus::Approved;
        }

        env.storage().instance().set(&payroll_key(run_id), &run);

        env.events().publish(
            (event_symbol(&env, "payroll_run_approved"), company_addr, run_id),
            run.approvals.len(),
        );
    }

    pub fn execute_payroll_run(env: Env, company_addr: Address, run_id: u64, signer: Address) {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);

        signer.require_auth();
        require_authorized_signer(&company, &signer);

        let mut run: PayrollRun = env.storage().instance().get(&payroll_key(run_id)).unwrap();

        if run.company != company_addr {
            panic!("run does not belong to company");
        }
        if run.status != PayrollStatus::Approved {
            panic!("payroll run not approved");
        }

        // The escrow balance is tracked per company and per token so a company
        // can only ever pay out of funds it deposited itself.
        let mut escrow_balance: i128 =
            env.storage().instance().get(&escrow_key(&company_addr, &company.token)).unwrap_or(0);
        if escrow_balance < run.total_amount {
            panic!("insufficient escrow balance for payroll run");
        }

        run.status = PayrollStatus::Executing;
        env.storage().instance().set(&payroll_key(run_id), &run);

        let contractor_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::CompanyContractors(company_addr.clone()))
            .unwrap_or(Vec::new(&env));

        let mut paid_total: i128 = 0;
        for contractor_addr in contractor_list.iter() {
            let payment_opt: Option<PaymentEntry> =
                env.storage().instance().get(&payment_key(run_id, &contractor_addr));

            if let Some(mut payment) = payment_opt {
                if payment.paid {
                    continue;
                }

                // Soft-deleted contractors (removed before execution) are
                // skipped even if they were added to this pending run.
                let contractor: Contractor = env
                    .storage()
                    .instance()
                    .get(&contractor_key(&company_addr, &contractor_addr))
                    .unwrap();
                if !contractor.active {
                    continue;
                }

                let token_client = token::Client::new(&env, &payment.currency);

                token_client.transfer(
                    &env.current_contract_address(),
                    &payment.contractor,
                    &payment.amount,
                );

                escrow_balance = escrow_balance.saturating_sub(payment.amount);
                paid_total += payment.amount;

                payment.paid = true;
                env.storage().instance().set(&payment_key(run_id, &contractor_addr), &payment);

                let mut contractor: Contractor = env
                    .storage()
                    .instance()
                    .get(&contractor_key(&company_addr, &contractor_addr))
                    .unwrap();
                contractor.total_paid += payment.amount;
                env.storage()
                    .instance()
                    .set(&contractor_key(&company_addr, &contractor_addr), &contractor);
            }
        }

        env.storage().instance().set(&escrow_key(&company_addr, &company.token), &escrow_balance);

        run.status = PayrollStatus::Completed;
        run.executed_at = env.ledger().timestamp();
        env.storage().instance().set(&payroll_key(run_id), &run);

        env.events().publish(
            (event_symbol(&env, "payroll_run_executed"), company_addr, run_id),
            paid_total,
        );
    }

    pub fn cancel_payroll_run(env: Env, company_addr: Address, run_id: u64) {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);
        company.admin.require_auth();

        let mut run: PayrollRun = env.storage().instance().get(&payroll_key(run_id)).unwrap();

        if run.company != company_addr {
            panic!("run does not belong to company");
        }

        if run.status == PayrollStatus::Completed || run.status == PayrollStatus::Failed {
            panic!("cannot cancel completed or failed run");
        }

        run.status = PayrollStatus::Cancelled;
        env.storage().instance().set(&payroll_key(run_id), &run);

        env.events()
            .publish((event_symbol(&env, "payroll_run_cancelled"), company_addr, run_id), 0u32);
    }

    pub fn deposit_to_escrow(env: Env, company_addr: Address, token: Address, amount: i128) {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);
        company.admin.require_auth();

        if amount <= 0 {
            panic!("deposit amount must be positive");
        }
        // Only the company's registered payment token may be escrowed so a
        // run can never draw on funds deposited in an unrelated asset.
        if token != company.token {
            panic!("deposit token must match company token");
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&company.admin, &env.current_contract_address(), &amount);

        let mut balance: i128 =
            env.storage().instance().get(&escrow_key(&company_addr, &token)).unwrap_or(0);
        balance += amount;
        env.storage().instance().set(&escrow_key(&company_addr, &token), &balance);

        env.events().publish((event_symbol(&env, "escrow_deposited"), company_addr, token), amount);
    }

    pub fn get_payroll_run(env: Env, run_id: u64) -> PayrollRun {
        env.storage().instance().get(&payroll_key(run_id)).unwrap()
    }

    pub fn get_payment(env: Env, run_id: u64, contractor_addr: Address) -> PaymentEntry {
        env.storage().instance().get(&payment_key(run_id, &contractor_addr)).unwrap()
    }

    pub fn get_company(env: Env, company_addr: Address) -> Company {
        env.storage().instance().get(&company_key(&company_addr)).unwrap()
    }

    pub fn get_company_balance(env: Env, company_addr: Address, token: Address) -> i128 {
        env.storage().instance().get(&escrow_key(&company_addr, &token)).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Ledger as _;
    use soroban_sdk::{testutils::Address as _, token, vec, Env, String};

    #[test]
    fn test_register_company() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let signer1 = Address::generate(&env);
        let signer2 = Address::generate(&env);
        let signers = vec![&env, signer1.clone(), signer2.clone()];

        client.register_company(&admin, &signers, &2, &token);

        let company = client.get_company(&admin);
        assert_eq!(company.admin, admin);
        assert_eq!(company.min_signers, 2);
        assert!(company.active);
    }

    #[test]
    fn test_add_contractor() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let contractor_addr = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        client.register_company(&admin, &signers, &1, &token);

        client.add_contractor(
            &admin,
            &contractor_addr,
            &String::from_str(&env, "John Doe"),
            &String::from_str(&env, "john@example.com"),
        );

        let contractor = client.get_contractor(&admin, &contractor_addr);
        assert!(contractor.active);
        assert_eq!(contractor.total_paid, 0);
    }

    #[test]
    fn test_create_and_approve_payroll_run() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let contractor_addr = Address::generate(&env);
        let signer1 = Address::generate(&env);
        let signer2 = Address::generate(&env);
        let signers = vec![&env, signer1.clone(), signer2.clone()];

        client.register_company(&admin, &signers, &2, &token);

        client.add_contractor(
            &admin,
            &contractor_addr,
            &String::from_str(&env, "Jane Doe"),
            &String::from_str(&env, "jane@example.com"),
        );

        let run_id = client.create_payroll_run(&admin, &1700000000u64, &1700086400u64);

        client.add_payment(
            &admin,
            &run_id,
            &contractor_addr,
            &1000_000000i128,
            &token,
            &String::from_str(&env, "January salary"),
        );

        let run = client.get_payroll_run(&run_id);
        assert_eq!(run.status, PayrollStatus::Pending);
        assert_eq!(run.total_amount, 1000_000000);
        assert_eq!(run.payment_count, 1);

        client.approve_payroll_run(&admin, &run_id, &signer1);

        let run = client.get_payroll_run(&run_id);
        assert_eq!(run.approvals.len(), 1);
        assert_eq!(run.status, PayrollStatus::Pending);

        client.approve_payroll_run(&admin, &run_id, &signer2);

        let run = client.get_payroll_run(&run_id);
        assert_eq!(run.approvals.len(), 2);
        assert_eq!(run.status, PayrollStatus::Approved);
    }

    #[test]
    fn test_register_company_rejects_duplicate() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        client.register_company(&admin, &signers, &1, &token);

        let result = client.try_register_company(&admin, &signers, &1, &token);
        assert!(result.is_err());
    }

    #[test]
    fn test_create_payroll_run_requires_valid_period() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        client.register_company(&admin, &signers, &1, &token);

        let unset_start = client.try_create_payroll_run(&admin, &0u64, &10u64);
        assert!(unset_start.is_err());

        let inverted = client.try_create_payroll_run(&admin, &100u64, &100u64);
        assert!(inverted.is_err());

        let zero_period = client.try_create_payroll_run(&admin, &50u64, &100u64);
        assert!(zero_period.is_ok());
    }

    #[test]
    fn test_add_payment_rejects_nonpositive_amount() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let contractor_addr = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        client.register_company(&admin, &signers, &1, &token);
        client.add_contractor(
            &admin,
            &contractor_addr,
            &String::from_str(&env, "John Doe"),
            &String::from_str(&env, "john@example.com"),
        );
        let run_id = client.create_payroll_run(&admin, &1700000000u64, &1700086400u64);

        let zero = client.try_add_payment(
            &admin,
            &run_id,
            &contractor_addr,
            &0i128,
            &token,
            &String::from_str(&env, "zero"),
        );
        assert!(zero.is_err());

        let negative = client.try_add_payment(
            &admin,
            &run_id,
            &contractor_addr,
            &-100i128,
            &token,
            &String::from_str(&env, "negative"),
        );
        assert!(negative.is_err());
    }

    #[test]
    fn test_rejects_cross_company_payroll_run() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin_a = Address::generate(&env);
        let admin_b = Address::generate(&env);
        let token = Address::generate(&env);
        let contractor_addr = Address::generate(&env);

        client.register_company(&admin_a, &vec![&env, admin_a.clone()], &1, &token);
        client.register_company(&admin_b, &vec![&env, admin_b.clone()], &1, &token);
        client.add_contractor(
            &admin_a,
            &contractor_addr,
            &String::from_str(&env, "John Doe"),
            &String::from_str(&env, "john@example.com"),
        );

        let run_id = client.create_payroll_run(&admin_a, &1700000000u64, &1700086400u64);

        let cross = client.try_add_payment(
            &admin_a,
            &run_id,
            &contractor_addr,
            &100i128,
            &token,
            &String::from_str(&env, "cross"),
        );
        assert!(cross.is_ok());

        let approve_cross = client.try_approve_payroll_run(&admin_b, &run_id, &admin_b);
        assert!(approve_cross.is_err());

        let execute_cross = client.try_execute_payroll_run(&admin_b, &run_id, &admin_b);
        assert!(execute_cross.is_err());
    }

    #[test]
    fn test_add_payment_rejects_unregistered_contractor() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let stranger = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        client.register_company(&admin, &signers, &1, &token);
        let run_id = client.create_payroll_run(&admin, &1700000000u64, &1700086400u64);

        // No contractor was registered for this company, so the payment must
        // be rejected instead of silently inflating the run total.
        let unknown = client.try_add_payment(
            &admin,
            &run_id,
            &stranger,
            &100i128,
            &token,
            &String::from_str(&env, "unknown"),
        );
        assert!(unknown.is_err());

        let run = client.get_payroll_run(&run_id);
        assert_eq!(run.total_amount, 0);
        assert_eq!(run.payment_count, 0);
    }

    #[test]
    fn test_execute_requires_approved_run() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        client.register_company(&admin, &signers, &1, &token);
        let run_id = client.create_payroll_run(&admin, &1700000000u64, &1700086400u64);

        let result = client.try_execute_payroll_run(&admin, &run_id, &admin);
        assert!(result.is_err());
    }

    #[test]
    fn test_duplicate_payment_rejected_does_not_inflate_total() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let contractor_addr = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        client.register_company(&admin, &signers, &1, &token);
        client.add_contractor(
            &admin,
            &contractor_addr,
            &String::from_str(&env, "John Doe"),
            &String::from_str(&env, "john@example.com"),
        );
        let run_id = client.create_payroll_run(&admin, &1700000000u64, &1700086400u64);

        client.add_payment(
            &admin,
            &run_id,
            &contractor_addr,
            &100i128,
            &token,
            &String::from_str(&env, "first"),
        );

        let duplicate = client.try_add_payment(
            &admin,
            &run_id,
            &contractor_addr,
            &999i128,
            &token,
            &String::from_str(&env, "duplicate"),
        );
        assert!(duplicate.is_err());

        let run = client.get_payroll_run(&run_id);
        assert_eq!(run.total_amount, 100);
        assert_eq!(run.payment_count, 1);
    }

    #[test]
    fn test_add_payment_rejects_non_company_token() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let other_token = Address::generate(&env);
        let contractor_addr = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        client.register_company(&admin, &signers, &1, &token);
        client.add_contractor(
            &admin,
            &contractor_addr,
            &String::from_str(&env, "Jane Doe"),
            &String::from_str(&env, "jane@example.com"),
        );
        let run_id = client.create_payroll_run(&admin, &1700000000u64, &1700086400u64);

        let cross_currency = client.try_add_payment(
            &admin,
            &run_id,
            &contractor_addr,
            &100i128,
            &other_token,
            &String::from_str(&env, "wrong token"),
        );
        assert!(cross_currency.is_err());
    }

    #[test]
    fn test_escrow_is_per_company() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin_a = Address::generate(&env);
        let admin_b = Address::generate(&env);
        let token = env.register_stellar_asset_contract_v2(admin_a.clone()).address();
        let token_client = token::StellarAssetClient::new(&env, &token);

        client.register_company(&admin_a, &vec![&env, admin_a.clone()], &1, &token);
        client.register_company(&admin_b, &vec![&env, admin_b.clone()], &1, &token);

        token_client.mint(&admin_a, &1_000_000i128);
        client.deposit_to_escrow(&admin_a, &token, &500_000i128);

        assert_eq!(client.get_company_balance(&admin_a, &token), 500_000);
        assert_eq!(client.get_company_balance(&admin_b, &token), 0);
    }

    #[test]
    fn test_deposit_rejects_foreign_token() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let other_token = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        client.register_company(&admin, &signers, &1, &token);

        let wrong_token = client.try_deposit_to_escrow(&admin, &other_token, &100i128);
        assert!(wrong_token.is_err());

        let zero = client.try_deposit_to_escrow(&admin, &token, &0i128);
        assert!(zero.is_err());
    }

    #[test]
    fn test_execute_pays_contractors_and_decrements_escrow() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let contractor_addr = Address::generate(&env);
        let removed_contractor = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let token_client = token::StellarAssetClient::new(&env, &token);
        let token_query = token::Client::new(&env, &token);

        client.register_company(&admin, &signers, &1, &token);
        token_client.mint(&admin, &2_000_000i128);

        client.add_contractor(
            &admin,
            &contractor_addr,
            &String::from_str(&env, "John Doe"),
            &String::from_str(&env, "john@example.com"),
        );
        client.add_contractor(
            &admin,
            &removed_contractor,
            &String::from_str(&env, "Jane Doe"),
            &String::from_str(&env, "jane@example.com"),
        );

        let run_id = client.create_payroll_run(&admin, &1700000000u64, &1700086400u64);

        client.deposit_to_escrow(&admin, &token, &500_000i128);
        assert_eq!(client.get_company_balance(&admin, &token), 500_000);

        client.add_payment(
            &admin,
            &run_id,
            &contractor_addr,
            &100_000i128,
            &token,
            &String::from_str(&env, "worker"),
        );
        client.add_payment(
            &admin,
            &run_id,
            &removed_contractor,
            &50_000i128,
            &token,
            &String::from_str(&env, "departed"),
        );

        // Remove one contractor before executing; it must not be paid.
        client.remove_contractor(&admin, &removed_contractor);

        env.ledger().set_timestamp(1_700_100_000);

        client.approve_payroll_run(&admin, &run_id, &admin);
        client.execute_payroll_run(&admin, &run_id, &admin);

        assert_eq!(token_query.balance(&contractor_addr), 100_000);
        assert_eq!(token_query.balance(&removed_contractor), 0);
        assert_eq!(client.get_company_balance(&admin, &token), 400_000);

        let run = client.get_payroll_run(&run_id);
        assert_eq!(run.status, PayrollStatus::Completed);
        assert_ne!(run.executed_at, 0);
    }

    #[test]
    fn test_execute_fails_without_sufficient_escrow() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let contractor_addr = Address::generate(&env);
        let signers = vec![&env, admin.clone()];

        let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let token_client = token::StellarAssetClient::new(&env, &token);

        client.register_company(&admin, &signers, &1, &token);
        token_client.mint(&admin, &1_000_000i128);

        client.add_contractor(
            &admin,
            &contractor_addr,
            &String::from_str(&env, "John Doe"),
            &String::from_str(&env, "john@example.com"),
        );

        let run_id = client.create_payroll_run(&admin, &1700000000u64, &1700086400u64);

        // Funded with less than what the run intends to pay out.
        client.deposit_to_escrow(&admin, &token, &10_000i128);

        client.add_payment(
            &admin,
            &run_id,
            &contractor_addr,
            &100_000i128,
            &token,
            &String::from_str(&env, "salary"),
        );

        client.approve_payroll_run(&admin, &run_id, &admin);

        let result = client.try_execute_payroll_run(&admin, &run_id, &admin);
        assert!(result.is_err());
    }

    #[test]
    fn test_second_company_does_not_reset_run_counter() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PayrollManager);
        let client = PayrollManagerClient::new(&env, &contract_id);

        let admin_a = Address::generate(&env);
        let admin_b = Address::generate(&env);
        let token = Address::generate(&env);

        client.register_company(&admin_a, &vec![&env, admin_a.clone()], &1, &token);
        let run_id = client.create_payroll_run(&admin_a, &1700000000u64, &1700086400u64);
        assert_eq!(run_id, 0);

        client.register_company(&admin_b, &vec![&env, admin_b.clone()], &1, &token);
        let run_id_b = client.create_payroll_run(&admin_b, &1700001000u64, &1700087400u64);
        assert_eq!(run_id_b, 1);
    }
}
