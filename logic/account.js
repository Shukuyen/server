'use strict';

const BaseLogic = require('./_');
const ErrorResponse = require('../helpers/errorResponse');

class AccountLogic extends BaseLogic {
	static getModelName () {
		return 'account';
	}

	static getPluralModelName () {
		return 'accounts';
	}

	static format (account) {
		return {
			id: account.id,
			name: account.name,
			type: account.type,
			number: account.number,
			documentId: account.documentId,
			pluginId: account.pluginId
		};
	}

	static getValidTypeValues() {
		return ['checking', 'savings', 'creditCard', 'cash', 'paypal', 'mortgage', 'asset', 'loan'];
	}

	static create (body, options) {
		const DatabaseHelper = require('../helpers/database');
		const model = this.getModel().build();

		model.name = body.name;
		if (!model.name) {
			throw new ErrorResponse(400, 'Account requires attribute `name`…', {
				attributes: {
					name: 'Is required!'
				}
			});
		}
		if (model.name.length > 255) {
			throw new ErrorResponse(400, 'Attribute `Account.name` has a maximum length of 255 chars, sorry…', {
				attributes: {
					name: 'Is too long, only 255 characters allowed…'
				}
			});
		}

		model.type = body.type;
		if(this.getValidTypeValues().indexOf(model.type) === -1) {
			throw new ErrorResponse(
				400,
				'Attribute `Account.type` is invalid, must be one of: ' + this.getValidTypeValues().join(', '), {
				attributes: {
					name: 'Invalid value'
				}
			});
		}

		model.number = body.number || null;
		model.hidden = !!body.hidden;

		return DatabaseHelper.get('document')
			.find({
				where: {id: body.documentId},
				attributes: ['id'],
				include: [{
					model: DatabaseHelper.get('user'),
					attributes: [],
					where: {
						id: options.session.userId
					}
				}]
			})
			.then(function (documentModel) {
				if (!documentModel) {
					throw new ErrorResponse(401, 'Not able to create account: linked document not found.');
				}

				model.documentId = documentModel.id;
				return model.save();
			})
			.then(function (model) {
				return {model};
			})
			.catch(e => {
				throw e;
			});
	}

	static get (id, options) {
		const DatabaseHelper = require('../helpers/database');
		return this.getModel().findOne({
			where: {
				id: id
			},
			include: [{
				model: DatabaseHelper.get('document'),
				attributes: [],
				include: [{
					model: DatabaseHelper.get('user'),
					attributes: [],
					where: {
						id: options.session.userId
					}
				}]
			}]
		});
	}

	static list (id, options) {
		const DatabaseHelper = require('../helpers/database');
		const idp = id.split('/');

		const sql = {
			include: [{
				model: DatabaseHelper.get('document'),
				attributes: [],
				include: [{
					model: DatabaseHelper.get('user'),
					attributes: [],
					where: {
						id: options.session.userId
					}
				}]
			}]
		};

		if(idp[0] === 'documents' && idp[1]) {
			sql.include[0].where = {
				id: idp[1]
			};
		}

		return this.getModel().findAll(sql);
	}

	static update (model, body) {
		if(body.name !== undefined) {
			model.name = body.name;
		}
		if (!model.name) {
			throw new ErrorResponse(400, 'Account requires attribute `name`…', {
				attributes: {
					name: 'Is required!'
				}
			});
		}
		if (model.name.length > 255) {
			throw new ErrorResponse(400, 'Attribute `Account.name` has a maximum length of 255 chars, sorry…', {
				attributes: {
					name: 'Is too long, only 255 characters allowed…'
				}
			});
		}

		if(body.type !== null) {
			model.type = body.type;
		}
		if(this.getValidTypeValues().indexOf(model.type) === -1) {
			throw new ErrorResponse(
				400,
				'Attribute `Account.type` is invalid, must be one of: ' + this.getValidTypeValues().join(', '), {
					attributes: {
						name: 'Invalid value'
					}
				});
		}

		if(body.number !== undefined && !model.pluginId) {
			model.number = body.number || null;
		}

		if(body.hidden) {
			model.hidden = !!body.hidden;
		}

		return model.save();
	}

	static delete () {
		throw new ErrorResponse(
			501,
			'It\'s not allowed to delete accounts, try to hide them or remove the whole document.'
		);
	}
}

module.exports = AccountLogic;