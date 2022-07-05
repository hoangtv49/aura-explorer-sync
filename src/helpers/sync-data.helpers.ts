import { Injectable, Logger } from "@nestjs/common";
import { Block, Transaction, Delegation, DelegatorReward, ProposalVote, HistoryProposal, ProposalDeposit, SmartContract } from "../entities";
import { APP_CONSTANTS, CONST_CHAR, CONST_DELEGATE_TYPE, CONST_MSG_TYPE, CONST_PROPOSAL_TYPE, CONST_PUBKEY_ADDR, MESSAGE_ACTION, NODE_API, SMART_CONTRACT_VERIFICATION } from "../common/constants/app.constant";
export class SyncDataHelpers {
    // constructor() {

    // }
    static makeBlockData(blockData: any) {
        const newBlock = new Block();
        newBlock.block_hash = blockData.block_id.hash;
        newBlock.chainid = blockData.block.header.chain_id;
        newBlock.height = blockData.block.header.height;
        newBlock.num_txs = blockData.block.data.txs.length;
        newBlock.timestamp = blockData.block.header.time;
        newBlock.round = blockData.block.last_commit.round;
        newBlock.json_data = JSON.stringify(blockData);
        return newBlock;
    }
    static makeTrxData(txData: any, fetchingBlockHeight: number, txType: string, txRawLogData: string, time: any, txContractAddress: string) {
        const newTx = new Transaction();
        const fee = txData.tx_response.tx.auth_info.fee.amount[0];
        const txFee = (fee) ? (fee[CONST_CHAR.AMOUNT] / APP_CONSTANTS.PRECISION_DIV).toFixed(6) : Number("0").toFixed(6);
        // newTx.blockId = savedBlock.id;
        newTx.code = txData.tx_response.code;
        newTx.codespace = txData.tx_response.codespace;
        newTx.data =
            txData.tx_response.code === 0 ? txData.tx_response.data : '';
        newTx.gas_used = txData.tx_response.gas_used;
        newTx.gas_wanted = txData.tx_response.gas_wanted;
        newTx.height = fetchingBlockHeight;
        newTx.info = txData.tx_response.info;
        newTx.raw_log = txData.tx_response.raw_log;
        newTx.raw_log_data = txRawLogData ?? null;
        // newTx.timestamp = blockData.block.header.time;
        newTx.timestamp = time;
        newTx.tx = JSON.stringify(txData.tx_response);
        newTx.tx_hash = txData.tx_response.txhash;
        newTx.type = txType;
        newTx.fee = txFee;
        newTx.messages = txData.tx_response.tx.body.messages;
        newTx.contract_address = txContractAddress;
        return newTx;
    }
    static makeTxRawLogData(txData: any) {
        let txType = 'FAILED', txRawLogData, txContractAddress;
        if (txData.tx_response.code === 0) {
            const txLog = JSON.parse(txData.tx_response.raw_log);

            const txAttr = txLog[0].events.find(
                ({ type }) => type === CONST_CHAR.MESSAGE,
            );
            const txAction = txAttr.attributes.find(
                ({ key }) => key === CONST_CHAR.ACTION,
            );
            const regex = /_/gi;
            txType = txAction.value.replace(regex, ' ');

            const txMsgType = txType.substring(txType.lastIndexOf('.') + 1);
            if (txMsgType == CONST_MSG_TYPE.MSG_WITHDRAW_DELEGATOR_REWARD) {
                let amount = txData.tx_response.logs[0].events.find(
                    ({ type }) => type === CONST_CHAR.WITHDRAW_REWARDS,
                );
                amount.attributes = amount.attributes.filter((x) => x.key == CONST_CHAR.AMOUNT);
                txRawLogData = JSON.stringify(amount);
            } else if (txMsgType == CONST_MSG_TYPE.MSG_DELEGATE || txMsgType == CONST_MSG_TYPE.MSG_REDELEGATE || txMsgType == CONST_MSG_TYPE.MSG_UNDELEGATE) {
                let amount = txData.tx_response.tx.body.messages[0].amount;
                let reward;
                try {
                    reward = txData.tx_response.logs[0].events.find(
                        ({ type }) => type === CONST_CHAR.TRANSFER,
                    ).attributes.filter((x) => x.key == CONST_CHAR.AMOUNT);
                } catch (error) {
                    reward = 0;
                }
                const rawData = {
                    amount,
                    reward
                };
                txRawLogData = JSON.stringify(rawData);
            } else if (txMsgType == CONST_MSG_TYPE.MSG_INSTANTIATE_CONTRACT) {
                let contract_address = txData.tx_response.logs[0].events.find(
                    ({ type }) => type === CONST_CHAR.INSTANTIATE,
                ).attributes.find(
                    ({ key }) => key === CONST_CHAR._CONTRACT_ADDRESS,
                ).value;
                txContractAddress = contract_address;
            } else if (txMsgType == CONST_MSG_TYPE.MSG_EXECUTE_CONTRACT) {
                txContractAddress = txData.tx.body.messages[0].contract;
            }
        } else {
            const txBody = txData.tx_response.tx.body.messages[0];
            txType = txBody['@type'];
        }
        return [txType, txRawLogData, txContractAddress];
    }
    static makeRedelegationData(txData: any, message: any, index: number) {
        let delegation1 = new Delegation();
        delegation1.tx_hash = txData.tx_response.txhash;
        delegation1.delegator_address = message.delegator_address;
        delegation1.validator_address = message.validator_src_address;
        delegation1.amount = (Number(message.amount.amount) * (-1)) / APP_CONSTANTS.PRECISION_DIV;
        delegation1.created_at = new Date(txData.tx_response.timestamp);
        delegation1.type = CONST_DELEGATE_TYPE.REDELEGATE;
        let delegation2 = new Delegation();
        delegation2.tx_hash = txData.tx_response.txhash;
        delegation2.delegator_address = message.delegator_address;
        delegation2.validator_address = message.validator_dst_address;
        delegation2.amount = Number(message.amount.amount) / APP_CONSTANTS.PRECISION_DIV;
        delegation2.created_at = new Date(txData.tx_response.timestamp);
        delegation2.type = CONST_DELEGATE_TYPE.REDELEGATE;
        // delegations.push(delegation1);
        // delegations.push(delegation2);
        //save data to delegator_rewards table
        let amount1 = 0;
        let amount2 = 0;
        if (txData.tx_response.logs && txData.tx_response.logs.length > 0
            && txData.tx_response.logs[index].events && txData.tx_response.logs[index].events.length > 0) {
            const events = txData.tx_response.logs[index].events;
            const claimEvent = events.find(i => i.type === 'transfer');
            if (claimEvent) {
                const attributes = claimEvent.attributes;
                amount1 = Number(attributes[2].value.replace(CONST_CHAR.UAURA, ''));
                if (attributes.length > 3) {
                    amount2 = Number(attributes[5].value.replace(CONST_CHAR.UAURA, ''));
                }
            }
        }
        let reward1 = new DelegatorReward();
        reward1.delegator_address = message.delegator_address;
        reward1.validator_address = message.validator_src_address;
        reward1.amount = amount1;
        reward1.tx_hash = txData.tx_response.txhash;
        // delegatorRewards.push(reward1);
        let reward2 = new DelegatorReward();
        reward2.delegator_address = message.delegator_address;
        reward2.validator_address = message.validator_dst_address;
        reward2.amount = amount2;
        reward2.tx_hash = txData.tx_response.txhash;
        // delegatorRewards.push(reward2);
        return [delegation1, delegation2, reward1, reward2]
    }
    static makeWithDrawDelegationData(txData: any, message: any, index: number) {
        let reward = new DelegatorReward();
        reward.delegator_address = message.delegator_address;
        reward.validator_address = message.validator_address;
        reward.amount = 0;
        if (txData.tx_response.logs && txData.tx_response.logs.length > 0
            && txData.tx_response.logs[index].events && txData.tx_response.logs[index].events.length > 0) {
            const events = txData.tx_response.logs[index].events;
            const rewardEvent = events.find(i => i.type === 'withdraw_rewards');
            const attributes = rewardEvent.attributes;
            const amount = attributes[0].value;
            reward.amount = Number(amount.replace(CONST_CHAR.UAURA, ''));
        }
        reward.tx_hash = txData.tx_response.txhash;
        reward.created_at = new Date(txData.tx_response.timestamp);
        return reward;
    }
    static makeUndelegateData(txData: any, message: any, index: number) {
        let delegation = new Delegation();
        delegation.tx_hash = txData.tx_response.txhash;
        delegation.delegator_address = message.delegator_address;
        delegation.validator_address = message.validator_address;
        delegation.amount = (Number(message.amount.amount) * (-1)) / APP_CONSTANTS.PRECISION_DIV;
        delegation.created_at = new Date(txData.tx_response.timestamp);
        delegation.type = CONST_DELEGATE_TYPE.UNDELEGATE;
        //save data to delegator_rewards table
        let reward = new DelegatorReward();
        reward.delegator_address = message.delegator_address;
        reward.validator_address = message.validator_address;
        reward.amount = 0;
        if (txData.tx_response.logs && txData.tx_response.logs.length > 0
            && txData.tx_response.logs[index].events && txData.tx_response.logs[index].events.length > 0) {
            const events = txData.tx_response.logs[index].events;
            const claimEvent = events.find(i => i.type === 'transfer');
            if (claimEvent) {
                const attributes = claimEvent.attributes;
                reward.amount = Number(attributes[2].value.replace(CONST_CHAR.UAURA, ''));
            }
        }
        reward.tx_hash = txData.tx_response.txhash;
        return [delegation, reward];
    }
    static makeDelegateData(txData: any, message: any, index: number) {
        let delegation = new Delegation();
        delegation.tx_hash = txData.tx_response.txhash;
        delegation.delegator_address = message.delegator_address;
        delegation.validator_address = message.validator_address;
        delegation.amount = Number(message.amount.amount) / APP_CONSTANTS.PRECISION_DIV;
        delegation.created_at = new Date(txData.tx_response.timestamp);
        delegation.type = CONST_DELEGATE_TYPE.DELEGATE;
        //save data to delegator_rewards table
        let reward = new DelegatorReward();
        reward.delegator_address = message.delegator_address;
        reward.validator_address = message.validator_address;
        reward.amount = 0;
        if (txData.tx_response.logs && txData.tx_response.logs.length > 0
            && txData.tx_response.logs[index].events && txData.tx_response.logs[index].events.length > 0) {
            const events = txData.tx_response.logs[index].events;
            const claimEvent = events.find(i => i.type === 'transfer');
            if (claimEvent) {
                const attributes = claimEvent.attributes;
                reward.amount = Number(attributes[2].value.replace(CONST_CHAR.UAURA, ''));
            }
        }
        reward.tx_hash = txData.tx_response.txhash;
        return [delegation, reward];
    }
    static makeVoteData(txData, message: any) {
        let proposalVote = new ProposalVote();
        proposalVote.proposal_id = Number(message.proposal_id);
        proposalVote.voter = message.voter;
        proposalVote.tx_hash = txData.tx_response.txhash;
        proposalVote.option = message.option;
        proposalVote.created_at = new Date(txData.tx_response.timestamp);
        proposalVote.updated_at = new Date(txData.tx_response.timestamp);
        return proposalVote;
    }
    static makeSubmitProposal(txData: any, message: any, index: number) {
        let historyProposal = new HistoryProposal();
        let proposalDeposit = undefined;
        const proposalTypeReturn = message.content['@type'];
        const proposalType = proposalTypeReturn.substring(proposalTypeReturn.lastIndexOf('.') + 1);
        historyProposal.proposal_id = 0;
        if (txData.tx_response.logs && txData.tx_response.logs.length > 0
            && txData.tx_response.logs[index].events && txData.tx_response.logs[index].events.length > 0) {
            const events = txData.tx_response.logs[index].events;
            const submitEvent = events.find(i => i.type === 'submit_proposal');
            const attributes = submitEvent.attributes;
            const findId = attributes.find(i => i.key === 'proposal_id');
            historyProposal.proposal_id = Number(findId.value);
        }
        historyProposal.recipient = '';
        historyProposal.amount = 0;
        historyProposal.initial_deposit = 0;
        if (proposalType === CONST_PROPOSAL_TYPE.COMMUNITY_POOL_SPEND_PROPOSAL) {
            historyProposal.recipient = message.content.recipient;
            historyProposal.amount = (message.content.amount.length > 0) ? Number(message.content.amount[0].amount) : 0;
        } else {
            if (message.initial_deposit.length > 0) {
                historyProposal.initial_deposit = Number(message.initial_deposit[0].amount);
                //save data to proposal deposit
                let proposalDeposit = new ProposalDeposit();
                proposalDeposit.proposal_id = historyProposal.proposal_id;
                proposalDeposit.tx_hash = txData.tx_response.txhash;
                proposalDeposit.depositor = message.proposer;
                proposalDeposit.amount = Number(message.initial_deposit[0].amount);
                proposalDeposit.created_at = new Date(txData.tx_response.timestamp);
                // proposalDeposits.push(proposalDeposit);
            }
        }
        historyProposal.tx_hash = txData.tx_response.txhash;
        historyProposal.title = message.content.title;
        historyProposal.description = message.content.description;
        historyProposal.proposer = message.proposer;
        historyProposal.created_at = new Date(txData.tx_response.timestamp);
        return [historyProposal, proposalDeposit];
    }
    static makeDepositData(txData: any, message: any) {
        let proposalDeposit = new ProposalDeposit();
        proposalDeposit.proposal_id = Number(message.proposal_id);
        proposalDeposit.tx_hash = txData.tx_response.txhash;
        proposalDeposit.depositor = message.depositor;
        proposalDeposit.amount = Number(message.amount[0].amount);
        proposalDeposit.created_at = new Date(txData.tx_response.timestamp);
        return proposalDeposit;
    }
    static makeCreateValidatorData(txData: any, message: any) {
        let delegation = new Delegation();
        delegation.tx_hash = txData.tx_response.txhash;
        delegation.delegator_address = message.delegator_address;
        delegation.validator_address = message.validator_address;
        delegation.amount = Number(message.value.amount) / APP_CONSTANTS.PRECISION_DIV;
        delegation.created_at = new Date(txData.tx_response.timestamp);
        delegation.type = CONST_DELEGATE_TYPE.CREATE_VALIDATOR;
        return delegation;
    }
    static makeExecuteContractData(txData: any, message: any) {
        let smartContracts = [];
        let action = txData.tx.body.messages[0].msg.create_minter;
        let tx_hash = txData.tx_response.txhash;
        let height = txData.tx_response.height;
        let contract_addresses = txData.tx_response.logs[0].events.
            find((x) => x.type == CONST_CHAR.INSTANTIATE).attributes.filter((x) => x.key == CONST_CHAR._CONTRACT_ADDRESS);
        let code_ids = txData.tx_response.logs[0].events.
            find((x) => x.type == CONST_CHAR.INSTANTIATE).attributes.filter((x) => x.key == CONST_CHAR.CODE_ID);
        contract_addresses.map(function (x, i) {
            const smartContract = new SmartContract();
            smartContract.code_id = code_ids[i].value;
            smartContract.contract_address = contract_addresses[i].value;
            smartContract.creator_address = txData.tx_response.logs[0].events.
                find((x) => x.type == CONST_CHAR.EXECUTE).attributes.find((x) => x.key == CONST_CHAR._CONTRACT_ADDRESS).value;
            smartContract.tx_hash = tx_hash;
            smartContract.height = height;
            smartContract.contract_verification = SMART_CONTRACT_VERIFICATION.UNVERIFIED;
            smartContracts.push(smartContract);
        })
        return smartContracts;
    }
}





