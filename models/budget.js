module.exports = class TransactionModelDefinition {
    static getDefinition(DataTypes) {
        return {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: DataTypes.UUIDV4
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            goal: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            hidden: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        };
    }
};