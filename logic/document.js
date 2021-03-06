'use strict';

const BaseLogic = require('./_');
const DatabaseHelper = require('../helpers/database');
const ErrorResponse = require('../helpers/errorResponse');

class DocumentLogic extends BaseLogic {
    static getModelName () {
        return 'document';
    }

    static getPluralModelName () {
        return 'documents';
    }

    static format (document, secrets, options) {
        const r = {
            id: document.id,
            name: document.name,
            settings: {}
        };

        (document.settings || []).forEach(function (setting) {
            r.settings[setting.key] = JSON.parse(setting.value);
        });

        if (options.session.user.isAdmin && document.users) {
            r.users = document.users.map(user => ({
                id: user.id,
                email: user.email
            }));
        }
        else if (options.session.user) {
            r.users = [{
                id: options.session.user.id,
                email: options.session.user.email
            }];
        }

        return r;
    }

    static async create (attributes, options) {
        const model = this.getModel().build();

        model.name = attributes.name;
        if (!model.name) {
            throw new ErrorResponse(400, 'Documents require an attribute `name`…', {
                attributes: {
                    name: 'Is required!'
                }
            });
        }

        await model.save();
        let jobs = [model.addUser(options.session.user)];

        // Settings
        Object.entries(attributes.settings || {}).forEach(([k, v]) => {
            jobs.push(
                DatabaseHelper
                    .get('setting')
                    .create(
                        {
                            key: k,
                            value: JSON.stringify(v),
                            documentId: model.id
                        }
                    )
                    .then(setting => {
                        model.settings = model.settings || [];
                        model.settings.push(setting);
                    })
                    .catch(e => {
                        throw e;
                    })
            );
        });

        await Promise.all(jobs);
        return {model};
    }

    static async get (id, options) {
        const sql = {
            where: {id},
            include: [
                {
                    model: DatabaseHelper.get('user'),
                    attributes: ['id', 'email']
                },
                {
                    model: DatabaseHelper.get('setting')
                }
            ]
        };

        if (!options.session.user.isAdmin) {
            sql.include[0].where = {
                id: options.session.userId
            };
        }

        return this.getModel().findOne(sql);
    }

    static async list (params, options) {
        const sql = {
            include: [
                {
                    model: DatabaseHelper.get('user'),
                    attributes: ['id', 'email']
                },
                {
                    model: DatabaseHelper.get('setting')
                }
            ],
            order: [
                ['name', 'ASC']
            ]
        };

        if (!options.session.user.isAdmin) {
            sql.include[0].where = {
                id: options.session.userId
            };
        }

        return this.getModel().findAll(sql);
    }

    static async update (model, body, options) {
        if (body.name !== undefined && !body.name) {
            throw new ErrorResponse(400, 'Document name can\'t be empty…', {
                attributes: {
                    name: 'Is required'
                }
            });
        }
        if (body.name) {
            model.name = body.name;
        }

        await model.save();

        // settings
        if (body.settings !== undefined) {

            // delete old and unused settings
            await Promise.all(model.settings.map(setting => {
                if (Object.keys(body.settings).indexOf(setting.key) === -1) {
                    return setting.destroy();
                }

                return Promise.resolve();
            }));

            // compare new vs old
            model.settings = await Promise.all(Object.entries(body.settings).map(([key, value]) => {
                const oldSetting = model.settings.find(s => s.key === key);
                const newValue = JSON.stringify(value);

                if (oldSetting && oldSetting.value === newValue) {
                    return Promise.resolve(oldSetting);
                }
                else if (oldSetting) {
                    oldSetting.value = newValue;
                    return oldSetting.save();
                }
                else {
                    return DatabaseHelper
                        .get('setting')
                        .create({
                            key: key,
                            value: newValue,
                            documentId: model.id
                        });
                }
            }));
        }

        // leave document for non admins
        if (!options.session.user.isAdmin && Array.isArray(body.users) && body.users.length === 0) {
            const userModel = model.users.find(user => user.id === options.session.user.id);
            model.users.splice(model.users.indexOf(userModel), 1);
            await model.removeUser(userModel);
        }

        // all done for non-admins
        if (!options.session.user.isAdmin || !body.users) {
            return {model};
        }


        // add new users
        await Promise.all((body.users || []).map(async function (user) {
            const thisModel = model.users.find(u => u.id === user.id);
            if (thisModel) {
                return;
            }

            const userModel = await DatabaseHelper.get('user').findByPk(user.id);
            if (!userModel) {
                throw new ErrorResponse(400, 'Unable to add user to document: User not found', {
                    attributes: {
                        users: 'Unknown user specified…'
                    }
                });
            }

            model.users.push(userModel);
            return model.addUser(userModel);
        }));

        // remove old users
        await Promise.all((model.users || []).map(async function (userModel) {
            const plainUser = body.users.find(u => u.id === userModel.id);
            if (plainUser) {
                return;
            }

            model.users.splice(model.users.indexOf(userModel), 1);
            return model.removeUser(userModel);
        }));

        return {model};
    }

    static delete (model) {
        return model.destroy();
    }
}

module.exports = DocumentLogic;