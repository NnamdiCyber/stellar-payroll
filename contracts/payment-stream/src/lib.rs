use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentStream {
    pub id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount_per_second: i128,
    pub max_amount: i128,
    pub total_funded: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub last_withdraw_time: u64,
    pub withdrawn: i128,
    pub cancelled: bool,
    pub memo: String,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Stream(u64),
    NextStreamId,
    SenderStreams(Address),
    RecipientStreams(Address),
}

fn stream_key(id: u64) -> DataKey {
    DataKey::Stream(id)
}

fn compute_earned(env: &Env, stream: &PaymentStream) -> i128 {
    let now = env.ledger().timestamp();
    let elapsed = if now >= stream.end_time {
        stream.end_time - stream.start_time
    } else {
        now.saturating_sub(stream.start_time)
    };
    stream.amount_per_second * (elapsed as i128)
}

fn compute_available(stream: &PaymentStream, earned: i128) -> i128 {
    let cap = stream.max_amount.min(earned);
    cap.saturating_sub(stream.withdrawn).max(0)
}

#[contract]
pub struct PaymentStreamContract;

#[contractimpl]
impl PaymentStreamContract {
    pub fn initialize(env: Env) {
        env.storage().instance().set(&DataKey::NextStreamId, &0u64);
    }

    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        amount_per_second: i128,
        max_amount: i128,
        duration_seconds: u64,
        memo: String,
    ) -> u64 {
        sender.require_auth();

        if amount_per_second <= 0 {
            panic!("amount per second must be positive");
        }
        if max_amount <= 0 {
            panic!("max amount must be positive");
        }
        if duration_seconds == 0 {
            panic!("duration must be positive");
        }
        if recipient == sender {
            panic!("sender and recipient must differ");
        }

        let funded = amount_per_second
            .checked_mul(duration_seconds as i128)
            .expect("stream funding amount overflow");

        let mut next_id: u64 = env.storage().instance().get(&DataKey::NextStreamId).unwrap();

        let now = env.ledger().timestamp();
        let stream = PaymentStream {
            id: next_id,
            sender: sender.clone(),
            recipient: recipient.clone(),
            token: token.clone(),
            amount_per_second,
            max_amount,
            total_funded: funded,
            start_time: now,
            end_time: now.saturating_add(duration_seconds),
            last_withdraw_time: now,
            withdrawn: 0,
            cancelled: false,
            memo: memo.clone(),
        };

        // Pre-fund the stream from the sender so the contract can pay out
        // from its own balance instead of requiring sender authorization on
        // every withdrawal.
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &funded);

        env.storage().instance().set(&stream_key(next_id), &stream);

        let mut sender_streams: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::SenderStreams(sender.clone()))
            .unwrap_or(Vec::new(&env));
        sender_streams.push_back(next_id);
        env.storage().instance().set(&DataKey::SenderStreams(sender), &sender_streams);

        let mut recipient_streams: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RecipientStreams(recipient.clone()))
            .unwrap_or(Vec::new(&env));
        recipient_streams.push_back(next_id);
        env.storage().instance().set(&DataKey::RecipientStreams(recipient), &recipient_streams);

        let id = next_id;
        next_id += 1;
        env.storage().instance().set(&DataKey::NextStreamId, &next_id);

        id
    }

    pub fn withdraw(env: Env, stream_id: u64, amount: i128) {
        let mut stream: PaymentStream =
            env.storage().instance().get(&stream_key(stream_id)).unwrap();

        stream.recipient.require_auth();

        if stream.cancelled {
            panic!("stream is cancelled");
        }
        if amount <= 0 {
            panic!("withdrawal amount must be positive");
        }

        let earned = compute_earned(&env, &stream);
        let available = compute_available(&stream, earned);
        if available <= 0 {
            panic!("no funds available to withdraw");
        }

        let withdraw_amount = amount.min(available);

        let token_client = token::Client::new(&env, &stream.token);

        token_client.transfer(&env.current_contract_address(), &stream.recipient, &withdraw_amount);

        stream.withdrawn += withdraw_amount;
        stream.last_withdraw_time = env.ledger().timestamp();

        env.storage().instance().set(&stream_key(stream_id), &stream);
    }

    pub fn cancel_stream(env: Env, stream_id: u64) {
        let mut stream: PaymentStream =
            env.storage().instance().get(&stream_key(stream_id)).unwrap();

        stream.sender.require_auth();

        if stream.cancelled {
            panic!("stream already cancelled");
        }

        let earned = compute_earned(&env, &stream);
        let available = compute_available(&stream, earned);

        let token_client = token::Client::new(&env, &stream.token);

        // Pay the recipient everything earned but not yet withdrawn.
        if available > 0 {
            token_client.transfer(&env.current_contract_address(), &stream.recipient, &available);
            stream.withdrawn += available;
        }

        // Refund whatever is left to the sender.
        let refund = stream.total_funded - stream.withdrawn;
        if refund > 0 {
            token_client.transfer(&env.current_contract_address(), &stream.sender, &refund);
        }

        stream.cancelled = true;
        env.storage().instance().set(&stream_key(stream_id), &stream);
    }

    pub fn get_stream(env: Env, stream_id: u64) -> PaymentStream {
        env.storage().instance().get(&stream_key(stream_id)).unwrap()
    }

    pub fn get_available_amount(env: Env, stream_id: u64) -> i128 {
        let stream: PaymentStream = env.storage().instance().get(&stream_key(stream_id)).unwrap();

        if stream.cancelled {
            return 0;
        }

        let earned = compute_earned(&env, &stream);
        compute_available(&stream, earned)
    }

    pub fn get_recipient_streams(env: Env, recipient: Address) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::RecipientStreams(recipient))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_sender_streams(env: Env, sender: Address) -> Vec<u64> {
        env.storage().instance().get(&DataKey::SenderStreams(sender)).unwrap_or(Vec::new(&env))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger as _};
    use soroban_sdk::{token, token::StellarAssetClient, Env, String};

    const RATE: i128 = 100;
    const DURATION: u64 = 3600;

    fn setup(env: &Env) -> (Address, Address, StellarAssetClient<'_>, token::Client<'_>, i128) {
        let admin = Address::generate(env);
        let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let token_client = StellarAssetClient::new(env, &token);
        let token_query = token::Client::new(env, &token);

        let funded = RATE * (DURATION as i128);
        token_client.mint(&admin, &(funded * 100));

        (admin, token, token_client, token_query, funded)
    }

    fn create_client_stream(
        env: &Env,
        client: &PaymentStreamContractClient,
        sender: &Address,
        recipient: &Address,
        token: &Address,
        max_amount: i128,
    ) -> u64 {
        client.create_stream(
            sender,
            recipient,
            token,
            &RATE,
            &max_amount,
            &DURATION,
            &String::from_str(env, "Monthly salary stream"),
        )
    }

    #[test]
    fn test_create_funds_contract_and_withdraw_pays_out() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PaymentStreamContract);
        let client = PaymentStreamContractClient::new(&env, &contract_id);

        let (admin, token, _token_client, token_query, funded) = setup(&env);
        let sender = admin.clone();
        let recipient = Address::generate(&env);

        client.initialize();

        let stream_id =
            create_client_stream(&env, &client, &sender, &recipient, &token, 1_000_000i128);

        // Funding was moved from the sender into the contract at creation.
        assert_eq!(token_query.balance(&contract_id), funded);
        assert_eq!(token_query.balance(&recipient), 0);

        let stream = client.get_stream(&stream_id);
        assert_eq!(stream.sender, sender);
        assert_eq!(stream.recipient, recipient);
        assert_eq!(stream.total_funded, funded);
        assert!(!stream.cancelled);

        let elapsed = 1000u64;
        env.ledger().set_timestamp(env.ledger().timestamp() + elapsed);

        let available = client.get_available_amount(&stream_id);
        assert_eq!(available, RATE * (elapsed as i128));

        client.withdraw(&stream_id, &40_000i128);

        assert_eq!(token_query.balance(&recipient), 40_000);
        assert_eq!(token_query.balance(&contract_id), funded - 40_000);
        assert_eq!(client.get_available_amount(&stream_id), RATE * (elapsed as i128) - 40_000);

        let streams = client.get_recipient_streams(&recipient);
        assert_eq!(streams.len(), 1);
        assert_eq!(streams.first().unwrap(), stream_id);
    }

    #[test]
    fn test_withdraw_respects_max_amount_cap() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PaymentStreamContract);
        let client = PaymentStreamContractClient::new(&env, &contract_id);

        let (admin, token, _token_client, token_query, _funded) = setup(&env);
        let sender = admin.clone();
        let recipient = Address::generate(&env);

        client.initialize();

        let stream_id =
            create_client_stream(&env, &client, &sender, &recipient, &token, 50_000i128);

        // Push the clock past the stream end so earned is fully accrued.
        env.ledger().set_timestamp(env.ledger().timestamp() + DURATION * 2);

        assert_eq!(client.get_available_amount(&stream_id), 50_000);

        client.withdraw(&stream_id, &i128::MAX);

        assert_eq!(token_query.balance(&recipient), 50_000);
        assert_eq!(client.get_available_amount(&stream_id), 0);
    }

    #[test]
    fn test_cancel_pays_earned_and_refunds_remainder() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PaymentStreamContract);
        let client = PaymentStreamContractClient::new(&env, &contract_id);

        let (admin, token, _token_client, token_query, funded) = setup(&env);
        let sender = admin.clone();
        let recipient = Address::generate(&env);

        client.initialize();

        let stream_id =
            create_client_stream(&env, &client, &sender, &recipient, &token, 1_000_000i128);

        let elapsed = 1000u64;
        env.ledger().set_timestamp(env.ledger().timestamp() + elapsed);

        client.withdraw(&stream_id, &30_000i128);

        client.cancel_stream(&stream_id);

        let stream = client.get_stream(&stream_id);
        assert!(stream.cancelled);
        assert_eq!(client.get_available_amount(&stream_id), 0);

        // Recipient took 30k via withdraw + 70k earned at cancel = 100k.
        assert_eq!(token_query.balance(&recipient), 100_000);
        // Contract keeps nothing: the rest of the funding is returned.
        assert_eq!(token_query.balance(&contract_id), 0);
        // Total supply is conserved: minted initially, minus what the
        // recipient ultimately received.
        assert_eq!(token_query.balance(&sender), funded * 100 - 100_000);
    }

    #[test]
    fn test_rejects_invalid_parameters() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PaymentStreamContract);
        let client = PaymentStreamContractClient::new(&env, &contract_id);

        let (admin, _token, _token_client, _token_query, _funded) = setup(&env);
        let sender = admin.clone();
        let recipient = Address::generate(&env);
        let token = Address::generate(&env);

        client.initialize();

        let zero_rate = client.try_create_stream(
            &sender,
            &recipient,
            &token,
            &0i128,
            &1_000_000i128,
            &DURATION,
            &String::from_str(&env, "zero"),
        );
        assert!(zero_rate.is_err());

        let zero_duration = client.try_create_stream(
            &sender,
            &recipient,
            &token,
            &RATE,
            &1_000_000i128,
            &0u64,
            &String::from_str(&env, "zero duration"),
        );
        assert!(zero_duration.is_err());

        let self_stream = client.try_create_stream(
            &sender,
            &sender,
            &token,
            &RATE,
            &1_000_000i128,
            &DURATION,
            &String::from_str(&env, "self"),
        );
        assert!(self_stream.is_err());
    }
}
