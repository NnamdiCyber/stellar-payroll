use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentStream {
    pub id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount_per_second: i128,
    pub max_amount: i128,
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

        let mut next_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextStreamId)
            .unwrap();

        let now = env.ledger().timestamp();
        let stream = PaymentStream {
            id: next_id,
            sender: sender.clone(),
            recipient: recipient.clone(),
            token,
            amount_per_second,
            max_amount,
            start_time: now,
            end_time: now + duration_seconds,
            last_withdraw_time: now,
            withdrawn: 0,
            cancelled: false,
            memo: memo.clone(),
        };

        env.storage()
            .instance()
            .set(&stream_key(next_id), &stream);

        let mut sender_streams: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::SenderStreams(sender.clone()))
            .unwrap_or(Vec::new(&env));
        sender_streams.push_back(next_id);
        env.storage()
            .instance()
            .set(&DataKey::SenderStreams(sender), &sender_streams);

        let mut recipient_streams: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::RecipientStreams(recipient.clone()))
            .unwrap_or(Vec::new(&env));
        recipient_streams.push_back(next_id);
        env.storage()
            .instance()
            .set(&DataKey::RecipientStreams(recipient), &recipient_streams);

        let id = next_id;
        next_id += 1;
        env.storage()
            .instance()
            .set(&DataKey::NextStreamId, &next_id);

        id
    }

    pub fn withdraw(env: Env, stream_id: u64, amount: i128) {
        let mut stream: PaymentStream = env
            .storage()
            .instance()
            .get(&stream_key(stream_id))
            .unwrap();

        stream.recipient.require_auth();

        if stream.cancelled {
            panic!("stream is cancelled");
        }

        let now = env.ledger().timestamp();
        let _time_passed = now - stream.last_withdraw_time;
        let earned = if now >= stream.end_time {
            let total_duration = stream.end_time - stream.start_time;
            stream.amount_per_second * (total_duration as i128)
        } else {
            let elapsed = now - stream.start_time;
            stream.amount_per_second * (elapsed as i128)
        };

        let available = earned - stream.withdrawn;
        if available <= 0 {
            panic!("no funds available to withdraw");
        }

        let withdraw_amount = if amount > available { available } else { amount };

        let total_withdrawn = stream.withdrawn + withdraw_amount;
        if total_withdrawn > stream.max_amount {
            panic!("exceeds max stream amount");
        }

        let token_client = token::Client::new(&env, &stream.token);

        token_client.transfer(
            &stream.sender,
            &stream.recipient,
            &withdraw_amount,
        );

        stream.withdrawn = total_withdrawn;
        stream.last_withdraw_time = now;

        env.storage()
            .instance()
            .set(&stream_key(stream_id), &stream);
    }

    pub fn cancel_stream(env: Env, stream_id: u64) {
        let mut stream: PaymentStream = env
            .storage()
            .instance()
            .get(&stream_key(stream_id))
            .unwrap();

        stream.sender.require_auth();

        if stream.cancelled {
            panic!("stream already cancelled");
        }

        let now = env.ledger().timestamp();
        let earned = if now >= stream.end_time {
            let total_duration = stream.end_time - stream.start_time;
            stream.amount_per_second * (total_duration as i128)
        } else {
            let elapsed = now - stream.start_time;
            stream.amount_per_second * (elapsed as i128)
        };

        let available = earned - stream.withdrawn;
        stream.withdrawn += available;

        if available > 0 {
            let token_client = token::Client::new(&env, &stream.token);
            token_client.transfer(&stream.sender, &stream.recipient, &available);
        }

        stream.cancelled = true;
        env.storage()
            .instance()
            .set(&stream_key(stream_id), &stream);
    }

    pub fn get_stream(env: Env, stream_id: u64) -> PaymentStream {
        env.storage()
            .instance()
            .get(&stream_key(stream_id))
            .unwrap()
    }

    pub fn get_available_amount(env: Env, stream_id: u64) -> i128 {
        let stream: PaymentStream = env
            .storage()
            .instance()
            .get(&stream_key(stream_id))
            .unwrap();

        if stream.cancelled {
            return 0;
        }

        let now = env.ledger().timestamp();
        let earned = if now >= stream.end_time {
            let total_duration = stream.end_time - stream.start_time;
            stream.amount_per_second * (total_duration as i128)
        } else {
            let elapsed = now - stream.start_time;
            stream.amount_per_second * (elapsed as i128)
        };

        let available = earned - stream.withdrawn;
        if available > stream.max_amount - stream.withdrawn {
            stream.max_amount - stream.withdrawn
        } else {
            available
        }
    }

    pub fn get_recipient_streams(env: Env, recipient: Address) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::RecipientStreams(recipient))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_sender_streams(env: Env, sender: Address) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::SenderStreams(sender))
            .unwrap_or(Vec::new(&env))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    #[test]
    fn test_create_and_withdraw_stream() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PaymentStreamContract);
        let client = PaymentStreamContractClient::new(&env, &contract_id);

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let token = Address::generate(&env);

        client.initialize();

        let stream_id = client.create_stream(
            &sender,
            &recipient,
            &token,
            &100i128,
            &1_000_000i128,
            &3600u64,
            &String::from_str(&env, "Monthly salary stream"),
        );

        let stream = client.get_stream(&stream_id);
        assert_eq!(stream.sender, sender);
        assert_eq!(stream.recipient, recipient);
        assert!(!stream.cancelled);

        let streams = client.get_recipient_streams(&recipient);
        assert_eq!(streams.len(), 1);
        assert_eq!(streams.first().unwrap(), stream_id);
    }

    #[test]
    fn test_cancel_stream() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, PaymentStreamContract);
        let client = PaymentStreamContractClient::new(&env, &contract_id);

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let token = Address::generate(&env);

        client.initialize();

        let stream_id = client.create_stream(
            &sender,
            &recipient,
            &token,
            &100i128,
            &1_000_000i128,
            &3600u64,
            &String::from_str(&env, "test"),
        );

        client.cancel_stream(&stream_id);

        let stream = client.get_stream(&stream_id);
        assert!(stream.cancelled);

        let available = client.get_available_amount(&stream_id);
        assert_eq!(available, 0);
    }
}
