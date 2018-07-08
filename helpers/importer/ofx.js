'use strict';

const path = require('path');
const ofx = require('ofx');
const moment = require('moment');
const TransactionLogic = require('../../logic/transaction');


/**
 * OFXImporter
 *
 * @module helpers/importer/ofx
 * @class OFXImporter
 */
class OFXImporter {
    static async check (file) {
        return path.extname(file.name).toLowerCase() === '.ofx';
    }

    static async parse (file) {
        const TransactionModel = TransactionLogic.getModel();
        const transactions = [];
        const data = await ofx.parse(file.data.toString());

        const transactionList = this.findTransactionList(data);
        if(!transactionList || !transactionList.STMTTRN) {
            throw new Error('Unable to import OFX file: Transaction List not found!');
        }

        transactionList.STMTTRN.forEach(transaction => {
            transactions.push(
                TransactionModel.build({
                    time: moment(transaction.DTPOSTED, 'YYYYMMDD').toJSON(),
                    memo: transaction.MEMO,
                    amount: parseInt(transaction.TRNAMT.replace(/,|\./, ''), 10),
                    pluginsOwnPayeeId: transaction.NAME
                })
            );
        });

        return transactions;
    }

    static findTransactionList (data) {
        if (typeof data === 'object' && data.BANKTRANLIST) {
            return data.BANKTRANLIST;
        }
        else if (typeof data === 'object') {
            return Object.values(data)
                .map(child => this.findTransactionList(child))
                .find(list => list);
        }
        else {
            return null;
        }
    }
}


module.exports = OFXImporter;