use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env, String, Vec};

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
    Escrow,
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

#[contract]
pub struct PayrollManager;

#[contractimpl]
impl PayrollManager {
    pub fn initialize(env: Env, admin: Address, token: Address) {
        admin.require_auth();
        let company = Company {
            admin: admin.clone(),
            signers: Vec::new(&env),
            min_signers: 1,
            token,
            active: true,
        };
        env.storage().instance().set(&company_key(&admin), &company);
        env.storage().instance().set(&DataKey::NextRunId, &0u64);
    }

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
        let company = Company { admin: admin.clone(), signers, min_signers, token, active: true };
        env.storage().instance().set(&company_key(&admin), &company);
        env.storage().instance().set(&DataKey::NextRunId, &0u64);
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
        if env.storage().instance().has(&contractor_key(&company_addr, &contractor_addr)) {
            panic!("contractor already exists");
        }

        let contractor = Contractor {
            wallet: contractor_addr.clone(),
            name,
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
        list.push_back(contractor_addr);
        env.storage().instance().set(&DataKey::CompanyContractors(company_addr), &list);
    }

    pub fn remove_contractor(env: Env, company_addr: Address, contractor_addr: Address) {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);
        company.admin.require_auth();

        let mut contractor: Contractor =
            env.storage().instance().get(&contractor_key(&company_addr, &contractor_addr)).unwrap();
        contractor.active = false;
        env.storage().instance().set(&contractor_key(&company_addr, &contractor_addr), &contractor);
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
            company: company_addr,
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

        run.approvals.push_back(signer);

        if run.approvals.len() >= company.min_signers {
            run.status = PayrollStatus::Approved;
        }

        env.storage().instance().set(&payroll_key(run_id), &run);
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

        run.status = PayrollStatus::Executing;
        env.storage().instance().set(&payroll_key(run_id), &run);

        let contractor_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::CompanyContractors(company_addr.clone()))
            .unwrap_or(Vec::new(&env));

        for contractor_addr in contractor_list.iter() {
            let payment_opt: Option<PaymentEntry> =
                env.storage().instance().get(&payment_key(run_id, &contractor_addr));

            if let Some(mut payment) = payment_opt {
                if payment.paid {
                    continue;
                }

                let token_client = token::Client::new(&env, &payment.currency);

                let escrow_addr = env
                    .storage()
                    .instance()
                    .get::<_, Address>(&DataKey::Escrow)
                    .unwrap_or(env.current_contract_address());

                token_client.transfer(&escrow_addr, &payment.contractor, &payment.amount);

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

        run.status = PayrollStatus::Completed;
        run.executed_at = env.ledger().timestamp();
        env.storage().instance().set(&payroll_key(run_id), &run);
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
    }

    pub fn deposit_to_escrow(env: Env, company_addr: Address, token: Address, amount: i128) {
        let company: Company = env.storage().instance().get(&company_key(&company_addr)).unwrap();
        require_active(&company);
        company.admin.require_auth();

        if amount <= 0 {
            panic!("deposit amount must be positive");
        }

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&company.admin, &env.current_contract_address(), &amount);

        env.storage().instance().set(&DataKey::Escrow, &env.current_contract_address());
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec, Env, String};

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
}
